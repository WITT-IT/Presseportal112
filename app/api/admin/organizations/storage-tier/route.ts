import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { STORAGE_TIERS, storageLimitForTier } from '@/lib/storage';
import { isUuid } from '@/lib/validate';
import type { StorageTier } from '@/lib/types';

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

  const { organizationId, tier } = await request.json().catch(() => ({}));
  if (!organizationId || !tier) {
    return NextResponse.json({ error: 'organizationId und tier sind erforderlich.' }, { status: 400 });
  }
  // ECHTE INJECTION-FLÄCHE: organizationId landet als Pfadsegment in einem
  // PATCH mit dem Service-Token -- voller Schreibzugriff auf JEDE
  // Organisation.
  if (!isUuid(organizationId)) {
    return NextResponse.json({ error: 'Ungültige Organisations-ID.' }, { status: 400 });
  }
  if (!(tier in STORAGE_TIERS)) {
    return NextResponse.json({ error: 'Ungültige Speicherstufe.' }, { status: 400 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Tier-Wechsel: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const newLimitBytes = storageLimitForTier(tier as StorageTier);

  const res = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storage_tier: tier,
      storage_limit_bytes: newLimitBytes,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Tier-Wechsel fehlgeschlagen (${res.status}) für Organisation ${organizationId}:`, body);
    return NextResponse.json({ error: 'Tier-Wechsel fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier, limitBytes: newLimitBytes });
}
