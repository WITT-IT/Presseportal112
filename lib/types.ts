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

export type DirectusImage = {
  id: string;
  organization: Organization | string | null;
  title: string | null;
  article_body: string | null;
  file_public_preview: string | null; // Directus-Datei-UUID
  file_download: string | null;
  event_date: string;
  event_kind: string | null;
  alarm_code: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
  published_at: string | null;
};

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
