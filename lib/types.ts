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

export type StorageTier = 'tier_250' | 'tier_500' | 'tier_1000';

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
  // Speicherlimit -- storage_used_bytes wird AUSSCHLIESSLICH server-seitig
  // in app/api/intern/library/route.ts (POST/DELETE) gepflegt, nie vom
  // Client gesetzt. storage_tier ist nur das lesbare Label fürs UI, das
  // eigentliche Limit steht in storage_limit_bytes -- beide werden beim
  // Tier-Wechsel immer gemeinsam gepatcht, nie einzeln.
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  storage_tier?: StorageTier;
  subscription_status?: 'active' | 'past_due' | 'canceled' | null;
};

// source_media_id verweist auf die Medienbibliothek (media_library.id) --
// gesetzt, wenn das Foto über das Studio veröffentlicht wurde. Ist es leer,
// wurde das Foto direkt hochgeladen (alte Flows) und gehört exklusiv diesem
// Bild-Datensatz. Diese Unterscheidung entscheidet beim Löschen, ob die
// physische Datei mitgelöscht werden darf oder der Bibliothek gehört.
export type PostImage = {
  id: string;
  post: Post | string | null;
  source_media_id?: string | null;
  file_original: string | null;
  file_public_preview: string | null;
  file_public_preview_watermarked?: string | null;
  file_download: string | null;
  file_download_watermarked?: string | null;
  no_watermark: boolean;
  caption: string | null;
  sort: number;
};

// post_type ist optional mit Fallback auf 'einsatz' -- das Feld existiert
// erst nach der Directus-Migration. Bestehende Beiträge ohne das Feld
// werden automatisch als Einsatzbeiträge behandelt.
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

// Ordner -- eigene, frei anlegbare Ordner der Organisation, mit echter
// Verschachtelung. Keine Systemordner mehr (Öffentlich/Unsortiert sind
// Geschichte, is_public am Post ist die einzige Quelle der Wahrheit).
// parent_folder: null/undefined = Wurzel der Organisation, sonst ID des
// übergeordneten Ordners -- ermöglicht Ordner-in-Ordner (Kachel-Ansicht
// unter /intern/medien).
export type Folder = {
  id: string;
  name: string;
  organization?: string | null;
  parent_folder?: string | null;
  postCount?: number;
  coverImage?: string | null;
};

// Medienbibliothek -- jedes hochgeladene Bild landet hier, unabhängig
// davon ob/wie es später veröffentlicht wird.
// folder: aktueller Ort im Ordnerbaum (null = Wurzel der Organisation).
// display_name: frei umbenennbarer Anzeigename, unabhängig vom
// ursprünglichen original_filename beim Upload.
// used_in_posts: Liste der Beitrags-IDs, die dieses Bild aktuell
// referenzieren -- solange die nicht leer ist, blockt das Löschen in
// /api/intern/library, weil Beiträge sonst ihr Foto verlieren würden.
export type MediaLibraryItem = {
  id: string;
  organization: string;
  folder: string | null;
  display_name: string | null;
  file: string;
  file_preview: string | null;
  file_download: string | null;
  file_preview_watermarked?: string | null;
  file_download_watermarked?: string | null;
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

// Direkt (ohne Umweg über einen Beitrag) an eine Freigabe angehängtes
// Bibliotheksbild -- Original, kein Wasserzeichen. lib/queries.ts
// definiert innerhalb von getMediaShareWithPosts einen strukturgleichen
// lokalen Typ gleichen Namens für die interne Verwaltungsseite; dieser
// hier ist die zentrale Version für den öffentlichen Zugriff.
export type MediaShareLibraryImage = {
  id: string;
  displayName: string | null;
  fileOriginal: string;
};

// Öffentliche Medienfreigabe für den Token-Zugriff. libraryImages ist das
// Pendant zu MediaShareDetail.posts für direkt angehängte Bibliotheksbilder
// -- ohne dieses Feld sah /medienfreigabe/[token] nur Beiträge, nie
// einzeln hinzugefügte Bibliotheksbilder (siehe getMediaShareByToken in
// lib/queries.ts).
export type PublicMediaShare = {
  id: string;
  name: string;
  recipientName: string | null;
  organizationName: string | null;
  expiresAt: string;
  posts: Post[];
  libraryImages: MediaShareLibraryImage[];
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
