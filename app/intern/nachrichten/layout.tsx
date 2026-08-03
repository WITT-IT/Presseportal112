import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getAllOrganizations } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import StartConversationForm from '@/components/StartConversationForm';
import ConversationListItem from '@/components/ConversationListItem';

export const dynamic = 'force-dynamic';

type ConversationListEntry = {
  id: string;
  subject: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unread: boolean;
};

async function getMyConversations(organizationId: string): Promise<ConversationListEntry[]> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return [];
  const headers = { Authorization: `Bearer ${serviceToken}` };

  try {
    const fields = [
      'id',
      'last_read_at',
      'conversation.id',
      'conversation.subject',
      'conversation.last_message_at',
      'conversation.last_message_preview',
    ].join(',');
    const res = await fetch(
      `${DIRECTUS_URL}/items/conversation_participants?filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&filter[is_archived][_neq]=true&fields=${fields}&limit=-1`,
      { headers, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(
        `getMyConversations fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return [];
    }
    const { data } = await res.json();
    return (
      data as {
        last_read_at: string | null;
        conversation: {
          id: string;
          subject: string;
          last_message_at: string | null;
          last_message_preview: string | null;
        } | null;
      }[]
    )
      .filter((row) => row.conversation)
      .map((row) => {
        const conv = row.conversation!;
        const unread =
          !row.last_read_at ||
          (!!conv.last_message_at && new Date(conv.last_message_at) > new Date(row.last_read_at));
        return {
          id: conv.id,
          subject: conv.subject,
          lastMessageAt: conv.last_message_at,
          lastMessagePreview: conv.last_message_preview || '',
          unread,
        };
      })
      .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  } catch (error) {
    console.error('getMyConversations fehlgeschlagen:', error);
    return [];
  }
}

export default async function MessagesLayout({ children }: { children: ReactNode }) {
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

  const [conversations, organizations] = await Promise.all([
    getMyConversations(user.organization.id),
    getAllOrganizations(),
  ]);

  const otherOrganizations = organizations.filter((org) => org.id !== user.organization?.id);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Nachrichten' }]} />

      <div className="flex gap-5" style={{ minHeight: '600px' }}>
        {/* Linke Spalte: alle Unterhaltungen, dauerhaft sichtbar */}
        <div className="flex w-[300px] flex-none flex-col gap-3">
          <StartConversationForm organizations={otherOrganizations} />
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-1 text-[12.5px] text-ink-2">Noch keine Unterhaltungen.</p>
            ) : (
              conversations.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  id={conv.id}
                  subject={conv.subject}
                  lastMessagePreview={conv.lastMessagePreview}
                  lastMessageAt={conv.lastMessageAt}
                  unread={conv.unread}
                />
              ))
            )}
          </div>
        </div>

        {/* Rechte Spalte: die ausgewählte Unterhaltung */}
        <div className="flex min-w-0 flex-1 flex-col rounded-[10px] border border-line bg-white p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
