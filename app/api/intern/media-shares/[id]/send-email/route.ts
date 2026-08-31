import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { isUuid } from '@/lib/validate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  // Bereits sicher: 24 Byte echter Zufall, Base64url-kodiert -- 192 Bit
  // Entropie, nicht erratbar. Unverändert.
  const newToken = randomBytes(24).toString('base64url');

  const res = await fetch(`${DIRECTUS_URL}/items/media_shares/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: newToken }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Link konnte nicht erneuert werden oder keine Berechtigung.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  return NextResponse.json({ ok: true, token: newToken });
}
