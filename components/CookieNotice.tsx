'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pp112_cookie_notice_ack';

const COOKIE_DETAILS: { label: string; value: string }[] = [
  { label: 'Name', value: 'pp_session' },
  { label: 'Zweck', value: 'Aufrechterhaltung des Anmeldestatus im internen Bereich' },
  { label: 'Typ', value: 'Technisch notwendiges First-Party-Cookie' },
  { label: 'Wird gesetzt bei', value: 'Aktiver Anmeldung unter /login (nicht beim bloßen Betrachten der Seite)' },
  { label: 'Inhalt', value: 'Verschlüsselte Sitzungskennung — keine Klarnamen, keine Trackingdaten' },
  { label: 'Speicherdauer', value: 'Max. 10 Minuten Inaktivität oder bis zur aktiven Abmeldung' },
  { label: 'Zugriff per JavaScript', value: 'Nicht möglich (httpOnly-Cookie)' },
  { label: 'Übertragung', value: 'Ausschließlich verschlüsselt (HTTPS)' },
  { label: 'Empfänger', value: 'Ausschließlich unser eigener Server — keine Weitergabe an Dritte' },
  { label: 'Rechtsgrundlage', value: '§ 25 Abs. 2 Nr. 2 TDDDG i. V. m. Art. 6 Abs. 1 lit. b DSGVO' },
];

export default function CookieNotice() {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ack = localStorage.getItem(STORAGE_KEY);
    if (!ack) {
      setExpanded(true);
    }
  }, []);

  function acknowledge() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setExpanded(false);
  }

  // Vor dem ersten Rendern im Browser nichts anzeigen -- verhindert einen
  // Server/Client-Mismatch, weil der Server localStorage nicht kennt.
  if (!mounted) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Cookie-Einstellungen öffnen"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2.5 text-[12px] font-semibold text-ink shadow-md transition-colors hover:border-ink"
      >
        <i className="ti ti-cookie text-[15px]" aria-hidden="true" />
        Cookie-Einstellungen
      </button>
    );
  }

  return (
    // Der äußere Container ist bewusst NICHT klickblockierend
    // (pointer-events-none) -- nur die Karte selbst reagiert auf Klicks.
    // So ist der Hinweis mittig und unübersehbar, ohne den Rest der Seite
    // zu sperren.
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="pointer-events-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-[12px] border border-line-strong bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2.5">
          <i className="ti ti-cookie text-[20px] text-ink" aria-hidden="true" />
          <h2 className="font-display text-[19px] font-bold">Cookie-Hinweis</h2>
        </div>

        <p className="mb-4 text-[13px] leading-[1.6] text-ink-2">
          Diese Website setzt genau <b>ein</b> Cookie — und zwar ausschließlich dann, wenn Sie
          sich als Mitarbeiter:in einer angeschlossenen Organisation anmelden. Für den
          öffentlichen Bereich (Bildarchiv, Artikelseiten, Kontaktformular, Registrierung,
          Presse-Alarm) wird <b>kein</b> Cookie gesetzt.
        </p>

        <div className="mb-4 rounded-md border border-line bg-panel p-3 text-[11.5px] leading-[1.6] text-ink-2">
          Dieses eine Cookie ist technisch notwendig, um die Anmeldefunktion bereitzustellen.
          Nach § 25 Abs. 2 Nr. 2 TDDDG ist dafür <b>keine Einwilligung</b> erforderlich — wir
          zeigen diesen Hinweis trotzdem, damit Sie genau wissen, woran Sie sind.
        </div>

        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mb-4 flex items-center gap-1 text-[12.5px] font-semibold text-signal-deep hover:text-signal"
          >
            Vollständige technische Details anzeigen
            <i className="ti ti-chevron-down text-[13px]" aria-hidden="true" />
          </button>
        ) : (
          <div className="mb-4 divide-y divide-line rounded-md border border-line">
            {COOKIE_DETAILS.map((row) => (
              <div key={row.label} className="p-2.5">
                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-3">
                  {row.label}
                </div>
                <div className="text-[12px] leading-[1.5] text-ink">{row.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href="/datenschutz"
            className="text-[12px] font-medium text-ink-2 hover:text-ink"
          >
            Zur Datenschutzerklärung
          </a>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
