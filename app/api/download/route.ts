import { NextRequest, NextResponse } from 'next/server';
import { readItem } from '@directus/sdk';
import { directus, directusAssetUrl } from '@/lib/directus';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Keine Bild-ID angegeben.' }, { status: 400 });
  }

  let image;
  try {
    image = await directus.request(
      readItem('images', id, {
        fields: ['id', 'title', 'alarm_code', 'file_download', 'is_public'],
      })
    );
  } catch {
    return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });
  }

  if (!image || !image.is_public || !image.file_download) {
    return NextResponse.json({ error: 'Download nicht verfügbar.' }, { status: 404 });
  }

  const assetRes = await fetch(directusAssetUrl(image.file_download));
  if (!assetRes.ok) {
    return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
  }

  const buffer = Buffer.from(await assetRes.arrayBuffer());
  const contentType = assetRes.headers.get('content-type') || 'image/jpeg';
  const baseName =
    (image.title || image.alarm_code || 'foto')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'foto';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="presseportal112-${baseName}.jpg"`,
      'Content-Length': String(buffer.length),
    },
  });
}
