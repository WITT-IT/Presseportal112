'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Script from 'next/script';
import type { Organization } from '@/lib/types';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

// Nur gesetzt, wenn NEXT_PUBLIC_TURNSTILE_SITE_KEY beim Build vorhanden war --
// fehlt die Variable (z. B. lokale Entwicklung), blendet sich die komplette
// Sicherheitsprüfung sauber aus, statt kaputt zu rendern.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactForm({
  organizations,
  defaultOrganizationId,
}: {
  organizations: Organization[];
  defaultOrganizationId?: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [recipient, setRecipient] = useState(defaultOrganizationId ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Honeypot -- für Menschen unsichtbares Feld. Echte Besucher können es nie
  // ausfüllen; simple Bots, die Formulare blind befüllen, tappen hinein.
  const [honeypot, setHoneypot] = useState('');

  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileScriptReady) return;
    if (!turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetIdRef.current) return;

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'light',
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    });

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Widget war schon weg -- kann beim schnellen Seitenwechsel passieren.
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileScriptReady]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!privacyConfirmed) {
      setError('Bitte bestätige, dass du die Datenschutzerklärung gelesen hast.');
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Bitte schließe die Sicherheitsprüfung ab.');
      return;
    }

    setStatus('sending');

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        recipient_organization: recipient || null,
        subject,
        message,
        turnstileToken,
        website: honeypot,
      }),
    });

    if (res.ok) {
      setStatus('done');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Senden fehlgeschlagen.');
      setStatus('error');
      if (TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileToken('');
      }
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-circle-check mb-3 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[22px] font-bold">Nachricht gesendet</h2>
        <p className="text-[13.5px] text-ink-2">
          Deine Anfrage ist direkt an die zuständige Stelle unterwegs. Wir
          melden uns so schnell wie möglich zurück.
        </p>
      </div>
    );
  }

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileScriptReady(true)}
        />
      )}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
      >
        {/* Honeypot -- bewusst kein type="hidden": manche Bots überspringen
            echte hidden-Felder, aber nicht per CSS versteckte. */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
            />
          </div>
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
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            An welche Organisation? (optional)
          </label>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
          >
            <option value="">Allgemeine Anfrage an die Redaktion</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Betreff *
          </label>
          <input
            type="text"
            required
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
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>

        <label className="flex items-start gap-2 text-[11.5px] leading-[1.5] text-ink-2">
          <input
            type="checkbox"
            checked={privacyConfirmed}
            onChange={(e) => setPrivacyConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Ich habe die{' '}
            <a href="/datenschutz" target="_blank" className="font-semibold text-ink underline">
              Datenschutzerklärung
            </a>{' '}
            gelesen und stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage zu. *
          </span>
        </label>

        {TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} />}

        {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
        >
          {status === 'sending' ? 'Wird gesendet …' : 'Nachricht senden'}
        </button>
      </form>
    </>
  );
}
