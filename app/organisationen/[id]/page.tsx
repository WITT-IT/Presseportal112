import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import GalleryCard from '@/components/GalleryCard';
import DarkMasthead from '@/components/DarkMasthead';
import OrgProfileEditor from '@/components/OrgProfileEditor';
import { directusAssetUrl } from '@/lib/directus';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import {
  getGewerke,
  getOrganizationById,
  getPublicImagesByOrganization,
} from '@/lib/queries';
import { GEWERK_COLORS, primaryImage } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrganizationById(id);
  if (!org) return {};
  return {
    title: org.name,
    description:
      org.description || `Freigegebene Einsatzfotos von ${org.name} auf Presseportal112.`,
  };
}

export default async function OrganizationProfilePage({ params }: Props) {
  const { id } = await params;
  const org = await getOrganizationById(id);
  if (!org) notFound();

  // Eingeloggt und genau diese eigene Organisation? Dann darf bearbeitet
  // werden -- serverseitig geprüft, nicht nur versteckt im Frontend
  // (die Schreibzugriffe selbst prüfen das in der Route zusätzlich nochmal).
  let canEdit = false;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (raw) {
      const session = JSON.parse(raw) as { accessToken: string };
      const user = await getCurrentUser(session.accessToken);
      canEdit = user?.organization?.id === id;
    }
  } catch {
    // Keine gültige Sitzung -- ganz normal als Besucher weiterlaufen.
  }

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

  // Eigenes Titelbild hat Vorrang -- ohne eins fällt's automatisch auf das
  // erste freigegebene Foto zurück, wie bisher.
  const backdropImage =
    org.banner_image ||
    images.map((p) => primaryImage(p)).find((img) => img?.file_public_preview)
      ?.file_public_preview;

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

            <OrgProfileEditor
              org={{
                id: org.id,
                name: org.name,
                gewerk: org.gewerk,
                description: org.description ?? null,
                website: org.website ?? null,
                social_links: org.social_links ?? null,
                show_website: org.show_website ?? true,
                show_social_links: org.show_social_links ?? true,
                logo: org.logo ?? null,
              }}
              gewerkName={gewerk?.name ?? org.gewerk}
              gewerkColor={gewerk?.color ?? GEWERK_COLORS[org.gewerk] ?? '#E8A93D'}
              canEdit={canEdit}
            />
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
