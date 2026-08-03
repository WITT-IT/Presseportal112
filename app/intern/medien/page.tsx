import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyOrganizationImages, getMyFolders, getMyMediaShares } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import MediaLibraryView from '@/components/MediaLibraryView';

export const dynamic = 'force-dynamic';

export default async function MedienPage() {
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

  const [posts, folders, mediaShares] = await Promise.all([
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyFolders(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
  ]);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Meine Medien' }]} />
      <h1 className="mb-6 font-display text-[28px] font-bold">Meine Medien</h1>
      <MediaLibraryView posts={posts} folders={folders} mediaShares={mediaShares} />
    </div>
  );
}
