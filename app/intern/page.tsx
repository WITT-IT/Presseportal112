import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import {
  getMyOrganizationImages,
  getMyFoldersWithPostIds,
  getMyMediaShares,
} from '@/lib/queries';
import MediaLibraryView from '@/components/MediaLibraryView';

export const dynamic = 'force-dynamic';

export default async function InternPage() {
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

  const [posts, foldersWithPostIds, mediaShares] = await Promise.all([
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyFoldersWithPostIds(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
  ]);

  const publicCount = posts.filter((p) => p.is_public).length;
  const privateCount = posts.length - publicCount;
  const activeShareCount = mediaShares.filter((s) => s.active).length;

  const folders = foldersWithPostIds.map((f) => ({ id: f.id, name: f.name }));
  const mediaSharesForPicker = mediaShares.map((s) => ({ id: s.id, name: s.name }));

  const tiles = [
    { label: 'Uploads gesamt', value: posts.length },
    { label: 'Öffentlich', value: publicCount },
    { label: 'Privat', value: privateCount },
    { label: 'Aktive Freigaben', value: activeShareCount },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="mb-2 font-display text-[28px] font-bold">Willkommen</h1>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 nav:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[10px] border border-line bg-white px-3 py-2">
            <div className="text-[11.5px] font-semibold text-ink-3">{tile.label}</div>
            <div className="mt-1 text-[18px] font-bold text-ink">
              {tile.value.toLocaleString('de-DE')}
            </div>
          </div>
        ))}
      </div>

      <MediaLibraryView posts={posts} folders={folders} mediaShares={mediaSharesForPicker} />
    </div>
  );
}
