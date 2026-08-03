'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateMediaShareForm({
  pressOrganizations,
}: {
  pressOrganizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientOrgId, setRecipientOrgId] = useState('');
  const [validityDays, setValidityDays] = useState('10');
  const [autoDelete, setAutoDelete] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    const res = await fetch('/api/intern/media-shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        recipientName: recipientName || null,
        recipientEmail: recipientEmail || null,
        recipientOrganizationId: recipientOrgId || null,
        validityDays: Number(validityDays),
        autoDeleteOnExpiry: autoDelete,
      }),
    });

    if (res.ok) {
      setName('');
      setRecipientName('');
      setRecipientEmail('');
      setRecipientOrgId('');
      setOpen(false);
      setStatus('idle');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Anlegen fehlgeschlagen.');
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
        Neue Freigabe erstellen
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
          Name der Freigabe *
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Presseanfrage Großbrand 14.07.2026"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Medienhaus / Ansprechperson
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="optional"
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            E-Mail des Medienvertreters
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="optional"
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
      </div>

      {pressOrganizations.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Direkt einem registrierten Presse-Konto zuordnen (optional)
          </label>
          <select
            value={recipientOrgId}
            onChange={(e) => setRecipientOrgId(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
          >
            <option value="">Keine direkte Zuordnung</option>
            {pressOrganizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-3">
            Erscheint dann zusätzlich zum Link direkt im internen Bereich
            dieser Redaktion, unter „Freigaben".
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Gültigkeitsdauer
        </label>
        <select
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
        >
          <option value="10">10 Tage</option>
          <option value="20">20 Tage</option>
          <option value="30">30 Tage</option>
        </select>
      </div>

      <label className="flex items-start gap-2 text-[11.5px] leading-[1.5] text-ink-2">
        <input
          type="checkbox"
          checked={autoDelete}
          onChange={(e) => setAutoDelete(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Freigabe nach Ablauf automatisch löschen. Die Beiträge selbst
          bleiben im internen Archiv erhalten.
        </span>
      </label>

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
          {status === 'saving' ? '…' : 'Freigabe anlegen'}
        </button>
      </div>
    </form>
  );
}
