import type { Metadata } from 'next';
import RegisterForm from '@/components/RegisterForm';
import { getGewerke } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registrieren',
  description:
    'Registrier deine Organisation oder dich als Presse-/Redaktionsmitglied kostenlos für Presseportal112.',
};

export default async function RegistrierenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const gewerke = await getGewerke();
  // Erlaubt Links wie /registrieren?type=presse, um den Umschalter direkt
  // auf dem richtigen Tab zu öffnen -- ohne Parameter (Standardaufruf)
  // startet die Seite bei "Organisation".
  const defaultType = type === 'presse' || type === 'press' ? 'press' : 'organization';

  return (
    <section className="flex justify-center px-8 py-14">
      <div className="w-full max-w-[480px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Registrieren</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Kostenlos für Feuerwehr, DRK, Polizei und THW -- und für Presse und
          Redaktionen. Wähl unten aus, was auf dich zutrifft. Nach dem
          Absenden prüfen wir die Angaben und schalten frei.
        </p>
        <RegisterForm gewerke={gewerke} defaultType={defaultType} />
      </div>
    </section>
  );
}
