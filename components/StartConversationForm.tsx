'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Organization } from '@/lib/types';

export default function StartConversationForm({
  organizations,
}: {
  organizations: Organization[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    const res = await fetch('/api/intern/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientOrganizationId: recipientId, subject, message }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/intern/nachrichten/${data.id}`);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Unterhaltung konnte nicht gestartet werden.');
      setStatus('error');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-8 flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
      >
        <i className="ti ti-plus text-[14px]" aria-hidden="true" />
        Neue Unterhaltung
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex flex-col gap-3 rounded-[10px] border border-line bg-white p-5"
    >
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          An welche Organisation? *
        </label>
        <select
          required
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[13.5px] outline-none focus:border-ink"
        >
          <option value="">Bitte auswählen …</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Betreff *</label>
        <input
          type="text"
          required
          minLength={2}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Nachricht *
        </label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-md border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={status === 'saving'}
          className="flex-1 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
        >
          {status === 'saving' ? '…' : 'Unterhaltung starten'}
        </button>
      </div>
    </form>
  );
}
