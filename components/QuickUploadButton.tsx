'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWatermarkedVariants } from '@/lib/watermark';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_IMAGES = 12;

// Schnellupload direkt in einen Ordner -- kein Formular, keine Pflichtfelder.
// Erzeugt einen Stockfoto-Beitrag ohne Titel/Datum/Alarmcode.
// Wasserzeichen wird im Browser erzeugt, Upload läuft über die bestehende
// /api/intern/upload Route.
export default function QuickUploadButton({
  folderId,
  watermarkText,
}: {
  folderId: string;
  watermarkText: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
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
      const formData = new FormData();
      formData.append('post_type', 'stockfoto');
      formData.append('tags', '');
      formData.append('make_public', 'false');
      formData.append('folder_id', folderId);
      formData.append('content_confirmed', 'true');
      formData.append('image_count', String(limited.length));

      for (let i = 0; i < limited.length; i++) {
        const file = limited[i];
        setProgress(`Wasserzeichen ${i + 1}/${limited.length} …`);

        // Original klonen bevor createWatermarkedVariants das File konsumiert
        const originalBuffer = await file.arrayBuffer();
        const originalBlob = new Blob([originalBuffer], { type: file.type });

        const { preview, download } = await createWatermarkedVariants(file, watermarkText);

        formData.append(`original_${i}`, originalBlob, file.name);
        formData.append(`preview_${i}`, preview, `prev-${file.name}.jpg`);
        formData.append(`download_${i}`, download, `dl-${file.name}.jpg`);
        formData.append(`caption_${i}`, '');
      }

      setProgress('Wird hochgeladen …');
      const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
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
    e.target.value = '';
    handleFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    handleFiles(files);
  }

  const busy = status === 'working';

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed px-4 py-3 text-[13px] transition-colors ${
          busy
            ? 'border-line bg-panel text-ink-2 cursor-wait'
            : 'border-line-strong text-ink-2 hover:border-ink hover:text-ink'
        }`}
      >
        <i
          className={`ti text-[18px] ${busy ? 'ti-loader-2 animate-spin' : 'ti-cloud-upload'}`}
          aria-hidden="true"
        />
        <span className="font-medium">
          {busy ? progress || 'Wird verarbeitet …' : 'Dateien hierher ziehen oder klicken'}
        </span>
        <span className="ml-auto text-[11px] text-ink-3">JPEG · PNG · WebP · max. 80 MB</span>
      </div>

      {error && (
        <p className="mt-2 text-[12px] text-signal-deep">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
