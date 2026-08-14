import { DIRECTUS_URL } from './directus';
import { DEFAULT_STORAGE_TIER, storageLimitForTier } from './storage';
import type { StorageTier } from './types';

export type OrgStorageInfo = {
  usedBytes: number;
  limitBytes: number;
  tier: StorageTier;
};

// Eigenständige, schlanke Abfrage statt getOrganizationById zu erweitern --
// die bestehende Funktion lädt Felder fürs öffentliche Organisationsprofil
// (Beschreibung, Website, Social Links) und wird an Stellen genutzt, wo
// die Speicherdaten irrelevant sind. Getrennt gehalten vermeidet, dass
// jede bestehende Aufrufstelle plötzlich zwei ungenutzte Felder mitlädt.
export async function getOrgStorageInfo(
  accessToken: string,
  organizationId: string
): Promise<OrgStorageInfo> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,storage_limit_bytes,storage_tier`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getOrgStorageInfo(${organizationId}) fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return { usedBytes: 0, limitBytes: storageLimitForTier(DEFAULT_STORAGE_TIER), tier: DEFAULT_STORAGE_TIER };
  }
  const { data } = await res.json();
  const tier = (data?.storage_tier as StorageTier) || DEFAULT_STORAGE_TIER;
  return {
    usedBytes: Number(data?.storage_used_bytes) || 0,
    // Fällt auf das Limit der Stufe zurück, falls storage_limit_bytes noch
    // nicht gepflegt ist (z.B. bei einer Organisation, die vor der
    // Migration angelegt wurde) -- verhindert ein Limit von 0, das jeden
    // Upload sofort blockieren würde.
    limitBytes: Number(data?.storage_limit_bytes) || storageLimitForTier(tier),
    tier,
  };
}
