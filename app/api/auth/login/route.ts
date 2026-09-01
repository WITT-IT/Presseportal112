import { NextRequest, NextResponse } from 'next/server';
import { cookieOptions, loginWithDirectus, SESSION_COOKIE } from '@/lib/auth';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

// 10 Versuche pro 15 Minuten, pro IP -- großzügig genug für jemanden, der
// sich beim eigenen Passwort vertippt, eng genug um automatisiertes
// Durchprobieren spürbar zu bremsen. Zählt bewusst NUR fehlgeschlagene
// Versuche mit (siehe unten) -- ein Nutzer, der beim ersten Versuch das
// richtige Passwort eingibt, soll niemals an dieses Limit stoßen, egal wie
// oft er sich in der Vergangenheit vertippt hat.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-Mail und Passwort erforderlich.' },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  const rateLimitKey = `login:${ip}`;
  const check = checkRateLimit(rateLimitKey, { max: MAX_ATTEMPTS, windowMs: WINDOW_MS });
  if (!check.allowed) {
    console.warn(`Login: Rate-Limit erreicht für IP ${ip}.`);
    return NextResponse.json(
      { error: 'Zu viele Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.' },
      { status: 429, headers: { 'Retry-After': String(check.retryAfterSeconds ?? 60) } }
    );
  }

  try {
    const session = await loginWithDirectus(email, password);
    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.nextUrl.protocol === 'https:';
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, JSON.stringify(session), cookieOptions(isHttps));
    return response;
  } catch (err) {
    console.error('Login fehlgeschlagen:', err);
    const status = (err as { status?: number } | undefined)?.status;
    const isCredentialsError = status === 401 || status === 403;
    return NextResponse.json(
      {
        error: isCredentialsError
          ? 'E-Mail oder Passwort ist falsch, oder das Konto ist noch nicht freigeschaltet.'
          : 'Anmeldung gerade nicht möglich -- Directus ist nicht erreichbar. Bitte in Kürze erneut versuchen.',
      },
      { status: isCredentialsError ? 401 : 502 }
    );
  }
}
