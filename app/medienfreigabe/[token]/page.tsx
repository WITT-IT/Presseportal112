import { notFound } from 'next/navigation';
import { getMediaShareByToken } from '@/lib/queries';
import type { Post, PostImage } from '@/lib/types';

export const dynamic = 'force-dynamic';

type ImageWithPost = PostImage & { post: Post };

export default async function MediaSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getMediaShareByToken(token);
  if (!share) notFound();

  const allImages: ImageWithPost[] = share.posts.flatMap((post: Post) =>
    ((post.images ?? []) as PostImage[]).map((img: PostImage) => ({ ...img, post }))
  );

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1000px]">
        <div className="mb-8 rounded-[10px] border border-line bg-panel p-6">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.09em] text-ink-2">
            Zeitlich begrenzte Medienfreigabe
          </div>
          <h1 className="mb-2 font-display text-[26px] font-bold">{share.name}</h1>
          <p className="text-[13px] text-ink-2">
            Bereitgestellt von{' '}
            <b className="text-ink">{share.organizationName ?? 'Presseportal112'}</b>
            {share.recipientName ? ` · für ${share.recipientName}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-[4px] bg-white px-2 py-1 font-mono text-ink-2">
              Gültig bis {new Date(share.expiresAt).toLocaleDateString('de-DE')}
            </span>
            <span className="rounded-[4px] bg-white px-2 py-1 font-mono text-ink-2">
              {allImages.length} {allImages.length === 1 ? 'Bild' : 'Bilder'}
            </span>
          </div>
        </div>

        {allImages.length > 1 && (
          <a
            href={`/api/medienfreigabe/${token}/download`}
            className="mb-6 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            <i className="ti ti-download text-[14px]" aria-hidden="true" />
            Alle Fotos als ZIP herunterladen
          </a>
        )}

        {allImages.length === 0 ? (
          <p className="text-[13px] text-ink-2">Diese Freigabe enthält aktuell keine Bilder.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 nav:grid-cols-3">
            {allImages.map((img: ImageWithPost) => (
              <div
                key={img.id}
                className="overflow-hidden rounded-[10px] border border-line bg-white"
              >
                <div className="relative h-[165px] bg-panel">
                  {img.file_public_preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/medienfreigabe/${token}/preview?imageId=${img.id}`}
                      alt={img.caption ?? img.post.title ?? 'Pressefoto'}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-3">
                  <div className="mb-2 font-mono text-[10px] text-ink-3">
                    {img.post.event_date
                      ? new Date(img.post.event_date).toLocaleDateString('de-DE')
                      : ''}
                    {img.post.location ? ` · ${img.post.location}` : ''}
                  </div>
                  <a
                    href={`/api/medienfreigabe/${token}/download?imageId=${img.id}`}
                    className="block w-full rounded-md bg-ink px-3 py-2 text-center text-[11px] font-semibold text-white transition-colors hover:bg-black"
                  >
                    Foto herunterladen
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-10 flex gap-5 border-t border-line pt-6 text-[11px] text-ink-3">
          <a href="/datenschutz">Datenschutzerklärung</a>
          <a href="/impressum">Impressum</a>
        </footer>
      </div>
    </section>
  );
}
