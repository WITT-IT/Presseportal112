'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';

export default function FolderPostPicker({
  folderId,
  availablePosts,
}: {
  folderId: string;
  availablePosts: Post[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = availablePosts.filter((post) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (post.title || '').toLowerCase().includes(q) ||
      (post.alarm_code || '').toLowerCase().includes(q)
    );
  });

  async function handleAdd(postId: string) {
    setBusyId(postId);
    await fetch('/api/intern/folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, postId, action: 'add' }),
    });
    setBusyId(null);
    router.refresh();
  }

  if (availablePosts.length === 0) {
    return (
      <p className="text-[13px] text-ink-2">
        Du hast bereits jeden deiner Beiträge, der noch nicht in diesem
        Ordner ist, hier zugeordnet — es gibt gerade nichts weiter
        auszuwählen.
      </p>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Beiträge durchsuchen …"
        className="mb-4 w-full rounded-md border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-ink"
      />

      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink-2">Keine Treffer.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 nav:grid-cols-4">
          {filtered.map((post) => {
            const hero = primaryImage(post);
            return (
              <div
                key={post.id}
                className="overflow-hidden rounded-[10px] border border-line bg-white"
              >
                <div className="relative h-[90px] bg-panel">
                  {hero?.file_public_preview && (
                    <Image
                      src={directusAssetUrl(hero.file_public_preview, 'width=240&quality=65')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-2">
                  <div className="mb-2 truncate text-[11px] font-medium">
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(post.id)}
                    disabled={busyId === post.id}
                    className="w-full rounded-md bg-ink px-2 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
                  >
                    {busyId === post.id ? '…' : '+ Hinzufügen'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
