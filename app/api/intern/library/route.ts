import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import { normalizeTags } from '@/lib/types';
import { formatBytes, getStorageStatus } from '@/lib/storage';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// used_in_posts kommt manchmal als roher Text statt als echtes JSON-Array
// zurück (gleiches Problem wie bei "tags" an anderer Stelle im Projekt) --
// ein String wie "[]" hat eine .length von 2, nicht 0, und würde die
// Lösch-Sperre unten fälschlich auslösen. Deshalb immer robust normalisieren.
function normalizeIdArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
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

// Lädt Speicherlimit + aktuellen Verbrauch der Organisation frisch aus
// Directus -- bewusst bei jedem Upload/Löschen neu abgefragt statt
// gecacht, damit der Zähler nie mit einem veralteten Stand weiterrechnet,
// wenn z.B. parallel aus einem anderen Tab gelöscht wurde.
async function getOrgStorage(
  token: string,
  organizationId: string
): Promise<{ usedBytes: number; limitBytes: number }> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,storage_limit_bytes`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );
  if (!res.ok) return { usedBytes: 0, limitBytes: 0 };
  const { data } = await res.json();
  return {
    usedBytes: Number(data?.storage_used_bytes) || 0,
    limitBytes: Number(data?.storage_limit_bytes) || 0,
  };
}

// Schreibt den neuen Verbrauchswert zurück -- additiv über den zuvor
// gelesenen Ist-Stand (delta kann positiv beim Upload oder negativ beim
// Löschen sein), nie negativ werden lassen falls die Buchhaltung mal
// aus dem Ruder läuft (z.B. durch eine Alt-Datei ohne sauberen Zähler-Start).
async function adjustOrgStorage(
  token: string,
  organizationId: string,
  currentUsedBytes: number,
  deltaBytes: number
): Promise<void> {
  const newValue = Math.max(0, currentUsedBytes + deltaBytes);
  await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ storage_used_bytes: newValue }),
  }).catch((err) => {
    console.error(`Speicherverbrauch für Organisation ${organizationId} konnte nicht aktualisiert werden:`, err);
  });
}

// GET /api/intern/library?q=tag&folder=&limit=48&offset=0
//     /api/intern/library?original=<mediaId>
//     /api/intern/library?contents=... (siehe unten -- NICHT hier, das ist
//     die Ordner-Navigation, die läuft über app/api/intern/folders/route.ts)
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
    if (!item.file) {
      return NextResponse.json({ error: 'Diesem Eintrag ist keine Datei zugeordnet.' }, { status: 404 });
    }

    const width = searchParams.get('width');
    const quality = searchParams.get('quality');
    const transform = [width ? `width=${width}` : null, quality ? `quality=${quality}` : null]
      .filter(Boolean)
      .join('&');

    const assetRes = await fetch(directusAssetUrl(item.file, transform || undefined), {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!assetRes.ok) {
      const body = await assetRes.text().catch(() => '');
      console.error(
        `Asset-Proxy fehlgeschlagen (${assetRes.status}) für media_library/${originalOf} (file=${item.file}):`,
        body
      );
      return NextResponse.json(
        { error: `Datei konnte nicht geladen werden (Status ${assetRes.status}).` },
        { status: 502 }
      );
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
    'tags',
    'uploaded_at',
    'used_in_posts',
  ].join(',');

  let url = `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${user.organization.id}&fields=${fields}&sort=-uploaded_at&limit=${limit}&offset=${offset}`;

  if (folder) {
    // Expliziter Ordner angefragt.
    url += `&filter[folder][_eq]=${folder}`;
  } else if (!q) {
    // Weder Ordner noch Suchbegriff angegeben -- das ist die Wurzel-
    // Ansicht. Vorher wurde hier gar kein Filter gesetzt, wodurch Bilder
    // aus JEDEM Unterordner mit in die Wurzel-Antwort gerutscht sind
    // (genau der Bug: ein Bild, das eindeutig in "Test01" liegt, tauchte
    // trotzdem schon in der Wurzel-Ansicht auf). Jetzt explizit auf
    // "kein Ordner gesetzt" filtern.
    url += `&filter[folder][_null]=true`;
  }
  // Bei aktiver Suche (q gesetzt, kein folder) bewusst KEIN Ordner-Filter --
  // die Suche soll organisationsweit über alle Ordner hinweg laufen.

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
    ? data.filter((item: { tags: unknown; display_name: string | null }) => {
        const tagMatch = normalizeTags(item.tags).some((t) => t.toLowerCase().includes(q));
        const nameMatch = (item.display_name || '').toLowerCase().includes(q);
        return tagMatch || nameMatch;
      })
    : data;

  return NextResponse.json({ items: filtered, total: filtered.length });
}

// POST /api/intern/library — Direkt-Upload in die Bibliothek, KEIN Beitrag.
// FormData: folder (optional), image_count, file_0..N
//
// Speicherlimit: vor JEDER Datei wird geprüft, ob genug Kontingent übrig
// ist -- bei Erreichen des Limits mittendrin in einer Mehrfachauswahl
// werden die bereits hochgeladenen Dateien behalten (kein Rollback), die
// verbleibenden brechen mit einer klaren Fehlermeldung ab. Der Zähler
// wird direkt nach jedem einzelnen erfolgreichen Upload aktualisiert,
// nicht erst am Ende -- so bleibt storage_used_bytes auch bei einem
// Abbruch mittendrin korrekt.
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

  const orgStorage = await getOrgStorage(session.accessToken, user.organization.id);
  const limitBytes = orgStorage.limitBytes;
  let usedBytes = orgStorage.usedBytes;

  for (let i = 0; i < imageCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    if (!file) continue;

    // Limit-Check VOR dem eigentlichen Upload -- verhindert, dass wir erst
    // Bytes zu Directus hochladen und dann feststellen, dass sie nicht
    // mehr ins Kontingent passen.
    if (limitBytes > 0 && usedBytes + file.size > limitBytes) {
      errors.push(
        `${file.name}: Speicherlimit erreicht (${formatBytes(usedBytes)} von ${formatBytes(limitBytes)} belegt).`
      );
      continue;
    }

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

      // Zähler direkt nach diesem einen erfolgreichen Upload nachführen --
      // usedBytes lokal mitziehen, damit der Limit-Check der nächsten
      // Datei in dieser Schleife den aktuellen Stand kennt.
      await adjustOrgStorage(session.accessToken, user.organization.id, usedBytes, buffer.length);
      usedBytes += buffer.length;
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
// Rührt storage_used_bytes bewusst nicht an -- Umbenennen/Verschieben
// ändert an der tatsächlichen Bytemenge nichts.
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

// DELETE /api/intern/library?id=... — nur wenn in einem WIRKLICH noch
// existierenden Beitrag verwendet. Prüft nicht nur, ob used_in_posts
// nicht-leer ist, sondern ob die referenzierten Post-IDs überhaupt noch
// existieren -- verwaiste Referenzen werden automatisch erkannt und
// aufgeräumt, statt die Löschung für immer zu blockieren.
//
// Speicherlimit: bevor die Directus-Dateien gelöscht werden, wird ihre
// tatsächliche Größe (filesize) abgefragt -- die einzige verlässliche
// Quelle, um den Verbrauchszähler exakt um die richtige Menge zu senken.
export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const checkRes = await fetch(
    `${DIRECTUS_URL}/items/media_library/${id}?fields=id,organization,used_in_posts,file,file_preview,file_preview_watermarked,file_download_watermarked`,
    { headers }
  );
  if (!checkRes.ok) {
    return NextResponse.json(
      { error: 'Bild konnte nicht geprüft werden. Bitte erneut versuchen.' },
      { status: 502 }
    );
  }

  const { data } = await checkRes.json();
  if (data?.organization !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const rawUsedInPosts = normalizeIdArray(data?.used_in_posts);

  let validUsedInPosts: string[] = [];
  if (rawUsedInPosts.length > 0) {
    const postsRes = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[id][_in]=${rawUsedInPosts.join(',')}&fields=id`,
      { headers }
    );
    if (postsRes.ok) {
      const { data: existingPosts } = await postsRes.json();
      validUsedInPosts = (existingPosts as { id: string }[]).map((p) => p.id);
    } else {
      validUsedInPosts = rawUsedInPosts;
    }
  }

  if (validUsedInPosts.length > 0) {
    return NextResponse.json(
      { error: 'Bild wird in einem Beitrag verwendet und kann nicht gelöscht werden.' },
      { status: 409 }
    );
  }

  if (rawUsedInPosts.length > 0) {
    await fetch(`${DIRECTUS_URL}/items/media_library/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ used_in_posts: [] }),
    }).catch(() => {});
  }

  const fileIds = [
    data?.file,
    data?.file_preview,
    data?.file_preview_watermarked,
    data?.file_download_watermarked,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  // Tatsächliche Dateigrößen vor dem Löschen abfragen -- nur so lässt sich
  // der Verbrauchszähler exakt zurückführen, statt zu raten.
  let totalDeletedBytes = 0;
  if (fileIds.length > 0) {
    const sizeResults = await Promise.allSettled(
      fileIds.map((fileId) =>
        fetch(`${DIRECTUS_URL}/files/${fileId}?fields=filesize`, { headers }).then((res) =>
          res.ok ? res.json() : null
        )
      )
    );
    for (const result of sizeResults) {
      if (result.status === 'fulfilled' && result.value?.data?.filesize) {
        totalDeletedBytes += Number(result.value.data.filesize) || 0;
      }
    }
  }

  await Promise.allSettled(
    fileIds.map((fileId) =>
      fetch(`${DIRECTUS_URL}/files/${fileId}`, { method: 'DELETE', headers }).then((res) => {
        if (!res.ok) {
          console.error(`Datei ${fileId} konnte nicht gelöscht werden (Status ${res.status}).`);
        }
      })
    )
  );

  await fetch(`${DIRECTUS_URL}/items/media_library/${id}`, { method: 'DELETE', headers }).catch(() => {});

  if (totalDeletedBytes > 0) {
    const { usedBytes } = await getOrgStorage(session.accessToken, user.organization.id);
    await adjustOrgStorage(session.accessToken, user.organization.id, usedBytes, -totalDeletedBytes);
  }

  return NextResponse.json({ ok: true, deletedFiles: fileIds.length, freedBytes: totalDeletedBytes });
}
