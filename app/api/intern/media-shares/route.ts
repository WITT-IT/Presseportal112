import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';

const ALLOWED_VALIDITY_DAYS = [10, 20, 30];

export async function POST(request: NextRequest) {
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

  const { name, recipientName, recipientEmail, validityDays, autoDeleteOnExpiry } = await request
    .json()
    .catch(() => ({}));

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }
  const days = Number(validityDays);
  if (!ALLOWED_VALIDITY_DAYS.includes(days)) {
    return NextResponse.json({ error: 'Ungültige Gültigkeitsdauer.' }, { status: 400 });
  }

  // URL-sicherer Zufallstoken -- 24 Bytes Entropie, in Base64url kodiert
  // (keine Zeichen, die in einer URL escaped werden müssten).
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/media_shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      // organization und created_by werden serverseitig über Field Presets
      // in Directus automatisch gesetzt -- wir schicken sie bewusst nicht
      // selbst mit.
      body: JSON.stringify({
        name: String(name).trim(),
        recipient_name: recipientName ? String(recipientName).trim() : null,
        recipient_email: recipientEmail ? String(recipientEmail).trim() : null,
        token,
        active: true,
        expires_at: expiresAt,
        auto_delete_on_expiry: autoDeleteOnExpiry !== false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Freigabe anlegen fehlgeschlagen:', body);
      return NextResponse.json({ error: 'Freigabe konnte nicht angelegt werden.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Freigabe anlegen -- Netzwerkfehler:', err);
    return NextResponse.json({ error: 'Freigabe konnte nicht angelegt werden.' }, { status: 500 });
  }
}
