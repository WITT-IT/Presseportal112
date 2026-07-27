'use client';

import { useRef, useEffect } from 'react';
import { useDialog } from './DialogProvider';

const TOOLS: {
  label: string;
  command: string;
  value?: string;
  className: string;
}[] = [
  { label: 'Fett', command: 'bold', className: 'font-bold' },
  { label: 'Kursiv', command: 'italic', className: 'italic' },
  { label: 'Überschrift', command: 'formatBlock', value: 'h2', className: 'font-bold' },
  { label: 'Absatz', command: 'formatBlock', value: 'p', className: '' },
  { label: '• Liste', command: 'insertUnorderedList', className: '' },
  { label: 'Link', command: 'createLink', className: 'underline' },
];

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { prompt } = useDialog();

  // Inhalt nur beim ersten Rendern setzen -- sonst springt der Cursor beim
  // Tippen ständig an den Anfang, weil React versucht, den DOM-Inhalt bei
  // jedem Tastendruck neu zu synchronisieren.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exec(command: string, cmdValue?: string) {
    ref.current?.focus();

    if (command === 'createLink') {
      // Auswahl sichern, bevor der Dialog den Fokus übernimmt -- sonst geht
      // die markierte Textstelle beim Fokuswechsel zum eigenen Dialog
      // verloren (bei einem echten Browser-Prompt passiert das nicht, bei
      // einem selbstgebauten React-Dialog schon, wenn man's nicht abfängt).
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

      const url = await prompt({
        title: 'Link einfügen',
        message: 'Wohin soll der markierte Text verlinken?',
        placeholder: 'https://…',
      });

      if (!url) return;

      // Fokus und Auswahl wiederherstellen, dann erst den Link setzen.
      ref.current?.focus();
      if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand(command, false, cmdValue);
    }

    onChange(ref.current?.innerHTML ?? '');
  }

  return (
    <div className="overflow-hidden rounded-md border border-line-strong">
      <div className="flex flex-wrap gap-1.5 border-b border-line-strong bg-panel p-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => exec(tool.command, tool.value)}
            title={tool.label}
            className={`rounded border border-line-strong bg-white px-2.5 py-1 text-[12px] text-ink transition-colors hover:border-ink ${tool.className}`}
          >
            {tool.label}
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
