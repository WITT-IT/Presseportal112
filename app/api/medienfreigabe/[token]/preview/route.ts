import { NextRequest, NextResponse } from 'next/server';
import { getMediaShareByToken } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import type { Post, PostImage } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const imageId = request.nextUrl.searchParams.get('imageId');
  const mediaId = request.nextUrl.searchParams.get('mediaId');
  if (!imageId && !mediaId) {
    return NextResponse.json({ error: 'Keine Bild-ID angegeben.' }, { status: 400 });
  }

  const share = await getMediaShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: 'Freigabe nicht verfügbar.' }, { status: 404 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Freigabe-Vorschau: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  // fileId ist entweder das Original eines Beitragsfotos (imageId) oder
  // das Original eines direkt angehängten Bibliotheksbilds (mediaId) --
  // media_library.file zeigt genau wie images.file_original direkt auf die
  // Directus-Datei, beide laufen danach durch denselben Asset-Abruf.
  let fileId: string | null = null;

  if (imageId) {
    const image = share.posts
      .flatMap((post: Post) => (post.images ?? []) as PostImage[])
      .find((img: PostImage) => img.id === imageId);
    // Bewusst file_original statt file_public_preview -- Medienfreigaben
    // gehen an bereits autorisierte Empfänger:innen, die brauchen kein
    // Wasserzeichen. Directus verkleinert trotzdem on-the-fly über die
    // width/quality-Parameter, unabhängig von der Originalgröße.
    fileId = image?.file_original ?? null;
  } else if (mediaId) {
    const libraryImage = share.libraryImages.find((img) => img.id === mediaId);
    fileId = libraryImage?.fileOriginal ?? null;
  }

  if (!fileId) {
    return NextResponse.json({ error: 'Foto nicht Teil dieser Freigabe.' }, { status: 404 });
  }

  const assetRes = await fetch(directusAssetUrl(fileId, 'width=600&quality=75'), {
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
