import { NextRequest, NextResponse } from 'next/server';
import { DIRECTUS_URL } from '@/lib/directus';
import { recalculateOrgStorage } from '@/lib/storageRecalc';

export const dynamic = 'force-dynamic';
// Kann bei vielen Organisationen ein paar Minuten dauern (pro Organisation
// mehrere Directus-Requests) -- sicherheitshalber explizit hochgesetzt.
export const maxDuration = 300;

// GET /api/cron/recalculate-storage?secret=...
//
// Wöchentlicher automatischer Lauf: geht ALLE Organisationen durch und
// berechnet ihren Speicherverbrauch aus den echten Directus-Dateigrößen
// neu -- korrigiert stillschweigende Drift im additiv geführten Zähler
// (siehe app/api/intern/library/route.ts), ohne dass ein Admin manuell
// eingreifen muss. Genau die Automatisierung, die ein produktiv
// verkauftes Speicherlimit-Feature braucht statt eines reinen "hoffentlich
// klickt das mal jemand"-Buttons.
//
// KEIN Session-Cookie-Schutz wie bei den Admin-Routen -- hier ruft kein
// eingeloggter Mensch auf, sondern Coolifys Scheduler. Schutz stattdessen
// über ein Secret in der URL, das nur im Coolify-Scheduler hinterlegt ist.
// Läuft bewusst über GET (nicht POST), weil die meisten Cron-Scheduler
// (inkl. Coolify) primär einfache GET-Requests gegen eine URL feuern.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('Cron-Speicher-Neuberechnung: CRON_SECRET ist nicht konfiguriert.');
    return NextResponse.json({ error: 'Nicht konfiguriert.' }, { status: 500 });
  }
  if (secret !== expectedSecret) {
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

  // Nacheinander statt Promise.all über alle Organisationen -- Directus
  // bekommt sonst bei vielen Organisationen gleichzeitig sehr viele
  // parallele Einzel-Datei-Requests (jede Organisation fragt selbst schon
  // pro Bild einzeln ab) und könnte überlastet werden. Sequentiell dauert
  // länger, ist aber verlässlicher für einen Hintergrund-Job ohne Nutzer,
  // der ungeduldig auf eine Antwort wartet.
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
