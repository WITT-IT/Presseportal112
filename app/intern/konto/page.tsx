import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import AccountDeleteForm from '@/components/AccountDeleteForm';

export const dynamic = 'force-dynamic';

// Bewusst direkt hier statt in lib/queries.ts -- diese Zählung wird nur auf
// dieser einen Seite gebraucht und ist eng an die Konto-Löschung gekoppelt.
async function getMyUploadCounts(accessToken: string, userId: string) {
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[uploaded_by][_eq]=${userId}&fields=id,is_public&limit=-1`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    if (!res.ok) return { publicCount: 0, privateCount: 0 };
    const { data } = (await res.json()) as { data: { is_public: boolean }[] };
    const publicCount = data.filter((row) => row.is_public).length;
    return { publicCount, privateCount: data.length - publicCount };
  } catch (error) {
    console.error('getMyUploadCounts fehlgeschlagen:', error);
    return { publicCount: 0, privateCount: 0 };
  }
}

export default async function AccountPage() {
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

  const counts = await getMyUploadCounts(session.accessToken, user.id);

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

        <h1 className="mb-8 font-display text-[32px] font-bold">Konto &amp; Datenschutz</h1>

        <div className="mb-8 rounded-[10px] border border-line bg-white p-6">
          <h2 className="mb-3 font-display text-[16px] font-bold">Kontoinformationen</h2>
          <dl className="space-y-1.5 text-[13.5px] text-ink-2">
            <div>
              <dt className="inline font-semibold text-ink">Organisation: </dt>
              <dd className="inline">{user.organization?.name ?? 'Nicht angegeben'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">E-Mail: </dt>
              <dd className="inline">{user.email}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Eigene Beiträge: </dt>
              <dd className="inline">
                {counts.privateCount} nur intern · {counts.publicCount} öffentlich
              </dd>
            </div>
          </dl>
        </div>

        <AccountDeleteForm privateCount={counts.privateCount} publicCount={counts.publicCount} />
      </div>
    </section>
  );
}
