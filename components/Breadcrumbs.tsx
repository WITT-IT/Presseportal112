import Link from 'next/link';

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-[12.5px]">
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
              <span className={isLast ? 'font-semibold text-ink' : 'text-ink-2'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <i className="ti ti-chevron-right text-[12px] text-ink-3" aria-hidden="true" />
            )}
          </span>
        );
      })}
    </nav>
  );
}
