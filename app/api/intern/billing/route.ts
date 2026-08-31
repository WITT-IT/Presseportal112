import { NextResponse } from 'next/server';

// TEMPORÄRER TESTENDPUNKT.
//
// Prüft ausschließlich, ob eine NEU angelegte route.ts im Standalone-Build
// überhaupt erreichbar ist -- bekanntes Risiko in diesem Projekt: neue
// route.ts-Dateien tauchen in app-path-routes-manifest.json auf, aber
// nicht zuverlässig in routes-manifest.json, was in Produktion zu einem
// harten 404 führt, obwohl lokal alles funktioniert.
//
// Sobald der Test ein klares Ergebnis geliefert hat, wird diese Datei
// durch die echte Billing-Logik ersetzt (Checkout, Kundenportal).
export async function GET() {
  return NextResponse.json({ ok: true, route: 'billing-test' });
}
