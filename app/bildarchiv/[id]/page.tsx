import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { directusAssetUrl } from '@/lib/directus';
import { getPublicImageById, getPublicImagesByOrganization } from '@/lib/queries';
import { GEWERK_COLORS, normalizeTags, primaryImage, type Post } from '@/lib/types';
import { toJsonLd } from '@/lib/structuredData';
import { SESSION_COOKIE } from '@/lib/auth';
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
  const title = post.title || (post.alarm_code ? `Einsatz ${post.alarm_code}` : 'Stockfoto');
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

  const org = typeof post.organization === 'object' ? post.organization : null;
  const gewerkId = org?.gewerk ?? 'feuerwehr';
  const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
  const images = post.images ?? [];
  const hero = primaryImage(post);
  const isStock = post.post_type === 'stockfoto';

  const dateLabel = post.event_date
    ? new Date(post.event_date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

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
  const headline = post.title || (post.alarm_code ? `Einsatz ${post.alarm_code}` : 'Stockfoto');
  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    headline,
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
    <article className="min-h-screen bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(newsArticleJsonLd) }} />

      <section className="border-b border-line/70 bg-gradient-to-b from-white via-paper to-paper">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/bildarchiv" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition hover:text-ink">
            <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
            Zurück zur Übersicht
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} aria-hidden="true" />
            {post.alarm_code ?? (isStock ? 'Stockfoto' : 'Pressefoto')}
            {dateLabel && <span>· {dateLabel}</span>}
            {images.length > 1 && <span>· {images.length} Fotos</span>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_360px] lg:items-end">
            <div>
              <h1 className="max-w-4xl font-display text-[clamp(30px,5vw,54px)] leading-[0.96] tracking-[-0.01em] text-ink">
                {post.title || (post.alarm_code ? `Einsatz ${post.alarm_code}` : 'Stockfoto')}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                {org?.name && (
                  <Link href={`/organisationen/${org.id}`} className="font-medium text-ink transition hover:text-signal-deep">
                    {org.name}
                  </Link>
                )}
                {post.location && <span>· {post.location}</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              {hero?.file_download && (
                <a href={`/api/download?id=${post.id}`} className="inline-flex items-center justify-center rounded-full bg-signal px-5 py-3 text-sm font-medium text-white transition hover:bg-signal-deep">
                  {images.length > 1 ? `Alle ${images.length} Fotos herunterladen (ZIP)` : 'Originalgröße herunterladen (für Presseverwendung)'}
                </a>
              )}
              <ArticleCartToggle imageId={post.id} />
              {org?.id && (
                <Link href={`/kontakt?org=${org.id}`} className="inline-flex items-center justify-center rounded-full border border-line-strong px-5 py-3 text-sm font-medium text-ink transition hover:border-ink hover:bg-white">
                  Kontakt zu {org.name} aufnehmen
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:px-8 lg:py-10">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] bg-void shadow-raised">
            <PostGallery images={images} />
          </div>

          {post.article_body && (
            <div className="rounded-[24px] bg-white p-6 shadow-card">
              <div className="prose-article text-[15.5px] text-ink" dangerouslySetInnerHTML={{ __html: post.article_body }} />
            </div>
          )}

          {normalizeTags(post.tags).length > 0 && (
            <div className="rounded-[24px] bg-white p-5 shadow-card">
              <div className="flex flex-wrap gap-2">
                {normalizeTags(post.tags).map((tag) => (
                  <span key={tag} className="rounded-full bg-panel px-3 py-1 text-sm text-ink-2">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[24px] bg-white p-5 shadow-card">
            <div className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
              Details
            </div>
            <div className="space-y-4 text-sm text-ink-2">
              <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                <span className="text-ink-3">Typ</span>
                <span className="text-right text-ink">{post.alarm_code ?? (isStock ? 'Stockfoto' : 'Pressefoto')}</span>
              </div>
              {dateLabel && (
                <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                  <span className="text-ink-3">Datum</span>
                  <span className="text-right text-ink">{dateLabel}</span>
                </div>
              )}
              {post.location && (
                <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                  <span className="text-ink-3">Ort</span>
                  <span className="text-right text-ink">{post.location}</span>
                </div>
              )}
              {org?.name && (
                <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
                  <span className="text-ink-3">Organisation</span>
                  <span className="text-right text-ink">{org.name}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <span className="text-ink-3">Fotos</span>
                <span className="text-right text-ink">{images.length}</span>
              </div>
            </div>
          </div>

          {relatedPosts.length > 0 && (
            <div className="rounded-[24px] bg-white p-5 shadow-card">
              <div className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
                Weitere Meldungen von {org?.name}
              </div>
              <div className="grid grid-cols-2 gap-4 nav:grid-cols-1">
                {relatedPosts.map((p) => (
                  <GalleryCard key={p.id} post={p} loggedIn={loggedIn} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </article>
  );
}
