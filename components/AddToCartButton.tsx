'use client';

import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';

export default function AddToCartButton({
  imageId,
  loggedIn,
}: {
  imageId: string;
  loggedIn: boolean;
}) {
  const { has, add, remove } = useCart();
  const inCart = has(imageId);
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    // Karte ist ein <Link> -- Klick auf den Knopf darf nicht zusätzlich
    // zur Artikelseite navigieren.
    e.preventDefault();
    e.stopPropagation();

    // Nicht eingeloggte Nutzer direkt zur Pressemappe schicken, wo ihnen
    // erklärt wird, wie sie sich registrieren können.
    if (!loggedIn) {
      router.push('/pressemappe');
      return;
    }

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
      aria-label={
        !loggedIn
          ? 'Zur Pressemappe (Anmeldung erforderlich)'
          : inCart
          ? 'Aus Favoriten entfernen'
          : 'Zu Favoriten hinzufügen'
      }
      title={
        !loggedIn
          ? 'Zur Pressemappe (Anmeldung erforderlich)'
          : inCart
          ? 'Aus Favoriten entfernen'
          : 'Zu Favoriten hinzufügen'
      }
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
