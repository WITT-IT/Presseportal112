'use client';

import type { Alarmcode } from '@/lib/types';

function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Portiert aus dem Original-Prototyp (ppFindKeywordByCode): erst exakter
// Treffer, sonst der längste Alarmcode, mit dem die Eingabe beginnt --
// so matcht "B1 Kellerbrand" trotzdem auf den Code "B1".
function findMatch(alarmcodes: Alarmcode[], input: string): Alarmcode | null {
  const wanted = normalizeCode(input);
  if (!wanted) return null;

  const exact = alarmcodes.find((a) => normalizeCode(a.code) === wanted);
  if (exact) return exact;

  return (
    alarmcodes
      .filter((a) => wanted.startsWith(`${normalizeCode(a.code)} `))
      .sort((a, b) => b.code.length - a.code.length)[0] ?? null
  );
}

export default function AlarmCodeInput({
  value,
  onChange,
  alarmcodes,
}: {
  value: string;
  onChange: (value: string) => void;
  alarmcodes: Alarmcode[];
}) {
  const match = findMatch(alarmcodes, value);

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="z. B. B1"
        list="alarmcode-suggestions"
        className="w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
      />
      <datalist id="alarmcode-suggestions">
        {alarmcodes.map((a) => (
          <option key={a.id} value={a.code}>
            {a.name}
          </option>
        ))}
      </datalist>

      {value.trim() ? (
        match ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
            <i className="ti ti-folder-check text-[12px]" aria-hidden="true" />
            Erkannt: {match.name}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
            <i className="ti ti-alert-triangle text-[12px]" aria-hidden="true" />
            Kein passender Alarmcode gefunden.
          </p>
        )
      ) : (
        <p className="mt-1 text-[11px] text-ink-3">
          Code eingeben oder aus der Vorschlagsliste auswählen.
        </p>
      )}
    </div>
  );
}
