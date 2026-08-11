import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import {
  getMyOrganizationImages,
  getMyFoldersWithPostIds,
  getMyMediaShares,
} from '@/lib/queries';
import MediaLibraryView from '@/components/MediaLibraryView';

export const dynamic = 'force-dynamic';

export default async function InternPage() {
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
  if (user.organization.organization_type === 'press') redirect('/intern');

  const [posts, foldersWithPostIds, mediaShares] = await Promise.all([
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyFoldersWithPostIds(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
  ]);

  const publicCount = posts.filter((p) => p.is_public).length;
  const privateCount = posts.length - publicCount;
  const activeShareCount = mediaShares.filter((s) => s.active).length;

  const mediaSharesForPicker = mediaShares.map((s) => ({ id: s.id, name: s.name }));

  const tiles = [
    { label: 'Uploads gesamt', value: posts.length },
    { label: 'Öffentlich', value: publicCount },
    { label: 'Privat', value: privateCount },
    { label: 'Aktive Freigaben', value: activeShareCount },
  ];

  const firstName = user.first_name || '';

  return (
    <div className="-mx-6 -mt-10 nav:-mx-10 nav:-mt-12">
      {/* Hero-Header im Bildarchiv-Stil: Eyebrow, große Headline, vier
          Kennzahlen-Kacheln rechts statt der schlichten 4er-Grid-Reihe. */}
      <section className="border-b border-line/70 px-6 pb-8 pt-6 nav:px-10 nav:pt-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
              Übersicht
            </span>
            <h1 className="mt-4 font-display text-[clamp(28px,4vw,42px)] leading-[0.95] text-ink">
              Willkommen{firstName ? `, ${firstName}` : ''}.
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px] sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/90 px-4 py-3 shadow-card">
                <div className="text-xs uppercase tracking-[0.14em] text-ink-3">{tile.label}</div>
                <div className="mt-1 font-mono text-xl font-semibold text-ink">
                  {tile.value.toLocaleString('de-DE')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-6 pt-6 nav:px-10">
        <MediaLibraryView posts={posts} folders={foldersWithPostIds} mediaShares={mediaSharesForPicker} />
      </div>
    </div>
  );
}
