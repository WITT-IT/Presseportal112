import { randomUUID, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { serviceHeaders } from '@/lib/messaging';
import { sendInviteEmail } from '@/lib/email';

const MAX_PENDING_INVITES = 20;
const VALIDITY_DAYS = 14;

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

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    console.error('Einladungen laden: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const fields = ['id', 'email', 'expires_at', 'created_at'].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/organization_invites?filter[organization][_eq]=${user.organization.id}&filter[used_at][_null]=true&fields=${fields}&sort=-created_at&limit=-1`,
    { headers }
  );
  if (!res.ok) {
    console.error(
      `Einladungen laden fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return NextResponse.json({ error: 'Einladungen konnten nicht geladen werden.' }, { status: 500 });
  }
  const { data } = await res.json();

  // Abgelaufene Einladungen bewusst nicht sofort löschen -- nur in der
  // Anzeige kennzeichnen, so bleibt nachvollziehbar, dass mal eine
  // verschickt wurde.
  const now = Date.now();
  const invites = (
    (data || []) as { id: string; email: string | null; expires_at: string; created_at: string }[]
  ).map((inv) => ({
    ...inv,
    expired: new Date(inv.expires_at).getTime() < now,
  }));

  return NextResponse.json({ invites });
}

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

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  const { email } = await request.json().catch(() => ({}));
  const inviteEmail = email ? String(email).trim() : null;

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    console.error('Einladung anlegen: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  try {
    const countRes = await fetch(
      `${DIRECTUS_URL}/items/organization_invites?filter[organization][_eq]=${user.organization.id}&filter[used_at][_null]=true&fields=id&limit=-1`,
      { headers }
    );
    const { data: pending } = countRes.ok ? await countRes.json() : { data: [] };
    if ((pending?.length || 0) >= MAX_PENDING_INVITES) {
      return NextResponse.json(
        { error: `Maximal ${MAX_PENDING_INVITES} offene Einladungen gleichzeitig möglich.` },
        { status: 400 }
      );
    }

    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const createRes = await fetch(`${DIRECTUS_URL}/items/organization_invites`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        organization: user.organization.id,
        created_by: user.id,
        token,
        email: inviteEmail,
        expires_at: expiresAt,
        created_at: now.toISOString(),
      }),
    });
    if (!createRes.ok) {
      throw new Error(await createRes.text());
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const joinUrl = `${siteUrl}/organisationen/beitreten?token=${token}`;

    // Best-effort -- die Einladung existiert zu diesem Zeitpunkt schon
    // sicher, ein Mail-Fehler soll das nicht rückgängig machen. Der Link
    // wird dem Aufrufer sowieso direkt zurückgegeben, kann also notfalls
    // manuell weitergegeben werden.
    if (inviteEmail) {
      try {
        await sendInviteEmail({
          to: inviteEmail,
          organizationName: user.organization.name ?? 'deiner Organisation',
          invitedByName:
            [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
          joinUrl,
        });
      } catch (error) {
        console.error('Einladungsmail fehlgeschlagen:', error);
      }
    }

    return NextResponse.json({ ok: true, token, joinUrl });
  } catch (error) {
    console.error('Einladung anlegen fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Einladung konnte nicht angelegt werden.' }, { status: 500 });
  }
}
