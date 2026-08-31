// Einzige Quelle der Wahrheit für das Abo-Modell.
//
// Preisseite, Speicherprüfung, Admin-Panel und Stripe greifen alle hier
// zu -- Speichergrenzen dürfen nirgends ein zweites Mal stehen.

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export type PlanId = 'erkundung' | 'staffel' | 'gruppe' | 'zug' | 'verband';

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  storageBytes: number;
  storageLabel: string;
  monthlyPriceCents: number;
  features: string[];
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'erkundung',
    name: 'Erkundung',
    tagline: 'Zum Ausprobieren — ohne Zahlungsdaten, ohne Laufzeit.',
    storageBytes: 500 * MB,
    storageLabel: '500 MB',
    monthlyPriceCents: 0,
    features: [
      'Medienbibliothek mit Ordnern',
      'Presseverteiler und Medienfreigaben',
      'Wasserzeichen auf Vorschau und Download',
      'Ein Konto für die Organisation',
    ],
  },
  {
    id: 'staffel',
    name: 'Staffel',
    tagline: 'Für einzelne Wehren und Ortsvereine mit regelmäßiger Pressearbeit.',
    storageBytes: 100 * GB,
    storageLabel: '100 GB',
    monthlyPriceCents: 1900,
    features: [
      'Alles aus Erkundung',
      'Unbegrenzt Beiträge und Freigaben',
      'Nachrichten an andere Organisationen',
      'E-Mail-Warnung bei 90 % Speicherbelegung',
    ],
  },
  {
    id: 'gruppe',
    name: 'Gruppe',
    tagline: 'Für aktive Pressestellen mit laufendem Bildaufkommen.',
    storageBytes: 500 * GB,
    storageLabel: '500 GB',
    monthlyPriceCents: 3900,
    features: ['Alles aus Staffel', 'Fünffacher Speicher', 'Vorrangiger Support per E-Mail'],
    recommended: true,
  },
  {
    id: 'zug',
    name: 'Zug',
    tagline: 'Für Kreisverbände und Wehren mit mehreren Standorten.',
    storageBytes: 750 * GB,
    storageLabel: '750 GB',
    monthlyPriceCents: 5900,
    features: ['Alles aus Gruppe', 'Speicher für jahrelange Einsatzarchive', 'Support per Telefon'],
  },
  {
    id: 'verband',
    name: 'Verband',
    tagline: 'Für Landes- und Bezirksverbände mit großem Bildbestand.',
    storageBytes: 1024 * GB,
    storageLabel: '1 TB',
    monthlyPriceCents: 8900,
    features: [
      'Alles aus Zug',
      'Ein Terabyte Speicher',
      'Rechnung auf Wunsch jährlich',
      'Fester Ansprechpartner',
    ],
  },
];

export const DEFAULT_PLAN_ID: PlanId = 'erkundung';

// Fallback-Limit für den Fehlerfall (siehe getOrgStorage in
// app/api/intern/library/route.ts): Wenn die Planfelder einer Organisation
// nicht lesbar sind, gilt hier ABSICHTLICH das großzügigste Limit, nicht
// das kostenlose. Ein zahlender Kunde darf wegen eines vorübergehenden
// Lesefehlers nie fälschlich ausgesperrt werden -- ein kurzzeitig zu
// großzügiges Limit ist der ungefährlichere Fehler als ein blockierter
// Upload bei jemandem, der bezahlt.
export const FAILSAFE_LIMIT_BYTES = PLANS[PLANS.length - 1].storageBytes;

const PLAN_MAP: Record<PlanId, Plan> = PLANS.reduce(
  (acc, plan) => ({ ...acc, [plan.id]: plan }),
  {} as Record<PlanId, Plan>
);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLAN_MAP;
}

export function getPlan(id: unknown): Plan {
  return isPlanId(id) ? PLAN_MAP[id] : PLAN_MAP[DEFAULT_PLAN_ID];
}

export function storageBytesForPlan(id: unknown): number {
  return getPlan(id).storageBytes;
}

export function isPaidPlan(id: unknown): boolean {
  return getPlan(id).monthlyPriceCents > 0;
}

// Übersetzt die ALTEN Stufenwerte aus lib/storage.ts (tier_250 / tier_500 /
// tier_1000) auf die neuen Pläne.
//
// tier_250 (250 GB) liegt zwischen Staffel (100 GB) und Gruppe (500 GB) --
// es gibt keinen exakt passenden neuen Plan. Zugeordnet wird IMMER nach
// OBEN gerundet (Gruppe), nie nach unten: Ein bestehender Kunde darf nach
// dieser Umstellung unter keinen Umständen weniger Speicher haben als
// vorher, selbst wenn das bedeutet, dass er vorübergehend mehr bekommt, als
// er zahlt. Das ist ein bewusster, kleiner Margen-Verlust zugunsten von
// Vertrauen -- betrifft nur Alt-Organisationen, bis sie auf ein echtes
// Stripe-Abo wechseln.
const LEGACY_TIER_MAP: Record<string, PlanId> = {
  tier_250: 'gruppe',
  tier_500: 'gruppe',
  tier_1000: 'verband',
};

// Ermittelt den geltenden Plan einer Organisation. Bevorzugt das neue Feld
// "plan" (von Stripe/Webhook gepflegt), fällt auf die alte Stufe zurück,
// dann auf den kostenlosen Plan.
export function resolvePlan(fields: { plan?: unknown; storage_tier?: unknown }): Plan {
  if (isPlanId(fields.plan)) return PLAN_MAP[fields.plan];

  const legacy = fields.storage_tier;
  if (typeof legacy === 'string' && legacy in LEGACY_TIER_MAP) {
    return PLAN_MAP[LEGACY_TIER_MAP[legacy]];
  }
  return PLAN_MAP[DEFAULT_PLAN_ID];
}

export function formatPlanPrice(plan: Plan): string {
  if (plan.monthlyPriceCents === 0) return 'kostenlos';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: plan.monthlyPriceCents % 100 === 0 ? 0 : 2,
  }).format(plan.monthlyPriceCents / 100);
}

// Abo-Zustand aus Stripe, gespiegelt in Directus.
//
// "past_due" bewusst NICHT wie gekündigt behandeln: Eine geplatzte
// Lastschrift ist bei Vereinen Alltag. Der Zugang bleibt bestehen, Stripe
// versucht es mehrfach erneut -- erst bei "canceled" fällt die
// Organisation zurück auf den kostenlosen Plan.
export type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';

export function subscriptionGrantsAccess(status: unknown): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export const CHECKOUT_ENDPOINT = '/api/intern/billing?mode=checkout';
export const PORTAL_ENDPOINT = '/api/intern/billing?mode=portal';
