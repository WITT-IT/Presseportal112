import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import sanitizeHtml from 'sanitize-html';

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
};

const PUBLIC_FOLDER_ID = process.env.DIRECTUS_PUBLIC_FOLDER_ID;

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Lädt einen Buffer als neue, eigenständige Datei in Directus hoch.
// folderId hier meint den DIRECTUS-nativen Datei-Ordner (Berechtigungen für
// die Public-Policy) -- nicht die eigene "folders"-Collection der App.
async function uploadBuffer(
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  folderId?: string | null
): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`));
  if (folderId) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folderId}\r\n`));
  }
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

// Kopiert eine bestehende Directus-Datei serverseitig (Bytes runterladen,
// als komplett neue Datei wieder hochladen). So bekommt der Beitrag eine
// eigenständige Dateireferenz, unabhängig von der Medienbibliothek --
// löscht man später den Beitrag, bleibt das Bibliotheks-Original unberührt,
// und umgekehrt.
async function copyDirectusFile(
  token: string,
  sourceFileId: string,
  filename: string,
  folderId?: string | null
): Promise<string> {
  const assetRes = await fetch(`${DIRECTUS_URL}/assets/${sourceFileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!assetRes.ok) {
    throw new Error(`Quelldatei ${sourceFileId} konnte nicht gelesen werden (${assetRes.status}).`);
  }
  const buffer = Buffer.from(await assetRes.arrayBuffer());
  const mimeType = assetRes.headers.get('content-type') || 'image/jpeg';
  return uploadBuffer(token, buffer, mimeType, filename, folderId);
}

// POST /api/intern/upload
// Veröffentlicht ein vorhandenes Medienbibliothek-Bild als Beitrag.
//
// Erwartet FormData:
//   source_media_id    -- Pflicht, id aus media_library
//   post_type          -- 'einsatz' | 'stockfoto'
//   title, event_date, alarm_code, location  -- Pflicht nur bei 'einsatz'
//   tags               -- Komma-getrennt
//   make_public        -- 'true' | 'false'
//   content_confirmed  -- muss 'true' sein
//   caption
//   entweder:
//     preview_0, download_0         -- frisch erzeugte Wasserzeichen-Varianten (File)
//   oder:
//     use_cached_watermark = 'true' -- Server nutzt die in media_library
//                                      bereits gecachten Varianten
//
// is_public wird direkt am Beitrag gesetzt -- keine Ordner-Verschieberei
// mehr. Öffentlich/Privat ist einzig und allein dieses Feld; die
// öffentliche Website filtert eh direkt danach, nie über Ordner.
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Deinem Konto ist keine Organisation zugeordnet.' }, { status: 403 });
  }

  const formData = await request.formData();

  const sourceMediaId = (formData.get('source_media_id') as string) || '';
  if (!sourceMediaId) {
    return NextResponse.json({ error: 'source_media_id fehlt.' }, { status: 400 });
  }

  const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
  const isStock = postTypeRaw === 'stockfoto';
  const title = isStock ? null : ((formData.get('title') as string) || null);
  const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
  const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
  const location = isStock ? null : ((formData.get('location') as string) || null);
  const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
  const articleBody = articleBodyRaw.trim() ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS) : null;
  const tagsRaw = (formData.get('tags') as string) || '';
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  const makePublic = formData.get('make_public') === 'true';
  const contentConfirmed = formData.get('content_confirmed') === 'true';
  const caption = (formData.get('caption') as string) || null;
  const useCachedWatermark = formData.get('use_cached_watermark') === 'true';

  if (!contentConfirmed) {
    return NextResponse.json({ error: 'Bitte die Bestätigung zum Bildinhalt ankreuzen.' }, { status: 400 });
  }
  if (!isStock && (!title?.trim() || !location?.trim() || !alarmCode?.trim() || !eventDate)) {
    return NextResponse.json({ error: 'Bitte Titel, Ort, Alarmcode und Datum ausfüllen.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Quell-Item aus der Medienbibliothek laden -- inkl. Berechtigungsprüfung.
    const mediaFields = ['id', 'organization', 'file', 'file_preview_watermarked', 'file_download_watermarked'].join(',');
    const mediaRes = await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}?fields=${mediaFields}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!mediaRes.ok) {
      return NextResponse.json({ error: 'Bild in der Bibliothek nicht gefunden.' }, { status: 404 });
    }
    const { data: sourceMedia } = await mediaRes.json();
    if (!sourceMedia || sourceMedia.organization !== user.organization.id) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Bild.' }, { status: 403 });
    }

    // 1) Wasserzeichen-Cache in der Bibliothek sicherstellen -- entweder
    //    vorhanden (useCachedWatermark) oder aus frisch mitgeschickten
    //    Dateien neu anlegen und gleich zurückcachen.
    let cachedPreviewId: string;
    let cachedDownloadId: string;

    if (useCachedWatermark && sourceMedia.file_preview_watermarked && sourceMedia.file_download_watermarked) {
      cachedPreviewId = sourceMedia.file_preview_watermarked;
      cachedDownloadId = sourceMedia.file_download_watermarked;
    } else {
      const previewFile = formData.get('preview_0') as File | null;
      const downloadFile = formData.get('download_0') as File | null;
      if (!previewFile || !downloadFile) {
        return NextResponse.json({ error: 'Wasserzeichen-Dateien fehlen.' }, { status: 400 });
      }
      const [previewBuf, downloadBuf] = await Promise.all([
        previewFile.arrayBuffer().then(Buffer.from),
        downloadFile.arrayBuffer().then(Buffer.from),
      ]);
      const uid = randomUUID().slice(0, 8);
      [cachedPreviewId, cachedDownloadId] = await Promise.all([
        uploadBuffer(session.accessToken, previewBuf, previewFile.type || 'image/jpeg', `${uid}-preview.jpg`, PUBLIC_FOLDER_ID),
        uploadBuffer(session.accessToken, downloadBuf, downloadFile.type || 'image/jpeg', `${uid}-download.jpg`, PUBLIC_FOLDER_ID),
      ]);
      await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          file_preview_watermarked: cachedPreviewId,
          file_download_watermarked: cachedDownloadId,
        }),
      }).catch(() => {});
    }

    // 2) Eigenständige Kopien für den Beitrag -- unabhängig von der
    //    Bibliothek, siehe Kommentar bei copyDirectusFile.
    const uid = randomUUID().slice(0, 8);
    const [originalId, previewId, downloadId] = await Promise.all([
      copyDirectusFile(session.accessToken, sourceMedia.file, `${uid}-original.jpg`),
      copyDirectusFile(session.accessToken, cachedPreviewId, `${uid}-preview.jpg`, PUBLIC_FOLDER_ID),
      copyDirectusFile(session.accessToken, cachedDownloadId, `${uid}-download.jpg`, PUBLIC_FOLDER_ID),
    ]);

    // 3) Beitrag anlegen. is_public ist die einzige Quelle der Wahrheit.
    const postId = randomUUID();
    const now = new Date().toISOString();
    const postBody: Record<string, unknown> = {
      id: postId,
      organization: user.organization.id,
      post_type: postTypeRaw,
      title,
      article_body: articleBody,
      event_date: eventDate || null,
      alarm_code: alarmCode || null,
      location: location || null,
      tags,
      is_public: makePublic,
      published_at: makePublic ? now : null,
    };

    let postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
    if (!postRes.ok) {
      const errText = await postRes.text();
      // Defensiver Fallback für den dokumentierten post_type-Validierungsfall.
      // Sauberer wäre, die Regel in Directus selbst zu entfernen.
      if (postRes.status === 403 && errText.includes('post_type')) {
        delete postBody.post_type;
        postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
      }
      if (!postRes.ok) {
        throw new Error(`Beitrag anlegen fehlgeschlagen: ${await postRes.text()}`);
      }
    }

    // 4) Bild-Datensatz anlegen und mit dem Beitrag verknüpfen.
    const imageRes = await fetch(`${DIRECTUS_URL}/items/images`, {
      method: 'POST',
      headers,
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
    if (!imageRes.ok) {
      throw new Error(`Bilddatensatz anlegen fehlgeschlagen: ${await imageRes.text()}`);
    }

    // 5) Bibliotheks-Eintrag nachführen: used_in_posts erweitern, damit
    //    das Löschen dort korrekt gesperrt bleibt, solange der Beitrag lebt.
    const usedRes = await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}?fields=used_in_posts`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    let usedInPosts: string[] = [];
    if (usedRes.ok) {
      const { data } = await usedRes.json();
      if (Array.isArray(data?.used_in_posts)) {
        usedInPosts = data.used_in_posts;
      } else if (typeof data?.used_in_posts === 'string') {
        try {
          const parsed = JSON.parse(data.used_in_posts);
          if (Array.isArray(parsed)) usedInPosts = parsed;
        } catch {
          /* bleibt leer */
        }
      }
    }
    await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ used_in_posts: [...new Set([...usedInPosts, postId])] }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: postId });
  } catch (error) {
    console.error('Veröffentlichen fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
