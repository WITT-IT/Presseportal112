import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

const PUBLIC_FOLDER_ID = process.env.DIRECTUS_PUBLIC_FOLDER_ID;
const ALLOWED_FIELDS = ['logo', 'banner_image'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB -- Logo/Titelbild sind keine Pressefotos

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

  const user = await getCurrentUser(session.accessToken);
  if (!user || !user.organization?.id) {
    return NextResponse.json(
      { error: 'Deinem Konto ist keine Organisation zugeordnet.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (id !== user.organization.id) {
    return NextResponse.json(
      { error: 'Du kannst nur die eigene Organisationsseite bearbeiten.' },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const field = formData.get('field') as string;
  const file = formData.get('file') as File | null;

  if (!ALLOWED_FIELDS.includes(field as (typeof ALLOWED_FIELDS)[number])) {
    return NextResponse.json({ error: 'Ungültiges Feld.' }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: 'Keine Datei angegeben.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Datei ist größer als 10 MB.' }, { status: 400 });
  }

  try {
    const fileId = randomUUID();
    const uploadForm = new FormData();
    uploadForm.append('id', fileId);
    if (PUBLIC_FOLDER_ID) uploadForm.append('folder', PUBLIC_FOLDER_ID);
    uploadForm.append('file', file, file.name);

    const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: uploadForm,
    });
    if (!uploadRes.ok) {
      throw new Error(await uploadRes.text());
    }

    const patchRes = await fetch(`${DIRECTUS_URL}/items/organizations/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [field]: fileId }),
    });
    if (!patchRes.ok) {
      throw new Error(await patchRes.text());
    }

    return NextResponse.json({ ok: true, fileId });
  } catch (error) {
    console.error('Organisationsbild hochladen fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Hochladen fehlgeschlagen.' }, { status: 500 });
  }
}
