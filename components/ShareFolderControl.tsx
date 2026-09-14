'use client';

// Reines Auslöse-Symbol -- öffnet das gemeinsame Freigabe-Popup
// (ShareMediaModal) in MediaBrowser. Bewusst KEINE eigene Logik mehr hier:
// vorher hielt diese Komponente ihre eigene Dropdown-/Bestätigungslogik
// und verschwand komplett, sobald noch keine einzige Freigabe existierte
// -- ein Ordner ließ sich dann gar nicht freigeben, bevor nicht vorher
// manuell auf /intern/freigaben eine erste Freigabe angelegt wurde. Das
// neue Popup erlaubt das Anlegen einer Freigabe direkt an Ort und Stelle,
// deshalb wird das Symbol jetzt immer angezeigt.
export default function ShareFolderControl({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Diesen Ordner freigeben"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-2 shadow-sm ring-1 ring-line-strong backdrop-blur transition-colors hover:bg-panel hover:text-ink"
    >
      <i className="ti ti-share text-[13px]" aria-hidden="true" />
    </button>
  );
}
