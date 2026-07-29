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
  if (!caller) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const callerIsAdmin = await isAdministrator(caller.id);
  if (!callerIsAdmin) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email')?.trim();
  if (!email) {
    return NextResponse.json({ error: 'Bitte eine E-Mail-Adresse angeben.' }, { status: 400 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('DIRECTUS_SERVICE_TOKEN fehlt -- Konto-Suche nicht möglich.');
    return NextResponse.json({ error: 'Serverseitig nicht konfiguriert.' }, { status: 500 });
  }
  const adminHeaders = { Authorization: `Bearer ${serviceToken}` };

  const userRes = await fetch(
    `${DIRECTUS_URL}/users?filter[email][_eq]=${encodeURIComponent(email)}&fields=id,email,first_name,last_name,status,organization.name&limit=1`,
    { headers: adminHeaders }
  );
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Suche fehlgeschlagen.' }, { status: 500 });
  }
  const { data } = await userRes.json();
  const found = data?.[0];
  if (!found) {
    return NextResponse.json(
      { error: 'Kein Konto mit dieser E-Mail-Adresse gefunden.' },
      { status: 404 }
    );
  }

  const countsRes = await fetch(
    `${DIRECTUS_URL}/items/posts?filter[uploaded_by][_eq]=${found.id}&fields=id,is_public&limit=-1`,
    { headers: adminHeaders }
  );
  const { data: posts } = countsRes.ok ? await countsRes.json() : { data: [] };
  const rows = (posts || []) as { is_public: boolean }[];
  const publicCount = rows.filter((row) => row.is_public).length;
  const privateCount = rows.length - publicCount;

  return NextResponse.json({
    id: found.id,
    email: found.email,
    name: [found.first_name, found.last_name].filter(Boolean).join(' '),
    organization: found.organization?.name ?? null,
    status: found.status,
    publicCount,
    privateCount,
  });
}
