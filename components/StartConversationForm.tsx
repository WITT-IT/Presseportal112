'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Organization } from '@/lib/types';

const MAX_RECIPIENTS = 9;

export default function StartConversationForm({
  organizations,
}: {
  organizations: Organization[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function toggleRecipient(id: string) {
    setRecipientIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_RECIPIENTS) {
        setError(`Maximal ${MAX_RECIPIENTS} Empfänger-Organisationen gleichzeitig.`);
        return prev;
      }
      setError(null);
      return [...prev, id];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (recipientIds.length === 0) {
      setError('Bitte mindestens eine Organisation auswählen.');
      return;
    }
    setStatus('saving');
    setError(null);

    const res = await fetch('/api/intern/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientOrganizationIds: recipientIds, subject, message }),
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
          An welche Organisation(en)? *{' '}
          <span className="font-normal text-ink-3">(bis zu {MAX_RECIPIENTS})</span>
        </label>
        <div className="max-h-[200px] overflow-y-auto rounded-md border border-line-strong bg-white p-2">
          {organizations.map((org) => (
            <label
              key={org.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-panel"
            >
              <input
                type="checkbox"
                checked={recipientIds.includes(org.id)}
                onChange={() => toggleRecipient(org.id)}
              />
              {org.name}
            </label>
          ))}
        </div>
        {recipientIds.length > 1 && (
          <p className="mt-1 text-[11px] text-ink-3">
            {recipientIds.length} Organisationen ausgewählt — es entsteht eine
            Gruppenunterhaltung.
          </p>
        )}
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
