import Link from 'next/link';
import { cookies } from 'next/headers';
import GalleryCard from '@/components/GalleryCard';
import { SESSION_COOKIE } from '@/lib/auth';
import { getGewerke, getPublicImagesPage, searchPublicImages } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bildarchiv — Presseportal112.de',
  description:
    'Alle freigegebenen Einsatzfotos, nach Gewerk filterbar und durchsuchbar.',
};

const PAGE_SIZE = 24;

type SearchParams = Promise<{ gewerk?: string; page?: string; q?: string }>;

export default async function BildarchivPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const gewerkId = params.gewerk;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || '';

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let loggedIn = false;
  if (raw) {
    try {
      const session = JSON.parse(raw);
      loggedIn = typeof session?.accessToken === 'string';
    } catch {
      loggedIn = false;
    }
  }

  let gewerke: Awaited<ReturnType<typeof getGewerke>> = [];
  let images: Awaited<ReturnType<typeof getPublicImagesPage>>['images'] = [];
  let hasNextPage = false;
  let resultCount: number | null = null;
  let error = false;

  try {
    gewerke = await getGewerke();

    if (query) {
      const result = await searchPublicImages({
        query,
        gewerkId,
        page,
        pageSize: PAGE_SIZE,
      });
      images = result.images;
      hasNextPage = result.hasNextPage;
      resultCount = result.total;
    } else {
      const result = await getPublicImagesPage({
        gewerkId,
        page,
        pageSize: PAGE_SIZE,
      });
      images = result.images;
      hasNextPage = result.hasNextPage;
    }
  } catch (e) {
    console.error('Bildarchiv: Directus nicht erreichbar', e);
    error = true;
  }

  const einsatzCount = images.filter((post: any) => post.post_type !== 'stockfoto').length;
  const stockfotoCount = images.filter((post: any) => post.post_type === 'stockfoto').length;

  const queryParts: string[] = [];
  if (gewerkId) queryParts.push(`gewerk=${encodeURIComponent(gewerkId)}`);
  if (query) queryParts.push(`q=${encodeURIComponent(query)}`);
  const baseQuery = queryParts.length ? `?${queryParts.join('&')}&` : '?';

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-line/70 bg-gradient-to-b from-white via-paper to-paper">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
                Medien & Stockfotos
              </span>

              <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[0.95] text-ink sm:text-5xl">
                Freigegebene Einsatzbilder von, Polizei, Feuerwehr, Rettungsdiensten, THW.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-ink-2 sm:text-lg">
                Alle freigegebenen Einsatzfotos an einem Ort. Nach Gewerk filterbar,
                mit Alarmcode, Ort und Stichwort durchsuchbar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
              <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-card">
                <div className="text-xs uppercase tracking-[0.14em] text-ink-3">
                  Einsätze
                </div>
                <div className="mt-1 text-xl font-semibold text-ink">
                  {einsatzCount}
                </div>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-card">
                <div className="text-xs uppercase tracking-[0.14em] text-ink-3">
                  Stockfotos
                </div>
                <div className="mt-1 text-xl font-semibold text-ink">
                  {stockfotoCount}
                </div>
              </div>
            </div>
          </div>

          <form className="rounded-[20px] border border-white/70 bg-white/85 p-3 shadow-raised backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-panel/55 px-4 py-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-ink-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>

                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Alarmcode, Ort, Organisation oder Stichwort suchen"
                  className="w-full border-0 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center">
                <select
                  name="gewerk"
                  defaultValue={gewerkId || ''}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-line-strong"
                >
                  <option value="">Alle Gewerke</option>
                  {gewerke.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-signal px-5 py-3 text-sm font-medium text-white transition hover:bg-signal-deep lg:col-span-1"
                >
                  Medien suchen
                </button>
              </div>
            </div>

            {(query || gewerkId) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line/70 pt-3">
                {query ? (
                  <span className="inline-flex items-center rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-2">
                    Suche: {query}
                  </span>
                ) : null}
                {gewerkId ? (
                  <span className="inline-flex items-center rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-2">
                    Gewerk: {gewerkId}
                  </span>
                ) : null}
                <Link
                  href="/bildarchiv"
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-signal transition hover:text-signal-deep"
                >
                  Suche zurücksetzen
                </Link>
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-line/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink-2">
            {error
              ? 'Die Bilder konnten gerade nicht geladen werden.'
              : images.length === 0
                ? query
                  ? `Keine Treffer für „${query}“.`
                  : gewerkId
                    ? 'Für dieses Gewerk sind aktuell keine freigegebenen Fotos vorhanden.'
                    : 'Sobald die erste Organisation ein Foto freigibt, erscheint es hier.'
                : query
                  ? `${resultCount ?? images.length} Treffer für „${query}“`
                  : `${images.length} Einträge auf dieser Seite`}
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-3">
            <span className="h-2 w-2 rounded-full bg-signal" />
            Kuratiert für Presse & Einsatzkommunikation
          </div>
        </div>

        {error ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Die Bilder konnten gerade nicht geladen werden. Bitte versuch es in Kürze erneut.
          </div>
        ) : images.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-line-strong bg-white/70 px-6 text-center shadow-sm">
            <div className="max-w-md">
              <h2 className="font-display text-3xl leading-none text-ink">
                Kein passender Bildsatz gefunden
              </h2>
              <p className="mt-4 text-sm leading-6 text-ink-2">
                Passe Suchbegriff oder Filter an, damit wieder freigegebene Einsatzbilder erscheinen.
              </p>
              <Link
                href="/bildarchiv"
                className="mt-6 inline-flex rounded-full bg-signal px-5 py-3 text-sm font-medium text-white transition hover:bg-signal-deep"
              >
                Archiv zurücksetzen
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[16px] nav:grid-cols-4">
              {images.map((post) => (
                <GalleryCard key={post.id} post={post} loggedIn={loggedIn} />
              ))}
            </div>

            <div className="mt-10 flex items-center justify-between">
              {page > 1 ? (
                <Link
                  href={`/bildarchiv${baseQuery}page=${page - 1}`}
                  className="rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-ink"
                >
                  ← Neuere
                </Link>
              ) : (
                <span />
              )}
              <span className="font-mono text-[11px] text-ink-3">Seite {page}</span>
              {hasNextPage ? (
                <Link
                  href={`/bildarchiv${baseQuery}page=${page + 1}`}
                  className="rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-ink"
                >
                  Ältere →
                </Link>
              ) : (
                <span />
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
