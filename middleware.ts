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

  console.log(
    '[mw-debug]',
    request.nextUrl.pathname,
    'purpose:', request.headers.get('purpose'), // 'prefetch' bei Next.js-Prefetch-Requests
    'cookie vorhanden:', !!raw
  );

  if (!raw) {
    if (isApiRoute) return NextResponse.next();
    console.log('[mw-debug] kein Cookie -> redirect /login für', request.nextUrl.pathname);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let session: { accessToken: string; refreshToken: string; expiresAt: number };
  try {
    session = JSON.parse(raw);
  } catch {
    console.log('[mw-debug] Cookie kaputt -> redirect /login für', request.nextUrl.pathname);
    if (isApiRoute) return NextResponse.next();
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.nextUrl.protocol === 'https:';

  const msRemaining = session.expiresAt - Date.now();
  console.log(
    '[mw-debug]',
    request.nextUrl.pathname,
    'accessToken (letzte 8):', session.accessToken.slice(-8),
    'läuft ab in (ms):', msRemaining
  );

  // Läuft der Directus-Access-Token in weniger als 60 Sekunden ab, jetzt
  // schon erneuern -- das gilt jetzt auch für die internen API-Routen
  // (vorher nur für Seitenaufrufe). Genau das hat gefehlt: eine Aktion wie
  // "Zu Freigabe hinzufügen" nutzte bisher das Token unverändert, egal wie
  // viel Zeit seit dem letzten Seitenaufruf vergangen war.
  if (msRemaining < 60_000) {
    console.log('[mw-debug] Token läuft bald ab -> refreshDirectusSession() wird aufgerufen für', request.nextUrl.pathname);
    const refreshed = await refreshDirectusSession(session.refreshToken);
    if (!refreshed) {
      console.log('[mw-debug] Refresh fehlgeschlagen -> redirect /login für', request.nextUrl.pathname);
      if (isApiRoute) return NextResponse.next();
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    console.log(
      '[mw-debug] Refresh erfolgreich, neuer accessToken (letzte 8):',
      refreshed.accessToken.slice(-8)
    );
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
