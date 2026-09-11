import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { getMyOrganizationImages, getMyMediaShares } from '@/lib/queries';
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

  // BUG-FIX: Vorher stand hier `if (!user.organization?.id) redirect('/intern')`
  // -- ein Redirect von /intern zurück auf /intern. Für jedes Konto ohne
  // zugewiesene Organisation (z. B. ein reiner Administrator-Account ohne
  // BOS-/Presse-Organisation) hat das eine sofortige Endlosschleife erzeugt
  // ("ERR_TOO_MANY_REDIRECTS" im Browser). Admin-Rechte und
  // Organisationszugehörigkeit sind zwei unabhängige Dinge -- ein Admin
  // ohne Organisation ist ein gültiger, normaler Zustand, kein Fehlerfall,
  // der einen Redirect verdient.
  //
  // Statt zu redirecten: eigener, einfacher Hinweis für genau diesen Fall.
  // Admin-Werkzeuge bleiben über die Nav trotzdem erreichbar, weil die
  // Admin-Prüfung in app/intern/admin/page.tsx unabhängig von
  // organization?.id läuft.
  if (!user.organization?.id) {
    const admin = await isAdministrator(user.id);
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <i className="ti ti-building-off mb-3 block text-[36px] text-ink-3" aria-hidden="true" />
        <h1 className="mb-2 font-display text-[24px] font-bold">Keine Organisation zugeordnet</h1>
        <p className="mb-6 text-[13.5px] leading-[1.6] text-ink-2">
          Dieses Konto ist aktuell keiner Organisation zugeordnet, daher gibt
          es hier kein Medien-Dashboard zu zeigen.
          {admin && ' Als Administrator kannst du trotzdem die Verwaltungswerkzeuge nutzen.'}
        </p>
        {admin && (
          <Link
            href="/intern/admin"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            <i className="ti ti-shield text-[15px]" aria-hidden="true" />
            Zur Administration
          </Link>
        )}
      </div>
    );
  }

  // getMyFoldersWithPostIds ist hier entfallen: Die Funktion lieferte pro
  // Ordner die Liste zugeordneter Beitrags-IDs aus der Zwischentabelle
  // folders_posts -- also die Beitrag-zu-Ordner-Zuordnung, die es seit der
  // Umstellung nicht mehr gibt. Ordner ordnen ausschließlich
  // Bibliotheksbilder über media_library.folder. Damit ist auch die
  // Abfrage überflüssig und spart bei jedem Aufruf dieses Dashboards
  // einen Directus-Roundtrip.
  const [posts, mediaShares] = await Promise.all([
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
  ]);

  // Count total number of pictures (images) instead of posts
  const totalPictureCount = posts.reduce((sum, post) => {
    const imageCount = Array.isArray(post.images) ? post.images.length : 0;
    return sum + imageCount;
  }, 0);

  const publicCount = posts.filter((p) => p.is_public).length;
  const privateCount = posts.length - publicCount;
  const activeShareCount = mediaShares.filter((s) => s.active).length;

  const mediaSharesForPicker = mediaShares.map((s) => ({ id: s.id, name: s.name }));

  const tiles = [
    { label: 'Uploads gesamt', value: totalPictureCount },
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
        <MediaLibraryView posts={posts} mediaShares={mediaSharesForPicker} />
      </div>
    </div>
  );
}
