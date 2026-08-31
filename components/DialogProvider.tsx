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

      {/* z-[120]: bewusst die höchste Ebene der gesamten Anwendung. Ein
          Bestätigungsdialog blockiert per Definition alles darunter, also
          gehört er über jede andere Overlay-Ebene (Sidebar z-50, Lightbox
          z-70, Upload-Panel z-90). Neue Overlays deshalb immer unterhalb
          von 120 einsortieren. */}
      {dialog && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 px-4"
          onClick={() => closeWith(dialog.type === 'confirm' ? false : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[12px] border border-line-strong bg-white p-6 shadow-2xl"
          >
            {/* break-words + overflow-wrap:anywhere sind hier keine Kosmetik:
                Dateinamen sind oft ein einziges Wort ohne Leerzeichen
                ("DSC_2024_Einsatz_Hauptstrasse_Nachloeschen_0042.jpg").
                Ohne Umbruchregel schiebt so ein Wort die Dialogbox
                auseinander und läuft rechts aus dem Kasten heraus.
                break-words allein greift nicht in jedem Browser bei
                Zeichenketten ohne Trennstelle -- anywhere erlaubt den
                Umbruch an JEDER Position und ist die verlässliche Variante. */}
            <h2 className="mb-2 break-words font-display text-[18px] font-bold [overflow-wrap:anywhere]">
              {dialog.options.title}
            </h2>

            {dialog.options.message && (
              // Eigener Scrollbereich: Falls eine Meldung doch mal sehr lang
              // wird (mehrere Dateinamen, Serverfehler im Klartext), wächst
              // der Dialog nicht über den Bildschirm hinaus und schiebt die
              // Buttons nach unten weg -- der Text scrollt stattdessen.
              <p className="mb-4 max-h-[40vh] overflow-y-auto break-words text-[13px] leading-[1.55] text-ink-2 [overflow-wrap:anywhere]">
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

            <div className="flex flex-none justify-end gap-2.5">
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
