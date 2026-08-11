'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function IconPhoto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="9" cy="9" r="1.75" />
      <path d="M21 15l-5.5-5.5L5 20" />
    </svg>
  );
}
function IconShare({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.6l7.6-4.2" />
      <path d="M8.2 13.4l7.6 4.2" />
    </svg>
  );
}
function IconMessage({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}
function IconStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6L12 17.6l-5.8 3.2 1.1-6.6-4.8-4.7 6.6-.9L12 2.5z" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

const ICONS: Record<string, ({ className }: { className?: string }) => React.JSX.Element> = {
  dashboard: IconDashboard,
  photo: IconPhoto,
  share: IconShare,
  message: IconMessage,
  star: IconStar,
  user: IconUser,
  shield: IconShield,
};

export default function InternTopNav({
  organizationName,
  isAdmin,
  isPress,
  unreadCount,
}: {
  organizationName: string | null;
  isAdmin: boolean;
  isPress: boolean;
  unreadCount: number;
}) {
  const pathname = usePathname();

  const mainItems: NavItem[] = isPress
    ? [
        { href: '/intern', label: 'Übersicht', icon: 'dashboard' },
        { href: '/intern/freigaben', label: 'Freigaben', icon: 'share' },
        { href: '/intern/nachrichten', label: 'Nachrichten', icon: 'message', badge: unreadCount },
        { href: '/intern/favoriten', label: 'Favoriten', icon: 'star' },
      ]
    : [
        { href: '/intern', label: 'Übersicht', icon: 'dashboard' },
        { href: '/intern/medien', label: 'Medien', icon: 'photo' },
        { href: '/intern/freigaben', label: 'Freigaben', icon: 'share' },
        { href: '/intern/nachrichten', label: 'Nachrichten', icon: 'message', badge: unreadCount },
      ];

  const accountItems: NavItem[] = [
    { href: '/intern/konto', label: 'Konto', icon: 'user' },
    ...(isAdmin ? [{ href: '/intern/admin', label: 'Admin', icon: 'shield' }] : []),
  ];

  function isActive(href: string) {
    if (href === '/intern') return pathname === '/intern';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderItem(item: NavItem) {
    const active = isActive(item.href);
    const Icon = ICONS[item.icon];
    return (
      <Link
        key={item.href}
        href={item.href}
        className="group relative flex flex-none items-center gap-2 whitespace-nowrap px-1 py-3.5"
      >
        <span className="relative flex-none">
          <Icon
            className={`h-[17px] w-[17px] transition-colors ${
              active ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2'
            }`}
          />
          {/* Hochgestellter Badge am Icon, WhatsApp-Stil -- weißer Rand sorgt
              für sauberen Kontrast egal ob er über Icon oder Hintergrund
              hängt. 9 als Deckel: bei zweistelligen Zahlen "9+" statt einer
              Zahl, die die kleine Pille sprengen würde. */}
          {!!item.badge && item.badge > 0 && (
            <span className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-signal px-[3px] text-[9px] font-bold leading-none text-white">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        <span
          className={`text-[13.5px] font-semibold transition-colors ${
            active ? 'text-ink' : 'text-ink-2 group-hover:text-ink'
          }`}
        >
          {item.label}
        </span>
        <span
          className={`absolute -bottom-px left-0 right-0 h-[2.5px] rounded-full transition-all ${
            active ? 'bg-signal' : 'bg-transparent group-hover:bg-line-strong'
          }`}
        />
      </Link>
    );
  }

  return (
    // Glas-Look statt harter weißer Fläche + Border -- gleiche Sprache wie
    // die neuen Kacheln (bg-white/85 + backdrop-blur + weicher Schatten
    // statt 1px-Rand). Aktiv-Unterstrich jetzt in signal statt ink, damit
    // die Nav den warmen Akzent der Seite aufgreift statt neutral zu bleiben.
    <div className="sticky top-0 z-30 border-b border-white/60 bg-white/85 shadow-[0_1px_0_rgba(16,17,20,0.03),0_8px_24px_rgba(16,17,20,0.04)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 nav:px-10">
        <nav className="flex flex-1 flex-wrap items-center gap-6">
          {mainItems.map(renderItem)}
        </nav>

        <div className="flex flex-none items-center gap-6">
          {organizationName && (
            <div className="hidden items-center gap-2 border-r border-line pr-6 nav:flex">
              <span className="max-w-[160px] truncate text-[12.5px] font-medium text-ink-2">
                {organizationName}
              </span>
              {isPress && (
                <span className="flex-none rounded-full bg-signal px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                  Presse
                </span>
              )}
            </div>
          )}
          <nav className="flex items-center gap-5">{accountItems.map(renderItem)}</nav>
        </div>
      </div>
    </div>
  );
}
