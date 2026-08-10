'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

type FolderNode = { id: string; name: string };

function IconFolder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}
function IconShare({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.6l7.6-4.2" />
      <path d="M8.2 13.4l7.6 4.2" />
    </svg>
  );
}

export default function MediaShareFolderPicker({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { confirm } = useDialog();

  const [breadcrumb, setBreadcrumb] = useState<FolderNode[]>([]);
  const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFolder(folderId: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ contents: '1' });
      if (folderId) params.set('folder', folderId);
      const res = await fetch(`/api/intern/folders?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setBreadcrumb(body.breadcrumb ?? []);
        setSubfolders(body.subfolders ?? []);
      } else {
        setBreadcrumb([]);
        setSubfolders([]);
      }
    } catch {
      setBreadcrumb([]);
      setSubfolders([]);
    } finally {
      setLoading(false);
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

  async function handleShareFolder(folder: FolderNode) {
    const confirmed = await confirm({
      title: `„${folder.name}" freigeben?`,
      message: `Alle Bilder in diesem Ordner werden dieser Freigabe hinzugefügt — inklusive aller Unterordner, egal wie tief verschachtelt. Bereits enthaltene Bilder werden nicht doppelt hinzugefügt.`,
      confirmLabel: 'Ordner freigeben',
      cancelLabel: 'Abbrechen',
    });
    if (!confirmed) return;

    setBusyFolderId(folder.id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, folderId: folder.id, action: 'add' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Fehlgeschlagen.');
      setResult(`„${folder.name}": ${body.added} von ${body.total} Bildern hinzugefügt.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigeben fehlgeschlagen.');
    } finally {
      setBusyFolderId(null);
    }
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-ink-2">
        <button
          type="button"
          onClick={() => openFolder(null)}
          className="font-semibold text-ink hover:underline"
        >
          Medien
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

      {error && <p className="mb-3 text-[12px] text-signal-deep">{error}</p>}
      {result && <p className="mb-3 text-[12px] text-ink-2">{result}</p>}

      {loading ? (
        <p className="py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
      ) : subfolders.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-ink-3">
          {currentFolderId ? 'Keine Unterordner hier.' : 'Noch keine Ordner in der Bibliothek.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {subfolders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
            >
              <button
                type="button"
                onClick={() => openFolder(folder.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <IconFolder className="h-4 w-4 flex-none text-ink-3" />
                <span className="truncate text-[13px] font-medium text-ink">{folder.name}</span>
              </button>
              <button
                type="button"
                onClick={() => handleShareFolder(folder)}
                disabled={busyFolderId === folder.id}
                className="flex flex-none items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <IconShare className="h-[13px] w-[13px]" />
                {busyFolderId === folder.id ? '…' : 'Freigeben'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
