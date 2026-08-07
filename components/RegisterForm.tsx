'use client';

import { useState, type FormEvent } from 'react';
import type { Gewerk } from '@/lib/types';

type AccountType = 'organization' | 'press';

export default function RegisterForm({
  gewerke,
  defaultType = 'organization',
}: {
  gewerke: Gewerk[];
  defaultType?: AccountType;
}) {
  const [accountType, setAccountType] = useState<AccountType>(defaultType);

  // Geteilte Felder -- unabhängig davon, welcher Kontotyp gewählt ist.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Ein einziges Feld für "Name der Organisation" bzw. "Redaktion /
  // Publikation" -- beides landet im selben Directus-Feld
  // (requested_organization_name), nur Label/Platzhalter unterscheiden
  // sich unten je nach accountType.
  const [organizationName, setOrganizationName] = useState('');
  // Nur für Organisationen relevant.
  const [gewerkId, setGewerkId] = useState(gewerke[0]?.id ?? '');
  // Website wird von beiden Typen genutzt (bei Organisationen zusätzlich
  // eingebettet im "Für euren Auftritt"-Block mit Social Links).
  //const [website, setWebsite] = useState('');
  //const [facebook, setFacebook] = useState('');
  //const [instagram, setInstagram] = useState('');
  //const [otherSocial, setOtherSocial] = useState('');

  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        requested_organization_name: organizationName,
        // Gewerk und Social Links ergeben nur bei einer BOS-Organisation
        // Sinn -- bei Presse bewusst null, damit im Backend nichts
        // Halbgares landet. /api/auth/register validiert und verarbeitet
        // beide Fälle bereits korrekt, hier wird nur sauber vorsortiert.
        requested_gewerk: accountType === 'organization' ? gewerkId : null,
        requested_website: website || null,
        requested_social_links:
          accountType === 'organization'
            ? {
                facebook: facebook || undefined,
                instagram: instagram || undefined,
                sonstiges: otherSocial || undefined,
              }
            : null,
        requested_account_type: accountType,
      }),
    });

    if (res.ok) {
      setStatus('done');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Registrierung fehlgeschlagen.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <i className="ti ti-circle-check mb-3 block text-[32px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[22px] font-bold">Danke für die Anmeldung!</h2>
        <p className="text-[13.5px] text-ink-2">
          Wir prüfen {accountType === 'organization' ? 'eure' : 'deine'} Angaben und schalten{' '}
          {accountType === 'organization' ? 'euch' : 'dich'} in Kürze frei. Du bekommst dann
          Zugang unter „Anmelden".
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-6"
    >
      {/* Umschalter zuerst -- bestimmt, welche Felder weiter unten
          eingeblendet werden. Beide Buttons bewusst type="button", damit
          sie das Formular nicht versehentlich absenden. */}
      <div>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-line-strong bg-panel p-1">
          <button
            type="button"
            onClick={() => setAccountType('organization')}
            className={`rounded px-3 py-2 text-[13px] font-semibold transition-colors ${
              accountType === 'organization'
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            Organisation
          </button>
          <button
            type="button"
            onClick={() => setAccountType('press')}
            className={`rounded px-3 py-2 text-[13px] font-semibold transition-colors ${
              accountType === 'press' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Presse
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-3">
          {accountType === 'organization'
            ? 'Für Feuerwehr, Rettungsdienste, Polizei und THW.'
            : 'Für Redaktionen, Journalistinnen und Journalisten.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Vorname *
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
            Nachname *
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          {accountType === 'organization' ? 'Dienstliche E-Mail *' : 'Redaktionelle E-Mail *'}
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
          Passwort * (mind. 8 Zeichen)
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
        />
      </div>

      {accountType === 'organization' ? (
        <>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Name eurer Organisation *
            </label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="z. B. Freiwillige Feuerwehr Musterstadt"
              className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Gewerk *
            </label>
            <select
              required
              value={gewerkId}
              onChange={(e) => setGewerkId(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
            >
              {gewerke.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-line bg-panel p-3.5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-2">
              Für euren Auftritt (optional)
            </p>

            <div className="mb-3">
              {/* <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
              /> {*/
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="https://facebook.com/…"
                  className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  Instagram
                </label>
                <input
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/…"
                  className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Weiterer Link (z. B. X, YouTube, TikTok)
              </label>
              <input
                type="url"
                value={otherSocial}
                onChange={(e) => setOtherSocial(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] outline-none focus:border-ink"
              />
            </div>

            <p className="mt-2.5 text-[11px] text-ink-3">
              Landet zunächst bei der Redaktion und wird bei der Freigabe in
              euer Organisationsprofil übernommen.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Redaktion / Publikation *
            </label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="z. B. Südkurier, Radio 7, Lokalzeit …"
              className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
            />
            <p className="mt-1 text-[11px] text-ink-3">
              Wird Organisationen in Chat und Anfragen angezeigt, damit klar
              ist, für wen du unterwegs bist.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Website der Redaktion (optional)
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
            />
          </div>
        </>
      )}

      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-2 rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {status === 'sending' ? 'Wird gesendet …' : 'Registrierung absenden'}
      </button>
    </form>
  );
}
