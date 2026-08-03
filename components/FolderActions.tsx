'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

export default function FolderActions({ folderId, name }: { folderId: string; name: string }) {
  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename() {
    const newName = await prompt({
      title: 'Ordner umbenennen',
      defaultValue: name,
      placeholder: 'Neuer Name',
    });
    if (!newName || newName === name) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Umbenennen fehlgeschlagen.');
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Ordner wirklich löschen?',
      message:
        'Die enthaltenen Beiträge bleiben erhalten -- nur die Zuordnung zu diesem Ordner geht verloren.',
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/intern/folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/intern/ordner');
      router.refresh();
    } else {
      setBusy(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Löschen fehlgeschlagen.');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRename}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
        >
          <i className="ti ti-edit text-[14px]" aria-hidden="true" />
          Umbenennen
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2.5 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal disabled:opacity-50"
        >
          <i className="ti ti-trash text-[14px]" aria-hidden="true" />
          Löschen
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-signal-deep">{error}</p>}
    </div>
  );
}
