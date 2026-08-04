import Image from 'next/image';
import type { ReactNode } from 'react';

export default function DarkMasthead({
  backgroundImageUrl,
  // Default jetzt "100dvh" statt "auto" -- gilt für JEDE Stelle, die
  // DarkMasthead verwendet (Hero, Organisationsprofil, Artikelseite):
  // der Container ist nie kürzer als eine Bildschirmhöhe, egal auf
  // welchem Gerät. "dvh" statt "vh", weil das auf mobilen Browsern
  // korrekt auf ein-/ausblendende Adressleisten reagiert.
  minHeight = '100dvh',
  children,
}: {
  backgroundImageUrl?: string | null;
  minHeight?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-void" style={{ minHeight }}>
      {backgroundImageUrl ? (
        // Bild füllt den Container immer zu 100% -- kein festes Cap mehr.
        // Da der Container selbst nie kürzer als eine Bildschirmhöhe ist
        // (siehe minHeight oben), kann die Bild-Unterkante die Display-
        // Unterkante nie unterschreiten. Wächst der Container durch viel
        // Inhalt (z. B. gestapeltes Formular auf Mobile) über eine
        // Bildschirmhöhe hinaus, wächst das Bild automatisch mit -- kein
        // Abriss, kein Void-Loch unter dem Inhalt mehr.
        <div className="absolute inset-0">
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
