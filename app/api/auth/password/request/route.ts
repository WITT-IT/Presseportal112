import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { createResetToken } from '@/lib/passwordResetToken';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

// 5 Anfragen pro Stunde, pro IP -- ohne diese Bremse könnte jemand den
// SMTP-Versand mit massenhaften Reset-Mails an fremde Adressen fluten
// (Spam-Missbrauch) oder das Postfach einer einzelnen Person gezielt
// zuspammen. Die generische Erfolgsantwort weiter unten verhindert zwar
// bereits, dass sich Adressen erraten lassen -- sie verhindert aber nicht,
// dass jemand denselben Endpunkt beliebig oft aufruft.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Bitte eine E-Mail-Adresse angeben.' }, { status: 400 });
  }

  const ip = clientIp(request);
  const rateLimitKey = `password-reset:${ip}`;
  const check = checkRateLimit(rateLimitKey, { max: MAX_ATTEMPTS, windowMs: WINDOW_MS });
  if (!check.allowed) {
    console.warn(`Passwort-Reset anfordern: Rate-Limit erreicht für IP ${ip}.`);
    // Bewusst dieselbe generische Antwort wie im Erfolgsfall -- auch das
    // Erreichen des Limits soll nach außen nicht verraten, ob die
    // angefragte Adresse existiert oder nicht. Der Retry-After-Header
    // dient nur ehrlichen Klienten (Browser-Formular), nicht als
    // zusätzliche Information für einen Angreifer.
    return NextResponse.json(
      { ok: true },
      { headers: { 'Retry-After': String(check.retryAfterSeconds ?? 3600) } }
    );
  }

  // Bewusst IMMER dieselbe Erfolgsmeldung, unabhängig davon ob die Adresse
  // wirklich existiert -- verhindert, dass sich über diesen Endpunkt
  // herausfinden lässt, welche E-Mail-Adressen registriert sind.
  const genericResponse = NextResponse.json({ ok: true });

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Passwort-Reset anfordern: DIRECTUS_SERVICE_TOKEN fehlt.');
    return genericResponse;
  }

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/users?filter[email][_eq]=${encodeURIComponent(
        email
      )}&filter[status][_eq]=active&fields=id,email,first_name`,
      { headers: { Authorization: `Bearer ${serviceToken}` } }
    );
    if (!res.ok) return genericResponse;

    const { data } = await res.json();
    const user = data?.[0];
    if (!user) return genericResponse;

    const token = createResetToken(user.email);
    await sendPasswordResetEmail({ to: user.email, name: user.first_name || '', token });
  } catch (error) {
    console.error('Passwort-Reset anfordern fehlgeschlagen:', error);
  }

  return genericResponse;
}
