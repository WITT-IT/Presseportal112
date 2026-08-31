import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { verifyWebhookSignature, getSubscription, planIdForStripePrice } from '@/lib/stripe';
import { isPlanId, DEFAULT_PLAN_ID, type SubscriptionStatus } from '@/lib/plans';

// ÖFFENTLICHER Endpunkt -- Stripe ruft ihn ohne Sitzungs-Cookie auf. Die
// Signaturprüfung in verifyWebhookSignature ist die einzige Absicherung
// und deshalb Pflicht, nicht optional. Ohne sie könnte jeder, der die
// Adresse kennt, sich selbst ein beliebiges Abo freischalten.

function serviceHeaders(): Record<string, string> {
  const token = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!token) throw new Error('DIRECTUS_SERVICE_TOKEN fehlt.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function updateOrganization(organizationId: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${DIRECTUS_URL}/items/organizations/${organizationId}`, {
    method: 'PATCH',
    headers: serviceHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `Stripe-Webhook: Organisation ${organizationId} konnte nicht aktualisiert werden (Status ${res.status}):`,
      body
    );
  }
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'none';
  }
}

export async function POST(request: NextRequest) {
  // Der ROHE Text wird gebraucht, nicht das geparste JSON --
  // JSON.stringify(JSON.parse(x)) ist nicht zwingend gleich x, und schon
  // ein abweichendes Leerzeichen macht die Signatur ungültig.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('Stripe-Webhook: Signatur ungültig oder fehlend — Anfrage abgelehnt.');
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata?: { organization_id?: string; plan_id?: string };
          customer?: string;
          subscription?: string;
        };
        const organizationId = session.metadata?.organization_id;
        if (!organizationId) {
          console.error('Stripe-Webhook: checkout.session.completed ohne organization_id in metadata.');
          break;
        }

        const patch: Record<string, unknown> = {};
        if (session.customer) patch.stripe_customer_id = session.customer;

        if (session.subscription) {
          patch.stripe_subscription_id = session.subscription;
          // Der maßgebliche Stand kommt aus dem Abo-Objekt selbst, nicht
          // aus der Checkout-Session -- die Session kennt nur den Moment
          // des Kaufs, das Abo den tatsächlichen aktuellen Status.
          const sub = await getSubscription(session.subscription);
          patch.subscription_status = mapStripeStatus(sub.status);
          patch.subscription_current_period_end = new Date(sub.current_period_end * 1000).toISOString();
          const price = sub.items?.data?.[0]?.price?.id;
          const resolvedPlan =
            (price && planIdForStripePrice(price)) ||
            (isPlanId(session.metadata?.plan_id) ? session.metadata!.plan_id : null);
          if (resolvedPlan) patch.plan = resolvedPlan;
        }

        await updateOrganization(organizationId, patch);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          metadata?: { organization_id?: string };
          status: string;
          current_period_end: number;
          items?: { data: { price: { id: string } }[] };
        };
        const organizationId = sub.metadata?.organization_id;
        if (!organizationId) {
          console.error('Stripe-Webhook: customer.subscription.updated ohne organization_id in metadata.');
          break;
        }

        const price = sub.items?.data?.[0]?.price?.id;
        const resolvedPlan = price ? planIdForStripePrice(price) : null;

        const patch: Record<string, unknown> = {
          subscription_status: mapStripeStatus(sub.status),
          subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        };
        // Nur setzen, wenn sich eine bekannte Preis-ID zuordnen ließ --
        // sonst würde ein unbekannter Preis den Plan stillschweigend auf
        // "erkundung" zurückfallen lassen (isPlanId-Fallback in resolvePlan
        // greift hier nicht, weil wir hier direkt "plan" schreiben).
        if (resolvedPlan) patch.plan = resolvedPlan;

        await updateOrganization(organizationId, patch);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as { metadata?: { organization_id?: string } };
        const organizationId = sub.metadata?.organization_id;
        if (!organizationId) {
          console.error('Stripe-Webhook: customer.subscription.deleted ohne organization_id in metadata.');
          break;
        }
        // Zurück auf den kostenlosen Plan -- kein Verlust des Zugangs an
        // sich, nur das Kontingent schrumpft auf 500 MB. Liegt der
        // Bestand darüber, greift die Upload-Sperre automatisch beim
        // nächsten Versuch; nichts wird gelöscht.
        await updateOrganization(organizationId, {
          plan: DEFAULT_PLAN_ID,
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        });
        break;
      }

      default:
        // Andere Ereignisse sind für uns aktuell nicht relevant. Stripe
        // erwartet trotzdem eine 2xx-Antwort, sonst wiederholt es die
        // Zustellung unnötig.
        break;
    }
  } catch (err) {
    console.error(`Stripe-Webhook: Verarbeitung von "${event?.type}" fehlgeschlagen:`, err);
    // 500 zurückgeben, damit Stripe automatisch erneut zustellt -- ein
    // verlorenes Abrechnungsereignis ist der teurere Fehler als ein
    // doppelter Zustellversuch.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
