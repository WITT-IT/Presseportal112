import Link from 'next/link';
import type { Gewerk } from '@/lib/types';
import { GEWERK_ICONS } from '@/lib/types';

const DESCRIPTIONS: Record<string, string> = {
  feuerwehr: 'Brand- und Hilfeleistungseinsätze, Alarmcodes B1–B5, H1–H5.',
  drk: 'Rettungsdienst, Sanitätsdienst und Bevölkerungsschutz.',
  polizei: 'Verkehr, Einsatzlagen und Pressefahndungen.',
  thw: 'Bergung, Notversorgung und technische Hilfe.',
};

export default function GewerkeGrid({
  gewerke,
  counts,
}: {
  gewerke: Gewerk[];
  counts: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-[18px] nav:grid-cols-4">
      {gewerke.map((g) => (
        <Link
          key={g.id}
          href={`/bildarchiv?gewerk=${g.id}`}
          className="rounded-b-[10px] border border-line bg-white p-[22px] transition-transform hover:-translate-y-0.5"
          style={{ borderTop: `3px solid ${g.color}` }}
        >
          <i
            className={`ti ${GEWERK_ICONS[g.id] ?? 'ti-shield'} mb-5 block text-[22px]`}
            style={{ color: g.color }}
            aria-hidden="true"
          />
          <h3 className="mb-[7px] font-display text-[21px] font-bold">
            {g.name}
          </h3>
          <p className="mb-[18px] text-[12.5px] leading-[1.6] text-ink-2">
            {DESCRIPTIONS[g.id] ?? ''}
          </p>
          <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[11px] text-ink-3">
            <span>Fotos</span>
            <span className="font-medium text-ink">
              {(counts[g.id] ?? 0).toLocaleString('de-DE')}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
