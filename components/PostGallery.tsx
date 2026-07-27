'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import type { PostImage } from '@/lib/types';

export default function PostGallery({ images }: { images: PostImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sorted = [...images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  // Tastatursteuerung, solange die Lightbox offen ist.
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) => (i === null ? null : (i + 1) % sorted.length));
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? null : (i - 1 + sorted.length) % sorted.length));
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, sorted.length]);

  if (sorted.length === 0) return null;

  const [hero, ...rest] = sorted;
  const active = lightboxIndex !== null ? sorted[lightboxIndex] : null;

  return (
    <>
      {/* Titelbild groß */}
      <figure className="mb-3">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="group relative block aspect-[16/10] w-full overflow-hidden rounded-[10px] border border-line bg-panel"
        >
          {hero.file_public_preview && (
            <Image
              src={directusAssetUrl(hero.file_public_preview, 'width=1400&quality=85')}
              alt={hero.caption ?? 'Einsatzfoto'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(min-width: 901px) 760px, 100vw"
              priority
            />
          )}
          <span className="absolute bottom-3 right-3 rounded-md bg-ink/75 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Vergrößern
          </span>
        </button>
        {hero.caption && (
          <figcaption className="mt-2 text-[12px] leading-[1.5] text-ink-2">
            {hero.caption}
          </figcaption>
        )}
      </figure>

      {/* Weitere Fotos als Raster */}
      {rest.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 nav:grid-cols-3">
          {rest.map((img, i) => (
            <figure key={img.id}>
              <button
                type="button"
                onClick={() => setLightboxIndex(i + 1)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[8px] border border-line bg-panel"
              >
                {img.file_public_preview && (
                  <Image
                    src={directusAssetUrl(img.file_public_preview, 'width=600&quality=80')}
                    alt={img.caption ?? 'Einsatzfoto'}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(min-width: 901px) 240px, 45vw"
                  />
                )}
              </button>
              {img.caption && (
                <figcaption className="mt-1.5 text-[11px] leading-[1.45] text-ink-2">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-[1100px] flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mx-auto max-h-[75vh] w-full">
              {active.file_public_preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={directusAssetUrl(active.file_public_preview, 'width=1800&quality=88')}
                  alt={active.caption ?? 'Einsatzfoto'}
                  className="mx-auto max-h-[75vh] w-auto rounded-[8px] object-contain"
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="min-w-0 flex-1">
                {active.caption && (
                  <p className="text-[13px] leading-[1.5]">{active.caption}</p>
                )}
                <p className="mt-0.5 font-mono text-[11px] text-white/60">
                  Bild {(lightboxIndex ?? 0) + 1} von {sorted.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {active.file_download && (
                  <a
                    href={`/api/download?imageId=${active.id}`}
                    className="rounded-md bg-white/15 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/25"
                  >
                    Dieses Bild herunterladen
                  </a>
                )}
                {sorted.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex(
                          ((lightboxIndex ?? 0) - 1 + sorted.length) % sorted.length
                        )
                      }
                      aria-label="Vorheriges Bild"
                      className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(((lightboxIndex ?? 0) + 1) % sorted.length)}
                      aria-label="Nächstes Bild"
                      className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
                    >
                      →
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Schließen"
                  className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
