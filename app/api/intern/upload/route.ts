// v6 - Fix für die eigentliche Ursache der 403-Fehler beim Anzeigen
// veröffentlichter Bilder: Die "Public"-Rolle in Directus darf nur Dateien
// in einem bestimmten Ordner ("Öffentlich"/system_role="public") lesen.
// Öffentlich sichtbare Wasserzeichen-Dateien (preview_0/download_0) müssen
// dort landen, sonst bekommen anonyme Website-Besucher 403 -- unabhängig
// davon, in welchem Ordner das Original liegt (das ist meist NICHT
// öffentlich, sondern nur für eingeloggte Redaktionsnutzer gedacht).
//
// Der öffentliche Ordner wird jetzt live über getSystemFolders() ermittelt
// (dieselbe Funktion, die Modus B schon nutzt) -- keine feste
// DIRECTUS_PUBLIC_FOLDER_ID mehr nötig, kein Risiko einer veralteten ID.
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import sanitizeHtml from 'sanitize-html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
};

async function uploadBuffer(token: string, buffer: Buffer, mimeType: string, filename: string, folderId?: string | null): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`));
  if (folderId) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folderId}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  let res: Response;
  try {
    res = await fetch(`${DIRECTUS_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(body.length) },
      body,
    });
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Datei-Upload zu Directus:', networkError, { DIRECTUS_URL, filename, size: body.length, folderId });
    throw new Error(`Verbindung zu Directus fehlgeschlagen (Datei-Upload): ${networkError instanceof Error ? networkError.message : String(networkError)}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '(kein Response-Body)');
    console.error('[upload] Directus /files lehnte Upload ab:', { status: res.status, errText, filename, size: body.length, folderId });
    throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${errText}`);
  }
  return fileId;
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

async function assignToFolder(token: string, folderId: string, postId: string) {
  await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders_id: folderId, posts_id: postId }),
  }).catch((error) => console.error('[upload] assignToFolder fehlgeschlagen (ignoriert):', error));
}

// Ermittelt live den öffentlichen und den "Unsortiert"-Ordner der
// Organisation in Directus -- keine feste ID im Code/Env, funktioniert auch
// nach Umbenennung/Neuanlage des Ordners weiter.
async function getSystemFolders(token: string, orgId: string) {
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&fields=id,name,system_role&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error('[upload] getSystemFolders: Directus-Antwort nicht ok:', { status: res.status });
      return { publicFolderId: null, unsortedFolderId: null };
    }
    const { data } = await res.json();
    const rows = data as { id: string; name: string; system_role?: string | null }[];
    return {
      publicFolderId: rows.find((r) => r.system_role === 'public')?.id ?? rows.find((r) => r.name === 'Öffentlich')?.id ?? null,
      unsortedFolderId: rows.find((r) => r.system_role === 'unsorted')?.id ?? rows.find((r) => r.name === 'Unsortiert')?.id ?? null,
    };
  } catch (error) {
    console.error('[upload] getSystemFolders fehlgeschlagen:', error);
    return { publicFolderId: null, unsortedFolderId: null };
  }
}

// ── Modus A: Veröffentlichen aus der Medienbibliothek ──────────────────────
// Original wird direkt verlinkt (item.file) -- keine Kopie, kein Duplikat.
// Wasserzeichen-Varianten sind echte neue Dateien und werden pro Bild
// gecacht (file_preview_watermarked / file_download_watermarked). Sie
// landen -- wenn der Beitrag öffentlich ist -- im öffentlichen
// Directus-Ordner, damit anonyme Website-Besucher sie ohne 403 sehen.
async function handlePublishFromLibrary(
  formData: FormData,
  accessToken: string,
  organizationId: string
) {
  const sourceMediaId = formData.get('source_media_id') as string;
  const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
  const isStock = postTypeRaw === 'stockfoto';
  const title = isStock ? null : ((formData.get('title') as string) || null);
  const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
  const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
  const location = isStock ? null : ((formData.get('location') as string) || null);
  const tagsRaw = (formData.get('tags') as string) || '';
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
  const articleBody = articleBodyRaw.trim() ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS) : null;
  const makePublic = formData.get('make_public') === 'true';
  const caption = (formData.get('caption') as string) || null;
  const useCached = formData.get('use_cached_watermark') === 'true';

  const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  let itemRes: Response;
  try {
    itemRes = await fetch(
      `${DIRECTUS_URL}/items/media_library/${sourceMediaId}?fields=id,organization,file,file_preview_watermarked,file_download_watermarked,used_in_posts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Laden des media_library-Items:', networkError, { sourceMediaId, DIRECTUS_URL });
    return NextResponse.json({ error: 'Verbindung zu Directus fehlgeschlagen. Bitte erneut versuchen.' }, { status: 502 });
  }

  if (!itemRes.ok) {
    const errText = await itemRes.text().catch(() => '');
    console.error('[upload] media_library-Item nicht gefunden:', { sourceMediaId, status: itemRes.status, errText });
    return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });
  }
  const { data: item } = await itemRes.json();
  if (item.organization !== organizationId) {
    console.error('[upload] Berechtigungsfehler:', { sourceMediaId, itemOrg: item.organization, requestOrg: organizationId });
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  // ── Original einfach direkt verlinken -- keine Kopie, kein Duplikat. ────
  const originalId: string = item.file;

  let previewId: string;
  let downloadId: string;

  try {
    if (useCached && item.file_preview_watermarked && item.file_download_watermarked) {
      previewId = item.file_preview_watermarked;
      downloadId = item.file_download_watermarked;
    } else {
      const previewFile = formData.get('preview_0') as File | null;
      const downloadFile = formData.get('download_0') as File | null;
      if (!previewFile || !downloadFile) {
        console.error('[upload] Wasserzeichen-Dateien fehlen im FormData:', {
          hasPreview: !!previewFile,
          hasDownload: !!downloadFile,
          useCached,
        });
        return NextResponse.json({ error: 'Wasserzeichen-Varianten fehlen.' }, { status: 400 });
      }

      // Öffentlicher Ordner nur relevant, wenn der Beitrag auch öffentlich
      // wird -- sonst sehen die Bilder nur eingeloggte Redaktionsnutzer
      // (eigener Bearer-Token, kein Public-Rollen-Problem).
      let targetFolderId: string | null = null;
      if (makePublic) {
        const { publicFolderId } = await getSystemFolders(accessToken, organizationId);
        if (!publicFolderId) {
          console.error('[upload] Kein öffentlicher Ordner für Organisation gefunden -- Bilder landen ohne Ordner und sind für anonyme Besucher ggf. nicht lesbar (403):', { organizationId });
        }
        targetFolderId = publicFolderId;
      }

      const [prevBuf, dlBuf] = await Promise.all([
        previewFile.arrayBuffer().then(Buffer.from),
        downloadFile.arrayBuffer().then(Buffer.from),
      ]);
      const uid = randomUUID().slice(0, 8);
      previewId = await uploadBuffer(accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev.jpg`, targetFolderId);
      downloadId = await uploadBuffer(accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl.jpg`, targetFolderId);

      // Für zukünftige Veröffentlichungen desselben Bildes cachen, damit ein
      // erneuter Klick (oder ein zweiter Beitrag mit demselben Quellbild)
      // diese Dateien wiederverwendet statt sie erneut hochzuladen.
      await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ file_preview_watermarked: previewId, file_download_watermarked: downloadId }),
      }).catch((error) => console.error('[upload] Wasserzeichen-Cache-Update fehlgeschlagen (ignoriert):', error));
    }
  } catch (error) {
    console.error('[upload] Wasserzeichen-Verarbeitung fehlgeschlagen:', error, { sourceMediaId, useCached });
    return NextResponse.json({ error: 'Wasserzeichen konnten nicht hochgeladen werden. Bitte erneut versuchen.' }, { status: 502 });
  }

  const postId = randomUUID();
  const now = new Date().toISOString();

  let postRes: Response;
  try {
    postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: postId,
        organization: organizationId,
        post_type: postTypeRaw,
        title,
        article_body: articleBody,
        event_date: eventDate || null,
        alarm_code: alarmCode || null,
        location: location || null,
        tags,
        is_public: makePublic,
        published_at: makePublic ? now : null,
      }),
    });
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Anlegen des Beitrags:', networkError);
    return NextResponse.json({ error: 'Verbindung zu Directus fehlgeschlagen. Bitte erneut versuchen.' }, { status: 502 });
  }

  if (!postRes.ok) {
    const errText = await postRes.text().catch(() => '');
    console.error('[upload] Beitrag anlegen fehlgeschlagen:', { status: postRes.status, errText, postId, postTypeRaw, alarmCode, tags });
    return NextResponse.json({ error: `Beitrag anlegen fehlgeschlagen: ${errText}` }, { status: 500 });
  }

  try {
    await fetch(`${DIRECTUS_URL}/items/images`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: randomUUID(),
        post: postId,
        file_original: originalId,
        file_public_preview: makePublic ? previewId : null,
        file_download: makePublic ? downloadId : null,
        file_public_preview_watermarked: previewId,
        file_download_watermarked: downloadId,
        no_watermark: false,
        caption,
        sort: 0,
      }),
    });
  } catch (error) {
    console.error('[upload] images-Eintrag anlegen fehlgeschlagen:', error, { postId, originalId, previewId, downloadId });
  }

  const usedInPosts: string[] = normalizeIdArray(item.used_in_posts);
  await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ used_in_posts: [...usedInPosts, postId] }),
  }).catch((error) => console.error('[upload] used_in_posts-Update fehlgeschlagen (ignoriert):', error));

  return NextResponse.json({ ok: true, id: postId });
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch (error) {
    console.error('[upload] Session-Cookie ungültig:', error);
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser(session.accessToken);
  } catch (error) {
    console.error('[upload] getCurrentUser fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Anmeldung konnte nicht überprüft werden. Bitte neu einloggen.' }, { status: 401 });
  }
  if (!user?.organization?.id) {
    console.error('[upload] Kein organization.id am User:', { userId: (user as { id?: string } | null)?.id });
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error('[upload] formData()-Parsing fehlgeschlagen:', error, {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
    });
    return NextResponse.json(
      { error: 'Upload-Daten konnten nicht verarbeitet werden. Möglicherweise ist die Datei zu groß.' },
      { status: 413 }
    );
  }

  const sourceMediaId = formData.get('source_media_id') as string | null;
  if (sourceMediaId) {
    try {
      return await handlePublishFromLibrary(formData, session.accessToken, user.organization.id);
    } catch (error) {
      console.error('[upload] Veröffentlichen fehlgeschlagen (unerwartet):', error);
      return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
    }
  }

  // ── Modus B: alter sequenzieller Datei-Upload-Flow (unverändert, toter Pfad) ──
  const imageIndex = Number(formData.get('image_index') ?? 0);
  const isLast = formData.get('is_last') === 'true';
  const existingPostId = (formData.get('post_id') as string) || null;
  const makePublic = formData.get('make_public') === 'true';
  const sort = Number(formData.get('sort') ?? imageIndex);

  const authHeaders = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };

  try {
    let postId: string;
    let finalFolderId: string | null = null;
    let originFolderId: string | null = null;

    if (imageIndex === 0) {
      const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
      const isStock = postTypeRaw === 'stockfoto';
      const title = isStock ? null : ((formData.get('title') as string) || null);
      const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
      const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
      const location = isStock ? null : ((formData.get('location') as string) || null);
      const tagsRaw = (formData.get('tags') as string) || '';
      const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
      const articleBody = articleBodyRaw.trim() ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS) : null;
      const targetFolderIdRaw = (formData.get('folder_id') as string) || '';
      const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

      const { publicFolderId, unsortedFolderId } = await getSystemFolders(session.accessToken, user.organization.id);

      if (makePublic && publicFolderId) {
        finalFolderId = publicFolderId;
        if (targetFolderIdRaw) originFolderId = targetFolderIdRaw;
      } else if (targetFolderIdRaw) {
        finalFolderId = targetFolderIdRaw;
      } else {
        finalFolderId = unsortedFolderId;
      }

      postId = randomUUID();
      const now = new Date().toISOString();
      const postBody: Record<string, unknown> = {
        id: postId, organization: user.organization.id, title,
        article_body: articleBody, event_date: eventDate || null,
        alarm_code: alarmCode || null, location: location || null,
        tags, is_public: makePublic, published_at: makePublic ? now : null,
        post_type: postTypeRaw,
      };
      if (originFolderId) postBody.origin_folder_id = originFolderId;

      let postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers: authHeaders, body: JSON.stringify(postBody) });
      if (!postRes.ok) {
        const errText = await postRes.text();
        if (postRes.status === 403 && errText.includes('post_type')) {
          delete postBody.post_type; delete postBody.origin_folder_id;
          postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers: authHeaders, body: JSON.stringify(postBody) });
        }
        if (!postRes.ok) throw new Error(`Beitrag anlegen fehlgeschlagen: ${await postRes.text()}`);
      }
    } else {
      if (!existingPostId) return NextResponse.json({ error: 'post_id fehlt.' }, { status: 400 });
      postId = existingPostId;
      finalFolderId = (formData.get('final_folder_id') as string) || null;
      originFolderId = (formData.get('origin_folder_id') as string) || null;
    }

    const originalFile = formData.get('original_0') as File | null;
    const previewFile = formData.get('preview_0') as File | null;
    const downloadFile = formData.get('download_0') as File | null;
    const caption = (formData.get('caption_0') as string) || null;

    if (originalFile && previewFile && downloadFile) {
      const [origBuf, prevBuf, dlBuf] = await Promise.all([
        originalFile.arrayBuffer().then(Buffer.from),
        previewFile.arrayBuffer().then(Buffer.from),
        downloadFile.arrayBuffer().then(Buffer.from),
      ]);
      const uid = randomUUID().slice(0, 8);
      const baseName = originalFile.name.replace(/\.[^.]+$/, '');
      const originalId = await uploadBuffer(session.accessToken, origBuf, originalFile.type || 'image/jpeg', `${uid}-orig-${baseName}`, finalFolderId);
      const previewId = await uploadBuffer(session.accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev-${baseName}.jpg`, finalFolderId);
      const downloadId = await uploadBuffer(session.accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl-${baseName}.jpg`, finalFolderId);

      await fetch(`${DIRECTUS_URL}/items/images`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          id: randomUUID(), post: postId,
          file_original: originalId,
          file_public_preview: makePublic ? previewId : null,
          file_download: makePublic ? downloadId : null,
          file_public_preview_watermarked: previewId,
          file_download_watermarked: downloadId,
          no_watermark: false, caption: caption || null, sort,
        }),
      });
    }

    if (isLast) {
      if (finalFolderId) await assignToFolder(session.accessToken, finalFolderId, postId);
      if (originFolderId && originFolderId !== finalFolderId) await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId, final_folder_id: finalFolderId, origin_folder_id: originFolderId });
  } catch (error) {
    console.error('[upload] Upload fehlgeschlagen (Modus B):', error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
