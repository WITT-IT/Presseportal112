import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import AdminModerationList from '@/components/AdminModerationList';

export const dynamic = 'force-dynamic';

async function getAllPublicPostsForModeration() {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return [];
  const fields = [
    'id',
    'title',
    'alarm_code',
    'published_at',
    'uploaded_by',
    'content_confirmed_at',
    'organization.name',
    'images.id',
    'images.file_public_preview',
  ].join(',');
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[is_public][_eq]=true&fields=${fields}&sort=-published_at&limit=-1`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(
        `getAllPublicPostsForModeration fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return [];
    }
    const { data } = await res.json();
    return data;
  } catch (error) {
    console.error('getAllPublicPostsForModeration fehlgeschlagen:', error);
    return [];
  }
}

export default async function AdminModerationPage() {
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
  const admin = await isAdministrator(user.id);
  if (!admin) redirect('/intern');

  const posts = await getAllPublicPostsForModeration();

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/intern/admin"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Admin-Übersicht
        </Link>

        <h1 className="mb-2 font-display text-[32px] font-bold">Bildmoderation</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Alle veröffentlichten Beiträge portalweit. „Verwaist" markiert
          Beiträge, deren ursprüngliches Konto gelöscht wurde.
        </p>

        <AdminModerationList posts={posts} />
      </div>
    </section>
  );
}
