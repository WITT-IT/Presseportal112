import { DIRECTUS_URL } from './directus';
import { resolvePlan, type PlanId } from './plans';

export type OrgStorageInfo = {
  usedBytes: number;
  limitBytes: number;
  planId: PlanId;
};

// Rechnet den tatsächlichen Verbrauch aus den ECHTEN Dateigrößen aller
// Originale der Organisation aus. Nur die Originale (media_library.file)
// zählen -- Vorschau- und Wasserzeichen-Varianten gehen bewusst nicht ins
// Kontingent.
async function computeUsedBytes(token: string, organizationId: string): Promise<number | null> {
  const headers = { Authorization: `Bearer ${token}` };

  const itemsRes = await fetch(
    `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&fields=file&limit=-1`,
    { headers, cache: 'no-store' }
  );
  if (!itemsRes.ok) {
    console.error(
      `computeUsedBytes(${organizationId}): media_library laden fehlgeschlagen (Status ${itemsRes.status}).`
    );
    return null;
  }

  const { data } = await itemsRes.json();
  const fileIds = (data as { file: string | null }[])
    .map((row) => row.file)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (fileIds.length === 0) return 0;

  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(
          `${DIRECTUS_URL}/files?aggregate[sum]=filesize&filter[id][_in]=${chunk.join(',')}&limit=-1`,
          { headers, cache: 'no-store' }
        );
        if (!res.ok) return null;
        const body = await res.json();
        const sum = Number(body?.data?.[0]?.sum?.filesize);
        return Number.isFinite(sum) ? sum : 0;
      } catch {
        return null;
      }
    })
  );

  if (results.some((value) => value === null)) return null;
  return results.reduce<number>((total, value) => total + (value ?? 0), 0);
}

// LIEST MIT DEM SERVICE-TOKEN: plan / storage_tier / storage_used_bytes
// sind System- und Abrechnungsdaten, die der Server pflegt.
//
// limitBytes kommt jetzt NICHT mehr aus einem gespeicherten Feld, sondern
// wird live aus dem Plan berechnet (resolvePlan aus lib/plans.ts). Damit
// gibt es für die Speichergrenze nur noch EINE Quelle -- das Feld "plan",
// das der Stripe-Webhook pflegt -- statt eines zusätzlichen Feldes, das
// mit dem Plan auseinanderlaufen könnte.
export async function getOrgStorageInfo(
  accessToken: string,
  organizationId: string
): Promise<OrgStorageInfo> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  const token = serviceToken || accessToken;

  const [res, computed] = await Promise.all([
    fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,plan,storage_tier`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    computeUsedBytes(token, organizationId),
  ]);

  if (!res.ok) {
    console.error(`getOrgStorageInfo(${organizationId}) fehlgeschlagen (Status ${res.status}).`);
    const fallbackPlan = resolvePlan({});
    return { usedBytes: computed ?? 0, limitBytes: fallbackPlan.storageBytes, planId: fallbackPlan.id };
  }

  const { data } = await res.json();
  const rawStored = Number(data?.storage_used_bytes);
  const storedUsedBytes = Number.isFinite(rawStored) ? Math.max(0, rawStored) : 0;

  const plan = resolvePlan({ plan: data?.plan, storage_tier: data?.storage_tier });

  return {
    usedBytes: computed ?? storedUsedBytes,
    limitBytes: plan.storageBytes,
    planId: plan.id,
  };
}
