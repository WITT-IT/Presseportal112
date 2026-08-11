import type { MetadataRoute } from 'next';
import { DIRECTUS_URL } from '@/lib/directus';
import { getAllOrganizations } from '@/lib/queries';

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

// Schlanke, eigenständige Abfrage statt einer neuen Funktion in
// lib/queries.ts -- die Sitemap braucht nur id + published_at von
// öffentlichen Beiträgen, sonst nichts. limit=-1, weil Directus sonst nach
// 100 Einträgen abschneidet.
//
// ACHTUNG SKALIERUNG: Eine einzelne sitemap.xml darf laut Spec maximal
// 50.000 URLs enthalten. Solltet ihr diese Größenordnung an veröffentlichten
// Beiträgen erreichen (aktuell weit entfernt davon), muss das hier auf
// Next.js' generateSitemaps() umgestellt werden (mehrere sitemap-Dateien +
// ein Sitemap-Index) -- meld dich dann, baue ich um.
async function getAllPublicPostIds(): Promise<{ id: string; publishedAt: string | null }[]> {
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[is_public][_eq]=true&fields=id,published_at&limit=-1&sort=-published_at`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`Sitemap: öffentliche Beiträge laden fehlgeschlagen (Status ${res.status})`);
      return [];
    }
    const { data } = await res.json();
    return (data as { id: string; published_at: string | null }[]).map((p) => ({
      id: p.id,
      publishedAt: p.published_at,
    }));
  } catch (error) {
    console.error('Sitemap: öffentliche Beiträge laden fehlgeschlagen:', error);
    return [];
  }
}

// Next.js generiert daraus automatisch /sitemap.xml.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${siteUrl}/bildarchiv`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/organisationen`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${siteUrl}/kontakt`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/pressemappe`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/nutzungsbedingungen`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const [organizations, posts] = await Promise.all([
    getAllOrganizations(),
    getAllPublicPostIds(),
  ]);

  // Presse-Redaktionen haben kein öffentliches Profil unter /organisationen/[id]
  // (die Seite ist für BOS-Organisationen mit eigenem Gewerk/Bannerbild
  // gedacht) -- die würden sonst als dünne/leere Seiten in den Index rutschen.
  const organizationPages: MetadataRoute.Sitemap = organizations
    .filter((org) => org.organization_type !== 'press')
    .map((org) => ({
      url: `${siteUrl}/organisationen/${org.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/bildarchiv/${post.id}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
    changeFrequency: 'never',
    priority: 0.5,
  }));

  return [...staticPages, ...organizationPages, ...postPages];
}
