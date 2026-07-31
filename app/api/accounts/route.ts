import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.archived, 0)));
  return NextResponse.json({ accounts: rows });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { name, color, targetPct } = await req.json().catch(() => ({}));
  if (!name || typeof targetPct !== 'number' || targetPct < 0 || targetPct > 100) {
    return NextResponse.json({ error: 'name and a targetPct between 0-100 are required.' }, { status: 400 });
  }
  const db = await getDb();
  try {
    const [account] = await db.insert(accounts).values({
      userId, name, color: color || '#2f4d3a', targetPct,
    }).returning();
    return NextResponse.json({ account }, { status: 201 });
  } catch (err: any) {
    if (String(err.message || '').includes('unique')) {
      return NextResponse.json({ error: 'You already have an account with that name.' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Could not create that account right now.' }, { status: 500 });
  }
}
