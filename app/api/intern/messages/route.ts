import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { serviceHeaders } from '@/lib/messaging';
import { sendNewConversationEmail } from '@/lib/email';

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
  const ownOrgId = user.organization.id;

  const { recipientOrganizationId, subject, message } = await request.json().catch(() => ({}));

  if (!recipientOrganizationId || recipientOrganizationId === ownOrgId) {
    return NextResponse.json(
      { error: 'Bitte eine andere Organisation als Empfänger wählen.' },
      { status: 400 }
    );
  }
  const subjectTrimmed = String(subject || '').trim();
  if (subjectTrimmed.length < 2) {
    return NextResponse.json(
      { error: 'Bitte einen Betreff mit mindestens zwei Zeichen angeben.' },
      { status: 400 }
    );
  }
  const messageTrimmed = String(message || '').trim();
  if (!messageTrimmed) {
    return NextResponse.json({ error: 'Bitte eine erste Nachricht eingeben.' }, { status: 400 });
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    console.error('Nachrichten: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  try {
    // Zielorganisation muss wirklich existieren -- gleichzeitig holen wir
    // uns hier die contact_email für die Benachrichtigungsmail.
    const recipientRes = await fetch(
      `${DIRECTUS_URL}/items/organizations/${recipientOrganizationId}?fields=id,name,contact_email`,
      { headers }
    );
    if (!recipientRes.ok) {
      return NextResponse.json({ error: 'Empfänger-Organisation nicht gefunden.' }, { status: 404 });
    }
    const { data: recipientOrg } = await recipientRes.json();

    const conversationId = randomUUID();
    const now = new Date().toISOString();

    const convRes = await fetch(`${DIRECTUS_URL}/items/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: conversationId,
        subject: subjectTrimmed,
        kind: 'direct',
        created_at: now,
        last_message_at: now,
        last_message_preview: messageTrimmed.slice(0, 140),
      }),
    });
    if (!convRes.ok) {
      throw new Error(`Unterhaltung anlegen fehlgeschlagen: ${await convRes.text()}`);
    }

    // Beide Teilnehmer anlegen -- die eigene Organisation direkt als
    // "gelesen" markiert (sie hat die Nachricht ja gerade selbst
    // geschrieben), die Empfänger-Organisation ungelesen.
    const participantResults = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/conversation_participants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: randomUUID(),
          conversation: conversationId,
          organization: ownOrgId,
          is_moderator: false,
          is_archived: false,
          joined_at: now,
          last_read_at: now,
        }),
      }),
      fetch(`${DIRECTUS_URL}/items/conversation_participants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: randomUUID(),
          conversation: conversationId,
          organization: recipientOrganizationId,
          is_moderator: false,
          is_archived: false,
          joined_at: now,
          last_read_at: null,
        }),
      }),
    ]);
    if (participantResults.some((r) => !r.ok)) {
      throw new Error('Teilnehmer anlegen fehlgeschlagen.');
    }

    const messageRes = await fetch(`${DIRECTUS_URL}/items/conversation_messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        conversation: conversationId,
        sender_organization: ownOrgId,
        body: messageTrimmed,
        message_type: 'message',
        created_at: now,
      }),
    });
    if (!messageRes.ok) {
      throw new Error(`Nachricht anlegen fehlgeschlagen: ${await messageRes.text()}`);
    }

    // Best-effort -- die Unterhaltung ist zu diesem Zeitpunkt schon sicher
    // angelegt, ein Mail-Fehler soll das nicht rückgängig machen.
    if (recipientOrg?.contact_email) {
      try {
        await sendNewConversationEmail({
          to: recipientOrg.contact_email,
          fromOrganizationName: user.organization.name ?? 'Eine Organisation',
          subject: subjectTrimmed,
          messagePreview: messageTrimmed,
        });
      } catch (error) {
        console.error('Neue-Unterhaltung-Mail fehlgeschlagen:', error);
      }
    }

    return NextResponse.json({ ok: true, id: conversationId });
  } catch (error) {
    console.error('Unterhaltung starten fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Unterhaltung konnte nicht gestartet werden.' },
      { status: 500 }
    );
  }
}
