'use client';

import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createWatermarkedVariants } from '@/lib/watermark';
import AlarmCodeInput from '@/components/AlarmCodeInput';
import { directusAssetUrl } from '@/lib/directus';
import type { Alarmcode, MediaLibraryItem } from '@/lib/types';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_IMAGES = 12;
const NEW_FOLDER_VALUE = '__new__';

type FolderOption = {
  id: string;
  name: string;
  is_system_folder?: boolean;
  system_role?: 'public' | 'unsorted' | null;
};

type SelectedImage = {
  source: 'file' | 'library';
  file?: File;
  libraryId?: string;
  previewUrl: string;
  caption: string;
};

type PostMode = 'einsatz' | 'stockfoto';

export default function UploadStudio({
  watermarkText,
  existingTags,
  alarmcodes,
  folders,
  preselectedFolderId = null,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
  folders: FolderOption[];
  preselectedFolderId?: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [postMode, setPostMode] = useState<PostMode>('einsatz');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [alarmCode, setAlarmCode] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [folderChoice, setFolderChoice] = useState(preselectedFolderId ?? '');
  const [newFolderName, setNewFolderName] = useState('');
  const [makePublic, setMakePublic] = useState(true);
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) { setError(`"${tooBig.name}" ist größer als 80 MB.`); return; }
    const newImages: SelectedImage[] = files.map((f) => ({
      source: 'file', file: f, previewUrl: URL.createObjectURL(f), caption: '',
    }));
    setSelectedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    if (e.target) e.target.value = '';
    setError(null);
  }

  function removeSelected(index: number) {
    setSelectedImages((prev) => {
      const copy = [...prev];
      if (copy[index].source === 'file' && copy[index].previewUrl) URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }

  function addTag(v: string) {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedImages.length === 0) { setError('Bitte mindestens ein Foto auswählen.'); return; }
    if (!contentConfirmed) { setError('Bitte die Bestätigung ankreuzen.'); return; }
    if (postMode === 'einsatz' && (!title.trim() || !location.trim() || !alarmCode.trim() || !eventDate)) {
      setError('Bitte Titel, Ort, Alarmcode und Datum ausfüllen.'); return;
    }
    if (folderChoice === NEW_FOLDER_VALUE && !newFolderName.trim()) {
      setError('Bitte einen Ordnernamen eingeben.'); return;
    }
    setStatus('working');
    try {
      let targetFolderId = folderChoice === NEW_FOLDER_VALUE ? '' : folderChoice;
      if (folderChoice === NEW_FOLDER_VALUE) {
        setProgress('Ordner wird angelegt …');
        const r = await fetch('/api/intern/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName.trim() }) });
        if (!r.ok) throw new Error('Ordner konnte nicht angelegt werden.');
        targetFolderId = (await r.json()).id;
      }
      const formData = new FormData();
      formData.append('post_type', postMode);
      formData.append('tags', tags.join(','));
      formData.append('make_public', String(makePublic));
      formData.append('folder_id', targetFolderId);
      formData.append('content_confirmed', 'true');
      formData.append('image_count', String(selectedImages.length));
      if (postMode === 'einsatz') {
        formData.append('title', title);
        formData.append('event_date', eventDate);
        formData.append('alarm_code', alarmCode);
        formData.append('location', location);
      }
      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        if (img.source === 'file' && img.file) {
          setProgress(`Wasserzeichen ${i + 1}/${selectedImages.length} …`);
          const originalBuffer = await img.file.arrayBuffer();
          const originalBlob = new Blob([originalBuffer], { type: img.file.type });
          const { preview, download } = await createWatermarkedVariants(img.file, watermarkText);
          formData.append(`original_${i}`, originalBlob, img.file.name);
          formData.append(`preview_${i}`, preview, `prev-${img.file.name}.jpg`);
          formData.append(`download_${i}`, download, `dl-${img.file.name}.jpg`);
          formData.append(`caption_${i}`, img.caption);
        }
      }
      setProgress('Wird hochgeladen …');
      const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Upload fehlgeschlagen.'); }
      selectedImages.forEach((img) => { if (img.source === 'file' && img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
      setSelectedImages([]); setTitle(''); setEventDate(''); setAlarmCode(''); setLocation(''); setTags([]);
      setMakePublic(false); setContentConfirmed(false); setFolderChoice(preselectedFolderId ?? '');
      if (preselectedFolderId) { router.push(`/intern/ordner/${preselectedFolderId}`); router.refresh(); return; }
      setStatus('done'); setProgress(''); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
      setStatus('error'); setProgress('');
    }
  }

  const inp = 'w-full rounded border border-line-strong bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink';
  const lbl = 'mb-1 block text-[11.5px] font-medium text-ink-2';
  const selectableFolders = folders.filter((f) => !f.is_system_folder);

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-circle-check mb-2 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-1 font-display text-[20px] font-bold">Hochgeladen</h2>
        <p className="text-[13px] text-ink-2">{makePublic ? 'Beitrag ist jetzt öffentlich.' : 'Als Entwurf gespeichert.'}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">

      {/* ── Modus-Umschalter ── */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-ink-2">Typ:</span>
        <div className="flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
          {(['einsatz', 'stockfoto'] as PostMode[]).map((mode) => (
            <button key={mode} type="button" onClick={() => setPostMode(mode)}
              className={`rounded px-3 py-1 text-[12px] font-semibold transition-colors ${postMode === mode ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
              {mode === 'einsatz' ? 'Einsatz' : 'Stockfoto'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bildauswahl ── */}
      <div className="rounded-[10px] border border-line bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink-2">Fotos</span>
          <span className="text-[11px] text-ink-3">{selectedImages.length}/{MAX_IMAGES} gewählt</span>
        </div>

        {/* Ausgewählte Thumbnails */}
        {selectedImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedImages.map((img, i) => (
              <div key={i} className="relative h-10 w-10 flex-shrink-0">
                {img.previewUrl ? (
                  <Image src={img.previewUrl} alt="" fill className="rounded object-cover border border-line" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded bg-panel border border-line">
                    <i className="ti ti-photo text-[14px] text-ink-3" aria-hidden="true" />
                  </div>
                )}
                <button type="button" onClick={() => removeSelected(i)} aria-label="Entfernen"
                  className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[8px] text-white">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Upload-Button */}
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-line-strong py-2.5 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink">
          <i className="ti ti-cloud-upload text-[16px]" aria-hidden="true" />
          Fotos auswählen oder hierher ziehen
        </button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileInput} className="hidden" />
      </div>

      {/* ── Einsatzdaten ── */}
      {postMode === 'einsatz' && (
        <div className="rounded-[10px] border border-line bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Einsatzdaten</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={lbl}>Datum *</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Alarmcode *</label>
              <AlarmCodeInput value={alarmCode} onChange={setAlarmCode} alarmcodes={alarmcodes} />
            </div>
          </div>
          <div className="mb-2">
            <label className={lbl}>Titel *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="Zimmerbrand Hauptstraße" />
          </div>
          <div>
            <label className={lbl}>Ort *</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inp} placeholder="Musterstadt" />
          </div>
        </div>
      )}

      {/* ── Tags + Ordner + Optionen ── */}
      <div className="rounded-[10px] border border-line bg-white p-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Tags */}
          <div>
            <label className={lbl}>Tags</label>
            <div className="flex flex-wrap gap-1 rounded border border-line-strong bg-white px-2 py-1 min-h-[32px] cursor-text"
              onClick={() => document.getElementById('tag-input')?.focus()}>
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 rounded-[3px] bg-panel border border-line-strong px-1.5 text-[11px]">
                  {tag}
                  <button type="button" onClick={() => setTags((p) => p.filter((t) => t !== tag))} className="text-ink-3 hover:text-ink leading-none ml-0.5">×</button>
                </span>
              ))}
              <input id="tag-input" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tags.length === 0 ? 'Tags …' : ''}
                list="tag-suggestions"
                className="flex-1 min-w-[60px] bg-transparent text-[12px] outline-none" />
              <datalist id="tag-suggestions">
                {existingTags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          {/* Ordner */}
          <div>
            <label className={lbl}>Ordner</label>
            <select value={folderChoice} onChange={(e) => setFolderChoice(e.target.value)} className={inp}>
              <option value="">Unsortiert</option>
              {selectableFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value={NEW_FOLDER_VALUE}>+ Neuen Ordner …</option>
            </select>
            {folderChoice === NEW_FOLDER_VALUE && (
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ordnername" className={`${inp} mt-1`} />
            )}
          </div>
        </div>

        {/* Bestätigung + Toggle */}
        <div className="flex flex-col gap-2 border-t border-line pt-2">
          <label className="flex cursor-pointer items-start gap-1.5 text-[11.5px] text-ink-2">
            <input type="checkbox" checked={contentConfirmed} onChange={(e) => setContentConfirmed(e.target.checked)} className="mt-0.5 flex-shrink-0" />
            <span>Ich bestätige die Berechtigung zur Veröffentlichung. *</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <div onClick={() => setMakePublic((v) => !v)}
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${makePublic ? 'bg-ink' : 'bg-line-strong'}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${makePublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-[12px] font-medium">{makePublic ? 'Direkt öffentlich' : 'Als Entwurf'}</span>
          </label>
        </div>
      </div>

      {/* ── Fehler / Fortschritt / Submit ── */}
      {error && <p className="text-[12px] text-signal-deep">{error}</p>}
      {progress && <p className="text-[12px] text-ink-2">{progress}</p>}

      <button type="submit" disabled={status === 'working'}
        className="w-full rounded-md bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60">
        {status === 'working' ? 'Wird verarbeitet …' : (
          <>
            <i className="ti ti-upload mr-2 text-[14px]" aria-hidden="true" />
            {selectedImages.length > 0 ? `${selectedImages.length} Foto${selectedImages.length === 1 ? '' : 's'} hochladen` : 'Hochladen'}
          </>
        )}
      </button>
    </form>
  );
}
