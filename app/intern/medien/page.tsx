import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getFolderContents, getMyOrganizationImages, getMyMediaShares } from '@/lib/queries';
import { getOrgStorageInfo } from '@/lib/orgStorage';
import MediaBrowser from '@/components/MediaBrowser';

export const dynamic = 'force-dynamic';

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

  // Die Seite hält bewusst KEINE eigene Kopfzeile mehr. Vorher lag der Hero
  // (Eyebrow, Titel, Kennzahlen, Speicherkarte) hier und die Aktionsleiste
  // in MediaBrowser -- zwei Kopfzonen aus zwei Dateien, die zusammen
  // gestapelt wurden und optisch nie zusammengehörten. Jetzt rendert
  // MediaBrowser Kopf UND Inhalt als eine Einheit; die Seite lädt nur noch
  // Daten. Der negative Rand zieht das Layout bündig unter die TopNav,
  // identisch zu app/intern/page.tsx.
  return (
    <div className="-mx-6 -mt-10 nav:-mx-10 nav:-mt-12">
      <MediaBrowser
        currentFolderId={folder ?? null}
        parentFolderId={contents.folder?.parent_folder ?? null}
        folderName={contents.folder?.name ?? null}
        breadcrumb={contents.breadcrumb}
        subfolders={contents.subfolders}
        items={contents.items}
        calendarPosts={calendarPosts}
        mediaShares={mediaShares.map((s) => ({ id: s.id, name: s.name }))}
        storageStatus={{ usedBytes: storage.usedBytes, limitBytes: storage.limitBytes }}
      />
    </div>
  );
}
