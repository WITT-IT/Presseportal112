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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if ('recipientName' in body) {
    patch.recipient_name = body.recipientName ? String(body.recipientName).trim() : null;
  }
  if ('recipientEmail' in body) {
    patch.recipient_email = body.recipientEmail ? String(body.recipientEmail).trim() : null;
  }
  if (typeof body.active === 'boolean') {
    patch.active = body.active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine Änderungen übergeben.' }, { status: 400 });
  }

  const res = await fetch(`${DIRECTUS_URL}/items/media_shares/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Freigabe konnte nicht aktualisiert werden oder keine Berechtigung.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
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

  const res = await fetch(`${DIRECTUS_URL}/items/media_shares/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Freigabe konnte nicht gelöscht werden oder keine Berechtigung.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
