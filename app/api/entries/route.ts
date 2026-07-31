import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { entries, accounts } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const db = await getDb();
  const days = Number(req.nextUrl.searchParams.get('days') || 30);
  const since = new Date(Date.now() - days * 86400000);
  const rows = await db.select().from(entries)
    .where(and(eq(entries.userId, userId), gte(entries.occurredAt, since)))
    .orderBy(desc(entries.occurredAt));
  return NextResponse.json({ entries: rows });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { accountId, minutes, note, occurredAt } = await req.json().catch(() => ({}));
  if (!accountId || !minutes || minutes <= 0) {
    return NextResponse.json({ error: 'accountId and a positive minutes value are required.' }, { status: 400 });
  }
  const db = await getDb();

  // Confirm the account belongs to this user before posting against it.
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  if (!account) return NextResponse.json({ error: 'That account was not found.' }, { status: 404 });

  const [entry] = await db.insert(entries).values({
    userId, accountId, minutes,
    note: note || '',
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
  }).returning();
  return NextResponse.json({ entry }, { status: 201 });
}
