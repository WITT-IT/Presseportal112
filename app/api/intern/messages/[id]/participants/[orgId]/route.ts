import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';
import { isUuid } from '@/lib/validate';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orgId: string }> }
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

  const { id: conversationId, orgId: targetOrgId } = await params;

  // ECHTE INJECTION-FLÄCHE: beide IDs landen unten mehrfach als
  // Pfadsegment, mit dem Service-Token.
  if (!isUuid(conversationId) || !isUuid(targetOrgId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
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
      { error: 'Nur die Moderation kann Teilnehmer entfernen.' },
      { status: 403 }
    );
  }
  if (targetOrgId === user.organization.id) {
    return NextResponse.json(
      { error: 'Nutze „Unterhaltung verlassen", um dich selbst zu entfernen.' },
      { status: 400 }
    );
  }

  try {
    const target = await getActiveParticipant(conversationId, targetOrgId);
    if (!target) {
      return NextResponse.json(
        { error: 'Diese Organisation ist nicht (mehr) Teil der Unterhaltung.' },
        { status: 404 }
      );
    }

    const orgRes = await fetch(
      `${DIRECTUS_URL}/items/organizations/${targetOrgId}?fields=id,name`,
      { headers }
    );
    const { data: org } = orgRes.ok
      ? await orgRes.json()
      : { data: { name: 'Die Organisation' } };

    const now = new Date().toISOString();

    await fetch(`${DIRECTUS_URL}/items/conversation_participants/${target.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ left_at: now }),
    });

    const systemText = `${org.name} wurde aus der Unterhaltung entfernt.`;

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
    console.error('Teilnehmer entfernen fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Teilnehmer konnte nicht entfernt werden.' },
      { status: 500 }
    );
  }
}
