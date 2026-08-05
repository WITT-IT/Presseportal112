'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { createWatermarkedVariants } from '@/lib/watermark';
import { normalizeTags, type Alarmcode, type Post } from '@/lib/types';
import RichTextEditor from './RichTextEditor';
import AlarmCodeInput from './AlarmCodeInput';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_IMAGES = 12;

type ImageEntry =
  | { kind: 'existing'; id: string; previewUrl: string; caption: string; noWatermark: boolean }
  | { kind: 'new'; key: string; file: File; previewUrl: string; caption: string };

export default function EditPostForm({
  post,
  existingTags,
  watermarkText,
  alarmcodes,
}: {
  post: Post;
  existingTags: string[];
  watermarkText: string;
  alarmcodes: Alarmcode[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title ?? '');
  const [eventDate, setEventDate] = useState(post.event_date?.slice(0, 10) ?? '');
  const [alarmCode, setAlarmCode] = useState(post.alarm_code ?? '');
  const [location, setLocation] = useState(post.location ?? '');
  const [tags, setTags] = useState(normalizeTags(post.tags).join(', '));
  const [articleBody, setArticleBody] = useState(post.article_body ?? '');

  const initialEntries: ImageEntry[] = [...(post.images ?? [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((img) => ({
      kind: 'existing',
      id: img.id,
      previewUrl: img.file_public_preview
        ? directusAssetUrl(img.file_public_preview, 'width=200&quality=70')
        : '',
      caption: img.caption ?? '',
      noWatermark: img.no_watermark ?? false,
    }));
  const [entries, setEntries] = useState<ImageEntry[]>(initialEntries);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) { setError(`"${tooBig.name}" ist größer als 80 MB.`); return; }
    const newEntries: ImageEntry[] = files.map((file) => ({
      kind: 'new',
      key: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }));
    const combined = [...entries, ...newEntries].slice(0, MAX_IMAGES);
    setError(entries.length + files.length > MAX_IMAGES ? `Maximal ${MAX_IMAGES} Fotos pro Beitrag.` : null);
    setEntries(combined);
    e.target.value = '';
  }

  function removeEntry(index: number) {
    setEntries((prev) => {
      const entry = prev[index];
      if (entry.kind === 'existing') {
        setDeletedIds((ids) => [...ids, entry.id]);
      } else {
        URL.revokeObjectURL(entry.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function moveEntry(index: number, direction: -1 | 1) {
    setEntries((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateCaption(index: number, caption: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, caption } : e)));
  }

  function toggleNoWatermark(index: number, noWatermark: boolean) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index && e.kind === 'existing' ? { ...e, noWatermark } : e))
    );
  }

  // ── Beitrag löschen ─────────────────────────────────────────────────────
  async function handleDelete() {
    setStatus('deleting');
    setError(null);
    try {
      const res = await fetch('/api/intern/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
      }
      router.push('/intern/medien');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
      setStatus('error');
      setShowDeleteConfirm(false);
    }
  }

  // ── Beitrag speichern ────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (entries.length === 0) { setError('Ein Beitrag braucht mindestens ein Foto.'); return; }

    setStatus('saving');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('id', post.id);
      formData.append('title', title);
      formData.append('event_date', eventDate);
      formData.append('alarm_code', alarmCode);
      formData.append('location', location);
      formData.append('article_body', articleBody);
      formData.append('tags', tags);
      formData.append('delete_image_ids', JSON.stringify(deletedIds));

      const existingOrder: { id: string; caption: string; sort: number; noWatermark: boolean }[] = [];
      let newCount = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.kind === 'existing') {
          existingOrder.push({ id: entry.id, caption: entry.caption, sort: i, noWatermark: entry.noWatermark });
        } else {
          setProgress(`Wasserzeichen für neues Foto wird erstellt … (${newCount + 1})`);
          const originalBuffer = await entry.file.arrayBuffer();
          const originalBlob = new Blob([originalBuffer], { type: entry.file.type });
          const { preview, download } = await createWatermarkedVariants(entry.file, watermarkText);
          formData.append(`new_original_${newCount}`, originalBlob, entry.file.name);
          formData.append(`new_preview_${newCount}`, preview);
          formData.append(`new_download_${newCount}`, download);
          formData.append(`new_caption_${newCount}`, entry.caption);
          formData.append(`new_sort_${newCount}`, String(i));
          newCount++;
        }
      }

      formData.append('existing_image_order', JSON.stringify(existingOrder));
      formData.append('new_image_count', String(newCount));

      setProgress('Wird gespeichert …');
      const res = await fetch('/api/intern/update', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Speichern fehlgeschlagen.');
      }

      router.push('/intern/medien');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  const busy = status === 'saving' || status === 'deleting';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Lösch-Bestätigung ── */}
      {showDeleteConfirm && (
        <div className="rounded-[10px] border border-signal-deep bg-white p-5">
          <p className="mb-4 text-[13.5px] font-semibold text-ink">
            Beitrag wirklich löschen?
          </p>
          <p className="mb-5 text-[12.5px] text-ink-2">
            Das entfernt den Beitrag samt allen {entries.length} Foto{entries.length === 1 ? '' : 's'} und allen Dateivarianten unwiderruflich.
            {post.is_public && ' Der Beitrag ist aktuell öffentlich — er verschwindet sofort aus dem Bildarchiv.'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md bg-signal-deep px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal disabled:opacity-60"
            >
              {status === 'deleting' ? 'Wird gelöscht …' : 'Ja, löschen'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={busy}
              className="rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6">
        {post.is_public && (
          <div className="rounded-md border border-line bg-panel p-3 text-[12px] text-ink-2">
            Dieser Beitrag ist bereits öffentlich sichtbar — Änderungen wirken sich sofort aus.
          </div>
        )}

        {/* Fotos */}
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Fotos</label>
          {entries.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {entries.map((entry, i) => (
                <div key={entry.kind === 'existing' ? entry.id : entry.key}
                  className="flex items-start gap-3 rounded-md border border-line bg-panel p-2">
                  <div className="relative h-16 w-16 flex-none overflow-hidden rounded bg-white">
                    {entry.previewUrl ? (
                      <Image src={entry.previewUrl} alt="" fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-3">
                        <i className="ti ti-photo text-[20px]" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <input
                      type="text"
                      value={entry.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
                      placeholder="Bildunterschrift (optional)"
                      className="w-full rounded border border-line-strong bg-white px-2 py-1 text-[12px] outline-none focus:border-ink"
                    />
                    {entry.kind === 'existing' && (
                      <label className="flex items-center gap-1.5 text-[11px] text-ink-2">
                        <input type="checkbox" checked={entry.noWatermark}
                          onChange={(e) => toggleNoWatermark(i, e.target.checked)} />
                        Kein Wasserzeichen
                      </label>
                    )}
                  </div>
                  <div className="flex flex-none flex-col gap-1">
                    <button type="button" onClick={() => moveEntry(i, -1)} disabled={i === 0}
                      aria-label="Nach oben"
                      className="rounded border border-line-strong px-1.5 text-[11px] text-ink-2 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1}
                      aria-label="Nach unten"
                      className="rounded border border-line-strong px-1.5 text-[11px] text-ink-2 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => removeEntry(i)}
                      aria-label="Entfernen"
                      className="rounded border border-line-strong px-1.5 text-[11px] text-signal-deep">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            multiple onChange={handleFileChange} className="w-full text-[13px]" />
        </div>

        {/* Einsatzdaten */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Einsatzdatum</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Alarmcode</label>
            <AlarmCodeInput value={alarmCode} onChange={setAlarmCode} alarmcodes={alarmcodes} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Titel</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink" />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Ort</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink" />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Artikeltext</label>
          <RichTextEditor value={articleBody} onChange={setArticleBody} />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Tags (Komma-getrennt)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
            list="tag-suggestions"
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink" />
          <datalist id="tag-suggestions">
            {existingTags.map((tag) => (<option key={tag} value={tag} />))}
          </datalist>
        </div>

        {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}
        {progress && <p className="text-[12.5px] text-ink-2">{progress}</p>}

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex gap-3">
            <button type="submit" disabled={busy}
              className="rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60">
              {status === 'saving' ? 'Wird gespeichert …' : 'Speichern'}
            </button>
            <button type="button" onClick={() => router.back()} disabled={busy}
              className="rounded-md border border-line-strong px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60">
              Abbrechen
            </button>
          </div>

          {/* Beitrag löschen */}
          {!showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-3 text-[13px] font-semibold text-signal-deep transition-colors hover:border-signal-deep disabled:opacity-60"
            >
              <i className="ti ti-trash text-[14px]" aria-hidden="true" />
              Beitrag löschen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
