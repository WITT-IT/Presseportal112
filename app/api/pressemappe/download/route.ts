import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';

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

// file_original ist nicht zwingend JPEG -- Endung aus dem tatsächlichen
// Content-Type ableiten statt .jpg zu erzwingen.
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
// file_original ist bewusst NIE über die Public-Policy lesbar, wird hier
// server-seitig geladen und weitergereicht. Die is_public-Prüfung bleibt
// im Filter unverändert bestehen.
export async function GET(request: NextRequest) {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Favoriten-Download: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const authHeader = { Authorization: `Bearer ${serviceToken}` };

  const idsParam = request.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Keine Beiträge ausgewählt.' }, { status: 400 });
  }

  const fields = [
    'id',
    'title',
    'event_date',
    'alarm_code',
    'location',
    'tags',
    'organization.name',
    'images.id',
    'images.file_original',
    'images.caption',
    'images.sort',
  ].join(',');

  let posts: {
    id: string;
    title: string | null;
    event_date: string | null;
    alarm_code: string | null;
    location: string | null;
    tags: string[] | null;
    organization: { name: string } | null;
    images: { id: string; file_original: string | null; caption: string | null; sort: number }[];
  }[];

  try {
    const idsFilter = ids.map((id) => `filter[id][_in][]=${encodeURIComponent(id)}`).join('&');
    const res = await fetch(
      `${DIRECTUS_URL}/items/posts?${idsFilter}&filter[is_public][_eq]=true&fields=${fields}`,
      { headers: authHeader }
    );
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
    const { data } = await res.json();
    posts = data;
  } catch (error) {
    console.error('Favoriten: Beiträge konnten nicht geladen werden:', error);
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
    const org = post.organization?.name;
    const baseName = sanitizeFilename(post.title || post.alarm_code || `beitrag-${postCounter}`);
    const images = [...(post.images ?? [])]
      .filter((img) => img.file_original)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

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
      try {
        const assetRes = await fetch(directusAssetUrl(img.file_original as string), {
          headers: authHeader,
        });
        if (assetRes.ok) {
          const ext = extensionFromContentType(assetRes.headers.get('content-type'));
          const filename = folder
            ? `${folder}${String(imgCounter).padStart(2, '0')}.${ext}`
            : `${String(postCounter).padStart(2, '0')}_${baseName}.${ext}`;
          zip.file(filename, Buffer.from(await assetRes.arrayBuffer()));
          captionLines.push(`  ${filename}: ${img.caption || '(keine Bildunterschrift)'}`);
        } else {
          console.warn(`Favoriten: Datei ${img.file_original} nicht abrufbar (${assetRes.status}).`);
        }
      } catch (error) {
        console.error(`Favoriten: Fehler beim Laden von ${img.file_original}:`, error);
      }
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
      'Content-Disposition': 'attachment; filename="presseportal112-favoriten.zip"',
      'Content-Length': String(buffer.length),
    },
  });
}
