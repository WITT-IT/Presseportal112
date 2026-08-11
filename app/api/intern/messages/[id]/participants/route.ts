import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';
import { sendAddedToConversationEmail } from '@/lib/email';

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

    // contact_email zusätzlich zu id,name laden -- vorher nur id,name, was
    // für die neue Benachrichtigungsmail nicht gereicht hätte.
    const orgRes = await fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=id,name,contact_email`,
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

    // NEU: Einmalige Benachrichtigungsmail an die neu hinzugefügte
    // Organisation -- vorher gab es dafür gar keine Mail, nur die
    // System-Nachricht oben, die niemand sieht, der die Seite nicht gerade
    // offen hat. Best-effort (Promise, kein await-Blocker, kein Abbruch der
    // eigentlichen Aktion bei Mail-Fehlern) und komplett eigenständig vom
    // eigentlichen Hinzufügen entkoppelt -- ein SMTP-Ausfall darf niemals
    // verhindern, dass die Organisation tatsächlich Teil der Unterhaltung wird.
    if (org.contact_email) {
      (async () => {
        try {
          const subjectRes = await fetch(
            `${DIRECTUS_URL}/items/conversations/${conversationId}?fields=subject`,
            { headers }
          );
          const subject = subjectRes.ok ? (await subjectRes.json()).data?.subject ?? '' : '';

          // Letzte echte Nachricht (kein System-Eintrag) für die Bubble in
          // der Mail -- gibt sofort Kontext, worum es in der Unterhaltung
          // gerade geht, statt einer inhaltsleeren "hinzugefügt"-Meldung.
          const lastMessageRes = await fetch(
            `${DIRECTUS_URL}/items/conversation_messages?filter[conversation][_eq]=${conversationId}&filter[message_type][_eq]=message&sort=-created_at&fields=body,sender_organization.name,sender_user_name&limit=1`,
            { headers }
          );
          const lastMessages = lastMessageRes.ok ? (await lastMessageRes.json()).data : [];
          const lastMessage = lastMessages?.[0] as
            | { body: string; sender_organization: { name: string } | null; sender_user_name: string | null }
            | undefined;

          await sendAddedToConversationEmail({
            to: org.contact_email,
            addedByOrganizationName: user.organization!.name ?? 'Eine Organisation',
            subject,
            lastMessageSenderName: lastMessage?.sender_organization?.name ?? null,
            lastMessagePreview: lastMessage?.body ?? null,
          });
        } catch (error) {
          console.error('Benachrichtigungsmail (hinzugefügt) fehlgeschlagen:', error);
        }
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Teilnehmer hinzufügen fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Teilnehmer konnte nicht hinzugefügt werden.' },
      { status: 500 }
    );
  }
}
