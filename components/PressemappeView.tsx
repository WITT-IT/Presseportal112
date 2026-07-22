'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { directusAssetUrl } from '@/lib/directus';
import { useCart } from './CartProvider';

type Item = {
  id: string;
  title: string | null;
  file_public_preview: string | null;
  alarm_code: string | null;
  organization?: { name: string } | null;
};

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
        Deine Pressemappe ist leer. Im{' '}
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
          {items.length} Foto{items.length === 1 ? '' : 's'} ausgewählt
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Mappe leeren
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
        {items.map((img) => (
          <div
            key={img.id}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="relative h-[120px] bg-panel">
              {img.file_public_preview && (
                <Image
                  src={directusAssetUrl(img.file_public_preview, 'width=300&quality=70')}
                  alt={img.title ?? 'Einsatzfoto'}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5">
              <span className="truncate text-[11px] font-medium">
                {img.title || img.alarm_code || 'Foto'}
              </span>
              <button
                type="button"
                onClick={() => remove(img.id)}
                className="flex-none text-[11px] font-semibold text-signal-deep hover:text-signal"
              >
                Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
