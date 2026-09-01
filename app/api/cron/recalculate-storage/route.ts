import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { recalculateOrgStorage } from '@/lib/storageRecalc';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Zeitkonstanter Vergleich statt "!==": Ein einfacher Vergleich bricht
// beim ersten abweichenden Zeichen ab, wodurch sich über die Antwortzeit
// theoretisch Rückschlüsse auf das korrekte Secret ziehen ließen. Bei
// einem langen Zufalls-Secret ist das Risiko in der Praxis gering, aber
// die Absicherung ist eine Zeile und kostenlos.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('Cron-Speicher-Neuberechnung: CRON_SECRET ist nicht konfiguriert.');
    return NextResponse.json({ error: 'Nicht konfiguriert.' }, { status: 500 });
  }
  if (!secret || !secretsMatch(secret, expectedSecret)) {
    return NextResponse.json({ error: 'Ungültiges Secret.' }, { status: 401 });
  }

  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('Cron-Speicher-Neuberechnung: DIRECTUS_SERVICE_TOKEN fehlt.');
    return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 500 });
  }

  const orgsRes = await fetch(`${DIRECTUS_URL}/items/organizations?fields=id,name&limit=-1`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
  });
  if (!orgsRes.ok) {
    console.error(`Cron-Speicher-Neuberechnung: Organisationen laden fehlgeschlagen (Status ${orgsRes.status})`);
    return NextResponse.json({ error: 'Organisationen konnten nicht geladen werden.' }, { status: 502 });
  }
  const { data: organizations } = await orgsRes.json();

  const results: { organizationName: string; difference: number; ok: boolean }[] = [];
  let errorCount = 0;

  for (const org of organizations as { id: string; name: string }[]) {
    try {
      const result = await recalculateOrgStorage(serviceToken, org.id, org.name);
      results.push({ organizationName: org.name, difference: result.difference, ok: true });
      if (result.difference !== 0) {
        console.log(
          `[cron/recalculate-storage] ${org.name}: Zähler korrigiert um ${result.difference} Bytes.`
        );
      }
    } catch (error) {
      errorCount++;
      console.error(`[cron/recalculate-storage] Fehlgeschlagen für ${org.name} (${org.id}):`, error);
      results.push({ organizationName: org.name, difference: 0, ok: false });
    }
  }

  const correctedCount = results.filter((r) => r.ok && r.difference !== 0).length;

  console.log(
    `[cron/recalculate-storage] Durchlauf abgeschlossen: ${organizations.length} Organisationen, ${correctedCount} korrigiert, ${errorCount} Fehler.`
  );

  return NextResponse.json({
    ok: true,
    totalOrganizations: organizations.length,
    correctedCount,
    errorCount,
    results,
  });
}
