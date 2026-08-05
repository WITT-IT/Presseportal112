import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// POST /api/intern/folders — neuen Ordner anlegen
export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) {
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  const { name } = await request.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }

  const id = randomUUID();
  const res = await fetch(`${DIRECTUS_URL}/items/folders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      name: String(name).trim(),
      is_system_folder: false,
      system_role: null,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Ordner anlegen fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Ordner konnte nicht angelegt werden.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}

// DELETE /api/intern/folders/:id — Ordner löschen (Systemordner sind geschützt)
export async function DELETE(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const folderId = request.nextUrl.searchParams.get('id');
  if (!folderId) return NextResponse.json({ error: 'Keine ID.' }, { status: 400 });

  // Systemordner-Schutz: erst prüfen ob is_system_folder=true.
  const checkRes = await fetch(
    `${DIRECTUS_URL}/items/folders/${folderId}?fields=id,is_system_folder,system_role`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );
  if (checkRes.ok) {
    const { data } = await checkRes.json();
    if (data?.is_system_folder) {
      return NextResponse.json(
        { error: 'Systemordner können nicht gelöscht werden.' },
        { status: 403 }
      );
    }
  }

  const res = await fetch(`${DIRECTUS_URL}/items/folders/${folderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
