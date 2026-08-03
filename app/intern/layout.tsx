import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import InternSidebar from '@/components/InternSidebar';

export const dynamic = 'force-dynamic';

// Dieselbe Zählung wie zuvor im Dashboard -- jetzt hier, weil die Hülle
// jede Unterseite umschließt und das Badge in der Seitenleiste überall
// sichtbar sein soll, nicht nur auf der Startseite.
async function getUnreadConversationCount(organizationId: string): Promise<number> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return 0;
  const headers = { Authorization: `Bearer ${serviceToken}` };

  try {
    const fields = ['last_read_at', 'conversation.last_message_at'].join(',');
    const res = await fetch(
      `${DIRECTUS_URL}/items/conversation_participants?filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&filter[is_archived][_neq]=true&fields=${fields}&limit=-1`,
      { headers, cache: 'no-store' }
    );
    if (!res.ok) return 0;
    const { data } = await res.json();
    return (
      data as {
        last_read_at: string | null;
        conversation: { last_message_at: string | null } | null;
      }[]
    ).filter(
      (row) =>
        row.conversation &&
        (!row.last_read_at ||
          (row.conversation.last_message_at &&
            new Date(row.conversation.last_message_at) > new Date(row.last_read_at)))
    ).length;
  } catch (error) {
    console.error('getUnreadConversationCount fehlgeschlagen:', error);
    return 0;
  }
}

export default async function InternLayout({ children }: { children: ReactNode }) {
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

  const isPress = user.organization?.organization_type === 'press';

  const [admin, unreadCount] = await Promise.all([
    isAdministrator(user.id),
    user.organization?.id
      ? getUnreadConversationCount(user.organization.id)
      : Promise.resolve(0),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-72px)]">
      <InternSidebar
        organizationName={user.organization?.name ?? null}
        isAdmin={admin}
        isPress={isPress}
        unreadCount={unreadCount}
      />
      <main className="min-w-0 flex-1 bg-paper px-8 py-10 nav:px-12 nav:py-12">{children}</main>
    </div>
  );
}
