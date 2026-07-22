import Link from 'next/link';
import type { Gewerk } from '@/lib/types';

export default function GewerkFilterTabs({
  gewerke,
  active,
}: {
  gewerke: Gewerk[];
  active?: string;
}) {
  const tabs = [{ id: undefined, name: 'Alle' }, ...gewerke];

  return (
    <div className="flex flex-wrap gap-2 border-b border-line pb-5">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const href = tab.id ? `/bildarchiv?gewerk=${tab.id}` : '/bildarchiv';
        return (
          <Link
            key={tab.name}
            href={href}
            className={`rounded-full border px-4 py-2 text-[12.5px] font-medium transition-colors ${
              isActive
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong text-ink-2 hover:border-ink hover:text-ink'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
