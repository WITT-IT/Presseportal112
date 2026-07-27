import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'h2', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

const PUBLIC_FOLDER_ID = process.env.DIRECTUS_PUBLIC_FOLDER_ID;

// Gleiches Prinzip wie beim Erst-Upload: eigene ID vergeben, damit eine
// mögliche 204-Antwort von Directus (siehe directus/directus#22649) nicht
// zum Problem wird.
async function uploadFileToDirectus(
  accessToken: string,
  blob: Blob,
  filename: string,
  folderId?: string
): Promise<string> {
  const id = randomUUID();
  const form = new FormData();
  form.append('id', id);
  if (folderId) form.append('folder', folderId);
  form.append('file', blob, filename);

  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Datei-Upload fehlgeschlagen (${filename}): ${body}`);
  }
  return id;
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const formData = await request.formData();
  const postId = formData.get('id') as string | null;
  const title = (formData.get('title') as string) || null;
  const eventDate = formData.get('event_date') as string | null;
  const alarmCode = (formData.get('alarm_code') as string) || null;
  const location = (formData.get('location') as string) || null;
  const tagsRaw = (formData.get('tags') as string) || '';
  const articleBodyRaw = (formData.get('article_body') as string) || '';

  if (!postId || !eventDate) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 });
  }

  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const articleBody = articleBodyRaw.trim()
    ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS)
    : null;

  try {
    // 1) Textfelder aktualisieren. Directus prüft über die
    // Organisation-Policy automatisch, ob dieser Beitrag überhaupt zur
    // eigenen Organisation gehört.
    const postRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title,
        event_date: eventDate,
        alarm_code: alarmCode,
        location,
        tags,
        article_body: articleBody,
      }),
    });

    if (!postRes.ok) {
      const body = await postRes.text();
      throw new Error(body);
    }

    // 2) Entfernte Fotos: erst deren Datei-IDs auslesen, dann Foto-Datensatz
    // und Dateien selbst löschen.
    const deleteImageIds: string[] = JSON.parse(
      (formData.get('delete_image_ids') as string) || '[]'
    );

    for (const imageId of deleteImageIds) {
      const imgRes = await fetch(
        `${DIRECTUS_URL}/items/images/${imageId}?fields=file_original,file_public_preview,file_download`,
        { headers }
      );
      if (imgRes.ok) {
        const { data } = await imgRes.json();
        const fileIds = [data.file_original, data.file_public_preview, data.file_download].filter(
          Boolean
        ) as string[];
        await fetch(`${DIRECTUS_URL}/items/images/${imageId}`, { method: 'DELETE', headers });
        await Promise.allSettled(
          fileIds.map((fileId) =>
            fetch(`${DIRECTUS_URL}/files/${fileId}`, { method: 'DELETE', headers })
          )
        );
      }
    }

    // 3) Reihenfolge/Bildunterschrift der beibehaltenen bestehenden Fotos.
    const existingOrder: { id: string; caption: string; sort: number }[] = JSON.parse(
      (formData.get('existing_image_order') as string) || '[]'
    );

    await Promise.allSettled(
      existingOrder.map((item) =>
        fetch(`${DIRECTUS_URL}/items/images/${item.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ caption: item.caption || null, sort: item.sort }),
        })
      )
    );

    // 4) Neu hinzugefügte Fotos -- gleicher Ablauf wie beim Erst-Upload:
    // Wasserzeichen wurde schon im Browser erzeugt, hier nur noch hochladen
    // und mit dem Beitrag verknüpfen.
    const newCount = Number(formData.get('new_image_count') || 0);

    for (let i = 0; i < newCount; i++) {
      const originalFile = formData.get(`new_original_${i}`) as File | null;
      const previewFile = formData.get(`new_preview_${i}`) as File | null;
      const downloadFile = formData.get(`new_download_${i}`) as File | null;
      const caption = (formData.get(`new_caption_${i}`) as string) || null;
      const sort = Number(formData.get(`new_sort_${i}`) || 0);

      if (!originalFile || !previewFile || !downloadFile) continue;

      const originalId = await uploadFileToDirectus(
        session.accessToken,
        originalFile,
        originalFile.name
      );
      const previewId = await uploadFileToDirectus(
        session.accessToken,
        previewFile,
        `preview-${originalFile.name}.jpg`,
        PUBLIC_FOLDER_ID
      );
      const downloadId = await uploadFileToDirectus(
        session.accessToken,
        downloadFile,
        `download-${originalFile.name}.jpg`,
        PUBLIC_FOLDER_ID
      );

      const imageRes = await fetch(`${DIRECTUS_URL}/items/images`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: randomUUID(),
          post: postId,
          file_original: originalId,
          file_public_preview: previewId,
          file_download: downloadId,
          caption,
          sort,
        }),
      });

      if (!imageRes.ok) {
        const body = await imageRes.text();
        throw new Error(`Neues Foto ${i + 1} anlegen fehlgeschlagen: ${body}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Beitrag aktualisieren fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
