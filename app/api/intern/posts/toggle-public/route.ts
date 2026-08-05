import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// POST /api/intern/posts/toggle-public
// Body: { postId: string, makePublic: boolean }
//        ODER
// Body: { postId: string, removeFromPublic: true, folderId: string }
//
// removeFromPublic=true: Beitrag aus Öffentlich-Ordner entfernen,
// privat setzen, in Unsortiert oder Ursprungsordner verschieben.

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

  const body = await request.json().catch(() => ({}));
  const { postId } = body;

  if (!postId) {
    return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Aktuellen Beitrag laden
  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${postId}?fields=id,is_public,origin_folder_id,organization,images.id,images.file_public_preview,images.file_download`,
    { headers }
  );
  if (!postRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: post } = await postRes.json();

  const postOrgId = typeof post.organization === 'string' ? post.organization : post.organization?.id;
  if (postOrgId !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  // Alle Ordner der Org laden
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
      ?? rows.find((r) => r.name === 'Öffentlich')?.id ?? null;
    unsortedFolderId = rows.find((r) => r.system_role === 'unsorted')?.id
      ?? rows.find((r) => r.name === 'Unsortiert')?.id ?? null;
  }

  // Aktuelle Ordner-Zuordnungen laden
  const assignRes = await fetch(
    `${DIRECTUS_URL}/items/folders_posts?filter[posts_id][_eq]=${postId}&fields=id,folders_id&limit=50`,
    { headers }
  );
  let assignments: { id: string; folders_id: string }[] = [];
  if (assignRes.ok) {
    const { data } = await assignRes.json();
    assignments = data || [];
  }

  // ── MODUS: removeFromPublic ─────────────────────────────────────────────
  // Wird vom X-Button im Öffentlich-Ordner aufgerufen.
  if (body.removeFromPublic === true) {
    const folderId = body.folderId as string;

    // Aus Öffentlich-Ordner entfernen
    const publicAssignment = assignments.find((a) => a.folders_id === folderId);
    if (publicAssignment) {
      await fetch(`${DIRECTUS_URL}/items/folders_posts/${publicAssignment.id}`, {
        method: 'DELETE',
        headers,
      });
    }

    const hadOrigin = !!post.origin_folder_id;

    // Beitrag auf privat setzen
    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        is_public: false,
        published_at: null,
        origin_folder_id: null,
      }),
    });

    // Bilder nicht mehr öffentlich zugänglich
    const images = (post.images || []) as { id: string }[];
    for (const img of images) {
      await fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ file_public_preview: null, file_download: null }),
      });
    }

    // Kein Ursprungsordner → in Unsortiert
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

    return NextResponse.json({ ok: true });
  }

  // ── MODUS: makePublic toggle ────────────────────────────────────────────
  const makePublic = body.makePublic as boolean;
  if (typeof makePublic !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
  }

  if (makePublic) {
    // Ursprungsordner merken
    let originFolderId: string | null = post.origin_folder_id ?? null;
    if (!originFolderId && assignments.length > 0) {
      const systemIds = [publicFolderId, unsortedFolderId].filter(Boolean);
      const nonSystem = assignments.find((a) => !systemIds.includes(a.folders_id));
      if (nonSystem) originFolderId = nonSystem.folders_id;
    }

    const patchBody: Record<string, unknown> = {
      is_public: true,
      published_at: new Date().toISOString(),
    };
    if (originFolderId) patchBody.origin_folder_id = originFolderId;

    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody),
    });

    // In Öffentlich-Ordner
    if (publicFolderId) {
      const alreadyIn = assignments.some((a) => a.folders_id === publicFolderId);
      if (!alreadyIn) {
        await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ folders_id: publicFolderId, posts_id: postId }),
        });
      }
    }
  } else {
    // Aus Öffentlich entfernen
    if (publicFolderId) {
      const pubAssign = assignments.find((a) => a.folders_id === publicFolderId);
      if (pubAssign) {
        await fetch(`${DIRECTUS_URL}/items/folders_posts/${pubAssign.id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }

    const hadOrigin = !!post.origin_folder_id;
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

    await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_public: false, published_at: null, origin_folder_id: null }),
    });
  }

  return NextResponse.json({ ok: true });
}
