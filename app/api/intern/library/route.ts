import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import { normalizeTags } from '@/lib/types';
import { formatBytes, getStorageStatus } from '@/lib/storage';
import { resolvePlan, FAILSAFE_LIMIT_BYTES } from '@/lib/plans';
import { isUuid, isUuidOrNull } from '@/lib/validate';
import { sniffImage, MAX_FILE_SIZE_BYTES } from '@/lib/imageFormat';
import { sendStorageWarningEmail, sendStorageLimitReachedEmail } from '@/lib/email';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storageToken(userToken: string): string {
  return process.env.DIRECTUS_SERVICE_TOKEN || userToken;
}

function folderTagToken(userToken: string): string {
  return process.env.DIRECTUS_SERVICE_TOKEN || userToken;
}

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

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
}

async function getFolderById(
  accessToken: string,
  folderId: string
): Promise<{ id: string; parent_folder: string | null; tags: unknown } | null> {
  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}?fields=id,parent_folder,tags`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'tags')) return null;
  return data ? { id: data.id, parent_folder: data.parent_folder ?? null, tags: data.tags ?? null } : null;
}

async function canAccessFolder(accessToken: string, folderId: string): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}?fields=id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return res.ok;
}

async function readFolderForTagInheritance(
  userToken: string,
  folderId: string
): Promise<{ id: string; parent_folder: string | null; tags: unknown } | null> {
  const fallbackToken = folderTagToken(userToken);
  if (fallbackToken !== userToken) {
    if (!(await canAccessFolder(userToken, folderId))) return null;

    const privileged = await getFolderById(fallbackToken, folderId);
    if (privileged) return privileged;
  }

  return getFolderById(userToken, folderId);
}

async function getEffectiveFolderTags(
  accessToken: string,
  folderId: string | null
): Promise<string[]> {
  if (!folderId) return [];
  const tags: string[] = [];
  let currentId: string | null = folderId;
  let guard = 0;

  while (currentId && guard < 32) {
    guard++;
    const folder = await readFolderForTagInheritance(accessToken, currentId);
    if (!folder) break;
    tags.unshift(...normalizeTags(folder.tags));
    currentId = folder.parent_folder;
  }

  return uniqueTags(tags);
}

async function persistMediaTags(
  mediaId: string,
  tags: string[],
  userToken: string
): Promise<boolean> {
  if (tags.length === 0) return true;

  const tokens = [folderTagToken(userToken)];
  if (tokens[0] !== userToken) tokens.push(userToken);

  for (const token of tokens) {
    const res = await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) continue;

    const verify = await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}?fields=tags`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!verify.ok) continue;

    const { data } = await verify.json();
    const storedTags = normalizeTags(data?.tags);
    if (tags.every((tag) => storedTags.includes(tag))) return true;
  }

  return false;
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

async function computeUsedBytes(token: string, organizationId: string): Promise<number | null> {
  const headers = { Authorization: `Bearer ${token}` };

  const itemsRes = await fetch(
    `${DIRECTUS_URL}/items/media_library?filter[organization][_eq]=${organizationId}&fields=file&limit=-1`,
    { headers, cache: 'no-store' }
  );
  if (!itemsRes.ok) {
    console.error(
      `computeUsedBytes(${organizationId}): media_library laden fehlgeschlagen (Status ${itemsRes.status}).`
    );
    return null;
  }

  const { data } = await itemsRes.json();
  const fileIds = (data as { file: string | null }[])
    .map((row) => row.file)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (fileIds.length === 0) return 0;

  const chunks: string[][] = [];
  for (let i = 0; i < fileIds.length; i += 100) {
    chunks.push(fileIds.slice(i, i + 100));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(
          `${DIRECTUS_URL}/files?aggregate[sum]=filesize&filter[id][_in]=${chunk.join(',')}&limit=-1`,
          { headers, cache: 'no-store' }
        );
        if (!res.ok) return null;
        const body = await res.json();
        const sum = Number(body?.data?.[0]?.sum?.filesize);
        return Number.isFinite(sum) ? sum : 0;
      } catch {
        return null;
      }
    })
  );

  if (results.some((value) => value === null)) return null;
  return results.reduce<number>((total, value) => total + (value ?? 0), 0);
}

async function getOrgStorage(
  token: string,
  organizationId: string
): Promise<{ usedBytes: number; computed: number | null; storedUsedBytes: number; limitBytes: number }> {
  const sysToken = storageToken(token);

  const [res, computed] = await Promise.all([
    fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,plan,storage_tier`, {
      headers: { Authorization: `Bearer ${sysToken}` },
      cache: 'no-store',
    }),
    computeUsedBytes(sysToken, organizationId),
  ]);

  if (!res.ok) {
    console.error(
      `getOrgStorage(${organizationId}): Planfelder nicht lesbar (Status ${res.status}). ` +
        `Es gilt ersatzweise das großzügigste Limit (${FAILSAFE_LIMIT_BYTES} Bytes).`
    );
    return { usedBytes: computed ?? 0, computed, storedUsedBytes: 0, limitBytes: FAILSAFE_LIMIT_BYTES };
  }

  const { data } = await res.json();
  const rawStored = Number(data?.storage_used_bytes);
  const storedUsedBytes = Number.isFinite(rawStored) ? Math.max(0, rawStored) : 0;

  const plan = resolvePlan({ plan: data?.plan, storage_tier: data?.storage_tier });

  return {
    usedBytes: computed ?? storedUsedBytes,
    computed,
    storedUsedBytes,
    limitBytes: plan.storageBytes,
  };
}

async function getOrgNotificationInfo(
  token: string,
  organizationId: string
): Promise<{
  contactEmail: string | null;
  organizationName: string;
  warningSentAt: string | null;
  limitReachedNotifiedAt: string | null;
} | null> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=contact_email,name,storage_warning_sent_at,storage_limit_reached_notified_at`,
    { headers: { Authorization: `Bearer ${storageToken(token)}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    console.warn(
      `getOrgNotificationInfo(${organizationId}): Kontaktfelder nicht lesbar (Status ${res.status}) — ` +
        `Speicherwarnungen per E-Mail entfallen.`
    );
    return null;
  }
  const { data } = await res.json();
  return {
    contactEmail: data?.contact_email || null,
    organizationName: data?.name || '',
    warningSentAt: data?.storage_warning_sent_at || null,
    limitReachedNotifiedAt: data?.storage_limit_reached_notified_at || null,
  };
}

async function maybeSendStorageThresholdEmail(
  token: string,
  organizationId: string,
  organizationName: string,
  contactEmail: string | null,
  usedBytes: number,
  limitBytes: number,
  warningSentAt: string | null,
  limitReachedNotifiedAt: string | null
): Promise<void> {
  if (!contactEmail || limitBytes <= 0) return;

  const status = getStorageStatus(usedBytes, limitBytes);
  const headers = {
    Authorization: `Bearer ${storageToken(token)}`,
    'Content-Type': 'application/json',
  };

  try {
    if (status.isAtLimit && !limitReachedNotifiedAt) {
      await sendStorageLimitReachedEmail({ to: contactEmail, organizationName, usedBytes, limitBytes });
      await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ storage_limit_reached_notified_at: new Date().toISOString() }),
      }).catch(() => {});
    } else if (status.isNearLimit && !status.isAtLimit && !warningSentAt) {
      await sendStorageWarningEmail({
        to: contactEmail,
        organizationName,
        usedBytes,
        limitBytes,
        percentUsed: status.percentUsed,
      });
      await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ storage_warning_sent_at: new Date().toISOString() }),
      }).catch(() => {});
    }
  } catch (error) {
    console.error(`Speicherlimit-Benachrichtigung fehlgeschlagen für Organisation ${organizationId}:`, error);
  }
}

async function writeOrgStorage(
  token: string,
  organizationId: string,
  newUsedBytes: number,
  limitBytes = 0,
  clearNotificationFlags = false
): Promise<number | null> {
  const value = Math.max(0, Math.round(newUsedBytes));
  const patch: Record<string, unknown> = { storage_used_bytes: value };

  if (clearNotificationFlags && limitBytes > 0) {
    const status = getStorageStatus(value, limitBytes);
    if (!status.isAtLimit) patch.storage_limit_reached_notified_at = null;
    if (!status.isNearLimit) patch.storage_warning_sent_at = null;
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${storageToken(token)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `Speicherzähler für Organisation ${organizationId} konnte nicht geschrieben werden ` +
          `(Status ${res.status}): ${body}. Gewollter Wert: ${value} Bytes.`
      );
      return null;
    }
    return value;
  } catch (err) {
    console.error(`Speicherzähler für Organisation ${organizationId} konnte nicht geschrieben werden:`, err);
    return null;
  }
}

// Holt ein Asset aus Directus -- MIT FALLBACK-KETTE.
//
// DAS EIGENTLICHE PROBLEM, DAS HIER GELÖST WIRD:
// Bisher wurde genau eine Anfrage an Directus gestellt (mit
// Verkleinerungs-Parametern), und bei Fehlschlag eine JSON-Fehlermeldung
// zurückgegeben. Eine JSON-Antwort an einer Stelle, an der der Browser ein
// Bild erwartet, ergibt im Frontend ein kaputtes Bild-Symbol -- ohne
// jeden Hinweis, was los ist.
//
// Genau das passiert bei sehr großen Bildern zuverlässig: Directus lehnt
// Transformationen oberhalb einer konfigurierten Maximalgröße ab
// (ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION, Standard 6000 Pixel Kantenlänge).
// Ein 15-MB-Foto aus einer Spiegelreflexkamera liegt regelmäßig darüber.
// Die Datei ist dann einwandfrei gespeichert -- nur die verkleinerte
// Vorschau lässt sich nicht erzeugen.
//
// Die Kette versucht deshalb der Reihe nach:
//   1. die angeforderte Verkleinerung
//   2. eine einfachere Verkleinerung (nur Breite, ohne Qualitätsangabe)
//   3. die Originaldatei, unverändert
//
// Erst wenn auch das Original nicht lieferbar ist, liegt ein echtes
// Problem vor. Ein größeres Bild auszuliefern kostet Bandbreite, ist aber
// in jedem Fall besser als ein kaputtes Bild -- und tritt nur bei den
// wenigen Dateien auf, die oberhalb der Directus-Grenze liegen.
async function fetchAssetWithFallback(
  fileId: string,
  token: string,
  width: string | null,
  quality: string | null
): Promise<{ response: Response; usedFallback: boolean } | null> {
  const headers = { Authorization: `Bearer ${token}` };

  const attempts: (string | undefined)[] = [];
  const primary = [width ? `width=${width}` : null, quality ? `quality=${quality}` : null]
    .filter(Boolean)
    .join('&');
  if (primary) attempts.push(primary);
  if (width && quality) attempts.push(`width=${width}`);
  attempts.push(undefined); // Original, ohne jede Transformation

  for (let i = 0; i < attempts.length; i++) {
    const transform = attempts[i];
    try {
      const res = await fetch(directusAssetUrl(fileId, transform), { headers });
      if (res.ok) {
        return { response: res, usedFallback: i > 0 };
      }
      console.warn(
        `Asset ${fileId}: Versuch ${i + 1}/${attempts.length} fehlgeschlagen (Status ${res.status}, transform="${transform ?? 'original'}").`
      );
    } catch (error) {
      console.warn(`Asset ${fileId}: Versuch ${i + 1} mit Netzwerkfehler:`, error);
    }
  }
  return null;
}

// GET /api/intern/library?q=tag&folder=&limit=48&offset=0
//     /api/intern/library?original=<mediaId>&width=&quality=
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
    if (!isUuid(originalOf)) {
      return NextResponse.json({ error: 'Ungültige Bild-ID.' }, { status: 400 });
    }

    const itemRes = await fetch(`${DIRECTUS_URL}/items/media_library/${originalOf}?fields=id,organization,file`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
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

    // VALIDIERUNG: width und quality wurden bisher ungeprüft aus dem
    // Query-String in die Directus-Asset-URL verkettet -- dieselbe
    // Injection-Fläche wie bei den IDs. Beide dürfen ausschließlich
    // Zahlen in sinnvollen Grenzen sein; alles andere wird verworfen
    // (nicht abgelehnt, sondern ignoriert -- ein unsinniger
    // Breitenparameter soll kein kaputtes Bild erzeugen, sondern
    // schlicht das Original liefern).
    const rawWidth = Number(searchParams.get('width'));
    const rawQuality = Number(searchParams.get('quality'));
    const width =
      Number.isInteger(rawWidth) && rawWidth > 0 && rawWidth <= 4000 ? String(rawWidth) : null;
    const quality =
      Number.isInteger(rawQuality) && rawQuality >= 1 && rawQuality <= 100 ? String(rawQuality) : null;

    const result = await fetchAssetWithFallback(item.file, session.accessToken, width, quality);

    if (!result) {
      console.error(
        `Asset-Proxy endgültig fehlgeschlagen für media_library/${originalOf} (file=${item.file}) -- ` +
          `auch das unveränderte Original war nicht abrufbar.`
      );
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 502 });
    }

    if (result.usedFallback) {
      console.warn(
        `Asset ${item.file}: Verkleinerung nicht möglich, Original wird ausgeliefert. ` +
          `Typische Ursache: Bild überschreitet ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION in Directus.`
      );
    }

    const buffer = await result.response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': result.response.headers.get('content-type') || 'image/jpeg',
        // Kurzes privates Caching statt no-store: Die Bilder ändern sich
        // nicht, und gerade im Fallback-Fall (Originalgröße) spart das
        // spürbar Bandbreite, wenn dasselbe Bild beim Scrollen mehrfach
        // angefragt wird. "private" stellt sicher, dass nur der Browser
        // des jeweiligen Nutzers zwischenspeichert, kein geteilter Proxy.
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const folder = searchParams.get('folder');
  const limit = Math.min(Number(searchParams.get('limit') || 48), 100);
  const offset = Number(searchParams.get('offset') || 0);

  if (folder && !isUuid(folder)) {
    return NextResponse.json({ error: 'Ungültige Ordner-ID.' }, { status: 400 });
  }

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
    url += `&filter[folder][_eq]=${folder}`;
  } else if (!q) {
    url += `&filter[folder][_null]=true`;
  }

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
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const formData = await request.formData();
  const folderId = (formData.get('folder') as string) || null;

  if (folderId && !isUuid(folderId)) {
    return NextResponse.json({ error: 'Ungültige Ordner-ID.' }, { status: 400 });
  }

  const inheritedFolderTags = folderId
    ? await getEffectiveFolderTags(session.accessToken, folderId)
    : [];

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

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `${file.name}: Datei ist zu groß (${formatBytes(file.size)}). Maximal ${formatBytes(MAX_FILE_SIZE_BYTES)} pro Bild.`
      );
      continue;
    }

    if (limitBytes > 0 && usedBytes + file.size > limitBytes) {
      errors.push(
        `${file.name}: Speicherlimit erreicht (${formatBytes(usedBytes)} von ${formatBytes(limitBytes)} belegt).`
      );
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // SERVERSEITIGE FORMATPRÜFUNG an den echten Dateibytes.
      //
      // Der vom Browser gemeldete file.type wird bewusst NICHT mehr
      // verwendet -- er ist weder verlässlich (leer/falsch bei manchen
      // Quellen, was in Directus zu einer Datei ohne verwertbaren
      // Bildtyp führte und damit zu dauerhaft kaputten Vorschauen) noch
      // vertrauenswürdig (frei vom Client wählbar).
      const sniffed = sniffImage(buffer);
      if (!sniffed.ok) {
        if (sniffed.reason === 'unsupported') {
          errors.push(
            `${file.name}: ${sniffed.formatLabel} wird nicht unterstützt. Bitte als JPEG oder PNG exportieren und erneut hochladen.`
          );
        } else {
          errors.push(`${file.name}: Das ist keine gültige Bilddatei.`);
        }
        continue;
      }

      const fileId = await uploadBuffer(session.accessToken, buffer, sniffed.image.mime, file.name);

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
          tags: inheritedFolderTags,
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

      if (inheritedFolderTags.length > 0) {
        const tagsPersisted = await persistMediaTags(itemId, inheritedFolderTags, session.accessToken);
        if (!tagsPersisted) {
          console.error(`Vererbte Tags konnten für "${file.name}" nicht gespeichert werden.`);
          errors.push(`${file.name}: Vererbte Tags konnten nicht gespeichert werden.`);
          continue;
        }
      }

      created.push(itemId);
      usedBytes += buffer.length;
      await writeOrgStorage(session.accessToken, user.organization.id, usedBytes);
    } catch (err) {
      console.error(`Upload fehlgeschlagen für "${file.name}":`, err);
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  }

  if (created.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(' | '), usedBytes, limitBytes }, { status: 400 });
  }

  if (created.length > 0) {
    const notify = await getOrgNotificationInfo(session.accessToken, user.organization.id);
    if (notify) {
      await maybeSendStorageThresholdEmail(
        session.accessToken,
        user.organization.id,
        notify.organizationName,
        notify.contactEmail,
        usedBytes,
        limitBytes,
        notify.warningSentAt,
        notify.limitReachedNotifiedAt
      );
    }
  }

  return NextResponse.json({ ok: true, created, usedBytes, limitBytes, errors: errors.length ? errors : undefined });
}

export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const { id, display_name, folder, tags } = await request.json().catch(() => ({}));

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  if (folder !== undefined && !isUuidOrNull(folder)) {
    return NextResponse.json({ error: 'Ungültige Ordner-ID.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof display_name === 'string') patch.display_name = display_name.trim();
  if (folder !== undefined) patch.folder = folder;
  if (tags !== undefined) {
    if (!Array.isArray(tags) && typeof tags !== 'string') {
      return NextResponse.json({ error: 'Ungültige Tags.' }, { status: 400 });
    }
    patch.tags = uniqueTags(normalizeTags(tags));
  } else if (folder !== undefined) {
    const inheritedTags = await getEffectiveFolderTags(session.accessToken, folder || null);
    const checkRes = await fetch(`${DIRECTUS_URL}/items/media_library/${id}?fields=tags`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (checkRes.ok) {
      const { data } = await checkRes.json();
      patch.tags = uniqueTags([...normalizeTags(data?.tags), ...inheritedTags]);
    } else if (inheritedTags.length > 0) {
      patch.tags = inheritedTags;
    }
  }

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

export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

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
    return NextResponse.json({ error: 'Bild konnte nicht geprüft werden. Bitte erneut versuchen.' }, { status: 502 });
  }

  const { data } = await checkRes.json();
  if (data?.organization !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const rawUsedInPosts = normalizeIdArray(data?.used_in_posts);

  let validUsedInPosts: string[] = [];
  if (rawUsedInPosts.length > 0) {
    const postsRes = await fetch(`${DIRECTUS_URL}/items/posts?filter[id][_in]=${rawUsedInPosts.join(',')}&fields=id`, {
      headers,
    });
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

  const originalFileId = typeof data?.file === 'string' && data.file.length > 0 ? data.file : null;

  const fileIds = [
    data?.file,
    data?.file_preview,
    data?.file_preview_watermarked,
    data?.file_download_watermarked,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  const before = await getOrgStorage(session.accessToken, user.organization.id);

  let freedBytes = 0;
  if (originalFileId) {
    try {
      const sizeRes = await fetch(`${DIRECTUS_URL}/files/${originalFileId}?fields=filesize`, { headers });
      if (sizeRes.ok) {
        const body = await sizeRes.json();
        freedBytes = Number(body?.data?.filesize) || 0;
      } else {
        console.error(
          `DELETE: Dateigröße von ${originalFileId} nicht ermittelbar (Status ${sizeRes.status}) — ` +
            `der Speicherzähler kann für dieses Bild nicht gesenkt werden.`
        );
      }
    } catch (err) {
      console.error(`DELETE: Dateigröße von ${originalFileId} nicht ermittelbar:`, err);
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

  const newUsedBytes = Math.max(0, before.usedBytes - freedBytes);
  await writeOrgStorage(session.accessToken, user.organization.id, newUsedBytes, before.limitBytes, true);

  return NextResponse.json({
    ok: true,
    deletedFiles: fileIds.length,
    freedBytes,
    usedBytes: newUsedBytes,
    limitBytes: before.limitBytes,
  });
}
