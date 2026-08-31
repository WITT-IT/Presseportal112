'use client';

import { getStorageStatus } from '@/lib/storage';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDialog } from './DialogProvider';
import PostCalendar from './PostCalendar';
import ShareFolderControl from './ShareFolderControl';
import MediaLightbox from './MediaLightbox';
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
function IconFolder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
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
  breadcrumb = [],
  subfolders,
  items,
  calendarPosts,
  mediaShares,
  storageStatus,
}: {
  currentFolderId: string | null;
  parentFolderId: string | null;
  // Pfad von der Wurzel bis zum aktuellen Ordner (Wurzel selbst nicht
  // enthalten). Leeres Array = wir stehen auf "Alle Medien".
  breadcrumb?: { id: string; name: string }[];
  subfolders: SubFolder[];
  items: MediaItem[];
  calendarPosts: Post[];
  mediaShares: { id: string; name: string }[];
  // Optional gehalten -- falls eine Aufrufstelle (noch) keine Speicherdaten
  // mitgibt, verhält sich der Upload-Button wie bisher (immer aktiv). So
  // bricht nichts, falls MediaBrowser noch von woanders ohne diese Prop
  // verwendet wird.
  storageStatus?: { usedBytes: number; limitBytes: number };
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<(DragPayload & { value: string }) | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vorab-Check fürs UI -- verhindert, dass jemand erst die Dateiauswahl
  // öffnet und Dateien wählt, nur um dann eine Fehlermeldung vom Server zu
  // bekommen. Der eigentliche, verbindliche Check bleibt serverseitig in
  // app/api/intern/library/route.ts (POST) -- das hier ist reine UX,
  // niemals der einzige Schutz.
  const isAtLimit = storageStatus ? getStorageStatus(storageStatus.usedBytes, storageStatus.limitBytes).isAtLimit : false;

  function openFolder(id: string | null) {
    router.push(id ? `/intern/medien?folder=${id}` : '/intern/medien');
  }

  async function uploadFiles(files: File[], targetFolderId: string | null) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      if (targetFolderId) formData.append('folder', targetFolderId);
      formData.append('image_count', String(files.length));
      files.forEach((file, i) => formData.append(`file_${i}`, file, file.name));

      const res = await fetch('/api/intern/library', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
      }
      if (body.errors?.length) {
        setError(`Teilweise fehlgeschlagen: ${body.errors.join(' | ')}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    uploadFiles(Array.from(e.target.files ?? []), currentFolderId);
    e.target.value = '';
  }

  function isInternalDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('application/x-media-item');
  }

  function handleGridDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!isInternalDrag(e) && e.dataTransfer.types.includes('Files')) {
      setIsDraggingFiles(true);
    }
  }
  function handleGridDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (isInternalDrag(e)) return;
    if (isAtLimit) {
      setError('Speicherlimit erreicht — bitte zuerst Speicherplatz freigeben oder Stufe upgraden.');
      return;
    }
    if (e.dataTransfer.files?.length) uploadFiles(Array.from(e.dataTransfer.files), currentFolderId);
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

    const raw = e.dataTransfer.getData('application/x-media-item');
    if (raw) {
      moveItem(JSON.parse(raw), targetId);
      return;
    }
    if (e.dataTransfer.files?.length) {
      uploadFiles(Array.from(e.dataTransfer.files), targetId);
    }
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
    <div className="flex flex-col gap-6 nav:flex-row nav:items-start">
      <div className="min-w-0 flex-1">
        {/* Aktionsleiste im Karten-Look statt nackter Buttons -- eine
            durchgehende weiche Fläche, wie die Suchleiste im Bildarchiv. */}
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/70 bg-white/85 p-3 shadow-raised backdrop-blur transition-colors ${
            isDraggingFiles ? 'outline outline-2 outline-dashed outline-signal' : ''
          }`}
          onDragOver={handleGridDragOver}
          onDragLeave={() => setIsDraggingFiles(false)}
          onDrop={handleGridDrop}
        >
          <p className="pl-2 text-[12px] leading-[1.5] text-ink-2">
            {isAtLimit ? (
              <span className="font-medium text-signal-deep">
                Speicherlimit erreicht — neue Uploads sind aktuell nicht möglich.
              </span>
            ) : (
              <>
                Bilder direkt auf einen Ordner ziehen, um sie dort abzulegen.
                <br className="hidden nav:block" /> Klick auf ein Bild öffnet die Großansicht.
              </>
            )}
          </p>
          <div className="flex flex-none gap-2">
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              disabled={busy}
              className="flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              <IconFolderPlus className="h-[15px] w-[15px]" />
              Neuer Ordner
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || isAtLimit}
              title={isAtLimit ? 'Speicherlimit erreicht — bitte zuerst Speicherplatz freigeben oder Stufe upgraden.' : undefined}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconUpload className="h-[15px] w-[15px]" />
              {isAtLimit ? 'Speicher voll' : 'Hochladen'}
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handleFileInputChange} />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-signal-deep/30 bg-signal-deep/5 px-3 py-2 text-[12.5px] text-signal-deep">
            {error}
          </p>
        )}

        {/* Navigationszeile: Zurück-Pille + Ordnerpfad auf einer Grundlinie,
            direkt über dem Raster. Beides erscheint nur innerhalb eines
            Ordners -- auf "Alle Medien" gibt es weder etwas zurückzugehen
            noch einen Pfad zu zeigen, und die Zeile entfällt komplett.

            Der Pfad ist bewusst rahmenlos: er ist Orientierung, keine
            Bedienfläche. Nur die Pille bekommt eine sichtbare Kontur, weil
            sie die einzige echte Aktion in der Zeile ist. Die Trennung
            zwischen beiden übernimmt ein zarter vertikaler Strich statt
            eines Abstands, damit die Zeile trotz zweier Funktionen als eine
            Einheit liest.

            Der letzte Eintrag ist der aktuelle Ordner und deshalb kein
            Button -- ein Link auf die Seite, auf der man steht, ist eine
            tote Interaktion. */}
        {currentFolderId && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 pl-2">
            <button
              type="button"
              onClick={() => openFolder(parentFolderId)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId('ROOT');
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDropOnFolderTile(e, parentFolderId)}
              title="Eine Ebene höher — Bilder oder Ordner hierher ziehen zum Verschieben"
              className={`inline-flex flex-none items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 shadow-sm transition-colors hover:border-ink hover:text-ink ${
                dragOverId === 'ROOT' ? 'border-signal bg-signal/5 text-signal-deep' : ''
              }`}
            >
              <IconBack className="h-[14px] w-[14px]" />
              Zurück
            </button>

            <span className="h-5 w-px flex-none bg-line" aria-hidden="true" />

            <nav
              aria-label="Ordnerpfad"
              className="flex min-w-0 flex-wrap items-center gap-1 text-[12.5px]"
            >
              <button
                type="button"
                onClick={() => openFolder(null)}
                className="rounded font-medium text-ink-3 transition-colors hover:text-ink"
              >
                Alle Medien
              </button>
              {breadcrumb.map((crumb, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                    <IconChevron className="h-[12px] w-[12px] flex-none text-ink-3/60" />
                    {isLast ? (
                      <span className="truncate font-semibold text-ink">{crumb.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFolder(crumb.id)}
                        className="truncate rounded font-medium text-ink-3 transition-colors hover:text-ink"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>
        )}

        <div
          onDragOver={handleGridDragOver}
          onDragLeave={() => setIsDraggingFiles(false)}
          onDrop={handleGridDrop}
          className={`grid grid-cols-2 gap-4 rounded-[20px] p-2 transition-colors sm:grid-cols-3 nav:grid-cols-3 xl:grid-cols-4 ${
            isDraggingFiles ? 'bg-white/60 outline-dashed outline-2 outline-signal' : ''
          }`}
        >
          {creatingFolder && (
            <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-signal/40 bg-white p-4 text-center shadow-card">
              <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-b from-panel to-panel/40 text-ink-2">
                <IconFolder className="h-[34px] w-[34px]" />
              </div>
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
                className="w-full rounded-md border border-ink px-2 py-1 text-center text-[12.5px] outline-none"
              />
            </div>
          )}

          {/* Ordner: warmer Verlauf statt flacher grauer Box -- sollen sich
              als "Orte" anfühlen, die man betritt, nicht als UI-Elemente. */}
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
              className={`group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-[20px] border border-white/70 bg-white p-4 text-center shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                dragOverId === folder.id ? 'outline outline-2 outline-signal' : ''
              }`}
            >
              <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <ShareFolderControl folderId={folder.id} folderName={folder.name} mediaShares={mediaShares} />
                <button
                  type="button"
                  onClick={(e) => startRenameFolder(e, folder)}
                  title="Ordner umbenennen"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-line-strong hover:bg-panel hover:text-ink"
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
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-line-strong hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
                >
                  <IconX className="h-[13px] w-[13px]" />
                </button>
              </div>

              <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-b from-panel to-panel/40 text-ink-2 transition-colors group-hover:from-signal/10 group-hover:to-signal/[0.03] group-hover:text-signal-deep">
                <IconFolder className="h-[34px] w-[34px]" />
              </div>
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
                  className="w-full rounded-md border border-ink px-1.5 py-0.5 text-center text-[12.5px] outline-none"
                />
              ) : (
                <span className="line-clamp-2 text-[12.5px] font-semibold text-ink">{folder.name}</span>
              )}
            </div>
          ))}

          {/* Bilder: echte großformatige Vorschau statt kleiner 92px-Box --
              gleiches Kachelmaß wie Ordner, damit das Grid ruhig bleibt. */}
          {items.map((item) => {
            const label = item.display_name || 'Bild';
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, { id: item.id, type: 'media' })}
                className="group relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] border border-white/70 bg-white p-2 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem({ id: item.id, type: 'media' }, label);
                  }}
                  title="Bild löschen"
                  className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 opacity-0 shadow-sm ring-1 ring-line-strong backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
                >
                  <IconX className="h-[13px] w-[13px]" />
                </button>

                <button
                  type="button"
                  onClick={() => setLightboxId(item.id)}
                  title="Klick für Großansicht"
                  className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl bg-panel"
                >
                  <Image
                    src={`/api/intern/library?original=${item.id}&width=400&quality=72`}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    unoptimized
                  />
                </button>
                <div className="px-1.5 pb-1">
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
                </div>
              </div>
            );
          })}

          {subfolders.length === 0 && items.length === 0 && !creatingFolder && (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-line-strong bg-white/70 px-6 py-16 text-center shadow-sm">
              <IconPhotoPlus className="h-[36px] w-[36px] text-ink-3" />
              <p className="text-[13px] text-ink-2">
                Noch leer — zieh Bilder hierher oder klick auf „Hochladen".
              </p>
            </div>
          )}
        </div>
      </div>

      <aside className="w-full flex-none nav:sticky nav:top-6 nav:w-[300px]">
        <PostCalendar posts={calendarPosts} />
      </aside>

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
