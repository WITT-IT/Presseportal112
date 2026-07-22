export default function StatStrip({
  totalImages,
  totalOrganizations,
}: {
  totalImages: number;
  totalOrganizations: number;
}) {
  const items = [
    { num: totalImages.toLocaleString('de-DE'), label: 'Freigegebene Pressefotos' },
    { num: totalOrganizations.toLocaleString('de-DE'), label: 'Angeschlossene Organisationen' },
    { num: '< 2 Std.', label: 'Ø Zeit bis zur Freigabe' },
  ];

  return (
    <div
      className="bg-ink px-8 py-12"
      style={{
        backgroundImage:
          'repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 9px, transparent 9px 18px)',
      }}
    >
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[22px] nav:grid-cols-3 nav:gap-[34px]">
        {items.map((item) => (
          <div key={item.label}>
            <div className="font-display text-[36px] font-bold tracking-[-0.01em] text-white">
              {item.num}
            </div>
            <div className="mt-1.5 font-mono text-[11px] uppercase text-[#9BA0A8]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
