import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { serviceHeaders } from '@/lib/messaging';
import { sendRegistrationApprovedEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const { token, first_name, last_name, email, password } = await request.json().catch(() => ({}));

  if (!token || !first_name || !last_name || !email || !password) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
      { status: 400 }
    );
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    console.error('Beitreten: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  try {
    // Einladung frisch nachladen und wirklich prüfen -- nie einer evtl.
    // vorher schon erfolgten Anzeige-Prüfung auf der Seite selbst vertrauen.
    const inviteRes = await fetch(
      `${DIRECTUS_URL}/items/organization_invites?filter[token][_eq]=${encodeURIComponent(
        token
      )}&fields=id,organization.id,organization.name,expires_at,used_at&limit=1`,
      { headers }
    );
    if (!inviteRes.ok) throw new Error('Einladung konnte nicht geladen werden.');
    const { data: invites } = await inviteRes.json();
    const invite = invites?.[0];

    if (!invite) {
      return NextResponse.json({ error: 'Diese Einladung ist ungültig.' }, { status: 404 });
    }
    if (invite.used_at) {
      return NextResponse.json({ error: 'Diese Einladung wurde bereits verwendet.' }, { status: 400 });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Diese Einladung ist abgelaufen.' }, { status: 400 });
    }

    // Läuft über den Service-Token, damit status="active" und die
    // Organisation direkt gesetzt werden können -- die öffentliche
    // Registrierungs-Policy würde das absichtlich verhindern (die erzwingt
    // ja status="draft").
    const createRes = await fetch(`${DIRECTUS_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_name,
        last_name,
        email,
        password,
        organization: invite.organization.id,
        status: 'active',
      }),
    });
    if (!createRes.ok) {
      const errorBody = await createRes.text();
      console.error('Beitreten -- Konto anlegen fehlgeschlagen:', errorBody);
      const isDuplicate = errorBody.includes('RECORD_NOT_UNIQUE');
      return NextResponse.json(
        {
          error: isDuplicate
            ? 'Für diese E-Mail-Adresse existiert bereits ein Konto.'
            : 'Konto konnte nicht angelegt werden.',
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }
    const { data: newUser } = await createRes.json();

    await fetch(`${DIRECTUS_URL}/items/organization_invites/${invite.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ used_at: new Date().toISOString(), used_by: newUser?.id ?? null }),
    });

    try {
      await sendRegistrationApprovedEmail({
        to: email,
        name: first_name,
        organizationName: invite.organization.name,
      });
    } catch (error) {
      console.error('Willkommensmail nach Beitritt fehlgeschlagen:', error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Beitreten fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Beitreten fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
