'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GEWERK_ICONS, type Organization, type Gewerk } from '@/lib/types';

export default function OrganizationSearch({
  organizations,
  gewerke,
}: {
  organizations: Organization[];
  gewerke: Gewerk[];
}) {
  const [query, setQuery] = useState('');
  const gewerkById = Object.fromEntries(gewerke.map((g) => [g.id, g]));

  const filtered = organizations.filter((org) =>
    org.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
          {query.trim()
            ? `${filtered.length} gefundene Organisationen`
            : `${organizations.length} angeschlossene Organisationen`}
        </h2>
        <div className="relative w-full nav:w-[280px]">
          <i
            className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-3"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Organisation suchen …"
            className="w-full rounded-md border border-line-strong py-2 pl-9 pr-3 text-[13px] outline-none focus:border-ink"
          />
        </div>
      </div>

      {organizations.length === 0 ? (
        <p className="text-[13px] text-ink-2">Noch keine Organisation registriert.</p>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-ink-2">Keine Organisation gefunden für „{query}".</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 nav:grid-cols-3">
          {filtered.map((org) => {
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
  );
}
