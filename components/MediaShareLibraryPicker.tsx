'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type LibraryItem = {
  id: string;
  display_name: string | null;
  file_preview: string | null;
};

type FolderNode = { id: string; name: string };

export default function MediaShareLibraryPicker({
  shareId,
  excludeIds,
}: {
  shareId: string;
  excludeIds: string[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'ordner' | 'suche'>('ordner');

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<FolderNode[]>([]);
  const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
  const [folderItems, setFolderItems] = useState<LibraryItem[]>([]);
  const [folderLoading, setFolderLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchItems, setSearchItems] = useState<LibraryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const excluded = new Set(excludeIds);

  async function loadFolder(folderId: string | null) {
    setFolderLoading(true);
    try {
      const itemsParams = new URLSearchParams();
      if (folderId) itemsParams.set('folder', folderId);
      const itemsRes = await fetch(`/api/intern/library?${itemsParams.toString()}&limit=200`);
      const itemsBody = await itemsRes.json().catch(() => ({}));
      setFolderItems(Array.isArray(itemsBody.items) ? itemsBody.items : []);

      const contentsParams = new URLSearchParams({ contents: '1' });
      if (folderId) contentsParams.set('folder', folderId);
      const contentsRes = await fetch(`/api/intern/folders?${contentsParams.toString()}`);
      if (contentsRes.ok) {
        const contentsBody = await contentsRes.json();
        setBreadcrumb(contentsBody.breadcrumb ?? []);
        setSubfolders(contentsBody.subfolders ?? []);
      } else {
        setBreadcrumb([]);
        setSubfolders([]);
      }
    } catch {
      setFolderItems([]);
      setSubfolders([]);
    } finally {
      setFolderLoading(false);
    }
  }

  async function loadSearch(q: string) {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/intern/library?q=${encodeURIComponent(q)}&limit=48`);
      const body = await res.json().catch(() => ({}));
      setSearchItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setSearchItems([]);
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    loadFolder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    loadFolder(folderId);
  }

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

  function renderGrid(items: LibraryItem[]) {
    const visible = items.filter((item) => !excluded.has(item.id));
    if (visible.length === 0) {
      return (
        <p className="py-8 text-center text-[12.5px] text-ink-3">
          {items.length === 0 ? 'Keine Bilder hier.' : 'Alle Bilder hier sind bereits angehängt.'}
        </p>
      );
    }
    return (
      <div className="grid grid-cols-4 gap-2 nav:grid-cols-6">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleAdd(item.id)}
            disabled={busyId === item.id}
            className="group relative aspect-square overflow-hidden rounded-md border border-line transition-colors hover:border-ink disabled:opacity-50"
          >
            <Image
              src={`/api/intern/library?original=${item.id}&width=160&quality=70`}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
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
    );
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <div className="mb-3 flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
        <button
          type="button"
          onClick={() => setMode('ordner')}
          className={`flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === 'ordner' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          }`}
        >
          Ordner
        </button>
        <button
          type="button"
          onClick={() => setMode('suche')}
          className={`flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            mode === 'suche' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          }`}
        >
          Suche
        </button>
      </div>

      {error && <p className="mb-3 text-[12px] text-signal-deep">{error}</p>}

      {mode === 'ordner' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-ink-2">
            <button type="button" onClick={() => openFolder(null)} className="font-semibold text-ink hover:underline">
              Bibliothek
            </button>
            {breadcrumb.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <span className="text-ink-3">/</span>
                <button type="button" onClick={() => openFolder(f.id)} className="hover:underline">
                  {f.name}
                </button>
              </span>
            ))}
          </div>

          {folderLoading ? (
            <p className="py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
          ) : (
            <>
              {subfolders.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {subfolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => openFolder(f.id)}
                      className="flex items-center gap-1.5 rounded-md border border-line-strong bg-panel px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink"
                    >
                      <i className="ti ti-folder text-[13px]" aria-hidden="true" />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
              {renderGrid(folderItems)}
            </>
          )}
        </>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              loadSearch(e.target.value);
            }}
            placeholder="Tags oder Dateiname …"
            className="mb-3 w-full rounded-md border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-ink"
          />
          {searchLoading ? (
            <p className="py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
          ) : (
            renderGrid(searchItems)
          )}
        </>
      )}
    </div>
  );
}
