import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';

// Bewusst der reguläre /users-Endpunkt, nicht /users/register -- letzterer
// unterstützt laut Directus nur first_name/last_name als Zusatzfelder, wir
// brauchen aber auch requested_organization_name und requested_gewerk.
// Die Public-Policy in Directus erzwingt über Field Presets automatisch
// role="Organisation" und status="draft", egal was hier sonst mitgeschickt
// würde -- deshalb ist dieser Endpunkt sicher, ohne dass wir das selbst
// nochmal prüfen müssen.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { first_name, last_name, email, password, requested_organization_name, requested_gewerk } =
    body || {};

  if (!first_name || !last_name || !email || !password || !requested_gewerk) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
      { status: 400 }
    );
  }

  const res = await fetch(`${DIRECTUS_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name,
      last_name,
      email,
      password,
      requested_organization_name: requested_organization_name || null,
      requested_gewerk,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Registrierung fehlgeschlagen:', errorBody);
    const isDuplicate = errorBody.includes('RECORD_NOT_UNIQUE');
    return NextResponse.json(
      {
        error: isDuplicate
          ? 'Für diese E-Mail-Adresse existiert bereits ein Konto.'
          : 'Registrierung gerade nicht möglich. Bitte später erneut versuchen.',
      },
      { status: isDuplicate ? 409 : 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
