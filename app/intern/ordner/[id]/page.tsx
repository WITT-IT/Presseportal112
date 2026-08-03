import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getFolderWithPosts, getMyOrganizationImages } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage } from '@/lib/types';
import Breadcrumbs from '@/components/Breadcrumbs';
import FolderActions from '@/components/FolderActions';
import RemoveFromFolderButton from '@/components/RemoveFromFolderButton';
import FolderPostPicker from '@/components/FolderPostPicker';

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

  const [folder, allOwnPosts] = await Promise.all([
    getFolderWithPosts(session.accessToken, id),
    getMyOrganizationImages(session.accessToken, user.organization.id),
  ]);
  if (!folder) notFound();

  const includedIds = new Set(folder.posts.map((p) => p.id));
  const availablePosts = allOwnPosts.filter((p) => !includedIds.has(p.id));

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Übersicht', href: '/intern' },
          { label: 'Ordner', href: '/intern/ordner' },
          { label: folder.name },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[28px] font-bold">{folder.name}</h1>
        <div className="flex flex-wrap gap-2">
          <FolderActions folderId={folder.id} name={folder.name} />
          <Link
            href={`/intern/upload?folderId=${folder.id}`}
            className="flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            <i className="ti ti-plus text-[14px]" aria-hidden="true" />
            Foto in diesen Ordner hochladen
          </Link>
        </div>
      </div>

      <p className="mb-6 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-2">
        Öffentliche und noch nicht veröffentlichte Beiträge können
        problemlos gemeinsam in diesem Ordner liegen — praktisch, wenn ein
        Medienvertreter gezielt nach einem noch nicht freigegebenen Bild aus
        demselben Einsatz fragt.
      </p>

      <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
        Enthaltene Beiträge ({folder.posts.length})
      </h2>
      {folder.posts.length === 0 ? (
        <p className="mb-10 text-[13px] text-ink-2">
          Noch keine Beiträge in diesem Ordner — oben direkt hochladen, oder
          unten einen bestehenden Beitrag auswählen.
        </p>
      ) : (
        <div className="mb-10 grid grid-cols-2 gap-4 nav:grid-cols-4">
          {folder.posts.map((post) => {
            const hero = primaryImage(post);
            return (
              <div
                key={post.id}
                className="relative overflow-hidden rounded-[10px] border border-line bg-white"
              >
                <RemoveFromFolderButton folderId={folder.id} postId={post.id} />
                <div className="relative h-[110px] bg-panel">
                  {hero?.file_public_preview && (
                    <Image
                      src={directusAssetUrl(hero.file_public_preview, 'width=300&quality=70')}
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
                </div>
                <div className="p-2.5">
                  <span className="truncate text-[12px] font-medium">
                    {post.title || post.alarm_code || 'Ohne Titel'}
                  </span>
                </div>
              </div>
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
