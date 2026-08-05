import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="px-8 py-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4">
        <p className="max-w-[520px] text-[11.5px] leading-[1.65] text-ink-3">
          Alle Bilder mit eingebettetem Wasserzeichen der jeweiligen
          Organisation, presserechtlich nutzbar gemäß unseren
          Nutzungsbedingungen und unter Quellenangaben.
        </p>
        <div className="flex flex-wrap gap-[22px] text-[12.5px] text-ink-2">
         
          <Link href="/nutzungsbedingungen" className="hover:text-ink">
            Nutzungsbedingungen
          </Link>
          <Link href="/impressum" className="hover:text-ink">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-ink">
            Datenschutz
          </Link>
        </div>
      </div>
    </footer>
  );
}
