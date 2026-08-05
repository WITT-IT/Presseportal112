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

async function uploadFileToDirectus(
  token: string,
  file: File,
  filename: string,
  folderId?: string
): Promise<string> {
  // ID selbst vergeben -- Directus akzeptiert eine vorgegebene UUID im
  // FormData-Feld "id". So sind wir unabhängig davon ob Directus 200 oder
  // 204 zurückgibt: die ID steht immer fest.
  const fileId = randomUUID();
  const fd = new FormData();
  fd.append('id', fileId);
  if (folderId) fd.append('folder', folderId);
  fd.append('file', file, filename);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${body}`);
  }
  // 200 oder 204 -- egal, wir kennen die ID bereits.
  return fileId;
}

async function getSystemFolders(
  token: string,
  orgId: string
): Promise<{ publicFolderId: string | null; unsortedFolderId: string | null }> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&fields=id,name,system_role&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { publicFolderId: null, unsortedFolderId: null };
  const { data } = await res.json();
  const rows = data as { id: string; name: string; system_role?: string | null }[];
  const publicFolder = rows.find((r) => r.system_role === 'public') ??
    rows.find((r) => r.name === 'Öffentlich');
  const unsortedFolder = rows.find((r) => r.system_role === 'unsorted') ??
    rows.find((r) => r.name === 'Unsortiert');
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
  });
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

  const headers = {
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
    } else if (unsortedFolderId) {
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
      headers,
      body: JSON.stringify(postBody),
    });

    // Fallback: neue Felder weglassen wenn 403
    if (!postRes.ok) {
      const errText = await postRes.text();
      if (postRes.status === 403 && errText.includes('post_type')) {
        delete postBody.post_type;
        delete postBody.origin_folder_id;
        postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(postBody),
        });
      }
      if (!postRes.ok) {
        const body = await postRes.text();
        throw new Error(`Beitrag anlegen fehlgeschlagen: ${body}`);
      }
    }

    // Fotos sequenziell hochladen -- parallel führt zu 204-Antworten
    for (let i = 0; i < imageCount; i++) {
      const originalFile = formData.get(`original_${i}`) as File | null;
      const previewFile = formData.get(`preview_${i}`) as File | null;
      const downloadFile = formData.get(`download_${i}`) as File | null;
      const caption = (formData.get(`caption_${i}`) as string) || null;
      if (!originalFile || !previewFile || !downloadFile) continue;

      const uid = randomUUID().slice(0, 8);
      const originalId = await uploadFileToDirectus(session.accessToken, originalFile, `${uid}-orig-${originalFile.name}`);
      const previewId = await uploadFileToDirectus(session.accessToken, previewFile, `${uid}-prev-${originalFile.name}.jpg`, PUBLIC_FOLDER_ID);
      const downloadId = await uploadFileToDirectus(session.accessToken, downloadFile, `${uid}-dl-${originalFile.name}.jpg`, PUBLIC_FOLDER_ID);

      await fetch(`${DIRECTUS_URL}/items/images`, {
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
          sort: i,
        }),
      });
    }

    // Ordner-Zuweisung
    if (finalFolderId) {
      await assignToFolder(session.accessToken, finalFolderId, postId);
    }
    if (originFolderId && originFolderId !== finalFolderId) {
      await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId });
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
