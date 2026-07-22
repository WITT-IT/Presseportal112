import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

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

  const { id } = await request.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Erst das Bild selbst lesen, um an die drei verknüpften Datei-IDs zu
  // kommen -- Directus prüft dabei über die Organisation-Policy automatisch,
  // ob dieser User das Bild überhaupt sehen (und damit löschen) darf.
  const itemRes = await fetch(
    `${DIRECTUS_URL}/items/images/${id}?fields=file_original,file_public_preview,file_download`,
    { headers }
  );

  if (!itemRes.ok) {
    return NextResponse.json(
      { error: 'Bild nicht gefunden oder keine Berechtigung.' },
      { status: itemRes.status === 403 ? 403 : 404 }
    );
  }

  const { data } = await itemRes.json();
  const fileIds = [data.file_original, data.file_public_preview, data.file_download].filter(
    Boolean
  ) as string[];

  // Erst den Bild-Datensatz löschen (entfernt auch die Sichtbarkeit sofort) ...
  const deleteItemRes = await fetch(`${DIRECTUS_URL}/items/images/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!deleteItemRes.ok) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }

  // ... dann die drei Dateien selbst, damit sie wirklich vom Server
  // verschwinden. Einzeln statt als ein Fehlschlag-alles-Batch, damit ein
  // Problem bei einer Datei die anderen nicht verhindert.
  await Promise.allSettled(
    fileIds.map((fileId) =>
      fetch(`${DIRECTUS_URL}/files/${fileId}`, { method: 'DELETE', headers })
    )
  );

  return NextResponse.json({ ok: true });
}
