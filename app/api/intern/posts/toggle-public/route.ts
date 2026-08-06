import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  const organizationId = user?.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: 'Keine Organisation.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { postId, makePublic } = (body || {}) as { postId?: string; makePublic?: boolean };

  if (!postId || typeof makePublic !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const postRes = await fetch(
      `${DIRECTUS_URL}/items/posts/${postId}?fields=id,organization,is_public,published_at`,
      { headers: { Authorization: headers.Authorization } },
    );

    if (!postRes.ok) {
      return NextResponse.json({ ok: false, error: 'Beitrag nicht gefunden.' }, { status: 404 });
    }

    const { data: post } = await postRes.json();
    if (post.organization !== organizationId) {
      return NextResponse.json({ ok: false, error: 'Keine Berechtigung.' }, { status: 403 });
    }

    const now = new Date().toISOString();

    const patchBody: Record<string, unknown> = {
      is_public: makePublic,
      published_at: makePublic ? now : null,
    };

    const updateRes = await fetch(`${DIRECTUS_URL}/items/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => '');
      console.error('[toggle-public] Update fehlgeschlagen:', { status: updateRes.status, errText });
      return NextResponse.json({ ok: false, error: 'Beitrag konnte nicht aktualisiert werden.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      post: {
        postId,
        isPublic: makePublic,
        publishedAt: makePublic ? now : null,
      },
    });
  } catch (error) {
    console.error('[toggle-public] Fehler:', error);
    return NextResponse.json({ ok: false, error: 'Umschalten fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
