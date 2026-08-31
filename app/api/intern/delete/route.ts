import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { isUuid } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeIdArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
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

  const { id } = await request.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  // ECHTE INJECTION-FLÄCHE: id landet direkt als Pfadsegment in der ersten
  // Directus-Anfrage unten. Diese eine Prüfung schützt die gesamte
  // nachfolgende Kette, weil jede weitere ID (img.id, fileId, mediaId) aus
  // Directus' eigener Antwort auf DIESEN Aufruf stammt, nicht mehr vom
  // Client.
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const postRes = await fetch(
      `${DIRECTUS_URL}/items/posts/${id}?fields=id,images.id,images.source_media_id,images.file_original,images.file_public_preview,images.file_download,images.file_public_preview_watermarked,images.file_download_watermarked`,
      { headers }
    );

    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => '');
      console.error('[intern/delete] Beitrag konnte nicht geladen werden:', {
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
      source_media_id: string | null;
      file_original: string | null;
      file_public_preview: string | null;
      file_download: string | null;
      file_public_preview_watermarked: string | null;
      file_download_watermarked: string | null;
    }[] = Array.isArray(data.images) ? data.images : [];

    const fileIds = Array.from(
      new Set(
        imageRows
          .filter((img) => !img.source_media_id)
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

    for (const img of imageRows) {
      const deleteImageRes = await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!deleteImageRes.ok) {
        const errText = await deleteImageRes.text().catch(() => '');
        console.error('[intern/delete] Bilddatensatz konnte nicht gelöscht werden:', {
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

    const deletePostRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!deletePostRes.ok) {
      const errText = await deletePostRes.text().catch(() => '');
      console.error('[intern/delete] Beitrag konnte nicht gelöscht werden:', {
        postId: id,
        status: deletePostRes.status,
        body: errText,
      });

      return NextResponse.json(
        { error: 'Löschen fehlgeschlagen.' },
        { status: 500 }
      );
    }

    const fileDeleteResults = await Promise.allSettled(
      fileIds.map(async (fileId) => {
        const res = await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('[intern/delete] Datei konnte nicht gelöscht werden:', {
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
      console.error('[intern/delete] Datei-Löschungen teilweise fehlgeschlagen:', {
        postId: id,
        rejected: rejectedDeletes.length,
      });
    }

    const mediaLibraryIds = Array.from(
      new Set(
        imageRows
          .map((img) => img.source_media_id)
          .filter((v): v is string => !!v)
      )
    );

    await Promise.allSettled(
      mediaLibraryIds.map(async (mediaId) => {
        const res = await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}?fields=used_in_posts`, {
          headers,
        });
        if (!res.ok) return;
        const { data: mediaData } = await res.json();
        const usedInPosts = normalizeIdArray(mediaData?.used_in_posts);
        await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ used_in_posts: usedInPosts.filter((postId) => postId !== id) }),
        }).catch(() => {});
      })
    );

    return NextResponse.json({
      ok: true,
      deletedPostId: id,
      deletedImages: imageRows.length,
      attemptedFileDeletes: fileIds.length,
      preservedLibraryImages: mediaLibraryIds.length,
    });
  } catch (error) {
    console.error('[intern/delete] Unerwarteter Fehler:', error);
    return NextResponse.json(
      { error: 'Löschen fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
