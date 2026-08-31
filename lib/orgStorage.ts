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
//
// LIEST MIT DEM SERVICE-TOKEN, NICHT MIT DEM NUTZERTOKEN:
// storage_used_bytes / storage_limit_bytes / storage_tier sind System- und
// Abrechnungsdaten, die der Server pflegt -- keine Inhalte, die einer
// Nutzerrolle gehören. Mit dem Nutzertoken hing die Anzeige an den
// Feldberechtigungen der jeweiligen Directus-Rolle, und genau das ist
// zum Problem geworden: Fehlt einer Rolle die Leseberechtigung auf ein
// einzelnes Feld, antwortet Directus trotzdem mit 200 OK und lässt das
// Feld einfach weg. res.ok schlägt also nie an, Number(undefined) wird
// NaN, und "NaN || 0" ergibt stumm 0 -- der Balken stand dauerhaft auf
// 0 MB, obwohl in Directus der korrekte Wert lag.
//
// Die Organisations-ID kommt an jeder Aufrufstelle aus der bereits
// geprüften Sitzung des angemeldeten Nutzers, nicht aus einer
// Nutzereingabe -- das Service-Token weitet hier also keinen Zugriff auf
// fremde Organisationen auf.
export async function getOrgStorageInfo(
  accessToken: string,
  organizationId: string
): Promise<OrgStorageInfo> {
  // accessToken bleibt als Fallback erhalten, falls DIRECTUS_SERVICE_TOKEN
  // in einer Umgebung (noch) nicht gesetzt ist -- dann verhält sich die
  // Funktion wie bisher, statt gar nichts zu liefern.
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  const token = serviceToken || accessToken;

  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,storage_limit_bytes,storage_tier`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );

  if (!res.ok) {
    console.error(
      `getOrgStorageInfo(${organizationId}) fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return { usedBytes: 0, limitBytes: storageLimitForTier(DEFAULT_STORAGE_TIER), tier: DEFAULT_STORAGE_TIER };
  }

  const { data } = await res.json();

  // Ausdrücklich auf FEHLENDE Felder prüfen, nicht nur auf leere Werte.
  // Ein fehlendes Feld ist ein Berechtigungs- oder Schema-Problem und muss
  // im Log auftauchen -- sonst sucht man das nächste Mal wieder im
  // Frontend, obwohl der Fehler in Directus sitzt. Ein Feld mit dem Wert 0
  // ist dagegen ein legitimer Zustand (frische Organisation) und wird
  // bewusst nicht gemeldet.
  if (data && !('storage_used_bytes' in data)) {
    console.error(
      `getOrgStorageInfo(${organizationId}): Directus liefert das Feld "storage_used_bytes" nicht mit. ` +
        `Das deutet auf eine fehlende Feld-Leseberechtigung oder ein geändertes Schema hin -- ` +
        `der Speicherbalken zeigt sonst dauerhaft 0.`
    );
  }

  const tier = (data?.storage_tier as StorageTier) || DEFAULT_STORAGE_TIER;

  const rawUsed = Number(data?.storage_used_bytes);
  const rawLimit = Number(data?.storage_limit_bytes);

  return {
    // Number.isFinite statt "|| 0": Der Oder-Fallback verschluckt NaN und
    // 0 gleichermaßen und macht damit einen Fehlerfall von einem gültigen
    // Nullwert ununterscheidbar. Genau diese Unschärfe hat den Bug so lange
    // unsichtbar gehalten.
    usedBytes: Number.isFinite(rawUsed) ? Math.max(0, rawUsed) : 0,
    // Fällt auf das Limit der Stufe zurück, falls storage_limit_bytes noch
    // nicht gepflegt ist (z.B. bei einer Organisation, die vor der
    // Migration angelegt wurde) -- verhindert ein Limit von 0, das jeden
    // Upload sofort blockieren würde.
    limitBytes: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : storageLimitForTier(tier),
    tier,
  };
}
