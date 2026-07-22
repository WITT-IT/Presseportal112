import { NextRequest, NextResponse } from 'next/server';
import { cookieOptions, loginWithDirectus, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-Mail und Passwort erforderlich.' },
      { status: 400 }
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
