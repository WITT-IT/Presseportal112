'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';

type LibraryItem = {
  id: string;
  display_name: string | null;
  file_preview: string | null;
};

export default function MediaShareLibraryPicker({
  shareId,
  excludeIds,
}: {
  shareId: string;
  excludeIds: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const excluded = new Set(excludeIds);

  async function load(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/intern/library?q=${encodeURIComponent(q)}&limit=48`);
      const body = await res.json().catch(() => ({}));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(mediaId: string) {
    setBusyId(mediaId);
    setError(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, mediaId, action: 'add' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Fehlgeschlagen (Status ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  }

  const visible = items.filter((item) => !excluded.has(item.id));

  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          load(e.target.value);
        }}
        placeholder="Bibliothek durchsuchen — Tags oder Dateiname …"
        className="mb-3 w-full rounded-md border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-ink"
      />

      {error && <p className="mb-3 text-[12px] text-signal-deep">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-ink-3">
          {items.length === 0 ? 'Keine Treffer in der Bibliothek.' : 'Alle Treffer sind bereits angehängt.'}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 nav:grid-cols-6">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleAdd(item.id)}
              disabled={busyId === item.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-line transition-colors hover:border-ink disabled:opacity-50"
            >
              {item.file_preview ? (
                <Image
                  src={directusAssetUrl(item.file_preview, 'width=160&quality=70')}
                  alt=""
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-panel">
                  <i className="ti ti-photo text-[18px] text-ink-3" aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                <i className="ti ti-plus text-[18px] text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
              {busyId === item.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-[10px] font-semibold text-white">Wird hinzugefügt …</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
