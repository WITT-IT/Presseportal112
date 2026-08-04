import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { sendContactEmail } from '@/lib/email';

// Nutzt einen Dienst-Token (voller Zugriff), NICHT die öffentliche Directus-
// Anbindung -- contact_email ist absichtlich für niemanden sonst lesbar,
// auch nicht für eingeloggte Organisationen. Nur unser eigener Server darf
// das Feld sehen, um die Mail zuzustellen.
async function getOrganizationContact(
  orgId: string
): Promise<{ name: string; contact_email: string | null } | null> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('DIRECTUS_SERVICE_TOKEN fehlt -- kann Organisations-Mail nicht nachschlagen.');
    return null;
  }
  const res = await fetch(
    `${DIRECTUS_URL}/items/organizations/${orgId}?fields=name,contact_email`,
    { headers: { Authorization: `Bearer ${serviceToken}` } }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY fehlt -- Sicherheitsprüfung wird übersprungen.');
    return true;
  }
  try {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);
    if (remoteIp) params.set('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile-Prüfung fehlgeschlagen:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { vorname, nachname, recipient_organization, subject, message, turnstileToken, website } =
    body || {};

  // Honeypot-Feld gefüllt -- Bewusst "erfolgreich" antworten, ohne irgendwas zu tun.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!vorname || !nachname || !subject || !message) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }

  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return NextResponse.json(
        { error: 'Bitte die Sicherheitsprüfung abschließen.' },
        { status: 400 }
      );
    }
    const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const verified = await verifyTurnstile(turnstileToken, remoteIp);
    if (!verified) {
      return NextResponse.json(
        { error: 'Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.' },
        { status: 400 }
      );
    }
  }

  const fullName = `${String(vorname).trim()} ${String(nachname).trim()}`;

  // Immer zuerst in Directus ablegen -- verlässliches Archiv.
  const storeRes = await fetch(`${DIRECTUS_URL}/items/contact_messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fullName,
      email: null,
      recipient_organization: recipient_organization || null,
      subject,
      message,
    }),
  });

  if (!storeRes.ok) {
    const errorBody = await storeRes.text();
    console.error('Kontaktformular: Speichern fehlgeschlagen:', errorBody);
    return NextResponse.json(
      { error: 'Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.' },
      { status: 502 }
    );
  }

  try {
    let to = process.env.CONTACT_FALLBACK_EMAIL || null;
    let organizationName: string | undefined;

    if (recipient_organization) {
      const org = await getOrganizationContact(recipient_organization);
      if (org?.contact_email) {
        to = org.contact_email;
        organizationName = org.name;
      } else {
        console.warn(
          `Kontaktformular: Organisation ${recipient_organization} hat keine contact_email hinterlegt, nutze Fallback.`
        );
      }
    }

    if (to) {
      await sendContactEmail({
        to,
        senderName: fullName,
        subject,
        message,
        organizationName,
      });
    } else {
      console.warn('Kontaktformular: keine Zieladresse verfügbar, nur in Directus gespeichert.');
    }
  } catch (error) {
    console.error('Kontaktformular: E-Mail-Versand fehlgeschlagen:', error);
  }

  return NextResponse.json({ ok: true });
}
