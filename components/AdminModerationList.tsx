'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDialog } from './DialogProvider';
import { directusAssetUrl } from '@/lib/directus';

type ModerationPost = {
  id: string;
  title: string | null;
  alarm_code: string | null;
  published_at: string | null;
  uploaded_by: string | null;
  organization: { name: string } | null;
  images: { id: string; file_public_preview: string | null }[];
};

export default function AdminModerationList({ posts }: { posts: ModerationPost[] }) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [filter, setFilter] = useState<'all' | 'orphaned'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = filter === 'orphaned' ? posts.filter((p) => !p.uploaded_by) : posts;

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: 'Beitrag dauerhaft löschen?',
      message:
        'Der Beitrag verschwindet sofort aus dem öffentlichen Archiv und kann nicht wiederhergestellt werden.',
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusyId(id);
    await fetch(`/api/admin/moderation/${id}`, { method: 'DELETE' });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
            filter === 'all' ? 'bg-ink text-white' : 'border border-line-strong text-ink-2'
          }`}
        >
          Alle ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('orphaned')}
          className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
            filter === 'orphaned'
              ? 'bg-signal-deep text-white'
              : 'border border-line-strong text-ink-2'
          }`}
        >
          Verwaist ({posts.filter((p) => !p.uploaded_by).length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink-2">Keine Beiträge in dieser Ansicht.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
          {filtered.map((post) => {
            const hero = post.images?.[0];
            return (
              <div
                key={post.id}
                className="overflow-hidden rounded-[10px] border border-line bg-white"
              >
                <div className="relative h-[110px] bg-panel">
                  {hero?.file_public_preview && (
                    <Image
                      src={directusAssetUrl(hero.file_public_preview, 'width=300&quality=70')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                  {!post.uploaded_by && (
                    <span className="absolute left-2 top-2 rounded-[4px] bg-signal-deep px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      verwaist
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="mb-1 truncate text-[11px] text-ink-3">
                    {post.organization?.name ?? 'Unbekannte Organisation'}
                  </div>
                  <div className="mb-2 truncate text-[12px] font-medium">
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    disabled={busyId === post.id}
                    className="w-full rounded-md border border-line-strong px-2 py-1.5 text-[11px] font-semibold text-signal-deep transition-colors hover:border-signal disabled:opacity-50"
                  >
                    {busyId === post.id ? '…' : 'Dauerhaft löschen'}
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
