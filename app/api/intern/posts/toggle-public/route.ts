import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
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

// POST /api/intern/posts/toggle-public
// Body: { postId: string, makePublic: boolean }
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { postId, makePublic } = await request.json().catch(() => ({}));
  if (!postId || typeof makePublic !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
  }

  // ECHTE INJECTION-FLÄCHE: postId landet unten zweimal als Pfadsegment in
  // Directus-URLs (posts/${postId} und indirekt über die Bild-IDs, die
  // aber aus Directus' eigener Antwort stammen und daher schon vertrauens-
  // würdig sind).
  if (!isUuid(postId)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const postRes = await fetch(
    `${DIRECTUS_URL}/items/posts/${postId}?fields=id,organization,images.id,images.file_public_preview_watermarked,images.file_download_watermarked`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );
  if (!postRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: post } = await postRes.json();
  const postOrgId = typeof post?.organization === 'string' ? post.organization : post?.organization?.id;
  if (postOrgId !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const now = new Date().toISOString();

  const updatePostRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      is_public: makePublic,
      published_at: makePublic ? now : null,
    }),
  });
  if (!updatePostRes.ok) {
    console.error('[toggle-public] Beitrag-Update fehlgeschlagen:', await updatePostRes.text());
    return NextResponse.json({ error: 'Beitrag konnte nicht aktualisiert werden.' }, { status: 500 });
  }

  const images = (post?.images ?? []) as {
    id: string;
    file_public_preview_watermarked: string | null;
    file_download_watermarked: string | null;
  }[];

  await Promise.all(
    images.map((img) =>
      fetch(`${DIRECTUS_URL}/items/images/${img.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          file_public_preview: makePublic ? img.file_public_preview_watermarked : null,
          file_download: makePublic ? img.file_download_watermarked : null,
        }),
      }).catch((error) => {
        console.error(`[toggle-public] Bild ${img.id} konnte nicht aktualisiert werden:`, error);
      })
    )
  );

  return NextResponse.json({
    ok: true,
    post: { postId, isPublic: makePublic, publishedAt: makePublic ? now : null },
  });
}
