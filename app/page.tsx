'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Flame, TrendingUp, TrendingDown, Sparkles, LogOut, Plus, Check } from 'lucide-react';

type Account = { id: number; name: string; color: string; targetPct: number };
type DashboardAccount = Account & { actualPct: number; minutesSpent: number; balance: number };
type Dashboard = { windowDays: number; totalMinutes: number; targetSumWarning: string | null; accounts: DashboardAccount[] };
type Streak = { accountId: number; name: string; color: string; currentStreak: number; bestStreak: number };
type Trend = { accountId: number; name: string; slopeMinutesPerDay: number; direction: 'rising' | 'falling' | 'flat'; projectedNext7DayAvgMinutes: number };
type Trends = { days: number; series: Record<string, any>[]; streaks: Streak[]; trends: Trend[] };
type Statement = { id: number; body: string; periodStart: string; periodEnd: string; createdAt: string };

const PALETTE = ['#46ac7a', '#c99a52', '#5a8fc7', '#a179c9', '#cc6249', '#4ba8be'];
const QUICK_MINUTES = [15, 30, 45, 60, 90];

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [windowDays, setWindowDays] = useState(7);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const load = useCallback(async (days: number) => {
    const [meRes, acctRes, dashRes, trendRes, stmtRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/accounts'),
      fetch(`/api/dashboard?days=${days}`),
      fetch(`/api/trends?days=${Math.max(days, 14)}`),
      fetch('/api/statements'),
    ]);
    const me = await meRes.json();
    if (!me.user) { router.push('/login'); return; }
    if (acctRes.ok) setAccounts((await acctRes.json()).accounts);
    if (dashRes.ok) setDash(await dashRes.json());
    if (trendRes.ok) setTrends(await trendRes.json());
    if (stmtRes.ok) setStatements((await stmtRes.json()).statements);
    setChecking(false);
  }, [router]);

  useEffect(() => { load(windowDays); }, [load, windowDays]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const totalHours = dash ? Math.round(dash.totalMinutes / 60 * 10) / 10 : 0;
  const topStreak = trends?.streaks.reduce((max, s) => s.currentStreak > max.currentStreak ? s : max, trends.streaks[0]);
  const biggestDeficit = dash?.accounts.reduce((min, a) => a.balance < min.balance ? a : min, dash.accounts[0]);

  if (checking) {
    return (
      <main className="flex-1 flex items-center justify-center text-muted text-sm">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brass animate-pulse" />
          Opening the ledger…
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-muted mb-1">a ledger for your life</div>
          <h1 className="text-2xl font-semibold tracking-tight">Reckon</h1>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted hover:text-parchment transition">
          <LogOut size={14} /> Sign out
        </button>
      </header>

      {accounts.length === 0 ? (
        <Onboarding onCreated={() => load(windowDays)} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatCard label="Logged this window" value={`${totalHours}h`} />
            <StatCard
              label="Longest active streak"
              value={topStreak && topStreak.currentStreak > 0 ? `${topStreak.currentStreak}d` : '—'}
              sub={topStreak && topStreak.currentStreak > 0 ? topStreak.name : undefined}
              accent="brass"
            />
            <StatCard
              label="Biggest gap"
              value={biggestDeficit && biggestDeficit.balance < 0 ? `${biggestDeficit.balance}%` : '—'}
              sub={biggestDeficit && biggestDeficit.balance < -3 ? biggestDeficit.name : 'On track'}
              accent="debit"
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-muted">Statement — last</h2>
            <select
              value={windowDays}
              onChange={e => setWindowDays(Number(e.target.value))}
              className="bg-ink-raised border border-white/10 rounded-md px-2 py-1 text-sm cursor-pointer hover:border-white/20 transition"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {dash?.targetSumWarning && (
            <div className="mb-5 text-sm text-debit bg-debit/10 border border-debit/20 rounded-md px-4 py-3">
              {dash.targetSumWarning}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {dash?.accounts.map((a, i) => (
              <AccountRing
                key={a.id}
                account={a}
                streak={trends?.streaks.find(s => s.accountId === a.id)}
                trend={trends?.trends.find(t => t.accountId === a.id)}
                selected={selectedAccountId === a.id}
                onClick={() => setSelectedAccountId(cur => cur === a.id ? null : a.id)}
                delay={i * 0.05}
              />
            ))}
            {dash?.totalMinutes === 0 && (
              <p className="col-span-full text-sm text-muted">No entries logged in this window yet — log one below to start reconciling.</p>
            )}
          </div>

          {trends && trends.series.length > 0 && (
            <TrendChart
              trends={trends}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              hiddenSeries={hiddenSeries}
              onToggleSeries={(name) => setHiddenSeries(prev => {
                const next = new Set(prev);
                next.has(name) ? next.delete(name) : next.add(name);
                return next;
              })}
            />
          )}

          <EntryForm accounts={accounts} preselected={selectedAccountId} onLogged={() => load(windowDays)} />
          <AddAccount onCreated={() => load(windowDays)} existingCount={accounts.length} />

          <StatementPanel statements={statements} onGenerated={() => load(windowDays)} />
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'brass' | 'debit' }) {
  const valueColor = accent === 'brass' ? 'text-brass' : accent === 'debit' && value !== '—' ? 'text-debit' : 'text-parchment';
  return (
    <div className="bg-ink-raised rounded-xl px-4 py-3.5 rise-in">
      <div className="text-xs text-muted mb-1.5">{label}</div>
      <div className={`text-2xl font-medium tabular ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-muted-dim mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function AccountRing({ account, streak, trend, selected, onClick, delay }: {
  account: DashboardAccount; streak?: Streak; trend?: Trend; selected: boolean; onClick: () => void; delay: number;
}) {
  const r = 30, circumference = 2 * Math.PI * r;
  const fillPct = Math.min(100, account.actualPct) / 100;
  const targetAngle = (Math.min(100, account.targetPct) / 100) * 360 - 90;
  const deficit = account.balance < -3;
  const surplus = account.balance > 3;

  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}s` }}
      className={`card-interactive rise-in text-left bg-ink-raised hover:bg-ink-hover rounded-xl p-4 border ${selected ? 'border-white/25' : 'border-transparent'}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: 68, height: 68 }}>
          <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
            <circle cx="34" cy="34" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="6" />
            <circle
              cx="34" cy="34" r={r} fill="none" stroke={account.color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fillPct)}
              className="ring-fill"
              style={{ ['--ring-circumference' as any]: circumference, transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }}
            />
          </svg>
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-parchment/70 border-2 border-ink-raised"
            style={{
              top: '50%', left: '50%',
              transform: `rotate(${targetAngle}deg) translate(30px) rotate(${-targetAngle}deg) translate(-50%,-50%)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium tabular">{Math.round(account.actualPct)}%</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate mb-1">{account.name}</div>
          {streak && streak.currentStreak > 0 && (
            <div className="flex items-center gap-1 text-xs text-brass mb-1">
              <Flame size={12} fill="currentColor" /> {streak.currentStreak}d streak
            </div>
          )}
          <div className={`text-xs tabular flex items-center gap-1 ${deficit ? 'text-debit' : surplus ? 'text-credit' : 'text-muted'}`}>
            {trend && trend.direction !== 'flat' && (trend.direction === 'rising' ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
            {account.balance > 0 ? '+' : ''}{account.balance}%
          </div>
        </div>
      </div>
    </button>
  );
}

function TrendChart({ trends, accounts, selectedAccountId, hiddenSeries, onToggleSeries }: {
  trends: Trends; accounts: Account[]; selectedAccountId: number | null;
  hiddenSeries: Set<string>; onToggleSeries: (name: string) => void;
}) {
  const selectedName = accounts.find(a => a.id === selectedAccountId)?.name;
  return (
    <div className="bg-ink-raised rounded-xl p-4 mb-8 rise-in">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm uppercase tracking-wide text-muted">Daily activity — last {trends.days} days</h2>
        <div className="flex flex-wrap gap-1.5">
          {accounts.map(a => {
            const hidden = hiddenSeries.has(a.name);
            return (
              <button
                key={a.id}
                onClick={() => onToggleSeries(a.name)}
                className="chip flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                style={{
                  borderColor: hidden ? 'rgba(255,255,255,0.08)' : a.color + '55',
                  color: hidden ? 'var(--muted-dim)' : a.color,
                  background: hidden ? 'transparent' : a.color + '14',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? 'var(--muted-dim)' : a.color }} />
                {a.name}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <AreaChart data={trends.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {accounts.map(a => (
                <linearGradient key={a.id} id={`grad-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={a.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={a.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(238,241,238,0.05)" vertical={false} />
            <XAxis
              dataKey="day" tick={{ fill: '#8b95a1', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(d: string) => d.slice(5)}
              interval={Math.max(0, Math.floor(trends.series.length / 6))}
            />
            <YAxis tick={{ fill: '#8b95a1', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: '#1c2228', border: '1px solid rgba(238,241,238,0.1)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#eef1ee', marginBottom: 4 }}
              formatter={(value: any, name: any) => [`${value} min`, name]}
            />
            {accounts.filter(a => !hiddenSeries.has(a.name)).map(a => {
              const dimmed = selectedName && selectedName !== a.name;
              return (
                <Area
                  key={a.id} type="monotone" dataKey={a.name}
                  stroke={a.color} fill={`url(#grad-${a.id})`}
                  strokeWidth={selectedName === a.name ? 2.5 : 1.5}
                  strokeOpacity={dimmed ? 0.35 : 1}
                  fillOpacity={dimmed ? 0.4 : 1}
                  animationDuration={500}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EntryForm({ accounts, preselected, onLogged }: { accounts: Account[]; preselected: number | null; onLogged: () => void }) {
  const [accountId, setAccountId] = useState<number | string>(preselected ?? accounts[0]?.id ?? '');
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  useEffect(() => { if (preselected) setAccountId(preselected); }, [preselected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: Number(accountId), minutes: Number(minutes), note }),
    });
    setNote(''); setBusy(false);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
    onLogged();
  }

  return (
    <form onSubmit={submit} className="bg-ink-raised rounded-xl p-4 mb-6">
      <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Log an entry</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={accountId} onChange={e => setAccountId(e.target.value)}
          className="bg-ink border border-white/10 rounded-md px-3 py-2 text-sm cursor-pointer hover:border-white/20 transition"
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex gap-1">
          {QUICK_MINUTES.map(m => (
            <button
              type="button" key={m} onClick={() => setMinutes(m)}
              className={`chip w-11 h-9 rounded-md text-xs tabular border ${minutes === m ? 'bg-credit/20 border-credit/40 text-credit' : 'bg-ink border-white/10 text-muted hover:border-white/20'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="number" min={1} value={minutes} onChange={e => setMinutes(Number(e.target.value))}
          className="w-16 bg-ink border border-white/10 rounded-md px-2 py-2 text-sm tabular text-center"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text" placeholder="what happened (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="flex-1 min-w-[160px] bg-ink border border-white/10 rounded-md px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className={`flex items-center gap-1.5 disabled:opacity-50 font-medium rounded-md px-4 py-2 text-sm transition ${justLogged ? 'bg-credit text-ink' : 'bg-credit hover:bg-credit/90 text-ink'}`}
        >
          {justLogged ? <><Check size={14} /> Posted</> : busy ? 'Logging…' : 'Post entry'}
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
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-muted hover:text-parchment transition mb-2">
        <Plus size={14} /> Add another account
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="bg-ink-raised rounded-xl p-4 mb-2">
      <h2 className="text-sm uppercase tracking-wide text-muted mb-3">New account</h2>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text" placeholder="e.g. Deep Work" required value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-[140px] bg-ink border border-white/10 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="number" min={0} max={100} value={targetPct} onChange={e => setTargetPct(Number(e.target.value))}
          className="w-20 bg-ink border border-white/10 rounded-md px-3 py-2 text-sm tabular"
        />
        <span className="text-sm text-muted">% target</span>
        <button className="bg-credit hover:bg-credit/90 text-ink font-medium rounded-md px-4 py-2 text-sm transition">Create</button>
      </div>
      {error && <div className="text-sm text-debit mt-2">{error}</div>}
    </form>
  );
}

function StatementPanel({ statements, onGenerated }: { statements: Statement[]; onGenerated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true); setError('');
    const res = await fetch('/api/statements', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not generate a statement.'); setBusy(false); return; }
    setBusy(false);
    onGenerated();
  }

  return (
    <div className="border-t border-line pt-6 mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted">Weekly statement</h2>
        <button
          onClick={generate} disabled={busy}
          className="flex items-center gap-1.5 bg-brass hover:bg-brass/90 disabled:opacity-50 text-ink font-medium rounded-md px-4 py-2 text-xs transition"
        >
          <Sparkles size={13} /> {busy ? 'Writing…' : "Generate this week's statement"}
        </button>
      </div>
      {error && <div className="text-sm text-debit mb-3">{error}</div>}
      {statements.length === 0 ? (
        <p className="text-sm text-muted">No statements yet — generate one to get a plain-language read on your week.</p>
      ) : (
        <div className="space-y-3">
          {statements.map(s => (
            <div key={s.id} className="bg-ink-raised rounded-xl px-4 py-3.5 rise-in">
              <div className="text-xs text-muted tabular mb-2">{new Date(s.createdAt).toLocaleDateString()}</div>
              <p className="text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
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
