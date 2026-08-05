import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// POST /api/intern/posts/toggle-public
// Body: { postId: string, makePublic: boolean }
//
// Schaltet einen Beitrag öffentlich oder zurück zu privat und steuert
// dabei automatisch die Ordner-Zuweisung:
//
// makePublic = true:
//   → origin_folder_id setzen (aktueller Ordner, falls vorhanden)
//   → Beitrag in Ordner "Öffentlich" aufnehmen
//   → is_public = true, published_at = now
//
// makePublic = false:
//   → Beitrag aus Ordner "Öffentlich" entfernen
//   → Hat origin_folder_id → bleibt im Ursprungsordner
//   → Hat KEINE origin_folder_id → landet in Ordner "Unsortiert"
//   → is_public = false, published_at = null
//   → origin_folder_id zurücksetzen

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

  // Aktuellen Zustand des Beitrags laden.
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

  // Systemordner der eigenen Organisation laden.
  const foldersRes = await fetch(
    `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&filter[is_system_folder][_eq]=true&fields=id,system_role&limit=10`,
    { headers }
  );
  let publicFolderId: string | null = null;
  let unsortedFolderId: string | null = null;
  if (foldersRes.ok) {
    const { data: folders } = await foldersRes.json();
    publicFolderId = (folders as { id: string; system_role: string }[]).find((f) => f.system_role === 'public')?.id ?? null;
    unsortedFolderId = (folders as { id: string; system_role: string }[]).find((f) => f.system_role === 'unsorted')?.id ?? null;
  }

  // Aktuelle Ordner-Zuordnungen des Beitrags laden (M2M).
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
    // Ursprungsordner merken: erster nicht-Systemordner in dem der Beitrag liegt.
    let originFolderId: string | null = post.origin_folder_id ?? null;
    if (!originFolderId && currentAssignments.length > 0) {
      // Nicht-Systemordner finden.
      for (const assignment of currentAssignments) {
        const fRes = await fetch(
          `${DIRECTUS_URL}/items/folders/${assignment.folders_id}?fields=id,is_system_folder`,
          { headers }
        );
        if (fRes.ok) {
          const { data: f } = await fRes.json();
          if (!f.is_system_folder) {
            originFolderId = f.id;
            break;
          }
        }
      }
    }

    // Beitrag auf öffentlich setzen.
    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        is_public: true,
        published_at: new Date().toISOString(),
        origin_folder_id: originFolderId,
      }),
    });

    // In Öffentlich-Ordner aufnehmen (falls nicht schon drin).
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
    // Öffentlich → privat.

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

    // Wenn kein Ursprungsordner → in Unsortiert verschieben.
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

    // Beitrag auf privat setzen, origin_folder_id zurücksetzen.
    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        is_public: false,
        published_at: null,
        origin_folder_id: null,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
