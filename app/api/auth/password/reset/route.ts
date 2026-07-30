import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { verifyResetToken } from '@/lib/passwordResetToken';

export async function POST(request: NextRequest) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || !password) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
      { status: 400 }
    );
  }

  const payload = verifyResetToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' },
      { status: 400 }
    );
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Passwort zurücksetzen: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const adminHeaders = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Nochmal frisch nachschauen statt dem Token blind zu vertrauen -- das
    // Konto könnte zwischen Anfrage und Einlösen des Links gelöscht oder
    // deaktiviert worden sein.
    const userRes = await fetch(
      `${DIRECTUS_URL}/users?filter[email][_eq]=${encodeURIComponent(
        payload.email
      )}&filter[status][_eq]=active&fields=id&limit=1`,
      { headers: adminHeaders }
    );
    if (!userRes.ok) {
      throw new Error(`Nutzer konnte nicht geladen werden (Status ${userRes.status})`);
    }
    const { data } = await userRes.json();
    const user = data?.[0];
    if (!user) {
      return NextResponse.json({ error: 'Konto nicht gefunden oder nicht aktiv.' }, { status: 404 });
    }

    const patchRes = await fetch(`${DIRECTUS_URL}/users/${user.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ password }),
    });
    if (!patchRes.ok) {
      throw new Error(`Passwort konnte nicht gesetzt werden (Status ${patchRes.status})`);
    }
  } catch (error) {
    console.error('Passwort zurücksetzen fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Zurücksetzen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
