import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdministrator, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { sendRegistrationApprovedEmail } from '@/lib/email';

async function requireAdmin(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }
  const caller = await getCurrentUser(session.accessToken);
  if (!caller) return null;
  if (!(await isAdministrator(caller.id))) return null;
  return caller;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin(request);
  if (!caller) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }
  const { id } = await params;
  const { organizationId, organizationName } = await request.json().catch(() => ({}));
  if (!organizationId) {
    return NextResponse.json({ error: 'Bitte eine Organisation auswählen.' }, { status: 400 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Registrierung freigeben: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const adminHeaders = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${DIRECTUS_URL}/users/${id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ organization: organizationId, status: 'active' }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Registrierung freigeben fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Freigabe fehlgeschlagen.' }, { status: 500 });
  }

  // Best-effort Benachrichtigung -- die Freigabe selbst ist zu diesem
  // Zeitpunkt schon passiert und wird bei einem Mail-Fehler nicht
  // rückgängig gemacht. Bewusst frisch von Directus nachgeladen statt dem
  // Nutzer zu vertrauen, was der Browser mitschickt.
  try {
    const userRes = await fetch(`${DIRECTUS_URL}/users/${id}?fields=email,first_name`, {
      headers: adminHeaders,
    });
    if (userRes.ok) {
      const { data: user } = await userRes.json();
      if (user?.email) {
        await sendRegistrationApprovedEmail({
          to: user.email,
          name: user.first_name || '',
          organizationName: organizationName || 'deiner Organisation',
        });
      }
    }
  } catch (error) {
    console.error('Freigabe-Bestätigungsmail fehlgeschlagen:', error);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin(request);
  if (!caller) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }
  const { id } = await params;

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Registrierung ablehnen: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const res = await fetch(`${DIRECTUS_URL}/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Ablehnen fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
