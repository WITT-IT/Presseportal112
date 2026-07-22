'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import type { DirectusImage } from '@/lib/types';

export default function MyImagesList({ images }: { images: DirectusImage[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function togglePublic(id: string, current: boolean) {
    setPendingId(id);
    await fetch('/api/intern/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isPublic: !current }),
    });
    setPendingId(null);
    router.refresh();
  }

  if (images.length === 0) {
    return (
      <p className="text-[13px] text-ink-2">
        Noch keine Bilder hochgeladen — das Formular oben legt direkt los.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
      {images.map((img) => (
        <div
          key={img.id}
          className="overflow-hidden rounded-[10px] border border-line bg-white"
        >
          <div className="relative h-[130px] bg-panel">
            {img.file_public_preview && (
              <Image
                src={directusAssetUrl(img.file_public_preview, 'width=400&quality=70')}
                alt={img.title ?? 'Einsatzfoto'}
                fill
                className="object-cover"
                sizes="(min-width: 901px) 22vw, 45vw"
              />
            )}
            <span
              className={`absolute left-2 top-2 rounded-[4px] px-2 py-1 text-[10px] font-semibold ${
                img.is_public ? 'bg-ink text-white' : 'bg-white text-ink-2'
              }`}
            >
              {img.is_public ? 'Öffentlich' : 'Entwurf'}
            </span>
          </div>
          <div className="p-3">
            <div className="mb-1 font-mono text-[10px] text-ink-3">
              {img.alarm_code ?? '—'}
            </div>
            <div className="mb-2 truncate text-[12px] font-medium">
              {img.title || 'Ohne Titel'}
            </div>
            <button
              type="button"
              onClick={() => togglePublic(img.id, img.is_public)}
              disabled={pendingId === img.id}
              className={`w-full rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                img.is_public
                  ? 'bg-panel text-ink-2 hover:bg-line'
                  : 'bg-ink text-white hover:bg-black'
              }`}
            >
              {pendingId === img.id
                ? '…'
                : img.is_public
                ? 'Zurückziehen'
                : 'Veröffentlichen'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
