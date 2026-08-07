import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import sanitizeHtml from 'sanitize-html';

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
};

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// POST /api/intern/update
// Body (JSON): { id, post_type, title, event_date, alarm_code, location, tags, caption, article_body? }
//
// Reine Metadaten-Aktualisierung. Kein Foto-Upload mehr möglich -- das Foto
// eines Beitrags steht seit der Veröffentlichung fest. Wer ein anderes Foto
// braucht, zieht den Beitrag zurück (privat schalten oder löschen) und
// veröffentlicht neu übers Studio.
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { id, post_type, title, event_date, alarm_code, location, tags, caption, article_body } = body;

  if (!id) {
    return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const checkRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}?fields=id,organization,images.id`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!checkRes.ok) {
    return NextResponse.json({ error: 'Beitrag nicht gefunden.' }, { status: 404 });
  }
  const { data: existing } = await checkRes.json();
  const orgId = typeof existing?.organization === 'string' ? existing.organization : existing?.organization?.id;
  if (orgId !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const isStock = post_type === 'stockfoto';
  const sanitizedArticleBody =
    typeof article_body === 'string' && article_body.trim()
      ? sanitizeHtml(article_body, ARTICLE_SANITIZE_OPTIONS)
      : null;

  const postBody: Record<string, unknown> = {
    post_type,
    title: isStock ? null : title || null,
    event_date: isStock ? null : event_date || null,
    alarm_code: isStock ? null : alarm_code || null,
    location: isStock ? null : location || null,
    tags: Array.isArray(tags) ? tags : [],
  };
  if (sanitizedArticleBody !== null) {
    postBody.article_body = sanitizedArticleBody;
  }

  const postRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(postBody),
  });
  if (!postRes.ok) {
    console.error('[intern/update] Beitrag-Update fehlgeschlagen:', await postRes.text());
    return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }

  // Caption steht auf dem images-Datensatz.
  const images = (existing?.images ?? []) as { id: string }[];
  if (typeof caption === 'string' && images[0]) {
    await fetch(`${DIRECTUS_URL}/items/images/${images[0].id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ caption }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
