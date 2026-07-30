'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    await fetch('/api/auth/password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    // Bewusst immer "done" -- die Route antwortet aus Sicherheitsgründen
    // selbst schon immer gleich, egal ob die Adresse existiert.
    setStatus('done');
  }

  return (
    <section className="flex min-h-[65vh] items-center justify-center px-8 py-16">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Passwort vergessen</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Trag deine E-Mail-Adresse ein, wir schicken dir einen Link zum
          Zurücksetzen.
        </p>

        {status === 'done' ? (
          <div className="rounded-[10px] border border-line bg-white p-6 text-[13.5px] text-ink-2">
            Falls zu dieser Adresse ein aktives Konto existiert, ist gerade
            eine E-Mail mit einem Link unterwegs. Schau bei Bedarf auch im
            Spam-Ordner nach.
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
            >
              {status === 'sending' ? 'Wird gesendet …' : 'Link anfordern'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-block text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          Zurück zur Anmeldung
        </Link>
      </div>
    </section>
  );
}
