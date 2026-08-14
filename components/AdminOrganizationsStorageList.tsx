'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StorageUsageBar from './StorageUsageBar';
import { STORAGE_TIERS } from '@/lib/storage';
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTierChange(organizationId: string, tier: StorageTier) {
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
      {organizations.map((org) => (
        <div
          key={org.id}
          className="grid grid-cols-1 gap-3 rounded-[10px] border border-line bg-white p-4 nav:grid-cols-[1fr_260px_180px] nav:items-center"
        >
          <span className="truncate text-[13.5px] font-semibold text-ink">{org.name}</span>

          <StorageUsageBar usedBytes={org.usedBytes} limitBytes={org.limitBytes} compact />

          <select
            value={org.tier}
            onChange={(e) => handleTierChange(org.id, e.target.value as StorageTier)}
            disabled={pendingId === org.id}
            className="rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink disabled:opacity-50"
          >
            {(Object.keys(STORAGE_TIERS) as StorageTier[]).map((tier) => (
              <option key={tier} value={tier}>
                {STORAGE_TIERS[tier].label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
