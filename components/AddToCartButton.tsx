'use client';

import { useCart } from './CartProvider';

export default function AddToCartButton({ imageId }: { imageId: string }) {
  const { has, add, remove } = useCart();
  const inCart = has(imageId);

  function handleClick(e: React.MouseEvent) {
    // Karte ist ein <Link> -- Klick auf den Knopf darf nicht zusätzlich
    // zur Artikelseite navigieren.
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      remove(imageId);
    } else {
      add(imageId);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inCart ? 'Aus Pressemappe entfernen' : 'Zur Pressemappe hinzufügen'}
      title={inCart ? 'Aus Pressemappe entfernen' : 'Zur Pressemappe hinzufügen'}
      className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold shadow-sm transition-colors ${
        inCart
          ? 'bg-ink text-white'
          : 'bg-white/90 text-ink hover:bg-white'
      }`}
    >
      {inCart ? '✓' : '+'}
    </button>
  );
}
