'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ConversationListItem({
  id,
  subject,
  lastMessagePreview,
  lastMessageAt,
  unread,
}: {
  id: string;
  subject: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unread: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === `/intern/nachrichten/${id}`;

  return (
    <Link
      href={`/intern/nachrichten/${id}`}
      className={`flex flex-col gap-0.5 rounded-md border px-3 py-2.5 transition-colors ${
        isActive
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-white text-ink hover:border-line-strong'
      }`}
    >
      <div className="flex items-center gap-2">
        {unread && !isActive && (
          <span className="h-2 w-2 flex-none rounded-full bg-signal" aria-hidden="true" />
        )}
        <span className={`truncate text-[13px] ${unread ? 'font-bold' : 'font-medium'}`}>
          {subject}
        </span>
      </div>
      <p className={`truncate text-[11.5px] ${isActive ? 'text-white/70' : 'text-ink-2'}`}>
        {lastMessagePreview}
      </p>
      <span className={`font-mono text-[10px] ${isActive ? 'text-white/50' : 'text-ink-3'}`}>
        {lastMessageAt ? new Date(lastMessageAt).toLocaleDateString('de-DE') : ''}
      </span>
    </Link>
  );
}
