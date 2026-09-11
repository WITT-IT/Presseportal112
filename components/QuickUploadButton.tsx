'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWatermarkedVariants } from '@/lib/watermark';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_IMAGES = 12;

// Schnellupload direkt in einen (eigenen) Ordner -- kein Formular, keine
// Pflichtfelder. Legt für jedes Foto einen privaten Stockfoto-Beitrag an
// und ordnet ihn dem Ordner zu.
//
// Läuft über den gleichen Pfad wie das Studio: erst in die Medienbibliothek
// (/api/intern/library), dann veröffentlichen (/api/intern/upload). Nur
// noch EIN Code-Pfad erzeugt Beiträge aus Bildern.
export default function QuickUploadButton({
  folderId,
  watermarkText,
}: {
  folderId: string;
  watermarkText: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setError(`"${tooBig.name}" ist größer als 80 MB.`);
      return;
    }

    const limited = files.slice(0, MAX_IMAGES);
    setStatus('working');
    setError(null);

    try {
      // 1) Alle Dateien in einem Rutsch in die Bibliothek hochladen.
      setProgress('Wird hochgeladen …');
      const libraryForm = new FormData();
      libraryForm.append('folder', folderId);
      libraryForm.append('image_count', String(limited.length));
      limited.forEach((file, i) => libraryForm.append(`file_${i}`, file, file.name));

      const libraryRes = await fetch('/api/intern/library', { method: 'POST', body: libraryForm });
      const libraryBody = await libraryRes.json().catch(() => ({}));
      if (!libraryRes.ok || !libraryBody.created?.length) {
        throw new Error(libraryBody.error ?? 'Hochladen in die Bibliothek fehlgeschlagen.');
      }
      if (libraryBody.errors?.length) {
        throw new Error(`Teilweise fehlgeschlagen, bitte erneut versuchen: ${libraryBody.errors.join(' | ')}`);
      }
      const mediaIds: string[] = libraryBody.created;

      // 2) Jedes Bild einzeln als privaten Stockfoto-Beitrag veröffentlichen
      //    und dem Ordner zuordnen.
      for (let i = 0; i < mediaIds.length; i++) {
        const file = limited[i];
        const mediaId = mediaIds[i];

        setProgress(`Foto ${i + 1}/${mediaIds.length}: Wasserzeichen wird erzeugt …`);
        const { preview, download } = await createWatermarkedVariants(file, watermarkText);

        const publishForm = new FormData();
        publishForm.append('source_media_id', mediaId);
        publishForm.append('post_type', 'stockfoto');
        publishForm.append('tags', '');
        publishForm.append('make_public', 'false');
        publishForm.append('content_confirmed', 'true');
        publishForm.append('caption', '');
        publishForm.append('preview_0', preview, 'preview.jpg');
        publishForm.append('download_0', download, 'download.jpg');

        setProgress(`Foto ${i + 1}/${mediaIds.length}: wird veröffentlicht …`);
        const publishRes = await fetch('/api/intern/upload', { method: 'POST', body: publishForm });
        const publishBody = await publishRes.json().catch(() => ({}));
        if (!publishRes.ok || !publishBody.id) {
          throw new Error(publishBody.error ?? `"${file.name}" konnte nicht veröffentlicht werden.`);
        }

        await fetch('/api/intern/folders/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId, postId: publishBody.id, action: 'add' }),
        }).catch(() => {
          // Beitrag existiert bereits -- Ordner-Zuordnung notfalls manuell nachholen.
        });
      }

      setStatus('idle');
      setProgress('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
    if (e.target) e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'));
    handleFiles(files);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-strong py-6 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
      >
        <i className="ti ti-cloud-upload text-[18px]" aria-hidden="true" />
        {status === 'working' ? progress || 'Wird hochgeladen …' : 'Fotos hierher ziehen oder klicken'}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*" hidden onChange={handleChange} disabled={status === 'working'} />
      {error && <p className="mt-2 text-[12px] text-signal-deep">{error}</p>}
    </div>
  );
}
