import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import AdminAccountLookup from '@/components/AdminAccountLookup';

export const dynamic = 'force-dynamic';

export default async function AdminAccountsPage() {
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

  const admin = await isAdministrator(user.id);
  if (!admin) redirect('/intern');

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[640px]">
        <Link
          href="/intern"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zum internen Bereich
        </Link>

        <h1 className="mb-2 font-display text-[32px] font-bold">Konten verwalten</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">Nur für Administratoren sichtbar.</p>

        <AdminAccountLookup />
      </div>
    </section>
  );
}
