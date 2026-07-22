import { readItem, readItems } from '@directus/sdk';
import { directus, DIRECTUS_URL } from './directus';
import type { DirectusImage, Gewerk, Organization } from './types';

// Vier Gewerke inkl. Sortierung, wie in der Taxonomie angelegt.
export async function getGewerke(): Promise<Gewerk[]> {
  return directus.request(
    readItems('gewerke', {
      sort: ['sort'],
      fields: ['id', 'name', 'icon', 'color', 'sort'],
    })
  ) as Promise<Gewerk[]>;
}

// Anzahl veröffentlichter Fotos pro Gewerk, für die Zähler auf den Gewerke-Karten.
// Bewusst über readItems + Array-Länge gelöst statt über die aggregate()-Funktion
// des SDK: aggregate() hat bekannte Bugs im Zusammenspiel mit gefilterten
// Relationen (siehe directus/directus#23395 und #25803). readItems mit
// filter + limit:-1 liefert dagegen zuverlässig exakte Treffer, und wir
// fragen bewusst nur das id-Feld ab, damit die Anfrage trotzdem leicht bleibt.
export async function getPublicImageCountsByGewerk(
  gewerkIds: string[]
): Promise<Record<string, number>> {
  const results = await Promise.all(
    gewerkIds.map((gewerkId) =>
      directus.request(
        readItems('images', {
          filter: {
            is_public: { _eq: true },
            organization: { gewerk: { _eq: gewerkId } },
          },
          fields: ['id'],
          limit: -1,
        })
      )
    )
  );
  const counts: Record<string, number> = {};
  gewerkIds.forEach((id, i) => {
    counts[id] = results[i]?.length ?? 0;
  });
  return counts;
}

// Gesamtzahl veröffentlichter Fotos, für den Statistik-Balken.
export async function getTotalPublicImageCount(): Promise<number> {
  const result = await directus.request(
    readItems('images', {
      filter: { is_public: { _eq: true } },
      fields: ['id'],
      limit: -1,
    })
  );
  return result.length;
}

// Gesamtzahl angeschlossener Organisationen.
export async function getTotalOrganizationCount(): Promise<number> {
  const result = await directus.request(
    readItems('organizations', { fields: ['id'], limit: -1 })
  );
  return result.length;
}

// Zuletzt freigegebene, öffentliche Fotos -- Grundlage für Mosaik und Ticker
// auf der Startseite. Holt zusätzlich den Organisationsnamen mit (Relation).
export async function getLatestPublicImages(limit = 8): Promise<DirectusImage[]> {
  return directus.request(
    readItems('images', {
      filter: { is_public: { _eq: true } },
      sort: ['-published_at'],
      limit,
      fields: [
        'id',
        'title',
        'file_public_preview',
        'file_download',
        'event_date',
        'event_kind',
        'alarm_code',
        'location',
        'tags',
        'is_public',
        'published_at',
        { organization: ['id', 'name', 'gewerk'] },
      ],
    })
  ) as Promise<DirectusImage[]>;
}

// Für das Bildarchiv: gefilterte, paginierte Liste öffentlicher Fotos.
// limit+1-Trick: wir fragen ein Bild mehr ab, als wir zeigen -- taucht es
// auf, wissen wir, dass es eine weitere Seite gibt, ohne eine separate
// Zähl-Abfrage zu brauchen.
export async function getPublicImagesPage({
  gewerkId,
  page = 1,
  pageSize = 24,
}: {
  gewerkId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ images: DirectusImage[]; hasNextPage: boolean }> {
  const filter: Record<string, unknown> = { is_public: { _eq: true } };
  if (gewerkId) {
    filter.organization = { gewerk: { _eq: gewerkId } };
  }

  const result = await directus.request(
    readItems('images', {
      filter,
      sort: ['-published_at'],
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
      fields: [
        'id',
        'title',
        'file_public_preview',
        'event_date',
        'alarm_code',
        'location',
        'tags',
        'is_public',
        'published_at',
        { organization: ['id', 'name', 'gewerk'] },
      ],
    })
  ) as DirectusImage[];

  return {
    images: result.slice(0, pageSize),
    hasNextPage: result.length > pageSize,
  };
}

// Alle Bilder der eigenen Organisation -- öffentliche UND private Entwürfe.
// Braucht deshalb den echten Access Token des eingeloggten Users statt des
// anonymen Public-Clients, der private Bilder gar nicht sehen darf.
export async function getMyOrganizationImages(
  accessToken: string
): Promise<DirectusImage[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/images?sort=-event_date&fields=id,title,file_public_preview,event_date,alarm_code,location,tags,is_public,published_at,organization.id,organization.name,organization.gewerk`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`getMyOrganizationImages fehlgeschlagen (Status ${res.status}):`, body);
    return [];
  }
  const { data } = await res.json();
  return data;
}

// Einzelnes Bild für die öffentliche Artikelseite. Nutzt bewusst den
// anonymen Public-Client (nicht den User-Token) -- so wird automatisch nur
// ausgeliefert, was laut Public-Policy wirklich öffentlich ist, unabhängig
// davon, wer die Seite gerade betrachtet. Existiert das Bild nicht oder ist
// es (noch) nicht öffentlich, meldet Directus 403/404 -- beides fangen wir
// gleich ab und behandeln es als "nicht gefunden".
export async function getPublicImageById(id: string): Promise<DirectusImage | null> {
  try {
    const result = await directus.request(
      readItem('images', id, {
        fields: [
          'id',
          'title',
          'article_body',
          'file_public_preview',
          'file_download',
          'event_date',
          'alarm_code',
          'location',
          'tags',
          'is_public',
          'published_at',
          { organization: ['id', 'name', 'gewerk'] },
        ],
      })
    );
    return result as unknown as DirectusImage;
  } catch (error) {
    console.error(`getPublicImageById(${id}) fehlgeschlagen:`, error);
    return null;
  }
}

// Alle Organisationen für das Organisationsverzeichnis, sortiert nach Name.
export async function getAllOrganizations(): Promise<Organization[]> {
  return directus.request(
    readItems('organizations', {
      sort: ['name'],
      fields: ['id', 'name', 'gewerk'],
    })
  ) as Promise<Organization[]>;
}

// Einzelne Organisation für die öffentliche Profilseite.
export async function getOrganizationById(id: string): Promise<Organization | null> {
  try {
    const result = await directus.request(
      readItem('organizations', id, {
        fields: ['id', 'name', 'gewerk'],
      })
    );
    return result as unknown as Organization;
  } catch (error) {
    console.error(`getOrganizationById(${id}) fehlgeschlagen:`, error);
    return null;
  }
}

// Öffentliche Fotos einer bestimmten Organisation, für deren Profilseite.
export async function getPublicImagesByOrganization(
  organizationId: string,
  limit = 24
): Promise<DirectusImage[]> {
  return directus.request(
    readItems('images', {
      filter: {
        is_public: { _eq: true },
        organization: { _eq: organizationId },
      },
      sort: ['-published_at'],
      limit,
      fields: [
        'id',
        'title',
        'file_public_preview',
        'event_date',
        'alarm_code',
        'location',
        'tags',
        'is_public',
        'published_at',
        { organization: ['id', 'name', 'gewerk'] },
      ],
    })
  ) as Promise<DirectusImage[]>;
}

// Alle bisher verwendeten Tags über öffentliche Bilder hinweg -- Grundlage
// für die Autocomplete-Vorschläge beim Hochladen. Bewusst über den
// anonymen Public-Client, weil Organisation-Nutzer damit auch die Tags
// anderer Organisationen als Vorschlag sehen (das ist gewollt: genau das
// sorgt für Standardisierung statt Wildwuchs).
export async function getAllUsedTags(): Promise<string[]> {
  const result = await directus.request(
    readItems('images', {
      filter: { is_public: { _eq: true } },
      fields: ['tags'],
      limit: -1,
    })
  );
  const all = new Set<string>();
  for (const row of result as { tags: string[] | null }[]) {
    (row.tags || []).forEach((t) => all.add(t));
  }
  return Array.from(all).sort((a, b) => a.localeCompare(b, 'de'));
}

// Echte Suche übers Bildarchiv. Holt bewusst eine größere Menge öffentlicher
// Bilder und filtert/sortiert direkt in unserem eigenen Code, statt sich auf
// Directus' Filterverhalten bei JSON-Feldern (tags) zu verlassen -- bei der
// aktuellen Größenordnung (paar hundert Bilder) kostet das praktisch nichts,
// garantiert aber korrektes Verhalten.
export async function searchPublicImages({
  query,
  gewerkId,
  page = 1,
  pageSize = 24,
}: {
  query: string;
  gewerkId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ images: DirectusImage[]; hasNextPage: boolean; total: number }> {
  const filter: Record<string, unknown> = { is_public: { _eq: true } };
  if (gewerkId) {
    filter.organization = { gewerk: { _eq: gewerkId } };
  }

  const candidates = (await directus.request(
    readItems('images', {
      filter,
      sort: ['-published_at'],
      limit: 500, // Obergrenze für die Textsuche -- reicht für die absehbare Größe
      fields: [
        'id',
        'title',
        'article_body',
        'file_public_preview',
        'event_date',
        'alarm_code',
        'location',
        'tags',
        'is_public',
        'published_at',
        { organization: ['id', 'name', 'gewerk'] },
      ],
    })
  )) as DirectusImage[];

  const q = query.trim().toLowerCase();
  const scored = candidates
    .map((img) => {
      const tagsText = (img.tags || []).join(' ').toLowerCase();
      const title = (img.title || '').toLowerCase();
      const location = (img.location || '').toLowerCase();
      const alarmCode = (img.alarm_code || '').toLowerCase();
      const articleText = (img.article_body || '').replace(/<[^>]+>/g, ' ').toLowerCase();

      let score = 0;
      if (tagsText.includes(q)) score += 4;
      if (title.includes(q)) score += 3;
      if (alarmCode.includes(q)) score += 3;
      if (location.includes(q)) score += 2;
      if (articleText.includes(q)) score += 1;

      return { img, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.img.published_at || '').localeCompare(a.img.published_at || ''));

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const pageItems = scored.slice(start, start + pageSize).map((entry) => entry.img);

  return {
    images: pageItems,
    hasNextPage: start + pageSize < total,
    total,
  };
}
