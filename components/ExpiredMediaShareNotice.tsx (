import Link from 'next/link';

// Erklärt freundlich, warum ein Medienfreigabe-Link nicht mehr funktioniert
// -- statt der nichtssagenden generischen 404-Seite. Zwei Zustände:
// abgelaufen (Gültigkeit verstrichen) und deaktiviert (von der Organisation
// bewusst zurückgezogen). Beide Fälle bekommen denselben ruhigen Rahmen,
// nur Symbol und Wortlaut passen sich an.
export default function ExpiredMediaShareNotice({
  state,
  name,
  organizationName,
  expiresAt,
}: {
  state: 'expired' | 'deactivated';
  name: string;
  organizationName: string | null;
  expiresAt: string;
}) {
  const isExpired = state === 'expired';

  return (
    <main className="flex min-h-screen items-center bg-gradient-to-b from-white via-paper to-paper px-4 py-16">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_1px_2px_rgba(16,17,20,0.04),0_18px_40px_rgba(16,17,20,0.08)]">
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div
              className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${
                isExpired ? 'bg-amber/15 text-amber' : 'bg-panel text-ink-3'
              }`}
              aria-hidden="true"
            >
              {isExpired ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.2 2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                  <path d="M9.5 12l1.8 1.8L15 10" opacity="0" />
                  <path d="M9 9l6 6M15 9l-6 6" />
                </svg>
              )}
            </div>

            <span className="mb-3 inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
              {isExpired ? 'Freigabe abgelaufen' : 'Freigabe deaktiviert'}
            </span>

            <h1 className="mb-3 font-display text-[28px] leading-[1.05] text-ink">
              Dieser Link funktioniert nicht mehr
            </h1>

            <p className="mb-1 max-w-[420px] text-[14.5px] leading-[1.65] text-ink-2">
              {isExpired ? (
                <>
                  Die Medienfreigabe <b className="text-ink">„{name}"</b>
                  {organizationName ? (
                    <>
                      {' '}von <b className="text-ink">{organizationName}</b>
                    </>
                  ) : null}{' '}
                  war nur bis zum{' '}
                  <b className="text-ink">{new Date(expiresAt).toLocaleDateString('de-DE')}</b>{' '}
                  gültig und ist seitdem automatisch abgelaufen.
                </>
              ) : (
                <>
                  Die Medienfreigabe <b className="text-ink">„{name}"</b>
                  {organizationName ? (
                    <>
                      {' '}von <b className="text-ink">{organizationName}</b>
                    </>
                  ) : null}{' '}
                  wurde von der Organisation zurückgezogen und ist nicht mehr aufrufbar.
                </>
              )}
            </p>

            <p className="mb-8 max-w-[420px] text-[13px] leading-[1.6] text-ink-3">
              Das ist normal und kein technischer Fehler — Freigaben sind
              bewusst zeitlich begrenzt, damit Bildmaterial nicht dauerhaft
              frei zugänglich bleibt.
            </p>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/kontakt"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-signal-deep"
              >
                Neuen Link anfragen
              </Link>
              <Link
                href="/bildarchiv"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
              >
                Zum öffentlichen Bildarchiv
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11.5px] text-ink-3">
          Falls du glaubst, dass das ein Fehler ist, wende dich direkt an die
          Organisation, die dir den Link geschickt hat.
        </p>
      </div>
    </main>
  );
}
