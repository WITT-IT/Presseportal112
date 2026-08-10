'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

function IconShare({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.6l7.6-4.2" />
      <path d="M8.2 13.4l7.6 4.2" />
    </svg>
  );
}

export default function ShareFolderControl({
  folderId,
  folderName,
  mediaShares,
}: {
  folderId: string;
  folderName: string;
  mediaShares: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handlePick(shareId: string, shareName: string) {
    setOpen(false);
    const confirmed = await confirm({
      title: `„${folderName}" freigeben?`,
      message: `Alle Bilder in diesem Ordner werden zur Freigabe „${shareName}" hinzugefügt — inklusive aller Unterordner, egal wie tief verschachtelt. Bereits enthaltene Bilder werden nicht doppelt hinzugefügt.`,
      confirmLabel: 'Ordner freigeben',
      cancelLabel: 'Abbrechen',
    });
    if (!confirmed) return;

    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, folderId, action: 'add' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Fehlgeschlagen.');
      setResult(`${body.added} von ${body.total} Bildern zu „${shareName}" hinzugefügt.`);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Freigeben fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  if (mediaShares.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={busy}
        title="Diesen Ordner freigeben (inkl. Unterordner)"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-line-strong hover:bg-panel hover:text-ink disabled:opacity-50"
      >
        <IconShare className="h-[12px] w-[12px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-7 z-20 w-56 rounded-md border border-line-strong bg-white p-1.5 shadow-lg"
          >
            <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
              Ordner freigeben an
            </p>
            {mediaShares.map((share) => (
              <button
                key={share.id}
                type="button"
                onClick={() => handlePick(share.id, share.name)}
                className="block w-full rounded px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-panel"
              >
                {share.name}
              </button>
            ))}
          </div>
        </>
      )}

      {result && (
        <p className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-line bg-white px-2 py-1.5 text-[11px] text-ink-2 shadow-sm">
          {result}
        </p>
      )}
    </div>
  );
}
