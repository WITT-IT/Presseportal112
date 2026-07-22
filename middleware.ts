import { NextRequest, NextResponse } from 'next/server';
import { cookieOptions, refreshDirectusSession, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let session: { accessToken: string; refreshToken: string; expiresAt: number };
  try {
    session = JSON.parse(raw);
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.nextUrl.protocol === 'https:';

  // Läuft der Access Token in weniger als 60 Sekunden ab, jetzt schon
  // erneuern -- sonst würde die angeforderte Seite mit einem inzwischen
  // abgelaufenen Token laden und fehlschlagen.
  if (session.expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshDirectusSession(session.refreshToken);
    if (!refreshed) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE, JSON.stringify(refreshed), cookieOptions(isHttps));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/intern/:path*'],
};
