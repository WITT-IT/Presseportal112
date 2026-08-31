import { DIRECTUS_URL } from './directus';
import { DEFAULT_STORAGE_TIER, storageLimitForTier } from './storage';
import type { StorageTier } from './types';

export type OrgStorageInfo = {
  usedBytes: number;
  limitBytes: number;
  tier: StorageTier;
};

// Wie viele Datei-IDs pro Aggregat-Abfrage in die URL wandern. Directus
// erlaubt beliebig lange _in-Listen, Reverse Proxies und Browser aber
// nicht -- bei ~2000 Bildern wäre eine einzelne URL über 70 kB lang und
// liefe in ein 414. 100 IDs sind rund 3,7 kB und damit sicher.
const ID_CHUNK_SIZE = 100;

// Ab welcher Abweichung zwischen berechnetem Ist-Wert und gespeichertem
// Zähler geloggt wird. Kleine Differenzen sind normal (ein Upload, der
// gerade parallel läuft), große bedeuten, dass die Fortschreibung des
// Zählers beim Upload oder Löschen nicht greift.
const DRIFT_LOG_THRESHOLD_BYTES = 5 * 1024 * 1024;

// Summiert die ECHTEN Dateigrößen aller Bibliotheksbilder einer
// Organisation über Directus-Aggregate.
//
// WARUM NICHT DER GESPEICHERTE ZÄHLER:
// organizations.storage_used_bytes wird beim Upload und Löschen
// fortgeschrieben. Diese Fortschreibung ist eine eigene PATCH-Anfrage, die
// fehlschlagen kann -- und in adjustOrgStorage() wird ihr Status nicht
// geprüft, ein abgelehnter PATCH verschwindet also spurlos. Die Folge war
// eine Anzeige, die dauerhaft 0 zeigte, obwohl Bilder vorhanden waren, und
// die sich erst nach dem wöchentlichen Neuberechnungs-Job korrigierte.
//
// Eine Anzeige, die von einer stillen Nebenwirkung abhängt, ist für ein
// verkauftes Produkt nicht tragbar: Der Kunde sieht dort seinen bezahlten
// Kontingentstand. Deshalb wird der Wert hier aus den Daten selbst
// abgeleitet -- aus den Dateigrößen, die Directus ohnehin für jede Datei
// führt. Das kann per Definition nicht auseinanderlaufen.
//
// KOSTEN: eine Abfrage für die Datei-IDs plus eine Aggregat-Abfrage je
// 100 Bilder. Für eine Ortsgruppe mit ein paar hundert Bildern sind das
// zwei bis vier schlanke Anfragen pro Seitenaufruf -- die Aggregat-Abfrage
// überträgt nur eine Zahl, keine Datensätze.
async function computeUsedBytes(token: string, organizationId: string): Promise<number | null> {
  const headers = { Authorization: `Bearer ${token}` };

  const itemsRes = await fetch(
    `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&fields=file&limit=-1`,
    { headers, cache: 'no-store' }
  );
  if (!itemsRes.ok) {
    console.error(
      `computeUsedBytes(${organizationId}): media_library laden fehlgeschlagen (Status ${itemsRes.status}):`,
      await itemsRes.text().catch(() => '')
    );
    return null;
  }

  const { data } = await itemsRes.json();
  const fileIds = (data as { file: string | null }[])
    .map((row) => row.file)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  // Keine Bilder ist ein gültiger Zustand mit dem Ergebnis 0 -- klar zu
  // unterscheiden von "Berechnung fehlgeschlagen" (null).
  if (fileIds.length === 0) return 0;

  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += ID_CHUNK_SIZE) {
    chunks.push(fileIds.slice(i, i + ID_CHUNK_SIZE));
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
        // Directus liefert die Summe als String, wenn sie den sicheren
        // Zahlenbereich überschreiten könnte -- deshalb explizit wandeln.
        const sum = Number(body?.data?.[0]?.sum?.filesize);
        return Number.isFinite(sum) ? sum : 0;
      } catch {
        return null;
      }
    })
  );

  // Ein einziger fehlgeschlagener Teil macht die Gesamtsumme zu niedrig --
  // und eine zu niedrige Anzeige ist schlimmer als gar keine, weil sie
  // freien Speicher vorgaukelt, den es nicht gibt. Dann lieber den
  // gespeicherten Zähler nehmen.
  if (results.some((value) => value === null)) {
    console.error(
      `computeUsedBytes(${organizationId}): mindestens eine Aggregat-Abfrage fehlgeschlagen — es wird auf den gespeicherten Zähler zurückgefallen.`
    );
    return null;
  }

  return results.reduce<number>((total, value) => total + (value ?? 0), 0);
}

// Eigenständige, schlanke Abfrage statt getOrganizationById zu erweitern --
// die bestehende Funktion lädt Felder fürs öffentliche Organisationsprofil
// und wird an Stellen genutzt, wo die Speicherdaten irrelevant sind.
//
// LIEST MIT DEM SERVICE-TOKEN, NICHT MIT DEM NUTZERTOKEN:
// storage_used_bytes / storage_limit_bytes / storage_tier sind System- und
// Abrechnungsdaten, die der Server pflegt. Mit dem Nutzertoken hing die
// Anzeige an den Feldberechtigungen der jeweiligen Directus-Rolle -- fehlt
// einer Rolle die Leseberechtigung auf ein einzelnes Feld, antwortet
// Directus trotzdem mit 200 OK und lässt das Feld einfach weg.
export async function getOrgStorageInfo(
  accessToken: string,
  organizationId: string
): Promise<OrgStorageInfo> {
  // accessToken bleibt als Fallback, falls DIRECTUS_SERVICE_TOKEN in einer
  // Umgebung nicht gesetzt ist.
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  const token = serviceToken || accessToken;

  const [orgRes, computedUsed] = await Promise.all([
    fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,storage_limit_bytes,storage_tier`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    ),
    computeUsedBytes(token, organizationId),
  ]);

  if (!orgRes.ok) {
    console.error(
      `getOrgStorageInfo(${organizationId}) fehlgeschlagen (Status ${orgRes.status}):`,
      await orgRes.text().catch(() => '')
    );
    return {
      usedBytes: computedUsed ?? 0,
      limitBytes: storageLimitForTier(DEFAULT_STORAGE_TIER),
      tier: DEFAULT_STORAGE_TIER,
    };
  }

  const { data } = await orgRes.json();
  const tier = (data?.storage_tier as StorageTier) || DEFAULT_STORAGE_TIER;

  const rawStored = Number(data?.storage_used_bytes);
  // Number.isFinite statt "|| 0": Der Oder-Fallback verschluckt NaN und 0
  // gleichermaßen und macht einen Fehlerfall von einem gültigen Nullwert
  // ununterscheidbar.
  const storedUsed = Number.isFinite(rawStored) ? Math.max(0, rawStored) : 0;

  // Der berechnete Wert gewinnt. Der gespeicherte Zähler springt nur ein,
  // wenn die Berechnung nicht durchlief.
  const usedBytes = computedUsed ?? storedUsed;

  // Läuft der Zähler dauerhaft auseinander, steht die Ursache im Log,
  // statt dass jemand wieder im Frontend sucht: Dann greift die
  // Fortschreibung in app/api/intern/library/route.ts nicht (dort wird der
  // Status des PATCH auf organizations nicht geprüft).
  if (computedUsed !== null && Math.abs(computedUsed - storedUsed) > DRIFT_LOG_THRESHOLD_BYTES) {
    console.warn(
      `getOrgStorageInfo(${organizationId}): Zähler weicht ab — gespeichert ${storedUsed} Bytes, ` +
        `tatsächlich ${computedUsed} Bytes. Die Anzeige nutzt den tatsächlichen Wert. ` +
        `Ursache liegt in der Fortschreibung von storage_used_bytes beim Upload/Löschen.`
    );
  }

  const rawLimit = Number(data?.storage_limit_bytes);
  return {
    usedBytes,
    // Fällt auf das Limit der Stufe zurück, falls storage_limit_bytes noch
    // nicht gepflegt ist -- verhindert ein Limit von 0, das jeden Upload
    // sofort blockieren würde.
    limitBytes: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : storageLimitForTier(tier),
    tier,
  };
}
