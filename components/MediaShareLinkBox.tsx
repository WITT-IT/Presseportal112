'use client';

import { useEffect, useState } from 'react';

export default function MediaShareLinkBox({
  shareId,
  token,
  shareName,
  recipientName,
  recipientEmail,
  expiresAt,
}: {
  shareId: string;
  token: string;
  shareName: string;
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: string;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`/medienfreigabe/${token}`);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'idle' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

  // Erst nach dem Mount die volle URL mit Domain aufbauen -- window ist im
  // Server-Render nicht verfügbar, und ein Hydration-Mismatch soll
  // vermieden werden.
  useEffect(() => {
    setLink(`${window.location.origin}/medienfreigabe/${token}`);
  }, [token]);

  const expiryLabel = new Date(expiresAt).toLocaleDateString('de-DE');

  function buildMailBody() {
    return [
      'Guten Tag,',
      '',
      'anbei erhalten Sie den Link zu den Bildern, die Sie bei uns angefragt haben:',
      '',
      link,
      '',
      `Der Link ist bis zum ${expiryLabel} gültig.`,
      '',
      'Mit freundlichen Grüßen',
    ].join('\n');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage evtl. nicht erlaubt -- kein Absturz, einfach kein Feedback.
    }
  }

  async function handleSendFromSystem() {
    setSending(true);
    setSendResult('idle');
    setSendError(null);

    const res = await fetch(`/api/intern/media-shares/${shareId}/send-email`, {
      method: 'POST',
    });

    setSending(false);
    if (res.ok) {
      setSendResult('sent');
    } else {
      const body = await res.json().catch(() => ({}));
      setSendError(body.error ?? 'Versand fehlgeschlagen.');
      setSendResult('error');
    }
  }

  const mailtoHref = `mailto:${recipientEmail ?? ''}?subject=${encodeURIComponent(
    `Ihre Bildanfrage – ${shareName}`
  )}&body=${encodeURIComponent(buildMailBody())}`;

  return (
    <div className="mb-6 rounded-[10px] border border-line bg-panel p-4">
      <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        Freigabelink
      </div>
      <div className="mb-3 break-all rounded-md border border-line-strong bg-white px-3 py-2 font-mono text-[12px]">
        {link}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink"
        >
          <i className={`ti ${copied ? 'ti-check' : 'ti-copy'} text-[14px]`} aria-hidden="true" />
          {copied ? 'Kopiert' : 'Link kopieren'}
        </button>

        <a
          href={mailtoHref}
          className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink"
        >
          <i className="ti ti-mail text-[14px]" aria-hidden="true" />
          Über eigenes Mail-Programm
        </a>

        {recipientEmail && (
          <button
            type="button"
            onClick={handleSendFromSystem}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            <i className="ti ti-send text-[14px]" aria-hidden="true" />
            {sending
              ? 'Wird gesendet …'
              : sendResult === 'sent'
              ? `Erneut an ${recipientEmail} senden`
              : `Direkt an ${recipientEmail} senden`}
          </button>
        )}
      </div>

      {sendResult === 'sent' && (
        <p className="mt-2 text-[12px] text-ink-2">
          <i className="ti ti-circle-check mr-1 text-ink" aria-hidden="true" />
          Mail wurde verschickt.
        </p>
      )}
      {sendResult === 'error' && sendError && (
        <p className="mt-2 text-[12px] text-signal-deep">{sendError}</p>
      )}
    </div>
  );
}
