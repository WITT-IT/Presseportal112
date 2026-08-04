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

// Prüft das Turnstile-Token serverseitig gegen Cloudflare. Fehlt der Secret
// Key (z. B. lokale Entwicklung ohne Cloudflare-Zugang), wird die Prüfung
// bewusst übersprungen statt das Formular komplett zu blockieren.
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
  const { vorname, recipient_organization, subject, message, turnstileToken, website } =
    body || {};

  // Honeypot-Feld gefüllt -- das kann kein echter Mensch sein (Feld ist
  // unsichtbar). Bewusst "erfolgreich" antworten, ohne irgendwas zu tun --
  // das Formular wirkt für den Bot funktionierend, wird aber ignoriert.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!vorname || !subject || !message) {
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

  // Immer zuerst in Directus ablegen -- verlässliches Archiv, unabhängig
  // davon, ob der direkte Mailversand gleich klappt.
  const storeRes = await fetch(`${DIRECTUS_URL}/items/contact_messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: vorname,
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

  // Danach best-effort direkt zustellen -- an die hinterlegte Organisations-
  // Mail, oder ohne Auswahl an die allgemeine Redaktionsadresse. Schlägt das
  // fehl, ist durch die Speicherung oben trotzdem nichts verloren; ihr seht
  // die Nachricht dann einfach in Directus statt im Postfach.
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
        senderName: vorname,
        subject,
        message,
        organizationName,
      });
    } else {
      console.warn('Kontaktformular: keine Zieladresse verfügbar, nur in Directus gespeichert.');
    }
  } catch (error) {
    console.error('Kontaktformular: E-Mail-Versand fehlgeschlagen:', error);
    // Bewusst kein Fehler an den Absender zurückgeben -- die Nachricht ist
    // ja sicher gespeichert, nur die sofortige Zustellung hat nicht geklappt.
  }

  return NextResponse.json({ ok: true });
}
