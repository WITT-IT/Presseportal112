'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoveFromFolderButton({
  folderId,
  postId,
}: {
  folderId: string;
  postId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await fetch('/api/intern/folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, postId, action: 'remove' }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Aus Ordner entfernen"
      title="Aus Ordner entfernen"
      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[12px] text-signal-deep shadow-sm hover:bg-white disabled:opacity-50"
    >
      ✕
    </button>
  );
}
