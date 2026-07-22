'use client';

import { useState, type FormEvent } from 'react';
import type { Gewerk } from '@/lib/types';

export default function RegisterForm({ gewerke }: { gewerke: Gewerk[] }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [gewerkId, setGewerkId] = useState(gewerke[0]?.id ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        requested_organization_name: orgName,
        requested_gewerk: gewerkId,
      }),
    });

    if (res.ok) {
      setStatus('done');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Registrierung fehlgeschlagen.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-circle-check mb-3 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[22px] font-bold">Danke für die Anmeldung!</h2>
        <p className="text-[13.5px] text-ink-2">
          Wir prüfen deine Angaben und schalten euch in Kürze frei. Du
          bekommst dann Zugang unter „Anmelden".
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Vorname *
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Nachname *
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Dienstliche E-Mail *
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
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Passwort * (mind. 8 Zeichen)
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Name eurer Organisation *
        </label>
        <input
          type="text"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="z. B. Freiwillige Feuerwehr Musterstadt"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Gewerk *
        </label>
        <select
          required
          value={gewerkId}
          onChange={(e) => setGewerkId(e.target.value)}
          className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
        >
          {gewerke.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'sending' ? 'Wird gesendet …' : 'Registrierung absenden'}
      </button>
    </form>
  );
}
