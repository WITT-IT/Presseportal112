import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';

const MAX_PARTICIPANTS = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: conversationId } = await params;
  const { organizationId } = await request.json().catch(() => ({}));
  if (!organizationId) {
    return NextResponse.json({ error: 'Bitte eine Organisation auswählen.' }, { status: 400 });
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  // Geändert gegenüber vorher: Hinzufügen darf jetzt jeder aktive
  // Teilnehmer, nicht mehr nur die Moderation -- Entfernen bleibt exklusiv
  // bei der Moderation (siehe die separate [orgId]-Route).
  const caller = await getActiveParticipant(conversationId, user.organization.id);
  if (!caller) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Unterhaltung.' }, { status: 403 });
  }

  try {
    const existing = await getActiveParticipant(conversationId, organizationId);
    if (existing) {
      return NextResponse.json(
        { error: 'Diese Organisation nimmt bereits an der Unterhaltung teil.' },
        { status: 400 }
      );
    }

    const countRes = await fetch(
      `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[left_at][_null]=true&fields=id&limit=-1`,
      { headers }
    );
    const { data: currentParticipants } = countRes.ok ? await countRes.json() : { data: [] };
    if ((currentParticipants?.length || 0) >= MAX_PARTICIPANTS) {
      return NextResponse.json(
        { error: `In einer Unterhaltung können maximal ${MAX_PARTICIPANTS} Organisationen teilnehmen.` },
        { status: 400 }
      );
    }

    const orgRes = await fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=id,name`,
      { headers }
    );
    if (!orgRes.ok) {
      return NextResponse.json({ error: 'Organisation nicht gefunden.' }, { status: 404 });
    }
    const { data: org } = await orgRes.json();

    const now = new Date().toISOString();

    const addRes = await fetch(`${DIRECTUS_URL}/items/conversation_participants`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        conversation: conversationId,
        organization: organizationId,
        is_moderator: false,
        is_archived: false,
        joined_at: now,
        last_read_at: null,
      }),
    });
    if (!addRes.ok) {
      throw new Error(await addRes.text());
    }

    const systemText = `${org.name} wurde von ${user.organization.name ?? 'einer Organisation'} zur Unterhaltung hinzugefügt.`;

    await fetch(`${DIRECTUS_URL}/items/conversations/${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        kind: 'group',
        last_message_at: now,
        last_message_preview: systemText,
      }),
    });

    await fetch(`${DIRECTUS_URL}/items/conversation_messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        conversation: conversationId,
        sender_organization: null,
        body: systemText,
        message_type: 'system',
        created_at: now,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Teilnehmer hinzufügen fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Teilnehmer konnte nicht hinzugefügt werden.' },
      { status: 500 }
    );
  }
}
