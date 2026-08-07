import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// used_in_posts kommt manchmal als roher Text statt als echtes JSON-Array
// zurück -- gleiches Problem wie an anderen Stellen im Projekt.
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

// POST /api/intern/folders — neuen Ordner anlegen
// Body: { name, parent_folder? }  (parent_folder: null/undefined = Wurzel)
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { name, parent_folder } = await request.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }

  const id = randomUUID();
  const res = await fetch(`${DIRECTUS_URL}/items/folders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      name: String(name).trim(),
      parent_folder: parent_folder || null,
      organization: user.organization.id,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Ordner anlegen fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Ordner konnte nicht angelegt werden.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}

// PATCH /api/intern/folders — umbenennen oder verschieben
// Body: { id, name?, parent_folder? }  (parent_folder: null = Wurzel)
export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const { id, name, parent_folder } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });
  if (parent_folder === id) {
    return NextResponse.json(
      { error: 'Ein Ordner kann nicht in sich selbst verschoben werden.' },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (parent_folder !== undefined) patch.parent_folder = parent_folder;

  const res = await fetch(`${DIRECTUS_URL}/items/folders/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Ordner aktualisieren fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Aktualisieren fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

type MediaLeaf = {
  id: string;
  used_in_posts: unknown;
  file: string | null;
  file_preview: string | null;
  file_preview_watermarked: string | null;
  file_download_watermarked: string | null;
};

// Sammelt den kompletten Unterbaum (Unterordner + Medienbibliothek-Items)
// ab folderId -- rekursiv, weil Ordner beliebig tief verschachtelt sein
// können (siehe /intern/medien).
async function collectSubtree(
  folderId: string,
  accessToken: string
): Promise<{ folderIds: string[]; mediaItems: MediaLeaf[] }> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const folderIds: string[] = [folderId];
  const mediaItems: MediaLeaf[] = [];

  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;

    const [subfoldersRes, mediaRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/folders?filter[parent_folder][_eq]=${current}&fields=id`, { headers }),
      fetch(
        `${DIRECTUS_URL}/items/media_library?filter[folder][_eq]=${current}&fields=id,used_in_posts,file,file_preview,file_preview_watermarked,file_download_watermarked`,
        { headers }
      ),
    ]);

    if (subfoldersRes.ok) {
      const { data } = await subfoldersRes.json();
      for (const f of data as { id: string }[]) {
        folderIds.push(f.id);
        queue.push(f.id);
      }
    }

    if (mediaRes.ok) {
      const { data } = await mediaRes.json();
      mediaItems.push(...(data as MediaLeaf[]));
    }
  }

  return { folderIds, mediaItems };
}

// DELETE /api/intern/folders?id=... — Ordner löschen, inklusive allem
// darin: Unterordner, Medienbibliothek-Items und deren physische Dateien.
//
// Prüft nicht blind auf used_in_posts, sondern ob die referenzierten
// Post-IDs überhaupt noch existieren -- eine tote Referenz aus einer
// älteren Löschung soll die Ordner-Löschung nicht grundlos blockieren.
//
// Wird IRGENDEIN Medienbibliothek-Item im ganzen Unterbaum noch in einem
// WIRKLICH existierenden Beitrag verwendet, bricht die komplette Löschung
// ab, bevor irgendwas angefasst wird.
//
// Läuft der Check durch: erst alle Dateien in Directus löschen, dann die
// media_library-Datensätze, dann die Ordner selbst -- tiefste zuerst.
export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const folderId = request.nextUrl.searchParams.get('id');
  if (!folderId) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  let subtree: { folderIds: string[]; mediaItems: MediaLeaf[] };
  try {
    subtree = await collectSubtree(folderId, session.accessToken);
  } catch (error) {
    console.error('Ordnerinhalt konnte nicht ermittelt werden:', error);
    return NextResponse.json({ error: 'Ordnerinhalt konnte nicht geprüft werden.' }, { status: 502 });
  }

  const allReferencedPostIds = Array.from(
    new Set(subtree.mediaItems.flatMap((item) => normalizeIdArray(item.used_in_posts)))
  );

  let existingPostIds = new Set<string>();
  if (allReferencedPostIds.length > 0) {
    const postsRes = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[id][_in]=${allReferencedPostIds.join(',')}&fields=id`,
      { headers }
    );
    if (postsRes.ok) {
      const { data } = await postsRes.json();
      existingPostIds = new Set((data as { id: string }[]).map((p) => p.id));
    } else {
      existingPostIds = new Set(allReferencedPostIds);
    }
  }

  const blocked = subtree.mediaItems.filter((item) =>
    normalizeIdArray(item.used_in_posts).some((postId) => existingPostIds.has(postId))
  );
  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: `Dieser Ordner enthält ${blocked.length} Bild${blocked.length === 1 ? '' : 'er'}, die noch in einem Beitrag verwendet werden. Bitte diese Beiträge zuerst löschen oder die Bilder in einen anderen Ordner verschieben.`,
      },
      { status: 409 }
    );
  }

  const fileIds = subtree.mediaItems
    .flatMap((item) => [item.file, item.file_preview, item.file_preview_watermarked, item.file_download_watermarked])
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  await Promise.allSettled(
    fileIds.map((fileId) =>
      fetch(`${DIRECTUS_URL}/files/${fileId}`, { method: 'DELETE', headers }).then((res) => {
        if (!res.ok) console.error(`Datei ${fileId} konnte nicht gelöscht werden (Status ${res.status}).`);
      })
    )
  );

  if (subtree.mediaItems.length > 0) {
    await fetch(`${DIRECTUS_URL}/items/media_library`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify(subtree.mediaItems.map((item) => item.id)),
    }).catch(() => {});
  }

  const deletionOrder = [...subtree.folderIds].reverse();
  for (const id of deletionOrder) {
    const res = await fetch(`${DIRECTUS_URL}/items/folders/${id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 204) {
      console.error(`Ordner ${id} konnte nicht gelöscht werden (Status ${res.status}).`);
    }
  }

  return NextResponse.json({
    ok: true,
    deletedFolders: subtree.folderIds.length,
    deletedMediaItems: subtree.mediaItems.length,
    deletedFiles: fileIds.length,
  });
}
