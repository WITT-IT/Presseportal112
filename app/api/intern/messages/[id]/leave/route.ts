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

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const caller = await getActiveParticipant(conversationId, user.organization.id);
  if (!caller) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Unterhaltung.' }, { status: 403 });
  }

  try {
    // Ist die eigene Organisation Moderation UND gibt es noch andere aktive
    // Teilnehmer -- dann muss zuerst übertragen werden.
    if (caller.is_moderator) {
      const othersRes = await fetch(
        `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[left_at][_null]=true&filter[organization][_neq]=${user.organization.id}&fields=id&limit=1`,
        { headers }
      );
      const { data: others } = othersRes.ok ? await othersRes.json() : { data: [] };
      if (others && others.length > 0) {
        return NextResponse.json(
          { error: 'Bitte übertrage zuerst die Moderation an eine andere Organisation.' },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    await fetch(`${DIRECTUS_URL}/items/conversation_participants/${caller.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ left_at: now }),
    });

    await fetch(`${DIRECTUS_URL}/items/conversation_messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        conversation: conversationId,
        sender_organization: null,
        body: `${user.organization.name ?? 'Eine Organisation'} hat die Unterhaltung verlassen.`,
        message_type: 'system',
        created_at: now,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unterhaltung verlassen fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Verlassen fehlgeschlagen.' }, { status: 500 });
  }
}
