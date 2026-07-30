import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { getMediaShareByToken } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';

function sanitizeFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'foto'
  );
}

// Zwei Modi, wie bei der internen Download-Route:
//   ?imageId=... -> genau dieses eine Foto
//   ohne Parameter -> alle Fotos der Freigabe als ZIP
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const imageId = request.nextUrl.searchParams.get('imageId');

  const share = await getMediaShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: 'Freigabe nicht verfügbar.' }, { status: 404 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Freigabe-Download: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const authHeader = { Authorization: `Bearer ${serviceToken}` };

  const allImages = share.posts.flatMap((post) =>
    (post.images ?? []).map((img) => ({
      ...img,
      postTitle: post.title,
      postAlarmCode: post.alarm_code,
    }))
  );

  if (imageId) {
    const image = allImages.find((img) => img.id === imageId);
    if (!image?.file_download) {
      return NextResponse.json({ error: 'Foto nicht Teil dieser Freigabe.' }, { status: 404 });
    }
    const assetRes = await fetch(directusAssetUrl(image.file_download), { headers: authHeader });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const baseName = sanitizeFilename(image.caption || image.postTitle || image.postAlarmCode || 'foto');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': assetRes.headers.get('content-type') || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.jpg"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  const downloadable = allImages.filter((img) => img.file_download);
  if (downloadable.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien vorhanden.' }, { status: 404 });
  }

  const zip = new JSZip();
  for (const [index, image] of downloadable.entries()) {
    const assetRes = await fetch(directusAssetUrl(image.file_download as string), {
      headers: authHeader,
    });
    if (!assetRes.ok) continue;
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const baseName = sanitizeFilename(
      image.caption || image.postTitle || image.postAlarmCode || `foto-${index + 1}`
    );
    zip.file(`${baseName}-${index + 1}.jpg`, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const baseName = sanitizeFilename(share.name || 'bildfreigabe');
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="presseportal112-${baseName}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}
