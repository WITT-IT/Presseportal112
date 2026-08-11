'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

type Participant = {
  organizationId: string;
  organizationName: string;
  isModerator: boolean;
};

export default function GroupManagementPanel({
  conversationId,
  participants,
  availableOrganizations,
  isOwnModerator,
  ownOrganizationId,
}: {
  conversationId: string;
  participants: Participant[];
  availableOrganizations: { id: string; name: string }[];
  isOwnModerator: boolean;
  ownOrganizationId: string;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addChoice, setAddChoice] = useState('');
  const [transferChoice, setTransferChoice] = useState('');

  async function handleAdd() {
    if (!addChoice) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/messages/${conversationId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: addChoice }),
    });
    setBusy(false);
    if (res.ok) {
      setAddChoice('');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Hinzufügen fehlgeschlagen.');
    }
  }

  async function handleRemove(orgId: string, name: string) {
    const confirmed = await confirm({
      title: 'Teilnehmer entfernen?',
      message: `${name} wirklich aus dieser Unterhaltung entfernen? Die Organisation kann den Verlauf danach nicht mehr öffnen.`,
      confirmLabel: 'Entfernen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/messages/${conversationId}/participants/${orgId}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Entfernen fehlgeschlagen.');
    }
  }

  async function handleTransfer() {
    if (!transferChoice) return;
    const target = participants.find((p) => p.organizationId === transferChoice);
    if (!target) return;

    const confirmed = await confirm({
      title: 'Moderation übertragen?',
      message: `Moderation wirklich an ${target.organizationName} übertragen? Danach kann nur diese Organisation andere Teilnehmer entfernen.`,
      confirmLabel: 'Übertragen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/messages/${conversationId}/moderator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newModeratorOrganizationId: transferChoice }),
    });
    setBusy(false);
    if (res.ok) {
      setTransferChoice('');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Übertragung fehlgeschlagen.');
    }
  }

  async function handleLeave() {
    const confirmed = await confirm({
      title: 'Unterhaltung verlassen?',
      message: 'Diese Unterhaltung wirklich verlassen? Du kannst sie danach nicht mehr öffnen.',
      confirmLabel: 'Verlassen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/messages/${conversationId}/leave`, { method: 'POST' });
    setBusy(false);
    if (res.ok) {
      router.push('/intern/nachrichten');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Verlassen fehlgeschlagen.');
    }
  }

  const otherParticipants = participants.filter((p) => p.organizationId !== ownOrganizationId);

  return (
    <div className="mb-6 flex-none rounded-[10px] border border-line bg-panel p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[12.5px] font-semibold text-ink-2"
      >
        <span className="flex items-center gap-1.5">
          <i className="ti ti-users text-[15px]" aria-hidden="true" />
          {participants.length} Teilnehmer
        </span>
        <i
          className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} text-[15px]`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {participants.map((p) => (
              <div
                key={p.organizationId}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-[12.5px]"
              >
                <span className="flex items-center gap-1.5">
                  {p.organizationName}
                  {p.isModerator && (
                    <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      MODERATION
                    </span>
                  )}
                </span>
                {isOwnModerator && p.organizationId !== ownOrganizationId && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.organizationId, p.organizationName)}
                    disabled={busy}
                    className="text-[11px] font-semibold text-signal-deep hover:text-signal disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Hinzufügen: jetzt für JEDEN Teilnehmer möglich, nicht mehr nur
              die Moderation -- dafür bleibt Entfernen exklusiv oben. */}
          {availableOrganizations.length > 0 && (
            <div className="flex gap-2">
              <select
                value={addChoice}
                onChange={(e) => setAddChoice(e.target.value)}
                className="flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-[12.5px] outline-none focus:border-ink"
              >
                <option value="">Organisation hinzufügen …</option>
                {availableOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || !addChoice}
                className="flex-none rounded-md bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
          )}

          {isOwnModerator && otherParticipants.length > 0 && (
            <div className="flex gap-2">
              <select
                value={transferChoice}
                onChange={(e) => setTransferChoice(e.target.value)}
                className="flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-[12.5px] outline-none focus:border-ink"
              >
                <option value="">Moderation übertragen an …</option>
                {otherParticipants.map((p) => (
                  <option key={p.organizationId} value={p.organizationId}>
                    {p.organizationName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={busy || !transferChoice}
                className="flex-none rounded-md border border-line-strong px-4 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                Übertragen
              </button>
            </div>
          )}

          {error && <p className="text-[12px] text-signal-deep">{error}</p>}

          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="self-start text-[11.5px] font-semibold text-signal-deep hover:text-signal disabled:opacity-50"
          >
            Unterhaltung verlassen
          </button>
        </div>
      )}
    </div>
  );
}
