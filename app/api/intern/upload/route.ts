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

// Datei zu Directus hochladen via raw Buffer -- kein Blob/Stream-Problem
async function uploadBuffer(
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  folderId?: string
): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;

  const parts: Buffer[] = [];

  // id field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`
  ));

  // folder field
  if (folderId) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folderId}\r\n`
    ));
  }

  // file field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${text}`);
  }
  return fileId;
}

// Systemordner per system_role oder Name finden
async function getSystemFolders(
  token: string,
  orgId: string
): Promise<{ publicFolderId: string | null; unsortedFolderId: string | null }> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&fields=id,name,system_role&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { publicFolderId: null, unsortedFolderId: null };
  const { data } = await res.json();
  const rows = data as { id: string; name: string; system_role?: string | null }[];
  const publicFolder = rows.find((r) => r.system_role === 'public') ?? rows.find((r) => r.name === 'Öffentlich');
  const unsortedFolder = rows.find((r) => r.system_role === 'unsorted') ?? rows.find((r) => r.name === 'Unsortiert');
  return {
    publicFolderId: publicFolder?.id ?? null,
    unsortedFolderId: unsortedFolder?.id ?? null,
  };
}

async function assignToFolder(token: string, folderId: string, postId: string): Promise<void> {
  await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders_id: folderId, posts_id: postId }),
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json({ error: 'Deinem Konto ist keine Organisation zugeordnet.' }, { status: 403 });
  }

  // FormData normal parsen -- die File-Objekte lesen wir direkt als Buffer
  const formData = await request.formData();

  const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
  const isStock = postTypeRaw === 'stockfoto';
  const title = isStock ? null : ((formData.get('title') as string) || null);
  const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
  const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
  const location = isStock ? null : ((formData.get('location') as string) || null);
  const tagsRaw = (formData.get('tags') as string) || '';
  const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
  const articleBody = articleBodyRaw.trim()
    ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS)
    : null;
  const makePublic = formData.get('make_public') === 'true';
  const targetFolderIdRaw = (formData.get('folder_id') as string) || '';
  const contentConfirmed = formData.get('content_confirmed') === 'true';
  const imageCount = Number(formData.get('image_count') || 0);

  if (!contentConfirmed) {
    return NextResponse.json({ error: 'Bitte die Bestätigung ankreuzen.' }, { status: 400 });
  }
  if (!isStock && (!title?.trim() || !location?.trim() || !alarmCode?.trim() || !eventDate)) {
    return NextResponse.json({ error: 'Bitte Titel, Ort, Alarmcode und Datum ausfüllen.' }, { status: 400 });
  }
  if (imageCount < 1) {
    return NextResponse.json({ error: 'Mindestens ein Foto nötig.' }, { status: 400 });
  }

  // Alle File-Buffers VOR dem eigentlichen Upload lesen
  // -- so ist kein Stream-Problem möglich da alles im Speicher ist
  type FileEntry = { buffer: Buffer; mimeType: string; name: string };
  const fileEntries: { original: FileEntry; preview: FileEntry; download: FileEntry; caption: string }[] = [];

  for (let i = 0; i < imageCount; i++) {
    const originalFile = formData.get(`original_${i}`) as File | null;
    const previewFile = formData.get(`preview_${i}`) as File | null;
    const downloadFile = formData.get(`download_${i}`) as File | null;
    const caption = (formData.get(`caption_${i}`) as string) || '';

    if (!originalFile || !previewFile || !downloadFile) continue;

    const [origBuf, prevBuf, dlBuf] = await Promise.all([
      originalFile.arrayBuffer().then(Buffer.from),
      previewFile.arrayBuffer().then(Buffer.from),
      downloadFile.arrayBuffer().then(Buffer.from),
    ]);

    fileEntries.push({
      original: { buffer: origBuf, mimeType: originalFile.type || 'image/jpeg', name: originalFile.name },
      preview: { buffer: prevBuf, mimeType: previewFile.type || 'image/jpeg', name: previewFile.name },
      download: { buffer: dlBuf, mimeType: downloadFile.type || 'image/jpeg', name: downloadFile.name },
      caption,
    });
  }

  const authHeaders = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

    const { publicFolderId, unsortedFolderId } = await getSystemFolders(
      session.accessToken,
      user.organization.id
    );

    let finalFolderId: string | null = null;
    let originFolderId: string | null = null;

    if (makePublic && publicFolderId) {
      finalFolderId = publicFolderId;
      if (targetFolderIdRaw) originFolderId = targetFolderIdRaw;
    } else if (targetFolderIdRaw) {
      finalFolderId = targetFolderIdRaw;
    } else {
      finalFolderId = unsortedFolderId;
    }

    const postId = randomUUID();
    const now = new Date().toISOString();

    const postBody: Record<string, unknown> = {
      id: postId,
      organization: user.organization.id,
      title,
      article_body: articleBody,
      event_date: eventDate || null,
      alarm_code: alarmCode || null,
      location: location || null,
      tags,
      is_public: makePublic,
      published_at: makePublic ? now : null,
      post_type: postTypeRaw,
    };
    if (originFolderId) postBody.origin_folder_id = originFolderId;

    let postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(postBody),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      if (postRes.status === 403 && errText.includes('post_type')) {
        delete postBody.post_type;
        delete postBody.origin_folder_id;
        postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(postBody),
        });
      }
      if (!postRes.ok) {
        throw new Error(`Beitrag anlegen fehlgeschlagen: ${await postRes.text()}`);
      }
    }

    // Fotos hochladen -- alle Buffers sind bereits im Speicher
    for (let i = 0; i < fileEntries.length; i++) {
      const { original, preview, download, caption } = fileEntries[i];
      const uid = randomUUID().slice(0, 8);
      const baseName = original.name.replace(/\.[^.]+$/, '');

      const originalId = await uploadBuffer(
        session.accessToken,
        original.buffer,
        original.mimeType,
        `${uid}-orig-${baseName}`
      );
      const previewId = await uploadBuffer(
        session.accessToken,
        preview.buffer,
        preview.mimeType,
        `${uid}-prev-${baseName}.jpg`,
        PUBLIC_FOLDER_ID
      );
      const downloadId = await uploadBuffer(
        session.accessToken,
        download.buffer,
        download.mimeType,
        `${uid}-dl-${baseName}.jpg`,
        PUBLIC_FOLDER_ID
      );

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
          caption: caption || null,
          sort: i,
        }),
      });
    }

    if (finalFolderId) await assignToFolder(session.accessToken, finalFolderId, postId);
    if (originFolderId && originFolderId !== finalFolderId) {
      await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId });
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
