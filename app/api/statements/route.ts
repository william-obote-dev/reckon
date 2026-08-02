import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { accounts, entries, statements } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(statements).where(eq(statements.userId, userId)).orderBy(desc(statements.createdAt)).limit(10);
  return NextResponse.json({ statements: rows });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server — see README to add one.' }, { status: 501 });
  }

  const db = await getDb();
  const days = 7;
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - days * 86400000);

  const accts = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.archived, 0)));
  const rows = await db.select().from(entries).where(and(eq(entries.userId, userId), gte(entries.occurredAt, periodStart)));

  if (accts.length === 0) {
    return NextResponse.json({ error: 'Set up at least one account before generating a statement.' }, { status: 400 });
  }

  const totalMinutes = rows.reduce((s: number, e: any) => s + e.minutes, 0);
  const ledgerLines = accts.map((a: any) => {
    const spent = rows.filter((e: any) => e.accountId === a.id).reduce((s: number, e: any) => s + e.minutes, 0);
    const actualPct = totalMinutes > 0 ? Math.round((spent / totalMinutes) * 1000) / 10 : 0;
    const notes = rows.filter((e: any) => e.accountId === a.id && e.note).map((e: any) => e.note).slice(0, 5);
    return `${a.name}: target ${a.targetPct}%, actual ${actualPct}% (${spent} min logged)${notes.length ? `. Sample entries: ${notes.join('; ')}` : ''}`;
  }).join('\n');

  // Build the prompt server-side, entirely from this user's own ledger
  // data — no other users' data ever enters this call.
  const prompt = `You are writing a short, honest weekly statement for a personal time-ledger app called Reckon. The user defines "accounts" for what they say matters, each with a target share of their time, and logs entries against them. Below is their data for the past 7 days.

${ledgerLines}

Write a brief statement (120-180 words) in the second person, like a calm accountant narrating a bank statement — not a cheerleader, not scolding. Name the biggest gap between stated priority and actual time plainly. If something is going well, say so in one sentence, don't dwell. End with one concrete, small observation or question, not generic advice like "try to do better." Plain prose, no headers, no bullet points, no markdown.`;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const body = msg.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('').trim();

    const [saved] = await db.insert(statements).values({
      userId, periodStart, periodEnd, body,
    }).returning();

    return NextResponse.json({ statement: saved });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Could not generate a statement right now.' }, { status: 502 });
  }
}
