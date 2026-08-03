import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export async function PATCH(
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
  // Zusätzliche eigene Prüfung, obwohl Directus das über die Policy sowieso
  // durchsetzen sollte -- doppelt hält besser bei Schreibzugriffen.
  if (id !== user.organization.id) {
    return NextResponse.json(
      { error: 'Du kannst nur die eigene Organisationsseite bearbeiten.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { description, website, social_links, show_website, show_social_links } = body;

  const patch: Record<string, unknown> = {};
  if (description !== undefined) {
    patch.description = description ? String(description).trim().slice(0, 1000) : null;
  }
  if (website !== undefined) {
    patch.website = website ? String(website).trim() : null;
  }
  if (social_links !== undefined) {
    const cleaned: Record<string, string> = {};
    if (social_links && typeof social_links === 'object') {
      for (const [key, value] of Object.entries(social_links)) {
        if (typeof value === 'string' && value.trim()) cleaned[key] = value.trim();
      }
    }
    patch.social_links = Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  if (show_website !== undefined) patch.show_website = !!show_website;
  if (show_social_links !== undefined) patch.show_social_links = !!show_social_links;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine Änderungen übermittelt.' }, { status: 400 });
  }

  const res = await fetch(`${DIRECTUS_URL}/items/organizations/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Organisationsprofil aktualisieren fehlgeschlagen:', errorBody);
    return NextResponse.json({ error: 'Aktualisieren fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
