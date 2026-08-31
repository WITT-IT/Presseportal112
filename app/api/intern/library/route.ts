import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import { normalizeTags } from '@/lib/types';
import {
  formatBytes,
  getStorageStatus,
  storageLimitForTier,
  DEFAULT_STORAGE_TIER,
} from '@/lib/storage';
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

// Systemtoken für alle Zugriffe auf den Speicherzähler.
// storage_used_bytes ist ein Abrechnungswert, den der Server pflegt --
// kein Nutzerinhalt. Fällt auf das Nutzertoken zurück, falls die Variable
// in einer Umgebung nicht gesetzt ist.
function storageToken(userToken: string): string {
  return process.env.DIRECTUS_SERVICE_TOKEN || userToken;
}

// used_in_posts kommt manchmal als roher Text statt als echtes JSON-Array
// zurück (gleiches Problem wie bei "tags" an anderer Stelle im Projekt) --
// ein String wie "[]" hat eine .length von 2, nicht 0, und würde die
// Lösch-Sperre unten fälschlich auslösen.
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

// Rechnet den tatsächlichen Verbrauch aus den ECHTEN Dateigrößen aller
// Originale der Organisation aus.
//
// Nur die Originale (media_library.file) zählen -- Vorschau- und
// Wasserzeichen-Varianten gehen bewusst nicht ins Kontingent.
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

  // Keine Bilder ist ein gültiger Zustand mit dem Ergebnis 0 -- klar zu
  // unterscheiden von "Berechnung fehlgeschlagen" (null).
  if (fileIds.length === 0) return 0;

  // 100 IDs je Abfrage: Directus verkraftet längere _in-Listen, Reverse
  // Proxies quittieren zu lange URLs aber mit 414.
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

  // Ein fehlgeschlagener Teil macht die Summe zu niedrig -- und eine zu
  // niedrige Summe gaukelt freien Speicher vor, den es nicht gibt.
  if (results.some((value) => value === null)) return null;

  return results.reduce<number>((total, value) => total + (value ?? 0), 0);
}

// Speicherstand + Limit.
//
// BEWUSST NUR DIE SPEICHERFELDER:
// Directus lehnt eine Anfrage KOMPLETT mit 403 ab, sobald darin ein
// einziges Feld vorkommt, für das die Policy keine Leseberechtigung hat --
// es lässt das Feld nicht etwa weg. Genau daran ist die frühere
// Sammelabfrage gescheitert (Log: "getOrgStorage(...) Status 403"), sehr
// wahrscheinlich wegen contact_email. Die Kontaktfelder liegen deshalb in
// getOrgNotificationInfo.
//
// computed = berechneter Ist-Wert (null, wenn die Berechnung scheiterte).
// Aufrufer, die den Unterschied kennen müssen, greifen direkt darauf zu --
// usedBytes allein verwischt "berechnet" und "aus dem Zähler geraten".
async function getOrgStorage(
  token: string,
  organizationId: string
): Promise<{
  usedBytes: number;
  computed: number | null;
  storedUsedBytes: number;
  limitBytes: number;
}> {
  const sysToken = storageToken(token);

  const [res, computed] = await Promise.all([
    fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=storage_used_bytes,storage_limit_bytes,storage_tier`,
      { headers: { Authorization: `Bearer ${sysToken}` }, cache: 'no-store' }
    ),
    computeUsedBytes(sysToken, organizationId),
  ]);

  if (!res.ok) {
    console.error(
      `getOrgStorage(${organizationId}): Speicherfelder nicht lesbar (Status ${res.status}). ` +
        `Es gilt ersatzweise das Limit der Standardstufe.`
    );
    return {
      usedBytes: computed ?? 0,
      computed,
      storedUsedBytes: 0,
      // NIEMALS 0 zurückgeben: 0 schaltet die Limitprüfung ab.
      limitBytes: storageLimitForTier(DEFAULT_STORAGE_TIER),
    };
  }

  const { data } = await res.json();
  const rawStored = Number(data?.storage_used_bytes);
  const storedUsedBytes = Number.isFinite(rawStored) ? Math.max(0, rawStored) : 0;

  const tier = data?.storage_tier || DEFAULT_STORAGE_TIER;
  const rawLimit = Number(data?.storage_limit_bytes);

  return {
    usedBytes: computed ?? storedUsedBytes,
    computed,
    storedUsedBytes,
    limitBytes: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : storageLimitForTier(tier),
  };
}

// Kontakt- und Benachrichtigungsfelder -- ausschließlich für die
// Warnmails. Getrennt von getOrgStorage, weil ein Rechteproblem an
// contact_email nur die Mails kosten darf, niemals die Limitprüfung.
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
        `Speicherwarnungen per E-Mail entfallen. Uploads und Limitprüfung sind davon nicht betroffen.`
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

// Prüft nach einem Upload, ob eine der beiden Schwellen (90%/100%) NEU
// überschritten wurde. Die Zeitstempel wirken wie ein Riegel: solange sie
// gesetzt sind, wird nicht erneut verschickt. Beide werden zurückgesetzt,
// sobald der Verbrauch wieder unter die Schwelle fällt.
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
      await sendStorageLimitReachedEmail({
        to: contactEmail,
        organizationName,
        usedBytes,
        limitBytes,
      });
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
    // Mail-Fehler dürfen den Upload selbst nie beeinträchtigen.
    console.error(`Speicherlimit-Benachrichtigung fehlgeschlagen für Organisation ${organizationId}:`, error);
  }
}

// Schreibt einen ABSOLUTEN Verbrauchswert. Gibt den geschriebenen Wert
// zurück, oder null bei Fehlschlag.
//
// Absolut statt additiv: Die Aufrufer kennen den Zielwert bereits genau
// (Upload: Ist-Wert + Dateigröße, Löschen: Ist-Wert - Dateigröße). Die
// frühere Signatur nahm Ausgangswert und Delta entgegen -- damit war beim
// Lesen der Aufrufstelle nie sofort klar, welcher Wert am Ende in der
// Datenbank landet, und genau da hat sich der Fehler versteckt, dass beim
// Löschen ein Delta von 0 auf einen unveränderten Ausgangswert addiert
// wurde. Ein Aufruf, der den Zielwert nennt, kann diesen Fehler nicht
// mehr enthalten.
//
// Der Statuscode wird explizit geprüft: fetch wirft bei 403/400 keinen
// Fehler, sondern resolved normal -- ein reines .catch() hätte einen
// abgelehnten PATCH nie bemerkt.
async function writeOrgStorage(
  token: string,
  organizationId: string,
  newUsedBytes: number,
  limitBytes = 0,
  clearNotificationFlags = false
): Promise<number | null> {
  const value = Math.max(0, Math.round(newUsedBytes));
  const patch: Record<string, unknown> = { storage_used_bytes: value };

  // Beim Sinken des Verbrauchs: sobald der neue Stand wieder unter eine
  // Schwelle fällt, die zugehörige Sperre aufheben -- sonst käme nach
  // einem Aufräumen und erneutem Vollmachen nie wieder eine Warnung.
  if (clearNotificationFlags && limitBytes > 0) {
    const status = getStorageStatus(value, limitBytes);
    if (!status.isAtLimit) patch.storage_limit_reached_notified_at = null;
    if (!status.isNearLimit) patch.storage_warning_sent_at = null;
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${storageToken(token)}`,
        'Content-Type': 'application/json',
      },
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
    url += `&filter[folder][_eq]=${folder}`;
  } else if (!q) {
    // Wurzel-Ansicht: explizit auf "kein Ordner gesetzt" filtern, sonst
    // rutschen Bilder aus jedem Unterordner mit in die Antwort.
    url += `&filter[folder][_null]=true`;
  }
  // Bei aktiver Suche bewusst KEIN Ordner-Filter -- die Suche läuft
  // organisationsweit über alle Ordner hinweg.

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
// Antwort enthält usedBytes: den Stand nach diesem Upload, damit der
// Client den Speicherbalken sofort richtig anzeigt.
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
  // Gegen den BERECHNETEN Ist-Wert prüfen und weiterzählen, nicht gegen
  // den gespeicherten Zähler -- ein klemmender Zähler darf das Kontingent
  // nicht aushebeln.
  let usedBytes = orgStorage.usedBytes;

  for (let i = 0; i < imageCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    if (!file) continue;

    // Limit-Check VOR dem Upload -- verhindert, dass wir erst Bytes zu
    // Directus hochladen und dann feststellen, dass sie nicht mehr ins
    // Kontingent passen.
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

      // Zielwert direkt nennen: aktueller Stand plus diese Datei.
      usedBytes += buffer.length;
      await writeOrgStorage(session.accessToken, user.organization.id, usedBytes);
    } catch (err) {
      console.error(`Upload fehlgeschlagen für "${file.name}":`, err);
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  }

  if (created.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(' | '), usedBytes, limitBytes }, { status: 500 });
  }

  // Schwellen-Check EINMAL nach der ganzen Schleife, nicht pro Datei.
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

  return NextResponse.json({
    ok: true,
    created,
    usedBytes,
    limitBytes,
    errors: errors.length ? errors : undefined,
  });
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

// DELETE /api/intern/library?id=... — nur blockiert, wenn das Bild in
// einem WIRKLICH noch existierenden Beitrag verwendet wird. Verwaiste
// Referenzen werden erkannt und aufgeräumt, statt die Löschung für immer
// zu blockieren.
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

  const originalFileId = typeof data?.file === 'string' && data.file.length > 0 ? data.file : null;

  const fileIds = [
    data?.file,
    data?.file_preview,
    data?.file_preview_watermarked,
    data?.file_download_watermarked,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  // WICHTIG: Ist-Stand und Dateigröße VOR dem Löschen ermitteln.
  //
  // Danach lässt sich beides nicht mehr zuverlässig feststellen: Die Datei
  // ist weg, ihre filesize also nicht mehr abfragbar, und eine
  // Neuberechnung liefert direkt nach dem Löschvorgang oft noch den alten
  // Stand, weil Directus die Löschung asynchron verarbeitet.
  //
  // Genau daran ist die vorherige Fassung gescheitert: Sie hat NACH dem
  // Löschen neu berechnet und das Ergebnis zurückgeschrieben. Lieferte die
  // Berechnung dabei den alten gespeicherten Zähler zurück (Fallback bei
  // fehlgeschlagener Berechnung) oder noch den Stand von vor der Löschung,
  // wurde der unveränderte Wert erneut geschrieben -- der Speicherstand
  // blieb sichtbar stehen.
  const before = await getOrgStorage(session.accessToken, user.organization.id);

  // Nur die Größe des ORIGINALS zählt. Beim Upload geht ebenfalls nur das
  // Original ins Kontingent -- würde man hier alle vier Dateivarianten
  // abziehen, sänke der Zähler mit jedem Zyklus stärker als er gestiegen
  // ist, bis auf 0.
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

  // Zielwert: Stand von vorher minus dieser einen Datei. Reine
  // Differenzrechnung, ohne Neuberechnung und ohne Timing-Abhängigkeit.
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
