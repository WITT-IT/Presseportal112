import { NextRequest, NextResponse } from 'next/server';
import { getMediaShareByToken } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const imageId = request.nextUrl.searchParams.get('imageId');
  if (!imageId) {
    return NextResponse.json({ error: 'Keine Bild-ID angegeben.' }, { status: 400 });
  }

  const share = await getMediaShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: 'Freigabe nicht verfügbar.' }, { status: 404 });
  }

  const image = share.posts.flatMap((post) => post.images ?? []).find((img) => img.id === imageId);
  // Bewusst file_original statt file_public_preview -- Medienfreigaben
  // gehen an bereits autorisierte Empfänger:innen, die brauchen kein
  // Wasserzeichen. Directus verkleinert trotzdem on-the-fly über die
  // width/quality-Parameter, unabhängig von der Originalgröße.
  if (!image?.file_original) {
    return NextResponse.json({ error: 'Foto nicht Teil dieser Freigabe.' }, { status: 404 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Freigabe-Vorschau: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  // Bewusst per Service-Token server-seitig geladen und weitergereicht,
  // statt die Directus-Asset-URL direkt im Browser aufzurufen -- so
  // funktioniert das unabhängig davon, ob der zugehörige Beitrag öffentlich
  // ist oder nicht, ohne die Public-Policy dafür öffnen zu müssen.
  const assetRes = await fetch(directusAssetUrl(image.file_original, 'width=600&quality=75'), {
    headers: { Authorization: `Bearer ${serviceToken}` },
  });
  if (!assetRes.ok) {
    return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
  }

  const buffer = Buffer.from(await assetRes.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': assetRes.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
