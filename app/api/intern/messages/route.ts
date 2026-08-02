import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { serviceHeaders } from '@/lib/messaging';
import { sendNewConversationEmail } from '@/lib/email';

const MAX_RECIPIENTS = 9; // + eigene Organisation = maximal 10 Teilnehmer gesamt

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

  const { recipientOrganizationIds, subject, message } = await request.json().catch(() => ({}));

  const recipientIds: string[] = Array.isArray(recipientOrganizationIds)
    ? Array.from(
        new Set(
          recipientOrganizationIds.filter(
            (rid: unknown): rid is string => typeof rid === 'string' && rid !== ownOrgId
          )
        )
      )
    : [];

  if (recipientIds.length === 0) {
    return NextResponse.json(
      { error: 'Bitte mindestens eine Empfänger-Organisation auswählen.' },
      { status: 400 }
    );
  }
  if (recipientIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Zusammen mit deiner Organisation sind maximal ${MAX_RECIPIENTS + 1} Teilnehmer möglich.`,
      },
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
    // Alle Empfänger-Organisationen müssen wirklich existieren -- gleich-
    // zeitig holen wir uns hier die contact_email für die Benachrichtigung.
    const idsFilter = recipientIds
      .map((rid) => `filter[id][_in][]=${encodeURIComponent(rid)}`)
      .join('&');
    const recipientRes = await fetch(
      `${DIRECTUS_URL}/items/organizations?${idsFilter}&fields=id,name,contact_email`,
      { headers }
    );
    if (!recipientRes.ok) {
      throw new Error('Empfänger-Organisationen konnten nicht geladen werden.');
    }
    const { data: recipientOrgs } = await recipientRes.json();
    if (!recipientOrgs || recipientOrgs.length !== recipientIds.length) {
      return NextResponse.json(
        { error: 'Eine oder mehrere Empfänger-Organisationen wurden nicht gefunden.' },
        { status: 404 }
      );
    }

    const kind = recipientIds.length > 1 ? 'group' : 'direct';
    const conversationId = randomUUID();
    const now = new Date().toISOString();

    const convRes = await fetch(`${DIRECTUS_URL}/items/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: conversationId,
        subject: subjectTrimmed,
        kind,
        created_at: now,
        last_message_at: now,
        last_message_preview: messageTrimmed.slice(0, 140),
      }),
    });
    if (!convRes.ok) {
      throw new Error(`Unterhaltung anlegen fehlgeschlagen: ${await convRes.text()}`);
    }

    // Eigene Organisation wird bei einer Gruppe automatisch die erste
    // Moderation -- lässt sich später jederzeit übertragen. Bei einer
    // 1:1-Unterhaltung spielt die Moderation-Rolle keine praktische Rolle.
    const participantPayloads = [
      {
        id: randomUUID(),
        conversation: conversationId,
        organization: ownOrgId,
        is_moderator: kind === 'group',
        is_archived: false,
        joined_at: now,
        last_read_at: now,
      },
      ...recipientIds.map((orgId) => ({
        id: randomUUID(),
        conversation: conversationId,
        organization: orgId,
        is_moderator: false,
        is_archived: false,
        joined_at: now,
        last_read_at: null,
      })),
    ];

    const participantResults = await Promise.all(
      participantPayloads.map((payload) =>
        fetch(`${DIRECTUS_URL}/items/conversation_participants`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
      )
    );
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

    // Best-effort an alle Empfänger -- die Unterhaltung ist zu diesem
    // Zeitpunkt schon sicher angelegt, ein Mail-Fehler soll das nicht
    // rückgängig machen.
    await Promise.allSettled(
      (recipientOrgs as { name: string; contact_email: string | null }[]).map((org) =>
        org.contact_email
          ? sendNewConversationEmail({
              to: org.contact_email,
              fromOrganizationName: user.organization!.name ?? 'Eine Organisation',
              subject: subjectTrimmed,
              messagePreview: messageTrimmed,
            })
          : Promise.resolve()
      )
    );

    return NextResponse.json({ ok: true, id: conversationId });
  } catch (error) {
    console.error('Unterhaltung starten fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Unterhaltung konnte nicht gestartet werden.' },
      { status: 500 }
    );
  }
}
