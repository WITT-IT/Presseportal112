import { DIRECTUS_URL } from './directus';

export type MediaShareStatus =
  | { state: 'not_found' }
  | { state: 'active' }
  | {
      state: 'expired' | 'deactivated';
      name: string;
      organizationName: string | null;
      expiresAt: string;
    };

// Schlanker Vorab-Check für /medienfreigabe/[token]: sagt, WARUM ein Token
// nicht (mehr) funktioniert -- getMediaShareByToken selbst gibt bei jedem
// ungültigen Zustand pauschal null zurück (richtig für die eigentliche
// Datenladung, aber zu wenig Information für eine hilfreiche Fehlerseite).
// Bewusst eine eigene, sehr schlanke Abfrage statt getMediaShareByToken
// umzubauen -- die bestehende Funktion und ihr Rückgabetyp bleiben für alle
// anderen Aufrufer unverändert.
export async function getMediaShareStatus(token: string): Promise<MediaShareStatus> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('getMediaShareStatus: DIRECTUS_SERVICE_TOKEN fehlt.');
    return { state: 'not_found' };
  }

  const fields = ['id', 'name', 'active', 'expires_at', 'organization.name'].join(',');

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/media_shares?filter[token][_eq]=${encodeURIComponent(token)}&fields=${fields}&limit=1`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(
        `getMediaShareStatus fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return { state: 'not_found' };
    }
    const { data } = await res.json();
    const row = data?.[0] as
      | { id: string; name: string; active: boolean; expires_at: string; organization: { name: string } | null }
      | undefined;
    if (!row) return { state: 'not_found' };

    const isExpired = new Date(row.expires_at).getTime() <= Date.now();
    if (!row.active) {
      return {
        state: 'deactivated',
        name: row.name,
        organizationName: row.organization?.name ?? null,
        expiresAt: row.expires_at,
      };
    }
    if (isExpired) {
      return {
        state: 'expired',
        name: row.name,
        organizationName: row.organization?.name ?? null,
        expiresAt: row.expires_at,
      };
    }
    return { state: 'active' };
  } catch (error) {
    console.error('getMediaShareStatus fehlgeschlagen:', error);
    return { state: 'not_found' };
  }
}
