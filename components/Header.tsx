'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/bildarchiv', label: 'Bildarchiv' },
  { href: '/organisationen', label: 'Für Organisationen' },
  { href: '/kontakt', label: 'Kontakt' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-line-strong bg-paper">
      <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-[11px]">
          <span
            aria-hidden="true"
            className="h-[30px] w-[30px] flex-none rounded-[7px] border border-ink"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, #14161A 0 3px, #fff 3px 6px)',
            }}
          />
          <span className="font-display text-[20px] font-bold tracking-[0.005em]">
            Presseportal<span className="text-signal">112</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-[34px] nav:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13.5px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            aria-label="Suche"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-panel hover:text-ink"
          >
            <i className="ti ti-search text-[17px]" aria-hidden="true" />
          </button>
          <Link
            href="/login"
            className="rounded-md bg-ink px-[18px] py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            Anmelden
          </Link>
        </nav>

        <button
          type="button"
          aria-label="Menü öffnen"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink nav:hidden"
        >
          <i
            className={`ti ${menuOpen ? 'ti-x' : 'ti-menu-2'} text-[20px]`}
            aria-hidden="true"
          />
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-line bg-paper px-8 py-4 nav:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2 py-3 text-[14px] font-medium text-ink-2 hover:bg-panel hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-md bg-ink px-4 py-3 text-center text-[13.5px] font-semibold text-white"
            >
              Anmelden
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
