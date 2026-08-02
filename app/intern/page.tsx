import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UploadForm from '@/components/UploadForm';
import MyImagesList from '@/components/MyImagesList';
import PostCalendar from '@/components/PostCalendar';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import {
  getMyOrganizationImages,
  getAllUsedTags,
  getAlarmcodes,
  getMyFolders,
  getMyMediaShares,
} from '@/lib/queries';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function InternDashboard() {
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

  // Ohne eigene Organisation gibt's nichts eigenes zu laden -- explizit
  // leere Listen statt die Funktionen mit einer leeren/undefinierten ID
  // aufzurufen.
  const [posts, existingTags, alarmcodes, folders, mediaShares, admin] = await Promise.all([
    organizationId
      ? getMyOrganizationImages(session.accessToken, organizationId)
      : Promise.resolve([] as Post[]),
    getAllUsedTags(),
    getAlarmcodes(),
    organizationId ? getMyFolders(session.accessToken, organizationId) : Promise.resolve([]),
    organizationId ? getMyMediaShares(session.accessToken, organizationId) : Promise.resolve([]),
    isAdministrator(user.id),
  ]);

  const watermarkText =
    user.organization?.branding_label || `Foto: ${user.organization?.name ?? ''}`;

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 font-display text-[32px] font-bold">
              Willkommen, {user.first_name || user.email}
            </h1>
            <p className="text-[14px] text-ink-2">
              {user.organization?.name
                ? `Angemeldet für ${user.organization.name}`
                : 'Deinem Konto ist noch keine Organisation zugeordnet -- bitte an die Redaktion wenden.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin && (
              <Link
                href="/intern/admin"
                className="flex items-center gap-1.5 rounded-md border border-signal/50 px-3 py-2 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal"
              >
                <i className="ti ti-shield text-[14px]" aria-hidden="true" />
                Administration
              </Link>
            )}
            <Link
              href="/intern/konto"
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
            >
              <i className="ti ti-user text-[14px]" aria-hidden="true" />
              Konto &amp; Datenschutz
            </Link>
          </div>
        </div>

        {organizationId ? (
          <>
            <div className="mb-10">
              <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Neues Foto hochladen
              </h2>
              <UploadForm
                watermarkText={watermarkText}
                existingTags={existingTags}
                alarmcodes={alarmcodes}
              />
            </div>

            <div className="mb-10 flex flex-wrap items-end gap-6">
              <div className="min-w-0 flex-1">
                <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                  Kalender
                </h2>
                <PostCalendar posts={posts} />
              </div>
              <div className="flex flex-none flex-wrap gap-2">
                <Link
                  href="/intern/ordner"
                  className="flex items-center gap-1.5 rounded-md border border-signal/40 px-4 py-2.5 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal hover:bg-signal/5"
                >
                  <i className="ti ti-folder text-[14px]" aria-hidden="true" />
                  Eigene Ordner
                </Link>
                <Link
                  href="/intern/freigaben"
                  className="flex items-center gap-1.5 rounded-md border border-signal/40 px-4 py-2.5 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal hover:bg-signal/5"
                >
                  <i className="ti ti-share text-[14px]" aria-hidden="true" />
                  Medienfreigaben
                </Link>
              </div>
            </div>

            <div className="mb-4">
              <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Meine Bilder
              </h2>
            </div>
            <MyImagesList posts={posts} folders={folders} mediaShares={mediaShares} />
          </>
        ) : (
          <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
            Ohne zugeordnete Organisation kann noch nichts hochgeladen
            werden.
          </div>
        )}
      </div>
    </section>
  );
}
