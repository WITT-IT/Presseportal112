import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { normalizeTags } from '@/lib/types';
import { isUuid, isUuidOrNull } from '@/lib/validate';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
}

function folderTagToken(userToken: string): string {
  return process.env.DIRECTUS_SERVICE_TOKEN || userToken;
}

async function supportsFolderTags(accessToken: string): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_URL}/items/folders?fields=tags&limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return res.ok;
}

async function getFolderById(
  accessToken: string,
  folderId: string,
  includeTags: boolean
): Promise<{ id: string; parent_folder: string | null; tags: unknown; organization: string | null } | null> {
  const fields = includeTags ? 'id,parent_folder,tags,organization' : 'id,parent_folder,organization';
  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data
    ? {
        id: data.id,
        parent_folder: data.parent_folder ?? null,
        tags: data.tags ?? null,
        organization:
          typeof data.organization === 'string'
            ? data.organization
            : typeof data.organization?.id === 'string'
            ? data.organization.id
            : null,
      }
    : null;
}

async function getEffectiveFolderTags(
  accessToken: string,
  folderId: string | null,
  includeTags: boolean,
  organizationId: string
): Promise<string[]> {
  if (!includeTags) return [];
  if (!folderId) return [];
  const tags: string[] = [];
  let currentId: string | null = folderId;
  let guard = 0;

  while (currentId && guard < 32) {
    guard++;
    const folder = await getFolderById(accessToken, currentId, true);
    if (!folder) break;
    if (folder.organization !== organizationId) return [];
    tags.unshift(...normalizeTags(folder.tags));
    currentId = folder.parent_folder;
  }

  return uniqueTags(tags);
}

type TagFolderTarget = { id: string; tags: unknown };
type TagMediaTarget = { id: string; tags: unknown };

async function collectSubtreeTagTargets(
  accessToken: string,
  rootFolderId: string,
  includeFolderTags: boolean
): Promise<{ folders: TagFolderTarget[]; mediaItems: TagMediaTarget[] }> {
  const folderHeaders = { Authorization: `Bearer ${accessToken}` };
  const mediaHeaders = { Authorization: `Bearer ${accessToken}` };
  const folders: TagFolderTarget[] = [];
  const mediaItems: TagMediaTarget[] = [];

  const rootFolder = await getFolderById(accessToken, rootFolderId, includeFolderTags);
  if (!rootFolder) return { folders, mediaItems };
  folders.push({ id: rootFolder.id, tags: rootFolder.tags });

  const queue = [rootFolderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const folderFields = includeFolderTags ? 'id,tags' : 'id';

    const [subfoldersRes, mediaRes] = await Promise.all([
      fetch(
        `${DIRECTUS_URL}/items/folders?filter[parent_folder][_eq]=${current}&fields=${folderFields}&limit=200`,
        { headers: folderHeaders, cache: 'no-store' }
      ),
      fetch(
        `${DIRECTUS_URL}/items/media_library?filter[folder][_eq]=${current}&fields=id,tags&limit=500`,
        { headers: mediaHeaders, cache: 'no-store' }
      ),
    ]);

    if (subfoldersRes.ok) {
      const { data } = await subfoldersRes.json();
      for (const folder of data as { id: string; tags?: unknown }[]) {
        folders.push({ id: folder.id, tags: folder.tags ?? null });
        queue.push(folder.id);
      }
    }

    if (mediaRes.ok) {
      const { data } = await mediaRes.json();
      mediaItems.push(...((data as { id: string; tags: unknown }[]) ?? []));
    }
  }

  return { folders, mediaItems };
}

// GET /api/intern/folders?contents=1&folder=<id oder leer für Wurzel>
export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  if (searchParams.get('contents') !== '1') {
    return NextResponse.json({ error: 'Unbekannte Anfrage.' }, { status: 400 });
  }

  const folderId = searchParams.get('folder') || null;

  // ECHTE INJECTION-FLÄCHE: folderId landet unten direkt in
  // parentFilter, per Template-String in die Directus-Filter-URL
  // verkettet ("filter[parent_folder][_eq]=${folderId}"). Ein Wert mit
  // "&"-Zeichen könnte dort zusätzliche Filter-Parameter einschmuggeln.
  if (folderId && !isUuid(folderId)) {
    return NextResponse.json({ error: 'Ungültige Ordner-ID.' }, { status: 400 });
  }

  const includeFolderTags = await supportsFolderTags(session.accessToken);
  const fallbackFolderToken = folderTagToken(session.accessToken);
  const canReadFolderTagsWithFallback =
    !includeFolderTags &&
    fallbackFolderToken !== session.accessToken &&
    (await supportsFolderTags(fallbackFolderToken));
  const folderTagReadToken = includeFolderTags
    ? session.accessToken
    : canReadFolderTagsWithFallback
    ? fallbackFolderToken
    : session.accessToken;
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const folderReadHeaders = { Authorization: `Bearer ${folderTagReadToken}` };
  const canReadFolderTags = includeFolderTags || canReadFolderTagsWithFallback;

  const breadcrumb: { id: string; name: string }[] = [];
  // currentId startet mit dem bereits geprüften folderId. Alle weiteren
  // Werte in dieser Schleife kommen aus Directus' eigener Antwort
  // (data.parent_folder), nicht mehr direkt vom Client -- dort ist keine
  // erneute Prüfung nötig.
  let currentId = folderId;
  let guard = 0;
  while (currentId && guard < 8) {
    guard++;
    const fields = canReadFolderTags
      ? canReadFolderTagsWithFallback
        ? 'id,name,parent_folder,tags,organization'
        : 'id,name,parent_folder,tags'
      : 'id,name,parent_folder';
    const res = await fetch(`${DIRECTUS_URL}/items/folders/${currentId}?fields=${fields}`, {
      headers: canReadFolderTags ? folderReadHeaders : headers,
      cache: 'no-store',
    });
    if (!res.ok) break;
    const { data } = await res.json();
    if (canReadFolderTagsWithFallback) {
      const orgId =
        typeof data.organization === 'string'
          ? data.organization
          : typeof data.organization?.id === 'string'
          ? data.organization.id
          : null;
      if (orgId !== user.organization.id) {
        return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
      }
    }
    breadcrumb.unshift({ id: data.id, name: data.name });
    currentId = data.parent_folder;
  }

  const parentFilter = folderId ? `filter[parent_folder][_eq]=${folderId}` : `filter[parent_folder][_null]=true`;

  const taggedFields = canReadFolderTagsWithFallback ? 'id,name,tags,organization' : 'id,name,tags';
  const taggedUrl = `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&${parentFilter}&fields=${taggedFields}&sort=name&limit=200`;
  const plainUrl = `${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${user.organization.id}&${parentFilter}&fields=id,name&sort=name&limit=200`;

  let subfoldersRes = await fetch(canReadFolderTags ? taggedUrl : plainUrl, {
    headers: canReadFolderTags ? folderReadHeaders : headers,
    cache: 'no-store',
  });
  let tagsReadable = canReadFolderTags;
  if (!subfoldersRes.ok && canReadFolderTags) {
    tagsReadable = false;
    subfoldersRes = await fetch(plainUrl, { headers, cache: 'no-store' });
  }

  const subfoldersRaw = subfoldersRes.ok ? (await subfoldersRes.json()).data : [];
  const subfolders = (subfoldersRaw as { id: string; name: string; tags?: unknown; organization?: unknown }[])
    .filter((f) => {
      if (!tagsReadable || !canReadFolderTagsWithFallback) return true;
      const orgId =
        typeof f.organization === 'string'
          ? f.organization
          : typeof (f.organization as { id?: unknown } | null)?.id === 'string'
          ? (f.organization as { id: string }).id
          : null;
      return orgId === user.organization.id;
    })
    .map((f) => ({
      id: f.id,
      name: f.name,
      tags: tagsReadable ? normalizeTags(f.tags) : null,
    }));

  return NextResponse.json({ breadcrumb, subfolders });
}

// POST /api/intern/folders — neuen Ordner anlegen
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { name, parent_folder, tags } = await request.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }

  // EINGABEHYGIENE: parent_folder wandert unten in einen JSON-Body, keine
  // URL-Injection-Fläche. Die Prüfung sorgt trotzdem für eine klare
  // Fehlermeldung statt eines rohen Directus-Fehlers bei einem
  // manipulierten Wert.
  if (!isUuidOrNull(parent_folder)) {
    return NextResponse.json({ error: 'Ungültige übergeordnete Ordner-ID.' }, { status: 400 });
  }

  const includeFolderTags = await supportsFolderTags(session.accessToken);
  const fallbackFolderToken = folderTagToken(session.accessToken);
  const canPersistFolderTagsWithFallback =
    !includeFolderTags &&
    fallbackFolderToken !== session.accessToken &&
    (await supportsFolderTags(fallbackFolderToken));
  const folderTagReadToken = includeFolderTags
    ? session.accessToken
    : canPersistFolderTagsWithFallback
    ? fallbackFolderToken
    : session.accessToken;
  const canReadFolderTags = includeFolderTags || canPersistFolderTagsWithFallback;
  let inheritedTags: string[] = [];
  if (parent_folder) {
    inheritedTags = await getEffectiveFolderTags(
      folderTagReadToken,
      parent_folder,
      canReadFolderTags,
      user.organization.id
    );
  }
  const ownTags = Array.isArray(tags) ? normalizeTags(tags) : [];
  const mergedTags = uniqueTags([...inheritedTags, ...ownTags]);

  const id = randomUUID();
  const body: Record<string, unknown> = {
    id,
    name: String(name).trim(),
    parent_folder: parent_folder || null,
    organization: user.organization.id,
  };
  if (includeFolderTags) body.tags = mergedTags;

  const res = await fetch(`${DIRECTUS_URL}/items/folders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Ordner anlegen fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Ordner konnte nicht angelegt werden.' }, { status: 500 });
  }

  if (!includeFolderTags && canPersistFolderTagsWithFallback) {
    await fetch(`${DIRECTUS_URL}/items/folders/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fallbackFolderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: mergedTags }),
    }).catch((error) => {
      console.error('Ordner-Tags konnten nachträglich nicht geschrieben werden:', error);
    });
  }

  return NextResponse.json({ ok: true, id });
}

// PATCH /api/intern/folders — umbenennen oder verschieben
export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { id, name, parent_folder, tags, propagate_to_descendants } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  // ECHTE INJECTION-FLÄCHE: id landet unten als Pfadsegment in der
  // Directus-URL.
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  // EINGABEHYGIENE: parent_folder wandert in den JSON-Body.
  if (!isUuidOrNull(parent_folder)) {
    return NextResponse.json({ error: 'Ungültige übergeordnete Ordner-ID.' }, { status: 400 });
  }
  if (parent_folder === id) {
    return NextResponse.json(
      { error: 'Ein Ordner kann nicht in sich selbst verschoben werden.' },
      { status: 400 }
    );
  }

  const includeFolderTags = await supportsFolderTags(session.accessToken);
  const fallbackFolderToken = folderTagToken(session.accessToken);
  const canPersistFolderTagsWithFallback =
    !includeFolderTags &&
    fallbackFolderToken !== session.accessToken &&
    (await supportsFolderTags(fallbackFolderToken));
  const folderTagReadToken = includeFolderTags
    ? session.accessToken
    : canPersistFolderTagsWithFallback
    ? fallbackFolderToken
    : session.accessToken;
  const canReadFolderTags = includeFolderTags || canPersistFolderTagsWithFallback;
  const patch: Record<string, unknown> = {};
  const currentFolder = await getFolderById(session.accessToken, id, includeFolderTags);
  if (!currentFolder) {
    return NextResponse.json({ error: 'Ordner nicht gefunden.' }, { status: 404 });
  }
  if (currentFolder.organization !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  let ancestorTagsForMove: string[] = [];
  if (parent_folder !== undefined) {
    ancestorTagsForMove = await getEffectiveFolderTags(
      folderTagReadToken,
      parent_folder || null,
      canReadFolderTags,
      user.organization.id
    );
  }

  let incomingTags: string[] | null = null;
  if (tags !== undefined) {
    if (!Array.isArray(tags) && typeof tags !== 'string') {
      return NextResponse.json({ error: 'Ungültige Tags.' }, { status: 400 });
    }
    incomingTags = normalizeTags(tags);
    if (!includeFolderTags && !canPersistFolderTagsWithFallback) {
      return NextResponse.json(
        { error: 'Ordner-Tags können aktuell nicht gespeichert werden. Bitte Admin-Berechtigung prüfen.' },
        { status: 403 }
      );
    }
  }

  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (parent_folder !== undefined) patch.parent_folder = parent_folder;
  if (incomingTags && includeFolderTags) {
    patch.tags = parent_folder !== undefined ? uniqueTags([...ancestorTagsForMove, ...incomingTags]) : uniqueTags(incomingTags);
  } else if (parent_folder !== undefined && ancestorTagsForMove.length > 0 && includeFolderTags) {
    patch.tags = uniqueTags([...normalizeTags(currentFolder.tags), ...ancestorTagsForMove]);
  }

  const fallbackFolderTags =
    !includeFolderTags && incomingTags
      ? parent_folder !== undefined
        ? uniqueTags([...ancestorTagsForMove, ...incomingTags])
        : uniqueTags(incomingTags)
      : null;

  if (Object.keys(patch).length > 0) {
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
  }

  if (fallbackFolderTags && canPersistFolderTagsWithFallback) {
    await fetch(`${DIRECTUS_URL}/items/folders/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fallbackFolderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: fallbackFolderTags }),
    }).catch((error) => {
      console.error('Ordner-Tags konnten nicht über den Fallback gespeichert werden:', error);
    });
  }

  const shouldPropagate = Boolean(propagate_to_descendants) || parent_folder !== undefined || tags !== undefined;
  const folderTagsToPropagate = includeFolderTags
    ? normalizeTags(patch.tags ?? currentFolder.tags)
    : incomingTags ?? [];

  if (shouldPropagate && folderTagsToPropagate.length > 0) {
    const jsonHeaders = {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const subtree = await collectSubtreeTagTargets(session.accessToken, id, includeFolderTags);

      if (includeFolderTags) {
        for (const folder of subtree.folders) {
          if (folder.id === id) continue;
          const merged = uniqueTags([...normalizeTags(folder.tags), ...folderTagsToPropagate]);
          await fetch(`${DIRECTUS_URL}/items/folders/${folder.id}`, {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify({ tags: merged }),
          });
        }
      }

      const mediaHeaders = {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      };
      for (const item of subtree.mediaItems) {
        const merged = uniqueTags([...normalizeTags(item.tags), ...folderTagsToPropagate]);
        await fetch(`${DIRECTUS_URL}/items/media_library/${item.id}`, {
          method: 'PATCH',
          headers: mediaHeaders,
          body: JSON.stringify({ tags: merged }),
        });
      }
    } catch (error) {
      console.error('Tag-Vererbung im Unterbaum fehlgeschlagen:', error);
    }
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

// Sammelt den kompletten Unterbaum ab folderId -- rekursiv. WICHTIG: Der
// Aufrufer (DELETE unten) validiert folderId, BEVOR diese Funktion
// aufgerufen wird. Innerhalb der Schleife stammen alle weiteren IDs
// (queue-Einträge) aus Directus' eigener Antwort (f.id), nicht mehr vom
// Client -- dort ist keine erneute Prüfung nötig.
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

// DELETE /api/intern/folders?id=... — Ordner löschen, inklusive allem darin.
export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const folderId = request.nextUrl.searchParams.get('id');
  if (!folderId) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  // ECHTE INJECTION-FLÄCHE: folderId geht unten sowohl als Pfadsegment als
  // auch (in collectSubtree) als Filter-Wert in mehrere Directus-URLs.
  // Diese eine Prüfung schützt die gesamte nachfolgende Kaskade, weil
  // jeder weitere ID-Wert darin aus Directus' eigenen Antworten stammt.
  if (!isUuid(folderId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

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
