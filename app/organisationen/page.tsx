import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllOrganizations, getGewerke } from '@/lib/queries';
import { GEWERK_ICONS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Für Organisationen',
  description:
    'Alle angeschlossenen BOS-Organisationen im Überblick — und wie deine Organisation dazukommt.',
};

export default async function OrganisationenPage() {
  const [organizations, gewerke] = await Promise.all([getAllOrganizations(), getGewerke()]);
  const gewerkById = Object.fromEntries(gewerke.map((g) => [g.id, g]));

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
            href="/organisationen/registrieren"
            className="inline-flex flex-none items-center gap-2 rounded-md bg-ink px-6 py-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            Organisation registrieren
            <i className="ti ti-arrow-right text-[16px]" aria-hidden="true" />
          </Link>
        </div>

        <h2 className="mb-5 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
          {organizations.length} angeschlossene Organisationen
        </h2>

        {organizations.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            Noch keine Organisation registriert.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 nav:grid-cols-3">
            {organizations.map((org) => {
              const gewerk = gewerkById[org.gewerk];
              return (
                <Link
                  key={org.id}
                  href={`/organisationen/${org.id}`}
                  className="flex items-center gap-3 rounded-[10px] border border-line bg-white p-4 transition-colors hover:border-line-strong"
                >
                  <i
                    className={`ti ${GEWERK_ICONS[org.gewerk] ?? 'ti-shield'} text-[18px]`}
                    style={{ color: gewerk?.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[13px] font-medium">{org.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
