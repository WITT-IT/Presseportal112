import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { sendRegistrationReceivedEmail, sendNewRegistrationAdminNotification } from '@/lib/email';

// Bewusst der reguläre /users-Endpunkt, nicht /users/register -- letzterer
// unterstützt laut Directus nur first_name/last_name als Zusatzfelder, wir
// brauchen aber auch requested_organization_name und requested_gewerk.
// Die Public-Policy in Directus erzwingt über Field Presets automatisch
// role="Organisation" und status="draft", egal was hier sonst mitgeschickt
// würde -- deshalb ist dieser Endpunkt sicher, ohne dass wir das selbst
// nochmal prüfen müssen.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const {
    first_name,
    last_name,
    email,
    password,
    requested_organization_name,
    requested_gewerk,
    requested_website,
    requested_social_links,
    requested_account_type,
  } = body || {};

  const accountType = requested_account_type === 'press' ? 'press' : 'organization';

  if (!first_name || !last_name || !email || !password) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }
  // Gewerk ist nur bei einer BOS-Organisation Pflicht -- eine Redaktion hat
  // kein Gewerk.
  if (accountType === 'organization' && !requested_gewerk) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }
  if (accountType === 'press' && !requested_organization_name) {
    return NextResponse.json(
      { error: 'Bitte Redaktion oder Publikation angeben.' },
      { status: 400 }
    );
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
      { status: 400 }
    );
  }

  // Beide Zusatzfelder sind bewusst optional -- nur übernehmen, wenn
  // tatsächlich etwas eingetragen wurde.
  const website = requested_website ? String(requested_website).trim() : null;
  const socialLinks: Record<string, string> = {};
  if (requested_social_links && typeof requested_social_links === 'object') {
    for (const [key, value] of Object.entries(requested_social_links)) {
      if (typeof value === 'string' && value.trim()) {
        socialLinks[key] = value.trim();
      }
    }
  }

  const res = await fetch(`${DIRECTUS_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name,
      last_name,
      email,
      password,
      requested_organization_name: requested_organization_name || null,
      requested_gewerk: accountType === 'organization' ? requested_gewerk : null,
      requested_website: website,
      requested_social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      requested_account_type: accountType,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Registrierung fehlgeschlagen:', errorBody);
    const isDuplicate = errorBody.includes('RECORD_NOT_UNIQUE');
    return NextResponse.json(
      {
        error: isDuplicate
          ? 'Für diese E-Mail-Adresse existiert bereits ein Konto.'
          : 'Registrierung gerade nicht möglich. Bitte später erneut versuchen.',
      },
      { status: isDuplicate ? 409 : 502 }
    );
  }

  // Beide Mails bewusst best-effort -- ein Mailserver-Ausfall (oder noch
  // gar nicht konfiguriertes SMTP) soll die Registrierung selbst nicht
  // verhindern, die ist zu diesem Zeitpunkt schon sicher in Directus
  // gespeichert.
  try {
    await sendRegistrationReceivedEmail({ to: email, name: first_name });
  } catch (error) {
    console.error('Registrierungsbestätigung an Nutzer fehlgeschlagen:', error);
  }

  const adminNotifyAddress = process.env.CONTACT_FALLBACK_EMAIL;
  if (adminNotifyAddress) {
    try {
      await sendNewRegistrationAdminNotification({
        to: adminNotifyAddress,
        registrantName: `${first_name} ${last_name}`,
        registrantEmail: email,
        requestedOrganizationName: requested_organization_name || null,
        requestedGewerk: accountType === 'press' ? 'Presse' : requested_gewerk,
      });
    } catch (error) {
      console.error('Admin-Benachrichtigung über neue Registrierung fehlgeschlagen:', error);
    }
  } else {
    console.warn(
      'CONTACT_FALLBACK_EMAIL fehlt -- keine Admin-Benachrichtigung über neue Registrierung verschickt.'
    );
  }

  return NextResponse.json({ ok: true });
}
