'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogState =
  | { type: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { type: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

type DialogContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setInputValue(options.defaultValue ?? '');
    return new Promise<string | null>((resolve) => {
      setDialog({ type: 'prompt', options, resolve });
    });
  }, []);

  const closeWith = useCallback(
    (value: boolean | string | null) => {
      if (!dialog) return;
      if (dialog.type === 'confirm') {
        dialog.resolve(Boolean(value));
      } else {
        dialog.resolve(value as string | null);
      }
      setDialog(null);
    },
    [dialog]
  );

  // Escape schließt/verwirft immer, Enter bestätigt bei reinen Confirm-Dialogen
  // (bei Prompt übernimmt das eigene Eingabefeld die Enter-Taste).
  //
  // stopImmediatePropagation im Capture-Phase: Solange ein Dialog offen ist,
  // darf keine dahinterliegende Ebene mehr auf Tasten reagieren. Sonst hat
  // Escape im Lösch-Dialog der MediaLightbox gleichzeitig den Dialog verworfen
  // UND die Großansicht geschlossen, und die Pfeiltasten hätten unter dem
  // offenen Dialog weiter durch die Bilder geblättert.
  useEffect(() => {
    if (!dialog) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.stopImmediatePropagation();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Escape') closeWith(dialog?.type === 'confirm' ? false : null);
      if (e.key === 'Enter' && dialog?.type === 'confirm') closeWith(true);
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dialog, closeWith]);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {/* z-[120]: bewusst die höchste Ebene der gesamten Anwendung.
          Vorher lag der Dialog auf z-[60] und damit UNTER der Lightbox
          (z-[70] in MediaLightbox.tsx und PostGallery.tsx) -- der
          Lösch-Dialog aus der Großansicht wurde zwar gerendert, aber vom
          dunklen Lightbox-Overlay verdeckt. Ein Bestätigungsdialog blockiert
          per Definition alles darunter, also gehört er über jede andere
          Overlay-Ebene (Sidebar z-50, Lightbox z-70). Neue Overlays deshalb
          immer unterhalb von 120 einsortieren. */}
      {dialog && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 px-4"
          onClick={() => closeWith(dialog.type === 'confirm' ? false : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-[12px] border border-line-strong bg-white p-6 shadow-2xl"
          >
            <h2 className="mb-2 font-display text-[18px] font-bold">{dialog.options.title}</h2>

            {dialog.options.message && (
              <p className="mb-4 text-[13px] leading-[1.55] text-ink-2">
                {dialog.options.message}
              </p>
            )}

            {dialog.type === 'prompt' && (
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={dialog.options.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    closeWith(inputValue);
                  }
                }}
                className="mb-4 w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink"
              />
            )}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => closeWith(dialog.type === 'confirm' ? false : null)}
                className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                {dialog.options.cancelLabel ?? 'Abbrechen'}
              </button>
              <button
                type="button"
                autoFocus={dialog.type === 'confirm'}
                onClick={() => closeWith(dialog.type === 'confirm' ? true : inputValue)}
                className={`rounded-md px-4 py-2 text-[12.5px] font-semibold text-white transition-colors ${
                  dialog.type === 'confirm' && dialog.options.danger
                    ? 'bg-signal hover:bg-signal-deep'
                    : 'bg-ink hover:bg-black'
                }`}
              >
                {dialog.options.confirmLabel ?? (dialog.type === 'confirm' ? 'Bestätigen' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog muss innerhalb von <DialogProvider> verwendet werden.');
  }
  return ctx;
}
