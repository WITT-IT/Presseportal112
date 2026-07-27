import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';
import DarkMasthead from './DarkMasthead';
import SearchBox from './SearchBox';
import Ticker from './Ticker';

export default function Hero({ latestImages }: { latestImages: Post[] }) {
  const backdropImage = latestImages
    .map((p) => primaryImage(p))
    .find((img) => img?.file_public_preview)?.file_public_preview;

  return (
    <DarkMasthead
      backgroundImageUrl={
        backdropImage ? directusAssetUrl(backdropImage, 'width=2000&quality=70') : null
      }
      minHeight="min(88vh, 860px)"
    >
      <div className="flex flex-col justify-center px-8 py-24 nav:py-0" style={{ minHeight: 'min(80vh, 780px)' }}>
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="mb-7 flex items-center gap-2.5">
            <span className="relative h-1.5 w-1.5 flex-none">
              <span className="absolute inset-0 rounded-full bg-signal" />
              <span className="animate-live-pulse absolute inset-0 rounded-full bg-signal" />
            </span>
            <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-amber">
              Live &middot; Presseportal112
            </span>
          </div>

          <h1 className="mb-7 max-w-[980px] font-display text-[clamp(38px,9vw,116px)] font-bold leading-[0.94] tracking-[-0.015em] text-white">
            Das Portal der Blaulichtfamilie.
          </h1>

          <p className="mb-10 max-w-[560px] text-[17px] leading-[1.68] text-white/60">
            Presseportal112 bündelt freigegebene Einsatzbilder deutscher
            BOS-Organisationen an einem Ort — geprüft, verifiziert und sofort
            einsatzbereit für die Berichterstattung.
          </p>

          <div className="mb-10 max-w-[480px]">
            <div className="mb-2.5 flex items-center gap-2">
              <i className="ti ti-search text-[13px] text-white/40" aria-hidden="true" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
                Schlagwortsuche
              </span>
            </div>
            <SearchBox dark />
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href="/bildarchiv"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3.5 text-[13.5px] font-semibold text-void transition-colors hover:bg-white/90 active:scale-[0.98]"
            >
              Bildarchiv durchsuchen
              <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
            </Link>
            <Link
              href="/presse-alarm"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-6 py-3.5 text-[13.5px] font-semibold text-white transition-colors hover:border-white/40"
            >
              Presse-Alarm aktivieren
              <i className="ti ti-chevron-right text-[15px]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <Ticker images={latestImages} />
    </DarkMasthead>
  );
}
