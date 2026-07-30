'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/intern');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Anmeldung fehlgeschlagen.');
    }
  }

  return (
    <section className="flex min-h-[65vh] items-center justify-center px-8 py-16">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Anmelden</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Für Mitarbeitende angeschlossener Organisationen.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              E-Mail
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line-strong px-3.5 py-2.5 text-[14px] outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Passwort
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line-strong px-3.5 py-2.5 text-[14px] outline-none focus:border-ink"
            />
          </div>

          {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            {loading ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>

        <Link
          href="/passwort-vergessen"
          className="mt-6 inline-block text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          Passwort vergessen?
        </Link>
      </div>
    </section>
  );
}
