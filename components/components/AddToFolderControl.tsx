'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AddToFolderControl({
  postId,
  folders,
}: {
  postId: string;
  folders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (folders.length === 0) return null;

  async function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const folderId = e.target.value;
    if (!folderId) return;
    setBusy(true);
    await fetch('/api/intern/folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, postId, action: 'add' }),
    });
    setBusy(false);
    e.target.value = '';
    router.refresh();
  }

  return (
    <select
      onChange={handleChange}
      disabled={busy}
      defaultValue=""
      className="w-full rounded-md border border-line-strong bg-white px-2 py-1.5 text-[11px] text-ink-2 outline-none focus:border-ink disabled:opacity-50"
    >
      <option value="" disabled>
        + Zu Ordner hinzufügen
      </option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
  );
}
