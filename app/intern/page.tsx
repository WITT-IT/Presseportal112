import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import UploadForm from '@/components/UploadForm';
import MyImagesList from '@/components/MyImagesList';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyOrganizationImages } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function InternDashboard() {
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

  const images = await getMyOrganizationImages(session.accessToken);

  const watermarkText =
    user.organization?.branding_label || `Foto: ${user.organization?.name ?? ''}`;

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="mb-2 font-display text-[32px] font-bold">
              Willkommen, {user.first_name || user.email}
            </h1>
            <p className="text-[14px] text-ink-2">
              {user.organization?.name
                ? `Angemeldet für ${user.organization.name}`
                : 'Deinem Konto ist noch keine Organisation zugeordnet -- bitte an die Redaktion wenden.'}
            </p>
          </div>
          <LogoutButton />
        </div>

        {user.organization?.id ? (
          <>
            <div className="mb-10">
              <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Neues Foto hochladen
              </h2>
              <UploadForm watermarkText={watermarkText} />
            </div>

            <div>
              <h2 className="mb-4 font-display text-[15px] font-bold uppercase tracking-[0.09em] text-ink-2">
                Meine Bilder
              </h2>
              <MyImagesList images={images} />
            </div>
          </>
        ) : (
          <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
            Ohne zugeordnete Organisation kann noch nichts hochgeladen
            werden.
          </div>
        )}
      </div>
    </section>
  );
}
