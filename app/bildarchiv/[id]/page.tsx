import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { directusAssetUrl } from '@/lib/directus';
import { getPublicImageById } from '@/lib/queries';
import { GEWERK_COLORS } from '@/lib/types';
import ArticleCartToggle from '@/components/ArticleCartToggle';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const image = await getPublicImageById(id);
  if (!image) return {};

  const org = typeof image.organization === 'object' ? image.organization : null;
  const title = image.title || `Einsatzfoto ${image.alarm_code ?? ''}`.trim();
  const description = org?.name
    ? `Freigegebenes Einsatzfoto von ${org.name}${image.location ? ` — ${image.location}` : ''}.`
    : 'Freigegebenes Einsatzfoto von Presseportal112.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image.file_public_preview
        ? [directusAssetUrl(image.file_public_preview, 'width=1200&quality=80')]
        : undefined,
    },
  };
}

export default async function ImageArticlePage({ params }: Props) {
  const { id } = await params;
  const image = await getPublicImageById(id);
  if (!image) notFound();

  const org = typeof image.organization === 'object' ? image.organization : null;
  const gewerkId = org?.gewerk ?? 'feuerwehr';
  const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;

  const dateLabel = new Date(image.event_date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <article className="px-8 py-12">
      <div className="mx-auto max-w-[760px]">
        <Link
          href="/bildarchiv"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zum Bildarchiv
        </Link>

        <div
          className="mb-4 flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.04em]"
          style={{ color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-[1.5px]"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {image.alarm_code ?? 'Pressefoto'} &middot; {dateLabel}
        </div>

        <h1 className="mb-4 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em] nav:text-[42px]">
          {image.title || `Einsatz ${org?.name ?? ''}`}
        </h1>

        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {org?.name && <span>{org.name}</span>}
          {image.location && <span>&middot; {image.location}</span>}
        </div>

        {image.file_public_preview && (
          <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[10px] border border-line bg-panel">
            <Image
              src={directusAssetUrl(image.file_public_preview, 'width=1400&quality=85')}
              alt={image.title ?? 'Einsatzfoto'}
              fill
              className="object-cover"
              sizes="(min-width: 901px) 760px, 100vw"
              priority
            />
          </div>
        )}

        <div className="mb-10 flex flex-wrap items-center gap-4">
          {image.file_download && (
            <a
              href={directusAssetUrl(image.file_download)}
              download
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-signal-deep hover:text-signal"
            >
              <i className="ti ti-download text-[14px]" aria-hidden="true" />
              Originalgröße herunterladen (für Presseverwendung)
            </a>
          )}
          <ArticleCartToggle imageId={image.id} />
        </div>

        {image.article_body && (
          <div
            className="prose-article mb-10 text-[15.5px] text-ink"
            // Inhalt wurde serverseitig beim Hochladen bereits auf eine
            // kleine, sichere Tag-Liste beschränkt (siehe upload/route.ts).
            dangerouslySetInnerHTML={{ __html: image.article_body }}
          />
        )}

        {image.tags && image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line pt-6">
            {image.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-[4px] bg-panel px-2.5 py-1 text-[11px] text-ink-2"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
