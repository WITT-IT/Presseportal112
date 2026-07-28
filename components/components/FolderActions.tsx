'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

export default function FolderActions({ folderId, name }: { folderId: string; name: string }) {
  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    const newName = await prompt({
      title: 'Ordner umbenennen',
      defaultValue: name,
      placeholder: 'Neuer Name',
    });
    if (!newName || newName === name) return;
    setBusy(true);
    await fetch(`/api/intern/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Ordner wirklich löschen?',
      message:
        'Die enthaltenen Beiträge bleiben erhalten -- nur die Zuordnung zu diesem Ordner geht verloren.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    await fetch(`/api/intern/folders/${folderId}`, { method: 'DELETE' });
    router.push('/intern/ordner');
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleRename}
        disabled={busy}
        className="rounded-md border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
      >
        Umbenennen
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md border border-line-strong px-3 py-2 text-[12px] font-semibold text-signal-deep transition-colors hover:border-signal disabled:opacity-50"
      >
        Löschen
      </button>
    </div>
  );
}
