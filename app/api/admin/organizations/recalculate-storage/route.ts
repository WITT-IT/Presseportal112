import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { recalculateOrgStorage } from '@/lib/storageRecalc';
import { isUuid } from '@/lib/validate';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  const admin = await isAdministrator(user.id);
  if (!admin) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const { organizationId } = await request.json().catch(() => ({}));
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId ist erforderlich.' }, { status: 400 });
  }
  // ECHTE INJECTION-FLÄCHE: organizationId landet als Pfadsegment, mit dem
  // Service-Token.
  if (!isUuid(organizationId)) {
    return NextResponse.json({ error: 'Ungültige Organisations-ID.' }, { status: 400 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Speicher-Neuberechnung: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  try {
    const orgRes = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}?fields=name`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
    });
    const organizationName = orgRes.ok ? (await orgRes.json()).data?.name ?? '' : '';

    const result = await recalculateOrgStorage(serviceToken, organizationId, organizationName);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(`Speicher-Neuberechnung fehlgeschlagen für Organisation ${organizationId}:`, error);
    return NextResponse.json({ error: 'Neuberechnung fehlgeschlagen.' }, { status: 500 });
  }
}
