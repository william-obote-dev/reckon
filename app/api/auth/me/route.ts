import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ user: null });
  const db = await getDb();
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId));
  return NextResponse.json({ user: user || null });
}
