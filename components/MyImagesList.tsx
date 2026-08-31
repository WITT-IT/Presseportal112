'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';
import AddToMediaShareControl from './AddToMediaShareControl';

export default function MyImagesList({
  posts,
  mediaShares,
}: {
  posts: Post[];
  // "folders" absichtlich NICHT mehr entgegengenommen: Ordner ordnen seit
  // der Umstellung ausschließlich Bibliotheksbilder über das folder-Feld
  // in media_library. Beiträge zusätzlich über die Zwischentabelle
  // folders_posts einem Ordner zuzuordnen war eine zweite, konkurrierende
  // Wahrheit -- ein Beitrag konnte in Ordner A liegen, während sein
  // Originalbild in Ordner B lag. Genau solche Doppelzuordnungen sollte
  // die Umstellung auf eine einzige Quelle beseitigen.
  mediaShares: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [deleteWorking, setDeleteWorking] = useState(false);

  async function togglePublic(id: string, current: boolean) {
    setPendingId(id);
    await fetch('/api/intern/posts/toggle-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: id, makePublic: !current }),
    });
    setPendingId(null);
    router.refresh();
  }

  // Gleiches Popup wie im UploadStudio (Bearbeiten-Modus) statt der
  // generischen useDialog-Bestätigung -- löscht nur den Beitrag, nie das
  // zugrundeliegende Bibliotheksbild. Wortlaut bewusst identisch zum
  // UploadStudio, damit an beiden Stellen im Produkt dieselbe Erwartung
  // entsteht: "Beitrag weg, Original bleibt".
  async function confirmDelete() {
    if (!deleteDialogId) return;
    setDeleteWorking(true);
    try {
      const res = await fetch('/api/intern/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteDialogId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
      }
      router.refresh();
    } finally {
      setDeleteWorking(false);
      setDeleteDialogId(null);
    }
  }

  if (posts.length === 0) {
    return (
      <p className="text-[13px] text-ink-2">
        Noch keine Beiträge hochgeladen — leg über die Medienbibliothek los.
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
                  href={`/intern/upload?postId=${post.id}`}
                  className="block w-full rounded-md border border-line-strong px-2 py-1.5 text-center text-[11px] font-semibold text-ink transition-colors hover:border-ink"
                >
                  Bearbeiten
                </Link>

                <AddToMediaShareControl postId={post.id} mediaShares={mediaShares} />

                <button
                  type="button"
                  onClick={() => setDeleteDialogId(post.id)}
                  className="w-full rounded-md border border-line-strong px-2 py-1.5 text-[11px] font-semibold text-signal-deep transition-colors hover:border-signal hover:bg-signal/5"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {deleteDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-[10px] border border-line bg-white p-4">
            <h3 className="mb-2 font-display text-[18px] font-bold">Beitrag löschen?</h3>
            <p className="mb-4 text-[13px] text-ink-2">
              Der Beitrag wird entfernt. Das Originalfoto bleibt in der Medienbibliothek erhalten.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteWorking}
                className="flex-1 rounded-md bg-signal-deep px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {deleteWorking ? 'Wird gelöscht …' : 'Endgültig löschen'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogId(null)}
                disabled={deleteWorking}
                className="flex-1 rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-60"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
