import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllOrganizations, getGewerke } from '@/lib/queries';
import OrganizationSearch from '@/components/OrganizationSearch';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Für Organisationen',
  description:
    'Alle angeschlossenen BOS-Organisationen im Überblick — und wie deine Organisation dazukommt.',
};

export default async function OrganisationenPage() {
  let organizations: Awaited<ReturnType<typeof getAllOrganizations>> = [];
  let gewerke: Awaited<ReturnType<typeof getGewerke>> = [];
  try {
    [organizations, gewerke] = await Promise.all([getAllOrganizations(), getGewerke()]);
    // Presse-"Organisationen" gehören nicht ins BOS-Verzeichnis -- das hier
    // ist für Presseleute gedacht, die eine echte Organisation suchen.
    organizations = organizations.filter((org) => org.organization_type !== 'press');
  } catch (error) {
    console.error('Organisationsverzeichnis: Laden fehlgeschlagen:', error);
  }

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 flex flex-col items-start justify-between gap-6 border-b border-line pb-10 nav:flex-row nav:items-end">
          <div>
            <h1 className="mb-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em]">
              Für Organisationen
            </h1>
            <p className="max-w-[520px] text-[15px] leading-[1.6] text-ink-2">
              Presseportal112 ist kostenlos für Feuerwehr, DRK, Polizei und
              THW. Registrier deine Organisation, wir schalten euch nach
              kurzer Prüfung frei.
            </p>
          </div>
          <Link
            href="/registrieren?type=organisation"
            className="inline-flex flex-none items-center gap-2 rounded-md bg-ink px-6 py-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            Organisation registrieren
            <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
          </Link>
        </div>
        <OrganizationSearch organizations={organizations} gewerke={gewerke} />
      </div>
    </section>
  );
}
