// Diese Typen bilden 1:1 die Directus-Collections aus dem Datenmodell-Guide ab.

export type Gewerk = {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort: number;
};

export type Kategorie = {
  id: string;
  gewerk: string;
  code: string;
  name: string;
  sort: number;
};

export type Alarmcode = {
  id: string;
  gewerk: string;
  kategorie: string;
  code: string;
  name: string;
  sort: number;
};

export type Organization = {
  id: string;
  name: string;
  gewerk: string;
  organization_type?: string | null;
  branding_label?: string | null;
  description?: string | null;
  website?: string | null;
  social_links?: Record<string, string> | null;
  show_website?: boolean;
  show_social_links?: boolean;
  logo?: string | null;
  banner_image?: string | null;
};

export type PostImage = {
  id: string;
  post: Post | string | null;
  file_original: string | null;
  file_public_preview: string | null;
  file_download: string | null;
  no_watermark: boolean;
  caption: string | null;
  sort: number;
};

// post_type ist optional mit Fallback auf 'einsatz' -- das Feld existiert
// erst nach der Directus-Migration. Bestehende Beiträge ohne das Feld
// werden automatisch als Einsatzbeiträge behandelt.
// origin_folder_id merkt sich aus welchem Ordner ein Beitrag stammt,
// bevor er öffentlich gemacht wurde.
export type Post = {
  id: string;
  organization: Organization | string | null;
  post_type?: 'einsatz' | 'stockfoto' | null;
  title: string | null;
  article_body: string | null;
  event_date: string | null;
  event_kind?: string | null;
  alarm_code: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
  published_at: string | null;
  origin_folder_id?: string | null;
  images?: PostImage[];
};

export function primaryImage(post: Post): PostImage | null {
  if (!post.images || post.images.length === 0) return null;
  return [...post.images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0];
}

export function normalizeTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((t) => typeof t === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string');
    } catch {
      return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
}

// Ordner -- mit Systemordner-Feldern.
// is_system_folder und system_role sind optional bis zur Directus-Migration.
export type Folder = {
  id: string;
  name: string;
  organization?: string | null;
  is_system_folder?: boolean;
  system_role?: 'public' | 'unsorted' | null;
  postCount?: number;
  coverImage?: string | null;
};

// Medienbibliothek -- jedes hochgeladene Bild landet hier.
export type MediaLibraryItem = {
  id: string;
  organization: string;
  file: string;
  file_preview: string | null;
  file_download: string | null;
  original_filename: string | null;
  tags: string[] | null;
  uploaded_at: string;
  used_in_posts: string[];
};

// Medienfreigabe-Zusammenfassung für die Übersichtsliste.
export type MediaShareSummary = {
  id: string;
  name: string;
  recipientName: string | null;
  active: boolean;
  expiresAt: string;
  postCount: number;
};

// Medienfreigabe mit allen Beiträgen für die Detailseite.
export type MediaShareDetail = {
  id: string;
  name: string;
  recipientName: string | null;
  recipientEmail: string | null;
  token: string;
  active: boolean;
  expiresAt: string;
  autoDeleteOnExpiry: boolean;
  posts: Post[];
};

// Öffentliche Medienfreigabe für den Token-Zugriff.
export type PublicMediaShare = {
  id: string;
  name: string;
  recipientName: string | null;
  organizationName: string | null;
  expiresAt: string;
  posts: Post[];
};

export const GEWERK_COLORS: Record<string, string> = {
  feuerwehr: '#E4483C',
  drk: '#C81E2C',
  polizei: '#1E3A5F',
  thw: '#003087',
};

export const GEWERK_ICONS: Record<string, string> = {
  feuerwehr: 'ti-flame',
  drk: 'ti-first-aid-kit',
  polizei: 'ti-shield',
  thw: 'ti-tool',
};
