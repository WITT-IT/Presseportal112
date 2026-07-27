'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function PostCalendar({ posts }: { posts: Post[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysWithPosts = new Set(posts.map((p) => p.event_date));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Woche beginnt Montag statt Sonntag -- deshalb die Verschiebung um 1.
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = viewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedPosts = selectedDate ? posts.filter((p) => p.event_date === selectedDate) : [];

  return (
    <div className="mb-8 rounded-[10px] border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label="Vorheriger Monat"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          ←
        </button>
        <span className="font-display text-[15px] font-bold capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          aria-label="Nächster Monat"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-ink-3">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const ds = dateStr(day);
          const hasPosts = daysWithPosts.has(ds);
          const isSelected = selectedDate === ds;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => hasPosts && setSelectedDate(isSelected ? null : ds)}
              disabled={!hasPosts}
              className={`aspect-square rounded-md text-[12px] transition-colors ${
                isSelected
                  ? 'bg-ink font-semibold text-white'
                  : hasPosts
                  ? 'bg-signal/10 font-semibold text-signal-deep hover:bg-signal/20'
                  : 'text-ink-3'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-[12px] font-semibold text-ink-2">
            {selectedPosts.length} Beitrag{selectedPosts.length === 1 ? '' : 'e'} am{' '}
            {new Date(selectedDate).toLocaleDateString('de-DE')}
          </p>
          <div className="flex flex-col gap-2">
            {selectedPosts.map((post) => {
              const hero = primaryImage(post);
              return (
                <Link
                  key={post.id}
                  href={`/intern/bearbeiten/${post.id}`}
                  className="flex items-center gap-3 rounded-md border border-line p-2 transition-colors hover:border-line-strong"
                >
                  <div className="relative h-10 w-10 flex-none overflow-hidden rounded bg-panel">
                    {hero?.file_public_preview && (
                      <Image
                        src={directusAssetUrl(hero.file_public_preview, 'width=80&quality=60')}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span className="truncate text-[12px] font-medium">
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
