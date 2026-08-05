// Diese Typen bilden 1:1 die Directus-Collections aus dem Datenmodell-Guide ab.
// Wenn du später weitere Felder in Directus ergänzt, hier nachziehen.

export type Gewerk = {
  id: string; // 'feuerwehr' | 'drk' | 'polizei' | 'thw'
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

// Ein Foto innerhalb eines Beitrags. Enthält bewusst eine eigene
// Bildunterschrift pro Foto -- damit lässt sich jedes Bild einzeln erklären,
// statt nur eine Beschreibung für den ganzen Beitrag zu haben.
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

// Ein Beitrag bündelt Titel, Text und Metadaten -- und dazu ein oder
// mehrere Fotos.
//
// post_type = 'einsatz'  → Pflichtfelder: title, event_date, alarm_code, location
// post_type = 'stockfoto' → nur tags + images, alles andere optional/null
//
// origin_folder_id merkt sich aus welchem Ordner ein Beitrag stammt,
// bevor er öffentlich gemacht wurde -- damit kann beim Zurückziehen
// entschieden werden ob er in "Unsortiert" landet oder im Ursprungsordner
// verbleibt.
export type Post = {
  id: string;
  organization: Organization | string | null;
  post_type: 'einsatz' | 'stockfoto';
  title: string | null;
  article_body: string | null;
  event_date: string | null;
  event_kind?: string | null;
  alarm_code: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
  published_at: string | null;
  origin_folder_id: string | null;
  images?: PostImage[];
};

// Hilfsfunktion: das erste Foto eines Beitrags (nach sort), z. B. für
// Übersichtskarten und Vorschaubilder.
export function primaryImage(post: Post): PostImage | null {
  if (!post.images || post.images.length === 0) return null;
  return [...post.images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0];
}

// Verwandelt tags robust in ein echtes String-Array, egal wie die Daten
// tatsächlich vorliegen -- schützt vor Abstürzen, falls z. B. beim manuellen
// Anlegen/Migrieren eines Beitrags aus Versehen ein Text statt eines
// JSON-Arrays im Feld gelandet ist.
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

// Ordner -- jetzt mit Systemordner-Feldern.
// is_system_folder = true  → Lösch-Button im UI ausblenden, API verweigert DELETE
// system_role              → 'public' = Öffentlich-Ordner, 'unsorted' = Unsortiert
export type Folder = {
  id: string;
  name: string;
  organization: string | null;
  is_system_folder: boolean;
  system_role: 'public' | 'unsorted' | null;
  postCount?: number;
  coverImage?: string | null;
};

// Ein Eintrag in der Medienbibliothek -- jedes hochgeladene Bild landet
// hier, unabhängig davon ob es bereits in einem Beitrag verwendet wird.
// Das erlaubt den "Aus Bibliothek wählen"-Flow im Upload Studio.
export type MediaLibraryItem = {
  id: string;
  organization: string;
  file: string;             // Directus file UUID -- Original
  file_preview: string | null; // Wasserzeichen-Vorschau
  file_download: string | null;
  original_filename: string | null;
  tags: string[] | null;
  uploaded_at: string;
  used_in_posts: string[];  // post-IDs die dieses Bild nutzen
};

// Hilfskonstanten für die Gewerk-Farben und -Icons.
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
