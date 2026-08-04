import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { directusAssetUrl } from '@/lib/directus';
import { getPublicImageById, getPublicImagesByOrganization } from '@/lib/queries';
import { GEWERK_COLORS, normalizeTags, primaryImage, type Post } from '@/lib/types';
import { toJsonLd } from '@/lib/structuredData';
import ArticleCartToggle from '@/components/ArticleCartToggle';
import GalleryCard from '@/components/GalleryCard';
import PostGallery from '@/components/PostGallery';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicImageById(id);
  if (!post) return {};

  const org = typeof post.organization === 'object' ? post.organization : null;
  const hero = primaryImage(post);
  const title = post.title || `Einsatzfoto ${post.alarm_code ?? ''}`.trim();
  const description = org?.name
    ? `Freigegebene Einsatzfotos von ${org.name}${post.location ? ` — ${post.location}` : ''}.`
    : 'Freigegebene Einsatzfotos von Presseportal112.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: hero?.file_public_preview
        ? [directusAssetUrl(hero.file_public_preview, 'width=1200&quality=80')]
        : undefined,
    },
  };
}

export default async function PostArticlePage({ params }: Props) {
  const { id } = await params;
  const post = await getPublicImageById(id);
  if (!post) notFound();

  const org = typeof post.organization === 'object' ? post.organization : null;
  const gewerkId = org?.gewerk ?? 'feuerwehr';
  const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
  const images = post.images ?? [];
  const hero = primaryImage(post);

  const dateLabel = new Date(post.event_date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Eine mehr anfragen als gebraucht, damit nach dem Herausfiltern des
  // aktuellen Beitrags trotzdem genug übrig bleiben. Bewusst abgesichert --
  // scheitert das, soll die Artikelseite trotzdem laden, nur eben ohne
  // "Weitere Meldungen".
  let relatedPosts: Post[] = [];
  if (org) {
    try {
      const result = await getPublicImagesByOrganization(org.id, { pageSize: 5 });
      relatedPosts = result.images.filter((p) => p.id !== post.id).slice(0, 4);
    } catch (error) {
      console.error(`Weitere Meldungen für Organisation ${org.id} fehlgeschlagen:`, error);
    }
  }

  const articleUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/bildarchiv/${post.id}`;

  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    headline: post.title || `Einsatzfoto ${post.alarm_code ?? ''}`.trim(),
    image: images
      .map((img) =>
        img.file_public_preview
          ? directusAssetUrl(img.file_public_preview, 'width=1200&quality=85')
          : null
      )
      .filter(Boolean),
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: org?.name ? { '@type': 'Organization', name: org.name } : undefined,
    publisher: { '@type': 'Organization', name: 'Presseportal112.de' },
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(newsArticleJsonLd) }}
      />

      {/* Kein DarkMasthead mehr -- nur die Textdaten, auf normalem hellem
          Untergrund wie der Rest der Seite. border-b trennt den
          Kopfbereich optisch leicht vom Inhalt darunter ab. */}
      <div className="border-b border-line px-8 py-14">
        <div className="mx-auto max-w-[760px]">
          <Link
            href="/bildarchiv"
            className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
          >
            <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
            Zurück zum Bildarchiv
          </Link>

          <div className="mb-4 flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-2">
            <span
              className="h-1.5 w-1.5 rounded-[1.5px]"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
              aria-hidden="true"
            />
            {post.alarm_code ?? 'Pressefoto'} &middot; {dateLabel}
            {images.length > 1 && (
              <span className="text-ink-3">&middot; {images.length} Fotos</span>
            )}
          </div>

          <h1 className="mb-4 font-display text-[clamp(30px,5vw,48px)] font-bold leading-[1.02] tracking-[-0.01em] text-ink">
            {post.title || `Einsatz ${org?.name ?? ''}`}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
            {org?.name && (
              <Link
                href={`/organisationen/${org.id}`}
                className="font-medium text-ink hover:text-signal-deep"
              >
                {org.name}
              </Link>
            )}
            {post.location && <span>&middot; {post.location}</span>}
          </div>
        </div>
      </div>

      <div className="px-8 py-12">
        <div className="mx-auto max-w-[760px]">
          <div className="mt-2">
            <PostGallery images={images} />
          </div>

          <div className="mb-10 flex flex-wrap items-center gap-4">
            {hero?.file_download && (
              <a
                href={`/api/download?id=${post.id}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-signal-deep hover:text-signal"
              >
                <i className="ti ti-download text-[14px]" aria-hidden="true" />
                {images.length > 1
                  ? `Alle ${images.length} Fotos herunterladen (ZIP)`
                  : 'Originalgröße herunterladen (für Presseverwendung)'}
              </a>
            )}
            <ArticleCartToggle imageId={post.id} />
            {org?.id && (
              <Link
                href={`/kontakt?org=${org.id}`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink"
              >
                <i className="ti ti-mail text-[13px]" aria-hidden="true" />
                Kontakt zu {org.name} aufnehmen
              </Link>
            )}
          </div>

          {post.article_body && (
            <div
              className="prose-article mb-10 text-[15.5px] text-ink"
              // Inhalt wurde serverseitig beim Hochladen bereits auf eine
              // kleine, sichere Tag-Liste beschränkt (siehe upload/route.ts).
              dangerouslySetInnerHTML={{ __html: post.article_body }}
            />
          )}

          {normalizeTags(post.tags).length > 0 && (
            <div className="mb-10 flex flex-wrap gap-1.5 border-t border-line pt-6">
              {normalizeTags(post.tags).map((tag) => (
                <span
                  key={tag}
                  className="rounded-[4px] bg-panel px-2.5 py-1 text-[11px] text-ink-2"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {relatedPosts.length > 0 && (
            <div className="border-t border-line pt-8">
              <h2 className="mb-5 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Weitere Meldungen von {org?.name}
              </h2>
              <div className="grid grid-cols-2 gap-[16px] nav:grid-cols-4">
                {relatedPosts.map((p) => (
                  <GalleryCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
