import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';

function sanitizeFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'foto'
  );
}

// file_original ist -- anders als die frühere watermarkte Variante -- nicht
// zwingend JPEG (Upload erlaubt auch PNG/WebP/GIF unverändert). Endung
// darum aus dem tatsächlichen Content-Type ableiten statt .jpg zu erzwingen.
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

// Läuft komplett über den Service-Token statt der anonymen Public-Policy --
// file_original ist bewusst NIE über die Public-Policy lesbar (Schutz vor
// unautorisiertem Zugriff auf unwatermarkte Originale), wird hier also
// server-seitig geladen und weitergereicht. Die is_public-Prüfung bleibt
// unverändert bestehen: nur was ohnehin veröffentlicht ist, wird
// ausgeliefert -- der Service-Token hebt nur die Feld-Beschränkung auf,
// nicht die Sichtbarkeits-Prüfung selbst, die machen wir weiterhin explizit.
export async function GET(request: NextRequest) {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Download: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const authHeader = { Authorization: `Bearer ${serviceToken}` };

  const imageId = request.nextUrl.searchParams.get('imageId');
  const postId = request.nextUrl.searchParams.get('id');

  // Zwei Modi:
  //   ?imageId=... -> genau dieses eine Foto (aus der Lightbox heraus)
  //   ?id=...      -> ganzer Beitrag: ein Foto direkt, mehrere als ZIP
  if (imageId) {
    const fields = ['id', 'file_original', 'caption', 'post.id', 'post.title', 'post.alarm_code', 'post.is_public'].join(',');
    const imgRes = await fetch(`${DIRECTUS_URL}/items/images/${imageId}?fields=${fields}`, {
      headers: authHeader,
    });
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 });
    }
    const { data: image } = await imgRes.json();

    if (!image?.file_original || !image.post?.is_public) {
      return NextResponse.json({ error: 'Download nicht verfügbar.' }, { status: 404 });
    }

    const assetRes = await fetch(directusAssetUrl(image.file_original), { headers: authHeader });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }

    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const contentType = assetRes.headers.get('content-type');
    const ext = extensionFromContentType(contentType);
    const baseName = sanitizeFilename(
      image.caption || image.post?.title || image.post?.alarm_code || 'foto'
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.${ext}"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  if (!postId) {
    return NextResponse.json({ error: 'Keine ID angegeben.' }, { status: 400 });
  }

  const postFields = [
    'id',
    'title',
    'alarm_code',
    'event_date',
    'location',
    'is_public',
    'organization.name',
    'images.id',
    'images.file_original',
    'images.caption',
    'images.sort',
  ].join(',');
  const postRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}?fields=${postFields}`, {
    headers: authHeader,
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: post } = await postRes.json();

  if (!post?.is_public) {
    return NextResponse.json({ error: 'Download nicht verfügbar.' }, { status: 404 });
  }

  const images = [...(post.images ?? [])]
    .filter((img: { file_original: string | null }) => img.file_original)
    .sort((a: { sort: number }, b: { sort: number }) => (a.sort ?? 0) - (b.sort ?? 0));

  if (images.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien vorhanden.' }, { status: 404 });
  }

  const baseName = sanitizeFilename(post.title || post.alarm_code || 'beitrag');

  // Einzelnes Foto: direkt ausliefern, kein ZIP -- spart dem Nutzer einen
  // unnötigen Entpack-Schritt.
  if (images.length === 1) {
    const assetRes = await fetch(directusAssetUrl(images[0].file_original), {
      headers: authHeader,
    });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const contentType = assetRes.headers.get('content-type');
    const ext = extensionFromContentType(contentType);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.${ext}"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  const zip = new JSZip();
  const org = post.organization?.name as string | undefined;
  const captionLines: string[] = [
    `Presseportal112 -- ${post.title || 'Beitrag'}`,
    `Organisation: ${org || '(unbekannt)'}`,
    `Datum: ${post.event_date || '–'}`,
    `Ort: ${post.location || '–'}`,
    `Alarmcode: ${post.alarm_code || '–'}`,
    '',
    '----------------------------------------',
    '',
  ];

  let counter = 1;
  for (const img of images) {
    try {
      const assetRes = await fetch(directusAssetUrl(img.file_original), { headers: authHeader });
      if (assetRes.ok) {
        const ext = extensionFromContentType(assetRes.headers.get('content-type'));
        const filename = `${String(counter).padStart(2, '0')}_${baseName}.${ext}`;
        zip.file(filename, Buffer.from(await assetRes.arrayBuffer()));
        captionLines.push(
          filename,
          `  ${img.caption || '(keine Bildunterschrift)'}`,
          `  Quellenangabe: Foto: ${org || 'Presseportal112'} / presseportal112.de`,
          ''
        );
      }
    } catch (error) {
      console.error(`Download: Foto ${img.id} konnte nicht geladen werden:`, error);
    }
    counter++;
  }

  zip.file('Bildunterschriften.txt', captionLines.join('\n'));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="presseportal112-${baseName}.zip"`,
      'Content-Length': String(buffer.length),
    },
  });
}
