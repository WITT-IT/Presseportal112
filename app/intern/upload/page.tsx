import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getAllUsedTags, getAlarmcodes, getMediaLibraryItem, getPostForEdit } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import Breadcrumbs from '@/components/Breadcrumbs';
import UploadStudio from '@/components/UploadStudio';

export const dynamic = 'force-dynamic';

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ mediaId?: string; postId?: string }>;
}) {
  const { mediaId, postId } = await searchParams;

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

  const watermarkText = user.organization.branding_label || `Foto: ${user.organization.name ?? ''}`;

  // Bearbeiten-Modus: bestehenden Beitrag laden.
  if (postId) {
    const [existingTags, alarmcodes, post] = await Promise.all([
      getAllUsedTags(),
      getAlarmcodes(),
      getPostForEdit(session.accessToken, postId),
    ]);

    const postOrgId = typeof post?.organization === 'string' ? post.organization : post?.organization?.id;
    if (!post || postOrgId !== user.organization.id) {
      redirect('/intern');
    }

    const heroImage = post.images?.[0];
    const thumbnailSrc = heroImage
      ? directusAssetUrl(
          (heroImage.file_public_preview ?? heroImage.file_public_preview_watermarked) as string,
          'width=160&quality=70'
        )
      : null;

    return (
      <div>
        <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Bearbeiten' }]} />
        <h1 className="mb-6 font-display text-[28px] font-bold">Bearbeiten</h1>
        <UploadStudio
          watermarkText={watermarkText}
          existingTags={existingTags}
          alarmcodes={alarmcodes}
          existingPost={{
            id: post.id,
            post_type: (post as unknown as { post_type?: 'einsatz' | 'stockfoto' }).post_type ?? 'einsatz',
            title: post.title,
            event_date: post.event_date,
            alarm_code: post.alarm_code,
            location: post.location,
            tags: post.tags ?? [],
            is_public: post.is_public,
            caption: heroImage?.caption ?? null,
            thumbnailUrl: thumbnailSrc,
          }}
        />
      </div>
    );
  }

  // Ohne mediaId gibt's hier nichts zu tun.
  if (!mediaId) {
    return (
      <div>
        <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Veröffentlichen' }]} />
        <h1 className="mb-2 font-display text-[28px] font-bold">Veröffentlichen</h1>
        <p className="mb-6 max-w-[480px] text-[13.5px] leading-[1.6] text-ink-2">
          Wähl zuerst ein Bild in der Medienbibliothek aus und klick dort auf
          „Veröffentlichen".
        </p>
        <Link
          href="/intern/medien"
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
        >
          Zur Medienbibliothek
        </Link>
      </div>
    );
  }

  const [existingTags, alarmcodes, sourceMedia] = await Promise.all([
    getAllUsedTags(),
    getAlarmcodes(),
    getMediaLibraryItem(session.accessToken, mediaId),
  ]);

  if (!sourceMedia || sourceMedia.organization !== user.organization.id) {
    redirect('/intern/medien');
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Übersicht', href: '/intern' },
          { label: 'Medien', href: '/intern/medien' },
          { label: 'Veröffentlichen' },
        ]}
      />
      <h1 className="mb-6 font-display text-[28px] font-bold">Veröffentlichen</h1>
      <UploadStudio
        watermarkText={watermarkText}
        existingTags={existingTags}
        alarmcodes={alarmcodes}
        sourceMedia={{
          id: sourceMedia.id,
          file: sourceMedia.file,
          file_preview_watermarked: sourceMedia.file_preview_watermarked,
          file_download_watermarked: sourceMedia.file_download_watermarked,
          display_name: sourceMedia.display_name,
          tags: sourceMedia.tags,
        }}
      />
    </div>
  );
}
