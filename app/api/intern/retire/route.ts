import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// POST /api/intern/posts/retire
// Zieht einen Beitrag zurück ohne ihn zu löschen:
// - is_public = false
// - Dateien bleiben erhalten (kein Löschen)
// - Beitrag landet in Unsortiert
// Gedacht für Stockfotos/Beiträge ohne Ursprungsordner die der User
// behalten aber nicht mehr öffentlich haben möchte.

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try { session = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const { postId } = await request.json().catch(() => ({}));
  if (!postId) return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Unsortiert-Ordner finden
  const foldersRes = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&fields=id,name,system_role&limit=100`,
    { headers }
  );
  let unsortedFolderId: string | null = null;
  if (foldersRes.ok) {
    const { data } = await foldersRes.json();
    const rows = data as { id: string; name: string; system_role?: string | null }[];
    unsortedFolderId = rows.find((r) => r.system_role === 'unsorted')?.id
      ?? rows.find((r) => r.name === 'Unsortiert')?.id ?? null;
  }

  // Aktuelle Ordner-Zuordnungen
  const assignRes = await fetch(
    `${DIRECTUS_URL}/items/folders_posts?filter[posts_id][_eq]=${postId}&fields=id,folders_id&limit=50`,
    { headers }
  );
  let assignments: { id: string; folders_id: string }[] = [];
  if (assignRes.ok) { const { data } = await assignRes.json(); assignments = data || []; }

  // Öffentlich-Ordner-Zuordnung entfernen
  if (unsortedFolderId) {
    const publicFoldersRes = await fetch(
      `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&fields=id,system_role&limit=100`,
      { headers }
    );
    if (publicFoldersRes.ok) {
      const { data } = await publicFoldersRes.json();
      const publicFolder = (data as { id: string; system_role?: string | null }[])
        .find((r) => r.system_role === 'public');
      if (publicFolder) {
        const pubAssign = assignments.find((a) => a.folders_id === publicFolder.id);
        if (pubAssign) {
          await fetch(`${DIRECTUS_URL}/items/folders_posts/${pubAssign.id}`, {
            method: 'DELETE', headers,
          });
        }
      }
    }
  }

  // Beitrag auf privat setzen + Bilder nicht mehr öffentlich
  await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ is_public: false, published_at: null, origin_folder_id: null }),
  });

  // file_public_preview und file_download auf null -- Dateien bleiben erhalten
  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${postId}?fields=images.id`,
    { headers }
  );
  if (postRes.ok) {
    const { data } = await postRes.json();
    for (const img of (data.images || []) as { id: string }[]) {
      await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ file_public_preview: null, file_download: null }),
      });
    }
  }

  // In Unsortiert verschieben wenn noch nicht drin
  if (unsortedFolderId) {
    const alreadyUnsorted = assignments.some((a) => a.folders_id === unsortedFolderId);
    if (!alreadyUnsorted) {
      await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ folders_id: unsortedFolderId, posts_id: postId }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
