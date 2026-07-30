import { randomUUID } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// UUID des Datei-Bibliothek-Ordners "Öffentlich" -- ohne diese Variable
// landen watermarked Dateien im Root und sind für die Public-Policy später
// nicht abrufbar (die filtert dort exakt auf diesen Ordner).
const PUBLIC_FOLDER_ID = process.env.DIRECTUS_PUBLIC_FOLDER_ID;

// Der Artikeltext landet später als HTML auf einer öffentlichen Seite --
// deshalb hier serverseitig auf eine bewusst kleine Liste erlaubter Tags
// einschränken. Schützt vor gespeichertem Cross-Site-Scripting, auch wenn
// jemand direkt die API statt unseres Editors anspricht.
const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'h2', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

// Directus antwortet nach dem Anlegen einer Datei manchmal mit 204 statt 200,
// wenn die eigene Rolle die gerade erstellte Datei laut Lese-Filter nicht
// sofort zurücklesen kann (bekanntes Verhalten, siehe
// github.com/directus/directus/issues/22649). Deshalb vergeben wir die ID
// selbst im Voraus, statt sie aus der Antwort auszulesen.
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

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const title = (formData.get('title') as string) || null;
  const eventDate = formData.get('event_date') as string | null;
  const alarmCode = (formData.get('alarm_code') as string) || null;
  const location = (formData.get('location') as string) || null;
  const tagsRaw = (formData.get('tags') as string) || '';
  const articleBodyRaw = (formData.get('article_body') as string) || '';
  const articleBody = articleBodyRaw.trim()
    ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS)
    : null;

  // Inhalts-Bestätigung: Pflicht, unabhängig vom Frontend nochmal geprüft --
  // der Haken im Formular blockt zwar schon clientseitig, aber wer die API
  // direkt anspricht, soll das nicht umgehen können.
  const contentConfirmed = formData.get('content_confirmed') === 'true';
  if (!contentConfirmed) {
    return NextResponse.json(
      { error: 'Bitte die Bestätigung zum Bildinhalt ankreuzen.' },
      { status: 400 }
    );
  }
  // Zeitstempel bewusst serverseitig gesetzt, nie vom Client übernommen --
  // sonst könnte sich jemand einen beliebigen Bestätigungszeitpunkt selbst
  // ausdenken.
  const contentConfirmedAt = new Date().toISOString();

  // Fotos kommen als indizierte Felder: original_0/preview_0/download_0,
  // original_1/... -- so bleibt die Zuordnung der drei Varianten pro Foto
  // eindeutig, auch wenn mehrere Bilder gleichzeitig hochgeladen werden.
  const imageCount = Number(formData.get('image_count') || 0);

  if (!eventDate || imageCount < 1) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 });
  }

  try {
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Erst den Beitrag anlegen -- ohne ihn hätten die Fotos keine Zuordnung.
    // Eigene ID vergeben, damit eine mögliche 204-Antwort nicht stört.
    const postId = randomUUID();

    const postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: postId,
        title,
        article_body: articleBody,
        event_date: eventDate,
        alarm_code: alarmCode,
        location,
        tags,
        uploaded_by: user.id,
        is_public: false,
        content_confirmed: true,
        content_confirmed_at: contentConfirmedAt,
      }),
    });

    if (!postRes.ok) {
      const body = await postRes.text();
      throw new Error(`Beitrag anlegen fehlgeschlagen: ${body}`);
    }

    // Dann die Fotos, nacheinander statt parallel -- zuverlässiger, und die
    // Reihenfolge bleibt exakt so, wie der Nutzer sie ausgewählt hat.
    for (let i = 0; i < imageCount; i++) {
      const originalFile = formData.get(`original_${i}`) as File | null;
      const previewFile = formData.get(`preview_${i}`) as File | null;
      const downloadFile = formData.get(`download_${i}`) as File | null;
      const caption = (formData.get(`caption_${i}`) as string) || null;

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
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: randomUUID(),
          post: postId,
          file_original: originalId,
          file_public_preview: previewId,
          file_download: downloadId,
          caption,
          sort: i,
        }),
      });

      if (!imageRes.ok) {
        const body = await imageRes.text();
        throw new Error(`Foto ${i + 1} anlegen fehlgeschlagen: ${body}`);
      }
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
