import Image from 'next/image';
import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';
import type { Post } from '@/lib/types';
import { GEWERK_COLORS, GEWERK_ICONS, normalizeTags, primaryImage } from '@/lib/types';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Card({ post, feature }: { post: Post; feature?: boolean }) {
  const org = typeof post.organization === 'object' ? post.organization : null;
  const hero = primaryImage(post);
  const imageCount = post.images?.length ?? 0;
  const gewerkId = org?.gewerk ?? 'feuerwehr';
  const color = GEWERK_COLORS[gewerkId] ?? GEWERK_COLORS.feuerwehr;
  const icon = GEWERK_ICONS[gewerkId] ?? 'ti-shield';

  return (
    <Link
      href={`/bildarchiv/${post.id}`}
      className={`flex flex-col overflow-hidden rounded-[10px] border border-line bg-white transition-colors hover:border-line-strong ${
        feature ? 'nav:col-start-1 nav:row-span-2 nav:row-start-1' : ''
      }`}
    >
      <div
        className={`relative flex flex-1 items-center justify-center ${
          feature ? 'min-h-[230px]' : 'min-h-[150px]'
        }`}
        style={{ backgroundColor: `${color}0C` }}
      >
        {hero?.file_public_preview ? (
          <Image
            src={directusAssetUrl(hero.file_public_preview, 'width=800&quality=80')}
            alt={post.title ?? 'Einsatzfoto'}
            fill
            className="object-cover"
            sizes={feature ? '(min-width: 901px) 40vw, 90vw' : '(min-width: 901px) 20vw, 45vw'}
          />
        ) : (
          <i
            className={`ti ${icon} ${feature ? 'text-[40px]' : 'text-[26px]'}`}
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
      </div>
      <div className={`border-t border-line ${feature ? 'p-[18px]' : 'p-[15px]'}`}>
        <div className="mb-1.5 font-mono text-[10px] text-ink-3">
          {formatDate(post.published_at ?? post.event_date)}
        </div>
        <div
          className={`font-semibold text-ink ${feature ? 'text-[16px]' : 'text-[12.5px]'}`}
        >
          {org?.name ?? 'Organisation'}
        </div>
        {feature && normalizeTags(post.tags).length > 0 && (
          <div className="mt-[9px] flex flex-wrap gap-[5px]">
            {normalizeTags(post.tags).slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-[4px] bg-panel px-2 py-[3px] text-[10px] text-ink-2"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function PhotoMosaic({ images }: { images: Post[] }) {
  if (images.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
        Sobald die erste Organisation ein Foto freigibt, erscheint es hier.
      </div>
    );
  }

  const [feature, ...rest] = images.slice(0, 5);

  return (
    <div className="grid grid-cols-2 gap-[18px] nav:grid-cols-[1.5fr_1fr_1fr] nav:grid-rows-[190px_190px]">
      <Card post={feature} feature />
      {rest.map((post) => (
        <Card key={post.id} post={post} />
      ))}
    </div>
  );
}
