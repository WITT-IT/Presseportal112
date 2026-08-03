import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyOrganizationImages } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import PostCalendar from '@/components/PostCalendar';

export const dynamic = 'force-dynamic';

export default async function KalenderPage() {
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
  // Presse-Konten haben keinen eigenen Beitragskalender -- diese Seite ist
  // ausschließlich für BOS-Organisationen gedacht.
  if (user.organization.organization_type === 'press') redirect('/intern');

  const posts = await getMyOrganizationImages(session.accessToken, user.organization.id);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Kalender' }]} />
      <h1 className="mb-6 font-display text-[28px] font-bold">Kalender</h1>
      <PostCalendar posts={posts} />
    </div>
  );
}
