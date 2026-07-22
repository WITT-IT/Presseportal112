import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';

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

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="mb-2 font-display text-[32px] font-bold">
              Willkommen, {user.first_name ?? user.email}
            </h1>
            <p className="text-[14px] text-ink-2">
              {user.organization?.name
                ? `Angemeldet für ${user.organization.name}`
                : 'Deinem Konto ist noch keine Organisation zugeordnet -- bitte an die Redaktion wenden.'}
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
          Hier entsteht als Nächstes: eigene Bilder hochladen, veröffentlichen
          und verwalten.
        </div>
      </div>
    </section>
  );
}
