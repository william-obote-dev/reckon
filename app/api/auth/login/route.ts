import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { issueToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user) return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });

  const token = issueToken(user.id);
  const res = NextResponse.json({ user: { id: user.id, email: user.email } });
  res.cookies.set('reckon_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
