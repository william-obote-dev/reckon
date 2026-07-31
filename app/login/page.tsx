'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(`Could not reach the server (${err.message}).`);
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xs tracking-[0.28em] uppercase text-muted mb-2">a ledger for your life</div>
          <h1 className="text-3xl font-semibold">Reckon</h1>
        </div>
        <div className="flex gap-1 mb-6 bg-ink-raised rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md text-sm transition ${mode === 'login' ? 'bg-credit/20 text-parchment' : 'text-muted'}`}
            onClick={() => setMode('login')}
          >Sign in</button>
          <button
            className={`flex-1 py-2 rounded-md text-sm transition ${mode === 'register' ? 'bg-credit/20 text-parchment' : 'text-muted'}`}
            onClick={() => setMode('register')}
          >Create account</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md bg-ink-raised border border-white/10 px-3 py-2.5 outline-none focus:border-credit/50"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1.5">Password</label>
            <input
              type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md bg-ink-raised border border-white/10 px-3 py-2.5 outline-none focus:border-credit/50"
            />
          </div>
          {error && <div className="text-sm text-debit">{error}</div>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-credit hover:bg-credit/90 disabled:opacity-50 text-ink font-medium rounded-md py-2.5 transition"
          >
            {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}
