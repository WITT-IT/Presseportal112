import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyFolders } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import Breadcrumbs from '@/components/Breadcrumbs';
import CreateFolderForm from '@/components/CreateFolderForm';

export const dynamic = 'force-dynamic';

export default async function FoldersPage() {
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
  // Presse-Konten haben keine eigenen Ordner -- diese Seite ist
  // ausschließlich für BOS-Organisationen gedacht.
  if (user.organization.organization_type === 'press') redirect('/intern');

  const folders = await getMyFolders(session.accessToken, user.organization.id);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Ordner' }]} />
      <h1 className="mb-2 font-display text-[28px] font-bold">Eigene Ordner</h1>
      <p className="mb-8 max-w-[560px] text-[13.5px] leading-[1.6] text-ink-2">
        Beiträge zusätzlich zur automatischen Einordnung frei gruppieren —
        z. B. nach Einsatz, Veranstaltung oder Anlass.
      </p>

      <CreateFolderForm />

      {folders.length === 0 ? (
        <p className="text-[13px] text-ink-2">Noch keine Ordner angelegt.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/intern/ordner/${folder.id}`}
              className="overflow-hidden rounded-[10px] border border-line bg-white transition-colors hover:border-line-strong"
            >
              <div className="relative h-[120px] bg-panel">
                {folder.coverImage ? (
                  <Image
                    src={directusAssetUrl(folder.coverImage, 'width=300&quality=70')}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <i className="ti ti-folder text-[32px] text-ink-3" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="mb-0.5 truncate text-[13px] font-semibold text-ink">
                  {folder.name}
                </div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  {folder.postCount} Beitrag{folder.postCount === 1 ? '' : 'e'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
