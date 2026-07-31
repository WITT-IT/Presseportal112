import Hero from '@/components/Hero';
import {
  getFeaturedHeroPost,
  getGewerke,
  getLatestPublicImages,
  getPublicImageCountsByGewerk,
  getTotalOrganizationCount,
  getTotalPublicImageCount,
} from '@/lib/queries';

// Diese Seite braucht immer den aktuellen Stand aus Directus (öffentliche
// Bildfreigaben ändern sich laufend) -- deshalb kein statisches Caching.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Fällt Directus mal aus, soll die Seite trotzdem laden statt komplett
  // abzustürzen -- deshalb hier bewusst weich abgefangen, nicht einfach
  // await Promise.all([...]) ohne Netz.
  //
  // HINWEIS (Neuausrichtung): gewerke/counts/totalImages/totalOrganizations
  // werden aktuell von keinem sichtbaren Abschnitt mehr gebraucht (siehe
  // die auskommentierten Blöcke unten), bleiben aber bewusst stehen --
  // spart beim Wiedereinblenden das erneute Verdrahten.
  let gewerke: Awaited<ReturnType<typeof getGewerke>> = [];
  let counts: Record<string, number> = {};
  let latestImages: Awaited<ReturnType<typeof getLatestPublicImages>> = [];
  let totalImages = 0;
  let totalOrganizations = 0;
  let directusError = false;

  try {
    gewerke = await getGewerke();
    [counts, latestImages, totalImages, totalOrganizations] = await Promise.all([
      getPublicImageCountsByGewerk(gewerke.map((g) => g.id)),
      getLatestPublicImages(8),
      getTotalPublicImageCount(),
      getTotalOrganizationCount(),
    ]);
  } catch (error) {
    console.error('Directus nicht erreichbar:', error);
    directusError = true;
  }

  // Eigener, separat abgesicherter Aufruf: schlägt das Laden des manuell
  // festgelegten Titelbilds fehl, soll die Startseite trotzdem laden --
  // einfach mit dem "neuester Beitrag"-Fallback in Hero.tsx.
  let featuredPost: Awaited<ReturnType<typeof getFeaturedHeroPost>> = null;
  try {
    featuredPost = await getFeaturedHeroPost();
  } catch (error) {
    console.error('Titelbild konnte nicht geladen werden:', error);
  }

  return (
    <>
      {directusError && (
        <div className="border-b border-line bg-panel px-8 py-3 text-center text-[12.5px] text-ink-2">
          Die Verbindung zu Directus steht gerade nicht -- diese Seite zeigt
          keine aktuellen Daten. Bitte prüfe die{' '}
          <code className="font-mono">NEXT_PUBLIC_DIRECTUS_URL</code> und ob
          das Directus-Projekt erreichbar ist.
        </div>
      )}

      <Hero latestImages={latestImages} featuredPost={featuredPost} />

      {/*
        NEUAUSRICHTUNG (Kunde, Juli 2026): Portal wird vom reinen
        Presseportal zu einem Upload-/Anfrage-Portal umgebaut. Die
        Gewerke-Übersicht ist bis auf Weiteres ausgeblendet, Code bleibt
        erhalten -- zum Wiedereinblenden diesen Kommentarblock entfernen.

      <section className="px-8 py-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
              Die vier Gewerke
            </h2>
            <Link
              href="/organisationen"
              className="flex items-center gap-1 text-[12.5px] font-semibold text-signal-deep"
            >
              Alle Organisationen
              <i className="ti ti-arrow-up-right text-[14px]" aria-hidden="true" />
            </Link>
          </div>
          <GewerkeGrid gewerke={gewerke} counts={counts} />
        </div>
      </section>
      */}

      {/*
        NEUAUSRICHTUNG (Kunde, Juli 2026): "Zuletzt freigegeben" ebenfalls
        ausgeblendet, Code bleibt erhalten.

      <section className="px-8 pb-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
              Zuletzt freigegeben
            </h2>
            <Link
              href="/bildarchiv"
              className="flex items-center gap-1 text-[12.5px] font-semibold text-signal-deep"
            >
              Gesamtes Archiv
              <i className="ti ti-arrow-up-right text-[14px]" aria-hidden="true" />
            </Link>
          </div>
          <PhotoMosaic images={latestImages} />
        </div>
      </section>
      */}

      {/*
        NEUAUSRICHTUNG (Kunde, Juli 2026): Statistik-Leiste ebenfalls
        ausgeblendet, da sie nach dem Entfernen der beiden Blöcke oben
        allein am Seitenende stehen würde. Code bleibt erhalten.

      <StatStrip totalImages={totalImages} totalOrganizations={totalOrganizations} />
      */}
    </>
  );
}
