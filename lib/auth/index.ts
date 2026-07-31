import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET;

export function issueToken(userId: number) {
  if (!SECRET) throw new Error('JWT_SECRET is not set');
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): number | null {
  if (!SECRET) throw new Error('JWT_SECRET is not set');
  try {
    const payload = jwt.verify(token, SECRET) as unknown as { sub: number };
    return payload.sub;
  } catch {
    return null;
  }
}

// Reads the token from either the Authorization header or the `reckon_token`
// cookie, so the same API works from fetch() calls and from server components.
export function getUserId(req: NextRequest): number | null {
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const cookie = req.cookies.get('reckon_token')?.value || null;
  const token = bearer || cookie;
  if (!token) return null;
  return verifyToken(token);
}
