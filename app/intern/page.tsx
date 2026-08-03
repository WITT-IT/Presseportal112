import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import { getMyOrganizationImages, getMyFolders, getMyMediaShares } from '@/lib/queries';
import { primaryImage } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

function StatTile({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-ink-3">
        <i className={`ti ${icon} text-[16px]`} aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em]">{label}</span>
      </div>
      <div className="font-display text-[26px] font-bold text-ink">{value}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-[10px] border border-line bg-white p-4 transition-colors hover:border-line-strong"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-[10px] border border-line bg-white p-4">{content}</div>;
}

export default async function OverviewPage() {
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

  const organizationId = user.organization?.id ?? null;
  const isPress = user.organization?.organization_type === 'press';

  if (!organizationId) {
    return (
      <div>
        <h1 className="mb-2 font-display text-[28px] font-bold">
          Willkommen, {user.first_name || user.email}
        </h1>
        <div className="mt-6 rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
          Deinem Konto ist noch keine Organisation zugeordnet — bitte an die
          Redaktion wenden.
        </div>
      </div>
    );
  }

  // Presse-Konten bekommen eine eigene, schlanke Übersicht -- die
  // BOS-Kennzahlen (Beiträge, Entwürfe, Freigaben verwalten) betreffen
  // sie nicht, sie erhalten Freigaben, statt sie zu erstellen.
  if (isPress) {
    const unreadCount = await getUnreadConversationCount(organizationId);
    return (
      <div>
        <div className="mb-8">
          <h1 className="mb-1 font-display text-[28px] font-bold">
            Willkommen, {user.first_name || user.email}
          </h1>
          <p className="text-[13.5px] text-ink-2">{user.organization?.name}</p>
        </div>

        {unreadCount > 0 && (
          <Link
            href="/intern/nachrichten"
            className="mb-8 flex items-center justify-between gap-3 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-[13px] font-semibold text-signal-deep transition-colors hover:border-signal"
          >
            <span className="flex items-center gap-2">
              <i className="ti ti-message-circle text-[16px]" aria-hidden="true" />
              {unreadCount === 1
                ? '1 neue Unterhaltung wartet auf dich'
                : `${unreadCount} neue Unterhaltungen warten auf dich`}
            </span>
            <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
          </Link>
        )}

        <div className="grid grid-cols-1 gap-4 nav:grid-cols-2">
          <Link
            href="/intern/nachrichten"
            className="rounded-[10px] border border-line bg-white p-6 transition-colors hover:border-line-strong"
          >
            <i className="ti ti-message-circle mb-3 block text-[24px] text-ink-2" aria-hidden="true" />
            <h2 className="mb-1 font-display text-[16px] font-bold">Nachrichten</h2>
            <p className="text-[12.5px] text-ink-2">
              Direkt mit Organisationen austauschen und Anfragen stellen.
            </p>
          </Link>
          <Link
            href="/intern/favoriten"
            className="rounded-[10px] border border-line bg-white p-6 transition-colors hover:border-line-strong"
          >
            <i className="ti ti-star mb-3 block text-[24px] text-ink-2" aria-hidden="true" />
            <h2 className="mb-1 font-display text-[16px] font-bold">Favoriten</h2>
            <p className="text-[12.5px] text-ink-2">
              Gesammelte Fotos aus dem Bildarchiv, gebündelt zum Download.
            </p>
          </Link>
        </div>
      </div>
    );
  }

  const [posts, folders, mediaShares, unreadCount] = await Promise.all([
    getMyOrganizationImages(session.accessToken, organizationId),
    getMyFolders(session.accessToken, organizationId),
    getMyMediaShares(session.accessToken, organizationId),
    getUnreadConversationCount(organizationId),
  ]);

  const publishedCount = posts.filter((p) => p.is_public).length;
  const draftCount = posts.length - publishedCount;
  const activeShareCount = mediaShares.filter(
    (s) => s.active && new Date(s.expiresAt).getTime() > Date.now()
  ).length;
  const recentPosts = [...posts]
    .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
    .slice(0, 8);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-[28px] font-bold">
            Willkommen, {user.first_name || user.email}
          </h1>
          <p className="text-[13.5px] text-ink-2">{user.organization?.name}</p>
        </div>
        <Link
          href="/intern/upload"
          className="flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-black"
        >
          <i className="ti ti-plus text-[15px]" aria-hidden="true" />
          Neuen Beitrag hochladen
        </Link>
      </div>

      {unreadCount > 0 && (
        <Link
          href="/intern/nachrichten"
          className="mb-8 flex items-center justify-between gap-3 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-[13px] font-semibold text-signal-deep transition-colors hover:border-signal"
        >
          <span className="flex items-center gap-2">
            <i className="ti ti-message-circle text-[16px]" aria-hidden="true" />
            {unreadCount === 1
              ? '1 neue Unterhaltung wartet auf dich'
              : `${unreadCount} neue Unterhaltungen warten auf dich`}
          </span>
          <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
        </Link>
      )}

      <div className="mb-10 grid grid-cols-2 gap-3 nav:grid-cols-4">
        <StatTile icon="ti-photo" label="Beiträge gesamt" value={posts.length} />
        <StatTile
          icon="ti-eye"
          label="Öffentlich"
          value={publishedCount}
          href="/intern/medien?status=public"
        />
        <StatTile
          icon="ti-file-pencil"
          label="Entwürfe"
          value={draftCount}
          href="/intern/medien?status=draft"
        />
        <StatTile
          icon="ti-share"
          label="Aktive Freigaben"
          value={activeShareCount}
          href="/intern/freigaben"
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
          Zuletzt hochgeladen
        </h2>
        <Link
          href="/intern/medien"
          className="flex items-center gap-1 text-[12.5px] font-semibold text-signal-deep"
        >
          Alle Medien
          <i className="ti ti-arrow-right text-[14px]" aria-hidden="true" />
        </Link>
      </div>

      {recentPosts.length === 0 ? (
        <p className="text-[13px] text-ink-2">
          Noch keine Beiträge hochgeladen — „Neuen Beitrag hochladen" oben legt direkt los.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
          {recentPosts.map((post) => {
            const hero = primaryImage(post);
            return (
              <Link
                key={post.id}
                href={`/intern/bearbeiten/${post.id}`}
                className="overflow-hidden rounded-[10px] border border-line bg-white transition-colors hover:border-line-strong"
              >
                <div className="relative h-[110px] bg-panel">
                  {hero?.file_public_preview && (
                    <Image
                      src={directusAssetUrl(hero.file_public_preview, 'width=300&quality=70')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${
                      post.is_public ? 'bg-ink text-white' : 'bg-white text-ink-2'
                    }`}
                  >
                    {post.is_public ? 'Öffentlich' : 'Entwurf'}
                  </span>
                </div>
                <div className="p-2.5">
                  <span className="truncate text-[12px] font-medium">
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
