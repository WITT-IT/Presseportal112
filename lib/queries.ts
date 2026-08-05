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

export async function getAllOrganizations(): Promise<Organization[]> {
  return directus.request(
    readItems('organizations', {
      sort: ['name'],
      fields: ['id', 'name', 'gewerk', 'organization_type'],
    })
  ) as Promise<Organization[]>;
}

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

export async function getPublicImagesByOrganization(
  organizationId: string,
  { page = 1, pageSize = 24 }: { page?: number; pageSize?: number } = {}
): Promise<{ images: Post[]; hasNextPage: boolean }> {
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

// ---------------------------------------------------------------------------
// Datumserkennung für die Suchleiste
// ---------------------------------------------------------------------------
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
      limit: 500,
      fields: PUBLIC_POST_FIELDS as unknown as string[],
    })
  )) as Post[];

  const dateQuery = parseDateQuery(query);
  const q = query.trim().toLowerCase();

  const scored = candidates
    .map((post) => {
      if (dateQuery) {
        const eventDate = (post.event_date || '').slice(0, 10);
        if (dateQuery.type === 'day') {
          return { post, score: eventDate === dateQuery.date ? 5 : 0 };
        }
        if (dateQuery.type === 'month') {
          const prefix = `${dateQuery.year}-${dateQuery.month}`;
          return { post, score: eventDate.startsWith(prefix) ? 5 : 0 };
        }
      }

      const tagsText = normalizeTags(post.tags).join(' ').toLowerCase();
      const title = (post.title || '').toLowerCase();
      const location = (post.location || '').toLowerCase();
      const alarmCode = (post.alarm_code || '').toLowerCase();
      const articleText = (post.article_body || '').replace(/<[^>]+>/g, ' ').toLowerCase();
      const captions = (post.images || []).map((img) => img.caption || '').join(' ').toLowerCase();

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
        (dateQuery
          ? (b.post.event_date || '').localeCompare(a.post.event_date || '')
          : (b.post.published_at || '').localeCompare(a.post.published_at || ''))
    );

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const pageItems = scored.slice(start, start + pageSize).map((entry) => entry.post);

  return { images: pageItems, hasNextPage: start + pageSize < total, total };
}

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

export async function getAlarmcodes(): Promise<Alarmcode[]> {
  return directus.request(
    readItems('alarmcodes', {
      sort: ['sort'],
      fields: ['id', 'gewerk', 'kategorie', 'code', 'name', 'sort'],
      limit: -1,
    })
  ) as Promise<Alarmcode[]>;
}

// getMyFolders -- jetzt mit is_system_folder + system_role
export async function getMyFolders(
  accessToken: string,
  organizationId: string
): Promise<{
  id: string;
  name: string;
  postCount: number;
  coverImage: string | null;
  is_system_folder: boolean;
  system_role: 'public' | 'unsorted' | null;
}[]> {
  const fields = [
    'id',
    'name',
    'is_system_folder',
    'system_role',
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
      is_system_folder: boolean | null;
      system_role: 'public' | 'unsorted' | null;
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
      is_system_folder: f.is_system_folder ?? false,
      system_role: f.system_role ?? null,
      postCount: posts.length,
      coverImage,
    };
  });
}

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
  const fields = ['id', 'name', 'token', 'active', 'expires_at', 'organization.name', 'posts.id'].join(',');
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
      `${DIRECTUS_URL}/items/media_shares?filter[token][_eq]=${encodeURIComponent(token)}&fields=${fields}&limit=1`,
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
