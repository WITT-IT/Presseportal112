import Link from 'next/link';
import SearchBox from './SearchBox';

export default function Hero() {
  return (
    <section className="px-8 py-[88px] pb-[52px]">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="h-[1.5px] w-[26px] bg-signal" aria-hidden="true" />
          <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-signal-deep">
            Offizielles Bild- und Medienportal
          </span>
        </div>

        <h1 className="mb-6 max-w-[720px] font-display text-[42px] font-bold leading-[0.98] tracking-[-0.01em] nav:text-[64px]">
          Einsatzfotos direkt von{' '}
          <span className="shadow-[inset_0_-0.09em_0_theme(colors.signal.DEFAULT)]">
            Feuerwehr, DRK, Polizei und THW
          </span>
        </h1>

        <p className="mb-9 max-w-[540px] text-[17px] leading-[1.68] text-ink-2">
          Presseportal112 bündelt freigegebene Einsatzbilder deutscher
          BOS-Organisationen an einem Ort — geprüft, nach Alarmcode sortiert
          und sofort einsatzbereit für die Berichterstattung.
        </p>

        <div className="max-w-[480px]">
          <div className="mb-2.5 flex items-center gap-2">
            <i className="ti ti-search text-[13px] text-ink-3" aria-hidden="true" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
              Schlagwortsuche
            </span>
          </div>
          <SearchBox />
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <Link
            href="/bildarchiv"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-6 py-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black active:scale-[0.98]"
          >
            Bildarchiv durchsuchen
            <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
          </Link>
          <Link
            href="/organisationen"
            className="inline-flex items-center gap-1.5 py-3.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            Für Organisationen
            <i className="ti ti-chevron-right text-[15px]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
