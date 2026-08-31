'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PLANS,
  formatPlanPrice,
  CHECKOUT_ENDPOINT,
  PORTAL_ENDPOINT,
  type Plan,
  type PlanId,
} from '@/lib/plans';

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function PricingPlans({
  currentPlanId = null,
  isLoggedIn = false,
  hasSubscription = false,
}: {
  currentPlanId?: PlanId | null;
  isLoggedIn?: boolean;
  hasSubscription?: boolean;
}) {
  const router = useRouter();
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const freePlan = PLANS[0];
  const paidPlans = PLANS.slice(1);

  async function startCheckout(planId: PlanId) {
    if (!isLoggedIn) {
      router.push(`/registrieren?plan=${planId}`);
      return;
    }

    setBusyPlan(planId);
    setError(null);
    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? 'Bezahlvorgang konnte nicht gestartet werden.');
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bezahlvorgang konnte nicht gestartet werden.');
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    setBusyPlan(null);
    setError(null);
    try {
      const res = await fetch(PORTAL_ENDPOINT, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? 'Kundenportal konnte nicht geöffnet werden.');
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kundenportal konnte nicht geöffnet werden.');
    }
  }

  function buttonLabel(plan: Plan): string {
    if (currentPlanId === plan.id) return 'Aktueller Plan';
    if (busyPlan === plan.id) return 'Wird geöffnet …';
    if (!isLoggedIn) return 'Jetzt starten';
    return hasSubscription ? 'Wechseln' : 'Buchen';
  }

  return (
    <div>
      {error && (
        <p className="mx-auto mb-6 max-w-[720px] break-words rounded-[12px] border border-signal-deep/25 bg-signal-deep/5 px-4 py-3 text-[13px] text-signal-deep [overflow-wrap:anywhere]">
          {error}
        </p>
      )}

      <div className="mb-8 flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-[22px] leading-tight text-ink">{freePlan.name}</h2>
            <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
              {freePlan.storageLabel} · kostenlos
            </span>
            {currentPlanId === freePlan.id && (
              <span className="rounded-full bg-signal/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-signal-deep">
                Aktiv
              </span>
            )}
          </div>
          <p className="mt-2 max-w-[560px] text-[13px] leading-[1.6] text-ink-2">
            {freePlan.tagline} Jede neue Organisation startet hier — es wird nichts automatisch
            kostenpflichtig.
          </p>
        </div>

        {!isLoggedIn && (
          <a href="/registrieren" className="flex-none rounded-full border border-line-strong bg-white px-5 py-2.5 text-center text-[13px] font-semibold text-ink transition-colors hover:border-ink">
            Kostenlos registrieren
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {paidPlans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-[20px] border bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover ${
                plan.recommended ? 'border-signal ring-1 ring-signal/30' : 'border-line'
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-6 rounded-full bg-signal px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white">
                  Am häufigsten gewählt
                </span>
              )}

              <h3 className="font-display text-[24px] leading-tight text-ink">{plan.name}</h3>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-mono text-[30px] font-semibold leading-none text-ink">
                  {formatPlanPrice(plan)}
                </span>
                <span className="text-[12.5px] text-ink-3">/ Monat</span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-3">zzgl. MwSt., monatlich kündbar</p>

              <div className="mt-4 rounded-[12px] bg-panel px-3 py-2.5 text-center">
                <div className="font-mono text-[19px] font-semibold text-ink">{plan.storageLabel}</div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-ink-3">Speicher</div>
              </div>

              <p className="mt-4 text-[12.5px] leading-[1.6] text-ink-2">{plan.tagline}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-ink-2">
                    <IconCheck className="mt-[3px] h-[13px] w-[13px] flex-none text-signal-deep" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => (isCurrent && hasSubscription ? openPortal() : startCheckout(plan.id))}
                disabled={busyPlan !== null || (isCurrent && !hasSubscription)}
                className={`mt-6 w-full rounded-full px-5 py-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCurrent
                    ? 'border border-line-strong bg-white text-ink hover:border-ink'
                    : plan.recommended
                    ? 'bg-signal text-white hover:bg-signal-deep'
                    : 'bg-ink text-white hover:bg-black'
                }`}
              >
                {isCurrent && hasSubscription ? 'Abo verwalten' : buttonLabel(plan)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-[16px] border border-line bg-panel/60 p-5">
        <h3 className="text-[13px] font-semibold text-ink">Zahlung und Rechnung</h3>
        <p className="mt-2 max-w-[720px] text-[12.5px] leading-[1.7] text-ink-2">
          Zahlbar per SEPA-Lastschrift oder Kreditkarte. Jede Rechnung kommt automatisch per
          E-Mail und lässt sich jederzeit im Kundenportal herunterladen — mit allen Angaben, die
          eine Kassenprüfung braucht. Wenn eure Verwaltung nur auf Rechnung per Überweisung zahlen
          darf oder ihr jährlich abrechnen wollt, meldet euch einfach, das richten wir ein.
        </p>
      </div>
    </div>
  );
}
