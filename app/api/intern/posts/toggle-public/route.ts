import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function directusJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, text, json };
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Sitzung ungültig.' },
      { status: 401 }
    );
  }

  const user = await getCurrentUser(session.accessToken);
  const organizationId = user?.organization?.id;
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: 'Keine Organisation.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { postId, makePublic } = (body || {}) as {
    postId?: string;
    makePublic?: boolean;
  };

  if (!postId || typeof makePublic !== 'boolean') {
    return NextResponse.json(
      { ok: false, error: 'Ungültige Anfrage.' },
      { status: 400 }
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${session.accessToken}`,
  };

  const jsonHeaders = {
    ...authHeaders,
    'Content-Type': 'application/json',
  };

  try {
    // 1) Post laden + Ownership prüfen
    const postReq = await directusJson(
      `${DIRECTUS_URL}/items/posts/${postId}?fields=id,organization,is_public,published_at`,
      { headers: authHeaders }
    );

    if (!postReq.res.ok) {
      return NextResponse.json(
        { ok: false, error: 'Beitrag nicht gefunden.' },
        { status: 404 }
      );
    }

    const post = postReq.json?.data;
    if (!post || post.organization !== organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Keine Berechtigung.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // 2) Post updaten
    const updatePostReq = await directusJson(
      `${DIRECTUS_URL}/items/posts/${postId}`,
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          is_public: makePublic,
          published_at: makePublic ? now : null,
        }),
      }
    );

    if (!updatePostReq.res.ok) {
      console.error('[toggle-public] Post-Update fehlgeschlagen:', {
        status: updatePostReq.res.status,
        body: updatePostReq.text,
      });
      return NextResponse.json(
        { ok: false, error: 'Beitrag konnte nicht aktualisiert werden.' },
        { status: 500 }
      );
    }

    // 3) Zielordner bestimmen
    const targetFolderName = makePublic ? 'Öffentlich' : 'Privat';

    const folderReq = await directusJson(
      `${DIRECTUS_URL}/folders?filter[name][_eq]=${encodeURIComponent(targetFolderName)}&limit=1`,
      { headers: authHeaders }
    );

    if (!folderReq.res.ok || !folderReq.json?.data?.[0]?.id) {
      console.error(`[toggle-public] Ordner "${targetFolderName}" nicht gefunden:`, {
        status: folderReq.res.status,
        body: folderReq.text,
      });
      return NextResponse.json(
        { ok: false, error: `Ordner "${targetFolderName}" wurde nicht gefunden.` },
        { status: 500 }
      );
    }

    const targetFolderId = folderReq.json.data[0].id;

    // 4) Zugehörige Bilder laden
    const imagesReq = await directusJson(
      `${DIRECTUS_URL}/items/images?filter[post][_eq]=${postId}&fields=id,file_original,file_public_preview_watermarked,file_download_watermarked`,
      { headers: authHeaders }
    );

    if (!imagesReq.res.ok) {
      console.error('[toggle-public] Bilder konnten nicht geladen werden:', {
        status: imagesReq.res.status,
        body: imagesReq.text,
      });
      return NextResponse.json(
        { ok: false, error: 'Bilder konnten nicht geladen werden.' },
        { status: 500 }
      );
    }

    const images = Array.isArray(imagesReq.json?.data) ? imagesReq.json.data : [];

    // 5) Alle verknüpften Dateien sammeln
    const fileIds = Array.from(
      new Set(
        images.flatMap((img: any) =>
          [
            img?.file_original,
            img?.file_public_preview_watermarked,
            img?.file_download_watermarked,
          ].filter(Boolean)
        )
      )
    );

    // 6) Dateien in Zielordner verschieben
    for (const fileId of fileIds) {
      const fileUpdateReq = await directusJson(
        `${DIRECTUS_URL}/files/${fileId}`,
        {
          method: 'PATCH',
          headers: jsonHeaders,
          body: JSON.stringify({ folder: targetFolderId }),
        }
      );

      if (!fileUpdateReq.res.ok) {
        console.error('[toggle-public] Datei konnte nicht verschoben werden:', {
          fileId,
          targetFolderName,
          status: fileUpdateReq.res.status,
          body: fileUpdateReq.text,
        });
        return NextResponse.json(
          {
            ok: false,
            error: `Mindestens eine Datei konnte nicht in "${targetFolderName}" verschoben werden.`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      post: {
        postId,
        isPublic: makePublic,
        publishedAt: makePublic ? now : null,
        movedToFolder: targetFolderName,
        movedFiles: fileIds.length,
      },
    });
  } catch (error) {
    console.error('[toggle-public] Fehler:', error);
    return NextResponse.json(
      { ok: false, error: 'Umschalten fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    );
  }
}
