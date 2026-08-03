import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getAllUsedTags, getAlarmcodes, getMyFolders } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import UploadForm from '@/components/UploadForm';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
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

  const watermarkText =
    user.organization.branding_label || `Foto: ${user.organization.name ?? ''}`;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Hochladen' }]} />
      <h1 className="mb-6 font-display text-[28px] font-bold">Neues Foto hochladen</h1>
      <div className="max-w-[720px]">
        <UploadForm
          watermarkText={watermarkText}
          existingTags={existingTags}
          alarmcodes={alarmcodes}
          folders={folders}
        />
      </div>
    </div>
  );
}
