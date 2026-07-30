import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_VALIDITY_MS = 30 * 60 * 1000; // 30 Minuten

function getSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret) {
    throw new Error('PASSWORD_RESET_SECRET ist nicht gesetzt.');
  }
  return secret;
}

// Erzeugt ein Token aus E-Mail + Ablaufzeit, signiert mit einem geheimen
// Schlüssel. Bewusst zustandslos -- keine Datenbank-Tabelle mit Tokens, die
// aufgeräumt werden müsste. Die Gültigkeit ergibt sich rein aus dem
// eingebetteten Zeitstempel.
export function createResetToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + TOKEN_VALIDITY_MS });
  const payloadEncoded = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = createHmac('sha256', getSecret()).update(payloadEncoded).digest('base64url');
  return `${payloadEncoded}.${signature}`;
}

// Prüft Signatur und Ablaufzeit. Gibt bei jedem Problem (falsches Format,
// falsche Signatur, abgelaufen) einheitlich null zurück -- der Aufrufer
// muss nicht zwischen den Fehlerarten unterscheiden.
export function verifyResetToken(token: string): { email: string } | null {
  const [payloadEncoded, signature] = (token || '').split('.');
  if (!payloadEncoded || !signature) return null;

  const expectedSignature = createHmac('sha256', getSecret())
    .update(payloadEncoded)
    .digest('base64url');

  // Zeitkonstanter Vergleich -- verhindert, dass sich die Signatur über
  // Zeitunterschiede beim Vergleichen erraten lässt.
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
