// Einfacher In-Memory-Rate-Limiter.
//
// WARUM ÜBERHAUPT: middleware.ts deckt bewusst nur /intern und
// /api/intern ab (siehe dortiger Matcher) -- die öffentlichen
// Auth-Endpunkte (/api/auth/login, /api/auth/password/request) laufen
// komplett ohne jede Drosselung. Login ist damit für Brute-Force offen,
// Passwort-Reset-Anfrage für Spam/DoS gegen den Mailversand.
//
// WARUM IN-MEMORY GENÜGT: Presseportal112 läuft als einzelner, langlebiger
// Node-Prozess in einem Docker-Container (Coolify auf einem VPS), nicht
// als verteiltes Serverless-/Edge-Deployment mit vielen parallelen
// Instanzen. Ein Map im Modul-Scope überlebt damit zuverlässig zwischen
// Anfragen. Bei einem Wechsel auf mehrere Container-Instanzen (Skalierung,
// Load-Balancing) müsste das durch einen gemeinsamen Speicher ersetzt
// werden (z.B. Redis) -- für den aktuellen Betrieb ist das nicht nötig.
//
// Reset bei jedem Deploy (Prozess-Neustart) ist ein bewusst akzeptierter
// Kompromiss: Besser ein Zähler, der beim Deploy zurückspringt, als gar
// kein Zähler.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Verhindert, dass die Map bei viel Traffic unbegrenzt wächst -- alte,
// abgelaufene Einträge werden bei Gelegenheit mit entfernt statt eine
// eigene Cron-Aufgabe dafür zu brauchen.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function sweepIfDue() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Sekunden bis zum nächsten erlaubten Versuch, nur gesetzt wenn allowed=false. */
  retryAfterSeconds?: number;
};

// Festes Zeitfenster (Fixed Window) statt gleitendem Fenster -- bewusst
// einfacher gehalten. Für den Zweck hier (grobe Bremse gegen automatisierte
// Massenversuche, nicht präzise Drosselung) reicht das aus.
export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): RateLimitResult {
  sweepIfDue();

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true };
  }

  if (existing.count >= opts.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true };
}

// Extrahiert die Client-IP aus den üblichen Proxy-Headern. Coolify läuft
// hinter einem Reverse Proxy, direkter request.ip existiert in Next.js'
// Node-Runtime nicht zuverlässig -- x-forwarded-for ist der übliche Weg,
// wie es an anderen Stellen im Projekt (Turnstile-Prüfung) bereits genutzt
// wird.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
