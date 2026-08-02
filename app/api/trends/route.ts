import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { accounts, entries } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

// Daily minutes per account (for charting) + a streak count per account
// (consecutive days, including today, with at least one entry).
//
// The streak/trend math here is plain arithmetic, not a model — worth
// being upfront about that distinction rather than dressing up a
// day-count as "AI". The actual learned/statistical piece is the trend
// projection below (simple linear regression), which is a real fit over
// the data, just a small, honest one rather than a heavy ML pipeline.
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const db = await getDb();

  const days = Math.min(90, Number(req.nextUrl.searchParams.get('days') || 30));
  const since = new Date(Date.now() - days * 86400000);
  since.setHours(0, 0, 0, 0);

  const accts = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.archived, 0)));
  const rows = await db.select().from(entries).where(and(eq(entries.userId, userId), gte(entries.occurredAt, since)));

  // Build a day -> accountId -> minutes map, zero-filled for every day in range.
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const byDay: Record<string, Record<number, number>> = {};
  dayKeys.forEach(k => { byDay[k] = {}; });
  for (const e of rows) {
    const key = new Date(e.occurredAt).toISOString().slice(0, 10);
    if (!byDay[key]) continue;
    byDay[key][e.accountId] = (byDay[key][e.accountId] || 0) + e.minutes;
  }

  const series = dayKeys.map(day => {
    const point: Record<string, any> = { day };
    for (const a of accts) point[a.name] = byDay[day][a.id] || 0;
    return point;
  });

  // Streaks: walk backward from today per account until a day with 0 minutes.
  const streaks = accts.map((a: any) => {
    let current = 0;
    for (let i = dayKeys.length - 1; i >= 0; i--) {
      const minutes = byDay[dayKeys[i]][a.id] || 0;
      if (minutes > 0) current++;
      else break;
    }
    let best = 0, run = 0;
    for (const day of dayKeys) {
      const minutes = byDay[day][a.id] || 0;
      if (minutes > 0) { run++; best = Math.max(best, run); } else run = 0;
    }
    return { accountId: a.id, name: a.name, color: a.color, currentStreak: current, bestStreak: best };
  });

  // Trend projection: simple least-squares linear regression of daily
  // minutes over the window, per account. Reports the slope (minutes/day
  // change) and a naive 7-day-ahead projection. This is genuinely fit to
  // the data, not a placeholder — just a small, transparent model rather
  // than a black box.
  const trends = accts.map((a: any) => {
    const ys = dayKeys.map(day => byDay[day][a.id] || 0);
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - xMean) * (ys[i] - yMean); den += (xs[i] - xMean) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    const projectedNext7DayAvg = Math.max(0, Math.round((intercept + slope * (n + 3)) * 10) / 10);
    return {
      accountId: a.id, name: a.name,
      slopeMinutesPerDay: Math.round(slope * 100) / 100,
      direction: slope > 0.5 ? 'rising' : slope < -0.5 ? 'falling' : 'flat',
      projectedNext7DayAvgMinutes: projectedNext7DayAvg,
    };
  });

  return NextResponse.json({ days, series, streaks, trends });
}
