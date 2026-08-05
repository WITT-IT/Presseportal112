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

// Datei zu Directus hochladen. ID selbst vergeben damit wir unabhängig
// von der Directus-Antwort (200 oder 204) sind.
async function uploadFileToDirectus(
  token: string,
  blob: Blob,
  filename: string,
  folderId?: string
): Promise<string> {
  const fileId = randomUUID();
  // Buffer aus arrayBuffer -- verhindert "Body already read" bei Node.js FormData
  const buffer = Buffer.from(await blob.arrayBuffer());
  const freshBlob = new Blob([buffer], { type: blob.type || 'application/octet-stream' });
  const fd = new FormData();
  fd.append('id', fileId);
  if (folderId) fd.append('folder', folderId);
  fd.append('file', freshBlob, filename);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${body}`);
  }
  return fileId;
}

// Systemordner der Org per system_role oder Name finden.
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
  const publicFolder =
    rows.find((r) => r.system_role === 'public') ?? rows.find((r) => r.name === 'Öffentlich');
  const unsortedFolder =
    rows.find((r) => r.system_role === 'unsorted') ?? rows.find((r) => r.name === 'Unsortiert');
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
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
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
    return NextResponse.json(
      { error: 'Bitte die Bestätigung ankreuzen.' },
      { status: 400 }
    );
  }
  if (!isStock && (!title?.trim() || !location?.trim() || !alarmCode?.trim() || !eventDate)) {
    return NextResponse.json(
      { error: 'Bitte Titel, Ort, Alarmcode und Datum ausfüllen.' },
      { status: 400 }
    );
  }
  if (imageCount < 1) {
    return NextResponse.json({ error: 'Mindestens ein Foto nötig.' }, { status: 400 });
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

    // Zielordner bestimmen:
    // makePublic=true  → Öffentlich-Ordner (Pflicht)
    // expliziter Ordner gewählt → dieser Ordner
    // sonst → Unsortiert (immer als Fallback)
    let finalFolderId: string | null = null;
    let originFolderId: string | null = null;

    if (makePublic && publicFolderId) {
      finalFolderId = publicFolderId;
      // Falls ein manueller Ordner gewählt war, als Ursprung merken
      if (targetFolderIdRaw) originFolderId = targetFolderIdRaw;
    } else if (targetFolderIdRaw) {
      finalFolderId = targetFolderIdRaw;
    } else {
      // Kein Ordner gewählt → immer Unsortiert
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

    // Beitrag anlegen — Fallback ohne neue Felder wenn 403
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

    // Fotos sequenziell hochladen.
    // WICHTIG: File-Objekte aus dem Browser können nur einmal gelesen werden.
    // Das UploadStudio sendet original, preview und download bereits als
    // separate Blobs — wir lesen sie hier nur noch einmal via formData.get().
    for (let i = 0; i < imageCount; i++) {
      const originalBlob = formData.get(`original_${i}`) as File | null;
      const previewBlob = formData.get(`preview_${i}`) as File | null;
      const downloadBlob = formData.get(`download_${i}`) as File | null;
      const caption = (formData.get(`caption_${i}`) as string) || null;

      if (!originalBlob || !previewBlob || !downloadBlob) continue;

      const uid = randomUUID().slice(0, 8);
      const baseName = originalBlob.name.replace(/\.[^.]+$/, '');

      // Node.js FormData File-Objekte teilen intern denselben Stream --
      // jeden via arrayBuffer() klonen bevor er an Directus gesendet wird.
      const [origBuf, prevBuf, dlBuf] = await Promise.all([
        originalBlob.arrayBuffer(),
        previewBlob.arrayBuffer(),
        downloadBlob.arrayBuffer(),
      ]);
      const origClone = new Blob([origBuf], { type: originalBlob.type });
      const prevClone = new Blob([prevBuf], { type: previewBlob.type });
      const dlClone = new Blob([dlBuf], { type: downloadBlob.type });

      // Sequenziell statt parallel — verhindert 204-Duplikat-Antworten
      const originalId = await uploadFileToDirectus(
        session.accessToken,
        origClone,
        `${uid}-orig-${baseName}`
      );
      const previewId = await uploadFileToDirectus(
        session.accessToken,
        prevClone,
        `${uid}-prev-${baseName}.jpg`,
        PUBLIC_FOLDER_ID
      );
      const downloadId = await uploadFileToDirectus(
        session.accessToken,
        dlClone,
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
          // Nur öffentlich zugänglich machen wenn Beitrag auch öffentlich ist
          file_public_preview: makePublic ? previewId : null,
          file_download: makePublic ? downloadId : null,
          // Wasserzeichen-Kopien immer sichern für spätere Freigabe
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
    // Falls Ursprungsordner vorhanden und verschieden vom Zielordner →
    // auch dort eintragen damit der Kontext erhalten bleibt
    if (originFolderId && originFolderId !== finalFolderId) {
      await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId });
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
