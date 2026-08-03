import Breadcrumbs from '@/components/Breadcrumbs';
import PressemappeView from '@/components/PressemappeView';

export const dynamic = 'force-dynamic';

export default function FavoritenPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: 'Übersicht', href: '/intern' }, { label: 'Favoriten' }]} />
      <h1 className="mb-2 font-display text-[28px] font-bold">Favoriten</h1>
      <p className="mb-8 max-w-[560px] text-[13.5px] leading-[1.6] text-ink-2">
        Gesammelte Fotos aus dem Bildarchiv, gebündelt zum Download.
      </p>
      <PressemappeView />
    </div>
  );
}
