import { formatBytes, getStorageStatus } from '@/lib/storage';

// Eigenständige Komponente statt Inline-Markup in der Medien-Seite -- wird
// in Teil 4 (Admin-Organisationsübersicht) identisch wiederverwendet, damit
// die Balken-Optik/Warnschwellen an beiden Stellen exakt gleich aussehen
// und sich nur an einer Stelle pflegen lassen.
export default function StorageUsageBar({
  usedBytes,
  limitBytes,
  compact = false,
}: {
  usedBytes: number;
  limitBytes: number;
  compact?: boolean;
}) {
  const status = getStorageStatus(usedBytes, limitBytes);

  const barColor = status.isAtLimit
    ? 'bg-signal-deep'
    : status.isNearLimit
    ? 'bg-amber-500'
    : 'bg-ink';

  return (
    <div>
      <div className={`flex items-baseline justify-between ${compact ? 'mb-1' : 'mb-1.5'}`}>
        <span className={`font-mono ${compact ? 'text-[11px]' : 'text-[12px]'} text-ink-2`}>
          {formatBytes(status.usedBytes)}
          <span className="text-ink-3"> / {formatBytes(status.limitBytes)}</span>
        </span>
        <span
          className={`font-mono ${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold ${
            status.isAtLimit ? 'text-signal-deep' : status.isNearLimit ? 'text-amber-600' : 'text-ink-3'
          }`}
        >
          {status.percentUsed.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%
        </span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-panel ${compact ? 'h-[5px]' : 'h-[7px]'}`}>
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, status.percentUsed)}%` }}
        />
      </div>
      {status.isAtLimit ? (
        <p className="mt-1.5 text-[11.5px] font-medium text-signal-deep">
          Speicherlimit erreicht — neue Uploads sind aktuell nicht möglich.
        </p>
      ) : status.isNearLimit ? (
        <p className="mt-1.5 text-[11.5px] font-medium text-amber-600">
          Fast ausgeschöpft — bald wird kein Platz mehr für neue Uploads sein.
        </p>
      ) : null}
    </div>
  );
}
