import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { getMyMediaShares, getAllOrganizations, getReceivedMediaShares } from '@/lib/queries';
import CreateMediaShareForm from '@/components/CreateMediaShareForm';

export const dynamic = 'force-dynamic';

function HeroHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: React.ReactNode }) {
  return (
    <section className="-mx-6 -mt-10 mb-8 border-b border-line/70 px-6 pb-8 pt-6 nav:-mx-10 nav:-mt-12 nav:px-10 nav:pt-8">
      <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
        {eyebrow}
      </span>
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(28px,4vw,42px)] leading-[0.95] text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-[1.6] text-ink-2">{description}</p>
    </section>
  );
}

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
        <HeroHeader
          eyebrow="Freigaben"
          title="Für dich freigegeben"
          description={
            <>
              Bildmaterial, das Organisationen direkt für{' '}
              <strong className="text-ink">{user.organization.name}</strong> freigegeben haben.
            </>
          }
        />

        {received.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-line-strong bg-white/70 px-6 py-16 text-center shadow-sm">
            <i className="ti ti-share text-[32px] text-ink-3" aria-hidden="true" />
            <p className="text-[13px] text-ink-2">Noch keine Freigaben erhalten.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
                  className={`flex items-center justify-between rounded-[20px] border border-white/70 bg-white p-5 shadow-card transition-all ${
                    unavailable ? 'cursor-default opacity-60' : 'hover:-translate-y-0.5 hover:shadow-card-hover'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                      <i className="ti ti-share text-[16px] text-signal-deep" aria-hidden="true" />
                      {share.name}
                    </span>
                    <span className="mt-1 block text-[12px] text-ink-3">
                      Von {share.senderOrganizationName ?? 'einer Organisation'}
                    </span>
                  </div>
                  <span className="ml-3 flex flex-none items-center gap-2 font-mono text-[11px] text-ink-3">
                    {share.postCount + share.mediaCount} {share.postCount + share.mediaCount === 1 ? 'Medium' : 'Medien'}
                    <span
                      className={`rounded-full px-2 py-1 ${
                        unavailable ? 'bg-panel text-ink-3' : 'bg-signal/10 text-signal-deep'
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
      <HeroHeader
        eyebrow="Freigaben"
        title="Medienvertreter-Freigaben"
        description="Stelle einzelnen Journalist:innen zeitlich begrenzten Zugriff auf ausgewählte Beiträge bereit — auch auf noch nicht veröffentlichte."
      />

      <CreateMediaShareForm pressOrganizations={pressOrganizations} />

      {shares.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-line-strong bg-white/70 px-6 py-16 text-center shadow-sm">
          <i className="ti ti-share text-[32px] text-ink-3" aria-hidden="true" />
          <p className="text-[13px] text-ink-2">Noch keine Freigabe erstellt.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {shares.map((share) => {
            const expired = new Date(share.expiresAt).getTime() <= Date.now();
            return (
              <a
                key={share.id}
                href={`/intern/freigaben/${share.id}`}
                className="flex items-center justify-between rounded-[20px] border border-white/70 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                    <i className="ti ti-share text-[16px] text-signal-deep" aria-hidden="true" />
                    {share.name}
                  </span>
                  {share.recipientName && (
                    <span className="mt-1 block text-[12px] text-ink-3">Für {share.recipientName}</span>
                  )}
                </div>
                <span className="ml-3 flex flex-none items-center gap-2 font-mono text-[11px] text-ink-3">
                  {share.postCount + share.mediaCount} {share.postCount + share.mediaCount === 1 ? 'Medium' : 'Medien'}
                  <span
                    className={`rounded-full px-2 py-1 ${
                      !share.active ? 'bg-panel text-ink-3' : expired ? 'bg-signal/10 text-signal-deep' : 'bg-signal/10 text-signal-deep'
                    }`}
                  >
                    {!share.active ? 'deaktiviert' : expired ? 'abgelaufen' : 'aktiv'}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
