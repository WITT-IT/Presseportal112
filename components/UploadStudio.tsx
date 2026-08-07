'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createWatermarkedVariants } from '@/lib/watermark';
import AlarmCodeInput from '@/components/AlarmCodeInput';
import { normalizeTags } from '@/lib/types';
import type { Alarmcode } from '@/lib/types';

type PostMode = 'einsatz' | 'stockfoto';

type SourceMedia = {
  id: string;
  file: string;
  file_preview_watermarked: string | null;
  file_download_watermarked: string | null;
  display_name: string | null;
  tags: string[] | null;
};

type ExistingPost = {
  id: string;
  post_type: PostMode;
  title: string | null;
  event_date: string | null;
  alarm_code: string | null;
  location: string | null;
  tags: string[];
  is_public: boolean;
  caption: string | null;
  thumbnailUrl: string | null;
};

export default function UploadStudio({
  watermarkText,
  existingTags,
  alarmcodes,
  sourceMedia,
  existingPost,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
  sourceMedia?: SourceMedia;
  existingPost?: ExistingPost;
}) {
  const router = useRouter();
  const isEditMode = !!existingPost;

  const [postMode, setPostMode] = useState<PostMode>(existingPost?.post_type ?? 'einsatz');
  const [title, setTitle] = useState(existingPost?.title ?? '');
  const [eventDate, setEventDate] = useState(existingPost?.event_date?.slice(0, 10) ?? '');
  const [alarmCode, setAlarmCode] = useState(existingPost?.alarm_code ?? '');
  const [location, setLocation] = useState(existingPost?.location ?? '');
  // normalizeTags hier nochmal defensiv drüberlaufen lassen, unabhängig
  // davon ob der Aufrufer schon normalisiert hat -- Directus liefert tags
  // je nach Alter des Datensatzes mal als Array, mal als JSON-String.
  // normalizeTags ist idempotent: ein sauberes Array kommt unverändert
  // wieder raus, ein String wird geparst.
  const [tags, setTags] = useState<string[]>(
    normalizeTags(existingPost ? existingPost.tags : sourceMedia?.tags ?? [])
  );
  const [tagInput, setTagInput] = useState('');
  const [caption, setCaption] = useState(existingPost?.caption ?? '');
  const [isPublic, setIsPublic] = useState(existingPost?.is_public ?? true);
  const [contentConfirmed, setContentConfirmed] = useState(isEditMode);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [toggleWorking, setToggleWorking] = useState(false);

  function addTag(v: string) {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleTogglePublic() {
    if (!existingPost) return;
    setToggleWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/intern/posts/toggle-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: existingPost.id, makePublic: !isPublic }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || 'Statuswechsel fehlgeschlagen.');
      setIsPublic(!isPublic);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Statuswechsel fehlgeschlagen.');
    } finally {
      setToggleWorking(false);
    }
  }

  async function confirmDelete() {
    if (!existingPost || deleteWorking) return;
    setDeleteWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/intern/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existingPost.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) throw new Error(body.error || 'Löschen fehlgeschlagen.');
      router.push('/intern');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
      setDeleteWorking(false);
      setShowDeleteDialog(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!contentConfirmed) {
      setError('Bitte die Bestätigung ankreuzen.');
      return;
    }
    if (postMode === 'einsatz' && (!title.trim() || !location.trim() || !alarmCode.trim() || !eventDate)) {
      setError('Bitte Titel, Ort, Alarmcode und Datum ausfüllen.');
      return;
    }

    setStatus('working');

    try {
      if (isEditMode && existingPost) {
        setProgress('Wird gespeichert …');
        const res = await fetch('/api/intern/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingPost.id,
            post_type: postMode,
            title: postMode === 'einsatz' ? title : null,
            event_date: postMode === 'einsatz' ? eventDate : null,
            alarm_code: postMode === 'einsatz' ? alarmCode : null,
            location: postMode === 'einsatz' ? location : null,
            tags,
            caption,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) throw new Error(body.error || 'Speichern fehlgeschlagen.');
      } else if (sourceMedia) {
        const formData = new FormData();
        formData.append('source_media_id', sourceMedia.id);
        formData.append('post_type', postMode);
        formData.append('tags', tags.join(','));
        formData.append('make_public', 'true');
        formData.append('content_confirmed', 'true');
        formData.append('caption', caption);
        if (postMode === 'einsatz') {
          formData.append('title', title);
          formData.append('event_date', eventDate);
          formData.append('alarm_code', alarmCode);
          formData.append('location', location);
        }

        const hasCached = !!(sourceMedia.file_preview_watermarked && sourceMedia.file_download_watermarked);
        if (!hasCached) {
          setProgress('Wasserzeichen wird erzeugt …');
          const assetRes = await fetch(`/api/intern/library?original=${sourceMedia.id}`);
          if (!assetRes.ok) throw new Error('Originalbild konnte nicht geladen werden.');
          const blob = await assetRes.blob();
          const file = new File([blob], sourceMedia.display_name || 'bild.jpg', { type: blob.type || 'image/jpeg' });
          const { preview, download } = await createWatermarkedVariants(file, watermarkText);
          formData.append('preview_0', preview, 'preview.jpg');
          formData.append('download_0', download, 'download.jpg');
        } else {
          formData.append('use_cached_watermark', 'true');
        }

        setProgress('Wird veröffentlicht …');
        const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) throw new Error(body.error || 'Veröffentlichen fehlgeschlagen.');
      }

      setStatus('done');
      setProgress('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  const inp = 'w-full rounded border border-line-strong bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink';
  const lbl = 'mb-1 block text-[11.5px] font-medium text-ink-2';
  const label = isEditMode
    ? existingPost?.title || existingPost?.alarm_code || 'Stockfoto'
    : sourceMedia?.display_name || 'Bild';
  const thumbnailSrc = isEditMode
    ? existingPost?.thumbnailUrl
    : sourceMedia
    ? `/api/intern/library?original=${sourceMedia.id}&width=160&quality=70`
    : null;

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <h2 className="mb-1 font-display text-[20px] font-bold">
          {isEditMode ? 'Gespeichert' : 'Veröffentlicht'}
        </h2>
        <p className="mb-4 text-[13px] text-ink-2">
          {isEditMode ? 'Änderungen wurden übernommen.' : 'Beitrag ist jetzt öffentlich sichtbar.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/intern')}
          className="rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
        >
          Zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Bild-Header -- nur Anzeige */}
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white p-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-panel">
          {thumbnailSrc && <Image src={thumbnailSrc} alt="" fill className="object-cover" unoptimized />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{label}</p>
          <p className="text-[11.5px] text-ink-2">
            {isEditMode ? 'Bestehender Beitrag' : 'Aus der Medienbibliothek'}
          </p>
        </div>
      </div>

      {/* Modus-Umschalter */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-ink-2">Typ:</span>
        <div className="flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
          {(['einsatz', 'stockfoto'] as PostMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPostMode(mode)}
              className={`rounded px-3 py-1 text-[12px] font-semibold transition-colors ${
                postMode === mode ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {mode === 'einsatz' ? 'Einsatz' : 'Stockfoto'}
            </button>
          ))}
        </div>
      </div>

      {postMode === 'einsatz' && (
        <div className="rounded-[10px] border border-line bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Einsatzdaten</p>
          <div className="mb-2 grid grid-cols-2 gap-2">
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
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inp}
              placeholder="Zimmerbrand Hauptstraße"
            />
          </div>
          <div>
            <label className={lbl}>Ort *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inp}
              placeholder="Musterstadt"
            />
          </div>
        </div>
      )}

      <div className="rounded-[10px] border border-line bg-white p-3">
        <label className={lbl}>Bildunterschrift</label>
        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} className={inp} />
      </div>

      <div className="rounded-[10px] border border-line bg-white p-3">
        <label className={lbl}>Tags</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-[4px] bg-panel px-2 py-1 text-[11.5px] font-medium text-ink-2"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-ink-3 hover:text-signal-deep">
                ✕
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          onBlur={() => addTag(tagInput)}
          list="tag-suggestions"
          placeholder="Tag eingeben, Enter zum Hinzufügen"
          className={inp}
        />
        <datalist id="tag-suggestions">
          {existingTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>

      {!isEditMode && (
        <div className="flex items-center justify-between rounded-[10px] border border-line bg-white p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={contentConfirmed}
              onChange={(e) => setContentConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-[12px] font-medium text-ink-2">
              Ich bestätige, dass ich die Rechte an diesem Bild habe *
            </span>
          </label>
        </div>
      )}

      {error && <p className="text-[12px] text-signal-deep">{error}</p>}
      {progress && <p className="text-[12px] text-ink-2">{progress}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={status === 'working'}
          className="w-full rounded-md bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
        >
          {status === 'working' ? 'Wird verarbeitet …' : isEditMode ? 'Speichern' : 'Veröffentlichen'}
        </button>

        {isEditMode && existingPost && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTogglePublic}
              disabled={toggleWorking}
              className="rounded-md border border-line-strong bg-panel px-4 py-2 text-[12px] font-semibold text-ink hover:bg-line disabled:opacity-50"
            >
              {toggleWorking ? 'Wird geändert …' : isPublic ? 'Öffentlich geschaltet' : 'Privat geschaltet'}
           <button
  type="button"
  role="switch"
  aria-checked={isPublic}
  aria-label="Sichtbarkeit umschalten"
  onClick={handleTogglePublic}
  disabled={toggleWorking}
  className={`inline-flex items-center gap-3 rounded-md border px-4 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
    isPublic
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : 'border-line-strong bg-panel text-ink hover:bg-line'
  }`}
>
  <span>{toggleWorking ? 'Wird geändert …' : isPublic ? 'Öffentlich' : 'Privat'}</span>

  <span
    aria-hidden="true"
    className={`relative h-6 w-11 rounded-full transition-colors ${
      isPublic ? 'bg-emerald-500' : 'bg-ink-3'
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        isPublic ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </span>
</button>
          </div>
        )}
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-[10px] border border-line bg-white p-4">
            <h3 className="mb-2 font-display text-[18px] font-bold">Beitrag löschen?</h3>
            <p className="mb-4 text-[13px] text-ink-2">
              Der Beitrag wird entfernt. Das Originalfoto bleibt in der Medienbibliothek erhalten.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteWorking}
                className="flex-1 rounded-md bg-signal-deep px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {deleteWorking ? 'Wird gelöscht …' : 'Endgültig löschen'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteWorking}
                className="flex-1 rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-60"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
