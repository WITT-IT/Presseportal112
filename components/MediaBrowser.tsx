'use client';

import { getStorageStatus } from '@/lib/storage';
import { useEffect, useRef, useState } from 'react';
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

// Ziehen überträgt IMMER eine Liste, auch bei einem einzelnen Element.
type DragPayload = { type: 'folder' | 'media'; ids: string[] };

// Dateinamen in Dialogtexten kappen -- ein 120-Zeichen-Name als halber
// Absatz macht die eigentliche Frage unleserlich.
function shortName(name: string, max = 52): string {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

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
function IconFolder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  );
}
// Ordner IM Ordner: äußere Hülle plus ein zweiter, kleiner Ordner darin.
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
function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
  folderThumbs = {},
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
  /** Ordner-ID → media_library-ID des Vorschaubilds (oder null). */
  folderThumbs?: Record<string, string | null>;
  items: MediaItem[];
  calendarPosts: Post[];
  mediaShares: { id: string; name: string }[];
  storageStatus?: { usedBytes: number; limitBytes: number };
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const { enqueue, reportedUsedBytes, reportUsedBytes, clearReportedUsedBytes } = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; type: 'folder' | 'media'; value: string } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);

  const renderedUsedBytes = storageStatus?.usedBytes ?? 0;

  // Der gemeldete Wert schlägt den gerenderten, solange er existiert.
  // Beide stammen aus derselben serverseitigen Berechnung -- der gemeldete
  // ist nur früher da, weil er direkt aus der Antwort des Uploads oder der
  // Löschung kommt, statt auf einen Server-Rerender zu warten.
  const effectiveUsedBytes = reportedUsedBytes ?? renderedUsedBytes;

  // Sobald ein NEUER gerenderter Wert eintrifft, ist die Meldung überholt
  // und wird verworfen. Damit gewinnt der Server wieder die Oberhand --
  // wichtig, wenn sich der Bestand woanders geändert hat, etwa durch einen
  // zweiten Browsertab oder den nächtlichen Neuberechnungs-Job.
  useEffect(() => {
    clearReportedUsedBytes();
  }, [renderedUsedBytes, clearReportedUsedBytes]);

  const isAtLimit = storageStatus
    ? getStorageStatus(effectiveUsedBytes, storageStatus.limitBytes).isAtLimit
    : false;

  const isNested = Boolean(currentFolderId);
  const isEmpty = subfolders.length === 0 && items.length === 0 && !creatingFolder;

  const selectedItems = items.filter((it) => selectedIds.has(it.id));
  const selectionCount = selectedItems.length;
  const hasSelection = selectionCount > 0;

  useEffect(() => {
    if (!hasSelection || lightboxId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setAnchorIndex(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasSelection, lightboxId]);

  function openFolder(id: string | null) {
    setSelectedIds(new Set());
    setAnchorIndex(null);
    router.push(id ? `/intern/medien?folder=${id}` : '/intern/medien');
  }

  // Wertet den Speicherstand aus einer beliebigen API-Antwort aus.
  // Zentral gehalten, damit keine Aufrufstelle das Auslesen vergisst --
  // genau deshalb hing der Balken beim Löschen bisher hinterher.
  function applyStorageFromResponse(body: unknown) {
    if (body && typeof body === 'object' && 'usedBytes' in body) {
      const value = (body as { usedBytes?: unknown }).usedBytes;
      if (typeof value === 'number') reportUsedBytes(value);
    }
  }

  // ── Auswahl ────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRange(from: number, to: number) {
    const [start, end] = from <= to ? [from, to] : [to, from];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        const item = items[i];
        if (item) next.add(item.id);
      }
      return next;
    });
  }

  // Strg/Cmd → einzeln, Shift → Bereich, normal → Großansicht, außer es ist
  // bereits etwas ausgewählt (sonst wäre Mehrfachauswahl auf Touch-Geräten
  // unbedienbar, dort gibt es keine Sondertasten).
  function handleTileClick(e: React.MouseEvent, item: MediaItem, index: number) {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelect(item.id);
      setAnchorIndex(index);
      return;
    }
    if (e.shiftKey && anchorIndex !== null) {
      e.preventDefault();
      selectRange(anchorIndex, index);
      return;
    }
    if (hasSelection) {
      toggleSelect(item.id);
      setAnchorIndex(index);
      return;
    }
    setLightboxId(item.id);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setAnchorIndex(null);
  }

  function selectAll() {
    setSelectedIds(new Set(items.map((it) => it.id)));
  }

  // ── Upload ─────────────────────────────────────────────────────────────

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

  // ── Ordner anlegen / umbenennen ────────────────────────────────────────

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

  // ── Verschieben ────────────────────────────────────────────────────────

  // Sequentiell, nicht parallel: Directus quittiert einen Schwall
  // gleichzeitiger PATCHes gern mit Rate-Limits.
  async function moveMany(payload: DragPayload, targetFolderId: string | null) {
    const ids = payload.ids.filter((id) => !(payload.type === 'folder' && id === targetFolderId));
    if (ids.length === 0) return;

    const endpoint = payload.type === 'folder' ? '/api/intern/folders' : '/api/intern/library';
    setBusy(true);
    setError(null);
    let failed = 0;

    try {
      for (const id of ids) {
        const body =
          payload.type === 'folder'
            ? { id, parent_folder: targetFolderId }
            : { id, folder: targetFolderId };
        const res = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) failed++;
      }
      if (failed > 0) {
        setError(`${failed} von ${ids.length} Elementen konnten nicht verschoben werden.`);
      }
      clearSelection();
      router.refresh();
    } catch {
      setError('Verschieben fehlgeschlagen.');
    } finally {
      setBusy(false);
      setDragOverId(null);
    }
  }

  // Wird ein bereits markiertes Bild gezogen, wandert die GANZE Auswahl mit.
  function handleMediaDragStart(e: React.DragEvent, item: MediaItem) {
    const ids = selectedIds.has(item.id) && selectionCount > 1 ? selectedItems.map((it) => it.id) : [item.id];
    const payload: DragPayload = { type: 'media', ids };
    e.dataTransfer.setData('application/x-media-item', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleFolderDragStart(e: React.DragEvent, folder: SubFolder) {
    const payload: DragPayload = { type: 'folder', ids: [folder.id] };
    e.dataTransfer.setData('application/x-media-item', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDropOnFolderTile(e: React.DragEvent, targetId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    setIsDraggingFiles(false);

    const raw = e.dataTransfer.getData('application/x-media-item');
    if (raw) {
      try {
        const payload = JSON.parse(raw) as DragPayload;
        if (Array.isArray(payload.ids) && payload.ids.length > 0) {
          moveMany(payload, targetId);
        }
      } catch {
        setError('Verschieben fehlgeschlagen — ungültige Übergabedaten.');
      }
      return;
    }
    ingestDrop(e.dataTransfer, targetId);
  }

  // ── Löschen ────────────────────────────────────────────────────────────

  async function deleteFolder(folder: SubFolder) {
    const confirmed = await confirm({
      title: 'Ordner wirklich löschen?',
      message: `„${shortName(folder.name)}" wird mit seinem gesamten Inhalt entfernt.`,
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intern/folders?id=${folder.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
      }
      // Die Ordner-Route meldet den Speicherstand derzeit nicht mit; falls
      // sie es später tut, wird er hier automatisch übernommen. Bis dahin
      // zieht der Balken über router.refresh() nach.
      applyStorageFromResponse(body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(targets: MediaItem[]) {
    if (targets.length === 0) return;
    const single = targets.length === 1;

    const confirmed = await confirm({
      title: single ? 'Bild wirklich löschen?' : `${targets.length} Bilder wirklich löschen?`,
      message: single
        ? `„${shortName(targets[0].display_name || 'Bild')}" wird dauerhaft aus der Bibliothek entfernt.`
        : `${targets.length} Bilder werden dauerhaft aus der Bibliothek entfernt. Bilder, die in einem Beitrag verwendet werden, bleiben erhalten und werden übersprungen.`,
      confirmLabel: single ? 'Löschen' : `${targets.length} löschen`,
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const failures: string[] = [];

    try {
      for (const target of targets) {
        const res = await fetch(`/api/intern/library?id=${target.id}`, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          failures.push(`${shortName(target.display_name || 'Bild', 28)}: ${body.error ?? `Status ${res.status}`}`);
          continue;
        }

        // Nach JEDEM gelöschten Bild den neuen Stand übernehmen, nicht erst
        // am Ende: Bei einem Stapel von 40 Bildern läuft der Balken so
        // sichtbar mit, statt minutenlang unverändert zu stehen.
        applyStorageFromResponse(body);

        if (lightboxId === target.id) setLightboxId(null);
      }

      if (failures.length > 0) {
        setError(
          `${failures.length} von ${targets.length} Bildern nicht gelöscht — ${failures.join(' | ')}`
        );
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* ── KOPF ──────────────────────────────────────────────────────── */}
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
          <p className="mb-5 break-words rounded-[12px] border border-signal-deep/25 bg-signal-deep/5 px-3.5 py-2.5 text-[12.5px] text-signal-deep [overflow-wrap:anywhere]">
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

                {/* Verschachtelung als Einrückung mit Rail-Linie -- dasselbe
                    Prinzip wie in jedem Dateibaum. */}
                <div className={isNested ? 'border-l-2 border-line pl-4' : ''}>
                  {/* Querformatige Kacheln (5:3) statt Quadrate: Ein Ordner
                      ist damit auch mit Vorschaubild sofort von einem
                      quadratischen Foto zu unterscheiden. */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 nav:grid-cols-3 xl:grid-cols-4">
                    {creatingFolder && (
                      <div className="flex flex-col overflow-hidden rounded-[16px] border border-signal/40 bg-white shadow-card">
                        <div className="flex aspect-[5/3] w-full items-center justify-center bg-gradient-to-b from-panel to-panel/40 text-signal-deep">
                          {isNested ? <IconFolderNested className="h-[30px] w-[30px]" /> : <IconFolder className="h-[30px] w-[30px]" />}
                        </div>
                        <div className="px-3 py-2.5">
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
                            className="w-full rounded-md border border-ink px-2 py-1 text-[12.5px] outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {subfolders.map((folder) => {
                      const thumbId = folderThumbs[folder.id] ?? null;
                      return (
                        <div
                          key={folder.id}
                          draggable
                          onDragStart={(e) => handleFolderDragStart(e, folder)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverId(folder.id);
                          }}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={(e) => handleDropOnFolderTile(e, folder.id)}
                          onClick={() => openFolder(folder.id)}
                          title="Klick zum Öffnen — Bilder hierher ziehen zum Ablegen"
                          className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-white/70 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                            dragOverId === folder.id ? 'border-signal ring-2 ring-signal/40' : ''
                          }`}
                        >
                          <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <ShareFolderControl folderId={folder.id} folderName={folder.name} mediaShares={mediaShares} />
                            <button
                              type="button"
                              onClick={(e) => startRenameFolder(e, folder)}
                              title="Ordner umbenennen"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 shadow-sm ring-1 ring-line-strong backdrop-blur transition-colors hover:bg-panel hover:text-ink"
                            >
                              <IconEdit className="h-[13px] w-[13px]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder);
                              }}
                              title="Ordner löschen"
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 shadow-sm ring-1 ring-line-strong backdrop-blur transition-colors hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
                            >
                              <IconX className="h-[13px] w-[13px]" />
                            </button>
                          </div>

                          <div className="relative flex aspect-[5/3] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-panel to-panel/40 text-ink-2 transition-colors group-hover:from-signal/10 group-hover:to-signal/[0.03] group-hover:text-signal-deep">
                            {thumbId ? (
                              <>
                                {/* Vorschau über dieselbe Route wie die
                                    Bildkacheln -- sie prüft die
                                    Organisationszugehörigkeit, ein direkter
                                    Directus-Asset-Link täte das nicht. */}
                                <Image
                                  src={`/api/intern/library?original=${thumbId}&width=400&quality=70`}
                                  alt=""
                                  fill
                                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                  unoptimized
                                />
                                {/* Ordner-Plakette über dem Bild: Ohne sie
                                    wäre eine Ordnerkachel mit Vorschaubild
                                    von einem Foto kaum zu unterscheiden. */}
                                <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/85 text-ink-2 shadow-sm backdrop-blur">
                                  {isNested ? (
                                    <IconFolderNested className="h-[15px] w-[15px]" />
                                  ) : (
                                    <IconFolder className="h-[15px] w-[15px]" />
                                  )}
                                </span>
                                <span
                                  className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/20 to-transparent"
                                  aria-hidden="true"
                                />
                              </>
                            ) : isNested ? (
                              <IconFolderNested className="h-[30px] w-[30px]" />
                            ) : (
                              <IconFolder className="h-[30px] w-[30px]" />
                            )}
                          </div>

                          <div className="px-3 py-2.5">
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
                                className="w-full rounded-md border border-ink px-1.5 py-0.5 text-[12.5px] outline-none"
                              />
                            ) : (
                              <>
                                <span className="line-clamp-1 text-[13px] font-semibold text-ink">
                                  {folder.name}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-ink-3">
                                  {isNested ? 'Unterordner' : 'Ordner'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {items.length > 0 && (
              <section>
                {/* Die Auswahlleiste ersetzt die Überschrift, statt sich
                    zusätzlich darüberzulegen -- so springt beim ersten
                    markierten Bild nichts nach unten weg. */}
                {hasSelection ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-signal/30 bg-signal/[0.06] px-3 py-2">
                    <span className="text-[12.5px] font-semibold text-ink">
                      {selectionCount} {selectionCount === 1 ? 'Bild' : 'Bilder'} ausgewählt
                    </span>
                    <span className="hidden text-[11.5px] text-ink-2 sm:inline">
                      · zum Verschieben auf einen Ordner ziehen
                    </span>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {selectionCount < items.length && (
                        <button
                          type="button"
                          onClick={selectAll}
                          className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors hover:bg-white hover:text-ink"
                        >
                          Alle auswählen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors hover:bg-white hover:text-ink"
                      >
                        Aufheben
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMedia(selectedItems)}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-full bg-signal-deep px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
                      >
                        <IconTrash className="h-[13px] w-[13px]" />
                        Löschen
                      </button>
                    </div>
                  </div>
                ) : (
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    Bilder
                  </h2>
                )}

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 nav:grid-cols-3 xl:grid-cols-4">
                  {items.map((item, index) => {
                    const label = item.display_name || 'Bild';
                    const selected = selectedIds.has(item.id);
                    return (
                      <figure
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleMediaDragStart(e, item)}
                        className={`group relative flex flex-col overflow-hidden rounded-[16px] border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                          selected ? 'border-signal ring-2 ring-signal' : 'border-white/70'
                        }`}
                      >
                        {/* Auswahlkästchen dauerhaft sichtbar, sobald etwas
                            markiert ist -- ohne diese Regel wäre auf
                            Touch-Geräten gar keine Auswahl möglich. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item.id);
                            setAnchorIndex(index);
                          }}
                          aria-label={selected ? `${label} abwählen` : `${label} auswählen`}
                          aria-pressed={selected}
                          className={`absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-[7px] border transition-all ${
                            selected
                              ? 'border-signal bg-signal text-white'
                              : 'border-line-strong bg-white/90 text-transparent backdrop-blur hover:border-ink'
                          } ${hasSelection || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          <IconCheck className="h-[12px] w-[12px]" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMedia([item]);
                          }}
                          title="Bild löschen"
                          className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 opacity-0 shadow-sm ring-1 ring-line-strong backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
                        >
                          <IconX className="h-[13px] w-[13px]" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleTileClick(e, item, index)}
                          title={
                            hasSelection
                              ? 'Klick wählt aus — Strg/Cmd oder Shift für mehrere'
                              : 'Klick für Großansicht — Strg/Cmd-Klick zum Auswählen'
                          }
                          className="relative aspect-square w-full cursor-pointer overflow-hidden bg-panel"
                        >
                          <Image
                            src={`/api/intern/library?original=${item.id}&width=400&quality=72`}
                            alt=""
                            fill
                            className={`object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                              selected ? 'scale-[1.02]' : ''
                            }`}
                            unoptimized
                          />
                          {selected && <span className="absolute inset-0 bg-signal/15" aria-hidden="true" />}
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
