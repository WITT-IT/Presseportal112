'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AddToMediaShareControl({
  postId,
  mediaShares,
}: {
  postId: string;
  mediaShares: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mediaShares.length === 0) return null;

  async function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const shareId = e.target.value;
    if (!shareId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, postId, action: 'add' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Fehlgeschlagen (Status ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <select
        onChange={handleChange}
        disabled={busy}
        defaultValue=""
        className="w-full rounded-md border border-line-strong bg-white px-2 py-1.5 text-[11px] text-ink-2 outline-none focus:border-ink disabled:opacity-50"
      >
        <option value="" disabled>
          {busy ? 'Wird hinzugefügt …' : '+ Zu Freigabe hinzufügen'}
        </option>
        {mediaShares.map((share) => (
          <option key={share.id} value={share.id}>
            {share.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[10.5px] text-signal-deep">{error}</p>}
    </div>
  );
}
