import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { accounts, entries } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

// The core reconciliation: for each account, compare its stated target
// share of time against the share it actually received over the window,
// and surface the gap as a "balance" — positive means overfunded relative
// to target, negative means running a deficit.
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const db = await getDb();

  const days = Number(req.nextUrl.searchParams.get('days') || 7);
  const since = new Date(Date.now() - days * 86400000);

  const accts = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.archived, 0)));
  const recentEntries = await db.select().from(entries)
    .where(and(eq(entries.userId, userId), gte(entries.occurredAt, since)));

  const totalMinutes = recentEntries.reduce((sum: number, e: any) => sum + e.minutes, 0);

  const targetSum = accts.reduce((s: number, a: any) => s + a.targetPct, 0);

  const summary = accts.map((a: any) => {
    const spent = recentEntries.filter((e: any) => e.accountId === a.id).reduce((s: number, e: any) => s + e.minutes, 0);
    const actualPct = totalMinutes > 0 ? (spent / totalMinutes) * 100 : 0;
    return {
      id: a.id,
      name: a.name,
      color: a.color,
      targetPct: a.targetPct,
      actualPct: Math.round(actualPct * 10) / 10,
      minutesSpent: spent,
      balance: Math.round((actualPct - a.targetPct) * 10) / 10, // negative = deficit
    };
  }).sort((a: any, b: any) => a.balance - b.balance); // biggest deficits first

  return NextResponse.json({
    windowDays: days,
    totalMinutes,
    targetSumWarning: targetSum > 0 && Math.abs(targetSum - 100) > 5
      ? `Your account targets add up to ${Math.round(targetSum)}%, not 100% — adjust them so the ledger reflects real tradeoffs.`
      : null,
    accounts: summary,
  });
}
