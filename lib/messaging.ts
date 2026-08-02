import { DIRECTUS_URL } from './directus';

export function serviceHeaders(): { Authorization: string; 'Content-Type': string } {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    throw new Error('DIRECTUS_SERVICE_TOKEN fehlt.');
  }
  return { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' };
}

// Zentrale Sicherheitsprüfung für das gesamte Nachrichtensystem: ist diese
// Organisation aktuell wirklich (noch) Teilnehmer dieser Unterhaltung?
// Bewusst an EINER Stelle gebündelt und von jeder Route/Seite aufgerufen,
// die auf eine Unterhaltung zugreift -- damit diese Prüfung nicht an
// mehreren Stellen leicht unterschiedlich (und potenziell fehlerhaft)
// dupliziert wird. Das ist hier die einzige Zugriffskontrolle, die es
// gibt -- die Directus-Collections selbst sind für jede Policy außer dem
// Service-Token komplett gesperrt.
export async function getActiveParticipant(
  conversationId: string,
  organizationId: string
): Promise<{ id: string; is_moderator: boolean; is_archived: boolean } | null> {
  const headers = serviceHeaders();
  const res = await fetch(
    `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&fields=id,is_moderator,is_archived&limit=1`,
    { headers }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] ?? null;
}
