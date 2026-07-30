import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

export async function GET(request: NextRequest) {
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

  const caller = await getCurrentUser(session.accessToken);
  if (!caller || !(await isAdministrator(caller.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Moderation laden: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const fields = [
    'id',
    'title',
    'alarm_code',
    'published_at',
    'uploaded_by',
    'content_confirmed_at',
    'organization.name',
    'images.id',
    'images.file_public_preview',
  ].join(',');

  const res = await fetch(
    `${DIRECTUS_URL}/items/posts?filter[is_public][_eq]=true&fields=${fields}&sort=-published_at&limit=-1`,
    { headers: { Authorization: `Bearer ${serviceToken}` } }
  );
  if (!res.ok) {
    console.error(
      `Moderation laden fehlgeschlagen (Status ${res.status}):`,
      await res.text().catch(() => '')
    );
    return NextResponse.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
  const { data } = await res.json();
  return NextResponse.json({ posts: data });
}
