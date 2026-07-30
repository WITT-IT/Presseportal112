'use client';

import { useState, type FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Der Link ist unvollständig. Bitte fordere einen neuen an.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setStatus('saving');
    const res = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      setStatus('done');
      setTimeout(() => router.push('/login'), 2000);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Zurücksetzen fehlgeschlagen.');
      setStatus('idle');
    }
  }

  if (!token) {
    return (
      <div className="rounded-[10px] border border-line bg-white p-6 text-[13.5px] text-ink-2">
        Dieser Link ist unvollständig oder ungültig. Fordere unter{' '}
        <a href="/passwort-vergessen" className="font-semibold text-ink underline">
          Passwort vergessen
        </a>{' '}
        einen neuen an.
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-6 text-[13.5px] text-ink-2">
        Passwort erfolgreich geändert. Du wirst gleich zur Anmeldung
        weitergeleitet …
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Neues Passwort
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3.5 py-2.5 text-[14px] outline-none focus:border-ink"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Neues Passwort wiederholen
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3.5 py-2.5 text-[14px] outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'saving' ? 'Wird gespeichert …' : 'Passwort ändern'}
      </button>
    </form>
  );
}

// useSearchParams() braucht in Next.js zwingend eine Suspense-Grenze,
// sonst schlägt der Build fehl -- deshalb die Aufteilung in zwei
// Komponenten.
export default function ResetPasswordPage() {
  return (
    <section className="flex min-h-[65vh] items-center justify-center px-8 py-16">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Neues Passwort</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Vergib ein neues Passwort für dein Konto.
        </p>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </section>
  );
}
