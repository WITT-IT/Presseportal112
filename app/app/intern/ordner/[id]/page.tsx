import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SESSION_COOKIE } from '@/lib/auth';
import { getFolderWithPosts } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage } from '@/lib/types';
import FolderActions from '@/components/FolderActions';
import RemoveFromFolderButton from '@/components/RemoveFromFolderButton';

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

  const folder = await getFolderWithPosts(session.accessToken, id);
  if (!folder) notFound();

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/intern/ordner"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Alle Ordner
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[32px] font-bold">{folder.name}</h1>
          <FolderActions folderId={folder.id} name={folder.name} />
        </div>

        {folder.posts.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            Noch keine Beiträge in diesem Ordner. Beim Hochladen oder
            Bearbeiten eines Beitrags lässt er sich zuordnen.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
            {folder.posts.map((post) => {
              const hero = primaryImage(post);
              return (
                <div key={post.id} className="relative">
                  <RemoveFromFolderButton folderId={folder.id} postId={post.id} />
                  <Link
                    href={`/intern/bearbeiten/${post.id}`}
                    className="block overflow-hidden rounded-[10px] border border-line bg-white"
                  >
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
                        className={`absolute bottom-2 left-2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${
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
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
