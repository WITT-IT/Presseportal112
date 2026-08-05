'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';

type PreviewPost = {
  id: string;
  title: string | null;
  alarm_code: string | null;
  location: string | null;
  event_date: string | null;
  images?: { file_public_preview: string | null; sort: number }[];
};

export default function SearchBox({
  defaultValue,
  gewerkId,
  dark = false,
}: {
  defaultValue?: string;
  gewerkId?: string;
  dark?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue ?? '');
  const [previews, setPreviews] = useState<PreviewPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live-Suche mit Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setPreviews([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, limit: '5' });
        if (gewerkId) params.set('gewerk', gewerkId);
        const res = await fetch(`/api/search/preview?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPreviews(data.results ?? []);
          setOpen(true);
        }
      } catch {
        setPreviews([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, gewerkId]);

  // Klick außerhalb → Dropdown schließen
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (gewerkId) params.set('gewerk', gewerkId);
    router.push(`/bildarchiv?${params}`);
  }

  const hero = (post: PreviewPost) => {
    if (!post.images?.length) return null;
    return [...post.images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0]?.file_public_preview ?? null;
  };

  return (
    <div ref={containerRef} className="relative mb-6">
      <form onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => previews.length > 0 && setOpen(true)}
          placeholder="Ort, Alarmcode, Stichwort oder Datum"
          className={
            dark
              ? 'w-full rounded-md border border-white/15 bg-white/[0.06] py-3 pl-4 pr-24 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/35'
              : 'w-full rounded-md border border-line-strong bg-white py-3 pl-4 pr-24 text-[14px] outline-none focus:border-ink'
          }
        />
        <button
          type="submit"
          className={
            dark
              ? 'absolute right-1.5 top-1.5 rounded-md bg-amber px-4 py-1.5 text-[12.5px] font-semibold text-void hover:bg-amber-bright'
              : 'absolute right-1.5 top-1.5 rounded-md bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black'
          }
        >
          Suchen
        </button>
      </form>

      {/* Live-Preview Dropdown */}
      {open && (query.trim().length >= 2) && (
        <div className={`absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[10px] border shadow-lg ${
          dark ? 'border-white/15 bg-void' : 'border-line bg-white'
        }`}>
          {loading && (
            <div className={`px-4 py-3 text-[12.5px] ${dark ? 'text-white/40' : 'text-ink-3'}`}>
              Suche läuft …
            </div>
          )}

          {!loading && previews.length === 0 && (
            <div className={`px-4 py-3 text-[12.5px] ${dark ? 'text-white/40' : 'text-ink-3'}`}>
              Keine Treffer für „{query.trim()}"
            </div>
          )}

          {!loading && previews.map((post) => {
            const img = hero(post);
            return (
              <Link
                key={post.id}
                href={`/bildarchiv/${post.id}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                  dark ? 'hover:bg-white/[0.06]' : 'hover:bg-panel'
                }`}
              >
                <div className="relative h-10 w-10 flex-none overflow-hidden rounded-md bg-panel">
                  {img && (
                    <Image
                      src={directusAssetUrl(img, 'width=80&quality=70')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </div>
                  <div className={`truncate text-[11.5px] ${dark ? 'text-white/40' : 'text-ink-3'}`}>
                    {[post.alarm_code, post.location, post.event_date?.slice(0, 10)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <i className={`ti ti-arrow-right text-[13px] flex-none ${dark ? 'text-white/30' : 'text-ink-3'}`} aria-hidden="true" />
              </Link>
            );
          })}

          {!loading && previews.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              className={`flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-[12.5px] font-semibold transition-colors ${
                dark
                  ? 'border-white/10 text-white/60 hover:text-white'
                  : 'border-line text-ink-2 hover:text-ink'
              }`}
            >
              Alle Treffer für „{query.trim()}" anzeigen
              <i className="ti ti-arrow-right text-[13px]" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
