'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StorageUsageBar from './StorageUsageBar';
import { useDialog } from './DialogProvider';
import { STORAGE_TIERS, storageLimitForTier, formatBytes } from '@/lib/storage';
import type { StorageTier } from '@/lib/types';

type OrgRow = {
  id: string;
  name: string;
  usedBytes: number;
  limitBytes: number;
  tier: StorageTier;
};

export default function AdminOrganizationsStorageList({ organizations }: { organizations: OrgRow[] }) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRecalculate(org: OrgRow) {
    setRecalculatingId(org.id);
    setRecalcMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizations/recalculate-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) throw new Error(body.error ?? 'Neuberechnung fehlgeschlagen.');

      const diff = body.difference as number;
      if (diff === 0) {
        setRecalcMessage(`${org.name}: Zähler war bereits korrekt.`);
      } else {
        const direction = diff > 0 ? 'nach oben' : 'nach unten';
        setRecalcMessage(
          `${org.name}: Zähler war ${formatBytes(Math.abs(diff))} ungenau, jetzt korrigiert (${direction}).`
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neuberechnung fehlgeschlagen.');
    } finally {
      setRecalculatingId(null);
    }
  }

  async function applyTierChange(organizationId: string, tier: StorageTier) {
    setPendingId(organizationId);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizations/storage-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, tier }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) throw new Error(body.error ?? 'Tier-Wechsel fehlgeschlagen.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tier-Wechsel fehlgeschlagen.');
    } finally {
      setPendingId(null);
    }
  }

  // Downgrade-Schutz: bevor ein Admin eine Organisation auf eine Stufe mit
  // weniger Speicher wechselt, als sie aktuell tatsächlich belegt, gibt's
  // eine explizite Warnung statt eines stillschweigenden Wechsels. Die
  // Organisation wäre sonst sofort "über Limit", ohne dass irgendjemand
  // das im Admin-UI selbst gesehen hätte -- gerade bei einem
  // zahlungspflichtigen Jahresabo ein Fehler, der schnell zu einem
  // verärgerten Kundenanruf führt.
  async function handleTierChange(org: OrgRow, newTier: StorageTier) {
    const newLimitBytes = storageLimitForTier(newTier);
    const isDowngradeBelowUsage = newLimitBytes < org.usedBytes;

    if (isDowngradeBelowUsage) {
      const confirmed = await confirm({
        title: 'Speicherstufe unter aktuellem Verbrauch?',
        message: `${org.name} nutzt aktuell ${formatBytes(org.usedBytes)}, die neue Stufe erlaubt aber nur ${formatBytes(
          newLimitBytes
        )}. Die Organisation kann danach sofort keine neuen Bilder mehr hochladen, bis sie unter das neue Limit kommt. Trotzdem fortfahren?`,
        confirmLabel: 'Trotzdem wechseln',
        cancelLabel: 'Abbrechen',
        danger: true,
      });
      if (!confirmed) return;
    }

    await applyTierChange(org.id, newTier);
  }

  if (organizations.length === 0) {
    return <p className="text-[13px] text-ink-2">Keine Organisationen vorhanden.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md border border-signal-deep/30 bg-signal-deep/5 px-3 py-2 text-[12.5px] text-signal-deep">
          {error}
        </p>
      )}
      {recalcMessage && (
        <p className="rounded-md border border-line-strong bg-panel px-3 py-2 text-[12.5px] text-ink-2">
          {recalcMessage}
        </p>
      )}
      {organizations.map((org) => (
        <div
          key={org.id}
          className="grid grid-cols-1 gap-3 rounded-[10px] border border-line bg-white p-4 nav:grid-cols-[1fr_260px_180px_auto] nav:items-center"
        >
          <span className="truncate text-[13.5px] font-semibold text-ink">{org.name}</span>

          <StorageUsageBar usedBytes={org.usedBytes} limitBytes={org.limitBytes} compact />

          <select
            value={org.tier}
            onChange={(e) => handleTierChange(org, e.target.value as StorageTier)}
            disabled={pendingId === org.id}
            className="rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink disabled:opacity-50"
          >
            {(Object.keys(STORAGE_TIERS) as StorageTier[]).map((tier) => (
              <option key={tier} value={tier}>
                {STORAGE_TIERS[tier].label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleRecalculate(org)}
            disabled={recalculatingId === org.id}
            title="Tatsächlichen Verbrauch neu aus Directus berechnen -- Reparatur bei Zähler-Drift"
            className="flex-none rounded-md border border-line-strong bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {recalculatingId === org.id ? '…' : 'Neu berechnen'}
          </button>
        </div>
      ))}
    </div>
  );
}
