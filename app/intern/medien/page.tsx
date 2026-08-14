import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getFolderContents, getMyOrganizationImages, getMyMediaShares } from '@/lib/queries';
import { getOrgStorageInfo } from '@/lib/orgStorage';
import Breadcrumbs from '@/components/Breadcrumbs';
import MediaBrowser from '@/components/MediaBrowser';
import StorageUsageBar from '@/components/StorageUsageBar';

export const dynamic = 'force-dynamic';

export default async function MedienPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;

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

  const [contents, calendarPosts, mediaShares, storage] = await Promise.all([
    getFolderContents(session.accessToken, user.organization.id, folder ?? null),
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
    getOrgStorageInfo(session.accessToken, user.organization.id),
  ]);

  const breadcrumbItems = [
    { label: 'Übersicht', href: '/intern' },
    { label: 'Medien', href: contents.breadcrumb.length ? '/intern/medien' : undefined },
    ...contents.breadcrumb.map((b, i) => ({
      label: b.name,
      href: i === contents.breadcrumb.length - 1 ? undefined : `/intern/medien?folder=${b.id}`,
    })),
  ];

  const folderCount = contents.subfolders.length;
  const itemCount = contents.items.length;

  return (
    <div className="-mx-6 -mt-6 nav:-mx-10">
      {/* Hero-Header im Bildarchiv-Stil: heller Verlauf, Glas-Kacheln für
          die Kennzahlen -- übernimmt bewusst dieselbe Sprache wie
          app/bildarchiv/page.tsx, nur mit Ordner/Bilder statt
          Einsätze/Stockfotos als Kennzahlen und Aktionen statt Suche. */}
      <section className="border-b border-line/70 bg-gradient-to-b from-white via-paper to-paper px-6 pb-8 pt-6 nav:px-10 nav:pt-8">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
              Medienbibliothek
            </span>
            <h1 className="mt-4 font-display text-[clamp(28px,4vw,42px)] leading-[0.95] text-ink">
              {contents.folder?.name ?? 'Alle Medien'}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-card">
              <div className="text-xs uppercase tracking-[0.14em] text-ink-3">Ordner</div>
              <div className="mt-1 font-mono text-xl font-semibold text-ink">{folderCount}</div>
            </div>
            <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-card">
              <div className="text-xs uppercase tracking-[0.14em] text-ink-3">Bilder hier</div>
              <div className="mt-1 font-mono text-xl font-semibold text-ink">{itemCount}</div>
            </div>
          </div>
        </div>

        {/* Speicherverbrauch -- eigene volle Zeile statt einer dritten
            Kennzahlen-Kachel, weil der Balken mehr Breite braucht als eine
            reine Zahl. Zeigt organisationsweiten Gesamtverbrauch (nicht nur
            den aktuellen Ordner), deshalb bewusst als Fußzeile der ganzen
            Hero-Sektion statt neben "Bilder hier". */}
        <div className="mt-5 max-w-md rounded-2xl bg-white/90 px-4 py-3 shadow-card">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-3">
            Speicherplatz (gesamte Organisation)
          </div>
          <StorageUsageBar usedBytes={storage.usedBytes} limitBytes={storage.limitBytes} />
        </div>
      </section>

      <div className="px-6 pt-6 nav:px-10">
        <MediaBrowser
          currentFolderId={folder ?? null}
          parentFolderId={contents.folder?.parent_folder ?? null}
          subfolders={contents.subfolders}
          items={contents.items}
          calendarPosts={calendarPosts}
          mediaShares={mediaShares.map((s) => ({ id: s.id, name: s.name }))}
          storageStatus={{ usedBytes: storage.usedBytes, limitBytes: storage.limitBytes }}
        />
      </div>
    </div>
  );
}
