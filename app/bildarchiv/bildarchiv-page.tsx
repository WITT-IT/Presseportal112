import Link from 'next/link';
import GewerkFilterTabs from '@/components/GewerkFilterTabs';
import GalleryCard from '@/components/GalleryCard';
import { getGewerke, getPublicImagesPage } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bildarchiv — Presseportal112.de',
  description:
    'Alle freigegebenen Einsatzfotos von Feuerwehr, DRK, Polizei und THW — nach Gewerk filterbar.',
};

const PAGE_SIZE = 24;

// Next.js 15: searchParams ist ein Promise und muss erst aufgelöst werden.
export default async function BildarchivPage({
  searchParams,
}: {
  searchParams: Promise<{ gewerk?: string; page?: string }>;
}) {
  const params = await searchParams;
  const gewerkId = params.gewerk;
  const page = Math.max(1, Number(params.page) || 1);

  let gewerke: Awaited<ReturnType<typeof getGewerke>> = [];
  let images: Awaited<ReturnType<typeof getPublicImagesPage>>['images'] = [];
  let hasNextPage = false;
  let error = false;

  try {
    [gewerke, { images, hasNextPage }] = await Promise.all([
      getGewerke(),
      getPublicImagesPage({ gewerkId, page, pageSize: PAGE_SIZE }),
    ]);
  } catch (e) {
    console.error('Bildarchiv: Directus nicht erreichbar', e);
    error = true;
  }

  const baseQuery = gewerkId ? `?gewerk=${gewerkId}&` : '?';

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <h1 className="mb-2 font-display text-[38px] font-bold leading-[1.02] tracking-[-0.01em]">
          Bildarchiv
        </h1>
        <p className="mb-8 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
          Alle freigegebenen Einsatzfotos an einem Ort — nach Gewerk
          filterbar, mit Alarmcode und Organisation.
        </p>

        <div className="mb-8">
          <GewerkFilterTabs gewerke={gewerke} active={gewerkId} />
        </div>

        {error && (
          <div className="rounded-[10px] border border-line bg-panel p-6 text-[13px] text-ink-2">
            Die Bilder konnten gerade nicht geladen werden. Bitte versuch es
            in Kürze erneut.
          </div>
        )}

        {!error && images.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
            {gewerkId
              ? 'Für dieses Gewerk sind aktuell keine freigegebenen Fotos vorhanden.'
              : 'Sobald die erste Organisation ein Foto freigibt, erscheint es hier.'}
          </div>
        )}

        {images.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-[16px] nav:grid-cols-4">
              {images.map((img) => (
                <GalleryCard key={img.id} img={img} />
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
              <span className="font-mono text-[11px] text-ink-3">
                Seite {page}
              </span>
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
      </div>
    </section>
  );
}
