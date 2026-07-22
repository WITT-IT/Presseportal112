# Presseportal112 — Frontend

Next.js (App Router, TypeScript, Tailwind), angebunden an das Directus-Backend
aus dem Datenmodell-Guide. Diese erste Version deckt die **öffentlichen
Seiten** ab: Startseite mit Live-Ticker, Gewerke-Übersicht und Foto-Mosaik,
alles mit echten Daten aus Directus. Login, Upload und interner
Organisationsbereich sind bewusst noch nicht Teil dieser Version — kommen als
nächster Bauabschnitt, sobald die öffentliche Seite steht.

## Voraussetzungen

- Node.js 20 oder neuer
- Ein laufendes Directus-Projekt mit dem Datenmodell aus dem Guide
  (`gewerke`, `organizations`, `images` mit `is_public`-Feld, Public-Policy
  mit Lesezugriff auf diese drei Collections)

## Lokal starten

```bash
npm install
cp .env.example .env.local
# .env.local öffnen und NEXT_PUBLIC_DIRECTUS_URL prüfen
npm run dev
```

Dann `http://localhost:3000` öffnen. Läuft die Seite, aber ohne Daten oder
mit dem gelben Warnhinweis oben, prüfe:

1. Ist `NEXT_PUBLIC_DIRECTUS_URL` korrekt und ohne abschließenden Schrägstrich?
2. Hat die Public-Policy in Directus wirklich Leserechte auf `gewerke`,
   `images` (gefiltert `is_public = true`) und `organizations`?
3. Ist mindestens ein `gewerke`-Eintrag vorhanden? Ohne Gewerke bleibt die
   Kartenübersicht leer, das ist kein Fehler, nur fehlender Inhalt.

## Warum es ohne API-Token funktioniert

Alle Anfragen auf dieser ersten Ausbaustufe laufen unauthentifiziert gegen
die Directus-REST-API — genau die Public-Policy, die im Rahmen des
Datenmodell-Setups konfiguriert wurde. Sobald der interne Bereich
(Anmeldung, Upload) dazukommt, wird zusätzlich ein Auth-Flow mit
Directus-Sessions ergänzt; das öffentliche Bildarchiv bleibt davon
unabhängig.

## Deployment über Coolify

1. Neues Coolify-Projekt/Service anlegen, Typ „Dockerfile" (analog zu deiner
   Directus-Installation), dieses Repository als Quelle verbinden.
2. Build-Argument setzen: `NEXT_PUBLIC_DIRECTUS_URL` auf
   `https://directus.witt-itsolutions.de` (wird zur Build-Zeit in den
   Client-Code eingebacken, siehe `Dockerfile`).
3. Port `3000` freigeben, Domain zuweisen (z. B. `presseportal112.de`).
4. Deploy anstoßen.

## Bekannte Design-Entscheidungen

- **Kein `aggregate()` aus dem Directus-SDK für Zählungen**: Die
  SDK-Aggregat-Funktion hat bekannte Bugs im Zusammenspiel mit gefilterten
  Relationen (z. B. „nur Bilder, deren Organisation zu Gewerk X gehört").
  Stattdessen wird über `readItems` mit `fields: ['id']` und `limit: -1`
  gezählt — etwas mehr Netzwerklast, dafür zuverlässig korrekte Zahlen.
- **`export const dynamic = 'force-dynamic'`** auf der Startseite: verhindert,
  dass Next.js die Seite statisch cached und dadurch neue Freigaben nicht
  zeigt. Für eine stark frequentierte Seite später ggf. durch
  `revalidate`-basiertes Caching ersetzen.
- **Next/Image + `remotePatterns`**: Bildoptimierung läuft direkt gegen die
  Directus-Asset-URLs (`/assets/<file-id>`). Falls du Directus hinter einer
  anderen Domain als in `.env` erreichst, `next.config.mjs` prüfen.

## Nächste Bauabschnitte

- Bildarchiv-Seite mit Suche/Filter nach Gewerk, Kategorie, Alarmcode
- Einzelbild-Detailseite
- Anmeldung + interner Organisationsbereich (Upload, eigene Bilder verwalten)
- Kontaktformular
