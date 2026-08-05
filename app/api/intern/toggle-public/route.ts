import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// POST /api/intern/posts/toggle-public
// Body: { postId: string, makePublic: boolean }

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

  const { postId, makePublic } = await request.json().catch(() => ({}));
  if (!postId || typeof makePublic !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Aktuellen Beitrag laden.
  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${postId}?fields=id,is_public,origin_folder_id,organization`,
    { headers }
  );
  if (!postRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: post } = await postRes.json();

  // Sicherheit: nur eigene Beiträge.
  const postOrgId = typeof post.organization === 'string' ? post.organization : post.organization?.id;
  if (postOrgId !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  // Alle Ordner der Org laden -- per Name + system_role finden.
  // Kein Filter auf is_system_folder da das Feld evtl. keine Update-Permission hat.
  const allFoldersRes = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&fields=id,name,system_role&limit=100`,
    { headers }
  );
  let publicFolderId: string | null = null;
  let unsortedFolderId: string | null = null;
  if (allFoldersRes.ok) {
    const { data: allFolders } = await allFoldersRes.json();
    const rows = allFolders as { id: string; name: string; system_role?: string | null }[];
    publicFolderId = rows.find((r) => r.system_role === 'public')?.id
      ?? rows.find((r) => r.name === 'Öffentlich')?.id
      ?? null;
    unsortedFolderId = rows.find((r) => r.system_role === 'unsorted')?.id
      ?? rows.find((r) => r.name === 'Unsortiert')?.id
      ?? null;
  }

  // Aktuelle Ordner-Zuordnungen des Beitrags laden.
  const assignRes = await fetch(
    `${DIRECTUS_URL}/items/folders_posts?filter[posts_id][_eq]=${postId}&fields=id,folders_id&limit=50`,
    { headers }
  );
  let currentAssignments: { id: string; folders_id: string }[] = [];
  if (assignRes.ok) {
    const { data } = await assignRes.json();
    currentAssignments = data || [];
  }

  if (makePublic) {
    // Ursprungsordner merken: erster Ordner der kein Systemordner ist.
    let originFolderId: string | null = post.origin_folder_id ?? null;
    if (!originFolderId && currentAssignments.length > 0) {
      const systemIds = [publicFolderId, unsortedFolderId].filter(Boolean);
      const nonSystemAssignment = currentAssignments.find(
        (a) => !systemIds.includes(a.folders_id)
      );
      if (nonSystemAssignment) originFolderId = nonSystemAssignment.folders_id;
    }

    // Beitrag auf öffentlich setzen.
    const patchBody: Record<string, unknown> = {
      is_public: true,
      published_at: new Date().toISOString(),
    };
    // origin_folder_id nur setzen wenn Feld existiert (kein 403 riskieren).
    if (originFolderId) patchBody.origin_folder_id = originFolderId;

    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody),
    });

    // In Öffentlich-Ordner aufnehmen.
    if (publicFolderId) {
      const alreadyInPublic = currentAssignments.some((a) => a.folders_id === publicFolderId);
      if (!alreadyInPublic) {
        await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ folders_id: publicFolderId, posts_id: postId }),
        });
      }
    }
  } else {
    // Aus Öffentlich-Ordner entfernen.
    if (publicFolderId) {
      const publicAssignment = currentAssignments.find((a) => a.folders_id === publicFolderId);
      if (publicAssignment) {
        await fetch(`${DIRECTUS_URL}/items/folders_posts/${publicAssignment.id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }

    // Kein Ursprungsordner → in Unsortiert verschieben.
    const hadOrigin = !!post.origin_folder_id;
    if (!hadOrigin && unsortedFolderId) {
      const alreadyUnsorted = currentAssignments.some((a) => a.folders_id === unsortedFolderId);
      if (!alreadyUnsorted) {
        await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ folders_id: unsortedFolderId, posts_id: postId }),
        });
      }
    }

    // Beitrag auf privat setzen.
    const patchBody: Record<string, unknown> = {
      is_public: false,
      published_at: null,
    };
    patchBody.origin_folder_id = null;

    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody),
    });
  }

  return NextResponse.json({ ok: true });
}
