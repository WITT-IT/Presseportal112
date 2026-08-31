import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPlan, type PlanId } from './plans';

// Bewusst OHNE das Stripe-npm-Paket.
//
// Die Stripe-API ist eine gewöhnliche REST-Schnittstelle mit
// formularkodierten Feldern. Für die vier Aufrufe, die wir brauchen, ist
// ein eigener schlanker Wrapper überschaubarer als eine weitere
// Abhängigkeit im Docker-Build -- und die Signaturprüfung des Webhooks
// ist mit node:crypto ein Zwölfzeiler.

const STRIPE_API = 'https://api.stripe.com/v1';

// Version angehoben: Managed Payments (das neuere Checkout-Modell, das auf
// diesem Account aktiv ist) verlangt mindestens 2025-03-31.basil. Eine
// ältere Version lehnt managed_payments[enabled] als unbekannten Parameter
// ab -- der eigentliche Grund für den vorherigen Fehler war also nicht nur
// der fehlende Parameter, sondern auch der zu alte Versions-Header.
const STRIPE_API_VERSION = '2025-03-31.basil';

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY fehlt.');
  return key;
}

function toFormBody(params: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (entry !== null && typeof entry === 'object') {
          parts.push(...toFormBody(entry as Record<string, unknown>, `${name}[${index}]`));
        } else {
          parts.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(entry))}`);
        }
      });
    } else if (typeof value === 'object') {
      parts.push(...toFormBody(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripeRequest<T>(
  path: string,
  params: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'POST'
): Promise<T> {
  const body = toFormBody(params).join('&');
  const url = method === 'GET' && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: method === 'POST' ? body : undefined,
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message || `Stripe antwortete mit Status ${res.status}`;
    console.error(`Stripe ${method} ${path} fehlgeschlagen:`, JSON.stringify(json?.error ?? json));
    throw new Error(message);
  }
  return json as T;
}

export function stripePriceIdForPlan(planId: PlanId): string | null {
  const map: Record<PlanId, string | undefined> = {
    erkundung: undefined,
    staffel: process.env.STRIPE_PRICE_STAFFEL,
    gruppe: process.env.STRIPE_PRICE_GRUPPE,
    zug: process.env.STRIPE_PRICE_ZUG,
    verband: process.env.STRIPE_PRICE_VERBAND,
  };
  return map[planId] ?? null;
}

export type StripeSession = { id: string; url: string };

// Legt eine gehostete Bezahlseite an.
//
// MANAGED PAYMENTS (auf diesem Account aktiv): Stripe übernimmt Auswahl
// und Anzeige der Zahlungsarten selbst -- basierend auf den in
// Einstellungen -> Zahlungsmethoden aktivierten Wegen (dort SEPA-
// Lastschrift aktivieren, sonst sehen die Vereine nur Kartenzahlung).
//
// Mit diesem Modell lehnt die API eine ganze Reihe Parameter ab, die im
// klassischen Checkout normal waren. Bewusst NICHT mehr gesetzt:
// payment_method_types, tax_id_collection, automatic_tax,
// payment_method_options, payment_method_configuration,
// customer_update[name/address], shipping_*, subscription_data.
// default_tax_rates/application_fee_percent/on_behalf_of/transfer_data/
// invoice_settings. Wird künftig einer davon wieder gebraucht (z.B. USt-ID-
// Erfassung fürs Reverse-Charge-Verfahren), muss das über einen anderen Weg
// laufen -- laut Stripes eigener Doku entweder ohne Managed Payments oder
// über die separate Tax-ID-Erfassung im Kundenportal nach dem Kauf.
export async function createCheckoutSession(args: {
  planId: PlanId;
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  existingCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeSession> {
  const priceId = stripePriceIdForPlan(args.planId);
  if (!priceId) {
    throw new Error(`Für den Plan "${args.planId}" ist kein Stripe-Preis hinterlegt.`);
  }

  const params: Record<string, unknown> = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    locale: 'de',
    billing_address_collection: 'required',
    'managed_payments[enabled]': 'true',
    'metadata[organization_id]': args.organizationId,
    'metadata[plan_id]': args.planId,
    'subscription_data[metadata][organization_id]': args.organizationId,
    'subscription_data[metadata][plan_id]': args.planId,
  };

  if (args.existingCustomerId) {
    params.customer = args.existingCustomerId;
  } else {
    params.customer_email = args.customerEmail;
    params['customer_creation'] = 'always';
  }

  return stripeRequest<StripeSession>('/checkout/sessions', params);
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<StripeSession> {
  return stripeRequest<StripeSession>('/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
    locale: 'de',
  });
}

export async function getSubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  items?: { data: { price: { id: string } }[] };
}> {
  return stripeRequest(`/subscriptions/${subscriptionId}`, {}, 'GET');
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('verifyWebhookSignature: STRIPE_WEBHOOK_SECRET fehlt.');
    return false;
  }
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(',').map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    console.error('verifyWebhookSignature: Zeitstempel außerhalb der Toleranz.');
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  return signatures.some((sig) => {
    const given = Buffer.from(sig, 'utf8');
    return given.length === expectedBuffer.length && timingSafeEqual(given, expectedBuffer);
  });
}

export function planIdForStripePrice(priceId: string): PlanId | null {
  const candidates: PlanId[] = ['staffel', 'gruppe', 'zug', 'verband'];
  return candidates.find((id) => stripePriceIdForPlan(id) === priceId) ?? null;
}

export { getPlan };
