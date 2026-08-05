import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getPostForEdit, getAllUsedTags, getAlarmcodes, getMyFoldersWithPostIds, getMyFolders } from '@/lib/queries';
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

  const [post, existingTags, alarmcodes, foldersWithPosts, allFolders] = await Promise.all([
    getPostForEdit(session.accessToken, id),
    getAllUsedTags(),
    getAlarmcodes(),
    user.organization?.id
      ? getMyFoldersWithPostIds(session.accessToken, user.organization.id)
      : Promise.resolve([]),
    user.organization?.id
      ? getMyFolders(session.accessToken, user.organization.id)
      : Promise.resolve([]),
  ]);

  if (!post) notFound();

  const watermarkText =
    user?.organization?.branding_label || `Foto: ${user?.organization?.name ?? ''}`;

  const realFolders = allFolders
    .filter((f) => !f.is_system_folder && f.name !== 'Öffentlich' && f.name !== 'Unsortiert')
    .map((f) => ({ id: f.id, name: f.name }));

  const assignedFolderIds = foldersWithPosts
    .filter((f) => f.name !== 'Öffentlich' && f.name !== 'Unsortiert')
    .filter((f) => f.postIds.includes(id))
    .map((f) => f.id);

  const hasFolder = assignedFolderIds.length > 0;

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
          folders={realFolders}
          assignedFolderIds={assignedFolderIds}
        />
      </div>
    </section>
  );
}
