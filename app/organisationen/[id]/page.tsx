import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import GalleryCard from '@/components/GalleryCard';
import DarkMasthead from '@/components/DarkMasthead';
import { directusAssetUrl } from '@/lib/directus';
import {
  getGewerke,
  getOrganizationById,
  getPublicImagesByOrganization,
} from '@/lib/queries';
import { GEWERK_ICONS, primaryImage } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrganizationById(id);
  if (!org) return {};
  return {
    title: org.name,
    description: `Freigegebene Einsatzfotos von ${org.name} auf Presseportal112.`,
  };
}

export default async function OrganizationProfilePage({ params }: Props) {
  const { id } = await params;
  const org = await getOrganizationById(id);
  if (!org) notFound();

  let images: Awaited<ReturnType<typeof getPublicImagesByOrganization>> = [];
  let gewerke: Awaited<ReturnType<typeof getGewerke>> = [];
  try {
    [images, gewerke] = await Promise.all([
      getPublicImagesByOrganization(id),
      getGewerke(),
    ]);
  } catch (error) {
    console.error(`Organisationsseite ${id}: Fotos konnten nicht geladen werden:`, error);
  }
  const gewerk = gewerke.find((g) => g.id === org.gewerk);

  const backdropImage = images
    .map((p) => primaryImage(p))
    .find((img) => img?.file_public_preview)?.file_public_preview;

  return (
    <section>
      <DarkMasthead
        backgroundImageUrl={
          backdropImage ? directusAssetUrl(backdropImage, 'width=2000&quality=65') : null
        }
      >
        <div className="px-8 py-14">
          <div className="mx-auto max-w-[1180px]">
            <Link
              href="/organisationen"
              className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white"
            >
              <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
              Alle Organisationen
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className="flex h-14 w-14 flex-none items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06]"
                >
                  <i
                    className={`ti ${GEWERK_ICONS[org.gewerk] ?? 'ti-shield'} text-[26px]`}
                    style={{ color: gewerk?.color ?? '#E8A93D' }}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-amber">
                    {gewerk?.name ?? org.gewerk}
                  </div>
                  <h1 className="font-display text-[clamp(28px,4vw,42px)] font-bold leading-[1.02] text-white">
                    {org.name}
                  </h1>
                </div>
              </div>
              <Link
                href={`/kontakt?org=${org.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40"
              >
                <i className="ti ti-mail text-[13px]" aria-hidden="true" />
                Kontakt aufnehmen
              </Link>
            </div>
          </div>
        </div>
      </DarkMasthead>

      <div className="px-8 py-12">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="mb-5 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
            Freigegebene Fotos ({images.length})
          </h2>

          {images.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
              Diese Organisation hat noch keine Fotos freigegeben.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-[16px] nav:grid-cols-4">
              {images.map((post) => (
                <GalleryCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
