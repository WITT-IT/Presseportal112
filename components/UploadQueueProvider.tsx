'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

// BEWUSST 1, NICHT MEHR:
// app/api/intern/library/route.ts führt storage_used_bytes nach dem Muster
// "lesen -> addieren -> zurückschreiben" nach. Bei zwei gleichzeitigen
// Requests lesen beide denselben Ausgangswert und der zweite Schreibvorgang
// überschreibt den ersten -- klassisches Lost Update. Solange die
// Buchhaltung serverseitig nicht atomar ist, darf immer nur ein Upload
// gleichzeitig laufen.
const MAX_PARALLEL = 1;

// Mindestabstand zwischen zwei router.refresh()-Aufrufen während eines
// laufenden Stapels. Ohne Drossel würde ein 200-Bilder-Ordner 200 volle
// Server-Rerenders auslösen.
const REFRESH_THROTTLE_MS = 1500;

const AUTO_HIDE_MS = 5000;

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  folderId: string | null;
  status: UploadStatus;
  /** 0..1 -- reiner Übertragungsfortschritt, ohne Serververarbeitung. */
  progress: number;
  error?: string;
};

type UploadQueueContextType = {
  enqueue: (files: File[], folderId: string | null) => number;
  items: UploadItem[];
  isUploading: boolean;
  /**
   * Letzter vom Server gemeldeter Speicherstand. Null, solange die
   * Upload-Route kein usedBytes zurückgibt.
   */
  liveUsedBytes: number | null;
  /**
   * Summe der Bytes, die seit dem letzten bekannten Server-Stand
   * erfolgreich hochgeladen wurden. Aufrufer addieren das auf ihren
   * serverseitig gerenderten Wert -- damit stimmt die Anzeige sofort,
   * ohne auf einen Server-Rerender zu warten.
   */
  uploadedBytes: number;
  /** Aufschlag verwerfen, sobald ein frischer Server-Wert vorliegt. */
  resetUploadedBytes: () => void;
};

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

// ── Hilfsfunktionen für Drag & Drop ──────────────────────────────────────
//
// dataTransfer.files enthält bei einem fallengelassenen ORDNER nichts
// Brauchbares. Nur über webkitGetAsEntry() kommt man an den Verzeichnisbaum.
//
// KRITISCH: DataTransferItemList ist nur SYNCHRON im Event-Handler gültig.
// Nach dem ersten await ist sie leer.

export function entriesFromDataTransfer(dt: DataTransfer): FileSystemEntry[] {
  const out: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue;
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (entry) out.push(entry);
  }
  return out;
}

export async function expandEntries(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];

  async function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve) => {
      reader.readEntries(
        (result) => resolve(Array.from(result)),
        () => resolve([])
      );
    });
  }

  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => {
        (entry as FileSystemFileEntry).file(
          (f) => resolve(f),
          () => resolve(null)
        );
      });
      if (file) files.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries liefert pro Aufruf maximal 100 Einträge -- so lange
      // nachlesen, bis ein leerer Batch kommt.
      let batch = await readBatch(reader);
      while (batch.length > 0) {
        for (const child of batch) {
          await walk(child);
        }
        batch = await readBatch(reader);
      }
    }
  }

  for (const entry of entries) {
    await walk(entry);
  }
  return files;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|avif|heic|heif|tiff?|bmp)$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons ────────────────────────────────────────────────────────────────

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconAlert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function IconRetry({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [liveUsedBytes, setLiveUsedBytes] = useState<number | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);

  // Dateien bewusst NICHT im State: React würde bei jedem Fortschritts-Tick
  // ein Array mit hunderten File-Objekten neu aufbauen.
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const folderMapRef = useRef<Map<string, string | null>>(new Map());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const counterRef = useRef(0);
  const lastRefreshRef = useRef(0);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const resetUploadedBytes = useCallback(() => {
    setUploadedBytes(0);
  }, []);

  const startNextRef = useRef<() => void>(() => {});

  const runJob = useCallback(
    (id: string) => {
      const file = fileMapRef.current.get(id);
      if (!file) {
        activeRef.current--;
        startNextRef.current();
        return;
      }
      const folderId = folderMapRef.current.get(id) ?? null;
      const fileSize = file.size;

      updateItem(id, { status: 'uploading', progress: 0, error: undefined });

      const xhr = new XMLHttpRequest();
      xhrMapRef.current.set(id, xhr);

      const formData = new FormData();
      if (folderId) formData.append('folder', folderId);
      formData.append('image_count', '1');
      formData.append('file_0', file, file.name);

      function settle() {
        xhrMapRef.current.delete(id);
        fileMapRef.current.delete(id);
        folderMapRef.current.delete(id);
        activeRef.current--;

        const drained = activeRef.current === 0 && queueRef.current.length === 0;
        const now = Date.now();

        if (drained || now - lastRefreshRef.current > REFRESH_THROTTLE_MS) {
          lastRefreshRef.current = now;
          router.refresh();
        }

        startNextRef.current();
      }

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const progress = e.loaded / e.total;
        // Bei 100 % übertragener Bytes ist der Server noch nicht fertig
        // (Directus schreibt die Datei, erzeugt Vorschauen).
        updateItem(id, { progress, status: progress >= 1 ? 'processing' : 'uploading' });
      };

      xhr.onload = () => {
        let body: { error?: string; errors?: string[]; usedBytes?: number } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = {};
        }
        const ok = xhr.status >= 200 && xhr.status < 300 && !body.errors?.length;

        if (typeof body.usedBytes === 'number') {
          setLiveUsedBytes(body.usedBytes);
        }

        if (ok) {
          // Mitzählen, was tatsächlich in Directus gelandet ist. Directus
          // speichert genau die übertragene Dateigröße, deshalb ist das
          // kein Schätzwert, sondern der exakte Zuwachs.
          setUploadedBytes((prev) => prev + fileSize);
          updateItem(id, { status: 'done', progress: 1, error: undefined });
        } else {
          updateItem(id, {
            status: 'error',
            error: body.error ?? body.errors?.[0] ?? `Fehlgeschlagen (Status ${xhr.status}).`,
          });
        }
        settle();
      };

      xhr.onerror = () => {
        updateItem(id, { status: 'error', error: 'Netzwerkfehler — Verbindung unterbrochen.' });
        settle();
      };

      xhr.onabort = () => {
        updateItem(id, { status: 'canceled' });
        settle();
      };

      xhr.open('POST', '/api/intern/library');
      xhr.send(formData);
    },
    [router, updateItem]
  );

  const startNext = useCallback(() => {
    while (activeRef.current < MAX_PARALLEL && queueRef.current.length > 0) {
      const id = queueRef.current.shift();
      if (!id) break;
      if (!fileMapRef.current.has(id)) continue;
      activeRef.current++;
      runJob(id);
    }
  }, [runJob]);

  startNextRef.current = startNext;

  const enqueue = useCallback(
    (files: File[], folderId: string | null) => {
      if (files.length === 0) return 0;

      const newItems: UploadItem[] = files.map((file) => {
        counterRef.current += 1;
        const id = `up_${Date.now()}_${counterRef.current}`;
        fileMapRef.current.set(id, file);
        folderMapRef.current.set(id, folderId);
        return {
          id,
          name: file.name,
          size: file.size,
          folderId,
          status: 'queued' as UploadStatus,
          progress: 0,
        };
      });

      queueRef.current.push(...newItems.map((it) => it.id));
      setCollapsed(false);
      setItems((prev) => {
        const carry = prev.filter((it) => it.status !== 'done' && it.status !== 'canceled');
        return [...carry, ...newItems];
      });

      startNext();
      return newItems.length;
    },
    [startNext]
  );

  function cancelItem(id: string) {
    const xhr = xhrMapRef.current.get(id);
    if (xhr) {
      xhr.abort();
      return;
    }
    queueRef.current = queueRef.current.filter((queuedId) => queuedId !== id);
    fileMapRef.current.delete(id);
    folderMapRef.current.delete(id);
    updateItem(id, { status: 'canceled' });
  }

  function cancelAll() {
    queueRef.current = [];
    for (const xhr of xhrMapRef.current.values()) xhr.abort();
  }

  function dismiss() {
    cancelAll();
    fileMapRef.current.clear();
    folderMapRef.current.clear();
    setItems([]);
  }

  const active = items.filter(
    (it) => it.status === 'uploading' || it.status === 'processing' || it.status === 'queued'
  );
  const doneCount = items.filter((it) => it.status === 'done').length;
  const errorCount = items.filter((it) => it.status === 'error').length;
  const isUploading = active.length > 0;

  // Gesamtfortschritt gewichtet nach Dateigröße -- ein Zähler "3 von 12"
  // springt bei gemischten Größen unbrauchbar.
  const totalBytes = items.reduce((sum, it) => sum + it.size, 0);
  const doneBytes = items.reduce((sum, it) => {
    if (it.status === 'done') return sum + it.size;
    if (it.status === 'uploading' || it.status === 'processing') return sum + it.size * it.progress;
    return sum;
  }, 0);
  const overall = totalBytes > 0 ? Math.min(1, doneBytes / totalBytes) : 0;

  useEffect(() => {
    if (items.length === 0) return;
    const allSettled = items.every(
      (it) => it.status === 'done' || it.status === 'error' || it.status === 'canceled'
    );
    if (!allSettled || errorCount > 0) return;
    const timer = setTimeout(() => setItems([]), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [items, errorCount]);

  useEffect(() => {
    if (!isUploading) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  const headline = isUploading
    ? `${doneCount} von ${items.length} hochgeladen`
    : errorCount > 0
    ? `${errorCount} von ${items.length} fehlgeschlagen`
    : 'Upload abgeschlossen';

  return (
    <UploadQueueContext.Provider
      value={{ enqueue, items, isUploading, liveUsedBytes, uploadedBytes, resetUploadedBytes }}
    >
      {children}

      {/* z-[90]: über der Lightbox (z-70), unter dem Dialog (z-120). */}
      {items.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[90] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[18px] border border-white/70 bg-white shadow-raised backdrop-blur"
        >
          <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{headline}</p>
              {isUploading && (
                <p className="mt-0.5 font-mono text-[11px] text-ink-3">{Math.round(overall * 100)} %</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Details anzeigen' : 'Details ausblenden'}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink"
            >
              <IconChevronDown
                className={`h-[15px] w-[15px] transition-transform ${collapsed ? '' : 'rotate-180'}`}
              />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label={isUploading ? 'Uploads abbrechen und schließen' : 'Schließen'}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink"
            >
              <IconClose className="h-[15px] w-[15px]" />
            </button>
          </div>

          <div className="h-[3px] w-full bg-panel">
            <div
              className={`h-full transition-[width] duration-200 ${
                errorCount > 0 && !isUploading ? 'bg-signal-deep' : 'bg-signal'
              }`}
              style={{ width: `${Math.round(overall * 100)}%` }}
            />
          </div>

          {!collapsed && (
            <ul className="max-h-[260px] divide-y divide-line/60 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{item.name}</p>

                    {item.status === 'error' ? (
                      <p className="mt-0.5 text-[11px] leading-[1.4] text-signal-deep">{item.error}</p>
                    ) : (
                      <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                        {item.status === 'queued' && 'Wartet …'}
                        {item.status === 'uploading' && `${Math.round(item.progress * 100)} % · ${formatBytes(item.size)}`}
                        {item.status === 'processing' && 'Wird verarbeitet …'}
                        {item.status === 'done' && formatBytes(item.size)}
                        {item.status === 'canceled' && 'Abgebrochen'}
                      </p>
                    )}

                    {(item.status === 'uploading' || item.status === 'processing') && (
                      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-panel">
                        <div
                          className={`h-full rounded-full bg-signal transition-[width] duration-150 ${
                            item.status === 'processing' ? 'animate-pulse' : ''
                          }`}
                          style={{ width: `${Math.round(item.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-none">
                    {item.status === 'done' && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/10 text-signal-deep">
                        <IconCheck className="h-[13px] w-[13px]" />
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal-deep/10 text-signal-deep">
                        <IconAlert className="h-[14px] w-[14px]" />
                      </span>
                    )}
                    {item.status === 'canceled' && <span className="font-mono text-[10px] text-ink-3">—</span>}
                    {(item.status === 'queued' || item.status === 'uploading' || item.status === 'processing') && (
                      <button
                        type="button"
                        onClick={() => cancelItem(item.id)}
                        title="Diesen Upload abbrechen"
                        aria-label={`Upload von ${item.name} abbrechen`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-signal-deep"
                      >
                        <IconClose className="h-[13px] w-[13px]" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!collapsed && errorCount > 0 && !isUploading && (
            <div className="flex items-center gap-2 border-t border-line/70 bg-signal-deep/[0.04] px-4 py-2.5 text-[11.5px] text-ink-2">
              <IconRetry className="h-[13px] w-[13px] flex-none text-ink-3" />
              Fehlgeschlagene Dateien bitte erneut auswählen oder hierher ziehen.
            </div>
          )}
        </div>
      )}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error('useUploadQueue muss innerhalb von <UploadQueueProvider> verwendet werden.');
  }
  return ctx;
}
