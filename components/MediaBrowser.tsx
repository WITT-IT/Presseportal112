'use client';

import { getStorageStatus } from '@/lib/storage';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDialog } from './DialogProvider';
import {
  useUploadQueue,
  entriesFromDataTransfer,
  expandEntries,
  isImageFile,
} from './UploadQueueProvider';
import PostCalendar from './PostCalendar';
import ShareFolderControl from './ShareFolderControl';
import MediaLightbox from './MediaLightbox';
import StorageUsageBar from './StorageUsageBar';
import type { Post } from '@/lib/types';

type SubFolder = { id: string; name: string };
type MediaItem = {
  id: string;
  display_name: string | null;
  file: string;
  file_preview: string | null;
};
type DragPayload = { id: string; type: 'folder' | 'media' };

function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function IconFolderPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </svg>
  );
}
function IconFolderUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 16v-5" />
      <path d="M9.5 13.5L12 11l2.5 2.5" />
    </svg>
  );
}
// Ordner mit sichtbarer Lasche -- klar als Ordner lesbar, auch klein.
function IconFolder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  );
}
// Ordner IM Ordner: äußere Hülle plus ein zweiter, kleiner Ordner darin.
// Bewusst ein eigenes Symbol -- die Verschachtelung soll man am Icon
// erkennen, nicht erst am Pfad in der Kopfzeile.
function IconFolderNested({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 6.5a1.6 1.6 0 0 1 1.6-1.6h2.9a1.6 1.6 0 0 1 1.3.65l.7 1h6.9" />
      <path d="M2.5 6.5v10a1.8 1.8 0 0 0 1.8 1.8h1" />
      <path d="M7.5 11.2a1.7 1.7 0 0 1 1.7-1.7h2.6a1.7 1.7 0 0 1 1.36.68l.74 1.02H19.8a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H9.2a1.7 1.7 0 0 1-1.7-1.7v-6.1z" />
    </svg>
  );
}
function IconBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}
function IconChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
function IconEdit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconPhotoPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export default function MediaBrowser({
  currentFolderId,
  parentFolderId,
  folderName = null,
  breadcrumb = [],
  subfolders,
  items,
  calendarPosts,
  mediaShares,
  storageStatus,
}: {
  currentFolderId: string | null;
  parentFolderId: string | null;
  folderName?: string | null;
  breadcrumb?: { id: string; name: string }[];
  subfolders: SubFolder[];
  items: MediaItem[];
  calendarPosts: Post[];
  mediaShares: { id: string; name: string }[];
  storageStatus?: { usedBytes: number; limitBytes: number };
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const { enqueue, liveUsedBytes } = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<(DragPayload & { value: string }) | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Der vom Upload gemeldete Live-Wert hat Vorrang vor dem serverseitig
  // gerenderten: Er trifft sofort nach jedem Upload ein, während der
  // Server-Wert erst mit dem nächsten router.refresh() nachzieht. Solange
  // die Upload-Route kein usedBytes mitliefert, bleibt liveUsedBytes null
  // und es gilt unverändert der Server-Wert.
  const effectiveUsedBytes = liveUsedBytes ?? storageStatus?.usedBytes ?? 0;
  const isAtLimit = storageStatus
    ? getStorageStatus(effectiveUsedBytes, storageStatus.limitBytes).isAtLimit
    : false;

  const isNested = Boolean(currentFolderId);
  const isEmpty = subfolders.length === 0 && items.length === 0 && !creatingFolder;

  function openFolder(id: string | null) {
    router.push(id ? `/intern/medien?folder=${id}` : '/intern/medien');
  }

  function startUpload(files: File[], targetFolderId: string | null) {
    if (isAtLimit) {
      setError('Speicherlimit erreicht — bitte zuerst Speicherplatz freigeben oder Stufe upgraden.');
      return;
    }
    const images = files.filter(isImageFile);
    const skipped = files.length - images.length;

    if (images.length === 0) {
      setError(
        files.length > 0
          ? 'Keine Bilddateien dabei — es lassen sich nur Bilder in die Mediathek laden.'
          : 'Keine Dateien gefunden.'
      );
      return;
    }
    setError(skipped > 0 ? `${skipped} Datei${skipped === 1 ? '' : 'en'} übersprungen (keine Bilder).` : null);
    enqueue(images, targetFolderId);
  }

  // entriesFromDataTransfer MUSS synchron laufen, bevor irgendein await
  // passiert -- die DataTransferItemList wird sonst vom Browser geleert.
  function ingestDrop(dataTransfer: DataTransfer, targetFolderId: string | null) {
    const entries = entriesFromDataTransfer(dataTransfer);
    const flatFiles = Array.from(dataTransfer.files ?? []);

    void (async () => {
      const collected = entries.length > 0 ? await expandEntries(entries) : flatFiles;
      startUpload(collected, targetFolderId);
    })();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    startUpload(Array.from(e.target.files ?? []), currentFolderId);
    e.target.value = '';
  }

  function isInternalDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('application/x-media-item');
  }

  function handleZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!isInternalDrag(e) && e.dataTransfer.types.includes('Files')) {
      setIsDraggingFiles(true);
    }
  }
  function handleZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (isInternalDrag(e)) return;
    ingestDrop(e.dataTransfer, currentFolderId);
  }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/intern/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_folder: currentFolderId }),
      });
      if (!res.ok) throw new Error('Ordner konnte nicht angelegt werden.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ordner anlegen fehlgeschlagen.');
    } finally {
      setBusy(false);
      setCreatingFolder(false);
      setNewFolderName('');
    }
  }

  function startRenameFolder(e: React.MouseEvent, folder: SubFolder) {
    e.stopPropagation();
    setRenaming({ id: folder.id, type: 'folder', value: folder.name });
  }

  async function submitRename() {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    try {
      if (renaming.type === 'folder') {
        await fetch('/api/intern/folders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: renaming.id, name: value }),
        });
      } else {
        await fetch('/api/intern/library', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: renaming.id, display_name: value }),
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
      setRenaming(null);
    }
  }

  async function moveItem(dragged: DragPayload, targetFolderId: string | null) {
    if (dragged.type === 'folder' && dragged.id === targetFolderId) return;
    setBusy(true);
    try {
      if (dragged.type === 'folder') {
        await fetch('/api/intern/folders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dragged.id, parent_folder: targetFolderId }),
        });
      } else {
        await fetch('/api/intern/library', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dragged.id, folder: targetFolderId }),
        });
      }
      router.refresh();
    } catch {
      setError('Verschieben fehlgeschlagen.');
    } finally {
      setBusy(false);
      setDragOverId(null);
    }
  }

  function handleDragStart(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData('application/x-media-item', JSON.stringify(payload));
  }

  function handleDropOnFolderTile(e: React.DragEvent, targetId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    setIsDraggingFiles(false);

    const raw = e.dataTransfer.getData('application/x-media-item');
    if (raw) {
      moveItem(JSON.parse(raw), targetId);
      return;
    }
    ingestDrop(e.dataTransfer, targetId);
  }

  async function deleteItem(target: DragPayload, name: string) {
    const confirmed = await confirm({
      title: target.type === 'folder' ? 'Ordner wirklich löschen?' : 'Bild wirklich löschen?',
      message:
        target.type === 'folder'
          ? `„${name}" muss leer sein, damit das Löschen klappt.`
          : `„${name}" wird dauerhaft aus der Bibliothek entfernt.`,
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      if (target.type === 'folder') {
        const res = await fetch(`/api/intern/folders?id=${target.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
        }
      } else {
        const res = await fetch(`/api/intern/library?id=${target.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
        }
        if (lightboxId === target.id) setLightboxId(null);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* ── KOPF ────────────────────────────────────────────────────────
          Vier Ebenen in fester Rangfolge: Pfad → Titel → Metazeile →
          Aktionen rechts. */}
      <header className="border-b border-line/70 px-6 pb-7 pt-6 nav:px-10 nav:pt-8">
        <div className="mb-4 flex min-h-[28px] flex-wrap items-center gap-x-2 gap-y-1">
          {isNested && (
            <button
              type="button"
              onClick={() => openFolder(parentFolderId)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId('PARENT');
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDropOnFolderTile(e, parentFolderId)}
              aria-label="Eine Ebene höher"
              title="Eine Ebene höher — Bilder oder Ordner hierher ziehen zum Verschieben"
              className={`mr-1 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line-strong bg-white text-ink-2 transition-colors hover:border-ink hover:text-ink ${
                dragOverId === 'PARENT' ? 'border-signal bg-signal/10 text-signal-deep' : ''
              }`}
            >
              <IconBack className="h-[13px] w-[13px]" />
            </button>
          )}

          <nav
            aria-label="Ordnerpfad"
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3"
          >
            <button
              type="button"
              onClick={() => openFolder(null)}
              disabled={!isNested}
              className="transition-colors hover:text-ink disabled:cursor-default disabled:hover:text-ink-3"
            >
              Medienbibliothek
            </button>
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
                  <IconChevron className="h-[10px] w-[10px] flex-none text-ink-3/50" />
                  {isLast ? (
                    <span className="truncate text-ink-2">{crumb.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openFolder(crumb.id)}
                      className="truncate transition-colors hover:text-ink"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {/* Titelmarke: im Ordner das Verschachtelungs-Symbol, in der
                  Wurzel keins. Zusammen mit dem Pfad darüber ist damit auf
                  einen Blick klar, auf welcher Ebene man steht. */}
              {isNested && (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-signal/10 text-signal-deep">
                  <IconFolder className="h-[18px] w-[18px]" />
                </span>
              )}
              <h1 className="truncate font-display text-[clamp(26px,3.4vw,38px)] leading-[1.05] text-ink">
                {folderName ?? 'Alle Medien'}
              </h1>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-2">
              <span>
                <span className="font-mono font-semibold text-ink">{subfolders.length}</span>{' '}
                {isNested ? 'Unterordner' : 'Ordner'}
              </span>
              <span className="text-ink-3/60" aria-hidden="true">·</span>
              <span>
                <span className="font-mono font-semibold text-ink">{items.length}</span>{' '}
                {items.length === 1 ? 'Bild' : 'Bilder'}
              </span>
              {isAtLimit && (
                <>
                  <span className="text-ink-3/60" aria-hidden="true">·</span>
                  <span className="font-medium text-signal-deep">Speicher voll</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-none flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              disabled={busy}
              className="flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              <IconFolderPlus className="h-[15px] w-[15px]" />
              {isNested ? 'Neuer Unterordner' : 'Neuer Ordner'}
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={isAtLimit}
              title="Einen kompletten Ordner vom Rechner hochladen"
              className="flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconFolderUp className="h-[15px] w-[15px]" />
              Ordner
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAtLimit}
              title={isAtLimit ? 'Speicherlimit erreicht — bitte zuerst Speicherplatz freigeben oder Stufe upgraden.' : undefined}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconUpload className="h-[15px] w-[15px]" />
              Hochladen
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handleFileInputChange} />
            {/* webkitdirectory ist kein Standard-Attribut in den React-Typen,
                funktioniert aber in allen relevanten Browsern. */}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileInputChange}
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            />
          </div>
        </div>
      </header>

      <div className="px-6 py-7 nav:px-10 nav:py-8">
        {error && (
          <p className="mb-5 rounded-[12px] border border-signal-deep/25 bg-signal-deep/5 px-3.5 py-2.5 text-[12.5px] text-signal-deep">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-7 nav:flex-row nav:items-start nav:gap-8">
          <div
            onDragOver={handleZoneDragOver}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsDraggingFiles(false);
              }
            }}
            onDrop={handleZoneDrop}
            className="relative min-w-0 flex-1"
          >
            {isDraggingFiles && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[20px] border-2 border-dashed border-signal bg-paper/85 backdrop-blur-sm">
                <div className="text-center">
                  <IconUpload className="mx-auto h-[28px] w-[28px] text-signal" />
                  <p className="mt-2 text-[13px] font-semibold text-ink">Zum Hochladen loslassen</p>
                  <p className="mt-0.5 text-[12px] text-ink-2">
                    {folderName ? `Ablage in „${folderName}"` : 'Ablage in der Medienbibliothek'}
                  </p>
                </div>
              </div>
            )}

            {(subfolders.length > 0 || creatingFolder) && (
              <section className="mb-8">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {isNested ? (
                    <>
                      Unterordner in{' '}
                      <span className="normal-case tracking-normal text-ink-2">„{folderName}"</span>
                    </>
                  ) : (
                    'Ordner'
                  )}
                </h2>

                {/* Verschachtelung wird als Einrückung mit Rail-Linie
                    dargestellt -- dasselbe Prinzip wie in jedem Dateibaum.
                    In der Wurzel gibt es keine Rail, weil es dort nichts
                    einzurücken gibt. Das ist der eigentliche Grund, warum
                    vorher nicht erkennbar war, dass ein Ordner IN einem
                    Ordner liegt: alle Ebenen sahen exakt gleich aus. */}
                <div className={isNested ? 'border-l-2 border-line pl-4' : ''}>
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {creatingFolder && (
                      <div className="flex items-center gap-3 rounded-[12px] border border-signal/40 bg-white px-3.5 py-3 shadow-card">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-signal/10 text-signal-deep">
                          {isNested ? <IconFolderNested className="h-[20px] w-[20px]" /> : <IconFolder className="h-[20px] w-[20px]" />}
                        </span>
                        <input
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitNewFolder();
                            if (e.key === 'Escape') setCreatingFolder(false);
                          }}
                          onBlur={submitNewFolder}
                          placeholder="Ordnername"
                          className="w-full rounded-md border border-ink px-2 py-1 text-[13px] outline-none"
                        />
                      </div>
                    )}

                    {subfolders.map((folder) => (
                      <div
                        key={folder.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, { id: folder.id, type: 'folder' })}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverId(folder.id);
                        }}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={(e) => handleDropOnFolderTile(e, folder.id)}
                        onClick={() => openFolder(folder.id)}
                        title="Klick zum Öffnen — Bilder hierher ziehen zum Ablegen"
                        className={`group relative flex cursor-pointer items-center gap-3 rounded-[12px] border border-white/70 bg-white px-3.5 py-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                          dragOverId === folder.id ? 'border-signal ring-2 ring-signal/40' : ''
                        }`}
                      >
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-panel text-ink-2 transition-colors group-hover:bg-signal/10 group-hover:text-signal-deep">
                          {isNested ? (
                            <IconFolderNested className="h-[20px] w-[20px]" />
                          ) : (
                            <IconFolder className="h-[20px] w-[20px]" />
                          )}
                        </span>

                        {renaming?.id === folder.id ? (
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename();
                              if (e.key === 'Escape') setRenaming(null);
                            }}
                            onBlur={submitRename}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-md border border-ink px-2 py-1 text-[13px] outline-none"
                          />
                        ) : (
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-ink">
                              {folder.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-3">
                              {isNested ? `Unterordner von „${folderName}"` : 'Ordner'}
                            </span>
                          </span>
                        )}

                        {renaming?.id !== folder.id && (
                          <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <ShareFolderControl folderId={folder.id} folderName={folder.name} mediaShares={mediaShares} />
                            <button
                              type="button"
                              onClick={(e) => startRenameFolder(e, folder)}
                              title="Ordner umbenennen"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink"
                            >
                              <IconEdit className="h-[13px] w-[13px]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem({ id: folder.id, type: 'folder' }, folder.name);
                              }}
                              title="Ordner löschen"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-signal-deep hover:text-white"
                            >
                              <IconX className="h-[13px] w-[13px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {items.length > 0 && (
              <section>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Bilder
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 nav:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => {
                    const label = item.display_name || 'Bild';
                    return (
                      <figure
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, { id: item.id, type: 'media' })}
                        className="group relative flex flex-col overflow-hidden rounded-[16px] border border-white/70 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem({ id: item.id, type: 'media' }, label);
                          }}
                          title="Bild löschen"
                          className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 opacity-0 shadow-sm ring-1 ring-line-strong backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
                        >
                          <IconX className="h-[13px] w-[13px]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setLightboxId(item.id)}
                          title="Klick für Großansicht"
                          className="relative aspect-square w-full cursor-pointer overflow-hidden bg-panel"
                        >
                          <Image
                            src={`/api/intern/library?original=${item.id}&width=400&quality=72`}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                            unoptimized
                          />
                        </button>

                        <figcaption className="px-3 py-2.5">
                          {renaming?.id === item.id ? (
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRename();
                                if (e.key === 'Escape') setRenaming(null);
                              }}
                              onBlur={submitRename}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-md border border-ink px-1.5 py-0.5 text-[12.5px] outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setRenaming({ id: item.id, type: 'media', value: label });
                              }}
                              title="Doppelklick zum schnellen Umbenennen"
                              className="line-clamp-1 text-[12.5px] font-medium text-ink"
                            >
                              {label}
                            </span>
                          )}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-strong bg-white/60 px-6 py-20 text-center">
                <IconPhotoPlus className="h-[34px] w-[34px] text-ink-3" />
                <p className="text-[13.5px] font-semibold text-ink">
                  {folderName ? `„${folderName}" ist noch leer` : 'Noch keine Medien'}
                </p>
                <p className="max-w-[320px] text-[12.5px] leading-[1.6] text-ink-2">
                  Zieh Bilder oder ganze Ordner in diesen Bereich — oder nutz die Schaltflächen oben.
                </p>
              </div>
            )}
          </div>

          <aside className="flex w-full flex-none flex-col gap-4 nav:sticky nav:top-6 nav:w-[280px]">
            {storageStatus && (
              <div className="rounded-[16px] border border-white/70 bg-white p-4 shadow-card">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Speicherplatz
                </div>
                <StorageUsageBar usedBytes={effectiveUsedBytes} limitBytes={storageStatus.limitBytes} />
                <p className="mt-2 text-[11.5px] leading-[1.5] text-ink-3">
                  Gilt für die gesamte Organisation, nicht nur diesen Ordner.
                </p>
              </div>
            )}

            <PostCalendar posts={calendarPosts} />
          </aside>
        </div>
      </div>

      {lightboxId && (
        <MediaLightbox
          items={items}
          activeId={lightboxId}
          onClose={() => setLightboxId(null)}
          onChangeActive={setLightboxId}
        />
      )}
    </div>
  );
}
