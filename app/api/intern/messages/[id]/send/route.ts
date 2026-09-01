import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';
import { isUuid } from '@/lib/validate';

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
  const senderUserName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || null;

  const { id: conversationId } = await params;

  // ECHTE INJECTION-FLÄCHE: conversationId landet unten mehrfach als
  // Pfadsegment in Directus-URLs (conversations/${conversationId} beim
  // PATCH), mit dem Service-Token. getActiveParticipant() prüft zwar
  // vorher die Berechtigung, aber diese Prüfung selbst könnte bei einem
  // manipulierten Wert ins Leere laufen statt sauber "keine Berechtigung"
  // zu liefern -- die Validierung gehört an den Anfang, nicht erst
  // implizit über eine andere Funktion.
  if (!isUuid(conversationId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const { message } = await request.json().catch(() => ({}));
  const messageTrimmed = String(message || '').trim();
  if (!messageTrimmed) {
    return NextResponse.json({ error: 'Bitte eine Nachricht eingeben.' }, { status: 400 });
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    console.error('Nachricht senden: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const participant = await getActiveParticipant(conversationId, user.organization.id);
  if (!participant) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Unterhaltung.' }, { status: 403 });
  }

  const now = new Date().toISOString();

  try {
    const messageRes = await fetch(`${DIRECTUS_URL}/items/conversation_messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        conversation: conversationId,
        sender_organization: user.organization.id,
        sender_user_name: senderUserName,
        body: messageTrimmed,
        message_type: 'message',
        created_at: now,
      }),
    });
    if (!messageRes.ok) {
      throw new Error(await messageRes.text());
    }

    await fetch(`${DIRECTUS_URL}/items/conversations/${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        last_message_at: now,
        last_message_preview: messageTrimmed.slice(0, 140),
      }),
    });

    await fetch(`${DIRECTUS_URL}/items/conversation_participants/${participant.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ last_read_at: now }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Nachricht senden fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Nachricht konnte nicht gesendet werden.' }, { status: 500 });
  }
}
