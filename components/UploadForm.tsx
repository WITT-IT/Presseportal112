'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createWatermarkedVariants } from '@/lib/watermark';
import RichTextEditor from '@/components/RichTextEditor';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 80 * 1024 * 1024;

export default function UploadForm({ watermarkText }: { watermarkText: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [alarmCode, setAlarmCode] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'uploading' | 'error' | 'done'
  >('idle');
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    setStatus('idle');
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Nur JPEG, PNG, WebP oder GIF sind erlaubt.');
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError('Die Datei ist größer als 80 MB.');
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !eventDate) {
      setError('Bitte Bild und Einsatzdatum angeben.');
      return;
    }
    setError(null);

    try {
      setStatus('processing');
      const { preview, download } = await createWatermarkedVariants(file, watermarkText);

      setStatus('uploading');
      const formData = new FormData();
      formData.append('original', file);
      formData.append('preview', preview, `preview-${file.name}.jpg`);
      formData.append('download', download, `download-${file.name}.jpg`);
      formData.append('title', title);
      formData.append('event_date', eventDate);
      formData.append('alarm_code', alarmCode);
      formData.append('location', location);
      formData.append('tags', tags);
      formData.append('article_body', articleBody);

      const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
      }

      setStatus('done');
      setFile(null);
      setTitle('');
      setEventDate('');
      setAlarmCode('');
      setLocation('');
      setTags('');
      setArticleBody('');
      router.refresh();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    }
  }

  const busy = status === 'processing' || status === 'uploading';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Bild *
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          required
          className="w-full text-[13px]"
        />
        <p className="mt-1 text-[11px] text-ink-3">
          JPEG, PNG, WebP oder GIF, max. 80 MB. Das Wasserzeichen wird
          automatisch im Browser erzeugt.
        </p>
      </div>

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
          <input
            type="text"
            value={alarmCode}
            onChange={(e) => setAlarmCode(e.target.value)}
            placeholder="z. B. B1"
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Titel
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Ort
        </label>
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
          Erscheint auf der öffentlichen Artikelseite unter dem Bild.
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
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}
      {status === 'done' && (
        <p className="text-[12.5px] text-ink-2">
          Hochgeladen — als Entwurf, noch nicht öffentlich sichtbar.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'processing'
          ? 'Wasserzeichen wird erzeugt …'
          : status === 'uploading'
          ? 'Wird hochgeladen …'
          : 'Hochladen'}
      </button>
    </form>
  );
}
