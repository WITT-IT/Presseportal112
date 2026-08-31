import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { resolvePlan, subscriptionGrantsAccess, type PlanId } from '@/lib/plans';
import PricingPlans from '@/components/PricingPlans';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preise — Presseportal112',
  description:
    'Speicherpläne für Feuerwehren, DRK, THW und Polizei. Kostenlos starten, jederzeit monatlich kündbar.',
};

// Liest Plan und Abo-Status der angemeldeten Organisation.
//
// Service-Token wie überall bei Abrechnungsdaten: plan und
// subscription_status sind Systemfelder, die der Server pflegt. Hinge das
// am Nutzertoken, wäre die Preisseite von den Feldberechtigungen der
// jeweiligen Directus-Rolle abhängig -- und Directus lehnt eine Anfrage
// komplett mit 403 ab, sobald darin ein einziges Feld ohne Leserecht
// vorkommt. Genau das hat schon einmal den Speicherbalken lahmgelegt.
async function getOrgPlan(organizationId: string): Promise<{
  planId: PlanId | null;
  hasSubscription: boolean;
}> {
  const token = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!token) return { planId: null, hasSubscription: false };

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/organizations/${organizationId}?fields=plan,storage_tier,subscription_status`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`getOrgPlan(${organizationId}) fehlgeschlagen (Status ${res.status}).`);
      return { planId: null, hasSubscription: false };
    }
    const { data } = await res.json();
    return {
      planId: resolvePlan(data ?? {}).id,
      hasSubscription: subscriptionGrantsAccess(data?.subscription_status),
    };
  } catch (error) {
    console.error(`getOrgPlan(${organizationId}) fehlgeschlagen:`, error);
    return { planId: null, hasSubscription: false };
  }
}

export default async function PreisePage() {
  // Die Seite ist öffentlich. Ist jemand angemeldet, wird sein aktueller
  // Plan hervorgehoben -- ohne Anmeldung führt jeder Knopf zur
  // Registrierung.
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  let planId: PlanId | null = null;
  let hasSubscription = false;
  let isLoggedIn = false;

  if (raw) {
    try {
      const session = JSON.parse(raw) as { accessToken?: string };
      if (session.accessToken) {
        const user = await getCurrentUser(session.accessToken);
        if (user) {
          isLoggedIn = true;
          if (user.organization?.id) {
            const info = await getOrgPlan(user.organization.id);
            planId = info.planId;
            hasSubscription = info.hasSubscription;
          }
        }
      }
    } catch {
      // Kaputtes Cookie bedeutet hier nur: als Besucher behandeln. Die
      // Preisseite ist öffentlich, ein Redirect zum Login wäre unnötig
      // ruppig.
      isLoggedIn = false;
    }
  }

  return (
    <div className="bg-gradient-to-b from-white via-paper to-paper">
      <section className="mx-auto max-w-[1200px] px-6 pb-6 pt-14 text-center nav:px-10 nav:pt-20">
        <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-2 shadow-sm">
          Preise
        </span>
        <h1 className="mx-auto mt-5 max-w-[760px] font-display text-[clamp(30px,4.5vw,46px)] leading-[1.02] text-ink">
          Speicher, der mit eurem Archiv mitwächst.
        </h1>
        <p className="mx-auto mt-4 max-w-[620px] text-[14px] leading-[1.7] text-ink-2">
          Alle Funktionen sind in jedem Plan enthalten. Unterschiedlich ist allein der Speicher —
          ihr zahlt für den Platz, den euer Bildbestand tatsächlich braucht, und für nichts sonst.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-20 nav:px-10">
        <PricingPlans
          currentPlanId={planId}
          isLoggedIn={isLoggedIn}
          hasSubscription={hasSubscription}
        />
      </section>
    </div>
  );
}
