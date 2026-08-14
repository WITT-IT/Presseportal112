import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminHubPage() {
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

  const items = [
    {
      href: '/intern/admin/registrierungen',
      icon: 'ti-user-plus',
      title: 'Registrierungen',
      description: 'Neue Organisations-Konten freigeben oder ablehnen.',
    },
    {
      href: '/intern/admin/organisationen',
      icon: 'ti-server-2',
      title: 'Organisationen & Speicher',
      description: 'Speicherstufe pro Organisation einsehen und ändern.',
    },
    {
      href: '/intern/admin/moderation',
      icon: 'ti-photo',
      title: 'Bildmoderation',
      description: 'Alle veröffentlichten Beiträge portalweit einsehen und löschen.',
    },
    {
      href: '/intern/admin/konten',
      icon: 'ti-shield',
      title: 'Konten verwalten',
      description: 'Ein beliebiges Konto per E-Mail suchen und löschen.',
    },
  ];

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/intern"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
          Zurück zum internen Bereich
        </Link>

        <h1 className="mb-8 font-display text-[32px] font-bold">Administration</h1>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[10px] border border-line bg-white p-5 transition-colors hover:border-line-strong"
            >
              <div className="mb-1 flex items-center gap-2 text-[15px] font-bold">
                <i className={`ti ${item.icon} text-[18px] text-signal-deep`} aria-hidden="true" />
                {item.title}
              </div>
              <p className="text-[12.5px] text-ink-2">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
