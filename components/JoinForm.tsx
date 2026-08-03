'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      }),
    });

    if (res.ok) {
      setStatus('done');
      setTimeout(() => router.push('/login'), 2500);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Beitreten fehlgeschlagen.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-circle-check mb-3 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[20px] font-bold">Willkommen an Bord!</h2>
        <p className="text-[13.5px] text-ink-2">
          Dein Konto ist aktiv. Du wirst gleich zur Anmeldung weitergeleitet …
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

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'sending' ? 'Wird angelegt …' : 'Konto erstellen und beitreten'}
      </button>
    </form>
  );
}
