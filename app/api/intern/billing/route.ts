import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { isPlanId, subscriptionGrantsAccess } from '@/lib/plans';
import { createCheckoutSession, createBillingPortalSession } from '@/lib/stripe';

function getSession(request: NextRequest): { accessToken: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

// Abrechnungsdaten der Organisation -- Service-Token, weil das
// System-/Abrechnungsdaten sind, keine Nutzerinhalte.
//
// Liefert null bei Lesefehler statt zu werfen: Für den Checkout-Zweig wird
// ein Fehlschlag hier NICHT hart blockiert (siehe unten), damit ein
// vorübergehendes Rechteproblem an einem Nebenfeld keinen zahlungswilligen
// Kunden aussperrt.
async function getOrgBillingInfo(organizationId: string): Promise<{
  name: string;
  contactEmail: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
} | null> {
  const token = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!token) {
    console.error('getOrgBillingInfo: DIRECTUS_SERVICE_TOKEN fehlt.');
    return null;
  }
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=name,contact_email,stripe_customer_id,subscription_status`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`getOrgBillingInfo(${organizationId}) fehlgeschlagen (Status ${res.status}).`);
      return null;
    }
    const { data } = await res.json();
    return {
      name: data?.name || '',
      contactEmail: data?.contact_email || null,
      stripeCustomerId: data?.stripe_customer_id || null,
      subscriptionStatus: data?.subscription_status || null,
    };
  } catch (err) {
    console.error(`getOrgBillingInfo(${organizationId}) fehlgeschlagen:`, err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode');

  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const user = await getCurrentUser(session.accessToken);
  if (!user?.organization?.id) return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });

  const org = await getOrgBillingInfo(user.organization.id);

  if (mode === 'checkout') {
    const body = await request.json().catch(() => ({}));
    if (!isPlanId(body.planId) || body.planId === 'erkundung') {
      return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 });
    }

    // Verteidigung gegen doppelte Abos: Wer bereits ein laufendes Abo hat,
    // bucht NICHT über einen zweiten Checkout, sondern wechselt im
        // Kundenportal -- sonst legt Stripe ein zweites, paralleles Abo an.
    // Das Frontend leitet in diesem Fall bereits zum Portal um; diese
    // Prüfung ist die serverseitige Absicherung, falls jemand die Anfrage
    // direkt schickt.
    if (org && subscriptionGrantsAccess(org.subscriptionStatus)) {
      return NextResponse.json(
        { error: 'Für diese Organisation läuft bereits ein Abo. Bitte über das Kundenportal wechseln.' },
        { status: 409 }
      );
    }

    // E-Mail für Stripe: bevorzugt die offizielle Kontakt-E-Mail der
    // Organisation, sonst die E-Mail des angemeldeten Nutzers. So blockiert
    // ein fehlendes oder nicht lesbares Kontaktfeld nicht den ganzen
    // Bezahlvorgang -- Stripe braucht nur irgendeine gültige Adresse für
    // Beleg und Rechnung.
    const customerEmail = org?.contactEmail || user.email;
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.' },
        { status: 400 }
      );
    }

    try {
      const checkoutSession = await createCheckoutSession({
        planId: body.planId,
        organizationId: user.organization.id,
        organizationName: org?.name || user.organization.name || '',
        customerEmail,
        existingCustomerId: org?.stripeCustomerId ?? null,
        successUrl: `${siteUrl()}/intern?billing=success`,
        cancelUrl: `${siteUrl()}/preise?billing=cancelled`,
      });
      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      console.error('Checkout-Session konnte nicht erstellt werden:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Bezahlvorgang konnte nicht gestartet werden.' },
        { status: 500 }
      );
    }
  }

  if (mode === 'portal') {
    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Für diese Organisation läuft noch kein Abo, das sich verwalten ließe.' },
        { status: 400 }
      );
    }
    try {
      const portalSession = await createBillingPortalSession(org.stripeCustomerId, `${siteUrl()}/intern`);
      return NextResponse.json({ url: portalSession.url });
    } catch (err) {
      console.error('Kundenportal konnte nicht geöffnet werden:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Kundenportal konnte nicht geöffnet werden.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Unbekannter Modus.' }, { status: 400 });
}
