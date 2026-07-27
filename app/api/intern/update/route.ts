import sanitizeHtml from 'sanitize-html';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

// Gleiche Regeln wie beim Hochladen -- der Artikeltext landet ja am Ende
// genauso öffentlich als HTML auf der Seite.
const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'h2', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
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

  const body = await request.json().catch(() => null);
  const { id, title, event_date, alarm_code, location, tags, article_body, captions } =
    body || {};

  if (!id || !event_date) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

  const sanitizedBody =
    typeof article_body === 'string' && article_body.trim()
      ? sanitizeHtml(article_body, ARTICLE_SANITIZE_OPTIONS)
      : null;

  // Directus prüft über die Organisation-Policy automatisch, ob dieser
  // Beitrag überhaupt zur eigenen Organisation gehört -- kein manueller
  // Besitz-Check von uns nötig.
  const postRes = await fetch(`${DIRECTUS_URL}/items/posts/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      title: title || null,
      event_date,
      alarm_code: alarm_code || null,
      location: location || null,
      tags: Array.isArray(tags) ? tags : [],
      article_body: sanitizedBody,
    }),
  });

  if (!postRes.ok) {
    const errBody = await postRes.text();
    console.error('Beitrag aktualisieren fehlgeschlagen:', errBody);
    return NextResponse.json(
      { error: 'Speichern fehlgeschlagen oder keine Berechtigung.' },
      { status: postRes.status === 403 ? 403 : 500 }
    );
  }

  // Bildunterschriften einzeln aktualisieren -- einzeln statt als Batch,
  // damit ein Problem bei einem Foto die anderen nicht verhindert.
  if (captions && typeof captions === 'object') {
    await Promise.allSettled(
      Object.entries(captions as Record<string, string>).map(([imageId, caption]) =>
        fetch(`${DIRECTUS_URL}/items/images/${imageId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ caption: caption || null }),
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
