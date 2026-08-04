import { readItem, readItems, readSingleton } from '@directus/sdk';
import { directus, DIRECTUS_URL } from './directus';
import type {
  Alarmcode,
  Gewerk,
  MediaShareDetail,
  MediaShareSummary,
  Organization,
  Post,
  PublicMediaShare,
} from './types';
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
//
// WICHTIG: filtert jetzt explizit auf organizationId, statt sich
// ausschließlich auf die Directus-Berechtigungsfilter zu verlassen. Zweite
// Sicherheitsebene, nachdem eine falsch konfigurierte Directus-Policy
// dazu geführt hat, dass Organisationen fremde Beiträge sehen konnten --
// selbst wenn die Directus-Seite künftig wieder falsch steht, filtert
// dieser Code trotzdem korrekt.
export async function getMyOrganizationImages(
  accessToken: string,
  organizationId: string
): Promise<Post[]> {
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
    `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&sort=-event_date&fields=${fields}`,
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

// Alle Organisationen (BOS und Presse), sortiert nach Name. Bewusst ohne
// Filterung nach Typ hier -- diese Funktion wird auch für die
// Empfänger-Auswahl im Nachrichtensystem und die Admin-Freigabe genutzt,
// wo Presse-"Organisationen" durchaus gebraucht werden. Die öffentliche
// Verzeichnis-Seite filtert Presse-Einträge selbst heraus.
export async function getAllOrganizations(): Promise<Organization[]> {
  return directus.request(
    readItems('organizations', {
      sort: ['name'],
      fields: ['id', 'name', 'gewerk', 'organization_type'],
    })
  ) as Promise<Organization[]>;
}

// Einzelne Organisation für die öffentliche Profilseite.
export async function getOrganizationById(id: string): Promise<Organization | null> {
  try {
    const result = await directus.request(
      readItem('organizations', id, {
        fields: [
          'id',
          'name',
          'gewerk',
          'description',
          'website',
          'social_links',
          'show_website',
          'show_social_links',
          'logo',
          'banner_image',
        ],
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
  { page = 1, pageSize = 24 }: { page?: number; pageSize?: number } = {}
): Promise<{ images: Post[]; hasNextPage: boolean }> {
  // Ein Element mehr anfragen als angezeigt wird, um zu erkennen ob es eine
  // weitere Seite gibt -- spart eine zweite Zählabfrage. Gleiches Muster
  // wie im Bildarchiv.
  const rows = (await directus.request(
    readItems('posts', {
      filter: {
        is_public: { _eq: true },
        organization: { _eq: organizationId },
      },
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

// Einzelner Beitrag mit allen Feldern zum Bearbeiten -- läuft über den
// User-Token, damit auch Entwürfe geladen werden können, und Directus prüft
// automatisch über die Organisation-Policy, ob dieser Beitrag überhaupt zur
// eigenen Organisation gehört.
export async function getPostForEdit(accessToken: string, id: string): Promise<Post | null> {
  const fields = [
    'id',
    'title',
    'article_body',
    'event_date',
    'alarm_code',
    'location',
    'tags',
    'is_public',
    'organization.id',
    'organization.name',
    'organization.gewerk',
    'images.id',
    'images.file_public_preview',
    'images.caption',
    'images.sort',
    'images.no_watermark',
  ].join(',');

  const res = await fetch(`${DIRECTUS_URL}/items/posts/${id}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`getPostForEdit(${id}) fehlgeschlagen (Status ${res.status}):`, body);
    return null;
  }

  const { data } = await res.json();
  return data;
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

// ---------------------------------------------------------------------
// Datumssuche für searchPublicImages weiter unten.
//
// Erkennt deutsche Datumsschreibweisen in der Sucheingabe und liefert ein
// Teil-Datum zurück (Tag/Monat/Jahr sind alle optional -- was angegeben
// ist, muss passen, der Rest ist Wildcard). Unterstützt:
//   "4.8.2026"   -- Tag.Monat.Jahr
//   "04.08.26"   -- Tag.Monat.zweistelliges Jahr (=> 20xx)
//   "4.8."       -- nur Tag.Monat, jedes Jahr
//   "4.8"        -- dito, ohne Punkt am Ende
//   "08.2026"    -- nur Monat.Jahr
//   "2026"       -- nur Jahr
//   "August"     -- nur Monat (Name)
//   "4. August"  -- Tag + Monatsname
//   "August 2026" / "4. August 2026" -- mit Jahr
// ---------------------------------------------------------------------

type DateQuery = { day?: number; month?: number; year?: number };

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

function parseGermanDateQuery(raw: string): DateQuery | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;

  // "4.8.2026" / "04.08.26" / "4.8." -- Tag.Monat.[Jahr], zwei Punkte,
  // Jahr optional (auch leer nach dem zweiten Punkt).
  const dayMonthYear = q.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = Number(dayMonthYear[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let year: number | undefined;
      if (dayMonthYear[3]) {
        year =
          dayMonthYear[3].length === 2 ? 2000 + Number(dayMonthYear[3]) : Number(dayMonthYear[3]);
      }
      return { day, month, year };
    }
  }

  // "08.2026" -- Monat.Jahr, ein Punkt, Jahr vierstellig.
  const monthYear = q.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2]);
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  // "4.8" -- Tag.Monat, ein Punkt, kein Jahr.
  const dayMonth = q.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = Number(dayMonth[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month };
    }
  }

  // "2026" -- nur eine vierstellige Jahreszahl.
  const yearOnly = q.match(/^(\d{4})$/);
  if (yearOnly) {
    return { year: Number(yearOnly[1]) };
  }

  // "august" / "4. august" / "4 august 2026" / "august 2026" --
  // Monatsname, optional mit Tag davor und/oder Jahr danach.
  const wordMatch = q.match(/^(?:(\d{1,2})\.?\s+)?([a-zä]+)\.?(?:\s+(\d{4}))?$/);
  if (wordMatch) {
    const [, dayStr, monthWord, yearStr] = wordMatch;
    const month = GERMAN_MONTHS[monthWord];
    if (month) {
      return {
        day: dayStr ? Number(dayStr) : undefined,
        month,
        year: yearStr ? Number(yearStr) : undefined,
      };
    }
  }

  return null;
}

function matchesDateQuery(eventDateIso: string, dq: DateQuery): boolean {
  const d = new Date(eventDateIso);
  if (Number.isNaN(d.getTime())) return false;
  if (dq.day !== undefined && d.getDate() !== dq.day) return false;
  if (dq.month !== undefined && d.getMonth() + 1 !== dq.month) return false;
  if (dq.year !== undefined && d.getFullYear() !== dq.year) return false;
  return true;
}

// Suche übers Bildarchiv. Holt bewusst eine größere Menge und filtert
// in unserem eigenen Code, statt sich auf Directus' Filterverhalten bei
// JSON-Feldern (tags) zu verlassen -- bei der aktuellen Größenordnung
// kostet das praktisch nichts, garantiert aber korrektes Verhalten.
//
// Unterstützt zusätzlich zur Textsuche eine Datumssuche in deutschen
// Formaten (siehe parseGermanDateQuery oben) -- läuft als eigenständiges
// Score-Signal neben dem Textabgleich, verändert also nichts am
// bisherigen Verhalten für normale Stichwortsuchen.
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
  const dateQuery = parseGermanDateQuery(query);

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

      // Datumssuche -- eigenständiges Signal über das echte event_date,
      // nicht über Textabgleich. Greift nur, wenn die Eingabe sich
      // überhaupt als Datum interpretieren lässt.
      if (dateQuery && post.event_date && matchesDateQuery(post.event_date, dateQuery)) {
        score += 5;
      }

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

// Vom Admin manuell festgelegtes Titelbild für die Startseite -- läuft über
// ein Directus-"Singleton" (genau ein Einstellungs-Datensatz, keine Liste).
// Gibt null zurück, wenn nichts gesetzt ist oder der gewählte Beitrag aus
// irgendeinem Grund nicht (mehr) öffentlich ist -- dann greift auf der
// Startseite automatisch der bisherige "neuester Beitrag"-Fallback.
export async function getFeaturedHeroPost(): Promise<Post | null> {
  try {
    const result = await directus.request(
      readSingleton('site_settings', {
        fields: [
          {
            hero_post: [
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
            ],
          },
        ],
      })
    );
    const post = (result as { hero_post: Post | null })?.hero_post;
    return post && post.is_public ? post : null;
  } catch (error) {
    console.error('getFeaturedHeroPost fehlgeschlagen:', error);
    return null;
  }
}

// Alle 193 Alarmcodes -- kleine, feste Datenmenge, wird komplett geladen
// und dann im Browser live gegen die Eingabe abgeglichen (kein Grund für
// eine Anfrage pro Tastendruck).
export async function getAlarmcodes(): Promise<Alarmcode[]> {
  return directus.request(
    readItems('alarmcodes', {
      sort: ['sort'],
      fields: ['id', 'gewerk', 'kategorie', 'code', 'name', 'sort'],
      limit: -1,
    })
  ) as Promise<Alarmcode[]>;
}

// Eigene Ordner der Organisation samt Beitragsanzahl und einem
// Vorschaubild -- für die Kachel-Ansicht. Nimmt das erste gefundene Foto
// unter den zugeordneten Beiträgen als Titelbild, unabhängig von welchem
// Beitrag genau.
export async function getMyFolders(
  accessToken: string,
  organizationId: string
): Promise<{ id: string; name: string; postCount: number; coverImage: string | null }[]> {
  const fields = [
    'id',
    'name',
    'posts.posts_id.id',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.sort',
  ].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    console.error(`getMyFolders fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return (
    data as {
      id: string;
      name: string;
      posts?: {
        posts_id: {
          id: string;
          images?: { file_public_preview: string | null; sort: number }[];
        } | null;
      }[];
    }[]
  ).map((f) => {
    const posts = (f.posts || []).map((p) => p.posts_id).filter((p): p is NonNullable<typeof p> => !!p);
    let coverImage: string | null = null;
    for (const post of posts) {
      const images = post.images || [];
      if (images.length === 0) continue;
      const sorted = [...images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      if (sorted[0]?.file_public_preview) {
        coverImage = sorted[0].file_public_preview;
        break;
      }
    }
    return {
      id: f.id,
      name: f.name,
      postCount: posts.length,
      coverImage,
    };
  });
}

// Ein einzelner Ordner mit allen zugeordneten Beiträgen (inkl. Fotos), für
// die Ordner-Detailseite.
export async function getFolderWithPosts(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string; posts: Post[] } | null> {
  const fields = [
    'id',
    'name',
    'posts.posts_id.id',
    'posts.posts_id.title',
    'posts.posts_id.alarm_code',
    'posts.posts_id.event_date',
    'posts.posts_id.is_public',
    'posts.posts_id.published_at',
    'posts.posts_id.images.id',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.sort',
  ].join(',');

  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(
      `getFolderWithPosts(${folderId}) fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return null;
  }
  const { data } = await res.json();
  const posts = ((data.posts || []) as { posts_id: Post | null }[])
    .map((row) => row.posts_id)
    .filter((p): p is Post => !!p);
  return { id: data.id, name: data.name, posts };
}

// Eigene Ordner samt der IDs ihrer Beiträge -- schlanker als
// getFolderWithPosts (keine Bilder, keine Titel), gedacht für den
// "ganzen Ordner in eine Freigabe ziehen"-Baustein, der nur wissen muss,
// welche IDs zu welchem Ordner gehören.
export async function getMyFoldersWithPostIds(
  accessToken: string,
  organizationId: string
): Promise<{ id: string; name: string; postIds: string[] }[]> {
  const fields = ['id', 'name', 'posts.posts_id.id'].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    console.error(
      `getMyFoldersWithPostIds fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return [];
  }
  const { data } = await res.json();
  return (
    data as { id: string; name: string; posts?: { posts_id: { id: string } | null }[] }[]
  ).map((f) => ({
    id: f.id,
    name: f.name,
    postIds: (f.posts || [])
      .map((p) => p.posts_id?.id)
      .filter((id): id is string => !!id),
  }));
}

// Eigene Medienfreigaben samt Beitragsanzahl -- für die Übersicht unter
// /intern/freigaben. Ebenfalls mit explizitem organizationId-Filter.
export async function getMyMediaShares(
  accessToken: string,
  organizationId: string
): Promise<MediaShareSummary[]> {
  const fields = ['id', 'name', 'recipient_name', 'active', 'expires_at', 'posts.id'].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/media_shares?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    console.error(
      `getMyMediaShares fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return [];
  }
  const { data } = await res.json();
  return (
    data as {
      id: string;
      name: string;
      recipient_name: string | null;
      active: boolean;
      expires_at: string;
      posts?: unknown[];
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    recipientName: row.recipient_name,
    active: row.active,
    expiresAt: row.expires_at,
    postCount: (row.posts || []).length,
  }));
}

// Eine einzelne Freigabe mit allen zugeordneten Beiträgen -- für die
// interne Verwaltungs-Detailseite (eingeloggt, eigene Organisation).
export async function getMediaShareWithPosts(
  accessToken: string,
  shareId: string
): Promise<MediaShareDetail | null> {
  const fields = [
    'id',
    'name',
    'recipient_name',
    'recipient_email',
    'token',
    'active',
    'expires_at',
    'auto_delete_on_expiry',
    'posts.posts_id.id',
    'posts.posts_id.title',
    'posts.posts_id.alarm_code',
    'posts.posts_id.event_date',
    'posts.posts_id.is_public',
    'posts.posts_id.published_at',
    'posts.posts_id.images.id',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.sort',
  ].join(',');

  const res = await fetch(`${DIRECTUS_URL}/items/media_shares/${shareId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(
      `getMediaShareWithPosts(${shareId}) fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return null;
  }
  const { data } = await res.json();
  const posts = ((data.posts || []) as { posts_id: Post | null }[])
    .map((row) => row.posts_id)
    .filter((p): p is Post => !!p);

  return {
    id: data.id,
    name: data.name,
    recipientName: data.recipient_name,
    recipientEmail: data.recipient_email,
    token: data.token,
    active: data.active,
    expiresAt: data.expires_at,
    autoDeleteOnExpiry: data.auto_delete_on_expiry,
    posts,
  };
}

// Freigaben, die andere Organisationen gezielt an ein Presse-Konto
// geschickt haben -- läuft über den Service-Token, weil das zwangsläufig
// über Organisationsgrenzen hinweg gelesen werden muss (die empfangende
// Organisation ist ja nicht die, die den Beitrag besitzt).
export async function getReceivedMediaShares(organizationId: string): Promise<
  {
    id: string;
    name: string;
    senderOrganizationName: string | null;
    token: string;
    active: boolean;
    expiresAt: string;
    postCount: number;
  }[]
> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return [];
  const fields = ['id', 'name', 'token', 'active', 'expires_at', 'organization.name', 'posts.id'].join(
    ','
  );
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/media_shares?filter[recipient_organization][_eq]=${organizationId}&fields=${fields}&sort=-expires_at`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(
        `getReceivedMediaShares fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return [];
    }
    const { data } = await res.json();
    return (
      data as {
        id: string;
        name: string;
        token: string;
        active: boolean;
        expires_at: string;
        organization: { name: string } | null;
        posts?: unknown[];
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      senderOrganizationName: row.organization?.name ?? null,
      token: row.token,
      active: row.active,
      expiresAt: row.expires_at,
      postCount: (row.posts || []).length,
    }));
  } catch (error) {
    console.error('getReceivedMediaShares fehlgeschlagen:', error);
    return [];
  }
}

// Öffentlicher Zugriff auf eine Freigabe per Token -- läuft bewusst
// ausschließlich über den Service-Token, nie über eine Public-Policy.
// Prüft dabei gleich mit, ob die Freigabe noch gültig ist, und räumt
// abgelaufene Freigaben mit aktivierter Auto-Löschung im Vorbeigehen auf.
export async function getMediaShareByToken(token: string): Promise<PublicMediaShare | null> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('getMediaShareByToken: DIRECTUS_SERVICE_TOKEN fehlt.');
    return null;
  }

  const fields = [
    'id',
    'name',
    'recipient_name',
    'active',
    'expires_at',
    'auto_delete_on_expiry',
    'organization.name',
    'posts.posts_id.id',
    'posts.posts_id.title',
    'posts.posts_id.alarm_code',
    'posts.posts_id.event_date',
    'posts.posts_id.location',
    'posts.posts_id.is_public',
    'posts.posts_id.published_at',
    'posts.posts_id.images.id',
    'posts.posts_id.images.file_original',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.file_download',
    'posts.posts_id.images.caption',
    'posts.posts_id.images.sort',
  ].join(',');

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/media_shares?filter[token][_eq]=${encodeURIComponent(
        token
      )}&fields=${fields}&limit=1`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(
        `getMediaShareByToken fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return null;
    }
    const { data } = await res.json();
    const row = data?.[0];
    if (!row) return null;

    const expired = !row.active || new Date(row.expires_at).getTime() <= Date.now();
    if (expired) {
      if (row.auto_delete_on_expiry) {
        fetch(`${DIRECTUS_URL}/items/media_shares/${row.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${serviceToken}` },
        }).catch(() => {});
      }
      return null;
    }

    const posts = ((row.posts || []) as { posts_id: Post | null }[])
      .map((r) => r.posts_id)
      .filter((p): p is Post => !!p);

    return {
      id: row.id,
      name: row.name,
      recipientName: row.recipient_name,
      organizationName: row.organization?.name ?? null,
      expiresAt: row.expires_at,
      posts,
    };
  } catch (error) {
    console.error('getMediaShareByToken fehlgeschlagen:', error);
    return null;
  }
}
