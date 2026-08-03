import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getAllUsedTags, getAlarmcodes, getMyFolders } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import UploadForm from '@/components/UploadForm';

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

  const [existingTags, alarmcodes, folders] = await Promise.all([
    getAllUsedTags(),
    getAlarmcodes(),
    getMyFolders(session.accessToken, user.organization.id),
  ]);

  // Ordner-Kontext nur übernehmen, wenn er wirklich existiert und der
  // eigenen Organisation gehört -- verhindert, dass eine erfundene oder
  // fremde ID im Link zu Verwirrung führt.
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

      <h1 className="mb-2 font-display text-[28px] font-bold">Neues Foto hochladen</h1>
      {targetFolder && (
        <p className="mb-6 flex items-center gap-1.5 text-[13px] text-ink-2">
          <i className="ti ti-folder text-[15px]" aria-hidden="true" />
          Wird direkt zu <strong className="text-ink">{targetFolder.name}</strong> hinzugefügt
        </p>
      )}

      <div className="max-w-[720px]">
        <UploadForm
          watermarkText={watermarkText}
          existingTags={existingTags}
          alarmcodes={alarmcodes}
          folders={folders}
          preselectedFolderId={targetFolder?.id ?? null}
        />
      </div>
    </div>
  );
}
