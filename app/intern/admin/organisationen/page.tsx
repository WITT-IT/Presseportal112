import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { DEFAULT_STORAGE_TIER, storageLimitForTier } from '@/lib/storage';
import type { StorageTier } from '@/lib/types';
import AdminOrganizationsStorageList from '@/components/AdminOrganizationsStorageList';

export const dynamic = 'force-dynamic';

async function getAllOrganizationsWithStorage(serviceToken: string): Promise<
  { id: string; name: string; usedBytes: number; limitBytes: number; tier: StorageTier }[]
> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations?fields=id,name,storage_used_bytes,storage_limit_bytes,storage_tier&sort=name&limit=-1`,
    { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.error(`getAllOrganizationsWithStorage fehlgeschlagen (Status ${res.status}):`, await res.text().catch(() => ''));
    return [];
  }
  const { data } = await res.json();
  return (
    data as {
      id: string;
      name: string;
      storage_used_bytes: number | null;
      storage_limit_bytes: number | null;
      storage_tier: StorageTier | null;
    }[]
  ).map((row) => {
    const tier = row.storage_tier || DEFAULT_STORAGE_TIER;
    return {
      id: row.id,
      name: row.name,
      usedBytes: Number(row.storage_used_bytes) || 0,
      // Gleicher Fallback wie in lib/orgStorage.ts -- falls storage_limit_bytes
      // bei einer Organisation noch nicht gesetzt ist, greift das Limit der
      // Stufe statt eines harten 0-Limits.
      limitBytes: Number(row.storage_limit_bytes) || storageLimitForTier(tier),
      tier,
    };
  });
}

export default async function AdminOrganizationsStoragePage() {
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

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    return (
      <section className="px-8 py-14">
        <p className="text-[13px] text-signal-deep">Server nicht korrekt konfiguriert.</p>
      </section>
    );
  }

  const organizations = await getAllOrganizationsWithStorage(serviceToken);

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[900px]">
        <Link
          href="/intern/admin"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zur Administration
        </Link>

        <h1 className="mb-1 font-display text-[32px] font-bold">Organisationen &amp; Speicher</h1>
        <p className="mb-8 text-[13.5px] text-ink-2">
          Speicherstufe pro Organisation verwalten. Tier-Wechsel wirkt sofort — kein Self-Service, das läuft aktuell ausschließlich hier über die Administration, passend zum Jahresabo-Modell.
        </p>

        <AdminOrganizationsStorageList organizations={organizations} />
      </div>
    </section>
  );
}
