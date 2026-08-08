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

  const { shareId, mediaId, action } = await request.json().catch(() => ({}));
  if (!shareId || !mediaId || (action !== 'add' && action !== 'remove')) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };

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
