import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SESSION_COOKIE } from '@/lib/auth';
import { getMediaShareWithPosts, getMyOrganizationImages } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import { primaryImage } from '@/lib/types';
import MediaShareActions from '@/components/MediaShareActions';
import MediaShareLinkBox from '@/components/MediaShareLinkBox';
import RemoveFromMediaShareButton from '@/components/RemoveFromMediaShareButton';
import MediaSharePostPicker from '@/components/MediaSharePostPicker';

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

  const [share, allOwnPosts] = await Promise.all([
    getMediaShareWithPosts(session.accessToken, id),
    getMyOrganizationImages(session.accessToken),
  ]);
  if (!share) notFound();

  const includedIds = new Set(share.posts.map((p) => p.id));
  const availablePosts = allOwnPosts.filter((p) => !includedIds.has(p.id));

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/intern/freigaben"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Alle Freigaben
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[32px] font-bold">{share.name}</h1>
          <MediaShareActions shareId={share.id} name={share.name} active={share.active} />
        </div>

        <MediaShareLinkBox
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
            Noch keine Beiträge in dieser Freigabe — wähl unten welche aus.
          </p>
        ) : (
          <div className="mb-10 grid grid-cols-2 gap-4 nav:grid-cols-4">
            {share.posts.map((post) => {
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
          Weitere Beiträge hinzufügen
        </h2>
        <MediaSharePostPicker shareId={share.id} availablePosts={availablePosts} />
      </div>
    </section>
  );
}
