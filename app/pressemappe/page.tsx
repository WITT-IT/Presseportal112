import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import PressemappeView from '@/components/PressemappeView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Favoriten',
  description: 'Deine gesammelten Fotos zum gebündelten Download.',
};

export default async function PressemappePage() {
  // Bewusst ein weicher, eigener Check statt der harten /intern-Sperre --
  // das hier ist ein öffentlicher Header-Link, der auch nicht angemeldete
  // Besucher:innen freundlich auffangen soll, statt sie mit einem 404 oder
  // einer unangekündigten Weiterleitung zu verwirren.
  let loggedIn = false;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (raw) {
      const session = JSON.parse(raw) as { accessToken: string };
      const user = await getCurrentUser(session.accessToken);
      loggedIn = !!user;
    }
  } catch {
    // Keine gültige Sitzung -- ganz normal als nicht angemeldet behandeln.
  }

  if (!loggedIn) {
    return (
      <section className="flex justify-center px-8 py-20">
        <div className="w-full max-w-[480px] text-center">
          <i className="ti ti-star mb-4 block text-[36px] text-ink-3" aria-hidden="true" />
          <h1 className="mb-3 font-display text-[28px] font-bold">Favoriten</h1>
          <p className="mb-8 text-[14px] leading-[1.6] text-ink-2">
            Um Fotos zu sammeln und gebündelt herunterzuladen, ist ein
            kostenloses Konto nötig. Organisationen und Medienvertreter:innen
            können sich direkt registrieren — die Freigabe erfolgt meist
            innerhalb kurzer Zeit.
          </p>
          <div className="flex flex-col gap-2.5 nav:flex-row nav:justify-center">
            <Link
              href="/organisationen/registrieren"
              className="rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
            >
              Als Organisation registrieren
            </Link>
            <Link
              href="/presse/registrieren"
              className="rounded-md border border-line-strong px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink"
            >
              Als Presse registrieren
            </Link>
          </div>
          <p className="mt-6 text-[12.5px] text-ink-2">
            Schon registriert?{' '}
            <Link href="/login" className="font-semibold text-signal-deep">
              Jetzt anmelden
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <h1 className="mb-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em]">
          Favoriten
        </h1>
        <p className="mb-8 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
          Fotos aus dem Bildarchiv sammeln und gebündelt herunterladen — als
          ZIP inklusive automatisch erstellter Bildunterschriften-Liste.
        </p>
        <PressemappeView />
      </div>
    </section>
  );
}
