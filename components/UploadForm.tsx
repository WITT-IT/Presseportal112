'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createWatermarkedVariants } from '@/lib/watermark';
import RichTextEditor from '@/components/RichTextEditor';
import AlarmCodeInput from '@/components/AlarmCodeInput';
import type { Alarmcode } from '@/lib/types';

const MAX_FILE_SIZE = 80 * 1024 * 1024; // 80 MB pro Datei
const MAX_IMAGES = 12;

type SelectedImage = {
  file: File;
  previewUrl: string;
  caption: string;
};

export default function UploadForm({
  watermarkText,
  existingTags,
  alarmcodes,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
}) {
  const router = useRouter();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [alarmCode, setAlarmCode] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setError(`"${tooBig.name}" ist größer als 80 MB.`);
      return;
    }

    const combined = [...images, ...files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }))].slice(0, MAX_IMAGES);

    if (images.length + files.length > MAX_IMAGES) {
      setError(`Maximal ${MAX_IMAGES} Fotos pro Beitrag.`);
    } else {
      setError(null);
    }

    setImages(combined);
    e.target.value = ''; // erlaubt erneutes Auswählen derselben Datei
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateCaption(index: number, caption: string) {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, caption } : img)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (images.length === 0) {
      setError('Bitte mindestens ein Foto auswählen.');
      return;
    }

    setStatus('working');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('event_date', eventDate);
      formData.append('alarm_code', alarmCode);
      formData.append('location', location);
      formData.append('tags', tags);
      formData.append('article_body', articleBody);
      formData.append('image_count', String(images.length));

      // Wasserzeichen für jedes Foto einzeln im Browser erzeugen -- das
      // dauert je nach Bildgröße spürbar, deshalb Fortschritt anzeigen.
      for (let i = 0; i < images.length; i++) {
        setProgress(`Wasserzeichen wird erstellt … (${i + 1}/${images.length})`);
        const { preview, download } = await createWatermarkedVariants(
          images[i].file,
          watermarkText
        );
        formData.append(`original_${i}`, images[i].file);
        formData.append(`preview_${i}`, preview);
        formData.append(`download_${i}`, download);
        formData.append(`caption_${i}`, images[i].caption);
      }

      setProgress('Wird hochgeladen …');
      const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
      }

      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      setTitle('');
      setEventDate('');
      setAlarmCode('');
      setLocation('');
      setTags('');
      setArticleBody('');
      setStatus('done');
      setProgress('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Fotos * (mehrere gleichzeitig möglich)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileChange}
          className="w-full text-[13px]"
        />
        <p className="mt-1 text-[11px] text-ink-3">
          JPEG, PNG, WebP oder GIF, max. 80 MB pro Datei, bis zu {MAX_IMAGES} Fotos.
          Das Wasserzeichen wird automatisch im Browser erzeugt.
        </p>
      </div>

      {images.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {images.map((img, i) => (
            <div
              key={`${img.file.name}-${i}`}
              className="flex gap-3 rounded-md border border-line bg-panel p-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt=""
                className="h-16 w-16 flex-none rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-3">
                    {i === 0 ? 'TITELBILD' : `BILD ${i + 1}`}
                  </span>
                  <span className="truncate text-[11px] text-ink-2">{img.file.name}</span>
                </div>
                <input
                  type="text"
                  value={img.caption}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  placeholder="Bildunterschrift (optional)"
                  className="w-full rounded border border-line-strong px-2 py-1 text-[12px] outline-none focus:border-ink"
                />
              </div>
              <div className="flex flex-none flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveImage(i, -1)}
                  disabled={i === 0}
                  aria-label="Nach oben"
                  className="rounded border border-line-strong px-1.5 text-[11px] text-ink-2 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(i, 1)}
                  disabled={i === images.length - 1}
                  aria-label="Nach unten"
                  className="rounded border border-line-strong px-1.5 text-[11px] text-ink-2 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="Entfernen"
                  className="rounded border border-line-strong px-1.5 text-[11px] text-signal-deep"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Einsatzdatum *
          </label>
          <input
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Alarmcode
          </label>
          <AlarmCodeInput value={alarmCode} onChange={setAlarmCode} alarmcodes={alarmcodes} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Ort</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Artikeltext (optional)
        </label>
        <RichTextEditor value={articleBody} onChange={setArticleBody} />
        <p className="mt-1 text-[11px] text-ink-3">
          Erscheint auf der öffentlichen Artikelseite unter dem Titelbild.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Tags (Komma-getrennt)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Zimmerbrand, Innenstadt"
          list="tag-suggestions"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
        <datalist id="tag-suggestions">
          {existingTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        {existingTags.length > 0 && (
          <p className="mt-1 text-[11px] text-ink-3">
            Tipp: Beim Tippen werden bereits verwendete Tags vorgeschlagen —
            hilft, die Suche für alle konsistent zu halten.
          </p>
        )}
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}
      {status === 'done' && (
        <p className="text-[12.5px] text-ink-2">
          Hochgeladen — als Entwurf, noch nicht öffentlich sichtbar.
        </p>
      )}
      {progress && <p className="text-[12.5px] text-ink-2">{progress}</p>}

      <button
        type="submit"
        disabled={status === 'working'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'working'
          ? 'Wird verarbeitet …'
          : `Beitrag hochladen${images.length > 0 ? ` (${images.length} Foto${images.length === 1 ? '' : 's'})` : ''}`}
      </button>
    </form>
  );
}
