import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// POST /api/intern/posts/remove-from-public
// Body: { postId: string, folderId: string }
//
// Entfernt einen Beitrag aus dem Öffentlich-Ordner:
// - Beitrag wird auf is_public=false gesetzt
// - Beitrag wird aus dem Öffentlich-Ordner entfernt
// - Hat der Beitrag einen Ursprungsordner → bleibt dort
// - Hat er keinen → landet in Unsortiert
// - Ist der Beitrag danach komplett ohne Bilder → wird er gelöscht

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { postId, folderId } = await request.json().catch(() => ({}));
  if (!postId || !folderId) {
    return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Beitrag laden inkl. Bilder und Orgzugehörigkeit
  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${postId}?fields=id,is_public,origin_folder_id,organization,images.id,images.file_original,images.file_public_preview,images.file_download,images.file_public_preview_watermarked,images.file_download_watermarked`,
    { headers }
  );
  if (!postRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: post } = await postRes.json();

  // Sicherheit: nur eigene Beiträge
  const postOrgId = typeof post.organization === 'string' ? post.organization : post.organization?.id;
  if (postOrgId !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  // Alle Ordner der Org laden um Unsortiert zu finden
  const foldersRes = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&fields=id,name,system_role&limit=100`,
    { headers }
  );
  let unsortedFolderId: string | null = null;
  if (foldersRes.ok) {
    const { data: allFolders } = await foldersRes.json();
    const rows = allFolders as { id: string; name: string; system_role?: string | null }[];
    unsortedFolderId = rows.find((r) => r.system_role === 'unsorted')?.id
      ?? rows.find((r) => r.name === 'Unsortiert')?.id
      ?? null;
  }

  // Aktuelle Ordner-Zuordnungen des Beitrags
  const assignRes = await fetch(
    `${DIRECTUS_URL}/items/folders_posts?filter[posts_id][_eq]=${postId}&fields=id,folders_id&limit=50`,
    { headers }
  );
  let assignments: { id: string; folders_id: string }[] = [];
  if (assignRes.ok) {
    const { data } = await assignRes.json();
    assignments = data || [];
  }

  // Aus Öffentlich-Ordner entfernen
  const publicAssignment = assignments.find((a) => a.folders_id === folderId);
  if (publicAssignment) {
    await fetch(`${DIRECTUS_URL}/items/folders_posts/${publicAssignment.id}`, {
      method: 'DELETE',
      headers,
    });
  }

  // Beitrag auf privat setzen
  const hadOrigin = !!post.origin_folder_id;
  await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      is_public: false,
      published_at: null,
      origin_folder_id: null,
    }),
  });

  // file_public_preview auf null setzen damit Bilder nicht mehr öffentlich zugänglich sind
  const images = (post.images || []) as {
    id: string;
    file_original: string | null;
    file_public_preview: string | null;
    file_download: string | null;
    file_public_preview_watermarked: string | null;
    file_download_watermarked: string | null;
  }[];

  for (const img of images) {
    await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        file_public_preview: null,
        file_download: null,
      }),
    });
  }

  // Wenn kein Ursprungsordner → in Unsortiert verschieben
  if (!hadOrigin && unsortedFolderId) {
    const alreadyUnsorted = assignments.some((a) => a.folders_id === unsortedFolderId);
    if (!alreadyUnsorted) {
      await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ folders_id: unsortedFolderId, posts_id: postId }),
      });
    }
  }
  // Wenn Ursprungsordner vorhanden → dort ist der Beitrag bereits, nichts tun

  return NextResponse.json({ ok: true });
}
