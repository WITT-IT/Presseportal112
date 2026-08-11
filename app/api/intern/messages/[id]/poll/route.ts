import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getActiveParticipant, serviceHeaders } from '@/lib/messaging';

// GET /api/intern/messages/[id]/poll?since=<ISO-Zeitstempel>
//
// Bewusst eine eigene, sehr schlanke Route statt den ganzen Thread über
// loadConversation() (in der Seite) neu zu laden -- Polling läuft alle
// paar Sekunden, da soll nur das Nötigste (neue Nachrichten seit "since")
// über den Draht gehen, nicht Teilnehmerliste, Betreff etc. erneut.
export async function GET(
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
  const since = request.nextUrl.searchParams.get('since');
  if (!since) {
    return NextResponse.json({ error: 'Parameter "since" fehlt.' }, { status: 400 });
  }

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  // Gleiche Zugriffsprüfung wie bei jeder anderen Nachrichten-Route --
  // Polling ist kein Sonderfall, braucht dieselbe Berechtigung wie Senden.
  const participant = await getActiveParticipant(conversationId, user.organization.id);
  if (!participant) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Unterhaltung.' }, { status: 403 });
  }

  try {
    const fields = [
      'id',
      'body',
      'message_type',
      'created_at',
      'sender_organization.id',
      'sender_organization.name',
      'sender_user_name',
    ].join(',');
    const res = await fetch(
      `${DIRECTUS_URL}/items/conversation_messages?filter[conversation][_eq]=${conversationId}&filter[created_at][_gt]=${encodeURIComponent(since)}&sort=created_at&fields=${fields}&limit=-1`,
      { headers, cache: 'no-store' }
    );
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
    const { data } = await res.json();

    const messages = (
      data as {
        id: string;
        body: string;
        message_type: string;
        created_at: string;
        sender_organization: { id: string; name: string } | null;
        sender_user_name: string | null;
      }[]
    ).map((m) => ({
      id: m.id,
      body: m.body,
      messageType: m.message_type,
      createdAt: m.created_at,
      senderOrganizationId: m.sender_organization?.id ?? null,
      senderOrganizationName: m.sender_organization?.name ?? null,
      senderUserName: m.sender_user_name ?? null,
    }));

    // Als gelesen markieren, wenn tatsächlich neue Nachrichten da sind --
    // best-effort, blockiert die Antwort nicht.
    if (messages.length > 0) {
      fetch(`${DIRECTUS_URL}/items/conversation_participants/${participant.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_read_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Nachrichten-Polling fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen.' }, { status: 500 });
  }
}
