import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyMediaShares, getAllOrganizations, getReceivedMediaShares } from '@/lib/queries';
import Breadcrumbs from '@/components/Breadcrumbs';
import CreateMediaShareForm from '@/components/CreateMediaShareForm';

export const dynamic = 'force-dynamic';

export default async function MediaSharesPage() {
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

  const isPress = user.organization.organization_type === 'press';

  // Presse-Konten erhalten Freigaben, statt sie zu erstellen -- eigene,
  // schlankere Ansicht mit den an sie gerichteten Freigaben.
  if (isPress) {
    const received = await getReceivedMediaShares(user.organization.id);
    return (
      <div>
        <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Freigaben' }]} />
        <h1 className="mb-2 font-display text-[28px] font-bold">Für dich freigegeben</h1>
        <p className="mb-8 max-w-[560px] text-[13.5px] leading-[1.6] text-ink-2">
          Bildmaterial, das Organisationen direkt für{' '}
          <strong className="text-ink">{user.organization.name}</strong> freigegeben haben.
        </p>

        {received.length === 0 ? (
          <p className="text-[13px] text-ink-2">Noch keine Freigaben erhalten.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {received.map((share) => {
              const expired = new Date(share.expiresAt).getTime() <= Date.now();
              const unavailable = !share.active || expired;
              return (
                <a
                  key={share.id}
                  href={unavailable ? undefined : `/medienfreigabe/${share.token}`}
                  target={unavailable ? undefined : '_blank'}
                  rel={unavailable ? undefined : 'noopener noreferrer'}
                  aria-disabled={unavailable}
                  className={`flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition-colors ${
                    unavailable ? 'cursor-default opacity-60' : 'hover:border-line-strong'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
                      <i className="ti ti-share text-[16px] text-ink-2" aria-hidden="true" />
                      {share.name}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-3">
                      Von {share.senderOrganizationName ?? 'einer Organisation'}
                    </span>
                  </div>
                  <span className="ml-3 flex flex-none items-center gap-2 font-mono text-[11px] text-ink-3">
                    {share.postCount} Beitrag{share.postCount === 1 ? '' : 'e'}
                    <span
                      className={`rounded-[4px] px-1.5 py-0.5 ${
                        unavailable ? 'bg-panel text-ink-3' : 'bg-ink text-white'
                      }`}
                    >
                      {!share.active ? 'deaktiviert' : expired ? 'abgelaufen' : 'aktiv'}
                    </span>
                    {!unavailable && (
                      <i className="ti ti-external-link text-[13px]" aria-hidden="true" />
                    )}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const [shares, allOrganizations] = await Promise.all([
    getMyMediaShares(session.accessToken, user.organization.id),
    getAllOrganizations(),
  ]);
  const pressOrganizations = allOrganizations
    .filter((org) => org.organization_type === 'press')
    .map((org) => ({ id: org.id, name: org.name }));

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Freigaben' }]} />
      <h1 className="mb-2 font-display text-[28px] font-bold">Medienvertreter-Freigaben</h1>
      <p className="mb-8 max-w-[560px] text-[13.5px] leading-[1.6] text-ink-2">
        Stelle einzelnen Journalist:innen zeitlich begrenzten Zugriff auf
        ausgewählte Beiträge bereit — auch auf noch nicht veröffentlichte.
      </p>

      <CreateMediaShareForm pressOrganizations={pressOrganizations} />

      {shares.length === 0 ? (
        <p className="text-[13px] text-ink-2">Noch keine Freigaben angelegt.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shares.map((share) => {
            const expired = new Date(share.expiresAt).getTime() <= Date.now();
            return (
              <Link
                key={share.id}
                href={`/intern/freigaben/${share.id}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
                  <i className="ti ti-share text-[16px] text-ink-2" aria-hidden="true" />
                  {share.name}
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
                  {share.postCount} Beitrag{share.postCount === 1 ? '' : 'e'}
                  <span
                    className={`rounded-[4px] px-1.5 py-0.5 ${
                      !share.active || expired ? 'bg-panel text-ink-3' : 'bg-ink text-white'
                    }`}
                  >
                    {!share.active ? 'deaktiviert' : expired ? 'abgelaufen' : 'aktiv'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
