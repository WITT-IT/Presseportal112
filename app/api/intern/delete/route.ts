import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const postRes = await fetch(
      `${DIRECTUS_URL}/items/posts/${id}?fields=id,images.id,images.file_original,images.file_public_preview,images.file_download,images.file_public_preview_watermarked,images.file_download_watermarked`,
      { headers }
    );

    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => '');
      console.error('[account/delete] Beitrag konnte nicht geladen werden:', {
        id,
        status: postRes.status,
        body: errText,
      });

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
      file_public_preview_watermarked: string | null;
      file_download_watermarked: string | null;
    }[] = Array.isArray(data.images) ? data.images : [];

    const fileIds = Array.from(
      new Set(
        imageRows
          .flatMap((img) => [
            img.file_original,
            img.file_public_preview,
            img.file_download,
            img.file_public_preview_watermarked,
            img.file_download_watermarked,
          ])
          .filter(Boolean)
      )
    ) as string[];

    // Erst Bilddatensätze löschen
    for (const img of imageRows) {
      const deleteImageRes = await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!deleteImageRes.ok) {
        const errText = await deleteImageRes.text().catch(() => '');
        console.error('[account/delete] Bilddatensatz konnte nicht gelöscht werden:', {
          imageId: img.id,
          postId: id,
          status: deleteImageRes.status,
          body: errText,
        });

        return NextResponse.json(
          { error: 'Bilddatensatz konnte nicht gelöscht werden.' },
          { status: 500 }
        );
      }
    }

    // Dann Post löschen
    const deletePostRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!deletePostRes.ok) {
      const errText = await deletePostRes.text().catch(() => '');
      console.error('[account/delete] Beitrag konnte nicht gelöscht werden:', {
        postId: id,
        status: deletePostRes.status,
        body: errText,
      });

      return NextResponse.json(
        { error: 'Löschen fehlgeschlagen.' },
        { status: 500 }
      );
    }

    // Dateien zum Schluss löschen
    const fileDeleteResults = await Promise.allSettled(
      fileIds.map(async (fileId) => {
        const res = await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('[account/delete] Datei konnte nicht gelöscht werden:', {
            fileId,
            postId: id,
            status: res.status,
            body: errText,
          });
        }
      })
    );

    const rejectedDeletes = fileDeleteResults.filter(
      (result) => result.status === 'rejected'
    );

    if (rejectedDeletes.length > 0) {
      console.error('[account/delete] Datei-Löschungen teilweise fehlgeschlagen:', {
        postId: id,
        rejected: rejectedDeletes.length,
      });
    }

    return NextResponse.json({
      ok: true,
      deletedPostId: id,
      deletedImages: imageRows.length,
      attemptedFileDeletes: fileIds.length,
    });
  } catch (error) {
    console.error('[account/delete] Unerwarteter Fehler:', error);
    return NextResponse.json(
      { error: 'Löschen fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
