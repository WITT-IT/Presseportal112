import Image from 'next/image';
import type { ReactNode } from 'react';

export default function DarkMasthead({
  backgroundImageUrl,
  minHeight = 'auto',
  stripes = true,
  children,
}: {
  backgroundImageUrl?: string | null;
  minHeight?: string;
  stripes?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-void" style={{ minHeight }}>
      {stripes && <div className="hazard-stripe-amber h-[10px] w-full" />}

      {backgroundImageUrl && (
        <div className="absolute inset-0">
          <Image
            src={backgroundImageUrl}
            alt=""
            fill
            className="object-cover opacity-[0.32]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/85 to-void/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-void/70 via-transparent to-void/70" />
        </div>
      )}

      <div className="void-glow relative">
        <div className="relative z-10">{children}</div>
      </div>

      {stripes && <div className="hazard-stripe-signal h-[10px] w-full" />}
    </div>
  );
}
