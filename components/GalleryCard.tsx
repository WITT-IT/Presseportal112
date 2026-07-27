import Image from 'next/image';
import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';
import type { Post } from '@/lib/types';
import { GEWERK_COLORS, GEWERK_ICONS, primaryImage } from '@/lib/types';
import AddToCartButton from './AddToCartButton';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function GalleryCard({ post }: { post: Post }) {
  const org = typeof post.organization === 'object' ? post.organization : null;
  const hero = primaryImage(post);
  const imageCount = post.images?.length ?? 0;
  const gewerkId = org?.gewerk ?? 'feuerwehr';
  const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
  const icon = GEWERK_ICONS[gewerkId] ?? 'ti-shield';

  return (
    <Link
      href={`/bildarchiv/${post.id}`}
      className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-white transition-colors hover:border-line-strong"
    >
      <div
        className="relative flex min-h-[170px] flex-1 items-center justify-center"
        style={{ backgroundColor: `${color}0C` }}
      >
        {hero?.file_public_preview ? (
          <Image
            src={directusAssetUrl(hero.file_public_preview, 'width=600&quality=80')}
            alt={post.title ?? 'Einsatzfoto'}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 90vw"
          />
        ) : (
          <i
            className={`ti ${icon} text-[26px]`}
            style={{ color }}
            aria-hidden="true"
          />
        )}
        <span
          className="absolute left-3 top-3 rounded-[4px] border border-line-strong bg-white px-2.5 py-1 font-mono text-[10.5px] font-medium"
          style={{ color }}
        >
          {post.alarm_code ?? '—'}
        </span>
        {imageCount > 1 && (
          <span className="absolute bottom-2.5 left-3 rounded-[4px] bg-ink/80 px-2 py-0.5 font-mono text-[10px] font-medium text-white">
            {imageCount} Fotos
          </span>
        )}
        <AddToCartButton imageId={post.id} />
      </div>
      <div className="border-t border-line p-[15px]">
        <div className="mb-1.5 font-mono text-[10px] text-ink-3">
          {formatDate(post.published_at ?? post.event_date)}
          {post.location ? ` · ${post.location}` : ''}
        </div>
        <div className="text-[12.5px] font-semibold text-ink">
          {org?.name ?? 'Organisation'}
        </div>
      </div>
    </Link>
  );
}
