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
    console.log('[RemoveFromFolderButton] click', { folderId, postId, isPublicFolder });
    setBusy(true);

    if (isPublicFolder) {
      console.log('[RemoveFromFolderButton] → remove-from-public');
      const res = await fetch('/api/intern/posts/remove-from-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, folderId }),
      });
      console.log('[RemoveFromFolderButton] response status:', res.status);
    } else {
      console.log('[RemoveFromFolderButton] → folders/assign remove');
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
