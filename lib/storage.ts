import type { StorageTier } from './types';

// Eine Stelle für die Stufen-Definition -- Backend (Limit-Check) und UI
// (Admin-Dropdown, Verbrauchsanzeige) greifen beide hierauf zu, damit nie
// zwei verschiedene Zahlen für "Stufe 2" im Umlauf sind.
export const STORAGE_TIERS: Record<StorageTier, { label: string; gb: number }> = {
  tier_250: { label: 'Stufe 1 — 250 GB', gb: 250 },
  tier_500: { label: 'Stufe 2 — 500 GB', gb: 500 },
  tier_1000: { label: 'Stufe 3 — 1000 GB', gb: 1000 },
};

export const DEFAULT_STORAGE_TIER: StorageTier = 'tier_250';

export function gbToBytes(gb: number): number {
  return gb * 1024 * 1024 * 1024;
}

export function bytesToGb(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

export function storageLimitForTier(tier: StorageTier): number {
  return gbToBytes(STORAGE_TIERS[tier].gb);
}

// Menschenlesbare Formatierung für Anzeigen wie "230,4 GB von 250 GB" --
// zeigt MB statt GB bei sehr kleinem Verbrauch (neue Organisation, noch
// fast nichts hochgeladen), sonst wäre "0,0 GB" wenig aussagekräftig.
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
  }
  const gb = bytesToGb(bytes);
  return `${gb.toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;
}

export type StorageStatus = {
  usedBytes: number;
  limitBytes: number;
  percentUsed: number;
  isNearLimit: boolean; // ab 90%
  isAtLimit: boolean; // ab 100%
};

export function getStorageStatus(usedBytes: number, limitBytes: number): StorageStatus {
  const safeLimit = limitBytes > 0 ? limitBytes : gbToBytes(STORAGE_TIERS[DEFAULT_STORAGE_TIER].gb);
  const percentUsed = Math.min(100, (usedBytes / safeLimit) * 100);
  return {
    usedBytes,
    limitBytes: safeLimit,
    percentUsed,
    isNearLimit: percentUsed >= 90,
    isAtLimit: usedBytes >= safeLimit,
  };
}
