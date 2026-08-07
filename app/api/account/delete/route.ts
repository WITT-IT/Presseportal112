import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
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

// Collections, auf denen dieser Nutzer als user_created/user_updated
// (Directus-Systemfelder) stehen könnte. Diese Liste ist der eigentliche
// Grund, warum Konto-Löschungen bisher manuelles Aufräumen in Directus
// brauchten -- jede Collection, die hier fehlt, blockt die finale
// User-Löschung mit einem Fremdschlüssel-Fehler, sobald der Nutzer
// irgendwas in dieser Collection angelegt hat.
//
// Fehlt das Feld auf einer Collection (weil sie ohne die optionalen
// Systemfelder angelegt wurde), bricht nullifyReferences() dafür einfach
// lautlos ab -- diese Liste großzügig zu halten ist also gefahrlos.
const USER_FIELD_COLLECTIONS: { collection: string; field: string }[] = [
  { collection: 'media_library', field: 'user_created' },
  { collection: 'media_library', field: 'user_updated' },
  { collection: 'folders', field: 'user_created' },
  { collection: 'folders', field: 'user_updated' },
  { collection: 'posts', field: 'user_created' },
  { collection: 'posts', field: 'user_updated' },
  { collection: 'images', field: 'user_created' },
  { collection: 'images', field: 'user_updated' },
  { collection: 'media_shares', field: 'user_created' },
  { collection: 'media_shares', field: 'user_updated' },
];

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

  const { confirmPhrase, targetUserId } = await request.json().catch(() => ({}));
  if (confirmPhrase !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: 'Bitte die Bestätigungsphrase exakt eingeben.' },
      { status: 400 }
    );
  }

  const caller = await getCurrentUser(session.accessToken);
  if (!caller) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  let effectiveTargetId = caller.id as string;
  if (targetUserId && targetUserId !== caller.id) {
    const callerIsAdmin = await isAdministrator(caller.id);
    if (!callerIsAdmin) {
      return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
    }
    effectiveTargetId = targetUserId;
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

  // Kleiner Helfer: alle Datensätze einer Collection finden, die per FK auf
  // diesen Nutzer verweisen, und das Feld auf null setzen -- statt die
  // Datensätze selbst zu löschen. So bleiben z. B. bereits verschickte
  // Einladungen, Freigaben oder Bibliotheks-Einträge funktionsfähig
  // erhalten, nur der Bezug zum gelöschten Konto verschwindet.
  async function nullifyReferences(collection: string, field: string, userId: string) {
    try {
      const res = await fetch(
        `${DIRECTUS_URL}/items/${collection}?filter[${field}][_eq]=${userId}&fields=id&limit=-1`,
        { headers: adminHeaders }
      );
      if (!res.ok) return;
      const { data } = (await res.json()) as { data: { id: string }[] };
      for (const row of data) {
        await fetch(`${DIRECTUS_URL}/items/${collection}/${row.id}`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({ [field]: null }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error(`nullifyReferences(${collection}.${field}) fehlgeschlagen:`, error);
    }
  }

  try {
    const fields = [
      'id',
      'is_public',
      'images.id',
      'images.file_original',
      'images.file_public_preview',
      'images.file_download',
    ].join(',');
    const postsRes = await fetch(
      `${DIRECTUS_URL}/items/posts?filter[uploaded_by][_eq]=${effectiveTargetId}&fields=${fields}&limit=-1`,
      { headers: adminHeaders }
    );
    if (!postsRes.ok) {
      throw new Error(`Beiträge konnten nicht geladen werden (Status ${postsRes.status})`);
    }
    const { data: posts } = (await postsRes.json()) as { data: PostForDeletion[] };

    const privatePosts = posts.filter((p) => !p.is_public);
    const publicPosts = posts.filter((p) => p.is_public);

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

      // Zugehörige Ordner- UND Freigabe-Zuordnungen mit aufräumen -- beide
      // Junction-Tabellen, kosmetisch, schadet aber nichts falls es mal
      // fehlschlägt.
      for (const junction of ['folders_posts', 'media_shares_posts']) {
        await fetch(`${DIRECTUS_URL}/items/${junction}?filter[posts_id][_eq]=${post.id}&fields=id`, {
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
    }
    if (privatePosts.length) {
      await fetch(`${DIRECTUS_URL}/items/posts`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify(privatePosts.map((p) => p.id)),
      });
    }

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

    // Eigene, benannte Felder nullen (Einladungssystem, Medienfreigaben).
    await nullifyReferences('organization_invites', 'created_by', effectiveTargetId);
    await nullifyReferences('organization_invites', 'used_by', effectiveTargetId);
    await nullifyReferences('media_shares', 'created_by', effectiveTargetId);

    // Directus-Systemfelder (user_created/user_updated) auf allen
    // Collections nullen, auf denen dieser Nutzer je etwas angelegt oder
    // geändert hat -- ohne das lehnt Directus die finale User-Löschung
    // unten mit einem Fremdschlüssel-Fehler ab. Das ist der eigentliche
    // Grund, warum das bisher manuelles Nacharbeiten in Directus brauchte.
    for (const { collection, field } of USER_FIELD_COLLECTIONS) {
      await nullifyReferences(collection, field, effectiveTargetId);
    }

    const deleteUserRes = await fetch(`${DIRECTUS_URL}/users/${effectiveTargetId}`, {
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
  if (effectiveTargetId === caller.id) {
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}
