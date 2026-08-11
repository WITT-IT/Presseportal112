import { notFound } from 'next/navigation';
import { getMediaShareByToken } from '@/lib/queries';
import { getMediaShareStatus } from '@/lib/mediaShareStatus';
import type { Post, PostImage } from '@/lib/types';
import ExpiredMediaShareNotice from '@/components/ExpiredMediaShareNotice';

export const dynamic = 'force-dynamic';

type ImageWithPost = PostImage & { post: Post };

export default async function MediaSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Vorab klären, WARUM ein Token nicht (mehr) funktioniert -- statt direkt
  // in die generische 404 zu laufen. "not_found" (Token hat nie existiert)
  // bleibt ein echtes 404; "expired"/"deactivated" bekommen die freundliche
  // Erklärseite.
  const status = await getMediaShareStatus(token);
  if (status.state === 'not_found') notFound();
  if (status.state === 'expired' || status.state === 'deactivated') {
    return (
      <ExpiredMediaShareNotice
        state={status.state}
        name={status.name}
        organizationName={status.organizationName}
        expiresAt={status.expiresAt}
      />
    );
  }

  const share = await getMediaShareByToken(token);
  if (!share) notFound();

  const allImages: ImageWithPost[] = share.posts.flatMap((post: Post) =>
    ((post.images ?? []) as PostImage[]).map((img: PostImage) => ({ ...img, post }))
  );
  const libraryImages = share.libraryImages;
  const totalCount = allImages.length + libraryImages.length;

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
              {totalCount} {totalCount === 1 ? 'Bild' : 'Bilder'}
            </span>
          </div>
        </div>

        {totalCount > 1 && (
          <a
            href={`/api/medienfreigabe/${token}/download`}
            className="mb-6 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            <i className="ti ti-download text-[14px]" aria-hidden="true" />
            Alle Fotos als ZIP herunterladen
          </a>
        )}

        {totalCount === 0 ? (
          <p className="text-[13px] text-ink-2">Diese Freigabe enthält aktuell keine Bilder.</p>
        ) : (
          <>
            {allImages.length > 0 && (
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
                          alt={img.caption ?? img.post.title ?? ''}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="mb-2">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {img.post.title || img.post.alarm_code || 'Ohne Titel'}
                        </p>
                        {img.caption && (
                          <p className="mt-0.5 truncate text-[11.5px] text-ink-2">{img.caption}</p>
                        )}
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

            {/* Bibliotheksbilder: eigene Sektion, weil es Originale ohne
                Wasserzeichen und ohne zugehörigen Beitrag sind -- optisch
                sonst kaum von den Beitrags-Fotos zu unterscheiden, aber
                inhaltlich ein anderes Ding (siehe /intern/freigaben/[id],
                gleiche Trennung dort). */}
            {libraryImages.length > 0 && (
              <div className={allImages.length > 0 ? 'mt-10' : ''}>
                {allImages.length > 0 && (
                  <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                    Weiteres Bildmaterial ({libraryImages.length})
                  </h2>
                )}
                <div className="grid grid-cols-2 gap-4 nav:grid-cols-3">
                  {libraryImages.map((img) => (
                    <div
                      key={img.id}
                      className="overflow-hidden rounded-[10px] border border-line bg-white"
                    >
                      <div className="relative h-[165px] bg-panel">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/medienfreigabe/${token}/preview?mediaId=${img.id}`}
                          alt={img.displayName ?? ''}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="mb-2 truncate text-[12.5px] font-medium text-ink">
                          {img.displayName || 'Ohne Namen'}
                        </p>
                        <a
                          href={`/api/medienfreigabe/${token}/download?mediaId=${img.id}`}
                          className="block w-full rounded-md bg-ink px-3 py-2 text-center text-[11px] font-semibold text-white transition-colors hover:bg-black"
                        >
                          Foto herunterladen
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <footer className="mt-10 flex gap-5 border-t border-line pt-6 text-[11px] text-ink-3">
          <a href="/datenschutz">Datenschutzerklärung</a>
          <a href="/impressum">Impressum</a>
        </footer>
      </div>
    </section>
  );
}
