import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import GalleryCard from '@/components/GalleryCard';
import {
  getGewerke,
  getOrganizationById,
  getPublicImagesByOrganization,
} from '@/lib/queries';
import { GEWERK_ICONS } from '@/lib/types';

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

  const [images, gewerke] = await Promise.all([
    getPublicImagesByOrganization(id),
    getGewerke(),
  ]);
  const gewerk = gewerke.find((g) => g.id === org.gewerk);

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/organisationen"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Alle Organisationen
        </Link>

        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-8">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 flex-none items-center justify-center rounded-[10px]"
              style={{ backgroundColor: `${gewerk?.color ?? '#585D64'}14` }}
            >
              <i
                className={`ti ${GEWERK_ICONS[org.gewerk] ?? 'ti-shield'} text-[26px]`}
                style={{ color: gewerk?.color }}
                aria-hidden="true"
              />
            </span>
            <div>
              <h1 className="font-display text-[32px] font-bold leading-[1.05]">
                {org.name}
              </h1>
              <p className="text-[13px] text-ink-2">{gewerk?.name ?? org.gewerk}</p>
            </div>
          </div>
          <Link
            href={`/kontakt?org=${org.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink"
          >
            <i className="ti ti-mail text-[13px]" aria-hidden="true" />
            Kontakt aufnehmen
          </Link>
        </div>

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
    </section>
  );
}
