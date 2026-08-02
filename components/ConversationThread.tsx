'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  id: string;
  body: string;
  messageType: string;
  createdAt: string;
  senderOrganizationId: string | null;
  senderOrganizationName: string | null;
};

export default function ConversationThread({
  conversationId,
  initialMessages,
  ownOrganizationId,
}: {
  conversationId: string;
  initialMessages: Message[];
  ownOrganizationId: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // anfühlt -- router.refresh() holt beim nächsten Server-Render sowieso
      // den endgültigen, korrekten Stand nach.
      setMessages((prev) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          body,
          messageType: 'message',
          createdAt: new Date().toISOString(),
          senderOrganizationId: ownOrganizationId,
          senderOrganizationName: null,
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
    <div>
      <div className="mb-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-[13px] text-ink-2">Noch keine Nachrichten.</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderOrganizationId === ownOrganizationId;
            return (
              <div
                key={msg.id}
                className={`max-w-[80%] rounded-[10px] px-4 py-2.5 text-[13.5px] leading-[1.5] ${
                  isOwn ? 'ml-auto bg-ink text-white' : 'border border-line bg-white text-ink'
                }`}
              >
                {!isOwn && (
                  <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">
                    {msg.senderOrganizationName ?? 'Organisation'}
                  </div>
                )}
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
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
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
