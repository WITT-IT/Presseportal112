import type { Metadata } from 'next';
import RegisterForm from '@/components/RegisterForm';
import { getGewerke } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Organisation registrieren',
  description: 'Registrier deine Organisation kostenlos für Presseportal112.',
};

export default async function RegistrierenPage() {
  const gewerke = await getGewerke();

  return (
    <section className="flex justify-center px-8 py-14">
      <div className="w-full max-w-[480px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">
          Organisation registrieren
        </h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Kostenlos für Feuerwehr, DRK, Polizei und THW. Nach der Anmeldung
          prüfen wir eure Angaben und schalten euch manuell frei.
        </p>
        <RegisterForm gewerke={gewerke} />
      </div>
    </section>
  );
}
