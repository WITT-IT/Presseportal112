import { NextRequest, NextResponse } from 'next/server';
import { readItems } from '@directus/sdk';
import { directus } from '@/lib/directus';

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30); // Obergrenze, siehe download-Route

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await directus.request(
      readItems('images', {
        filter: { id: { _in: ids }, is_public: { _eq: true } },
        fields: ['id', 'title', 'file_public_preview', 'alarm_code', { organization: ['name'] }],
      })
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Pressemappe: Laden der Vorschau fehlgeschlagen:', error);
    return NextResponse.json({ items: [] });
  }
}
