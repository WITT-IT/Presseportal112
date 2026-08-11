import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { getMediaShareByToken } from '@/lib/queries';
import { directusAssetUrl } from '@/lib/directus';
import type { Post, PostImage } from '@/lib/types';

function sanitizeFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'foto'
  );
}

function extensionFromContentType(contentType: string | null): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

type ImageWithMeta = PostImage & {
  postTitle: string | null;
  postAlarmCode: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const imageId = request.nextUrl.searchParams.get('imageId');
  const mediaId = request.nextUrl.searchParams.get('mediaId');

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

  const allImages: ImageWithMeta[] = share.posts.flatMap((post: Post) =>
    (post.images ?? []).map((img: PostImage) => ({
      ...img,
      postTitle: post.title,
      postAlarmCode: post.alarm_code,
    }))
  );

  // Einzeldownload eines Beitragsfotos -- unverändert wie bisher.
  if (imageId) {
    const image = allImages.find((img: ImageWithMeta) => img.id === imageId);
    if (!image?.file_original) {
      return NextResponse.json({ error: 'Foto nicht Teil dieser Freigabe.' }, { status: 404 });
    }
    const assetRes = await fetch(directusAssetUrl(image.file_original), { headers: authHeader });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const contentType = assetRes.headers.get('content-type');
    const ext = extensionFromContentType(contentType);
    const baseName = sanitizeFilename(image.caption || image.postTitle || image.postAlarmCode || 'foto');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.${ext}"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  // NEU: Einzeldownload eines direkt angehängten Bibliotheksbilds -- gleiche
  // Logik wie oben, nur aus share.libraryImages statt share.posts.
  if (mediaId) {
    const libraryImage = share.libraryImages.find((img) => img.id === mediaId);
    if (!libraryImage?.fileOriginal) {
      return NextResponse.json({ error: 'Foto nicht Teil dieser Freigabe.' }, { status: 404 });
    }
    const assetRes = await fetch(directusAssetUrl(libraryImage.fileOriginal), { headers: authHeader });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const contentType = assetRes.headers.get('content-type');
    const ext = extensionFromContentType(contentType);
    const baseName = sanitizeFilename(libraryImage.displayName || 'foto');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.${ext}"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  // Sammel-ZIP: Beitragsfotos UND Bibliotheksbilder zusammen -- vorher
  // fehlten die Bibliotheksbilder hier komplett, der "Alle als ZIP"-Button
  // lieferte nur die Beiträge aus.
  const downloadablePosts = allImages.filter((img: ImageWithMeta) => img.file_original);
  const downloadableLibrary = share.libraryImages.filter((img) => img.fileOriginal);

  if (downloadablePosts.length === 0 && downloadableLibrary.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien vorhanden.' }, { status: 404 });
  }

  const zip = new JSZip();
  let index = 0;

  for (const image of downloadablePosts) {
    const assetRes = await fetch(directusAssetUrl(image.file_original as string), {
      headers: authHeader,
    });
    if (!assetRes.ok) continue;
    index++;
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const ext = extensionFromContentType(assetRes.headers.get('content-type'));
    const baseName = sanitizeFilename(
      image.caption || image.postTitle || image.postAlarmCode || `foto-${index}`
    );
    zip.file(`${baseName}-${index}.${ext}`, buffer);
  }

  for (const image of downloadableLibrary) {
    const assetRes = await fetch(directusAssetUrl(image.fileOriginal), {
      headers: authHeader,
    });
    if (!assetRes.ok) continue;
    index++;
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const ext = extensionFromContentType(assetRes.headers.get('content-type'));
    const baseName = sanitizeFilename(image.displayName || `foto-${index}`);
    zip.file(`${baseName}-${index}.${ext}`, buffer);
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
