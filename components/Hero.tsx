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
      // "100dvh" ist der Default in DarkMasthead selbst -- hier trotzdem
      // explizit gesetzt: der Hero ist nie kürzer als eine Bildschirmhöhe.
      // Reicht die Höhe für den Inhalt nicht, wächst der Container mit,
      // das Hintergrundbild füllt ihn dabei immer vollständig aus (siehe
      // DarkMasthead.tsx). Wie stark der Container überhaupt wachsen muss,
      // wird unten über clamp()-Abstände so klein wie möglich gehalten.
      minHeight="100dvh"
    >
      {/* Außenabstände fluid statt fest: clamp(Minimum, X% der aktuellen
          Fensterhöhe, Maximum). Bei viel Platz (großes/maximiertes Fenster)
          greift das Maximum -- sieht aus wie vorher. Bei wenig Platz
          (kleines Fenster) schrumpft der Abstand automatisch Richtung
          Minimum, statt stur auf 64/80px zu bestehen und den Rest nach
          unten aus dem Fenster zu drücken. */}
      <div
        className="px-8"
        style={{
          paddingTop: 'clamp(28px, 6dvh, 80px)',
          paddingBottom: 'clamp(24px, 5dvh, 64px)',
        }}
      >
        {/* Ab dem nav-Breakpoint zweispaltig: links Text + Suche, rechts
            das Formular. Darunter (mobil) stapelt sich alles einfach --
            explizit "grid-cols-1" als Basis, nicht nur implizit. Der Gap
            zwischen den Spalten ist aus demselben Grund fluid wie oben. */}
        <div
          className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-start nav:grid-cols-[1.1fr_400px]"
          style={{ gap: 'clamp(20px, 4dvh, 48px)' }}
        >
          <div>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="relative h-1.5 w-1.5 flex-none">
                <span className="absolute inset-0 rounded-full bg-signal" />
                <span className="animate-live-pulse absolute inset-0 rounded-full bg-signal" />
              </span>
              <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-amber">
                Live &middot; Presseportal112
              </span>
            </div>

            <h1 className="mb-5 font-display text-[clamp(32px,6vw,76px)] font-bold leading-[0.98] tracking-[-0.015em] text-white">
              Das Portal der Blaulichtfamilie.
            </h1>

            <p className="mb-8 max-w-[500px] text-[15.5px] leading-[1.65] text-white/60">
              Presseportal112 bündelt freigegebene Einsatzbilder deutscher
              BOS-Organisationen an einem Ort. Geprüft, verifiziert und sofort
              einsatzbereit für die Berichterstattung.
            </p>

            <div className="max-w-[440px]">
              <div className="mb-2.5 flex items-center gap-2">
                <i className="ti ti-search text-[13px] text-white/40" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
                  Schlagwortsuche
                </span>
              </div>
              <SearchBox dark />
            </div>

            {/* Bewusst freier Platz hier -- Text/Suche sind absichtlich
                kompakt nach oben gehalten, damit hier noch Raum für
                weiteren Inhalt ist. */}

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

          {/* Kein weißer Kasten mehr -- die Karte selbst ist jetzt verglast
              (ContactForm mit dark-Prop), fügt sich in den Hero ein statt
              als Fremdkörper draufzusitzen. */}
          <div>
            <h2 className="mb-1.5 font-display text-[18px] font-bold text-white">
              Anfrage stellen
            </h2>
            <p className="mb-4 text-[12.5px] leading-[1.6] text-white/55">
              Du suchst ein bestimmtes Bild, möchtest Bildmaterial anfragen
              oder mit einer Organisation in Kontakt treten? Schreib uns
              direkt.
            </p>
            <ContactForm organizations={organizations} dark />
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
