'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoveFromFolderButton({
  folderId,
  postId,
  isPublicFolder = false,
}: {
  folderId: string;
  postId: string;
  isPublicFolder?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);

    if (isPublicFolder) {
      // Nutzt toggle-public mit removeFromPublic=true statt separater Route
      await fetch('/api/intern/posts/toggle-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, removeFromPublic: true, folderId }),
      });
    } else {
      await fetch('/api/intern/folders/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, postId, action: 'remove' }),
      });
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={isPublicFolder ? 'Aus Öffentlich zurückziehen' : 'Aus Ordner entfernen'}
      title={isPublicFolder ? 'Zurückziehen — Beitrag wird privat' : 'Aus Ordner entfernen'}
      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[12px] text-signal-deep shadow-sm hover:bg-white disabled:opacity-50"
    >
      ✕
    </button>
  );
}
