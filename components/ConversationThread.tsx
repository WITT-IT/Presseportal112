'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  id: string;
  body: string;
  messageType: string;
  createdAt: string;
  senderOrganizationId: string | null;
  senderOrganizationName: string | null;
  senderUserName: string | null;
};

const POLL_INTERVAL_MS = 5000;

export default function ConversationThread({
  conversationId,
  initialMessages,
  ownOrganizationId,
  ownOrganizationName,
  ownUserName,
}: {
  conversationId: string;
  initialMessages: Message[];
  ownOrganizationId: string;
  ownOrganizationName: string;
  ownUserName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Letzter bekannter Zeitstempel -- Basis für "gib mir alles Neuere".
  // Ref statt State, weil das Polling-Intervall den Wert lesen muss, ohne
  // dass eine Änderung selbst einen Re-Render/Timer-Neustart auslöst.
  const lastTimestampRef = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : new Date(0).toISOString()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Beim Wechsel der Unterhaltung (Klick auf eine andere in der Liste)
  // Nachrichten und Zeitstempel-Basis neu setzen -- sonst würde Polling für
  // die vorherige Unterhaltung weiterlaufen bzw. der Zeitstempel nicht passen.
  useEffect(() => {
    setMessages(initialMessages);
    lastTimestampRef.current =
      initialMessages.length > 0
        ? initialMessages[initialMessages.length - 1].createdAt
        : new Date(0).toISOString();
  }, [conversationId, initialMessages]);

  // Leises Hintergrund-Polling. Pausiert, sobald der Tab/das Fenster nicht
  // sichtbar ist (document.hidden) -- kein Grund, alle 5 Sekunden gegen
  // Directus zu fragen, wenn niemand gerade hinschaut. Läuft sofort wieder
  // an, sobald der Tab zurück in den Fokus kommt.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (document.hidden) {
        schedule();
        return;
      }
      try {
        const res = await fetch(
          `/api/intern/messages/${conversationId}/poll?since=${encodeURIComponent(lastTimestampRef.current)}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const { messages: fresh } = (await res.json()) as { messages: Message[] };
          if (fresh.length > 0 && !cancelled) {
            setMessages((prev) => {
              // Eigene, optimistisch angehängte Nachrichten (id beginnt mit
              // "optimistic-") durch die echten Server-Versionen ersetzen,
              // statt sie zu duplizieren.
              const withoutOptimistic = prev.filter((m) => !m.id.startsWith('optimistic-'));
              const existingIds = new Set(withoutOptimistic.map((m) => m.id));
              const toAppend = fresh.filter((m) => !existingIds.has(m.id));
              return [...withoutOptimistic, ...toAppend];
            });
            lastTimestampRef.current = fresh[fresh.length - 1].createdAt;
            // Aktualisiert nebenbei auch den Ungelesen-Badge in der Nav
            // (unreadCount kommt aus dem Server-Layout).
            router.refresh();
          }
        }
      } catch {
        // Ein einzelner fehlgeschlagener Poll ist kein Drama -- der nächste
        // Versuch in POLL_INTERVAL_MS holt den Stand einfach nach.
      }
      schedule();
    }

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    schedule();

    function handleVisibilityChange() {
      // Beim Zurückkommen in den Tab sofort einmal pollen, statt bis zu
      // POLL_INTERVAL_MS zu warten -- fühlt sich responsiver an.
      if (!document.hidden && timer) {
        clearTimeout(timer);
        poll();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Bei neuen Nachrichten ans Ende scrollen -- sowohl beim eigenen Senden
  // als auch bei über Polling eintreffenden fremden Nachrichten.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    const res = await fetch(`/api/intern/messages/${conversationId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body }),
    });

    if (res.ok) {
      setDraft('');
      // Optimistisch direkt anhängen, damit sich das Senden sofort reagiert
      // anfühlt -- der nächste Poll-Zyklus ersetzt sie durch die echte
      // Server-Version (siehe Dedupe-Logik oben), router.refresh() holt
      // zusätzlich den aktuellen Nav-Badge-Stand nach.
      setMessages((prev) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          body,
          messageType: 'message',
          createdAt: new Date().toISOString(),
          senderOrganizationId: ownOrganizationId,
          senderOrganizationName: ownOrganizationName,
          senderUserName: ownUserName,
        },
      ]);
      router.refresh();
    } else {
      const responseBody = await res.json().catch(() => ({}));
      setError(responseBody.error ?? 'Nachricht konnte nicht gesendet werden.');
    }
    setSending(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-[13px] text-ink-2">Noch keine Nachrichten.</p>
        ) : (
          messages.map((msg) => {
            if (msg.messageType === 'system') {
              return (
                <div key={msg.id} className="text-center text-[11.5px] text-ink-3">
                  {msg.body}
                </div>
              );
            }
            const isOwn = msg.senderOrganizationId === ownOrganizationId;
            return (
              <div
                key={msg.id}
                className={`max-w-[80%] rounded-[10px] px-4 py-2.5 text-[13.5px] leading-[1.5] ${
                  isOwn ? 'ml-auto bg-ink text-white' : 'border border-line bg-white text-ink'
                }`}
              >
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className={`text-[12px] font-bold ${isOwn ? 'text-white' : 'text-ink'}`}>
                    {msg.senderOrganizationName ?? 'Organisation'}
                  </span>
                  {msg.senderUserName && (
                    <span className={`text-[10.5px] ${isOwn ? 'text-white/60' : 'text-ink-3'}`}>
                      {msg.senderUserName}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{msg.body}</div>
                <div
                  className={`mt-1 font-mono text-[10px] ${isOwn ? 'text-white/50' : 'text-ink-3'}`}
                >
                  {new Date(msg.createdAt).toLocaleString('de-DE')}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-none gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Nachricht schreiben … (Enter zum Senden, Umschalt+Enter für neue Zeile)"
          className="flex-1 rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex-none self-end rounded-md bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {sending ? '…' : 'Senden'}
        </button>
      </form>
      {error && <p className="mt-2 text-[12.5px] text-signal-deep">{error}</p>}
    </div>
  );
}
