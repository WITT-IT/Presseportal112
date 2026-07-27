'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { normalizeTags, type Post } from '@/lib/types';
import RichTextEditor from './RichTextEditor';

export default function EditPostForm({
  post,
  existingTags,
}: {
  post: Post;
  existingTags: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title ?? '');
  const [eventDate, setEventDate] = useState(post.event_date?.slice(0, 10) ?? '');
  const [alarmCode, setAlarmCode] = useState(post.alarm_code ?? '');
  const [location, setLocation] = useState(post.location ?? '');
  const [tags, setTags] = useState(normalizeTags(post.tags).join(', '));
  const [articleBody, setArticleBody] = useState(post.article_body ?? '');
  const [captions, setCaptions] = useState<Record<string, string>>(
    Object.fromEntries((post.images ?? []).map((img) => [img.id, img.caption ?? '']))
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const images = [...(post.images ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    const res = await fetch('/api/intern/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: post.id,
        title,
        event_date: eventDate,
        alarm_code: alarmCode,
        location,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        article_body: articleBody,
        captions,
      }),
    });

    if (res.ok) {
      router.push('/intern');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Speichern fehlgeschlagen.');
      setStatus('error');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      {post.is_public && (
        <div className="rounded-md border border-line bg-panel p-3 text-[12px] text-ink-2">
          Dieser Beitrag ist bereits öffentlich sichtbar — Änderungen wirken
          sich sofort auf die veröffentlichte Seite aus.
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
          <input
            type="text"
            value={alarmCode}
            onChange={(e) => setAlarmCode(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
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
          Artikeltext
        </label>
        <RichTextEditor value={articleBody} onChange={setArticleBody} />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Tags (Komma-getrennt)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          list="tag-suggestions"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
        <datalist id="tag-suggestions">
          {existingTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>

      {images.length > 0 && (
        <div>
          <label className="mb-2 block text-[12.5px] font-medium text-ink-2">
            Bildunterschriften
          </label>
          <div className="flex flex-col gap-2">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="flex items-center gap-3 rounded-md border border-line bg-panel p-2.5"
              >
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded bg-white">
                  {img.file_public_preview && (
                    <Image
                      src={directusAssetUrl(img.file_public_preview, 'width=100&quality=70')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={captions[img.id] ?? ''}
                  onChange={(e) =>
                    setCaptions((prev) => ({ ...prev, [img.id]: e.target.value }))
                  }
                  placeholder={i === 0 ? 'Bildunterschrift zum Titelbild' : 'Bildunterschrift'}
                  className="w-full rounded border border-line-strong px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
        >
          {status === 'saving' ? 'Wird gespeichert …' : 'Änderungen speichern'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/intern')}
          className="text-[13px] font-semibold text-ink-2 hover:text-ink"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
