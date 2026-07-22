import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// UUID des Datei-Bibliothek-Ordners "Öffentlich" -- ohne diese Variable
// landen watermarked Dateien im Root und sind für die Public-Policy später
// nicht abrufbar (die filtert dort exakt auf diesen Ordner).
const PUBLIC_FOLDER_ID = process.env.DIRECTUS_PUBLIC_FOLDER_ID;

async function parseJsonResponse(res: Response, context: string) {
  const text = await res.text();
  if (!text) {
    throw new Error(`${context}: leere Antwort vom Server (Status ${res.status}).`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${context}: keine gültige JSON-Antwort (Status ${res.status}): ${text.slice(0, 300)}`
    );
  }
}

async function uploadFileToDirectus(
  accessToken: string,
  blob: Blob,
  filename: string,
  folderId?: string
): Promise<string> {
  const form = new FormData();
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
  const { data } = await parseJsonResponse(res, `Datei-Upload (${filename})`);
  return data.id as string;
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
  const originalFile = formData.get('original') as File | null;
  const previewFile = formData.get('preview') as File | null;
  const downloadFile = formData.get('download') as File | null;
  const title = (formData.get('title') as string) || null;
  const eventDate = formData.get('event_date') as string | null;
  const alarmCode = (formData.get('alarm_code') as string) || null;
  const location = (formData.get('location') as string) || null;
  const tagsRaw = (formData.get('tags') as string) || '';

  if (!originalFile || !previewFile || !downloadFile || !eventDate) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 });
  }

  try {
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

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const itemRes = await fetch(`${DIRECTUS_URL}/items/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        original_name: originalFile.name,
        file_original: originalId,
        file_public_preview: previewId,
        file_download: downloadId,
        event_date: eventDate,
        alarm_code: alarmCode,
        location,
        tags,
        uploaded_by: user.id,
        is_public: false,
      }),
    });

    if (!itemRes.ok) {
      const body = await itemRes.text();
      throw new Error(body);
    }

    const { data } = await parseJsonResponse(itemRes, 'Bild-Anlage');
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
