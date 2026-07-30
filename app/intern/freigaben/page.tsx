import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SESSION_COOKIE } from '@/lib/auth';
import { getMyMediaShares } from '@/lib/queries';
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

  const shares = await getMyMediaShares(session.accessToken);

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

        <h1 className="mb-2 font-display text-[32px] font-bold">Medienvertreter-Freigaben</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Stelle einzelnen Journalist:innen zeitlich begrenzten Zugriff auf
          ausgewählte Beiträge bereit -- auch auf noch nicht veröffentlichte.
        </p>

        <CreateMediaShareForm />

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
    </section>
  );
}
