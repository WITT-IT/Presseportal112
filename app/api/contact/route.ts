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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, recipient_organization, subject, message } = body || {};

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }

  // Immer zuerst in Directus ablegen -- verlässliches Archiv, unabhängig
  // davon, ob der direkte Mailversand gleich klappt.
  const storeRes = await fetch(`${DIRECTUS_URL}/items/contact_messages`, {
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
        replyTo: email,
        senderName: name,
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
