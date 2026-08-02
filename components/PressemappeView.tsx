'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';
import { useCart } from './CartProvider';

type Item = {
  id: string;
  title: string | null;
  alarm_code: string | null;
  organization?: { name: string } | null;
  images?: { id: string; file_public_preview: string | null; sort: number }[];
};

function heroPreview(item: Item): string | null {
  if (!item.images || item.images.length === 0) return null;
  return [...item.images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0]
    .file_public_preview;
}

export default function PressemappeView() {
  const { ids, remove, clear } = useCart();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/pressemappe/items?ids=${ids.join(',')}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [ids]);

  if (loading) {
    return <p className="text-[13px] text-ink-2">Lädt …</p>;
  }

  if (ids.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-line-strong p-10 text-center text-[13px] text-ink-2">
        Deine Favoriten sind leer. Im{' '}
        <Link href="/bildarchiv" className="font-semibold text-signal-deep">
          Bildarchiv
        </Link>{' '}
        auf das „+" bei einem Foto klicken, um es hinzuzufügen.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {items.length} Beitrag{items.length === 1 ? '' : 'e'} ausgewählt
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Favoriten leeren
          </button>
          <a
            href={`/api/pressemappe/download?ids=${ids.join(',')}`}
            className="rounded-md bg-ink px-5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            Als ZIP herunterladen
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 nav:grid-cols-4">
        {items.map((item) => {
          const preview = heroPreview(item);
          const count = item.images?.length ?? 0;
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-[10px] border border-line bg-white"
            >
              <div className="relative h-[120px] bg-panel">
                {preview && (
                  <Image
                    src={directusAssetUrl(preview, 'width=300&quality=70')}
                    alt={item.title ?? 'Einsatzfoto'}
                    fill
                    className="object-cover"
                  />
                )}
                {count > 1 && (
                  <span className="absolute bottom-2 left-2 rounded-[4px] bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    {count} Fotos
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5">
                <span className="truncate text-[11px] font-medium">
                  {item.title || item.alarm_code || 'Beitrag'}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="flex-none text-[11px] font-semibold text-signal-deep hover:text-signal"
                >
                  Entfernen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
