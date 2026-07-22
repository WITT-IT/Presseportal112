import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

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

  const { id, isPublic } = await request.json().catch(() => ({}));
  if (!id || typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  // Kein manueller Besitz-Check nötig -- die Organisation-Policy in Directus
  // lässt ein Update nur zu, wenn das Bild wirklich zur eigenen Organisation
  // gehört. Gehört es einer anderen, antwortet Directus selbst mit 403.
  const res = await fetch(`${DIRECTUS_URL}/items/images/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      is_public: isPublic,
      published_at: isPublic ? new Date().toISOString() : null,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Aktualisierung fehlgeschlagen.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
