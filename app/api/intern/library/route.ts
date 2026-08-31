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
// Vorher wurden hier in EINER Abfrage auch contact_email, name und die
// beiden Benachrichtigungs-Zeitstempel mitgeladen. Directus lehnt aber
// eine Anfrage KOMPLETT mit 403 ab, sobald darin ein einziges Feld
// vorkommt, für das die Policy keine Leseberechtigung hat -- es lässt das
// Feld nicht etwa weg. Genau das ist passiert (Log: "getOrgStorage(...)
// fehlgeschlagen (Status 403)"), sehr wahrscheinlich wegen contact_email.
//
// Die Folge war schlimmer als eine fehlende Anzeige: Bei 403 kam
// limitBytes: 0 zurück, und "limitBytes > 0" ist die Bedingung der
// Limitprüfung beim Upload -- das Kontingent war damit stillschweigend
// außer Kraft. Deshalb sind die Felder jetzt getrennt: Was für Anzeige
// und Limit gebraucht wird, hängt nicht mehr an Feldern, die nur die
// Warnmails betreffen.
async function getOrgStorage(
  token: string,
  organizationId: string
): Promise<{ usedBytes: number; storedUsedBytes: number; limitBytes: number }> {
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
      storedUsedBytes: 0,
      // NIEMALS 0 zurückgeben: 0 schaltet die Limitprüfung ab. Lieber das
      // Limit der Standardstufe annehmen und im Zweifel zu streng sein.
      limitBytes: storageLimitForTier(DEFAULT_STORAGE_TIER),
    };
  }

  const { data } = await res.json();
  const rawStored = Number(data?.storage_used_bytes);
  const storedUsedBytes = Number.isFinite(rawStored) ? Math.max(0, rawStored) : 0;

  const tier = data?.storage_tier || DEFAULT_STORAGE_TIER;
  const rawLimit = Number(data?.storage_limit_bytes);

  return {
    // Berechneter Wert gewinnt -- der gespeicherte Zähler springt nur ein,
    // wenn die Berechnung nicht durchlief.
    usedBytes: computed ?? storedUsedBytes,
    storedUsedBytes,
    limitBytes: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : storageLimitForTier(tier),
  };
}

// Kontakt- und Benachrichtigungsfelder -- ausschließlich für die
// Warnmails. Getrennt von getOrgStorage, weil ein Rechteproblem an
// contact_email nur die Mails kosten darf, niemals die Limitprüfung.
// Liefert null, wenn die Felder nicht lesbar sind; dann entfallen die
// Mails stillschweigend.
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
// überschritten wurde. storage_warning_sent_at /
// storage_limit_reached_notified_at wirken wie ein Riegel: solange sie
// gesetzt sind, wird nicht erneut verschickt. Beide werden zurückgesetzt,
// sobald der Verbrauch wieder unter die Schwelle fällt (adjustOrgStorage).
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

// Schreibt den neuen Verbrauchswert zurück. Gibt den geschriebenen Wert
// zurück, oder null bei Fehlschlag.
//
// Der Statuscode wird explizit geprüft. Vorher stand hier nur ein
// .catch() -- und fetch wirft bei 403/400 keinen Fehler, sondern resolved
// normal. Dieser catch-Block hat also nie ausgelöst, und ein abgelehnter
// PATCH verschwand spurlos.
async function adjustOrgStorage(
  token: string,
  organizationId: string,
  currentUsedBytes: number,
  deltaBytes: number,
  limitBytes = 0
): Promise<number | null> {
  const newValue = Math.max(0, currentUsedBytes + deltaBytes);
  const patch: Record<string, unknown> = { storage_used_bytes: newValue };

  // Beim Löschen (deltaBytes negativ): sobald der neue Stand wieder unter
  // eine Schwelle fällt, die zugehörige Sperre aufheben.
  if (deltaBytes < 0 && limitBytes > 0) {
    const status = getStorageStatus(newValue, limitBytes);
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
          `(Status ${res.status}): ${body}. Gewollter Wert: ${newValue} Bytes.`
      );
      return null;
    }
    return newValue;
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

      // Zähler direkt nach diesem einen erfolgreichen Upload nachführen --
      // usedBytes lokal mitziehen, damit der Limit-Check der nächsten
      // Datei den aktuellen Stand kennt.
      await adjustOrgStorage(session.accessToken, user.organization.id, usedBytes, buffer.length);
      usedBytes += buffer.length;
    } catch (err) {
      console.error(`Upload fehlgeschlagen für "${file.name}":`, err);
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  }

  if (created.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(' | '), usedBytes, limitBytes }, { status: 500 });
  }

  // Schwellen-Check EINMAL nach der ganzen Schleife, nicht pro Datei.
  // Die Kontaktdaten werden erst hier geladen -- sind sie nicht lesbar,
  // entfallen nur die Mails.
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

  // Nur die Größe des ORIGINALS gilt als freigegeben.
  //
  // Vorher wurden alle vier Dateivarianten aufsummiert -- also auch
  // Vorschau und Wasserzeichen-Kopien. Beim Upload zählt aber nur das
  // Original ins Kontingent. Das Löschen senkte den Zähler damit um mehr,
  // als der Upload ihn erhöht hatte, und der Stand lief mit jedem Zyklus
  // weiter nach unten -- bis auf 0, weil adjustOrgStorage nicht negativ
  // werden lässt.
  let freedBytes = 0;
  if (originalFileId) {
    try {
      const sizeRes = await fetch(`${DIRECTUS_URL}/files/${originalFileId}?fields=filesize`, { headers });
      if (sizeRes.ok) {
        const body = await sizeRes.json();
        freedBytes = Number(body?.data?.filesize) || 0;
      }
    } catch {
      freedBytes = 0;
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

  // Neu berechnen statt vom alten Stand abzuziehen: Der Datensatz ist jetzt
  // weg, der berechnete Wert ist bereits der korrekte Endstand -- genauer
  // als jede Differenzrechnung.
  const after = await getOrgStorage(session.accessToken, user.organization.id);
  await adjustOrgStorage(session.accessToken, user.organization.id, after.usedBytes, 0, after.limitBytes);

  return NextResponse.json({
    ok: true,
    deletedFiles: fileIds.length,
    freedBytes,
    usedBytes: after.usedBytes,
    limitBytes: after.limitBytes,
  });
}
