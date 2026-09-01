import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { isUuid } from '@/lib/validate';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
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

  const caller = await getCurrentUser(session.accessToken);
  if (!caller || !(await isAdministrator(caller.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const { postId } = await params;

  // ECHTE INJECTION-FLÄCHE: postId landet als Pfadsegment UND als
  // Filter-Wert (filter[posts_id][_eq]=${postId}) weiter unten, mit dem
  // Service-Token -- portalweiter Löschzugriff.
  if (!isUuid(postId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Beitrag löschen (Moderation): DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const adminHeaders = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const fields = [
      'id',
      'images.id',
      'images.source_media_id',
      'images.file_original',
      'images.file_public_preview',
      'images.file_download',
    ].join(',');
    const postRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}?fields=${fields}`, {
      headers: adminHeaders,
    });
    if (!postRes.ok) {
      throw new Error(`Beitrag konnte nicht geladen werden (Status ${postRes.status})`);
    }
    const { data: post } = await postRes.json();

    for (const img of post.images || []) {
      if (img.source_media_id) continue;
      const fileIds = [img.file_original, img.file_public_preview, img.file_download].filter(
        (id: string | null): id is string => !!id
      );
      for (const fileId of fileIds) {
        await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
          method: 'DELETE',
          headers: adminHeaders,
        }).catch(() => {});
      }
    }
    const imageIds = (post.images || []).map((img: { id: string }) => img.id);
    if (imageIds.length) {
      await fetch(`${DIRECTUS_URL}/items/images`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify(imageIds),
      }).catch(() => {});
    }

    for (const junction of ['folders_posts', 'media_shares_posts']) {
      await fetch(`${DIRECTUS_URL}/items/${junction}?filter[posts_id][_eq]=${postId}&fields=id`, {
        headers: adminHeaders,
      })
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then(async ({ data }: { data: { id: string }[] }) => {
          for (const row of data) {
            await fetch(`${DIRECTUS_URL}/items/${junction}/${row.id}`, {
              method: 'DELETE',
              headers: adminHeaders,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    const deletePostRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (!deletePostRes.ok) {
      throw new Error(`Beitrag konnte nicht gelöscht werden (Status ${deletePostRes.status})`);
    }

    const mediaLibraryIds = Array.from(
      new Set(
        (post.images || [])
          .map((img: { source_media_id?: string | null }) => img.source_media_id)
          .filter((v: unknown): v is string => !!v)
      )
    );

    await Promise.allSettled(
      mediaLibraryIds.map(async (mediaId) => {
        const res = await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}?fields=used_in_posts`, {
          headers: adminHeaders,
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const usedInPosts = normalizeIdArray(data?.used_in_posts);
        await fetch(`${DIRECTUS_URL}/items/media_library/${mediaId}`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({ used_in_posts: usedInPosts.filter((id) => id !== postId) }),
        }).catch(() => {});
      })
    );
  } catch (error) {
    console.error('Beitrag löschen (Moderation) fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
