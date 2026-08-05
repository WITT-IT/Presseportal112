import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getPostForEdit, getAllUsedTags, getAlarmcodes, getMyFoldersWithPostIds } from '@/lib/queries';
import EditPostForm from '@/components/EditPostForm';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({
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

  const [post, existingTags, alarmcodes, foldersWithPosts] = await Promise.all([
    getPostForEdit(session.accessToken, id),
    getAllUsedTags(),
    getAlarmcodes(),
    user.organization?.id
      ? getMyFoldersWithPostIds(session.accessToken, user.organization.id)
      : Promise.resolve([]),
  ]);

  if (!post) notFound();

  const watermarkText =
    user?.organization?.branding_label || `Foto: ${user?.organization?.name ?? ''}`;

  // Prüfen ob der Beitrag in einem echten (nicht-System-)Ordner liegt.
  // Systemordner (Öffentlich, Unsortiert) zählen nicht als "echter" Ordner.
  const hasFolder = foldersWithPosts
    .filter((f) => f.name !== 'Öffentlich' && f.name !== 'Unsortiert')
    .some((f) => f.postIds.includes(id));

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[640px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">
          Beitrag bearbeiten
        </h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          {post.title || post.alarm_code || 'Stockfoto'}
        </p>
        <EditPostForm
          post={post}
          existingTags={existingTags}
          watermarkText={watermarkText}
          alarmcodes={alarmcodes}
          hasFolder={hasFolder}
        />
      </div>
    </section>
  );
}
