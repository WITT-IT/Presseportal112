'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';
import { useDialog } from './DialogProvider';
import AddToFolderControl from './AddToFolderControl';

export default function MyImagesList({
  posts,
  folders,
}: {
  posts: Post[];
  folders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { confirm } = useDialog();
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

  async function handleDelete(id: string, imageCount: number) {
    const confirmed = await confirm({
      title: 'Beitrag wirklich löschen?',
      message: `Das entfernt den Beitrag samt ${imageCount} Foto${
        imageCount === 1 ? '' : 's'
      } und allen Dateivarianten unwiderruflich vom Server.`,
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setPendingId(id);
    await fetch('/api/intern/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setPendingId(null);
    router.refresh();
  }

  if (posts.length === 0) {
    return (
      <p className="text-[13px] text-ink-2">
        Noch keine Beiträge hochgeladen — das Formular oben legt direkt los.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
      {posts.map((post) => {
        const hero = primaryImage(post);
        const imageCount = post.images?.length ?? 0;

        return (
          <div
            key={post.id}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="relative h-[130px] bg-panel">
              {hero?.file_public_preview && (
                <Image
                  src={directusAssetUrl(hero.file_public_preview, 'width=400&quality=70')}
                  alt={post.title ?? 'Einsatzfoto'}
                  fill
                  className="object-cover"
                  sizes="(min-width: 901px) 22vw, 45vw"
                />
              )}
              <span
                className={`absolute left-2 top-2 rounded-[4px] px-2 py-1 text-[10px] font-semibold ${
                  post.is_public ? 'bg-ink text-white' : 'bg-white text-ink-2'
                }`}
              >
                {post.is_public ? 'Öffentlich' : 'Entwurf'}
              </span>
              {imageCount > 1 && (
                <span className="absolute bottom-2 left-2 rounded-[4px] bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {imageCount} Fotos
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="mb-1 font-mono text-[10px] text-ink-3">
                {post.alarm_code ?? '—'}
              </div>
              <div className="mb-2 truncate text-[12px] font-medium">
                {post.title || 'Ohne Titel'}
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => togglePublic(post.id, post.is_public)}
                  disabled={pendingId === post.id}
                  className={`w-full rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    post.is_public
                      ? 'bg-panel text-ink-2 hover:bg-line'
                      : 'bg-ink text-white hover:bg-black'
                  }`}
                >
                  {pendingId === post.id
                    ? '…'
                    : post.is_public
                    ? 'Zurückziehen'
                    : 'Veröffentlichen'}
                </button>

                <Link
                  href={`/intern/bearbeiten/${post.id}`}
                  className="block w-full rounded-md border border-line-strong px-2 py-1.5 text-center text-[11px] font-semibold text-ink transition-colors hover:border-ink"
                >
                  Bearbeiten
                </Link>

                <AddToFolderControl postId={post.id} folders={folders} />

                <button
                  type="button"
                  onClick={() => handleDelete(post.id, imageCount)}
                  disabled={pendingId === post.id}
                  className="w-full rounded-md border border-line-strong px-2 py-1.5 text-[11px] font-semibold text-signal-deep transition-colors hover:border-signal hover:bg-signal/5 disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
