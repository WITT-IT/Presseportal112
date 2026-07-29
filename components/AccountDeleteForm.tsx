'use client';

import { useState } from 'react';
import { useDialog } from './DialogProvider';

const CONFIRM_PHRASE = 'KONTO LÖSCHEN';

export default function AccountDeleteForm({
  privateCount,
  publicCount,
}: {
  privateCount: number;
  publicCount: number;
}) {
  const { confirm } = useDialog();
  const [understood, setUnderstood] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = understood && phrase.trim() === CONFIRM_PHRASE;

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Konto wirklich endgültig löschen?',
      message: 'Das kann nicht rückgängig gemacht werden.',
      confirmLabel: 'Endgültig löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmPhrase: phrase.trim() }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Löschen fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-signal/40 bg-white p-6">
      <h2 className="mb-2 font-display text-[16px] font-bold text-signal-deep">
        Konto dauerhaft löschen
      </h2>
      <p className="mb-3 text-[13px] leading-[1.6] text-ink-2">
        Nach der Bestätigung werden dein Benutzerkonto, deine Anmeldedaten und
        alle <b>{privateCount} nicht öffentlich veröffentlichten Beiträge</b>{' '}
        dieses Kontos dauerhaft gelöscht.
      </p>
      <div className="mb-4 rounded-md border border-line bg-panel p-3 text-[12px] leading-[1.6] text-ink-2">
        <b className="text-ink">Öffentliche Beiträge bleiben erhalten.</b> Deine{' '}
        {publicCount} veröffentlichten Beiträge verbleiben mit
        Organisationsname und Wasserzeichen im öffentlichen Pressearchiv,
        ohne persönliche Zuordnung zu deinem Konto. Sollen einzelne davon
        ebenfalls entfernt werden, setze sie vorher unter „Meine Bilder" auf
        „Zurückziehen".
      </div>

      {error && <p className="mb-3 text-[12.5px] text-signal-deep">{error}</p>}

      <label className="mb-3 flex items-start gap-2 text-[12px] leading-[1.5] text-ink-2">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          disabled={busy}
          className="mt-0.5"
        />
        <span>
          Mir ist bekannt, dass öffentliche Beiträge bis zu ihrer eigenen
          Löschung erhalten bleiben.
        </span>
      </label>

      <label className="mb-1.5 block text-[12px] font-medium text-ink-2">
        Zur Bestätigung <b className="text-ink">{CONFIRM_PHRASE}</b> eingeben
      </label>
      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        disabled={busy}
        autoComplete="off"
        placeholder={CONFIRM_PHRASE}
        className="mb-4 w-full rounded-md border border-signal/40 px-3 py-2 text-[13px] outline-none focus:border-signal-deep"
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={!ready || busy}
        className="w-full rounded-md bg-signal-deep px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3"
      >
        {busy ? 'Konto wird gelöscht …' : 'Konto und private Daten dauerhaft löschen'}
      </button>
    </div>
  );
}
