import { DIRECTUS_URL } from './directus';
import { isUuid } from './validate';

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
// die auf eine Unterhaltung zugreift.
//
// Das ist hier die EINZIGE Zugriffskontrolle, die es gibt -- die Directus-
// Collections selbst sind für jede Policy außer dem Service-Token komplett
// gesperrt. Es gibt also KEINE zweite Verteidigungslinie aus Directus-
// Berechtigungen, anders als z.B. bei media_library, wo ein Organisations-
// Filter zusätzlich greift.
//
// Genau deshalb wird conversationId/organizationId JETZT HIER validiert,
// nicht nur in den aufrufenden Routen: Diese Funktion ist der einzige Ort,
// der garantiert bei jedem Aufruf durchlaufen wird, unabhängig davon, ob
// eine künftige neue Aufrufstelle (Route oder Server Component) die
// Prüfung vorher selbst schon macht oder vergisst. conversationId und
// organizationId landen unten direkt in einer Directus-Filter-URL, mit
// dem Service-Token -- vollem Zugriff auf die komplette Collection.
export async function getActiveParticipant(
  conversationId: string,
  organizationId: string
): Promise<{ id: string; is_moderator: boolean; is_archived: boolean } | null> {
  if (!isUuid(conversationId) || !isUuid(organizationId)) {
    console.error(
      `getActiveParticipant: ungültige ID übergeben (conversationId=${conversationId}, organizationId=${organizationId}).`
    );
    return null;
  }

  const headers = serviceHeaders();
  const res = await fetch(
    `${DIRECTUS_URL}/items/conversation_participants?filter[conversation][_eq]=${conversationId}&filter[organization][_eq]=${organizationId}&filter[left_at][_null]=true&fields=id,is_moderator,is_archived&limit=1`,
    { headers }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] ?? null;
}
