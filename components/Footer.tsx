import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="px-8 py-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4">
        <p className="max-w-[520px] text-[11.5px] leading-[1.65] text-ink-3">
          Datensparsame Besuchszählung — keine Namen, keine IP-Adressen. Alle
          Bilder mit eingebettetem Wasserzeichen der jeweiligen Organisation,
          presserechtlich frei nutzbar unter Quellenangabe.
        </p>
        <div className="flex gap-[22px] text-[12.5px] text-ink-2">
          <Link href="/presse-alarm" className="hover:text-ink">
            Presse-Alarm
          </Link>
          <Link href="/impressum" className="hover:text-ink">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-ink">
            Datenschutz
          </Link>
          <Link href="/kontakt" className="hover:text-ink">
            Kontakt
          </Link>
        </div>
      </div>
    </footer>
  );
}
