export default function DateLine() {
  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-ink text-[#B7BAC0]">
      <div className="mx-auto flex h-[34px] max-w-[1180px] items-center justify-between px-8 font-mono text-[11px]">
        <span>{today}</span>
        <span className="flex items-center gap-2 text-[#DADCE0]">
          <span className="relative h-1.5 w-1.5 rounded-full bg-signal">
            <span className="absolute -inset-1 animate-live-pulse rounded-full border border-signal" />
          </span>
          Live-Ticker aktiv
        </span>
      </div>
    </div>
  );
}
