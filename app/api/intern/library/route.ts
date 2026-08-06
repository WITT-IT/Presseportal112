import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function uploadBuffer(
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`));
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    )
  );
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  if (!res.ok) throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
  return fileId;
}

// GET /api/intern/library?q=tag&folder=&limit=48&offset=0
//     /api/intern/library?original=<mediaId>
export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;

  const originalOf = searchParams.get('original');
  if (originalOf) {
    const itemRes = await fetch(
      `${DIRECTUS_URL}/items/media_library/${originalOf}?fields=id,organization,file`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!itemRes.ok) {
      return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });
    }
    const { data: item } = await itemRes.json();
    if (item.organization !== user.organization.id) {
      return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
    }

    const assetRes = await fetch(directusAssetUrl(item.file), {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!assetRes.ok) {
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }
    const buffer = await assetRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': assetRes.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const folder = searchParams.get('folder');
  const limit = Math.min(Number(searchParams.get('limit') || 48), 100);
  const offset = Number(searchParams.get('offset') || 0);

  const fields = [
    'id',
    'folder',
    'display_name',
    'file',
    'file_preview',
    'file_download',
    'original_filename',
    'tags',
    'uploaded_at',
    'used_in_posts',
  ].join(',');

  let url = `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${user.organization.id}&fields=${fields}&sort=-uploaded_at&limit=${limit}&offset=${offset}`;
  if (folder) url += `&filter[folder][_eq]=${folder}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Bibliothek laden fehlgeschlagen (${res.status}):`, body);
    return NextResponse.json({ error: 'Bibliothek konnte nicht geladen werden.' }, { status: 502 });
  }

  const { data } = await res.json();

  const filtered = q
    ? data.filter((item: { tags: string[] | null; original_filename: string | null }) => {
        const tagMatch = (item.tags || []).some((t: string) => t.toLowerCase().includes(q));
        const nameMatch = (item.original_filename || '').toLowerCase().includes(q);
        return tagMatch || nameMatch;
      })
    : data;

  return NextResponse.json({ items: filtered, total: filtered.length });
}

// POST /api/intern/library — Direkt-Upload in die Bibliothek, KEIN Beitrag.
// FormData: folder (optional), image_count, file_0..N
//
// WICHTIG: jeder einzelne Schritt (Datei-Upload zu Directus, media_library-
// Eintrag anlegen) wird jetzt geprüft und Fehler werden gesammelt statt
// verschluckt -- vorher konnte die Originaldatei erfolgreich in Directus
// landen, während das Anlegen des media_library-Eintrags (z.B. wegen eines
// fehlenden Feldes oder einer Berechtigung) lautlos scheiterte, sodass die
// Datei in Directus sichtbar war, aber nirgends in der Bibliothek auftauchte.
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const formData = await request.formData();
  const folderId = (formData.get('folder') as string) || null;
  const imageCount = Number(formData.get('image_count') || 0);
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
  const created: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < imageCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    if (!file) continue;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileId = await uploadBuffer(session.accessToken, buffer, file.type || 'application/octet-stream', file.name);

      const itemId = randomUUID();
      const itemRes = await fetch(`${DIRECTUS_URL}/items/media_library`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: itemId,
          organization: user.organization.id,
          folder: folderId,
          file: fileId,
          display_name: file.name,
          original_filename: file.name,
          tags: [],
          uploaded_at: new Date().toISOString(),
          used_in_posts: [],
        }),
      });

      if (!itemRes.ok) {
        const body = await itemRes.text().catch(() => '');
        console.error(`media_library-Eintrag anlegen fehlgeschlagen (${itemRes.status}) für "${file.name}":`, body);
        errors.push(`${file.name}: ${body || `Status ${itemRes.status}`}`);
        continue;
      }

      created.push(itemId);
    } catch (err) {
      console.error(`Upload fehlgeschlagen für "${file.name}":`, err);
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  }

  if (created.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(' | ') }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created, errors: errors.length ? errors : undefined });
}

// PATCH /api/intern/library — umbenennen oder verschieben
// Body: { id, display_name?, folder? }  (folder: null = Wurzel)
export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const { id, display_name, folder } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof display_name === 'string') patch.display_name = display_name.trim();
  if (folder !== undefined) patch.folder = folder;

  const res = await fetch(`${DIRECTUS_URL}/items/media_library/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`media_library-Eintrag aktualisieren fehlgeschlagen (${res.status}):`, body);
    return NextResponse.json({ error: body || 'Aktualisieren fehlgeschlagen.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/intern/library?id=... — nur wenn in keinem Beitrag verwendet
export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const checkRes = await fetch(`${DIRECTUS_URL}/items/media_library/${id}?fields=id,used_in_posts,file`, { headers });
  if (checkRes.ok) {
    const { data } = await checkRes.json();
    if ((data?.used_in_posts || []).length > 0) {
      return NextResponse.json(
        { error: 'Bild wird in einem Beitrag verwendet und kann nicht gelöscht werden.' },
        { status: 409 }
      );
    }
    if (data?.file) {
      await fetch(`${DIRECTUS_URL}/files/${data.file}`, { method: 'DELETE', headers }).catch(() => {});
    }
  }
  await fetch(`${DIRECTUS_URL}/items/media_library/${id}`, { method: 'DELETE', headers }).catch(() => {});
  return NextResponse.json({ ok: true });
}
