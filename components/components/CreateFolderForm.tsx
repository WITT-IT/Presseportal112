'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateFolderForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    const res = await fetch('/api/intern/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      setName('');
      setStatus('idle');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Anlegen fehlgeschlagen.');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex items-end gap-2.5">
      <div className="flex-1">
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Neuer Ordner
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Weihnachtsmarkt-Einsatz 2026"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-md bg-ink px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'saving' ? '…' : 'Anlegen'}
      </button>
      {error && <p className="text-[12px] text-signal-deep">{error}</p>}
    </form>
  );
}
