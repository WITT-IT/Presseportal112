'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Directus liefert Datumsfelder je nach Feldtyp manchmal mit angehängter
// Uhrzeit (z. B. "2026-07-27T00:00:00") -- deshalb hier IMMER auf die
// reinen ersten 10 Zeichen (YYYY-MM-DD) kürzen, bevor verglichen wird.
function toDateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

export default function PostCalendar({ posts }: { posts: Post[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysWithPosts = new Set(
    posts.map((p) => toDateOnly(p.event_date)).filter((d): d is string => !!d)
  );
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = viewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedPosts = selectedDate
    ? posts.filter((p) => toDateOnly(p.event_date) === selectedDate)
    : [];

  return (
    <div className="mb-8 max-w-[320px] rounded-[10px] border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label="Vorheriger Monat"
          className="flex h-6 w-6 items-center justify-center rounded text-ink-2 transition-colors hover:bg-panel hover:text-ink"
        >
          ←
        </button>
        <span className="font-display text-[13px] font-bold capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          aria-label="Nächster Monat"
          className="flex h-6 w-6 items-center justify-center rounded text-ink-2 transition-colors hover:bg-panel hover:text-ink"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center font-mono text-[9px] text-ink-3">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="h-8" />;
          const ds = dateStr(day);
          const hasPosts = daysWithPosts.has(ds);
          const isSelected = selectedDate === ds;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => hasPosts && setSelectedDate(isSelected ? null : ds)}
              disabled={!hasPosts}
              className={`relative flex h-8 flex-col items-center justify-center rounded text-[11px] transition-colors ${
                isSelected
                  ? 'bg-ink font-semibold text-white'
                  : hasPosts
                  ? 'font-semibold text-ink hover:bg-panel'
                  : 'text-ink-3'
              }`}
            >
              {day}
              {hasPosts && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-signal" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[11px] font-semibold text-ink-2">
            {selectedPosts.length} Beitrag{selectedPosts.length === 1 ? '' : 'e'} am{' '}
            {new Date(selectedDate).toLocaleDateString('de-DE')}
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedPosts.map((post) => {
              const hero = primaryImage(post);
              return (
                <Link
                  key={post.id}
                  href={`/intern/bearbeiten/${post.id}`}
                  className="flex items-center gap-2.5 rounded-md border border-line p-1.5 transition-colors hover:border-line-strong"
                >
                  <div className="relative h-8 w-8 flex-none overflow-hidden rounded bg-panel">
                    {hero?.file_public_preview && (
                      <Image
                        src={directusAssetUrl(hero.file_public_preview, 'width=60&quality=60')}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span className="truncate text-[11px] font-medium">
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
