import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const res = await db.update(accounts)
    .set({ archived: 1 })
    .where(and(eq(accounts.id, Number(id)), eq(accounts.userId, userId)))
    .returning();
  if (!res.length) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
