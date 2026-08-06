'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { useDialog } from './DialogProvider';

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}
function IconSend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export default function MediaBrowser({
  currentFolderId,
  parentFolderId,
  subfolders,
  items,
}: {
  currentFolderId: string | null;
  parentFolderId: string | null;
  subfolders: SubFolder[];
  items: MediaItem[];
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<(DragPayload & { value: string }) | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handleGridDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDraggingFiles(true);
  }
  function handleGridDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer.files?.length) uploadFiles(Array.from(e.dataTransfer.files), currentFolderId);
  }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) { setCreatingFolder(false); return; }
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
    if (!value) { setRenaming(null); return; }
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

    if (e.dataTransfer.files?.length) {
      uploadFiles(Array.from(e.dataTransfer.files), targetId);
      return;
    }
    const raw = e.dataTransfer.getData('application/x-media-item');
    if (raw) moveItem(JSON.parse(raw), targetId);
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
        if (selectedMediaId === target.id) setSelectedMediaId(null);
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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <IconUpload className="h-[15px] w-[15px]" />
          Hochladen
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handleFileInputChange} />

        <button
          type="button"
          onClick={() => setCreatingFolder(true)}
          disabled={busy}
          className="flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
        >
          <IconFolderPlus className="h-[15px] w-[15px]" />
          Neuer Ordner
        </button>

        {selectedMediaId && (
          <button
            type="button"
            onClick={() => router.push(`/intern/upload?mediaId=${selectedMediaId}`)}
            className="ml-auto flex items-center gap-2 rounded-md bg-signal-deep px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
          >
            <IconSend className="h-[15px] w-[15px]" />
            Veröffentlichen
          </button>
        )}
      </div>

      <p className="mb-4 text-[11.5px] text-ink-3">
        Tipp: Bilder direkt auf einen Ordner ziehen, um sie ohne Umweg dort abzulegen.
      </p>

      {error && (
        <p className="mb-4 rounded-md border border-signal-deep/30 bg-signal-deep/5 px-3 py-2 text-[12.5px] text-signal-deep">
          {error}
        </p>
      )}

      <div
        onDragOver={handleGridDragOver}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={handleGridDrop}
        className={`grid grid-cols-3 gap-5 rounded-xl p-3 transition-colors nav:grid-cols-5 xl:grid-cols-6 ${
          isDraggingFiles ? 'bg-panel outline-dashed outline-2 outline-ink' : ''
        }`}
      >
        {currentFolderId && (
          <button
            type="button"
            onClick={() => openFolder(parentFolderId)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId('ROOT'); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => handleDropOnFolderTile(e, parentFolderId)}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center text-ink-3 transition-colors hover:bg-panel ${
              dragOverId === 'ROOT' ? 'bg-panel outline outline-2 outline-ink' : ''
            }`}
          >
            <div className="flex h-[92px] w-[92px] items-center justify-center rounded-2xl bg-panel">
              <IconBack className="h-[32px] w-[32px]" />
            </div>
            <span className="text-[12px] font-medium text-ink-2">Zurück</span>
          </button>
        )}

        {creatingFolder && (
          <div className="flex flex-col items-center gap-2 rounded-xl p-3 text-center">
            <div className="flex h-[92px] w-[92px] items-center justify-center rounded-2xl bg-panel text-ink-2">
              <IconFolder className="h-[40px] w-[40px]" />
            </div>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') setCreatingFolder(false); }}
              onBlur={submitNewFolder}
              placeholder="Ordnername"
              className="w-full rounded-md border border-ink px-2 py-1 text-center text-[12px] outline-none"
            />
          </div>
        )}

        {subfolders.map((folder) => (
          <div
            key={folder.id}
            draggable
            onDragStart={(e) => handleDragStart(e, { id: folder.id, type: 'folder' })}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(folder.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => handleDropOnFolderTile(e, folder.id)}
            onClick={() => openFolder(folder.id)}
            title="Klick zum Öffnen — Bilder hierher ziehen zum Ablegen"
            className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-panel ${
              dragOverId === folder.id ? 'bg-panel outline outline-2 outline-ink' : ''
            }`}
          >
            <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => startRenameFolder(e, folder)}
                title="Ordner umbenennen"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-line-strong hover:bg-panel hover:text-ink"
              >
                <IconEdit className="h-[12px] w-[12px]" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteItem({ id: folder.id, type: 'folder' }, folder.name); }}
                title="Ordner löschen"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-line-strong hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
              >
                <IconX className="h-[12px] w-[12px]" />
              </button>
            </div>

            <div className="flex h-[92px] w-[92px] items-center justify-center rounded-2xl bg-panel text-ink-2">
              <IconFolder className="h-[40px] w-[40px]" />
            </div>
            {renaming?.id === folder.id ? (
              <input
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
                onBlur={submitRename}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-md border border-ink px-1.5 py-0.5 text-center text-[12px] outline-none"
              />
            ) : (
              <span className="line-clamp-2 text-[12px] font-medium text-ink">{folder.name}</span>
            )}
          </div>
        ))}

        {items.map((item) => {
          const label = item.display_name || 'Bild';
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, { id: item.id, type: 'media' })}
              onClick={() => setSelectedMediaId(item.id)}
              className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-panel ${
                selectedMediaId === item.id ? 'bg-panel outline outline-2 outline-ink' : ''
              }`}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteItem({ id: item.id, type: 'media' }, label); }}
                title="Bild löschen"
                className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-2 opacity-0 shadow-sm ring-1 ring-line-strong transition-opacity group-hover:opacity-100 hover:bg-signal-deep hover:text-white hover:ring-signal-deep"
              >
                <IconX className="h-[12px] w-[12px]" />
              </button>

              <div className="relative h-[92px] w-[92px] overflow-hidden rounded-2xl bg-panel">
                <Image
                  src={directusAssetUrl(item.file_preview || item.file, 'width=200&quality=70')}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
              {renaming?.id === item.id ? (
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
                  onBlur={submitRename}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-md border border-ink px-1.5 py-0.5 text-center text-[12px] outline-none"
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); setRenaming({ id: item.id, type: 'media', value: label }); }}
                  className="line-clamp-2 text-[12px] font-medium text-ink"
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}

        {subfolders.length === 0 && items.length === 0 && !creatingFolder && (
          <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center text-ink-3">
            <IconPhotoPlus className="h-[36px] w-[36px]" />
            <p className="text-[13px] text-ink-2">
              Noch leer — zieh Bilder hierher oder klick auf „Hochladen".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
