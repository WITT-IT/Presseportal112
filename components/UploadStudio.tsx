'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createWatermarkedVariants } from '@/lib/watermark';
import AlarmCodeInput from '@/components/AlarmCodeInput';
import { normalizeTags } from '@/lib/types';
import type { Alarmcode } from '@/lib/types';

type SourceMedia = {
  id: string;
  file: string;
  file_preview: string | null;
  file_preview_watermarked: string | null;
  file_download_watermarked: string | null;
  display_name: string | null;
  tags: string[] | null;
};

type PostMode = 'einsatz' | 'stockfoto';

export default function UploadStudio({
  watermarkText,
  existingTags,
  alarmcodes,
  sourceMedia,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
  sourceMedia: SourceMedia;
}) {
  const router = useRouter();

  const [postMode, setPostMode] = useState<PostMode>('einsatz');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [alarmCode, setAlarmCode] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>(normalizeTags(sourceMedia.tags));
  const [tagInput, setTagInput] = useState('');
  const [caption, setCaption] = useState('');
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addTag(v: string) {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
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
      const formData = new FormData();
      formData.append('source_media_id', sourceMedia.id);
      formData.append('post_type', postMode);
      formData.append('tags', tags.join(','));
      // Wer hier ist, hat aktiv aus der Bibliothek gewählt und will
      // veröffentlichen -- kein Entwurfs-Zwischenzustand mehr.
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
      if (!res.ok || body.error) {
        throw new Error(body.error || 'Veröffentlichen fehlgeschlagen.');
      }

      setStatus('done');
      setProgress('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veröffentlichen fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  const inp = 'w-full rounded border border-line-strong bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink';
  const lbl = 'mb-1 block text-[11.5px] font-medium text-ink-2';
  const label = sourceMedia.display_name || 'Bild';

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <h2 className="mb-1 font-display text-[20px] font-bold">Veröffentlicht</h2>
        <p className="mb-4 text-[13px] text-ink-2">Beitrag ist jetzt öffentlich sichtbar.</p>
        <button
          type="button"
          onClick={() => router.push('/intern/medien')}
          className="rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
        >
          Zur Medienbibliothek
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Bild-Header */}
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white p-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-panel">
          <Image
            src={`/api/intern/library?original=${sourceMedia.id}&width=160&quality=70`}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{label}</p>
          <p className="text-[11.5px] text-ink-2">Aus der Medienbibliothek</p>
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

      {error && <p className="text-[12px] text-signal-deep">{error}</p>}
      {progress && <p className="text-[12px] text-ink-2">{progress}</p>}

      <button
        type="submit"
        disabled={status === 'working'}
        className="w-full rounded-md bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'working' ? 'Wird verarbeitet …' : 'Veröffentlichen'}
      </button>
    </form>
  );
}
