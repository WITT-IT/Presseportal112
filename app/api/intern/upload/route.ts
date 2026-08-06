// v3 - zwei Modi: (a) Veröffentlichen eines bestehenden Medienbibliothek-
// Items (source_media_id gesetzt, neuer Weg über /intern/medien), (b) alter
// sequenzieller Datei-Upload-Flow (unverändert erhalten, falls noch irgendwo
// referenziert -- ungefährlich als toter Pfad).
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

async function uploadBuffer(token: string, buffer: Buffer, mimeType: string, filename: string, folderId?: string): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`));
  if (folderId) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folderId}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(body.length) },
    body,
  });
  if (!res.ok) throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
  return fileId;
}

async function getSystemFolders(token: string, orgId: string) {
  const res = await fetch(`${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&fields=id,name,system_role&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { publicFolderId: null, unsortedFolderId: null };
  const { data } = await res.json();
  const rows = data as { id: string; name: string; system_role?: string | null }[];
  return {
    publicFolderId: rows.find((r) => r.system_role === 'public')?.id ?? rows.find((r) => r.name === 'Öffentlich')?.id ?? null,
    unsortedFolderId: rows.find((r) => r.system_role === 'unsorted')?.id ?? rows.find((r) => r.name === 'Unsortiert')?.id ?? null,
  };
}

async function assignToFolder(token: string, folderId: string, postId: string) {
  await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders_id: folderId, posts_id: postId }),
  }).catch(() => {});
}

// ── Modus A: Veröffentlichen aus der Medienbibliothek ──────────────────────
// Das Bild liegt schon in Directus (media_library.file). Das Original wird
// NICHT erneut hochgeladen -- nur die Wasserzeichen-Varianten (preview_0 /
// download_0), die der Browser per Canvas erzeugt hat. Wurden für dieses
// Bild schon einmal Wasserzeichen erzeugt (use_cached_watermark=true), auch
// die nicht -- dann werden die auf dem media_library-Eintrag gecachten
// Datei-IDs wiederverwendet.
//
// Bewusst KEINE Ordner-Zuweisung (folders_posts) mehr -- der Ort des Bildes
// im Medienbaum ist vom Veröffentlichungs-Status entkoppelt. Betrifft nur
// die alte /intern/ordner-Ansicht und "ganzen Ordner zu einer Freigabe
// hinzufügen", nicht die öffentliche Seite (die filtert direkt auf
// posts.is_public).
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

  const itemRes = await fetch(
    `${DIRECTUS_URL}/items/media_library/${sourceMediaId}?fields=id,organization,file,file_preview_watermarked,file_download_watermarked,used_in_posts`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!itemRes.ok) {
    return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });
  }
  const { data: item } = await itemRes.json();
  if (item.organization !== organizationId) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const originalId: string = item.file;
  let previewId: string;
  let downloadId: string;

  if (useCached && item.file_preview_watermarked && item.file_download_watermarked) {
    previewId = item.file_preview_watermarked;
    downloadId = item.file_download_watermarked;
  } else {
    const previewFile = formData.get('preview_0') as File | null;
    const downloadFile = formData.get('download_0') as File | null;
    if (!previewFile || !downloadFile) {
      return NextResponse.json({ error: 'Wasserzeichen-Varianten fehlen.' }, { status: 400 });
    }
    const [prevBuf, dlBuf] = await Promise.all([
      previewFile.arrayBuffer().then(Buffer.from),
      downloadFile.arrayBuffer().then(Buffer.from),
    ]);
    const uid = randomUUID().slice(0, 8);
    previewId = await uploadBuffer(accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev.jpg`, PUBLIC_FOLDER_ID);
    downloadId = await uploadBuffer(accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl.jpg`, PUBLIC_FOLDER_ID);

    // Für zukünftige Veröffentlichungen desselben Bildes cachen.
    await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ file_preview_watermarked: previewId, file_download_watermarked: downloadId }),
    }).catch(() => {});
  }

  const postId = randomUUID();
  const now = new Date().toISOString();

  const postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
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
  if (!postRes.ok) {
    return NextResponse.json({ error: `Beitrag anlegen fehlgeschlagen: ${await postRes.text()}` }, { status: 500 });
  }

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

  const usedInPosts: string[] = Array.isArray(item.used_in_posts) ? item.used_in_posts : [];
  await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ used_in_posts: [...usedInPosts, postId] }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: postId });
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  let session: { accessToken: string };
  try { session = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 }); }

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const formData = await request.formData();

  // ── Modus A: Veröffentlichen aus der Medienbibliothek ──────────────────
  const sourceMediaId = formData.get('source_media_id') as string | null;
  if (sourceMediaId) {
    try {
      return await handlePublishFromLibrary(formData, session.accessToken, user.organization.id);
    } catch (error) {
      console.error('Veröffentlichen fehlgeschlagen:', error);
      return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
    }
  }

  // ── Modus B: alter sequenzieller Datei-Upload-Flow (unverändert) ───────
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
      // ── Erstes Bild: Beitrag anlegen ──────────────────────────────────
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
      // ── Folgebild: bestehenden Beitrag verwenden ───────────────────────
      if (!existingPostId) return NextResponse.json({ error: 'post_id fehlt.' }, { status: 400 });
      postId = existingPostId;
      finalFolderId = (formData.get('final_folder_id') as string) || null;
      originFolderId = (formData.get('origin_folder_id') as string) || null;
    }

    // ── Bild hochladen ─────────────────────────────────────────────────
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
      const originalId = await uploadBuffer(session.accessToken, origBuf, originalFile.type || 'image/jpeg', `${uid}-orig-${baseName}`);
      const previewId = await uploadBuffer(session.accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev-${baseName}.jpg`, PUBLIC_FOLDER_ID);
      const downloadId = await uploadBuffer(session.accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl-${baseName}.jpg`, PUBLIC_FOLDER_ID);

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

    // ── Letztes Bild: Ordner-Zuweisung ────────────────────────────────
    if (isLast) {
      if (finalFolderId) await assignToFolder(session.accessToken, finalFolderId, postId);
      if (originFolderId && originFolderId !== finalFolderId) await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId, final_folder_id: finalFolderId, origin_folder_id: originFolderId });
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
