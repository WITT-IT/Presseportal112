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

// Hilfsfunktion: Datei zu Directus hochladen, gibt die File-UUID zurück.
async function uploadFileToDirectus(
  token: string,
  file: File,
  filename: string,
  folderId?: string
): Promise<string> {
  const fd = new FormData();
  if (folderId) fd.append('folder', folderId);
  fd.append('file', file, filename);

  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Datei-Upload fehlgeschlagen: ${body}`);
  }
  const { data } = await res.json();
  return data.id;
}

// Systemordner der Organisation laden (Öffentlich + Unsortiert).
async function getSystemFolders(
  token: string,
  orgId: string
): Promise<{ publicFolderId: string | null; unsortedFolderId: string | null }> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&filter[is_system_folder][_eq]=true&fields=id,system_role&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { publicFolderId: null, unsortedFolderId: null };
  const { data } = await res.json();
  const rows = data as { id: string; system_role: string }[];
  return {
    publicFolderId: rows.find((r) => r.system_role === 'public')?.id ?? null,
    unsortedFolderId: rows.find((r) => r.system_role === 'unsorted')?.id ?? null,
  };
}

// Beitrag einem Ordner zuordnen (M2M-Verknüpfung).
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
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  const formData = await request.formData();

  // post_type bestimmt welche Validierungen greifen.
  const postType = (formData.get('post_type') as string) || 'einsatz';
  const isStock = postType === 'stockfoto';

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

  // Pflichtfelder prüfen.
  if (!contentConfirmed) {
    return NextResponse.json(
      { error: 'Bitte die Bestätigung zum Bildinhalt ankreuzen.' },
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

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
  const watermarkText =
    user.organization.branding_label || `Foto: ${user.organization.name ?? ''}`;

  try {
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Systemordner laden -- brauchen wir für die Ordner-Zuweisung.
    const { publicFolderId, unsortedFolderId } = await getSystemFolders(
      session.accessToken,
      user.organization.id
    );

    // Ziel-Ordner bestimmen:
    // 1. Wenn makePublic=true → Öffentlich-Ordner
    // 2. Wenn expliziter Ordner gewählt → dieser Ordner
    // 3. Sonst → Unsortiert-Ordner
    let finalFolderId: string | null = null;
    let originFolderId: string | null = null;

    if (makePublic && publicFolderId) {
      finalFolderId = publicFolderId;
      // Falls zusätzlich ein Ursprungsordner gesetzt war, merken wir ihn.
      if (targetFolderIdRaw) {
        originFolderId = targetFolderIdRaw;
      }
    } else if (targetFolderIdRaw) {
      finalFolderId = targetFolderIdRaw;
    } else if (unsortedFolderId) {
      finalFolderId = unsortedFolderId;
    }

    const postId = randomUUID();
    const now = new Date().toISOString();

    // Beitrag anlegen.
    const postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: postId,
        organization: user.organization.id,
        post_type: postType,
        title,
        article_body: articleBody,
        event_date: eventDate || null,
        alarm_code: alarmCode || null,
        location: location || null,
        tags,
        is_public: makePublic,
        published_at: makePublic ? now : null,
        origin_folder_id: originFolderId,
      }),
    });

    if (!postRes.ok) {
      const body = await postRes.text();
      throw new Error(`Beitrag anlegen fehlgeschlagen: ${body}`);
    }

    // Fotos hochladen und mit Beitrag verknüpfen.
    for (let i = 0; i < imageCount; i++) {
      const originalFile = formData.get(`original_${i}`) as File | null;
      const previewFile = formData.get(`preview_${i}`) as File | null;
      const downloadFile = formData.get(`download_${i}`) as File | null;
      const caption = (formData.get(`caption_${i}`) as string) || null;

      if (!originalFile || !previewFile || !downloadFile) continue;

      const [originalId, previewId, downloadId] = await Promise.all([
        uploadFileToDirectus(session.accessToken, originalFile, originalFile.name),
        uploadFileToDirectus(
          session.accessToken,
          previewFile,
          `preview-${originalFile.name}.jpg`,
          PUBLIC_FOLDER_ID
        ),
        uploadFileToDirectus(
          session.accessToken,
          downloadFile,
          `download-${originalFile.name}.jpg`,
          PUBLIC_FOLDER_ID
        ),
      ]);

      // Bild-Datensatz anlegen.
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

      // Auch in Medienbibliothek eintragen.
      await fetch(`${DIRECTUS_URL}/items/media_library`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: randomUUID(),
          organization: user.organization.id,
          file: originalId,
          file_preview: previewId,
          file_download: downloadId,
          original_filename: originalFile.name,
          tags,
          uploaded_at: now,
          used_in_posts: [postId],
        }),
      });
    }

    // Ordner-Zuweisung.
    if (finalFolderId) {
      await assignToFolder(session.accessToken, finalFolderId, postId);
    }
    // Wenn Ursprungsordner vorhanden und != Zielordner → auch dort verknüpfen.
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
