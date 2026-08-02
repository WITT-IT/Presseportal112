import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';

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
  const { newModeratorOrganizationId } = await request.json().catch(() => ({}));
  if (!newModeratorOrganizationId) {
    return NextResponse.json(
      { error: 'Bitte eine neue Moderationsorganisation auswählen.' },
      { status: 400 }
    );
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const caller = await getActiveParticipant(conversationId, user.organization.id);
  if (!caller || !caller.is_moderator) {
    return NextResponse.json(
      { error: 'Nur die aktuelle Moderation kann diese Rolle übertragen.' },
      { status: 403 }
    );
  }
  if (newModeratorOrganizationId === user.organization.id) {
    return NextResponse.json({ error: 'Bitte eine andere Organisation auswählen.' }, { status: 400 });
  }

  const target = await getActiveParticipant(conversationId, newModeratorOrganizationId);
  if (!target) {
    return NextResponse.json(
      { error: 'Diese Organisation ist nicht Teil der Unterhaltung.' },
      { status: 404 }
    );
  }

  try {
    const orgRes = await fetch(
      `${DIRECTUS_URL}/items/organizations/${newModeratorOrganizationId}?fields=id,name`,
      { headers }
    );
    const { data: org } = orgRes.ok
      ? await orgRes.json()
      : { data: { name: 'Die Organisation' } };

    const updateResults = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/conversation_participants/${caller.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_moderator: false }),
      }),
      fetch(`${DIRECTUS_URL}/items/conversation_participants/${target.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_moderator: true }),
      }),
    ]);
    if (updateResults.some((r) => !r.ok)) {
      throw new Error('Moderations-Update fehlgeschlagen.');
    }

    const now = new Date().toISOString();
    const systemText = `Die Moderation wurde an ${org.name} übertragen.`;

    await fetch(`${DIRECTUS_URL}/items/conversations/${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ last_message_at: now, last_message_preview: systemText }),
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
    console.error('Moderation übertragen fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Moderation konnte nicht übertragen werden.' },
      { status: 500 }
    );
  }
}
