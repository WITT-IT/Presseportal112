import type { Metadata } from 'next';
import SubscribeForm from '@/components/SubscribeForm';
import { getGewerke } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Presse-Alarm',
  description:
    'Automatisch per E-Mail benachrichtigt werden, sobald neue Einsatzfotos freigegeben werden.',
};

export default async function PresseAlarmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const gewerke = await getGewerke();

  return (
    <section className="flex justify-center px-8 py-14">
      <div className="w-full max-w-[480px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Presse-Alarm</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Automatisch per E-Mail benachrichtigt werden, sobald eine
          Organisation ein neues Foto freigibt — kein manuelles Nachschauen
          mehr nötig.
        </p>

        {status === 'confirmed' && (
          <div className="mb-6 rounded-md border border-line bg-panel p-4 text-[13px] text-ink">
            ✓ Bestätigt — dein Presse-Alarm ist aktiv.
          </div>
        )}
        {status === 'unsubscribed' && (
          <div className="mb-6 rounded-md border border-line bg-panel p-4 text-[13px] text-ink">
            Du wurdest abgemeldet.
          </div>
        )}
        {status === 'invalid' && (
          <div className="mb-6 rounded-md border border-line bg-panel p-4 text-[13px] text-signal-deep">
            Der Link ist ungültig oder abgelaufen.
          </div>
        )}

        <SubscribeForm gewerke={gewerke} />
      </div>
    </section>
  );
}
