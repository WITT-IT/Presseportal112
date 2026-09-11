import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getFolderContents, getMyOrganizationImages, getMyMediaShares } from '@/lib/queries';
import { getOrgStorageInfo } from '@/lib/orgStorage';
import MediaBrowser from '@/components/MediaBrowser';

export const dynamic = 'force-dynamic';

// Ermittelt für jeden Unterordner EIN Bild als Vorschau.
//
// Bewusst hier und nicht in getFolderContents(): Die Vorschau ist reine
// Darstellung. getFolderContents liefert die Struktur und wird auch von
// anderen Stellen genutzt, die kein Thumbnail brauchen -- die sollen nicht
// plötzlich pro Aufruf zusätzliche Abfragen bezahlen.
//
// Zweistufig, weil ein Ordner sehr wohl leer sein kann und trotzdem tiefer
// unten Bilder liegen: erst die direkt enthaltenen Bilder, und nur wenn es
// dort keine gibt, ein Blick eine Ebene tiefer. Tiefer als eine Ebene wird
// bewusst NICHT gesucht -- der Aufwand wächst sonst exponentiell mit der
// Verschachtelung, und ein Ordner, dessen einziges Bild drei Ebenen tiefer
// liegt, ist als Vorschaumotiv ohnehin wenig aussagekräftig.
async function getFolderThumbnails(
  accessToken: string,
  organizationId: string,
  folderIds: string[]
): Promise<Record<string, string | null>> {
  if (folderIds.length === 0) return {};
  const headers = { Authorization: `Bearer ${accessToken}` };

  async function newestMediaIdIn(folderFilter: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&${folderFilter}&fields=id&sort=-uploaded_at&limit=1`,
        { headers, cache: 'no-store' }
      );
      if (!res.ok) return null;
      const { data } = await res.json();
      return (data as { id: string }[])[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  const entries = await Promise.all(
    folderIds.map(async (folderId) => {
      const direct = await newestMediaIdIn(`filter[folder][_eq]=${folderId}`);
      if (direct) return [folderId, direct] as const;

      // Fallback: ein Bild aus einem direkten Unterordner.
      try {
        const childRes = await fetch(
          `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${organizationId}&filter[parent_folder][_eq]=${folderId}&fields=id&limit=50`,
          { headers, cache: 'no-store' }
        );
        if (!childRes.ok) return [folderId, null] as const;
        const { data } = await childRes.json();
        const childIds = (data as { id: string }[]).map((c) => c.id);
        if (childIds.length === 0) return [folderId, null] as const;

        const nested = await newestMediaIdIn(`filter[folder][_in]=${childIds.join(',')}`);
        return [folderId, nested] as const;
      } catch {
        return [folderId, null] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export default async function MedienPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) redirect('/login');

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect('/login');
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user) redirect('/login');
  if (!user.organization?.id) redirect('/intern');
  if (user.organization.organization_type === 'press') redirect('/intern');

  const [contents, calendarPosts, mediaShares, storage] = await Promise.all([
    getFolderContents(session.accessToken, user.organization.id, folder ?? null),
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
    getOrgStorageInfo(session.accessToken, user.organization.id),
  ]);

  // Erst nach getFolderContents, weil die Unterordner-IDs die Eingabe sind.
  const folderThumbs = await getFolderThumbnails(
    session.accessToken,
    user.organization.id,
    contents.subfolders.map((f) => f.id)
  );

  // Die Seite hält bewusst keine eigene Kopfzeile mehr -- MediaBrowser
  // rendert Kopf UND Inhalt als eine Einheit, die Seite lädt nur Daten.
  return (
    <div className="-mx-6 -mt-10 nav:-mx-10 nav:-mt-12">
      <MediaBrowser
        currentFolderId={folder ?? null}
        parentFolderId={contents.folder?.parent_folder ?? null}
        folderName={contents.folder?.name ?? null}
        currentFolderTags={contents.folder?.tags ?? null}
        breadcrumb={contents.breadcrumb}
        subfolders={contents.subfolders}
        folderThumbs={folderThumbs}
        items={contents.items}
        calendarPosts={calendarPosts}
        mediaShares={mediaShares.map((s) => ({ id: s.id, name: s.name }))}
        storageStatus={{ usedBytes: storage.usedBytes, limitBytes: storage.limitBytes }}
      />
    </div>
  );
}
