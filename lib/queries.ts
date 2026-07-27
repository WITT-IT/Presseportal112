import { readItem, readItems } from '@directus/sdk';
import { directus, DIRECTUS_URL } from './directus';
import type { Gewerk, Organization, Post } from './types';
import { normalizeTags } from './types';

// Felder, die für die öffentliche Anzeige eines Beitrags gebraucht werden.
// Bewusst ohne event_kind und uploaded_by -- die sind in der Public-Policy
// gesperrt, und ein einziges nicht freigegebenes Feld lässt Directus die
// komplette Anfrage mit 403 ablehnen.
const PUBLIC_POST_FIELDS = [
  'id',
  'title',
  'article_body',
  'event_date',
  'alarm_code',
  'location',
  'tags',
  'is_public',
  'published_at',
  { organization: ['id', 'name', 'gewerk'] },
  { images: ['id', 'file_public_preview', 'file_download', 'caption', 'sort'] },
] as const;

// Vier Gewerke inkl. Sortierung, wie in der Taxonomie angelegt.
export async function getGewerke(): Promise<Gewerk[]> {
  return directus.request(
    readItems('gewerke', {
      sort: ['sort'],
      fields: ['id', 'name', 'icon', 'color', 'sort'],
    })
  ) as Promise<Gewerk[]>;
}

// Anzahl veröffentlichter Beiträge pro Gewerk, für die Zähler auf den
// Gewerke-Karten. Bewusst über readItems + Array-Länge gelöst statt über
// aggregate() -- das hat bekannte Bugs im Zusammenspiel mit gefilterten
// Relationen (directus/directus#23395, #25803).
export async function getPublicImageCountsByGewerk(
  gewerkIds: string[]
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    gewerkIds.map(async (id) => {
      const rows = await directus.request(
        readItems('posts', {
          filter: { is_public: { _eq: true }, organization: { gewerk: { _eq: id } } },
          fields: ['id'],
          limit: -1,
        })
      );
      return [id, rows.length] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function getTotalPublicImageCount(): Promise<number> {
  const rows = await directus.request(
    readItems('posts', {
      filter: { is_public: { _eq: true } },
      fields: ['id'],
      limit: -1,
    })
  );
  return rows.length;
}

export async function getTotalOrganizationCount(): Promise<number> {
  const rows = await directus.request(
    readItems('organizations', { fields: ['id'], limit: -1 })
  );
  return rows.length;
}

// Neueste veröffentlichte Beiträge -- für Ticker und Startseiten-Mosaik.
export async function getLatestPublicImages(limit = 8): Promise<Post[]> {
  return directus.request(
    readItems('posts', {
      filter: { is_public: { _eq: true } },
      sort: ['-published_at'],
      limit,
      fields: PUBLIC_POST_FIELDS as unknown as string[],
    })
  ) as Promise<Post[]>;
}

// Seitenweise Beiträge fürs Bildarchiv, optional nach Gewerk gefiltert.
// Fragt bewusst ein Element mehr an als angezeigt wird, um zu erkennen, ob
// es eine weitere Seite gibt -- spart eine zweite Zählabfrage.
export async function getPublicImagesPage({
  gewerkId,
  page = 1,
  pageSize = 24,
}: {
  gewerkId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ images: Post[]; hasNextPage: boolean }> {
  const filter: Record<string, unknown> = { is_public: { _eq: true } };
  if (gewerkId) {
    filter.organization = { gewerk: { _eq: gewerkId } };
  }

  const rows = (await directus.request(
    readItems('posts', {
      filter,
      sort: ['-published_at'],
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
      fields: PUBLIC_POST_FIELDS as unknown as string[],
    })
  )) as Post[];

  return {
    images: rows.slice(0, pageSize),
    hasNextPage: rows.length > pageSize,
  };
}

// Beiträge der eigenen Organisation für den internen Bereich. Nutzt den
// User-Token statt des anonymen Clients, damit auch Entwürfe sichtbar sind.
export async function getMyOrganizationImages(accessToken: string): Promise<Post[]> {
  const fields = [
    'id',
    'title',
    'event_date',
    'alarm_code',
    'location',
    'tags',
    'is_public',
    'published_at',
    'organization.id',
    'organization.name',
    'organization.gewerk',
    'images.id',
    'images.file_public_preview',
    'images.caption',
    'images.sort',
  ].join(',');

  const res = await fetch(
    `${DIRECTUS_URL}/items/posts?sort=-event_date&fields=${fields}`,
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

// Einzelner Beitrag für die öffentliche Artikelseite. Nutzt bewusst den
// anonymen Public-Client -- so wird automatisch nur ausgeliefert, was laut
// Public-Policy wirklich öffentlich ist.
export async function getPublicImageById(id: string): Promise<Post | null> {
  try {
    const result = await directus.request(
      readItem('posts', id, {
        fields: PUBLIC_POST_FIELDS as unknown as string[],
      })
    );
    return result as unknown as Post;
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

// Öffentliche Beiträge einer bestimmten Organisation, für deren Profilseite.
export async function getPublicImagesByOrganization(
  organizationId: string,
  limit = 24
): Promise<Post[]> {
  return directus.request(
    readItems('posts', {
      filter: {
        is_public: { _eq: true },
        organization: { _eq: organizationId },
      },
      sort: ['-published_at'],
      limit,
      fields: PUBLIC_POST_FIELDS as unknown as string[],
    })
  ) as Promise<Post[]>;
}

// Alle bisher verwendeten Tags -- Grundlage für die Autocomplete-Vorschläge
// beim Hochladen. Gewollt über alle Organisationen hinweg, damit sich die
// Schlagworte portalweit angleichen statt auseinanderzulaufen.
export async function getAllUsedTags(): Promise<string[]> {
  try {
    const result = await directus.request(
      readItems('posts', {
        filter: { is_public: { _eq: true } },
        fields: ['tags'],
        limit: -1,
      })
    );
    const all = new Set<string>();
    for (const row of result as { tags: string[] | null }[]) {
      normalizeTags(row.tags).forEach((t) => all.add(t));
    }
    return Array.from(all).sort((a, b) => a.localeCompare(b, 'de'));
  } catch (error) {
    console.error('getAllUsedTags fehlgeschlagen:', error);
    return [];
  }
}

// Suche übers Bildarchiv. Holt bewusst eine größere Menge und filtert
// in unserem eigenen Code, statt sich auf Directus' Filterverhalten bei
// JSON-Feldern (tags) zu verlassen -- bei der aktuellen Größenordnung
// kostet das praktisch nichts, garantiert aber korrektes Verhalten.
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
}): Promise<{ images: Post[]; hasNextPage: boolean; total: number }> {
  const filter: Record<string, unknown> = { is_public: { _eq: true } };
  if (gewerkId) {
    filter.organization = { gewerk: { _eq: gewerkId } };
  }

  const candidates = (await directus.request(
    readItems('posts', {
      filter,
      sort: ['-published_at'],
      limit: 500, // Obergrenze für die Textsuche -- reicht für die absehbare Größe
      fields: PUBLIC_POST_FIELDS as unknown as string[],
    })
  )) as Post[];

  const q = query.trim().toLowerCase();
  const scored = candidates
    .map((post) => {
      const tagsText = normalizeTags(post.tags).join(' ').toLowerCase();
      const title = (post.title || '').toLowerCase();
      const location = (post.location || '').toLowerCase();
      const alarmCode = (post.alarm_code || '').toLowerCase();
      const articleText = (post.article_body || '').replace(/<[^>]+>/g, ' ').toLowerCase();
      const captions = (post.images || [])
        .map((img) => img.caption || '')
        .join(' ')
        .toLowerCase();

      let score = 0;
      if (tagsText.includes(q)) score += 4;
      if (title.includes(q)) score += 3;
      if (alarmCode.includes(q)) score += 3;
      if (location.includes(q)) score += 2;
      if (captions.includes(q)) score += 2;
      if (articleText.includes(q)) score += 1;

      return { post, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.post.published_at || '').localeCompare(a.post.published_at || '')
    );

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const pageItems = scored.slice(start, start + pageSize).map((entry) => entry.post);

  return { images: pageItems, hasNextPage: start + pageSize < total, total };
}
