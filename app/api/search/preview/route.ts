import { NextRequest, NextResponse } from 'next/server';
import { searchPublicImages } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim() ?? '';
  const gewerkId = searchParams.get('gewerk') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? '5'), 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { images } = await searchPublicImages({ query, gewerkId, page: 1, pageSize: limit });
    const results = images.map((post) => ({
      id: post.id,
      title: post.title,
      alarm_code: post.alarm_code,
      location: post.location,
      event_date: post.event_date,
      images: (post.images ?? [])
        .map((img) => ({ file_public_preview: img.file_public_preview, sort: img.sort }))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .slice(0, 1),
    }));
    return NextResponse.json({ results });
  } catch (error) {
    console.error('search/preview fehlgeschlagen:', error);
    return NextResponse.json({ results: [] });
  }
}
