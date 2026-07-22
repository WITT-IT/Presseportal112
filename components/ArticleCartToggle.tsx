'use client';

import { useCart } from './CartProvider';

export default function ArticleCartToggle({ imageId }: { imageId: string }) {
  const { has, add, remove } = useCart();
  const inCart = has(imageId);

  return (
    <button
      type="button"
      onClick={() => (inCart ? remove(imageId) : add(imageId))}
      className={`inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-[12.5px] font-semibold transition-colors ${
        inCart
          ? 'border-ink bg-ink text-white'
          : 'border-line-strong text-ink hover:border-ink'
      }`}
    >
      {inCart ? '✓ In der Pressemappe' : '+ Zur Pressemappe'}
    </button>
  );
}
