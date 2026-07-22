import type { DirectusImage } from '@/lib/types';
import { GEWERK_COLORS } from '@/lib/types';

function formatTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Ticker({ images }: { images: DirectusImage[] }) {
  if (images.length === 0) return null;

  // Für den nahtlosen Scroll-Effekt wird die Liste einmal dupliziert.
  const items = [...images, ...images];

  return (
    <div className="relative overflow-hidden border-y border-line bg-white">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[70px] bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[70px] bg-gradient-to-l from-white to-transparent" />
      <div className="flex w-max animate-ticker">
        {items.map((img, i) => {
          const gewerkId =
            typeof img.organization === 'object' && img.organization
              ? img.organization.gewerk
              : 'feuerwehr';
          const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
          return (
            <div
              key={`${img.id}-${i}`}
              className="flex items-center gap-[11px] whitespace-nowrap border-r border-line px-7 py-3.5 text-[12px]"
            >
              <span
                className="h-1.5 w-1.5 flex-none rounded-[1.5px]"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="font-mono text-ink-3">
                {formatTime(img.published_at ?? img.event_date)}
              </span>
              <span className="font-mono font-medium text-ink">
                {img.alarm_code ?? '—'}
              </span>
              <span className="text-ink-2">
                {img.location ?? (typeof img.organization === 'object'
                  ? img.organization?.name
                  : '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
