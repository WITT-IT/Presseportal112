import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { serviceHeaders } from '@/lib/messaging';

export async function DELETE(
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

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  const { id } = await params;

  let headers;
  try {
    headers = serviceHeaders();
  } catch {
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  // Sicherstellen, dass diese Einladung wirklich zur eigenen Organisation
  // gehört, bevor irgendwas gelöscht wird.
  const checkRes = await fetch(
    `${DIRECTUS_URL}/items/organization_invites/${id}?fields=organization`,
    { headers }
  );
  if (!checkRes.ok) {
    return NextResponse.json({ error: 'Einladung nicht gefunden.' }, { status: 404 });
  }
  const { data: invite } = await checkRes.json();
  if (invite?.organization !== user.organization.id) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const deleteRes = await fetch(`${DIRECTUS_URL}/items/organization_invites/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!deleteRes.ok) {
    return NextResponse.json({ error: 'Widerrufen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
