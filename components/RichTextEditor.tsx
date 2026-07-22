'use client';

import { useRef, useEffect } from 'react';

const TOOLS: { label: string; command: string; value?: string; icon: string }[] = [
  { label: 'Fett', command: 'bold', icon: 'ti-bold' },
  { label: 'Kursiv', command: 'italic', icon: 'ti-italic' },
  { label: 'Überschrift', command: 'formatBlock', value: 'h2', icon: 'ti-h-2' },
  { label: 'Absatz', command: 'formatBlock', value: 'p', icon: 'ti-align-left' },
  { label: 'Liste', command: 'insertUnorderedList', icon: 'ti-list' },
  { label: 'Link', command: 'createLink', icon: 'ti-link' },
];

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Inhalt nur beim ersten Rendern setzen -- sonst springt der Cursor beim
  // Tippen ständig an den Anfang, weil React versucht, den DOM-Inhalt bei
  // jedem Tastendruck neu zu synchronisieren.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, cmdValue?: string) {
    ref.current?.focus();
    if (command === 'createLink') {
      const url = window.prompt('Link-Ziel (URL):');
      if (!url) return;
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false, cmdValue);
    }
    onChange(ref.current?.innerHTML ?? '');
  }

  return (
    <div className="overflow-hidden rounded-md border border-line-strong">
      <div className="flex flex-wrap gap-1 border-b border-line-strong bg-panel p-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => exec(tool.command, tool.value)}
            title={tool.label}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-2 transition-colors hover:bg-line hover:text-ink"
          >
            <i className={`ti ${tool.icon} text-[15px]`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        className="prose-article min-h-[180px] px-3.5 py-3 text-[14px] leading-[1.6] outline-none"
        suppressContentEditableWarning
        data-placeholder="Artikeltext hier schreiben …"
      />
    </div>
  );
}
