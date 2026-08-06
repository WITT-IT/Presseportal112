import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getFolderContents } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
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

  const contents = await getFolderContents(session.accessToken, user.organization.id, folder ?? null);

  const breadcrumbItems = [
    { label: 'Übersicht', href: '/intern' },
    { label: 'Medien', href: contents.breadcrumb.length ? '/intern/medien' : undefined },
    ...contents.breadcrumb.map((b, i) => ({
      label: b.name,
      href: i === contents.breadcrumb.length - 1 ? undefined : `/intern/medien?folder=${b.id}`,
    })),
  ];

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="mb-6 font-display text-[28px] font-bold">
        {contents.folder?.name ?? 'Medien'}
      </h1>
      <MediaBrowser
        currentFolderId={folder ?? null}
        parentFolderId={contents.folder?.parent_folder ?? null}
        subfolders={contents.subfolders}
        items={contents.items}
      />
    </div>
  );
}
