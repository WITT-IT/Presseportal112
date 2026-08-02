import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getAllOrganizations } from '@/lib/queries';
import StartConversationForm from '@/components/StartConversationForm';

export const dynamic = 'force-dynamic';

type ConversationListItem = {
  id: string;
  subject: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unread: boolean;
};

async function getMyConversations(organizationId: string): Promise<ConversationListItem[]> {
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

export default async function MessagesPage() {
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
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/intern"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zum internen Bereich
        </Link>

        <h1 className="mb-2 font-display text-[32px] font-bold">Nachrichten</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Direkter Austausch mit anderen Organisationen im Portal.
        </p>

        <StartConversationForm organizations={otherOrganizations} />

        {conversations.length === 0 ? (
          <p className="text-[13px] text-ink-2">Noch keine Unterhaltungen.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/intern/nachrichten/${conv.id}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition-colors hover:border-line-strong"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {conv.unread && (
                      <span
                        className="h-2 w-2 flex-none rounded-full bg-signal"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`truncate text-[13.5px] ${conv.unread ? 'font-bold' : 'font-medium'}`}
                    >
                      {conv.subject}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-2">
                    {conv.lastMessagePreview}
                  </p>
                </div>
                <span className="ml-3 flex-none font-mono text-[10.5px] text-ink-3">
                  {conv.lastMessageAt
                    ? new Date(conv.lastMessageAt).toLocaleDateString('de-DE')
                    : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
