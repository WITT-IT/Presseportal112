import { createDirectus, rest } from '@directus/sdk';

const DIRECTUS_URL =
  process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus.witt-itsolutions.de';

// cache: 'no-store' verhindert, dass Next.js Directus-Antworten fälschlich
// zwischenspeichert (Next.js überschreibt sonst fetch() standardmäßig mit
// force-cache, was bei einer Live-Bilddatenbank zu veralteten Anzeigen führt).
export const directus = createDirectus(DIRECTUS_URL).with(
  rest({
    onRequest: (options) => ({ ...options, cache: 'no-store' }),
  })
);

// Baut die öffentliche Asset-URL für eine Directus-Datei-ID.
// Für die beiden watermarked Varianten (file_public_preview, file_download)
// reicht das direkt, weil die Public-Policy auf directus_files bereits
// auf den Dateibibliothek-Ordner "Öffentlich" gefiltert ist.
export function directusAssetUrl(fileId: string, params?: string) {
  return `${DIRECTUS_URL}/assets/${fileId}${params ? `?${params}` : ''}`;
}

export { DIRECTUS_URL };
