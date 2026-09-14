'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Freigabe-Popup, das von ZWEI Stellen aus geöffnet wird: über das
// Freigeben-Symbol auf einer Ordnerkachel (ganzer Ordner inkl. Unterordner
// ODER gezielt einzelne Bilder daraus) und über das gleiche Symbol auf
// einzelnen Bildern bzw. der Mehrfachauswahl. Damit ist "Freigeben" von
// jeder Ebene der Mediathek aus genauso möglich wie bisher nur über die
// Verwaltungsseite /intern/freigaben/[id].
export type ShareTarget =
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'media'; ids: string[]; label: string };

type FolderNode = { id: string; name: string };
type LibraryItem = { id: string; display_name: string | null };

export default function ShareMediaModal({
  target,
  mediaShares,
  onClose,
}: {
  target: ShareTarget;
  mediaShares: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();

  // "whole" = ganzer Ordner inkl. aller Unterordner, "pick" = gezielt
  // einzelne Bilder aus diesem Ordner (und seinen Unterordnern) auswählen.
  const [mode, setMode] = useState<'whole' | 'pick'>('whole');
  const [shares, setShares] = useState(mediaShares);
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [creatingShare, setCreatingShare] = useState(shares.length === 0);
  const [newShareName, setNewShareName] = useState('');
  const [creating, setCreating] = useState(false);

  // Ordner-Browser für den "einzelne Bilder auswählen"-Modus -- startet
  // IMMER im angeklickten Ordner, nicht in der Wurzel der Bibliothek: Wer
  // aus einem Unterordner heraus freigibt, soll dort landen, nicht erst
  // wieder von vorn navigieren müssen.
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(
    target.kind === 'folder' ? target.id : null
  );
  const [breadcrumb, setBreadcrumb] = useState<FolderNode[]>([]);
  const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
  const [folderItems, setFolderItems] = useState<LibraryItem[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);

  const isFolderTarget = target.kind === 'folder';

  async function loadBrowseFolder(folderId: string) {
    setFolderLoading(true);
    try {
      const [contentsRes, itemsRes] = await Promise.all([
        fetch(`/api/intern/folders?contents=1&folder=${folderId}`),
        fetch(`/api/intern/library?folder=${folderId}&limit=200`),
      ]);
      const contentsBody = contentsRes.ok ? await contentsRes.json() : {};
      const itemsBody = itemsRes.ok ? await itemsRes.json() : {};
      setBreadcrumb(contentsBody.breadcrumb ?? []);
      setSubfolders(contentsBody.subfolders ?? []);
      setFolderItems(Array.isArray(itemsBody.items) ? itemsBody.items : []);
    } catch {
      setBreadcrumb([]);
      setSubfolders([]);
      setFolderItems([]);
    } finally {
      setFolderLoading(false);
    }
  }

  useEffect(() => {
    if (isFolderTarget && mode === 'pick' && browseFolderId) {
      loadBrowseFolder(browseFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, browseFolderId]);

  // Breadcrumb auf den Ausschnitt AB dem ursprünglich angeklickten Ordner
  // kürzen -- sonst könnte man über "Medienbibliothek" versehentlich aus
  // dem eigentlich gemeinten Ordner heraus navigieren.
  const scopedBreadcrumb =
    target.kind === 'folder'
      ? (() => {
          const idx = breadcrumb.findIndex((f) => f.id === target.id);
          return idx >= 0 ? breadcrumb.slice(idx + 1) : breadcrumb;
        })()
      : [];

  async function handleCreateShare(e: FormEvent) {
    e.preventDefault();
    const name = newShareName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/intern/media-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, validityDays: 10, autoDeleteOnExpiry: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id) throw new Error(body.error ?? 'Freigabe konnte nicht angelegt werden.');
      setShares((prev) => [...prev, { id: body.id, name: body.name ?? name }]);
      setActiveShareId(body.id);
      setNewShareName('');
      setCreatingShare(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigabe konnte nicht angelegt werden.');
    } finally {
      setCreating(false);
    }
  }

  async function handleShareWholeFolder(shareId: string, shareName: string) {
    if (target.kind !== 'folder') return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, folderId: target.id, action: 'add' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Freigeben fehlgeschlagen.');
      setResult(`„${target.name}" zu „${shareName}" freigegeben — ${body.added} von ${body.total} Bildern hinzugefügt.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigeben fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShareSelectedMedia(shareId: string, shareName: string) {
    if (target.kind !== 'media') return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let added = 0;
      for (const mediaId of target.ids) {
        const res = await fetch('/api/intern/media-shares/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId, mediaId, action: 'add' }),
        });
        if (res.ok) added++;
      }
      setResult(
        added === target.ids.length
          ? `${added === 1 ? 'Bild' : `${added} Bilder`} zu „${shareName}" hinzugefügt.`
          : `${added} von ${target.ids.length} Bildern zu „${shareName}" hinzugefügt.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigeben fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPickedImage(mediaId: string) {
    if (!activeShareId) return;
    setPendingImageId(mediaId);
    setError(null);
    try {
      const res = await fetch('/api/intern/media-shares/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: activeShareId, mediaId, action: 'add' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Hinzufügen fehlgeschlagen.');
      }
      setAddedIds((prev) => new Set(prev).add(mediaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen.');
    } finally {
      setPendingImageId(null);
    }
  }

  const activeShareName = shares.find((s) => s.id === activeShareId)?.name ?? null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[14px] border border-line bg-white p-4 shadow-raised">
        <div className="mb-1 flex items-center gap-2">
          <i className="ti ti-share text-[18px] text-signal-deep" aria-hidden="true" />
          <h3 className="font-display text-[19px] font-bold">
            {target.kind === 'folder' ? `„${target.name}" freigeben` : `${target.label} freigeben`}
          </h3>
        </div>
        <p className="mb-3 text-[12px] text-ink-2">
          An externe Medienvertreter:innen freigeben — wie unter{' '}
          <span className="font-medium text-ink">Freigaben</span> im Menü.
        </p>

        <div className="flex-1 overflow-y-auto">
          {isFolderTarget && (
            <div className="mb-3 flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
              <button
                type="button"
                onClick={() => setMode('whole')}
                className={`flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  mode === 'whole' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
                }`}
              >
                Ganzer Ordner
              </button>
              <button
                type="button"
                onClick={() => setMode('pick')}
                className={`flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  mode === 'pick' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
                }`}
              >
                Einzelne Bilder auswählen
              </button>
            </div>
          )}

          {isFolderTarget && mode === 'whole' && (
            <p className="mb-3 rounded-md border border-signal/25 bg-signal/5 px-3 py-2 text-[12px] leading-[1.5] text-ink-2">
              Alle Bilder in diesem Ordner werden freigegeben — inklusive aller Unterordner, egal wie tief
              verschachtelt. Bereits enthaltene Bilder werden nicht doppelt hinzugefügt.
            </p>
          )}

          {isFolderTarget && mode === 'pick' && (
            <p className="mb-3 rounded-md border border-line bg-panel/40 px-3 py-2 text-[12px] leading-[1.5] text-ink-2">
              Zuerst unten eine Freigabe wählen, dann in der Bilderübersicht anklicken, was hinzugefügt werden
              soll.
            </p>
          )}

          <div className="mb-3 rounded-[10px] border border-line bg-panel/30 p-3">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
              Freigabe wählen
            </p>
            {shares.length === 0 && !creatingShare ? (
              <p className="mb-2 text-[12.5px] text-ink-2">Noch keine Freigabe vorhanden.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {shares.map((share) => {
                  const isActive = activeShareId === share.id;
                  return (
                    <button
                      key={share.id}
                      type="button"
                      onClick={() => {
                        setActiveShareId(share.id);
                        setResult(null);
                        setError(null);
                        if (!isFolderTarget) {
                          handleShareSelectedMedia(share.id, share.name);
                        } else if (mode === 'whole') {
                          handleShareWholeFolder(share.id, share.name);
                        }
                      }}
                      disabled={busy}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors disabled:opacity-50 ${
                        isActive
                          ? 'border-signal bg-signal/10 text-signal-deep'
                          : 'border-line-strong text-ink hover:border-ink'
                      }`}
                    >
                      {share.name}
                      {isActive && isFolderTarget && mode === 'pick' && (
                        <i className="ti ti-check text-[15px]" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {creatingShare ? (
              <form onSubmit={handleCreateShare} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newShareName}
                  onChange={(e) => setNewShareName(e.target.value)}
                  placeholder="Name der neuen Freigabe"
                  className="min-w-0 flex-1 rounded-md border border-line-strong px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  disabled={creating || !newShareName.trim()}
                  className="flex-none rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {creating ? '…' : 'Anlegen'}
                </button>
                {shares.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreatingShare(false)}
                    className="flex-none rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink-2"
                  >
                    Abbrechen
                  </button>
                )}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingShare(true)}
                className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink"
              >
                <i className="ti ti-plus text-[13px]" aria-hidden="true" />
                Neue Freigabe erstellen
              </button>
            )}
          </div>

          {error && <p className="mb-3 text-[12.5px] text-signal-deep">{error}</p>}
          {result && <p className="mb-3 text-[12.5px] text-emerald-700">{result}</p>}

          {isFolderTarget && mode === 'pick' && (
            <div className="rounded-[10px] border border-line bg-white p-3">
              {!activeShareId ? (
                <p className="py-6 text-center text-[12.5px] text-ink-3">
                  Bitte oben zuerst eine Freigabe auswählen.
                </p>
              ) : (
                <>
                  <p className="mb-2 flex flex-wrap items-center gap-1 text-[12px] text-ink-2">
                    <span className="font-semibold text-ink">„{target.name}"</span>
                    {scopedBreadcrumb.map((f) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-ink-3">/</span>
                        <button
                          type="button"
                          onClick={() => setBrowseFolderId(f.id)}
                          className="hover:underline"
                        >
                          {f.name}
                        </button>
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] text-ink-3">
                      → Freigabe „{activeShareName}"
                    </span>
                  </p>

                  {folderLoading ? (
                    <p className="py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
                  ) : subfolders.length === 0 && folderItems.length === 0 ? (
                    <p className="py-8 text-center text-[12.5px] text-ink-3">Dieser Ordner ist leer.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 nav:grid-cols-5">
                      {subfolders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setBrowseFolderId(f.id)}
                          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[10px] bg-panel p-2 transition-colors hover:bg-line"
                        >
                          <i className="ti ti-folder text-[22px] text-ink-2" aria-hidden="true" />
                          <span className="line-clamp-1 text-center text-[11px] font-medium text-ink">
                            {f.name}
                          </span>
                        </button>
                      ))}
                      {folderItems.map((item) => {
                        const added = addedIds.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => !added && handleAddPickedImage(item.id)}
                            disabled={added || pendingImageId === item.id}
                            className="group relative aspect-square overflow-hidden rounded-[10px] border border-line transition-colors hover:border-ink disabled:cursor-default"
                          >
                            <Image
                              src={`/api/intern/library?original=${item.id}&width=160&quality=70`}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div
                              className={`absolute inset-0 flex items-center justify-center transition-colors ${
                                added ? 'bg-emerald-600/50' : 'bg-black/0 group-hover:bg-black/40'
                              }`}
                            >
                              {added ? (
                                <i className="ti ti-check text-[18px] text-white" aria-hidden="true" />
                              ) : (
                                <i
                                  className="ti ti-plus text-[18px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            {pendingImageId === item.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <span className="text-[9px] font-semibold text-white">…</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-none justify-end">
          <button
            type="button"
            onClick={() => {
              router.refresh();
              onClose();
            }}
            className="rounded-md border border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
