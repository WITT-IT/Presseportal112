import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Image from 'next/image';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import {
  getMediaShareWithPosts,
  getMyOrganizationImages,
  getMyFoldersWithPostIds,
} from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage, type Post } from '@/lib/types';
import Breadcrumbs from '@/components/Breadcrumbs';
import MediaShareActions from '@/components/MediaShareActions';
import MediaShareLinkBox from '@/components/MediaShareLinkBox';
import RemoveFromMediaShareButton from '@/components/RemoveFromMediaShareButton';
import RemoveLibraryFromShareButton from '@/components/RemoveLibraryFromShareButton';
import MediaSharePostPicker from '@/components/MediaSharePostPicker';
import MediaShareLibraryPicker from '@/components/MediaShareLibraryPicker';
import MediaShareFolderPicker from '@/components/MediaShareFolderPicker';
import FolderToShareControl from '@/components/FolderToShareControl';

export const dynamic = 'force-dynamic';

export default async function MediaShareDetailPage({
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

  const [share, allOwnPosts, folders] = await Promise.all([
    getMediaShareWithPosts(session.accessToken, id),
    getMyOrganizationImages(session.accessToken, user.organization.id),
    getMyFoldersWithPostIds(session.accessToken, user.organization.id),
  ]);
  if (!share) notFound();

  const includedIds = new Set(share.posts.map((p: Post) => p.id));
  const availablePosts = allOwnPosts.filter((p: Post) => !includedIds.has(p.id));
  const includedLibraryIds = share.libraryImages.map((img) => img.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Übersicht', href: '/intern' },
          { label: 'Freigaben', href: '/intern/freigaben' },
          { label: share.name },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[28px] font-bold">{share.name}</h1>
        <MediaShareActions shareId={share.id} name={share.name} active={share.active} />
      </div>

      <MediaShareLinkBox
        shareId={share.id}
        token={share.token}
        shareName={share.name}
        recipientName={share.recipientName}
        recipientEmail={share.recipientEmail}
        expiresAt={share.expiresAt}
      />

      <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
        Enthaltene Beiträge ({share.posts.length})
      </h2>
      {share.posts.length === 0 ? (
        <p className="mb-10 text-[13px] text-ink-2">
          Noch keine Beiträge in dieser Freigabe — wähl unten welche aus,
          oder direkt einen ganzen Ordner hinzufügen.
        </p>
      ) : (
        <div className="mb-10 grid grid-cols-2 gap-4 nav:grid-cols-4">
          {share.posts.map((post: Post) => {
            const hero = primaryImage(post);
            return (
              <div
                key={post.id}
                className="relative overflow-hidden rounded-[10px] border border-line bg-white"
              >
                <RemoveFromMediaShareButton shareId={share.id} postId={post.id} />
                <div className="relative h-[110px] bg-panel">
                  {hero?.file_public_preview && (
                    <Image
                      src={directusAssetUrl(hero.file_public_preview, 'width=300&quality=70')}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
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
        Weiteres Bildmaterial ({share.libraryImages.length})
      </h2>
      <p className="mb-4 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-2">
        Zusätzliche Fotos aus der Bibliothek, ohne dass sie ein eigener
        Beitrag werden müssen — als Original, ohne Wasserzeichen.
      </p>
      {share.libraryImages.length === 0 ? (
        <p className="mb-6 text-[13px] text-ink-2">
          Noch kein zusätzliches Bildmaterial angehängt.
        </p>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 nav:grid-cols-4">
          {share.libraryImages.map((img) => (
            <div
              key={img.id}
              className="relative overflow-hidden rounded-[10px] border border-line bg-white"
            >
              <RemoveLibraryFromShareButton shareId={share.id} mediaId={img.id} />
              <div className="relative h-[110px] bg-panel">
                <Image
                  src={`/api/intern/library?original=${img.id}&width=300&quality=70`}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-2.5">
                <span className="truncate text-[12px] font-medium">
                  {img.displayName || 'Ohne Namen'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 nav:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            Einzelne Bilder auswählen
          </p>
          <MediaShareLibraryPicker shareId={share.id} excludeIds={includedLibraryIds} />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            Oder einen ganzen Ordner freigeben
          </p>
          <MediaShareFolderPicker shareId={share.id} />
        </div>
      </div>

      <h2 className="mb-4 mt-10 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
        Weitere Beiträge hinzufügen
      </h2>

      <FolderToShareControl
        shareId={share.id}
        folders={folders}
        existingPostIds={share.posts.map((p: Post) => p.id)}
      />

      <MediaSharePostPicker shareId={share.id} availablePosts={availablePosts} />
    </div>
  );
}
