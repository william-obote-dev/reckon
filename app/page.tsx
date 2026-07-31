'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Account = { id: number; name: string; color: string; targetPct: number };
type DashboardAccount = Account & { actualPct: number; minutesSpent: number; balance: number };
type Dashboard = { windowDays: number; totalMinutes: number; targetSumWarning: string | null; accounts: DashboardAccount[] };

const PALETTE = ['#3f9d6f', '#b8863f', '#5a7fa6', '#8c6fb0', '#c0563f', '#4a9db8'];

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [error, setError] = useState('');

  const load = useCallback(async (days: number) => {
    const [meRes, acctRes, dashRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/accounts'),
      fetch(`/api/dashboard?days=${days}`),
    ]);
    const me = await meRes.json();
    if (!me.user) { router.push('/login'); return; }
    if (acctRes.ok) setAccounts((await acctRes.json()).accounts);
    if (dashRes.ok) setDash(await dashRes.json());
    setChecking(false);
  }, [router]);

  useEffect(() => { load(windowDays); }, [load, windowDays]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (checking) {
    return <main className="flex-1 flex items-center justify-center text-muted text-sm">Opening the ledger…</main>;
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10">
        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-muted mb-1">a ledger for your life</div>
          <h1 className="text-2xl font-semibold">Reckon</h1>
        </div>
        <button onClick={signOut} className="text-sm text-muted hover:text-parchment transition">Sign out</button>
      </header>

      {accounts.length === 0 ? (
        <Onboarding onCreated={() => load(windowDays)} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-muted">Statement — last</h2>
            <select
              value={windowDays}
              onChange={e => setWindowDays(Number(e.target.value))}
              className="bg-ink-raised border border-white/10 rounded-md px-2 py-1 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {dash?.targetSumWarning && (
            <div className="mb-5 text-sm text-debit bg-debit/10 border border-debit/30 rounded-md px-4 py-3">
              {dash.targetSumWarning}
            </div>
          )}

          <div className="space-y-4 mb-10">
            {dash?.accounts.map(a => <AccountRow key={a.id} account={a} />)}
            {dash?.totalMinutes === 0 && (
              <p className="text-sm text-muted">No entries logged in this window yet — log one below to start reconciling.</p>
            )}
          </div>

          <EntryForm accounts={accounts} onLogged={() => load(windowDays)} />
          <AddAccount onCreated={() => load(windowDays)} existingCount={accounts.length} />
        </>
      )}
    </main>
  );
}

function AccountRow({ account }: { account: DashboardAccount }) {
  const deficit = account.balance < -3;
  const surplus = account.balance > 3;
  return (
    <div className="bg-ink-raised rounded-lg px-4 py-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: account.color }} />
          <span className="font-medium">{account.name}</span>
        </div>
        <span className={`tabular text-sm ${deficit ? 'text-debit' : surplus ? 'text-credit' : 'text-muted'}`}>
          {account.balance > 0 ? '+' : ''}{account.balance}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-black/30 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, account.actualPct)}%`, background: account.color }} />
        <div className="absolute inset-y-0 border-l-2 border-parchment/60" style={{ left: `${Math.min(100, account.targetPct)}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-muted tabular">
        <span>{account.actualPct}% actual · target {account.targetPct}%</span>
        <span>{Math.round(account.minutesSpent / 60 * 10) / 10}h logged</span>
      </div>
    </div>
  );
}

function EntryForm({ accounts, onLogged }: { accounts: Account[]; onLogged: () => void }) {
  const [accountId, setAccountId] = useState<number | string>(accounts[0]?.id ?? '');
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: Number(accountId), minutes: Number(minutes), note }),
    });
    setNote(''); setBusy(false);
    onLogged();
  }

  return (
    <form onSubmit={submit} className="mb-6">
      <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Log an entry</h2>
      <div className="flex flex-wrap gap-2">
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className="bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input
          type="number" min={1} value={minutes} onChange={e => setMinutes(Number(e.target.value))}
          className="w-24 bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm tabular"
        />
        <span className="self-center text-sm text-muted">min</span>
        <input
          type="text" placeholder="what happened (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="flex-1 min-w-[160px] bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm"
        />
        <button disabled={busy} className="bg-credit hover:bg-credit/90 disabled:opacity-50 text-ink font-medium rounded-md px-4 py-2 text-sm transition">
          {busy ? 'Logging…' : 'Post entry'}
        </button>
      </div>
    </form>
  );
}

function AddAccount({ onCreated, existingCount }: { onCreated: () => void; existingCount: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetPct, setTargetPct] = useState(10);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, targetPct: Number(targetPct), color: PALETTE[existingCount % PALETTE.length] }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setName(''); setOpen(false);
    onCreated();
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-sm text-muted hover:text-parchment transition">+ Add another account</button>;
  }
  return (
    <form onSubmit={submit} className="border-t border-line pt-4 mt-4">
      <h2 className="text-sm uppercase tracking-wide text-muted mb-3">New account</h2>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text" placeholder="e.g. Deep Work" required value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-[140px] bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="number" min={0} max={100} value={targetPct} onChange={e => setTargetPct(Number(e.target.value))}
          className="w-20 bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm tabular"
        />
        <span className="text-sm text-muted">% target</span>
        <button className="bg-credit hover:bg-credit/90 text-ink font-medium rounded-md px-4 py-2 text-sm transition">Create</button>
      </div>
      {error && <div className="text-sm text-debit mt-2">{error}</div>}
    </form>
  );
}

function Onboarding({ onCreated }: { onCreated: () => void }) {
  const [accts, setAccts] = useState([{ name: '', targetPct: 25 }, { name: '', targetPct: 25 }, { name: '', targetPct: 25 }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const usable = accts.filter(a => a.name.trim());
    if (usable.length === 0) { setError('Add at least one account.'); setBusy(false); return; }
    for (let i = 0; i < usable.length; i++) {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: usable[i].name, targetPct: usable[i].targetPct, color: PALETTE[i % PALETTE.length] }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); setBusy(false); return; }
    }
    onCreated();
  }

  return (
    <div>
      <p className="text-muted mb-6 leading-relaxed">
        Name the handful of things you actually want your time to go toward, and roughly what share of it each should get.
        You'll log real entries against these — Reckon compares the two and tells you where the gap is.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {accts.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder={['e.g. Health', 'e.g. Deep Work', 'e.g. Relationships'][i] || 'Account name'}
              value={a.name}
              onChange={e => setAccts(prev => prev.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))}
              className="flex-1 bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="number" min={0} max={100} value={a.targetPct}
              onChange={e => setAccts(prev => prev.map((p, idx) => idx === i ? { ...p, targetPct: Number(e.target.value) } : p))}
              className="w-20 bg-ink-raised border border-white/10 rounded-md px-3 py-2 text-sm tabular"
            />
            <span className="self-center text-sm text-muted">%</span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAccts(prev => [...prev, { name: '', targetPct: 10 }])}
          className="text-sm text-muted hover:text-parchment transition"
        >+ another account</button>
        {error && <div className="text-sm text-debit">{error}</div>}
        <div>
          <button disabled={busy} className="bg-credit hover:bg-credit/90 disabled:opacity-50 text-ink font-medium rounded-md px-5 py-2.5 text-sm transition">
            {busy ? 'Setting up…' : 'Start my ledger'}
          </button>
        </div>
      </form>
    </div>
  );
}
