import type { Metadata } from 'next';
import PressemappeView from '@/components/PressemappeView';

export const metadata: Metadata = {
  title: 'Favoriten',
  description: 'Deine gesammelten Fotos zum gebündelten Download.',
};

export default function PressemappePage() {
  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[1180px]">
        <h1 className="mb-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em]">
          Favoriten
        </h1>
        <p className="mb-8 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
          Fotos aus dem Bildarchiv sammeln und gebündelt herunterladen — als
          ZIP inklusive automatisch erstellter Bildunterschriften-Liste.
        </p>
        <PressemappeView />
      </div>
    </section>
  );
}
