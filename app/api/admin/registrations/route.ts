import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const caller = await getCurrentUser(session.accessToken);
  if (!caller || !(await isAdministrator(caller.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Registrierungen laden: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const fields = [
    'id',
    'email',
    'first_name',
    'last_name',
    'requested_organization_name',
    'requested_gewerk',
  ].join(',');

  const res = await fetch(`${DIRECTUS_URL}/users?filter[status][_eq]=draft&fields=${fields}`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
  });
  if (!res.ok) {
    console.error(
      `Registrierungen laden fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return NextResponse.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
  const { data } = await res.json();
  return NextResponse.json({ registrations: data });
}
