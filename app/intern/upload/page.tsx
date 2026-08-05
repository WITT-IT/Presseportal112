import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getAllUsedTags, getAlarmcodes, getMyFolders } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import UploadStudio from '@/components/UploadStudio';

export const dynamic = 'force-dynamic';

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string }>;
}) {
  const { folderId } = await searchParams;

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

  const [existingTags, alarmcodes, folders] = await Promise.all([
    getAllUsedTags(),
    getAlarmcodes(),
    getMyFolders(session.accessToken, user.organization.id),
  ]);

  const targetFolder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;
  const watermarkText =
    user.organization.branding_label || `Foto: ${user.organization.name ?? ''}`;

  return (
    <div>
      <Breadcrumbs
        items={
          targetFolder
            ? [
                { label: 'Übersicht', href: '/intern' },
                { label: 'Ordner', href: '/intern/ordner' },
                { label: targetFolder.name, href: `/intern/ordner/${targetFolder.id}` },
                { label: 'Hochladen' },
              ]
            : [{ label: 'Übersicht', href: '/intern' }, { label: 'Hochladen' }]
        }
      />

      <h1 className="mb-2 font-display text-[28px] font-bold">Neuer Beitrag</h1>
      {targetFolder && (
        <p className="mb-6 flex items-center gap-1.5 text-[13px] text-ink-2">
          <i className="ti ti-folder text-[15px]" aria-hidden="true" />
          Wird direkt zu <strong className="text-ink">{targetFolder.name}</strong> hinzugefügt
        </p>
      )}

      <UploadStudio
        watermarkText={watermarkText}
        existingTags={existingTags}
        alarmcodes={alarmcodes}
        folders={folders}
        preselectedFolderId={targetFolder?.id ?? null}
      />
    </div>
  );
}
