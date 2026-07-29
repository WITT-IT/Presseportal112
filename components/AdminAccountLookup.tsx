'use client';

import { useState } from 'react';
import { useDialog } from './DialogProvider';

const CONFIRM_PHRASE = 'KONTO LÖSCHEN';

type LookupResult = {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  status: string;
  publicCount: number;
  privateCount: number;
};

export default function AdminAccountLookup() {
  const { confirm } = useDialog();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [phrase, setPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSearch() {
    if (!email.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setDone(false);
    setPhrase('');

    const res = await fetch(`/api/admin/lookup-user?email=${encodeURIComponent(email.trim())}`);
    if (res.ok) {
      setResult(await res.json());
    } else {
      const body = await res.json().catch(() => ({}));
      setSearchError(body.error ?? 'Suche fehlgeschlagen.');
    }
    setSearching(false);
  }

  async function handleDelete() {
    if (!result) return;
    const confirmed = await confirm({
      title: `Konto von ${result.email} wirklich löschen?`,
      message: 'Das kann nicht rückgängig gemacht werden.',
      confirmLabel: 'Endgültig löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmPhrase: phrase.trim(), targetUserId: result.id }),
    });

    if (res.ok) {
      setDone(true);
      setResult(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? 'Löschen fehlgeschlagen.');
    }
    setDeleting(false);
  }

  const ready = phrase.trim() === CONFIRM_PHRASE;

  return (
    <div className="rounded-[10px] border border-line bg-white p-6">
      <h2 className="mb-2 font-display text-[16px] font-bold">Konto eines Nutzers löschen</h2>
      <p className="mb-4 text-[13px] leading-[1.6] text-ink-2">
        Sucht ein Konto per E-Mail-Adresse und löscht es mit derselben Logik
        wie die Selbstlöschung -- private Beiträge werden entfernt,
        öffentliche bleiben ohne Kontozuordnung im Archiv erhalten.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="nutzer@organisation.de"
          className="flex-1 rounded-md border border-line-strong px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !email.trim()}
          className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {searching ? '…' : 'Suchen'}
        </button>
      </div>

      {searchError && <p className="mb-3 text-[12.5px] text-signal-deep">{searchError}</p>}
      {done && <p className="mb-3 text-[12.5px] text-ink">Konto wurde gelöscht.</p>}

      {result && (
        <div className="rounded-md border border-signal/40 bg-panel p-4">
          <div className="mb-3 text-[13px] text-ink-2">
            <div>
              <b className="text-ink">{result.name || result.email}</b>
            </div>
            <div>{result.email}</div>
            <div>
              {result.organization ?? 'Keine Organisation'} · Status: {result.status}
            </div>
            <div className="mt-1">
              {result.privateCount} nur intern · {result.publicCount} öffentlich
            </div>
          </div>

          <label className="mb-1.5 block text-[12px] font-medium text-ink-2">
            Zur Bestätigung <b className="text-ink">{CONFIRM_PHRASE}</b> eingeben
          </label>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={deleting}
            autoComplete="off"
            placeholder={CONFIRM_PHRASE}
            className="mb-3 w-full rounded-md border border-signal/40 px-3 py-2 text-[13px] outline-none focus:border-signal-deep"
          />

          {deleteError && <p className="mb-3 text-[12.5px] text-signal-deep">{deleteError}</p>}

          <button
            type="button"
            onClick={handleDelete}
            disabled={!ready || deleting}
            className="w-full rounded-md bg-signal-deep px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3"
          >
            {deleting ? 'Konto wird gelöscht …' : 'Dieses Konto dauerhaft löschen'}
          </button>
        </div>
      )}
    </div>
  );
}
