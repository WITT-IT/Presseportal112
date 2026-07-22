import type { Metadata } from 'next';
import ContactForm from '@/components/ContactForm';
import { getAllOrganizations } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Kontaktiere Presseportal112 oder eine angeschlossene Organisation direkt.',
};

export default async function KontaktPage() {
  const organizations = await getAllOrganizations();

  return (
    <section className="flex justify-center px-8 py-14">
      <div className="w-full max-w-[480px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">Kontakt</h1>
        <p className="mb-8 text-[13.5px] leading-[1.6] text-ink-2">
          Fragen zur Nutzung von Bildern, Presseanfragen oder ein Anliegen an
          eine bestimmte Organisation — schreib uns.
        </p>
        <ContactForm organizations={organizations} />
      </div>
    </section>
  );
}
