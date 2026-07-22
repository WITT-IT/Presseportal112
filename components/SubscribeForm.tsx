'use client';

import { useState, type FormEvent } from 'react';
import type { Gewerk } from '@/lib/types';

export default function SubscribeForm({ gewerke }: { gewerke: Gewerk[] }) {
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Bitte mindestens ein Gewerk auswählen.');
      return;
    }
    setStatus('sending');
    setError(null);

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, gewerke: selected }),
    });

    if (res.ok) {
      setStatus('done');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Anmeldung fehlgeschlagen.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-mail mb-3 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[22px] font-bold">Fast geschafft!</h2>
        <p className="text-[13.5px] text-ink-2">
          Wir haben dir eine Bestätigungsmail geschickt — bitte den Link
          darin anklicken, damit der Presse-Alarm aktiv wird.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          E-Mail *
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-2 block text-[12.5px] font-medium text-ink-2">
          Für welche Gewerke? *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {gewerke.map((g) => (
            <label
              key={g.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-[13px] transition-colors ${
                selected.includes(g.id)
                  ? 'border-ink bg-panel'
                  : 'border-line-strong'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() => toggle(g.id)}
                className="accent-ink"
              />
              {g.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'sending' ? 'Wird gesendet …' : 'Presse-Alarm aktivieren'}
      </button>
    </form>
  );
}
