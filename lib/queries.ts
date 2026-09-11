import { readItem, readItems, readSingleton } from '@directus/sdk';
import { directus, DIRECTUS_URL } from './directus';
import { isUuid } from './validate';
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

function folderTagToken(userToken: string): string {
  return process.env.DIRECTUS_SERVICE_TOKEN || userToken;
}

async function supportsFolderTags(accessToken: string): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_URL}/items/folders?fields=tags&limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return res.ok;
}

async function resolveFolderTagReaderToken(
  userToken: string
): Promise<{ token: string; viaFallback: boolean } | null> {
  if (await supportsFolderTags(userToken)) {
    return { token: userToken, viaFallback: false };
  }

  const fallback = folderTagToken(userToken);
  if (fallback !== userToken && (await supportsFolderTags(fallback))) {
    return { token: fallback, viaFallback: true };
  }

  return null;
}

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

export async function getGewerke(): Promise<Gewerk[]> {
  return directus.request(
    readItems('gewerke', {
      sort: ['sort'],
      fields: ['id', 'name', 'icon', 'color', 'sort'],
    })
  ) as Promise<Gewerk[]>;
}

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

export async function getMyOrganizationImages(
  accessToken: string,
  organizationId: string
): Promise<Post[]> {
  const fields = [
    'id', 'title', 'event_date', 'alarm_code', 'location', 'tags',
    'is_public', 'published_at',
    'organization.id', 'organization.name', 'organization.gewerk',
    'images.id', 'images.file_public_preview', 'images.caption', 'images.sort',
  ].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&sort=-event_date&fields=${fields}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getMyOrganizationImages fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return data;
}

// VALIDIERUNG ergänzt: "id" kommt hier über die SDK-Funktion readItem(),
// die selbst nicht per roher Template-String-Verkettung angreifbar ist --
// die Prüfung dient hier vor allem sauberen Fehlern statt eines
// Directus-Fehlers, falls id (typischerweise aus einem dynamischen
// Routensegment auf einer öffentlichen Seite) kein echtes UUID ist.
export async function getPublicImageById(id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  try {
    const result = await directus.request(
      readItem('posts', id, { fields: PUBLIC_POST_FIELDS as unknown as string[] })
    );
    return result as unknown as Post;
  } catch (error) {
    console.error(`getPublicImageById(${id}) fehlgeschlagen:`, error);
    return null;
  }
}

export async function getAllOrganizations(): Promise<Organization[]> {
  return directus.request(
    readItems('organizations', {
      sort: ['name'],
      fields: ['id', 'name', 'gewerk', 'organization_type'],
    })
  ) as Promise<Organization[]>;
}

// VALIDIERUNG ergänzt: gleiche Begründung wie bei getPublicImageById --
// SDK-Aufruf, aber id kommt typischerweise direkt aus einem dynamischen
// Routensegment (Organisationsprofil-Seite).
export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!isUuid(id)) return null;
  try {
    const result = await directus.request(
      readItem('organizations', id, {
        fields: ['id', 'name', 'gewerk', 'description', 'website', 'social_links',
          'show_website', 'show_social_links', 'logo', 'banner_image'],
      })
    );
    return result as unknown as Organization;
  } catch (error) {
    console.error(`getOrganizationById(${id}) fehlgeschlagen:`, error);
    return null;
  }
}

// VALIDIERUNG ergänzt: SDK-Aufruf mit Filter-Objekt statt roher
// String-Verkettung, aber organizationId kommt direkt aus einem
// öffentlichen, dynamischen Routensegment.
export async function getPublicImagesByOrganization(
  organizationId: string,
  { page = 1, pageSize = 24 }: { page?: number; pageSize?: number } = {}
): Promise<{ images: Post[]; hasNextPage: boolean }> {
  if (!isUuid(organizationId)) return { images: [], hasNextPage: false };
  const rows = (await directus.request(
    readItems('posts', {
      filter: { is_public: { _eq: true }, organization: { _eq: organizationId } },
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

// ECHTE INJECTION-FLÄCHE: id landet als Pfadsegment in einer roh
// verketteten Directus-URL. Wird typischerweise mit searchParams.get(...)
// von der internen Bearbeiten-Seite aufgerufen -- direkt vom Nutzer
// beeinflussbar.
export async function getPostForEdit(accessToken: string, id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const fields = [
    'id', 'post_type', 'title', 'article_body', 'event_date', 'alarm_code', 'location', 'tags', 'is_public',
    'organization.id', 'organization.name', 'organization.gewerk',
    'images.id', 'images.file_public_preview', 'images.file_public_preview_watermarked', 'images.caption', 'images.sort', 'images.no_watermark',
  ].join(',');
  const res = await fetch(`${DIRECTUS_URL}/items/posts/${id}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`getPostForEdit(${id}) fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return null;
  }
  const { data } = await res.json();
  return data;
}

export async function getAllUsedTags(): Promise<string[]> {
  try {
    const result = await directus.request(
      readItems('posts', { filter: { is_public: { _eq: true } }, fields: ['tags'], limit: -1 })
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

type DateQueryDay   = { type: 'day';   date: string };
type DateQueryMonth = { type: 'month'; year: string; month: string };

function parseDateQuery(raw: string): DateQueryDay | DateQueryMonth | null {
  const q = raw.trim();
  const dayDe = q.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dayDe) {
    const [, d, m, y] = dayDe;
    return { type: 'day', date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
  }
  const monthDe = q.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthDe) {
    const [, m, y] = monthDe;
    return { type: 'month', year: y, month: m.padStart(2, '0') };
  }
  const dayIso = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayIso) return { type: 'day', date: q };
  const monthIso = q.match(/^(\d{4})-(\d{2})$/);
  if (monthIso) return { type: 'month', year: monthIso[1], month: monthIso[2] };
  return null;
}

export async function searchPublicImages({
  query, gewerkId, page = 1, pageSize = 24,
}: {
  query: string; gewerkId?: string; page?: number; pageSize?: number;
}): Promise<{ images: Post[]; hasNextPage: boolean; total: number }> {
  const filter: Record<string, unknown> = { is_public: { _eq: true } };
  if (gewerkId) filter.organization = { gewerk: { _eq: gewerkId } };
  const candidates = (await directus.request(
    readItems('posts', { filter, sort: ['-published_at'], limit: 500, fields: PUBLIC_POST_FIELDS as unknown as string[] })
  )) as Post[];
  const dateQuery = parseDateQuery(query);
  const q = query.trim().toLowerCase();
  const scored = candidates.map((post) => {
    if (dateQuery) {
      const eventDate = (post.event_date || '').slice(0, 10);
      if (dateQuery.type === 'day') return { post, score: eventDate === dateQuery.date ? 5 : 0 };
      if (dateQuery.type === 'month') {
        const prefix = `${dateQuery.year}-${dateQuery.month}`;
        return { post, score: eventDate.startsWith(prefix) ? 5 : 0 };
      }
    }
    const tagsText = normalizeTags(post.tags).join(' ').toLowerCase();
    let score = 0;
    if (tagsText.includes(q)) score += 4;
    if ((post.title || '').toLowerCase().includes(q)) score += 3;
    if ((post.alarm_code || '').toLowerCase().includes(q)) score += 3;
    if ((post.location || '').toLowerCase().includes(q)) score += 2;
    if ((post.images || []).map((img) => img.caption || '').join(' ').toLowerCase().includes(q)) score += 2;
    if ((post.article_body || '').replace(/<[^>]+>/g, ' ').toLowerCase().includes(q)) score += 1;
    return { post, score };
  }).filter((e) => e.score > 0).sort((a, b) =>
    b.score - a.score ||
    (dateQuery
      ? (b.post.event_date || '').localeCompare(a.post.event_date || '')
      : (b.post.published_at || '').localeCompare(a.post.published_at || ''))
  );
  const total = scored.length;
  const start = (page - 1) * pageSize;
  return { images: scored.slice(start, start + pageSize).map((e) => e.post), hasNextPage: start + pageSize < total, total };
}

export async function getFeaturedHeroPost(): Promise<Post | null> {
  try {
    const result = await directus.request(
      readSingleton('site_settings', {
        fields: [{
          hero_post: [
            'id', 'title', 'article_body', 'event_date', 'alarm_code', 'location', 'tags', 'is_public', 'published_at',
            { organization: ['id', 'name', 'gewerk'] },
            { images: ['id', 'file_public_preview', 'file_download', 'caption', 'sort'] },
          ],
        }],
      })
    );
    const post = (result as { hero_post: Post | null })?.hero_post;
    return post && post.is_public ? post : null;
  } catch (error) {
    console.error('getFeaturedHeroPost fehlgeschlagen:', error);
    return null;
  }
}

export async function getAlarmcodes(): Promise<Alarmcode[]> {
  return directus.request(
    readItems('alarmcodes', { sort: ['sort'], fields: ['id', 'gewerk', 'kategorie', 'code', 'name', 'sort'], limit: -1 })
  ) as Promise<Alarmcode[]>;
}

// Echte, selbst angelegte Ordner der Organisation. Keine Systemordner mehr.
export async function getMyFolders(
  accessToken: string,
  organizationId: string
): Promise<{
  id: string;
  name: string;
  postCount: number;
  coverImage: string | null;
}[]> {
  const fields = [
    'id', 'name',
    'posts.posts_id.id',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.sort',
  ].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getMyFolders fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return (data as {
    id: string;
    name: string;
    posts?: { posts_id: { id: string; images?: { file_public_preview: string | null; sort: number }[] } | null }[];
  }[]).map((f) => {
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
    return { id: f.id, name: f.name, postCount: posts.length, coverImage };
  });
}

// ECHTE INJECTION-FLÄCHE: folderId landet als Pfadsegment, roh verkettet.
// Kommt typischerweise über ein dynamisches Routensegment oder
// searchParams von einer internen Ordner-Seite -- direkt vom Nutzer
// beeinflussbar.
export async function getFolderWithPosts(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string; posts: Post[] } | null> {
  if (!isUuid(folderId)) return null;
  const fields = [
    'id', 'name',
    'posts.posts_id.id', 'posts.posts_id.title', 'posts.posts_id.alarm_code',
    'posts.posts_id.event_date', 'posts.posts_id.is_public', 'posts.posts_id.published_at',
    'posts.posts_id.images.id',
    'posts.posts_id.images.file_public_preview',
    'posts.posts_id.images.file_public_preview_watermarked',
    'posts.posts_id.images.sort',
  ].join(',');
  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`getFolderWithPosts(${folderId}) fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return null;
  }
  const { data } = await res.json();
  const posts = ((data.posts || []) as { posts_id: Post | null }[])
    .map((row) => row.posts_id).filter((p): p is Post => !!p);
  return { id: data.id, name: data.name, posts };
}

export async function getMyFoldersWithPostIds(
  accessToken: string,
  organizationId: string
): Promise<{ id: string; name: string; postIds: string[] }[]> {
  const fields = ['id', 'name', 'posts.posts_id.id'].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getMyFoldersWithPostIds fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return (data as { id: string; name: string; posts?: { posts_id: { id: string } | null }[] }[]).map((f) => ({
    id: f.id,
    name: f.name,
    postIds: (f.posts || []).map((p) => p.posts_id?.id).filter((id): id is string => !!id),
  }));
}

export async function getMyMediaShares(
  accessToken: string,
  organizationId: string
): Promise<MediaShareSummary[]> {
  const fields = ['id', 'name', 'recipient_name', 'active', 'expires_at', 'posts.id'].join(',');
  const res = await fetch(
    `${DIRECTUS_URL}/items/media_shares?filter[organization][_eq]=${organizationId}&fields=${fields}&sort=name`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getMyMediaShares fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return (data as { id: string; name: string; recipient_name: string | null; active: boolean; expires_at: string; posts?: unknown[] }[])
    .map((row) => ({
      id: row.id, name: row.name, recipientName: row.recipient_name,
      active: row.active, expiresAt: row.expires_at, postCount: (row.posts || []).length,
    }));
}

// Eine einzelne Freigabe mit allen zugeordneten Beiträgen UND direkt
// angehängten Bibliotheks-Bildern (Originale, kein Wasserzeichen) -- für
// die interne Verwaltungs-Detailseite (eingeloggt, eigene Organisation).
export type MediaShareLibraryImage = {
  id: string;
  displayName: string | null;
  fileOriginal: string;
};

// ECHTE INJECTION-FLÄCHE: shareId landet ZWEIMAL roh verkettet -- einmal
// als Pfadsegment, einmal als Filter-Wert. Kommt direkt aus dem
// dynamischen Routensegment der internen Freigabe-Detailseite.
export async function getMediaShareWithPosts(
  accessToken: string,
  shareId: string
): Promise<(MediaShareDetail & { libraryImages: MediaShareLibraryImage[] }) | null> {
  if (!isUuid(shareId)) return null;

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

  const mediaRes = await fetch(
    `${DIRECTUS_URL}/items/media_shares_media?filter[media_shares_id][_eq]=${shareId}&fields=media_library_id.id,media_library_id.display_name,media_library_id.file`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  let libraryImages: MediaShareLibraryImage[] = [];
  if (mediaRes.ok) {
    const { data: mediaData } = await mediaRes.json();
    libraryImages = (
      mediaData as { media_library_id: { id: string; display_name: string | null; file: string } | null }[]
    )
      .map((row) => row.media_library_id)
      .filter((m): m is { id: string; display_name: string | null; file: string } => !!m)
      .map((m) => ({ id: m.id, displayName: m.display_name, fileOriginal: m.file }));
  } else {
    console.error(
      `getMediaShareWithPosts(${shareId}): Bibliotheks-Bilder konnten nicht geladen werden (Status ${mediaRes.status}):`,
      await mediaRes.text().catch(() => '')
    );
  }

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
    libraryImages,
  };
}

export async function getReceivedMediaShares(organizationId: string): Promise<{
  id: string; name: string; senderOrganizationName: string | null;
  token: string; active: boolean; expiresAt: string; postCount: number;
}[]> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return [];
  const fields = ['id', 'name', 'token', 'active', 'expires_at', 'organization.name', 'posts.id'].join(',');
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/media_shares?filter[recipient_organization][_eq]=${organizationId}&fields=${fields}&sort=-expires_at`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`getReceivedMediaShares fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
      return [];
    }
    const { data } = await res.json();
    return (data as { id: string; name: string; token: string; active: boolean; expires_at: string; organization: { name: string } | null; posts?: unknown[] }[])
      .map((row) => ({
        id: row.id, name: row.name, senderOrganizationName: row.organization?.name ?? null,
        token: row.token, active: row.active, expiresAt: row.expires_at, postCount: (row.posts || []).length,
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
//
// "token" braucht hier KEINE isUuid()-Prüfung: Freigabe-Tokens sind kein
// UUID, sondern 24 Byte echter Zufall als Base64url (randomBytes(24)) --
// das wäre also eine falsche Prüfung. Der bestehende
// encodeURIComponent(token) reicht hier bereits aus, weil der Token als
// hochentropischer Geheimwert fungiert, nicht als vorhersagbare ID.
export async function getMediaShareByToken(token: string): Promise<PublicMediaShare | null> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) { console.error('getMediaShareByToken: DIRECTUS_SERVICE_TOKEN fehlt.'); return null; }
  const fields = [
    'id', 'name', 'recipient_name', 'active', 'expires_at', 'auto_delete_on_expiry', 'organization.name',
    'posts.posts_id.id', 'posts.posts_id.title', 'posts.posts_id.alarm_code', 'posts.posts_id.event_date',
    'posts.posts_id.location', 'posts.posts_id.is_public', 'posts.posts_id.published_at',
    'posts.posts_id.images.id', 'posts.posts_id.images.file_original',
    'posts.posts_id.images.file_public_preview', 'posts.posts_id.images.file_download',
    'posts.posts_id.images.caption', 'posts.posts_id.images.sort',
  ].join(',');
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/media_shares?filter[token][_eq]=${encodeURIComponent(token)}&fields=${fields}&limit=1`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) { console.error(`getMediaShareByToken fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => '')); return null; }
    const { data } = await res.json();
    const row = data?.[0];
    if (!row) return null;
    const expired = !row.active || new Date(row.expires_at).getTime() <= Date.now();
    if (expired) {
      if (row.auto_delete_on_expiry) {
        fetch(`${DIRECTUS_URL}/items/media_shares/${row.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${serviceToken}` },
        }).catch(() => {});
      }
      return null;
    }
    const posts = ((row.posts || []) as { posts_id: Post | null }[])
      .map((r) => r.posts_id).filter((p): p is Post => !!p);

    // row.id kommt aus Directus' eigener Antwort, nicht mehr vom Client --
    // hier ist keine erneute Prüfung nötig.
    const mediaRes = await fetch(
      `${DIRECTUS_URL}/items/media_shares_media?filter[media_shares_id][_eq]=${row.id}&fields=media_library_id.id,media_library_id.display_name,media_library_id.file`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    let libraryImages: PublicMediaShare['libraryImages'] = [];
    if (mediaRes.ok) {
      const { data: mediaData } = await mediaRes.json();
      libraryImages = (
        mediaData as { media_library_id: { id: string; display_name: string | null; file: string } | null }[]
      )
        .map((r) => r.media_library_id)
        .filter((m): m is { id: string; display_name: string | null; file: string } => !!m)
        .map((m) => ({ id: m.id, displayName: m.display_name, fileOriginal: m.file }));
    } else {
      console.error(
        `getMediaShareByToken(${token}): Bibliotheks-Bilder konnten nicht geladen werden (Status ${mediaRes.status}):`,
        await mediaRes.text().catch(() => '')
      );
    }

    return {
      id: row.id,
      name: row.name,
      recipientName: row.recipient_name,
      organizationName: row.organization?.name ?? null,
      expiresAt: row.expires_at,
      posts,
      libraryImages,
    };
  } catch (error) {
    console.error('getMediaShareByToken fehlgeschlagen:', error);
    return null;
  }
}

// Ordnerinhalt (Unterordner + Medien) + Breadcrumb-Pfad für die Kachel-
// Ansicht unter /intern/medien. folderId = null → Wurzel der Organisation.
//
// ECHTE INJECTION-FLÄCHE, UND DIE DEUTLICHSTE IN DER GANZEN DATEI:
// folderId landet nicht nur einmal, sondern läuft in der
// Breadcrumb-Schleife wiederholt als Pfadsegment durch (currentId startet
// direkt mit dem übergebenen folderId), zusätzlich zweimal als Filter-Wert
// weiter unten. Kommt aus searchParams.folder auf /intern/medien --
// direkt und unmittelbar vom Nutzer über die URL steuerbar.
export async function getFolderContents(
  accessToken: string,
  organizationId: string,
  folderId: string | null
): Promise<{
  folder: { id: string; name: string; parent_folder: string | null; tags: string[] | null } | null;
  breadcrumb: { id: string; name: string }[];
  subfolders: { id: string; name: string; tags: string[] | null }[];
  items: {
    id: string;
    display_name: string | null;
    file: string;
    file_preview: string | null;
    tags: string[] | null;
  }[];
}> {
  if (folderId !== null && !isUuid(folderId)) {
    console.error(`getFolderContents: ungültige folderId "${folderId}" -- breche ab.`);
    return { folder: null, breadcrumb: [], subfolders: [], items: [] };
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const folderTagReader = await resolveFolderTagReaderToken(accessToken);
  const folderReadHeaders = {
    Authorization: `Bearer ${folderTagReader ? folderTagReader.token : accessToken}`,
  };

  const breadcrumb: { id: string; name: string }[] = [];
  let currentId = folderId;
  let currentFolder: { id: string; name: string; parent_folder: string | null; tags: string[] | null } | null = null;
  let guard = 0;
  while (currentId && guard < 8) {
    guard++;
    // currentId ist beim ersten Schleifendurchlauf das bereits geprüfte
    // folderId; ab dem zweiten Durchlauf stammt es aus Directus' eigener
    // Antwort (data.parent_folder), nicht mehr vom Client -- dort ist
    // keine erneute Prüfung nötig.
    const fields = folderTagReader
      ? folderTagReader.viaFallback
        ? 'id,name,parent_folder,tags,organization'
        : 'id,name,parent_folder,tags'
      : 'id,name,parent_folder';
    const res = await fetch(`${DIRECTUS_URL}/items/folders/${currentId}?fields=${fields}`, {
      headers: folderReadHeaders,
      cache: 'no-store',
    });
    if (!res.ok) break;
    const { data } = await res.json();
    if (folderTagReader?.viaFallback) {
      const orgId =
        typeof data.organization === 'string'
          ? data.organization
          : typeof data.organization?.id === 'string'
          ? data.organization.id
          : null;
      if (orgId !== organizationId) {
        console.error(`getFolderContents: Fallback-Lesezugriff auf fremde Organisation für Ordner ${data.id} geblockt.`);
        return { folder: null, breadcrumb: [], subfolders: [], items: [] };
      }
    }
    const normalizedFolder = {
      id: data.id,
      name: data.name,
      parent_folder: data.parent_folder ?? null,
      tags: folderTagReader ? normalizeTags(data.tags) : null,
    };
    if (!currentFolder) currentFolder = normalizedFolder;
    breadcrumb.unshift({ id: data.id, name: data.name });
    currentId = data.parent_folder;
  }

  const parentFilter = folderId ? `filter[parent_folder][_eq]=${folderId}` : `filter[parent_folder][_null]=true`;
  const folderFilter = folderId ? `filter[folder][_eq]=${folderId}` : `filter[folder][_null]=true`;

  const taggedSubfoldersFields = folderTagReader?.viaFallback ? 'id,name,tags,organization' : 'id,name,tags';
  const taggedSubfoldersUrl = `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&${parentFilter}&fields=${taggedSubfoldersFields}&sort=name&limit=200`;
  const plainSubfoldersUrl = `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&${parentFilter}&fields=id,name&sort=name&limit=200`;
  let subfoldersRes = await fetch(folderTagReader ? taggedSubfoldersUrl : plainSubfoldersUrl, {
    headers: folderTagReader ? folderReadHeaders : headers,
    cache: 'no-store',
  });
  let tagsReadable = Boolean(folderTagReader);
  if (!subfoldersRes.ok && folderTagReader) {
    tagsReadable = false;
    subfoldersRes = await fetch(plainSubfoldersUrl, { headers, cache: 'no-store' });
  }

  const itemsRes = await fetch(
    `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&${folderFilter}&fields=id,display_name,file,file_preview,tags&sort=-uploaded_at&limit=200`,
    { headers, cache: 'no-store' }
  );

  const subfoldersRaw = subfoldersRes.ok ? (await subfoldersRes.json()).data : [];
  const subfolders = (subfoldersRaw as { id: string; name: string; tags?: unknown; organization?: unknown }[])
    .filter((folder) => {
      if (!tagsReadable || !folderTagReader?.viaFallback) return true;
      const orgId =
        typeof folder.organization === 'string'
          ? folder.organization
          : typeof (folder.organization as { id?: unknown } | null)?.id === 'string'
          ? ((folder.organization as { id: string }).id)
          : null;
      return orgId === organizationId;
    })
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      tags: tagsReadable ? normalizeTags(folder.tags) : null,
    }));
  const items = itemsRes.ok ? (await itemsRes.json()).data : [];

  return { folder: currentFolder, breadcrumb, subfolders, items };
}

// Ein einzelnes Medienbibliothek-Item für den Veröffentlichen-Flow unter
// /intern/upload?mediaId=... -- inkl. gecachter Wasserzeichen-Varianten,
// damit UploadStudio weiß, ob es die Wasserzeichen-Erzeugung überspringen
// kann (Bild wurde schon einmal veröffentlicht).
//
// ECHTE INJECTION-FLÄCHE: id landet als Pfadsegment, roh verkettet, kommt
// direkt aus searchParams.mediaId.
export async function getMediaLibraryItem(
  accessToken: string,
  id: string
): Promise<{
  id: string;
  organization: string;
  file: string;
  file_preview: string | null;
  file_preview_watermarked: string | null;
  file_download_watermarked: string | null;
  display_name: string | null;
  tags: string[] | null;
} | null> {
  if (!isUuid(id)) return null;
  const fields = [
    'id', 'organization', 'file', 'file_preview',
    'file_preview_watermarked', 'file_download_watermarked',
    'display_name', 'tags',
  ].join(',');
  const res = await fetch(`${DIRECTUS_URL}/items/media_library/${id}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`getMediaLibraryItem(${id}) fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return null;
  }
  const { data } = await res.json();
  return data;
}
