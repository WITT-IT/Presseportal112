import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post, type Organization } from '@/lib/types';
import DarkMasthead from './DarkMasthead';
import SearchBox from './SearchBox';
import ContactForm from './ContactForm';
// NEUAUSRICHTUNG (Kunde, Juli 2026): Ticker vorübergehend ausgeblendet,
// Import bleibt zum leichten Wiedereinblenden auskommentiert stehen.
// import Ticker from './Ticker';

export default function Hero({
  latestImages,
  featuredPost,
  organizations,
}: {
  latestImages: Post[];
  featuredPost: Post | null;
  organizations: Organization[];
}) {
  // Manuell vom Admin festgelegtes Bild hat Vorrang -- ohne Festlegung
  // fällt's automatisch auf den zuletzt veröffentlichten Beitrag zurück,
  // damit die Startseite nie ganz ohne Hintergrundbild dasteht.
  const heroSourcePost = featuredPost ?? latestImages[0] ?? null;
  const backdropImage = heroSourcePost ? primaryImage(heroSourcePost)?.file_public_preview : undefined;

  return (
    <DarkMasthead
      backgroundImageUrl={
        backdropImage ? directusAssetUrl(backdropImage, 'width=2000&quality=70') : null
      }
    >
      <div className="px-8 py-20 nav:py-28">
        {/* Zweispaltig ab dem nav-Breakpoint: links der Hero-Text, rechts
            das Kontaktformular als schwebende helle Karte gegen den
            dunklen Hintergrund. Darunter (mobil) stapelt sich das Formular
            einfach unter den Text. */}
        <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 nav:grid-cols-[1.15fr_420px] nav:gap-14">
          <div>
            <div className="mb-7 flex items-center gap-2.5">
              <span className="relative h-1.5 w-1.5 flex-none">
                <span className="absolute inset-0 rounded-full bg-signal" />
                <span className="animate-live-pulse absolute inset-0 rounded-full bg-signal" />
              </span>
              <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-amber">
                Live &middot; Presseportal112
              </span>
            </div>

            <h1 className="mb-7 font-display text-[clamp(34px,6.5vw,84px)] font-bold leading-[0.98] tracking-[-0.015em] text-white">
              Das Portal der Blaulichtfamilie.
            </h1>

            <p className="mb-10 max-w-[520px] text-[16px] leading-[1.68] text-white/60">
              Presseportal112 bündelt freigegebene Einsatzbilder deutscher
              BOS-Organisationen an einem Ort. Geprüft, verifiziert und sofort
              einsatzbereit für die Berichterstattung.
            </p>

            <div className="max-w-[460px]">
              <div className="mb-2.5 flex items-center gap-2">
                <i className="ti ti-search text-[13px] text-white/40" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
                  Schlagwortsuche
                </span>
              </div>
              <SearchBox dark />
            </div>

            {/*
              NEUAUSRICHTUNG (Kunde, August 2026): Beide Hero-Buttons
              ausgeblendet, nur die Suchleiste bleibt aktiv. Code bleibt
              erhalten -- zum Wiedereinblenden diesen Kommentarblock
              entfernen.
            <div className="mt-10 flex flex-wrap items-center gap-3.5">
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
            */}
          </div>

          {/* Schwebende Kontaktformular-Karte -- bewusst im hellen
              "Papier"-Look, als klarer Kontrast zum dunklen Hero drumherum. */}
          <div className="rounded-[14px] bg-white p-6 shadow-[0_25px_70px_rgba(0,0,0,0.45)] nav:p-7">
            <h2 className="mb-2 font-display text-[19px] font-bold text-ink">
              Anfrage stellen
            </h2>
            <p className="mb-5 text-[12.5px] leading-[1.6] text-ink-2">
              Du suchst ein bestimmtes Bild, möchtest Bildmaterial anfragen
              oder mit einer Organisation in Kontakt treten? Schreib uns
              direkt.
            </p>
            <ContactForm organizations={organizations} />
          </div>
        </div>
      </div>

      {/*
        NEUAUSRICHTUNG (Kunde, Juli 2026): Laufband ausgeblendet, Code
        bleibt erhalten -- zum Wiedereinblenden Import oben und Zeile hier
        entkommentieren.
      <Ticker images={latestImages} />
      */}
    </DarkMasthead>
  );
}
