import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getAllOrganizations } from '@/lib/queries';
import ConversationThread from '@/components/ConversationThread';
import GroupManagementPanel from '@/components/GroupManagementPanel';

export const dynamic = 'force-dynamic';

type Message = {
  id: string;
  body: string;
  messageType: string;
  createdAt: string;
  senderOrganizationId: string | null;
  senderOrganizationName: string | null;
  senderUserName: string | null;
};

type Participant = {
  organizationId: string;
  organizationName: string;
  isModerator: boolean;
};

async function loadConversation(conversationId: string, organizationId: string) {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return null;
  const headers = { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' };

  // Sicherheitsprüfung zuerst -- ist diese Organisation überhaupt aktiver
  // Teilnehmer dieser Unterhaltung? Erst danach wird irgendwas geladen.
  const participantSelfRes = await fetch(
    `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&fields=id,last_read_at,is_moderator&limit=1`,
    { headers }
  );
  if (!participantSelfRes.ok) return null;
  const { data: selfRows } = await participantSelfRes.json();
  const self = selfRows?.[0];
  if (!self) return null;

  const convRes = await fetch(
    `${DIRECTUS_URL}/items/conversations/${conversationId}?fields=id,subject,kind`,
    { headers }
  );
  if (!convRes.ok) return null;
  const { data: conversation } = await convRes.json();

  const allParticipantsRes = await fetch(
    `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[left_at][_null]=true&fields=organization.id,organization.name,is_moderator&limit=-1`,
    { headers }
  );
  const { data: rawParticipants } = allParticipantsRes.ok
    ? await allParticipantsRes.json()
    : { data: [] };
  const participants: Participant[] = (
    (rawParticipants || []) as {
      organization: { id: string; name: string } | null;
      is_moderator: boolean;
    }[]
  )
    .filter((p) => p.organization)
    .map((p) => ({
      organizationId: p.organization!.id,
      organizationName: p.organization!.name,
      isModerator: p.is_moderator === true,
    }));

  const messagesRes = await fetch(
    `${DIRECTUS_URL}/items/conversation_messages?filter[conversation][_eq]=${conversationId}&sort=created_at&fields=id,body,message_type,created_at,sender_user_name,sender_organization.id,sender_organization.name&limit=-1`,
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
      sender_user_name: string | null;
      sender_organization: { id: string; name: string } | null;
    }) => ({
      id: m.id,
      body: m.body,
      messageType: m.message_type,
      createdAt: m.created_at,
      senderOrganizationId: m.sender_organization?.id ?? null,
      senderOrganizationName: m.sender_organization?.name ?? null,
      senderUserName: m.sender_user_name ?? null,
    })
  );

  // Als gelesen markieren -- best-effort, blockiert die Anzeige nicht.
  fetch(`${DIRECTUS_URL}/items/conversation_participants/${self.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ last_read_at: new Date().toISOString() }),
  }).catch(() => {});

  return {
    subject: conversation.subject as string,
    kind: conversation.kind as string,
    isOwnModerator: self.is_moderator === true,
    participants,
    messages,
  };
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

  const [data, allOrganizations] = await Promise.all([
    loadConversation(id, user.organization.id),
    getAllOrganizations(),
  ]);
  if (!data) notFound();

  const participantIds = new Set(data.participants.map((p) => p.organizationId));
  const availableOrganizations = allOrganizations.filter((org) => !participantIds.has(org.id));
  const ownUserName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '';

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="mb-4 flex-none border-b border-line pb-4">
        <h2 className="font-display text-[20px] font-bold">{data.subject}</h2>
      </div>

      {data.kind === 'group' && (
        <GroupManagementPanel
          conversationId={id}
          participants={data.participants}
          availableOrganizations={availableOrganizations}
          isOwnModerator={data.isOwnModerator}
          ownOrganizationId={user.organization.id}
        />
      )}

      <ConversationThread
        conversationId={id}
        initialMessages={data.messages}
        ownOrganizationId={user.organization.id}
        ownOrganizationName={user.organization.name ?? ''}
        ownUserName={ownUserName}
      />
    </div>
  );
}
