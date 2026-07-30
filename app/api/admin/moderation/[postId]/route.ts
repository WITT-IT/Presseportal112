import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

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

    // Zugehörige Ordner- UND Freigabe-Zuordnungen mit aufräumen.
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
  } catch (error) {
    console.error('Beitrag löschen (Moderation) fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
