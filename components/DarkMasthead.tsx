import Image from 'next/image';
import type { ReactNode } from 'react';

export default function DarkMasthead({
  backgroundImageUrl,
  minHeight = 'auto',
  imageHeight,
  children,
}: {
  backgroundImageUrl?: string | null;
  minHeight?: string;
  // Optionale Kappung der Bildhöhe, unabhängig von der Container-Höhe.
  // Ohne Angabe: Bild füllt weiterhin den Container komplett (bisheriges
  // Verhalten für Artikel-/Org-Header, die keine feste Höhe brauchen).
  imageHeight?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-void" style={{ minHeight }}>
      {backgroundImageUrl ? (
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: imageHeight ?? '100%' }}
        >
          <Image
            src={backgroundImageUrl}
            alt=""
            fill
            className="animate-slow-zoom object-cover"
            style={{ filter: 'contrast(1.12) saturate(1.2) brightness(0.92)' }}
            priority
          />
          {/* Geschichteter Verlauf statt eines flachen Tons -- dunkel dort,
              wo der Text sitzt (unten/links), das Bild darf sonst atmen.
              Dazu ein warmer Glut-Unterton statt neutralem Schwarz. */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-void/75 via-void/10 to-void/45" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 25% 105%, rgba(150,45,10,0.38), transparent 60%)',
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 15%, #1c0f09, #08090b 65%)',
          }}
        />
      )}

      <div className="cinematic-grain relative">
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
