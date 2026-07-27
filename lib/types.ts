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
};

// Ein Foto innerhalb eines Beitrags. Enthält bewusst eine eigene
// Bildunterschrift pro Foto -- damit lässt sich jedes Bild einzeln erklären,
// statt nur eine Beschreibung für den ganzen Beitrag zu haben.
export type PostImage = {
  id: string;
  post: Post | string | null;
  file_public_preview: string | null; // Directus-Datei-UUID
  file_download: string | null;
  caption: string | null;
  sort: number;
};

// Ein Beitrag bündelt Titel, Text und Metadaten -- und dazu ein oder
// mehrere Fotos.
export type Post = {
  id: string;
  organization: Organization | string | null;
  title: string | null;
  article_body: string | null;
  event_date: string;
  event_kind?: string | null;
  alarm_code: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
  published_at: string | null;
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
export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch {
      // Kein gültiges JSON -- als Komma-Liste interpretieren.
    }
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// Zuordnung Gewerk -> Tailwind-Farbklasse, spiegelt gewerke.color aus Directus.
// Falls du eine Farbe in Directus änderst, hier synchron halten (oder später
// dynamisch aus der API übernehmen statt hart zu codieren).
export const GEWERK_COLORS: Record<string, string> = {
  feuerwehr: '#C31F2B',
  drk: '#B87A0A',
  polizei: '#245C9C',
  thw: '#1D7A4C',
};

export const GEWERK_ICONS: Record<string, string> = {
  feuerwehr: 'ti-flame',
  drk: 'ti-first-aid-kit',
  polizei: 'ti-shield',
  thw: 'ti-tool',
};
