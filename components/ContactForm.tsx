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
  dark = false,
}: {
  organizations: Organization[];
  defaultOrganizationId?: string;
  dark?: boolean;
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
      theme: dark ? 'dark' : 'light',
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
  }, [turnstileScriptReady, dark]);

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

  // Zwei kleine, wiederverwendete Klassen-Sets statt in jedem Feld einzeln
  // zu verzweigen -- hell (Standard, z. B. /kontakt) oder dunkel (eingebettet
  // im Hero, verglast gegen den dunklen Hintergrund).
  const labelClass = dark ? 'text-white/70' : 'text-ink-2';
  const fieldClass = dark
    ? 'border-white/20 bg-white/[0.07] text-white placeholder:text-white/30 focus:border-white/40'
    : 'border-line-strong bg-white text-ink focus:border-ink';
  const errorClass = dark ? 'text-signal' : 'text-signal-deep';

  // Nur die dunkle Hero-Variante bekommt kompaktere, fluid schrumpfende
  // Abstände (clamp mit dvh) -- die helle /kontakt-Seite hat genug Platz
  // und bleibt bei den bisherigen festen Werten unverändert.
  const labelMarginClass = dark ? 'mb-1' : 'mb-1.5';
  const formStyle = dark
    ? { gap: 'clamp(10px, 2dvh, 16px)', padding: 'clamp(16px, 3dvh, 24px)' }
    : undefined;
  const submitPaddingClass = dark ? 'py-2.5' : 'py-3';

  if (status === 'done') {
    return (
      <div
        className={`rounded-[10px] border p-8 text-center ${
          dark ? 'border-white/15 bg-white/[0.06] backdrop-blur-md' : 'border-line bg-white'
        }`}
      >
        <i
          className={`ti ti-circle-check mb-3 block text-[32px] ${dark ? 'text-white' : 'text-ink'}`}
          aria-hidden="true"
        />
        <h2 className={`mb-2 font-display text-[22px] font-bold ${dark ? 'text-white' : 'text-ink'}`}>
          Nachricht gesendet
        </h2>
        <p className={`text-[13.5px] ${dark ? 'text-white/70' : 'text-ink-2'}`}>
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
        className={`flex flex-col rounded-[10px] border ${dark ? '' : 'gap-4 p-6'} ${
          dark
            ? 'border-white/15 bg-white/[0.06] backdrop-blur-md'
            : 'border-line bg-white'
        }`}
        style={formStyle}
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
            <label className={`${labelMarginClass} block text-[12.5px] font-medium ${labelClass}`}>
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-[14px] outline-none ${fieldClass}`}
            />
          </div>
          <div>
            <label className={`${labelMarginClass} block text-[12.5px] font-medium ${labelClass}`}>
              E-Mail *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-[14px] outline-none ${fieldClass}`}
            />
          </div>
        </div>

        <div>
          <label className={`${labelMarginClass} block text-[12.5px] font-medium ${labelClass}`}>
            An welche Organisation? (optional)
          </label>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-[14px] outline-none ${fieldClass}`}
          >
            <option value="" className="text-ink">
              Allgemeine Anfrage an die Redaktion
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="text-ink">
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`${labelMarginClass} block text-[12.5px] font-medium ${labelClass}`}>
            Betreff *
          </label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-[14px] outline-none ${fieldClass}`}
          />
        </div>

        <div>
          <label className={`${labelMarginClass} block text-[12.5px] font-medium ${labelClass}`}>
            Nachricht *
          </label>
          <textarea
            required
            rows={dark ? 3 : 5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-[14px] outline-none ${fieldClass}`}
          />
        </div>

        <label className={`flex items-start gap-2 text-[11.5px] leading-[1.5] ${labelClass}`}>
          <input
            type="checkbox"
            checked={privacyConfirmed}
            onChange={(e) => setPrivacyConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Ich habe die{' '}
            <a
              href="/datenschutz"
              target="_blank"
              className={`font-semibold underline ${dark ? 'text-white' : 'text-ink'}`}
            >
              Datenschutzerklärung
            </a>{' '}
            gelesen und stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage zu. *
          </span>
        </label>

        {TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} />}

        {error && <p className={`text-[12.5px] ${errorClass}`}>{error}</p>}

        <button
          type="submit"
          disabled={status === 'sending'}
          className={`mt-2 rounded-md px-5 ${submitPaddingClass} text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${
            dark
              ? 'bg-white text-void hover:bg-white/90'
              : 'bg-ink text-white hover:bg-black'
          }`}
        >
          {status === 'sending' ? 'Wird gesendet …' : 'Nachricht senden'}
        </button>
      </form>
    </>
  );
}
