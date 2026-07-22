import { readItems } from '@directus/sdk';
import { directus } from './directus';
import type { DirectusImage, Gewerk } from './types';

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
