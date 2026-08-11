import type { MetadataRoute } from 'next';

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      return new URL(raw).toString().replace(/\/$/, '');
    } catch {
      // fällt unten auf den Fallback zurück
    }
  }
  return 'https://www.presseportal112.de';
}

// Next.js generiert daraus automatisch /robots.txt -- keine statische
// Datei im public/-Ordner nötig, läuft über diese Route.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Interner Bereich -- ohnehin durch Login-Middleware gesperrt,
          // hier zusätzlich für Crawler markiert, damit kein Crawl-Budget
          // an 401/Redirect-Ketten verschwendet wird.
          '/intern',
          '/intern/',
          '/api/',
          // Token-geschützte Medienfreigaben sind für bestimmte Empfänger
          // gedacht, nicht für die Öffentlichkeit -- landen sonst im
          // schlimmsten Fall mit fremden Einsatzfotos in der Google-
          // Bildersuche, obwohl der Link nur an eine Redaktion ging.
          '/medienfreigabe/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
