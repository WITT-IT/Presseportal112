import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { readItems } from '@directus/sdk';
import { directus, directusAssetUrl } from '@/lib/directus';

const MAX_ITEMS = 30; // Schutz vor Missbrauch/riesigen ZIP-Anfragen

function sanitizeFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'foto'
  );
}

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Keine Beiträge ausgewählt.' }, { status: 400 });
  }

  let posts;
  try {
    posts = await directus.request(
      readItems('posts', {
        filter: { id: { _in: ids }, is_public: { _eq: true } },
        fields: [
          'id',
          'title',
          'event_date',
          'alarm_code',
          'location',
          'tags',
          { organization: ['name'] },
          { images: ['id', 'file_download', 'caption', 'sort'] },
        ],
      })
    );
  } catch (error) {
    console.error('Pressemappe: Beiträge konnten nicht geladen werden:', error);
    return NextResponse.json({ error: 'Beiträge konnten nicht geladen werden.' }, { status: 502 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Beiträge gefunden.' }, { status: 404 });
  }

  const zip = new JSZip();
  const captionLines: string[] = [
    'Presseportal112 -- Favoriten',
    `Erstellt am ${new Date().toLocaleString('de-DE')}`,
    `${posts.length} Beitrag/Beiträge`,
    '',
    '----------------------------------------',
    '',
  ];

  let postCounter = 1;
  for (const post of posts) {
    const org = typeof post.organization === 'object' ? post.organization?.name : undefined;
    const baseName = sanitizeFilename(post.title || post.alarm_code || `beitrag-${postCounter}`);
    const images = [...(post.images ?? [])]
      .filter((img: { file_download: string | null }) => img.file_download)
      .sort((a: { sort: number }, b: { sort: number }) => (a.sort ?? 0) - (b.sort ?? 0));

    captionLines.push(
      `## ${post.title || '(ohne Titel)'}`,
      `  Organisation: ${org || '(unbekannt)'}`,
      `  Datum: ${post.event_date || '–'}`,
      `  Alarmcode: ${post.alarm_code || '–'}`,
      `  Ort: ${post.location || '–'}`,
      `  Tags: ${(post.tags || []).join(', ') || '–'}`,
      `  Quellenangabe: Foto: ${org || 'Presseportal112'} / presseportal112.de`,
      ''
    );

    // Bei mehreren Fotos pro Beitrag einen eigenen Ordner im ZIP anlegen --
    // sonst wird die Dateiliste bei größeren Mappen schnell unübersichtlich.
    const folder = images.length > 1 ? `${String(postCounter).padStart(2, '0')}_${baseName}/` : '';

    let imgCounter = 1;
    for (const img of images) {
      const filename = folder
        ? `${folder}${String(imgCounter).padStart(2, '0')}.jpg`
        : `${String(postCounter).padStart(2, '0')}_${baseName}.jpg`;

      try {
        const assetRes = await fetch(directusAssetUrl(img.file_download));
        if (assetRes.ok) {
          zip.file(filename, Buffer.from(await assetRes.arrayBuffer()));
        } else {
          console.warn(`Pressemappe: Datei ${img.file_download} nicht abrufbar (${assetRes.status}).`);
        }
      } catch (error) {
        console.error(`Pressemappe: Fehler beim Laden von ${img.file_download}:`, error);
      }

      captionLines.push(`  ${filename}: ${img.caption || '(keine Bildunterschrift)'}`);
      imgCounter++;
    }

    captionLines.push('');
    postCounter++;
  }

  zip.file('Bildunterschriften.txt', captionLines.join('\n'));
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="presseportal112-pressemappe.zip"',
      'Content-Length': String(buffer.length),
    },
  });
}
