import { NextRequest, NextResponse } from 'next/server';
import { logoutDirectus, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (raw) {
    try {
      const session = JSON.parse(raw);
      await logoutDirectus(session.refreshToken);
    } catch {
      // Cookie war nicht lesbar -- egal, wird gleich sowieso gelöscht.
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
