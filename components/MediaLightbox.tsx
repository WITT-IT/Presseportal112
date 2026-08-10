'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

type MediaItem = {
  id: string;
  display_name: string | null;
  file: string;
  file_preview: string | null;
};

// Großansicht für ein Bild aus der internen Medienbibliothek -- optisch an
// die öffentliche Lightbox in PostGallery.tsx angelehnt (gleicher
// Bild-über-Steuerleiste-Aufbau, gleiche Tastatursteuerung), aber mit
// zusätzlichen internen Aktionen: Name direkt editierbar, Veröffentlichen,
// Löschen. Nutzt den bestehenden Asset-Proxy /api/intern/library?original=,
// der die Datei organisationsscope-geprüft und mit Directus-Transform
// (width/quality) ausliefert -- kein neuer Endpunkt nötig.
export default function MediaLightbox({
  items,
  activeId,
  onClose,
  onChangeActive,
}: {
  items: MediaItem[];
  activeId: string;
  onClose: () => void;
  onChangeActive: (id: string) => void;
}) {
  const router = useRouter();
  const { confirm } = useDialog();

  const index = items.findIndex((i) => i.id === activeId);
  const active = index >= 0 ? items[index] : null;

  const [nameDraft, setNameDraft] = useState(active?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Eingabefeld beim Wechsel auf ein anderes Bild (Pfeiltasten/Klick) auf
  // dessen aktuellen Namen zurücksetzen.
  useEffect(() => {
    setNameDraft(active?.display_name ?? '');
    setNameSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Tastatursteuerung, solange die Großansicht offen ist -- gleiches
  // Verhalten wie im öffentlichen Bereich (Escape/Pfeiltasten).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) {
        onChangeActive(items[(index + 1) % items.length].id);
      }
      if (e.key === 'ArrowLeft' && items.length > 1) {
        onChangeActive(items[(index - 1 + items.length) % items.length].id);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, items, onChangeActive, onClose]);

  if (!active) return null;

  async function saveName() {
    const value = nameDraft.trim();
    if (!value || value === (active!.display_name ?? '')) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/intern/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active!.id, display_name: value }),
      });
      if (!res.ok) throw new Error();
      setNameSaved(true);
      router.refresh();
    } catch {
      // Stiller Fehlschlag reicht -- Eingabefeld bleibt stehen, erneuter
      // Versuch (Enter/Blur) funktioniert genauso wie beim ersten Mal.
    } finally {
      setSavingName(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Bild wirklich löschen?',
      message: `„${active!.display_name || 'Dieses Bild'}" wird dauerhaft aus der Bibliothek entfernt.`,
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/intern/library?id=${active!.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Löschen fehlgeschlagen.');
      }
      onClose();
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-[1100px] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto max-h-[65vh] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/intern/library?original=${active.id}&width=1800&quality=88`}
            alt={active.display_name ?? 'Bild'}
            className="mx-auto max-h-[65vh] w-auto rounded-[8px] object-contain"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-white/50">
              Name
            </label>
            <div className="flex max-w-[420px] items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveName();
                  }
                }}
                onBlur={saveName}
                className="w-full rounded-md border border-white/20 bg-white/[0.07] px-3 py-2 text-[13.5px] text-white outline-none focus:border-white/40"
              />
              {savingName && <span className="flex-none text-[11px] text-white/50">Speichert …</span>}
              {!savingName && nameSaved && (
                <span className="flex-none text-[11px] text-emerald-400">Gespeichert</span>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-white/40">
              Bild {index + 1} von {items.length}
            </p>
          </div>

          <div className="flex flex-none flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/intern/upload?mediaId=${active.id}`)}
              className="rounded-md bg-signal-deep px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            >
              Veröffentlichen
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md bg-white/15 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
            >
              {busy ? '…' : 'Löschen'}
            </button>
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onChangeActive(items[(index - 1 + items.length) % items.length].id)}
                  aria-label="Vorheriges Bild"
                  className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => onChangeActive(items[(index + 1) % items.length].id)}
                  aria-label="Nächstes Bild"
                  className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
                >
                  →
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="rounded-md bg-white/15 px-3 py-2 text-[13px] text-white hover:bg-white/25"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
