import { randomUUID } from 'node:crypto';
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

// Legt "Öffentlich" und "Unsortiert" als Systemordner für eine neue Org an.
// Inline statt separater Datei -- kein extra Import nötig.
async function createSystemFolders(serviceToken: string, organizationId: string): Promise<void> {
  const headers = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };
  const folders = [
    { name: 'Öffentlich', system_role: 'public' },
    { name: 'Unsortiert', system_role: 'unsorted' },
  ] as const;
  await Promise.allSettled(
    folders.map((f) =>
      fetch(`${DIRECTUS_URL}/items/folders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: randomUUID(),
          name: f.name,
          organization: organizationId,
          is_system_folder: true,
          system_role: f.system_role,
        }),
      })
    )
  );
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
  const { organizationId, organizationName, newOrganizationName, newOrganizationGewerk } =
    await request.json().catch(() => ({}));

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Registrierung freigeben: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }
  const adminHeaders = {
    Authorization: `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  };

  let finalOrganizationId: string;
  let finalOrganizationName: string;
  let isNewOrganization = false;

  if (newOrganizationName) {
    const regRes = await fetch(`${DIRECTUS_URL}/users/${id}?fields=requested_account_type`, {
      headers: adminHeaders,
    });
    const regData = regRes.ok ? (await regRes.json()).data : null;
    const accountType = regData?.requested_account_type === 'press' ? 'press' : 'bos';

    const name = String(newOrganizationName).trim();
    if (!name) {
      return NextResponse.json({ error: 'Bitte einen Organisationsnamen angeben.' }, { status: 400 });
    }
    if (accountType === 'bos' && !newOrganizationGewerk) {
      return NextResponse.json({ error: 'Bitte ein Gewerk auswählen.' }, { status: 400 });
    }

    finalOrganizationId = randomUUID();
    const createRes = await fetch(`${DIRECTUS_URL}/items/organizations`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: finalOrganizationId,
        name,
        gewerk: accountType === 'bos' ? newOrganizationGewerk : null,
        organization_type: accountType,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      console.error('Organisation anlegen fehlgeschlagen:', body);
      return NextResponse.json(
        { error: 'Organisation konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }
    finalOrganizationName = name;
    isNewOrganization = true;
  } else {
    if (!organizationId) {
      return NextResponse.json({ error: 'Bitte eine Organisation auswählen.' }, { status: 400 });
    }
    finalOrganizationId = organizationId;
    finalOrganizationName = organizationName || 'deiner Organisation';
  }

  const res = await fetch(`${DIRECTUS_URL}/users/${id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ organization: finalOrganizationId, status: 'active' }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Registrierung freigeben fehlgeschlagen:', body);
    return NextResponse.json({ error: 'Freigabe fehlgeschlagen.' }, { status: 500 });
  }

  // Systemordner für neue Organisationen automatisch anlegen.
  // Best-effort: schlägt das fehl, bleibt die Freigabe trotzdem gültig.
  if (isNewOrganization) {
    try {
      await createSystemFolders(serviceToken, finalOrganizationId);
    } catch (error) {
      console.error('Systemordner anlegen fehlgeschlagen (nicht kritisch):', error);
    }
  }

  // Bestätigungsmail an den User.
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
          organizationName: finalOrganizationName,
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
