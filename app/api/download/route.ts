import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { readItem, readItems } from '@directus/sdk';
import { directus, directusAssetUrl } from '@/lib/directus';

function sanitizeFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'foto'
  );
}

// Zwei Modi:
//   ?imageId=... -> genau dieses eine Foto (aus der Lightbox heraus)
//   ?id=...      -> ganzer Beitrag: ein Foto direkt, mehrere als ZIP
export async function GET(request: NextRequest) {
  const imageId = request.nextUrl.searchParams.get('imageId');
  const postId = request.nextUrl.searchParams.get('id');

  if (imageId) {
    let image;
    try {
      image = await directus.request(
        readItem('images', imageId, {
          fields: ['id', 'file_download', 'caption', { post: ['id', 'title', 'alarm_code'] }],
        })
      );
    } catch {
      return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 });
    }

    if (!image?.file_download) {
      return NextResponse.json({ error: 'Download nicht verfügbar.' }, { status: 404 });
    }

    const assetRes = await fetch(directusAssetUrl(image.file_download));
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }

    const buffer = Buffer.from(await assetRes.arrayBuffer());
    const post = typeof image.post === 'object' ? image.post : null;
    const baseName = sanitizeFilename(
      image.caption || post?.title || post?.alarm_code || 'foto'
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': assetRes.headers.get('content-type') || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.jpg"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  if (!postId) {
    return NextResponse.json({ error: 'Keine ID angegeben.' }, { status: 400 });
  }

  let post;
  try {
    post = await directus.request(
      readItem('posts', postId, {
        fields: [
          'id',
          'title',
          'alarm_code',
          'event_date',
          'location',
          'is_public',
          { organization: ['name'] },
          { images: ['id', 'file_download', 'caption', 'sort'] },
        ],
      })
    );
  } catch {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }

  if (!post?.is_public) {
    return NextResponse.json({ error: 'Download nicht verfügbar.' }, { status: 404 });
  }

  const images = [...(post.images ?? [])]
    .filter((img: { file_download: string | null }) => img.file_download)
    .sort((a: { sort: number }, b: { sort: number }) => (a.sort ?? 0) - (b.sort ?? 0));

  if (images.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien vorhanden.' }, { status: 404 });
  }

  const baseName = sanitizeFilename(post.title || post.alarm_code || 'beitrag');

  // Einzelnes Foto: direkt ausliefern, kein ZIP -- spart dem Nutzer einen
  // unnötigen Entpack-Schritt.
  if (images.length === 1) {
    const assetRes = await fetch(directusAssetUrl(images[0].file_download));
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = Buffer.from(await assetRes.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': assetRes.headers.get('content-type') || 'image/jpeg',
        'Content-Disposition': `attachment; filename="presseportal112-${baseName}.jpg"`,
        'Content-Length': String(buffer.length),
      },
    });
  }

  const zip = new JSZip();
  const org = typeof post.organization === 'object' ? post.organization?.name : undefined;
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
    const filename = `${String(counter).padStart(2, '0')}_${baseName}.jpg`;
    try {
      const assetRes = await fetch(directusAssetUrl(img.file_download));
      if (assetRes.ok) {
        zip.file(filename, Buffer.from(await assetRes.arrayBuffer()));
      }
    } catch (error) {
      console.error(`Download: Foto ${img.id} konnte nicht geladen werden:`, error);
    }
    captionLines.push(
      filename,
      `  ${img.caption || '(keine Bildunterschrift)'}`,
      `  Quellenangabe: Foto: ${org || 'Presseportal112'} / presseportal112.de`,
      ''
    );
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
