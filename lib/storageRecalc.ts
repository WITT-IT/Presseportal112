import { DIRECTUS_URL } from './directus';

export type RecalcResult = {
  organizationId: string;
  organizationName: string;
  previousBytes: number;
  correctedBytes: number;
  difference: number;
  fileCount: number;
};

// Kernlogik der Speicher-Neuberechnung -- holt die WIRKLICHEN
// Directus-Dateigrößen aller media_library-Einträge einer Organisation und
// schreibt den korrekten Wert zurück. Wird sowohl vom manuellen
// Admin-Button (app/api/admin/organizations/recalculate-storage) als auch
// vom automatischen wöchentlichen Job (app/api/cron/recalculate-storage)
// genutzt -- eine einzige Quelle der Wahrheit statt zweier Implementierungen,
// die mit der Zeit auseinanderlaufen könnten.
export async function recalculateOrgStorage(
  serviceToken: string,
  organizationId: string,
  organizationName: string
): Promise<RecalcResult> {
  const headers = { Authorization: `Bearer ${serviceToken}` };

  const itemsRes = await fetch(
    `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&fields=file&limit=-1`,
    { headers }
  );
  if (!itemsRes.ok) {
    throw new Error(`media_library laden fehlgeschlagen (Status ${itemsRes.status}) für Organisation ${organizationId}`);
  }
  const { data: items } = await itemsRes.json();
  const fileIds = (items as { file: string | null }[]).map((i) => i.file).filter((v): v is string => !!v);

  let totalBytes = 0;
  const sizeResults = await Promise.allSettled(
    fileIds.map((fileId) =>
      fetch(`${DIRECTUS_URL}/files/${fileId}?fields=filesize`, { headers }).then((res) =>
        res.ok ? res.json() : null
      )
    )
  );
  for (const result of sizeResults) {
    if (result.status === 'fulfilled' && result.value?.data?.filesize) {
      totalBytes += Number(result.value.data.filesize) || 0;
    }
  }

  const orgRes = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes`, {
    headers,
  });
  const previousValue = orgRes.ok ? Number((await orgRes.json()).data?.storage_used_bytes) || 0 : 0;

  const patchRes = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_used_bytes: totalBytes }),
  });
  if (!patchRes.ok) {
    throw new Error(`Aktualisierung fehlgeschlagen (Status ${patchRes.status}) für Organisation ${organizationId}`);
  }

  return {
    organizationId,
    organizationName,
    previousBytes: previousValue,
    correctedBytes: totalBytes,
    difference: totalBytes - previousValue,
    fileCount: fileIds.length,
  };
}
