import Link from 'next/link';

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const parent = items.length > 1 ? items[items.length - 2] : null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-md border border-line bg-white px-4 py-2.5">
      {parent?.href && (
        <Link
          href={parent.href}
          aria-label={`Zurück zu ${parent.label}`}
          title={`Zurück zu ${parent.label}`}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-panel hover:text-ink"
        >
          <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
        </Link>
      )}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-bold text-ink' : 'font-medium text-ink-2'}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <i className="ti ti-chevron-right text-[13px] text-ink-3" aria-hidden="true" />
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
