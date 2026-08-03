import type { Metadata } from 'next';
import PressRegisterForm from '@/components/PressRegisterForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Presseregistrierung',
  description:
    'Registriere dich als Medienvertreter:in für Presseportal112 — Zugang zu Chat und gezielten Bildfreigaben.',
};

export default function PressRegistrierenPage() {
  return (
    <section className="flex justify-center px-8 py-14">
      <div className="w-full max-w-[480px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">
          Als Presse registrieren
        </h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Für Journalist:innen und Redaktionen. Nach der Anmeldung prüfen
          wir deine Angaben und schalten dich manuell frei — danach kannst
          du direkt mit Organisationen chatten und erhältst gezielte
          Bildfreigaben.
        </p>
        <PressRegisterForm />
      </div>
    </section>
  );
}
