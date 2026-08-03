'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export default function InternSidebar({
  organizationName,
  isAdmin,
  unreadCount,
}: {
  organizationName: string | null;
  isAdmin: boolean;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainItems: NavItem[] = [
    { href: '/intern', label: 'Übersicht', icon: 'ti-layout-dashboard' },
    { href: '/intern/medien', label: 'Meine Medien', icon: 'ti-photo' },
    { href: '/intern/ordner', label: 'Ordner', icon: 'ti-folder' },
    { href: '/intern/freigaben', label: 'Freigaben', icon: 'ti-share' },
    {
      href: '/intern/nachrichten',
      label: 'Nachrichten',
      icon: 'ti-message-circle',
      badge: unreadCount,
    },
    { href: '/intern/kalender', label: 'Kalender', icon: 'ti-calendar' },
  ];

  const footerItems: NavItem[] = [
    { href: '/intern/konto', label: 'Konto & Datenschutz', icon: 'ti-user' },
    ...(isAdmin ? [{ href: '/intern/admin', label: 'Administration', icon: 'ti-shield' }] : []),
  ];

  function isActive(href: string) {
    if (href === '/intern') return pathname === '/intern';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors ${
          active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-panel hover:text-ink'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <i className={`ti ${item.icon} text-[16px]`} aria-hidden="true" />
          {item.label}
        </span>
        {!!item.badge && item.badge > 0 && (
          <span
            className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
              active ? 'bg-white text-ink' : 'bg-signal text-white'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Mobiler Umschalter -- eingebettetes SVG statt externer Icon-Schrift,
          gleiches Muster wie im Haupt-Header, aus demselben Grund. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Menü öffnen"
        className="mb-4 flex items-center gap-2 rounded-md border border-line-strong px-3 py-2 text-[12.5px] font-semibold text-ink nav:hidden"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
        Menü
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-void/40 nav:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-none flex-col overflow-y-auto border-r border-line-strong bg-white px-4 py-6 transition-transform duration-200 nav:static nav:z-auto nav:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <Link href="/intern" className="flex items-center gap-[9px]">
            <span
              aria-hidden="true"
              className="h-[26px] w-[26px] flex-none rounded-[6px] border border-ink"
              style={{
                backgroundImage: 'repeating-linear-gradient(-45deg, #14161A 0 3px, #fff 3px 6px)',
              }}
            />
            <span className="font-display text-[16px] font-bold">
              Presseportal<span className="text-signal">112</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="text-ink-2 nav:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">{mainItems.map(renderItem)}</nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
          {footerItems.map(renderItem)}
        </div>

        {organizationName && (
          <div className="mt-4 truncate rounded-md bg-panel px-3 py-2 text-[11px] font-medium text-ink-2">
            {organizationName}
          </div>
        )}
      </aside>
    </>
  );
}
