import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import ConversationThread from '@/components/ConversationThread';

export const dynamic = 'force-dynamic';

type Message = {
  id: string;
  body: string;
  messageType: string;
  createdAt: string;
  senderOrganizationId: string | null;
  senderOrganizationName: string | null;
};

async function loadConversation(conversationId: string, organizationId: string) {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return null;
  const headers = { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' };

  // Sicherheitsprüfung zuerst -- ist diese Organisation überhaupt aktiver
  // Teilnehmer dieser Unterhaltung? Erst danach wird irgendwas geladen.
  const participantRes = await fetch(
    `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&fields=id,last_read_at&limit=1`,
    { headers }
  );
  if (!participantRes.ok) return null;
  const { data: participants } = await participantRes.json();
  const participant = participants?.[0];
  if (!participant) return null;

  const convRes = await fetch(
    `${DIRECTUS_URL}/items/conversations/${conversationId}?fields=id,subject`,
    { headers }
  );
  if (!convRes.ok) return null;
  const { data: conversation } = await convRes.json();

  const messagesRes = await fetch(
    `${DIRECTUS_URL}/items/conversation_messages?filter[conversation][_eq]=${conversationId}&sort=created_at&fields=id,body,message_type,created_at,sender_organization.id,sender_organization.name&limit=-1`,
    { headers }
  );
  if (!messagesRes.ok) return null;
  const { data: rawMessages } = await messagesRes.json();

  const messages: Message[] = (rawMessages || []).map(
    (m: {
      id: string;
      body: string;
      message_type: string;
      created_at: string;
      sender_organization: { id: string; name: string } | null;
    }) => ({
      id: m.id,
      body: m.body,
      messageType: m.message_type,
      createdAt: m.created_at,
      senderOrganizationId: m.sender_organization?.id ?? null,
      senderOrganizationName: m.sender_organization?.name ?? null,
    })
  );

  // Als gelesen markieren -- best-effort, blockiert die Anzeige nicht.
  fetch(`${DIRECTUS_URL}/items/conversation_participants/${participant.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ last_read_at: new Date().toISOString() }),
  }).catch(() => {});

  return { subject: conversation.subject as string, messages };
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) redirect('/login');

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect('/login');
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user) redirect('/login');
  if (!user.organization?.id) redirect('/intern');

  const data = await loadConversation(id, user.organization.id);
  if (!data) notFound();

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/intern/nachrichten"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Alle Unterhaltungen
        </Link>

        <h1 className="mb-6 font-display text-[28px] font-bold">{data.subject}</h1>

        <ConversationThread
          conversationId={id}
          initialMessages={data.messages}
          ownOrganizationId={user.organization.id}
        />
      </div>
    </section>
  );
}
