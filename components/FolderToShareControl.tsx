'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FolderOption = { id: string; name: string; postIds: string[] };

export default function FolderToShareControl({
  shareId,
  folders,
  existingPostIds,
}: {
  shareId: string;
  folders: FolderOption[];
  existingPostIds: string[];
}) {
  const router = useRouter();
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(existingPostIds);
  // Nur Ordner anzeigen, die mindestens ein Foto enthalten, das noch nicht
  // Teil dieser Freigabe ist -- sonst stünde ein Ordner zur Auswahl, bei
  // dem "Hinzufügen" nichts Sichtbares mehr bewirken würde.
  const foldersWithNewContent = folders
    .map((f) => ({ ...f, newPostIds: f.postIds.filter((id) => !existing.has(id)) }))
    .filter((f) => f.newPostIds.length > 0);

  async function handleAdd() {
    const folder = foldersWithNewContent.find((f) => f.id === folderId);
    if (!folder) return;
    setBusy(true);
    setError(null);
    try {
      // Nacheinander statt parallel -- die Zuordnungs-Route ist auf
      // Einzelbeiträge ausgelegt, nacheinander ist zuverlässiger als viele
      // gleichzeitige Anfragen gegen dieselbe Freigabe.
      for (const postId of folder.newPostIds) {
        await fetch('/api/intern/media-shares/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId, postId, action: 'add' }),
        });
      }
      setFolderId('');
      router.refresh();
    } catch {
      setError('Hinzufügen fehlgeschlagen. Bitte erneut versuchen.');
    }
    setBusy(false);
  }

  if (foldersWithNewContent.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border border-line bg-panel p-3.5">
      <p className="mb-2.5 text-[12px] font-semibold text-ink-2">
        Oder gleich einen ganzen Ordner hinzufügen
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-[12.5px] outline-none focus:border-ink"
        >
          <option value="">Ordner auswählen …</option>
          {foldersWithNewContent.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.newPostIds.length} neu)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || !folderId}
          className="flex-none rounded-md bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {busy ? '…' : 'Ordner hinzufügen'}
        </button>
      </div>
      {error && <p className="mt-2 text-[11.5px] text-signal-deep">{error}</p>}
    </div>
  );
}
