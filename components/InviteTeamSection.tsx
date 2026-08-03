'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Invite = {
  id: string;
  email: string | null;
  expires_at: string;
  created_at: string;
  expired: boolean;
};

export default function InviteTeamSection() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadInvites() {
    setLoading(true);
    const res = await fetch('/api/intern/invite');
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInvites();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setLastLink(null);

    const res = await fetch('/api/intern/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email || null }),
    });

    if (res.ok) {
      const data = await res.json();
      setLastLink(data.joinUrl);
      setEmail('');
      loadInvites();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Einladung fehlgeschlagen.');
    }
    setSending(false);
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/intern/invite/${id}`, { method: 'DELETE' });
    loadInvites();
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage evtl. nicht verfügbar -- kein Absturz nötig, der
      // Link steht ja trotzdem sichtbar da.
    }
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-6">
      <h2 className="mb-2 font-display text-[16px] font-bold">Teammitglieder einladen</h2>
      <p className="mb-4 text-[13px] leading-[1.6] text-ink-2">
        Kolleg:innen aus deiner Organisation können über einen Einladungslink
        direkt beitreten — ganz ohne erneute Prüfung durch die Redaktion.
        Der Link ist 14 Tage gültig.
      </p>

      <form onSubmit={handleCreate} className="mb-5 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail der einzuladenden Person (optional)"
          className="min-w-[220px] flex-1 rounded-md border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={sending}
          className="flex-none rounded-md bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {sending ? '…' : 'Link erstellen'}
        </button>
      </form>

      {error && <p className="mb-3 text-[12.5px] text-signal-deep">{error}</p>}

      {lastLink && (
        <div className="mb-5 rounded-md border border-line-strong bg-panel p-3">
          <p className="mb-2 text-[11.5px] font-semibold text-ink-2">
            Einladung erstellt{email ? '' : ' — ohne hinterlegte Mail, Link direkt weitergeben'}:
          </p>
          <div className="mb-2 break-all rounded-md border border-line-strong bg-white px-3 py-2 font-mono text-[11.5px]">
            {lastLink}
          </div>
          <button
            type="button"
            onClick={() => handleCopy(lastLink)}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-ink"
          >
            <i className={`ti ${copied ? 'ti-check' : 'ti-copy'} text-[13px]`} aria-hidden="true" />
            {copied ? 'Kopiert' : 'Link kopieren'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[12.5px] text-ink-2">Lädt …</p>
      ) : invites.length === 0 ? (
        <p className="text-[12.5px] text-ink-2">Keine offenen Einladungen.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-[12px]"
            >
              <span className="text-ink-2">
                {inv.email || 'Allgemeiner Link'} ·{' '}
                {inv.expired
                  ? 'abgelaufen'
                  : `gültig bis ${new Date(inv.expires_at).toLocaleDateString('de-DE')}`}
              </span>
              <button
                type="button"
                onClick={() => handleRevoke(inv.id)}
                className="font-semibold text-signal-deep hover:text-signal"
              >
                Widerrufen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
