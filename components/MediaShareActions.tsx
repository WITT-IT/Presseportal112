'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

export default function MediaShareActions({
  shareId,
  name,
  active,
}: {
  shareId: string;
  name: string;
  active: boolean;
}) {
  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    const newName = await prompt({
      title: 'Freigabe umbenennen',
      defaultValue: name,
      placeholder: 'Neuer Name',
    });
    if (!newName || newName === name) return;
    setBusy(true);
    await fetch(`/api/intern/media-shares/${shareId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleToggleActive() {
    setBusy(true);
    await fetch(`/api/intern/media-shares/${shareId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Freigabe wirklich löschen?',
      message:
        'Der Link funktioniert danach sofort nicht mehr. Die Beiträge selbst bleiben im internen Archiv erhalten.',
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    await fetch(`/api/intern/media-shares/${shareId}`, { method: 'DELETE' });
    router.push('/intern/freigaben');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={busy}
        className="rounded-md border border-line-strong px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
      >
        {active ? 'Deaktivieren' : 'Aktivieren'}
      </button>
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
