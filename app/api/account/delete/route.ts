import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

const CONFIRM_PHRASE = 'KONTO LÖSCHEN';

type PostForDeletion = {
  id: string;
  is_public: boolean;
  images: {
    id: string;
    file_original?: string | null;
    file_public_preview?: string | null;
    file_download?: string | null;
  }[];
};

export async function POST(request: NextRequest) {
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

  const { confirmPhrase } = await request.json().catch(() => ({}));
  if (confirmPhrase !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: 'Bitte die Bestätigungsphrase exakt eingeben.' },
      { status: 400 }
    );
  }

  // Identität kommt ausschließlich aus der eigenen Session, nie aus dem
  // Request-Body -- so kann sich niemand ein fremdes Konto löschen lassen.
  const user = await getCurrentUser(session.accessToken);
  if (!user) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('DIRECTUS_SERVICE_TOKEN fehlt -- Konto-Löschung nicht möglich.');
    return NextResponse.json(
      { error: 'Konto-Löschung ist gerade nicht verfügbar. Bitte die Redaktion kontaktieren.' },
      { status: 500 }
    );
  }
  const adminHeaders = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Alle eigenen Beiträge holen -- öffentliche und private.
    const fields = [
      'id',
      'is_public',
      'images.id',
      'images.file_original',
      'images.file_public_preview',
      'images.file_download',
    ].join(',');
    const postsRes = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[uploaded_by][_eq]=${user.id}&fields=${fields}&limit=-1`,
      { headers: adminHeaders }
    );
    if (!postsRes.ok) {
      throw new Error(`Beiträge konnten nicht geladen werden (Status ${postsRes.status})`);
    }
    const { data: posts } = (await postsRes.json()) as { data: PostForDeletion[] };

    const privatePosts = posts.filter((p) => !p.is_public);
    const publicPosts = posts.filter((p) => p.is_public);

    // Private Beiträge komplett entfernen -- erst die Dateien in der
    // Directus-Bibliothek, dann die Foto-Datensätze, dann den Beitrag selbst.
    // Diese Reihenfolge ist bewusst so gewählt, damit keine Fremdschlüssel-
    // Verweise übrig bleiben, egal wie die Directus-Relationen intern
    // konfiguriert sind.
    for (const post of privatePosts) {
      for (const img of post.images || []) {
        const fileIds = [img.file_original, img.file_public_preview, img.file_download].filter(
          (id): id is string => !!id
        );
        for (const fileId of fileIds) {
          await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
            method: 'DELETE',
            headers: adminHeaders,
          }).catch(() => {});
        }
      }
      const imageIds = (post.images || []).map((img) => img.id);
      if (imageIds.length) {
        await fetch(`${DIRECTUS_URL}/items/images`, {
          method: 'DELETE',
          headers: adminHeaders,
          body: JSON.stringify(imageIds),
        }).catch(() => {});
      }

      // Zugehörige Ordner-Zuordnungen mit aufräumen -- kosmetisch, schadet
      // aber nichts falls es mal fehlschlägt.
      await fetch(`${DIRECTUS_URL}/items/folders_posts?filter[posts_id][_eq]=${post.id}&fields=id`, {
        headers: adminHeaders,
      })
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then(async ({ data }: { data: { id: string }[] }) => {
          for (const row of data) {
            await fetch(`${DIRECTUS_URL}/items/folders_posts/${row.id}`, {
              method: 'DELETE',
              headers: adminHeaders,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
    if (privatePosts.length) {
      await fetch(`${DIRECTUS_URL}/items/posts`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify(privatePosts.map((p) => p.id)),
      });
    }

    // Öffentliche Beiträge bleiben erhalten -- nur die persönliche
    // Kontozuordnung wird entfernt, damit das Konto danach gefahrlos
    // gelöscht werden kann.
    if (publicPosts.length) {
      await fetch(`${DIRECTUS_URL}/items/posts`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          keys: publicPosts.map((p) => p.id),
          data: { uploaded_by: null },
        }),
      });
    }

    // Zuletzt das Benutzerkonto selbst löschen.
    const deleteUserRes = await fetch(`${DIRECTUS_URL}/users/${user.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (!deleteUserRes.ok) {
      throw new Error(`Benutzerkonto konnte nicht gelöscht werden (Status ${deleteUserRes.status})`);
    }
  } catch (error) {
    console.error('Konto-Löschung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Löschen fehlgeschlagen. Bitte die Redaktion kontaktieren.' },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
