// Einzige Quelle der Wahrheit für das Abo-Modell.
//
// Preisseite, Speicherprüfung, Admin-Panel und Stripe greifen alle hier
// zu -- Speichergrenzen dürfen nirgends ein zweites Mal stehen. Genau
// solche Doppelungen sind der Grund, warum Kontingente in Bezahlprodukten
// irgendwann auseinanderlaufen und Kunden mehr oder weniger bekommen als
// sie bezahlt haben.
//
// Diese Datei ist bewusst frei von Umgebungsvariablen und Server-Imports,
// damit sie sowohl im Server- als auch im Client-Bundle liegen kann. Die
// Stripe-Preis-IDs stehen in lib/stripe.ts, die nur serverseitig läuft.

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export type PlanId = 'erkundung' | 'staffel' | 'gruppe' | 'zug' | 'verband';

export type Plan = {
  id: PlanId;
  name: string;
  /** Ein Satz, für wen der Plan gedacht ist. */
  tagline: string;
  storageBytes: number;
  /** Vorformatiert statt gerechnet -- "100 GB" liest sich besser als "102,4 GB". */
  storageLabel: string;
  /** Netto in Cent. 0 = kostenlos. */
  monthlyPriceCents: number;
  features: string[];
  /** Hebt genau einen Plan optisch hervor. */
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
    features: [
      'Alles aus Staffel',
      'Fünffacher Speicher',
      'Vorrangiger Support per E-Mail',
    ],
    recommended: true,
  },
  {
    id: 'zug',
    name: 'Zug',
    tagline: 'Für Kreisverbände und Wehren mit mehreren Standorten.',
    storageBytes: 750 * GB,
    storageLabel: '750 GB',
    monthlyPriceCents: 5900,
    features: [
      'Alles aus Gruppe',
      'Speicher für jahrelange Einsatzarchive',
      'Support per Telefon',
    ],
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

// Jede neu registrierte Organisation startet hier. Kein Zahlungsmittel,
// keine Frist, keine automatische Umstellung auf einen Bezahlplan -- ein
// Testzugang, der stillschweigend kostenpflichtig wird, ist genau die Sorte
// Überraschung, die Vereinsvorstände zu Recht ärgert.
export const DEFAULT_PLAN_ID: PlanId = 'erkundung';

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

// Übersetzt die ALTEN Stufenwerte (small/medium/large) auf die neuen Pläne.
//
// In Directus steht bei bestehenden Organisationen noch der alte Wert im
// Feld storage_tier. Ohne diese Zuordnung stünde jede dieser Organisationen
// nach dem Deploy schlagartig auf dem kostenlosen Plan mit 500 MB -- und
// wäre damit sofort weit über ihrem Limit, ohne dass sich für sie etwas
// geändert hätte.
//
// WICHTIG: Die Zuordnung so anpassen, dass niemand WENIGER Speicher bekommt
// als bisher. Im Zweifel großzügig runden -- ein Kunde, der plötzlich
// weniger hat als gebucht, ist ein Supportfall und ein Vertrauensverlust.
const LEGACY_TIER_MAP: Record<string, PlanId> = {
  small: 'staffel',
  medium: 'gruppe',
  large: 'verband',
};

// Ermittelt den geltenden Plan einer Organisation. Bevorzugt das neue Feld
// plan, fällt auf die alte Stufe zurück, dann auf den kostenlosen Plan.
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
// Lastschrift ist bei Vereinen Alltag (Kontowechsel, Vorstandswechsel).
// Der Zugang bleibt bestehen, Stripe versucht es mehrfach erneut -- erst
// bei "canceled" fällt die Organisation zurück auf den kostenlosen Plan.
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled';

export function subscriptionGrantsAccess(status: unknown): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

// Wohin die Preisseite ihre Checkout-Anfrage schickt.
//
// An EINER Stelle definiert, weil die Zieladresse noch von der
// Standalone-Build-Einschränkung abhängt (neue route.ts-Dateien tauchen
// nicht zuverlässig im routes-manifest.json auf). Wenn die Route feststeht,
// wird hier eine Zeile geändert und nirgends sonst.
export const CHECKOUT_ENDPOINT = '/api/intern/billing?mode=checkout';
export const PORTAL_ENDPOINT = '/api/intern/billing?mode=portal';
