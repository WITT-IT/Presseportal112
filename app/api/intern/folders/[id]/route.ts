import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

function getSession(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { accessToken: string };
  } catch {
    return null;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  const { id } = await params;

  // Directus prüft über die Organisation-Policy automatisch, ob dieser
  // Ordner überhaupt zur eigenen Organisation gehört. Verknüpfungen zu
  // Beiträgen (Zwischentabelle) räumt Directus beim Löschen automatisch mit
  // auf -- die Beiträge selbst bleiben unangetastet, nur die Zuordnung fällt weg.
  const res = await fetch(`${DIRECTUS_URL}/items/folders/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Ordner konnte nicht gelöscht werden oder keine Berechtigung.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  const { id } = await params;
  const { name } = await request.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }

  const res = await fetch(`${DIRECTUS_URL}/items/folders/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: String(name).trim() }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Ordner konnte nicht umbenannt werden oder keine Berechtigung.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
