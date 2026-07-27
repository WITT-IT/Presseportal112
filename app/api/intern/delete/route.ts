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

  // Erst den Beitrag mit allen zugehörigen Fotos lesen, um an die Datei-IDs
  // zu kommen -- Directus prüft dabei über die Organisation-Policy
  // automatisch, ob dieser User den Beitrag überhaupt sehen (und damit
  // löschen) darf.
  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${id}?fields=id,images.id,images.file_original,images.file_public_preview,images.file_download`,
    { headers }
  );

  if (!postRes.ok) {
    return NextResponse.json(
      { error: 'Beitrag nicht gefunden oder keine Berechtigung.' },
      { status: postRes.status === 403 ? 403 : 404 }
    );
  }

  const { data } = await postRes.json();
  const imageRows: {
    id: string;
    file_original: string | null;
    file_public_preview: string | null;
    file_download: string | null;
  }[] = data.images ?? [];

  const fileIds = imageRows
    .flatMap((img) => [img.file_original, img.file_public_preview, img.file_download])
    .filter(Boolean) as string[];

  // Reihenfolge ist wichtig: erst die Foto-Datensätze (sie verweisen auf den
  // Beitrag), dann der Beitrag selbst, dann die Dateien.
  for (const img of imageRows) {
    await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, { method: 'DELETE', headers });
  }

  const deletePostRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!deletePostRes.ok) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }

  // Dateien zum Schluss, einzeln statt als Alles-oder-nichts-Batch, damit ein
  // Problem bei einer Datei die anderen nicht verhindert.
  await Promise.allSettled(
    fileIds.map((fileId) =>
      fetch(`${DIRECTUS_URL}/files/${fileId}`, { method: 'DELETE', headers })
    )
  );

  return NextResponse.json({ ok: true });
}
