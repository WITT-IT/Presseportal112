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

  const includedPostIds = share.posts.map((p: Post) => p.id);
  const includedIds = new Set(includedPostIds);
  const availablePosts = allOwnPosts.filter((p) => !includedIds.has(p.id));
  const includedLibraryIds = share.libraryImages.map((img) => img.id);

  const isExpired = new Date(share.expiresAt).getTime() <= Date.now();
  const totalItems = share.posts.length + share.libraryImages.length;

  return (
    <div>
      <div className="-mx-6 -mt-10 mb-8 border-b border-line/70 px-6 pb-8 pt-6 nav:-mx-10 nav:-mt-12 nav:px-10 nav:pt-8">
        <Breadcrumbs
          items={[
            { label: 'Übersicht', href: '/intern' },
            { label: 'Freigaben', href: '/intern/freigaben' },
            { label: share.name },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
              Freigabe
            </span>
            <h1 className="mt-4 font-display text-[clamp(28px,4vw,42px)] leading-[0.95] text-ink">
              {share.name}
            </h1>
          </div>
          <MediaShareActions shareId={share.id} name={share.name} active={share.active} />
        </div>

        {/* Statusleiste -- auf einen Blick: läuft die Freigabe noch, für wen,
            wie viel Material steckt insgesamt drin. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-[7px] w-[7px] flex-none rounded-full ${
                !share.active ? 'bg-ink-3' : isExpired ? 'bg-signal-deep' : 'bg-emerald-500'
              }`}
              aria-hidden="true"
            />
            {!share.active ? 'Deaktiviert' : isExpired ? 'Abgelaufen' : 'Aktiv'}
            {' · '}
            {isExpired ? 'lief ab am' : 'gültig bis'}{' '}
            {new Date(share.expiresAt).toLocaleDateString('de-DE')}
          </span>
          <span>
            {totalItems} {totalItems === 1 ? 'Bild' : 'Bilder'} insgesamt
          </span>
          {share.recipientName && <span>für {share.recipientName}</span>}
        </div>
      </div>

      <div className="mb-8">
        <MediaShareLinkBox
          shareId={share.id}
          token={share.token}
          shareName={share.name}
          recipientName={share.recipientName}
          recipientEmail={share.recipientEmail}
          expiresAt={share.expiresAt}
        />
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Karte 1: veröffentlichte Beiträge ─────────────────────────── */}
        <section className="rounded-[20px] border border-white/70 bg-white p-6 shadow-card">
          <h2 className="mb-1 font-display text-[17px] font-bold">
            Veröffentlichte Beiträge
            <span className="ml-2 font-mono text-[12px] font-normal text-ink-3">
              {share.posts.length}
            </span>
          </h2>
          <p className="mb-5 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-2">
            Fertige Beiträge aus eurem öffentlichen Archiv, inklusive
            Wasserzeichen und Bildunterschrift.
          </p>

          {share.posts.length === 0 ? (
            <p className="mb-6 text-[13px] text-ink-2">
              Noch keine Beiträge in dieser Freigabe.
            </p>
          ) : (
            <div className="mb-6 grid grid-cols-2 gap-4 nav:grid-cols-4">
              {share.posts.map((post: Post) => {
                const hero = primaryImage(post);
                return (
                  <div
                    key={post.id}
                    className="group relative overflow-hidden rounded-[16px] border border-white/70 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <RemoveFromMediaShareButton shareId={share.id} postId={post.id} />
                    <div className="relative aspect-square bg-panel">
                      {hero?.file_public_preview && (
                        <Image
                          src={directusAssetUrl(hero.file_public_preview, 'width=300&quality=70')}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
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

          <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 nav:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Einzelne Beiträge auswählen
              </p>
              <MediaSharePostPicker shareId={share.id} availablePosts={availablePosts} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Ganzen Ordner mit Beiträgen hinzufügen
              </p>
              <FolderToShareControl
                shareId={share.id}
                folders={folders}
                existingPostIds={includedPostIds}
              />
            </div>
          </div>
        </section>

        {/* ── Karte 2: rohes Bildmaterial aus der Bibliothek ────────────── */}
        <section className="rounded-[20px] border border-white/70 bg-white p-6 shadow-card">
          <h2 className="mb-1 font-display text-[17px] font-bold">
            Bildmaterial aus der Bibliothek
            <span className="ml-2 font-mono text-[12px] font-normal text-ink-3">
              {share.libraryImages.length}
            </span>
          </h2>
          <p className="mb-5 max-w-[560px] text-[12.5px] leading-[1.6] text-ink-2">
            Zusätzliche Fotos direkt aus eurer Medienbibliothek — im Original,
            ohne Wasserzeichen, ohne dass dafür erst ein eigener Beitrag
            veröffentlicht werden muss.
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
                  className="group relative overflow-hidden rounded-[16px] border border-white/70 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <RemoveLibraryFromShareButton shareId={share.id} mediaId={img.id} />
                  <div className="relative aspect-square bg-panel">
                    <Image
                      src={`/api/intern/library?original=${img.id}&width=300&quality=70`}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
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

          <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 nav:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Einzelne Bilder auswählen
              </p>
              <MediaShareLibraryPicker shareId={share.id} excludeIds={includedLibraryIds} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Ganzen Bibliotheksordner freigeben
              </p>
              <MediaShareFolderPicker shareId={share.id} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
