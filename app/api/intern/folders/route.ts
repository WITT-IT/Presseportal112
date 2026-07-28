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

  const { name } = await request.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/folders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      // organization wird serverseitig über das Field Preset in Directus
      // automatisch auf die eigene Organisation gesetzt -- wir schicken es
      // bewusst nicht selbst mit.
      // WICHTIG: falls "folder_type" in Directus ein Pflichtfeld ohne Default
      // ist, hier zusätzlich "folder_type: 'custom'" (oder passenden Wert)
      // ergänzen -- siehe Hinweis im Hand-off zu diesem Baustein.
      body: JSON.stringify({ name: String(name).trim() }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Ordner anlegen fehlgeschlagen:', body);
      return NextResponse.json({ error: 'Ordner konnte nicht angelegt werden.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Ordner anlegen -- Netzwerkfehler:', err);
    return NextResponse.json({ error: 'Ordner konnte nicht angelegt werden.' }, { status: 500 });
  }
}
