import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

const ALLOWED_VALIDITY_DAYS = [10, 20, 30];

export async function POST(request: NextRequest) {
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

  // organization NICHT mehr über einen Directus-Field-Preset erwarten --
  // Presets greifen je nach Rollen-/Policy-Konfiguration nicht zuverlässig
  // bei API-Requests mit Nutzer-Token, und genau das hat hier vermutlich
  // dazu geführt, dass neu angelegte Freigaben ohne organization landeten
  // und in der eigenen Liste (gefiltert nach organization) nie auftauchten.
  // Stattdessen explizit selbst setzen, wie überall sonst im Projekt auch.
  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Deinem Konto ist keine Organisation zugeordnet.' }, { status: 403 });
  }

  const { name, recipientName, recipientEmail, recipientOrganizationId, validityDays, autoDeleteOnExpiry } =
    await request.json().catch(() => ({}));

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }
  const days = Number(validityDays);
  if (!ALLOWED_VALIDITY_DAYS.includes(days)) {
    return NextResponse.json({ error: 'Ungültige Gültigkeitsdauer.' }, { status: 400 });
  }

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/media_shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: String(name).trim(),
        organization: user.organization.id,
        recipient_name: recipientName ? String(recipientName).trim() : null,
        recipient_email: recipientEmail ? String(recipientEmail).trim() : null,
        recipient_organization: recipientOrganizationId || null,
        token,
        active: true,
        expires_at: expiresAt,
        auto_delete_on_expiry: autoDeleteOnExpiry !== false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Freigabe anlegen fehlgeschlagen:', body);
      return NextResponse.json({ error: 'Freigabe konnte nicht angelegt werden.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Freigabe anlegen -- Netzwerkfehler:', err);
    return NextResponse.json({ error: 'Freigabe konnte nicht angelegt werden.' }, { status: 500 });
  }
}
