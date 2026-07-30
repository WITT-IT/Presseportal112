import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getAllOrganizations } from '@/lib/queries';
import AdminRegistrationsList from '@/components/AdminRegistrationsList';

export const dynamic = 'force-dynamic';

async function getPendingRegistrations() {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return [];
  const fields = [
    'id',
    'email',
    'first_name',
    'last_name',
    'requested_organization_name',
    'requested_gewerk',
  ].join(',');
  try {
    const res = await fetch(`${DIRECTUS_URL}/users?filter[status][_eq]=draft&fields=${fields}`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(
        `getPendingRegistrations fehlgeschlagen (Status ${res.status}):`,
        await res.text().catch(() => '')
      );
      return [];
    }
    const { data } = await res.json();
    return data;
  } catch (error) {
    console.error('getPendingRegistrations fehlgeschlagen:', error);
    return [];
  }
}

export default async function AdminRegistrationsPage() {
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

  const [registrations, organizations] = await Promise.all([
    getPendingRegistrations(),
    getAllOrganizations(),
  ]);

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/intern/admin"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Admin-Übersicht
        </Link>

        <h1 className="mb-2 font-display text-[32px] font-bold">Registrierungen</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Neue Organisations-Konten warten hier auf Freigabe. Existiert die
          gewünschte Organisation noch nicht, zuerst in Directus unter{' '}
          <span className="font-mono">organizations</span> anlegen.
        </p>

        <AdminRegistrationsList registrations={registrations} organizations={organizations} />
      </div>
    </section>
  );
}
