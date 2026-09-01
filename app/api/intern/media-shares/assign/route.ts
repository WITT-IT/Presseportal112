import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { isUuid } from '@/lib/validate';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Sammelt alle media_library-IDs im Ordner UND rekursiv in allen
// Unterordnern. WICHTIG: folderId wird vom Aufrufer (POST unten) bereits
// validiert, bevor diese Funktion aufgerufen wird. Innerhalb der Schleife
// stammen alle weiteren IDs aus Directus' eigener Antwort, nicht mehr vom
// Client -- dort ist keine erneute Prüfung nötig.
async function collectMediaIdsRecursive(folderId: string, accessToken: string): Promise<string[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const mediaIds: string[] = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const [subfoldersRes, mediaRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/folders?filter[parent_folder][_eq]=${current}&fields=id`, { headers }),
      fetch(`${DIRECTUS_URL}/items/media_library?filter[folder][_eq]=${current}&fields=id`, { headers }),
    ]);

    if (subfoldersRes.ok) {
      const { data } = await subfoldersRes.json();
      for (const f of data as { id: string }[]) queue.push(f.id);
    }
    if (mediaRes.ok) {
      const { data } = await mediaRes.json();
      mediaIds.push(...(data as { id: string }[]).map((m) => m.id));
    }
  }

  return mediaIds;
}

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const { shareId, postId, mediaId, folderId, action } = await request.json().catch(() => ({}));
  if (!shareId || (action !== 'add' && action !== 'remove')) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  if (!postId && !mediaId && !folderId) {
    return NextResponse.json({ error: 'postId, mediaId oder folderId erforderlich.' }, { status: 400 });
  }

  // ECHTE INJECTION-FLÄCHE: alle vier IDs landen unten mehrfach als
  // Pfadsegment bzw. Filter-Wert in Directus-URLs. Nur die tatsächlich
  // übergebenen Felder werden geprüft -- ansonsten würde z.B. "postId"
  // fälschlich als Pflichtfeld verlangt, obwohl gerade ein Ordner oder
  // ein Bibliotheksbild gemeint ist.
  if (!isUuid(shareId)) {
    return NextResponse.json({ error: 'Ungültige Freigabe-ID.' }, { status: 400 });
  }
  if (postId !== undefined && postId !== null && !isUuid(postId)) {
    return NextResponse.json({ error: 'Ungültige Beitrags-ID.' }, { status: 400 });
  }
  if (mediaId !== undefined && mediaId !== null && !isUuid(mediaId)) {
    return NextResponse.json({ error: 'Ungültige Bild-ID.' }, { status: 400 });
  }
  if (folderId !== undefined && folderId !== null && !isUuid(folderId)) {
    return NextResponse.json({ error: 'Ungültige Ordner-ID.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  // Kompletten Ordner (inkl. aller Unterordner-Ebenen) freigeben.
  if (folderId) {
    let mediaIds: string[];
    try {
      mediaIds = await collectMediaIdsRecursive(folderId, session.accessToken);
    } catch (error) {
      console.error('Ordner-Inhalt konnte nicht ermittelt werden:', error);
      return NextResponse.json({ error: 'Ordnerinhalt konnte nicht geladen werden.' }, { status: 502 });
    }

    if (mediaIds.length === 0) {
      return NextResponse.json({ ok: true, added: 0 });
    }

    const existingRes = await fetch(
      `${DIRECTUS_URL}/items/media_shares_media?filter[media_shares_id][_eq]=${shareId}&fields=media_library_id`,
      { headers }
    );
    const existingIds = new Set<string>();
    if (existingRes.ok) {
      const { data } = await existingRes.json();
      for (const row of data as { media_library_id: string }[]) existingIds.add(row.media_library_id);
    }

    const toAdd = mediaIds.filter((id) => !existingIds.has(id));
    let added = 0;
    for (const id of toAdd) {
      const res = await fetch(`${DIRECTUS_URL}/items/media_shares_media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ media_shares_id: shareId, media_library_id: id }),
      });
      if (res.ok) added++;
    }

    return NextResponse.json({ ok: true, added, total: mediaIds.length });
  }

  // Einzelnes Bibliotheks-Bild.
  if (mediaId) {
    if (action === 'add') {
      const res = await fetch(`${DIRECTUS_URL}/items/media_shares_media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ media_shares_id: shareId, media_library_id: mediaId }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('Bild zu Freigabe hinzufügen fehlgeschlagen:', body);
        return NextResponse.json({ error: 'Hinzufügen fehlgeschlagen.' }, { status: 500 });
      }
    } else {
      const findRes = await fetch(
        `${DIRECTUS_URL}/items/media_shares_media?filter[media_shares_id][_eq]=${shareId}&filter[media_library_id][_eq]=${mediaId}&fields=id&limit=1`,
        { headers }
      );
      if (findRes.ok) {
        const { data } = await findRes.json();
        if (data?.[0]?.id) {
          await fetch(`${DIRECTUS_URL}/items/media_shares_media/${data[0].id}`, {
            method: 'DELETE',
            headers,
          });
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Beitrags-Zuordnung.
  if (action === 'add') {
    const res = await fetch(`${DIRECTUS_URL}/items/media_shares_posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ media_shares_id: shareId, posts_id: postId }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Beitrag zu Freigabe hinzufügen fehlgeschlagen:', body);
      return NextResponse.json({ error: 'Hinzufügen fehlgeschlagen.' }, { status: 500 });
    }
  } else {
    const findRes = await fetch(
      `${DIRECTUS_URL}/items/media_shares_posts?filter[media_shares_id][_eq]=${shareId}&filter[posts_id][_eq]=${postId}&fields=id&limit=1`,
      { headers }
    );
    if (findRes.ok) {
      const { data } = await findRes.json();
      if (data?.[0]?.id) {
        await fetch(`${DIRECTUS_URL}/items/media_shares_posts/${data[0].id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
