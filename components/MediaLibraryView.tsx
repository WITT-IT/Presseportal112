'use client';

import { useState } from 'react';
import MyImagesList from './MyImagesList';
import type { Post } from '@/lib/types';

export default function MediaLibraryView({
  posts,
  mediaShares,
  initialStatus = 'all',
}: {
  posts: Post[];
  // "folders" ist hier ersatzlos entfallen. Der Ordner-Filter arbeitete über
  // folders.postIds, also über die Zwischentabelle folders_posts -- genau die
  // Beitrag-zu-Ordner-Zuordnung, die es seit der Umstellung nicht mehr gibt.
  // Ordner ordnen ausschließlich Bibliotheksbilder (media_library.folder).
  //
  // Das Dropdown stehen zu lassen wäre die schlechtere Wahl gewesen: Da keine
  // neuen folders_posts-Zeilen mehr entstehen, hätte jeder künftige Beitrag
  // beim Filtern auf einen Ordner ein leeres Ergebnis geliefert -- ein Filter,
  // der stumm falsche Treffermengen zeigt, ist schädlicher als gar keiner.
  //
  // Wer nach Ordnern sucht, tut das unter /intern/medien; das ist dort die
  // eigentliche Ordnernavigation. Diese Ansicht listet Beiträge, und die
  // sortieren sich über Status und Suche.
  mediaShares: { id: string; name: string }[];
  initialStatus?: 'all' | 'public' | 'draft';
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'public' | 'draft'>(initialStatus);

  const filtered = posts.filter((post) => {
    if (statusFilter === 'public' && !post.is_public) return false;
    if (statusFilter === 'draft' && post.is_public) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (post.title || '').toLowerCase().includes(q) ||
      (post.alarm_code || '').toLowerCase().includes(q) ||
      (post.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <i
            className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-3"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel, Alarmcode oder Ort durchsuchen …"
            className="w-full rounded-md border border-line-strong py-2 pl-9 pr-3 text-[13px] outline-none focus:border-ink"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'public', 'draft'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-md px-3 py-2 text-[12px] font-semibold transition-colors ${
                statusFilter === key
                  ? 'bg-ink text-white'
                  : 'border border-line-strong text-ink-2 hover:border-ink'
              }`}
            >
              {key === 'all' ? 'Alle' : key === 'public' ? 'Öffentlich' : 'Entwürfe'}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-[12px] text-ink-3">
        {filtered.length} von {posts.length} Beiträgen
      </p>

      <MyImagesList posts={filtered} mediaShares={mediaShares} />
    </div>
  );
}
