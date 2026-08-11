import { NextRequest, NextResponse } from 'next/server';
import { cookieOptions, refreshDirectusSession, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // API-Routen brauchen eine andere Behandlung als Seitenaufrufe: bei einer
  // fehlenden/ungültigen Sitzung dürfen wir hier NICHT auf /login
  // weiterleiten (ein fetch() würde dann eine Weiterleitungsantwort statt
  // einer sauberen JSON-Fehlermeldung bekommen) -- stattdessen einfach
  // durchlassen und die jeweilige Route ihre eigene 401-Antwort geben
  // lassen, wie sie es schon immer getan hat.
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  if (!raw) {
    if (isApiRoute) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let session: { accessToken: string; refreshToken: string; expiresAt: number };
  try {
    session = JSON.parse(raw);
  } catch {
    if (isApiRoute) return NextResponse.next();
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.nextUrl.protocol === 'https:';

  // Läuft der Directus-Access-Token in weniger als 60 Sekunden ab, jetzt
  // schon erneuern -- das gilt jetzt auch für die internen API-Routen
  // (vorher nur für Seitenaufrufe). Genau das hat gefehlt: eine Aktion wie
  // "Zu Freigabe hinzufügen" nutzte bisher das Token unverändert, egal wie
  // viel Zeit seit dem letzten Seitenaufruf vergangen war.
  if (session.expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshDirectusSession(session.refreshToken);
    if (!refreshed) {
      if (isApiRoute) return NextResponse.next();
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    session = refreshed;
  }

  // Gleitendes 10-Minuten-Sitzungsfenster: jeder Besuch im internen Bereich
  // (jetzt inklusive API-Aktionen) verlängert das Cookie um weitere 10
  // Minuten. Ganz ohne Aktivität dort läuft das Cookie von selbst ab
  // (Browser wirft es weg), ohne dass wir hier aktiv etwas tun müssen.
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, JSON.stringify(session), cookieOptions(isHttps));
  return response;
}

export const config = {
  matcher: ['/intern/:path*', '/api/intern/:path*'],
};
