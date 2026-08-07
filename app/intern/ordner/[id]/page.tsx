import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getFolderWithPosts, getMyOrganizationImages, getMyMediaShares } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage } from '@/lib/types';
import Breadcrumbs from '@/components/Breadcrumbs';
import FolderActions from '@/components/FolderActions';
import FolderPostPicker from '@/components/FolderPostPicker';
import QuickUploadButton from '@/components/QuickUploadButton';

export const dynamic = 'force-dynamic';

export default async function FolderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const [folder, allOwnPosts] = await Promise.all([
    getFolderWithPosts(session.accessToken, id),
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyMediaShares(session.accessToken, user.organization.id),
  ]);
  if (!folder) notFound();

  const includedIds = new Set(folder.posts.map((p) => p.id));
  const availablePosts = allOwnPosts.filter((p) => !includedIds.has(p.id));

  const watermarkText = user.organization.branding_label || `Foto: ${user.organization.name ?? ''}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Übersicht', href: '/intern' },
          { label: 'Ordner', href: '/intern/ordner' },
          { label: folder.name },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[28px] font-bold">{folder.name}</h1>
        <FolderActions folderId={folder.id} name={folder.name} />
      </div>

      {/* Schnellupload — direkt per Drag & Drop oder Klick */}
      <div className="mb-6">
        <QuickUploadButton folderId={folder.id} watermarkText={watermarkText} />
      </div>

      <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
        Enthaltene Beiträge ({folder.posts.length})
      </h2>

      {folder.posts.length === 0 ? (
        <p className="mb-10 text-[13px] text-ink-2">
          Noch keine Beiträge in diesem Ordner — einfach Dateien oben ablegen.
        </p>
      ) : (
        <div className="mb-10 grid grid-cols-2 gap-4 nav:grid-cols-4">
          {folder.posts.map((post) => {
            const hero = primaryImage(post);
            return (
              <Link
                key={post.id}
                href={`/intern/bearbeiten/${post.id}`}
                className="group relative overflow-hidden rounded-[10px] border border-line bg-white transition-colors hover:border-line-strong"
              >
                <div className="relative h-[110px] bg-panel">
                  {(hero?.file_public_preview || hero?.file_public_preview_watermarked) && (
                    <Image
                      src={directusAssetUrl(
                        (hero.file_public_preview ?? hero.file_public_preview_watermarked)!,
                        'width=300&quality=70'
                      )}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${
                      post.is_public ? 'bg-ink text-white' : 'bg-white text-ink-2'
                    }`}
                  >
                    {post.is_public ? 'Öffentlich' : 'Entwurf'}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                    <i className="ti ti-edit text-[22px] text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="block truncate text-[12px] font-medium">
                    {post.title || post.alarm_code || 'Stockfoto'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
        Bestehenden Beitrag hinzufügen
      </h2>
      <FolderPostPicker folderId={folder.id} availablePosts={availablePosts} />
    </div>
  );
}
