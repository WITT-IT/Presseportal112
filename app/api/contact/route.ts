import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, recipient_organization, subject, message } = body || {};

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }

  const res = await fetch(`${DIRECTUS_URL}/items/contact_messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      recipient_organization: recipient_organization || null,
      subject,
      message,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Kontaktformular fehlgeschlagen:', errorBody);
    return NextResponse.json(
      { error: 'Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
