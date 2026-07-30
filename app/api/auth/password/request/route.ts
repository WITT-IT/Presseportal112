import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { createResetToken } from '@/lib/passwordResetToken';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Bitte eine E-Mail-Adresse angeben.' }, { status: 400 });
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
