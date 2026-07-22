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
    return NextResponse.json({ error: 'Keine Bilder ausgewählt.' }, { status: 400 });
  }

  let images;
  try {
    images = await directus.request(
      readItems('images', {
        filter: { id: { _in: ids }, is_public: { _eq: true } },
        fields: [
          'id',
          'title',
          'file_download',
          'event_date',
          'alarm_code',
          'location',
          'tags',
          { organization: ['name'] },
        ],
      })
    );
  } catch (error) {
    console.error('Pressemappe: Bilder konnten nicht geladen werden:', error);
    return NextResponse.json({ error: 'Bilder konnten nicht geladen werden.' }, { status: 502 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Bilder gefunden.' }, { status: 404 });
  }

  const zip = new JSZip();
  const captionLines: string[] = [
    'Presseportal112 -- Pressemappe',
    `Erstellt am ${new Date().toLocaleString('de-DE')}`,
    `${images.length} Foto(s)`,
    '',
    '----------------------------------------',
    '',
  ];

  let counter = 1;
  for (const img of images) {
    const org = typeof img.organization === 'object' ? img.organization?.name : undefined;
    const baseName = sanitizeFilename(img.title || img.alarm_code || `foto-${counter}`);
    const filename = `${String(counter).padStart(2, '0')}_${baseName}.jpg`;

    if (img.file_download) {
      try {
        const assetRes = await fetch(directusAssetUrl(img.file_download));
        if (assetRes.ok) {
          const buffer = Buffer.from(await assetRes.arrayBuffer());
          zip.file(filename, buffer);
        } else {
          console.warn(`Pressemappe: Datei ${img.file_download} nicht abrufbar (${assetRes.status}).`);
        }
      } catch (error) {
        console.error(`Pressemappe: Fehler beim Laden von ${img.file_download}:`, error);
      }
    }

    captionLines.push(
      filename,
      `  Titel: ${img.title || '(kein Titel)'}`,
      `  Organisation: ${org || '(unbekannt)'}`,
      `  Datum: ${img.event_date || '–'}`,
      `  Alarmcode: ${img.alarm_code || '–'}`,
      `  Ort: ${img.location || '–'}`,
      `  Tags: ${(img.tags || []).join(', ') || '–'}`,
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
      'Content-Disposition': 'attachment; filename="presseportal112-pressemappe.zip"',
      'Content-Length': String(buffer.length),
    },
  });
}
