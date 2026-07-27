import Link from 'next/link';
import type { Post } from '@/lib/types';
import { GEWERK_COLORS } from '@/lib/types';

function formatTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Ticker({ images }: { images: Post[] }) {
  if (images.length === 0) return null;

  // Für den nahtlosen Scroll-Effekt wird die Liste einmal dupliziert.
  const items = [...images, ...images];

  return (
    <div className="relative overflow-hidden border-y border-line bg-white">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[70px] bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[70px] bg-gradient-to-l from-white to-transparent" />
      <div className="flex w-max animate-ticker">
        {items.map((post, i) => {
          const gewerkId =
            typeof post.organization === 'object' && post.organization
              ? post.organization.gewerk
              : 'feuerwehr';
          const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
          return (
            <Link
              key={`${post.id}-${i}`}
              href={`/bildarchiv/${post.id}`}
              className="flex items-center gap-[11px] whitespace-nowrap border-r border-line px-7 py-3.5 text-[12px] transition-colors hover:bg-panel"
            >
              <span
                className="h-1.5 w-1.5 flex-none rounded-[1.5px]"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="font-mono text-ink-3">
                {formatTime(post.published_at ?? post.event_date)}
              </span>
              <span className="font-mono font-medium text-ink">
                {post.alarm_code ?? '—'}
              </span>
              <span className="text-ink-2">
                {post.location ?? (typeof post.organization === 'object'
                  ? post.organization?.name
                  : '')}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
