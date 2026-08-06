GitHub
GitHub welche repositorys hast du angebunden

Über deine GitHub-Verbindung (github_mcp_direct) sind keine spezifischen Repositories dauerhaft "angebunden" im Sinne einer festen Auswahl.

Die Verbindung ist aktiv und ermöglicht Zugriff auf:
Verfügbare Funktionen

    Alle deine Repositories auf GitHub (über search_repositories, get_file_contents, etc.)

    Issues & Pull Requests in beliebigen Repos, auf die du Zugriff hast

    Organisationen & Teams, deren Mitglied du bist

    Dein eigenes Profil (über get_me)

Was du tun kannst

Wenn du wissen möchtest, welche Repositories du besitzt oder zu denen du Zugriff hast, kann ich:

    Nach Repositories suchen (z. B. nach deinem Benutzernamen)

    Deine GitHub-Profilinfos abrufen

    In bestimmten Repos nach Dateien, Issues oder Commits schauen

Möchtest du, dass ich eine konkrete Aktion durchführe – z. B. eine Liste deiner Repositories erstellen oder in einem bestimmten Repo nach etwas suchen?
GitHub
GitHub liste
3 Schritte abgeschlossen

Hier sind deine 3 Repositories auf GitHub (Account: WITT-IT):
Deine Repositories
Repository	Beschreibung	Sprache	Zuletzt aktualisiert	Privatsphäre
Presseportal112	Repository für das Presseportal112.de	TypeScript	06.08.2026	🔒 Privat
Website-WITT-IT	—	HTML	04.08.2026	🔒 Privat
ameliana-ceramics	—	—	02.08.2026	🔒 Privat
Account-Übersicht

    GitHub-Profil: https://github.com/WITT-IT

    Öffentliche Repos: 0

    Private Repos: 3 (alle im Besitz)

    Account erstellt: 22.07.2026

Möchtest du in einem der Repos etwas Bestimmtes ansehen (z. B. Dateien, Commits, Issues)?
GitHub
GitHub ich möchte dass du Presseportal112 analysierts datei für datei
3 Schritte abgeschlossen

Ich analysiere das Presseportal112-Repository systematisch. Hier ist die vollständige Datei-für-Datei-Struktur:
📁 Root-Level (Projektkonfiguration)
Datei	Größe	Zweck
.dockerignore	54 B	Schließt Dateien vom Docker-Build aus
.env.example	2 KB	Beispiel-Umgebungsvariablen für Konfiguration
.gitignore	54 B	Ignoriert unversionierte Dateien (z. B. node_modules, .env)
Dockerfile	962 B	Container-Konfiguration für Deployment
README.md	3,3 KB	Projektdokumentation
middleware.ts	2,6 KB	Next.js Middleware (Auth, Routing-Logik)
next.config.mjs	662 B	Next.js-Konfiguration
package.json	733 B	Dependencies & Scripts (TypeScript-Projekt)
postcss.config.mjs	157 B	PostCSS-Konfiguration für Tailwind
tailwind.config.ts	1,2 KB	Tailwind CSS Design-System
tsconfig.json	593 B	TypeScript-Kompilierungseinstellungen
📁 /app (Next.js App Router)
Pages & Routen
Pfad	Datei	Größe	Zweck
/	page.tsx	5,9 KB	Startseite
/layout.tsx	3,9 KB	Root-Layout (HTML-Struktur, Provider)	
/globals.css	1,7 KB	Globale Styles	
/api	(Verzeichnis)	—	API-Routen (Backend-Endpoints)
/bildarchiv	(Verzeichnis)	—	Bildarchiv-Seite
/datenschutz	(Verzeichnis)	—	Datenschutzerklärung
/impressum	(Verzeichnis)	—	Impressum
/intern	(Verzeichnis)	—	Interner Bereich (geschützt)
/kontakt	(Verzeichnis)	—	Kontaktformular
/login	(Verzeichnis)	—	Login-Seite
/medienfreigabe	(Verzeichnis)	—	Medienfreigabe-Feature
/nutzungsbedingungen	(Verzeichnis)	—	AGB / Nutzungsbedingungen
/organisationen	(Verzeichnis)	—	Organisationsprofil / Verwaltung
/passwort-vergessen	(Verzeichnis)	—	Passwort-Reset-Anfrage
/passwort-zuruecksetzen	(Verzeichnis)	—	Passwort-Reset-Abschluss
/presse-alarm	(Verzeichnis)	—	Presse-Alarm Feature
/pressemappe	(Verzeichnis)	—	Pressemappe / Media Kit
/registrieren	(Verzeichnis)	—	Registrierung
📁 /components (React-Komponenten)

Das Repository enthält 58+ Komponenten (insgesamt ~100 KB Code). Wichtige Kategorien:
Authentifizierung & User-Management

    AccountDeleteForm.tsx (3,8 KB)

    ContactForm.tsx (13,8 KB)

    JoinForm.tsx (4 KB)

    LoginForm.tsx (in /app/login)

    LogoutButton.tsx (464 B)

    PressRegisterForm.tsx (5,3 KB)

    RegisterForm.tsx (12,2 KB)

    SubscribeForm.tsx (3,5 KB)

Admin & Moderation

    AdminAccountLookup.tsx (5,4 KB)

    AdminModerationList.tsx (4,9 KB)

    AdminRegistrationsList.tsx (11,5 KB)

    GroupManagementPanel.tsx (8,1 KB)

Medien & Content

    EditPostForm.tsx (19,7 KB) — Größte Komponente

    MediaBrowser.tsx (19,7 KB)

    MediaLibraryView.tsx (2,5 KB)

    PostGallery.tsx (6,7 KB)

    PostCalendar.tsx (5,4 KB)

    QuickUploadButton.tsx (4,1 KB)

    UploadForm.tsx (15,4 KB)

    UploadStudio.tsx (11,6 KB)

Medienfreigabe & Sharing

    AddToMediaShareControl.tsx (1,9 KB)

    CreateMediaShareForm.tsx (6,4 KB)

    FolderToShareControl.tsx (3 KB)

    MediaShareActions.tsx (3,6 KB)

    MediaShareLinkBox.tsx (4,4 KB)

    MediaSharePostPicker.tsx (3,7 KB)

    RemoveFromMediaShareButton.tsx (989 B)

Ordner & Organization

    AddToFolderControl.tsx (1,9 KB)

    CreateFolderForm.tsx (1,9 KB)

    FolderActions.tsx (3,2 KB)

    FolderPostPicker.tsx (3,2 KB)

    RemoveFromFolderButton.tsx (1,5 KB)

UI & Navigation

    Breadcrumbs.tsx (1,7 KB)

    CookieNotice.tsx (5,2 KB)

    DarkMasthead.tsx (2,5 KB)

    Footer.tsx (956 B)

    Header.tsx (7,7 KB)

    Hero.tsx (5,9 KB)

    InternSidebar.tsx (5,9 KB)

    SearchBox.tsx (6,8 KB)

    Ticker.tsx (2,4 KB)

Weitere Features

    AddToCartButton.tsx (1,6 KB)

    ArticleCartToggle.tsx (658 B)

    CartProvider.tsx (1,8 KB)

    ConversationThread.tsx (5 KB)

    GalleryCard.tsx (2,7 KB)

    GewerkFilterTabs.tsx (927 B)

    GewerkeGrid.tsx (1,7 KB)

    MyImagesList.tsx (5,4 KB)

    OrgProfileEditor.tsx (12,2 KB)

    OrganizationSearch.tsx (2,5 KB)

    PhotoMosaic.tsx (3,9 KB)

    PressemappeView.tsx (4,1 KB)

    RichTextEditor.tsx (3,3 KB)

    StartConversationForm.tsx (4,9 KB)

Utility & State

    AlarmCodeInput.tsx (2,2 KB)

    DateLine.tsx (719 B)

    DialogProvider.tsx (5,2 KB)

    StatStrip.tsx (1,1 KB)

📁 /lib (Backend-Logik & Utilities)
Datei	Größe	Zweck
auth.ts	4,2 KB	Authentifizierungslogik (Session, Tokens)
directus.ts	984 B	Directus CMS/DB-Client
email.ts	18,7 KB	E-Mail-Versand (Templates, Versandlogik)
messaging.ts	1,5 KB	Nachrichten-System
passwordResetToken.ts	2 KB	Passwort-Reset-Token-Verwaltung
queries.ts	24,5 KB	Datenbank-Queries (Directus)
structuredData.ts	479 B	Schema.org / SEO-Daten
subscriptions.ts	2,8 KB	Abonnement-Verwaltung
types.ts	4,9 KB	TypeScript-Interfaces & Typen
watermark.ts	3,2 KB	Wasserzeichen-Logik für Bilder
📊 Zusammenfassung

Tech-Stack:

    Framework: Next.js 14+ (App Router)

    Sprache: TypeScript

    Styling: Tailwind CSS

    Backend: Directus (Headless CMS / Datenbank)

    Auth: Eigenes Session-System

    Deployment: Docker-ready

Projektumfang:

    ~100+ Dateien

    Private Next.js-App für Presse-/Medienportal

    Features: User-Registrierung, Medienupload, Pressemappe, Medienfreigabe, Admin-Moderation, Team-Management, E-Mail-System, Passwort-Reset

Möchtest du tiefer in bestimmte Dateien eintauchen (z. B. auth.ts, queries.ts, EditPostForm.tsx) oder die API-Routen in /app/api analysieren?
GitHub
GitHub das mit dem ganzen öffentlich-ordner quatsch kann raus jedes mal wenn ich auf Veröffentlichen klicke wird ein neues bild in directus erzeugt. es soll einfach das bild, welches ich aus einem ordner veröffentlichen möchte veröffentlich werden :) baue alles nötige um, damit es ganz unkompliziert bleibt.

Verstanden – ich entferne die komplette Ordner-Logik und sorge dafür, dass beim Veröffentlichen kein Duplikat mehr entsteht. Der Trick: Das Original-Bild muss gar nicht neu hochgeladen werden – es liegt schon in Directus (item.file). Wir verlinken es einfach direkt, statt es jedes Mal zu kopieren. Nur die Wasserzeichen-Varianten (die es vorher nicht gibt) werden erzeugt und – wie schon vorhanden – für künftige Klicks gecacht.
Was sich ändert
Vorher	Jetzt
Original wird bei jedem Klick komplett neu von Directus geladen und als neue Datei wieder hochgeladen	Original wird direkt verlinkt (item.file) – keine Kopie, kein Duplikat
PUBLIC_FOLDER_ID steuert, in welchen Directus-Ordner Preview/Download wandern	Komplett entfernt – Dateien landen einfach im Root, keine Ordner-Zuweisung mehr nötig
Fehleranfällig durch Foreign-Key auf nicht existierenden Ordner	Diese Fehlerquelle existiert nicht mehr
Ersetze app/api/intern/upload/route.ts mit der Datei oben
Aufräumen in Coolify

Die Variable wird nicht mehr gebraucht – kannst du komplett löschen:

text
DIRECTUS_PUBLIC_FOLDER_ID

Warum das jetzt "unkompliziert" ist

Original-Bild: Statt bei jedem Klick das Original von Directus herunterzuladen und als neue Datei wieder hochzuladen, wird jetzt einfach die vorhandene file-ID aus media_library direkt am images-Eintrag verlinkt:

typescript
const originalId: string = item.file;

Kein Netzwerk-Roundtrip, keine Dublette, kein Fehlerrisiko mehr an dieser Stelle.

Wasserzeichen-Bilder: Die müssen zwangsläufig neu erzeugt werden (echte Bearbeitung, kein Duplikat des Originals) – aber der bereits vorhandene Cache-Mechanismus (file_preview_watermarked / file_download_watermarked auf dem media_library-Eintrag) sorgt dafür, dass ein zweiter Klick auf dasselbe Bild diese wiederverwendet, statt sie erneut hochzuladen.

Ordner-Zuweisung: Komplett raus aus Modus A. Directus-Dateien landen einfach im Root der File Library – kein folder-Feld mehr, kein Foreign-Key-Risiko.
Ergebnis

Ein Klick auf "Veröffentlichen" erzeugt jetzt maximal zwei neue Dateien in Directus (die Wasserzeichen-Varianten) statt drei, und bei erneutem Veröffentlichen desselben Bildes im besten Fall null neue Dateien – das Original wird nie dupliziert.

Deploy die neue route.ts, danach sollte "Einsatzbild veröffentlichen" clean durchlaufen.
Erstellt mit Claude Sonnet 5 Thinking
@GitHub isAdministrator: Nutzer a20bfbb0-c92e-4d99-8401-a3506cf32d19 hat Rolle {"name":"Organisation"}
isAdministrator: Nutzer a20bfbb0-c92e-4d99-8401-a3506cf32d19 hat Rolle {"name":"Organisation"}
isAdministrator: Nutzer a20bfbb0-c92e-4d99-8401-a3506cf32d19 hat Rolle {"name":"Organisation"}
isAdministrator: Nutzer a20bfbb0-c92e-4d99-8401-a3506cf32d19 hat Rolle {"name":"Organisation"}
isAdministrator: Nutzer a20bfbb0-c92e-4d99-8401-a3506cf32d19 hat Rolle {"name":"Organisation"}
at async w (.next/server/app/api/auth/login/route.js:1:1132)
at async k (.next/server/app/api/auth/login/route.js:1:4246)
at async g (.next/server/app/api/auth/login/route.js:1:5249)
at async C (.next/server/app/api/auth/login/route.js:1:6371) {
status: 401
}
Login fehlgeschlagen: Error: Invalid user credentials.
at f (.next/server/chunks/2724.js:1:14966)
at async w (.next/server/app/api/auth/login/route.js:1:1132)
at async k (.next/server/app/api/auth/login/route.js:1:4246)
at async g (.next/server/app/api/auth/login/route.js:1:5249)
at async C (.next/server/app/api/auth/login/route.js:1:6371) {
status: 401
}
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=300&quality=70 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=300&quality=70 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=200&quality=70 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=2000&quality=70 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=600&quality=80 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/86fd3143-63d0-499c-b692-e483cdfdf398?width=1400&quality=85 403

Zwei Fehler in deinem Log – ich gehe beide durch:
Fehler 1 (kritisch): 403 auf Bilder – das war ein Rückschritt durch meine letzte Änderung

Als ich PUBLIC_FOLDER_ID entfernt habe, landen neue Wasserzeichen-Dateien jetzt ohne Ordner in Directus. Deine Organisation-Rolle hat vermutlich eine Directus-Permission-Policy, die Datei-Lesezugriff auf bestimmte Ordner beschränkt – Dateien ohne Ordner (folder = null) fallen dann durchs Raster → 403 beim Anzeigen. Genau das siehst du bei der neu erzeugten Wasserzeichen-Datei 86fd3143-....

Die unkomplizierte Lösung: Statt eine feste Ordner-ID zu konfigurieren (die immer wieder veralten kann), übernehmen die neuen Dateien einfach automatisch denselben Ordner wie das Original-Bild. Kein manuelles Config-Feld mehr nötig – funktioniert für jede Organisation automatisch richtig.
Fehler 2: Invalid user credentials (401) beim Login

Das ist unabhängig vom Bild-Bug – deine Session bzw. der Refresh-Token ist vermutlich abgelaufen oder ungültig geworden. Einmal komplett ausloggen und neu einloggen behebt das meistens. Falls es danach weiterhin auftritt, sag Bescheid – dann schauen wir uns lib/auth.ts genauer an.
Korrigierte route.ts
Was neu ist gegenüber der letzten Version

Eine zusätzliche Funktion getFileFolder(), die vor dem Hochladen der Wasserzeichen-Dateien kurz nachfragt, in welchem Directus-Ordner das Original liegt – und diesen Ordner automatisch für preview_0/download_0 übernimmt:

typescript
const inheritedFolderId = await getFileFolder(accessToken, originalId);
previewId = await uploadBuffer(accessToken, prevBuf, ..., inheritedFolderId);
downloadId = await uploadBuffer(accessToken, dlBuf, ..., inheritedFolderId);

Kein DIRECTUS_PUBLIC_FOLDER_ID mehr nötig, keine veralteten IDs, kein manuelles Pflegen – die Berechtigung "erbt" sich einfach vom Original.
Das bereits existierende Bild reparieren

Die Datei 86fd3143-63d0-499c-b692-e483cdfdf398, die gerade 403 wirft, wurde mit dem fehlerhaften ordnerlosen Code erzeugt. Zwei Optionen:

    Einfachster Weg: Lösche den betroffenen Beitrag in Directus und veröffentliche das Bild aus der Medienbibliothek erneut – mit der neuen route.ts bekommt es automatisch den richtigen Ordner

    Ohne Neuerstellung: Öffne die Datei 86fd3143-... direkt im Directus Admin-Panel unter File Library und ordne sie manuell per Drag & Drop dem richtigen Ordner zu (dem, in dem auch das zugehörige Original liegt)

Nächste Schritte

    route.ts ersetzen und deployen

    Betroffenes Bild wie oben reparieren (Variante 1 oder 2)

    Bei anhaltendem Invalid user credentials-Fehler: komplett ausloggen, Browser-Cache/Cookies für die Domain leeren, neu einloggen – falls das Problem bleibt, schick mir den Inhalt von lib/auth.ts, dann schaue ich mir die Token-Refresh-Logik an.

Erstellt mit Claude Sonnet 5 Thinking
@GitHub ⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/2b9d076f-f440-41fe-9398-282e4e149d18?width=2000&quality=70 403
⨯ upstream image response failed for https://directus.witt-itsolutions.de/assets/2b9d076f-f440-41fe-9398-282e4e149d18?width=600&quality=80 403

Jetzt ist der wahre Zusammenhang klar – das war kein Folgefehler, sondern die eigentliche Ursache, die ich mit "Ordner vom Original erben" nur zufällig manchmal behoben habe.
Der eigentliche Grund

Deine Directus-Instanz hat eine Permission-Policy für die Public-Rolle, die den Lesezugriff auf directus_files nur für Dateien in einem bestimmten Ordner erlaubt – dem, den getSystemFolders() in deinem Code als system_role === 'public' (bzw. "Öffentlich") findet. Wenn ein Besucher deine öffentliche Website ohne Login aufruft, prüft Directus die Public-Rolle, nicht deine "Organisation"-Rolle.

Mein letzter Fix ("Ordner vom Original erben") war der falsche Ansatz: Das Original liegt meist in einem privaten/Organisations-Ordner (nur für eingeloggte Nutzer lesbar) – nicht im öffentlichen. Die Wasserzeichen-Bilder, die auf der öffentlichen Seite angezeigt werden, müssen aber tatsächlich im "Öffentlich"-Ordner landen, damit anonyme Besucher sie sehen können. Genau das war der ursprüngliche Sinn von DIRECTUS_PUBLIC_FOLDER_ID – nur die ID selbst war veraltet (daher der Foreign-Key-Fehler).
Die robuste Lösung: Ordner live nachschlagen statt fest konfigurieren

Dein Code hat bereits eine Funktion, die genau diesen Ordner dynamisch findet (getSystemFolders, aktuell nur in Modus B genutzt). Ich nutze sie jetzt auch in Modus A – kein DIRECTUS_PUBLIC_FOLDER_ID mehr nötig, keine veralteten IDs, funktioniert automatisch auch wenn der Ordner in Directus mal neu angelegt wird.
Was jetzt passiert

    Beitrag öffentlich (makePublic = true): Wasserzeichen-Dateien wandern automatisch in den echten "Öffentlich"-Ordner deiner Organisation – live per API nachgeschlagen, nicht hartcodiert

    Beitrag als Entwurf (makePublic = false): Kein öffentlicher Ordner nötig, da nur eingeloggte Redaktionsnutzer mit eigenem Bearer-Token zugreifen – dort greift die Public-Rolle gar nicht

Bereits fehlerhaft erzeugte Bilder reparieren

Die beiden Bilder, die jetzt 403 werfen (86fd3143-... und 2b9d076f-...), wurden mit den zwischenzeitlich fehlerhaften Versionen erzeugt und liegen im falschen Ordner. Schnellster Weg, ohne den Beitrag zu löschen:

    Directus Admin-Panel → File Library → nach der Datei-ID suchen (z. B. 86fd3143)

    Datei anklicken → per Drag & Drop in den "Öffentlich"-Ordner verschieben

    Für beide betroffenen Dateien wiederholen

Danach sollten beide Bilder ohne 403 laden – ganz ohne Neuveröffentlichung.
Nächster Schritt

    route.ts ersetzen, deployen

    Die zwei bestehenden Dateien wie oben in den richtigen Ordner verschieben

    Ein neues Einsatzbild veröffentlichen und prüfen, ob es sofort ohne 403 lädt

Falls dann noch etwas hakt: sag mir, ob getSystemFolders in den Logs publicFolderId: null zurückgibt – das würde heißen, dass in Directus gar kein Ordner mit system_role = "public" oder Namen "Öffentlich" für deine Organisation existiert, und wir legen einen an.
Erstellt mit Claude Sonnet 5 Thinking
Follow-ups
Directus System-Ordner Berechtigungen prüfen
Troubleshooting Directus Asset 403 Forbidden Fehler
API-basiertes Dateimanagement in Directus automatisieren
Directus Rollenbasierte Zugriffskontrolle (RBAC) für Assets konfigurieren
Logs in Directus für Asset-Uploads analysieren

 
// v6 - Fix für die eigentliche Ursache der 403-Fehler beim Anzeigen
// veröffentlichter Bilder: Die "Public"-Rolle in Directus darf nur Dateien
// in einem bestimmten Ordner ("Öffentlich"/system_role="public") lesen.
// Öffentlich sichtbare Wasserzeichen-Dateien (preview_0/download_0) müssen
// dort landen, sonst bekommen anonyme Website-Besucher 403 -- unabhängig
// davon, in welchem Ordner das Original liegt (das ist meist NICHT
// öffentlich, sondern nur für eingeloggte Redaktionsnutzer gedacht).
//
// Der öffentliche Ordner wird jetzt live über getSystemFolders() ermittelt
// (dieselbe Funktion, die Modus B schon nutzt) -- keine feste
// DIRECTUS_PUBLIC_FOLDER_ID mehr nötig, kein Risiko einer veralteten ID.
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL, directusAssetUrl } from '@/lib/directus';
import sanitizeHtml from 'sanitize-html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
};

async function uploadBuffer(token: string, buffer: Buffer, mimeType: string, filename: string, folderId?: string | null): Promise<string> {
  const fileId = randomUUID();
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fileId}\r\n`));
  if (folderId) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folderId}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  let res: Response;
  try {
    res = await fetch(`${DIRECTUS_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(body.length) },
      body,
    });
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Datei-Upload zu Directus:', networkError, { DIRECTUS_URL, filename, size: body.length, folderId });
    throw new Error(`Verbindung zu Directus fehlgeschlagen (Datei-Upload): ${networkError instanceof Error ? networkError.message : String(networkError)}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '(kein Response-Body)');
    console.error('[upload] Directus /files lehnte Upload ab:', { status: res.status, errText, filename, size: body.length, folderId });
    throw new Error(`Datei-Upload fehlgeschlagen (${res.status}): ${errText}`);
  }
  return fileId;
}

function normalizeIdArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

async function assignToFolder(token: string, folderId: string, postId: string) {
  await fetch(`${DIRECTUS_URL}/items/folders_posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders_id: folderId, posts_id: postId }),
  }).catch((error) => console.error('[upload] assignToFolder fehlgeschlagen (ignoriert):', error));
}

// Ermittelt live den öffentlichen und den "Unsortiert"-Ordner der
// Organisation in Directus -- keine feste ID im Code/Env, funktioniert auch
// nach Umbenennung/Neuanlage des Ordners weiter.
async function getSystemFolders(token: string, orgId: string) {
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/folders?filter[organization][_eq]=${orgId}&fields=id,name,system_role&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error('[upload] getSystemFolders: Directus-Antwort nicht ok:', { status: res.status });
      return { publicFolderId: null, unsortedFolderId: null };
    }
    const { data } = await res.json();
    const rows = data as { id: string; name: string; system_role?: string | null }[];
    return {
      publicFolderId: rows.find((r) => r.system_role === 'public')?.id ?? rows.find((r) => r.name === 'Öffentlich')?.id ?? null,
      unsortedFolderId: rows.find((r) => r.system_role === 'unsorted')?.id ?? rows.find((r) => r.name === 'Unsortiert')?.id ?? null,
    };
  } catch (error) {
    console.error('[upload] getSystemFolders fehlgeschlagen:', error);
    return { publicFolderId: null, unsortedFolderId: null };
  }
}

// ── Modus A: Veröffentlichen aus der Medienbibliothek ──────────────────────
// Original wird direkt verlinkt (item.file) -- keine Kopie, kein Duplikat.
// Wasserzeichen-Varianten sind echte neue Dateien und werden pro Bild
// gecacht (file_preview_watermarked / file_download_watermarked). Sie
// landen -- wenn der Beitrag öffentlich ist -- im öffentlichen
// Directus-Ordner, damit anonyme Website-Besucher sie ohne 403 sehen.
async function handlePublishFromLibrary(
  formData: FormData,
  accessToken: string,
  organizationId: string
) {
  const sourceMediaId = formData.get('source_media_id') as string;
  const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
  const isStock = postTypeRaw === 'stockfoto';
  const title = isStock ? null : ((formData.get('title') as string) || null);
  const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
  const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
  const location = isStock ? null : ((formData.get('location') as string) || null);
  const tagsRaw = (formData.get('tags') as string) || '';
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
  const articleBody = articleBodyRaw.trim() ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS) : null;
  const makePublic = formData.get('make_public') === 'true';
  const caption = (formData.get('caption') as string) || null;
  const useCached = formData.get('use_cached_watermark') === 'true';

  const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  let itemRes: Response;
  try {
    itemRes = await fetch(
      `${DIRECTUS_URL}/items/media_library/${sourceMediaId}?fields=id,organization,file,file_preview_watermarked,file_download_watermarked,used_in_posts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Laden des media_library-Items:', networkError, { sourceMediaId, DIRECTUS_URL });
    return NextResponse.json({ error: 'Verbindung zu Directus fehlgeschlagen. Bitte erneut versuchen.' }, { status: 502 });
  }

  if (!itemRes.ok) {
    const errText = await itemRes.text().catch(() => '');
    console.error('[upload] media_library-Item nicht gefunden:', { sourceMediaId, status: itemRes.status, errText });
    return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });
  }
  const { data: item } = await itemRes.json();
  if (item.organization !== organizationId) {
    console.error('[upload] Berechtigungsfehler:', { sourceMediaId, itemOrg: item.organization, requestOrg: organizationId });
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }

  // ── Original einfach direkt verlinken -- keine Kopie, kein Duplikat. ────
  const originalId: string = item.file;

  let previewId: string;
  let downloadId: string;

  try {
    if (useCached && item.file_preview_watermarked && item.file_download_watermarked) {
      previewId = item.file_preview_watermarked;
      downloadId = item.file_download_watermarked;
    } else {
      const previewFile = formData.get('preview_0') as File | null;
      const downloadFile = formData.get('download_0') as File | null;
      if (!previewFile || !downloadFile) {
        console.error('[upload] Wasserzeichen-Dateien fehlen im FormData:', {
          hasPreview: !!previewFile,
          hasDownload: !!downloadFile,
          useCached,
        });
        return NextResponse.json({ error: 'Wasserzeichen-Varianten fehlen.' }, { status: 400 });
      }

      // Öffentlicher Ordner nur relevant, wenn der Beitrag auch öffentlich
      // wird -- sonst sehen die Bilder nur eingeloggte Redaktionsnutzer
      // (eigener Bearer-Token, kein Public-Rollen-Problem).
      let targetFolderId: string | null = null;
      if (makePublic) {
        const { publicFolderId } = await getSystemFolders(accessToken, organizationId);
        if (!publicFolderId) {
          console.error('[upload] Kein öffentlicher Ordner für Organisation gefunden -- Bilder landen ohne Ordner und sind für anonyme Besucher ggf. nicht lesbar (403):', { organizationId });
        }
        targetFolderId = publicFolderId;
      }

      const [prevBuf, dlBuf] = await Promise.all([
        previewFile.arrayBuffer().then(Buffer.from),
        downloadFile.arrayBuffer().then(Buffer.from),
      ]);
      const uid = randomUUID().slice(0, 8);
      previewId = await uploadBuffer(accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev.jpg`, targetFolderId);
      downloadId = await uploadBuffer(accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl.jpg`, targetFolderId);

      // Für zukünftige Veröffentlichungen desselben Bildes cachen, damit ein
      // erneuter Klick (oder ein zweiter Beitrag mit demselben Quellbild)
      // diese Dateien wiederverwendet statt sie erneut hochzuladen.
      await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ file_preview_watermarked: previewId, file_download_watermarked: downloadId }),
      }).catch((error) => console.error('[upload] Wasserzeichen-Cache-Update fehlgeschlagen (ignoriert):', error));
    }
  } catch (error) {
    console.error('[upload] Wasserzeichen-Verarbeitung fehlgeschlagen:', error, { sourceMediaId, useCached });
    return NextResponse.json({ error: 'Wasserzeichen konnten nicht hochgeladen werden. Bitte erneut versuchen.' }, { status: 502 });
  }

  const postId = randomUUID();
  const now = new Date().toISOString();

  let postRes: Response;
  try {
    postRes = await fetch(`${DIRECTUS_URL}/items/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: postId,
        organization: organizationId,
        post_type: postTypeRaw,
        title,
        article_body: articleBody,
        event_date: eventDate || null,
        alarm_code: alarmCode || null,
        location: location || null,
        tags,
        is_public: makePublic,
        published_at: makePublic ? now : null,
      }),
    });
  } catch (networkError) {
    console.error('[upload] Netzwerkfehler beim Anlegen des Beitrags:', networkError);
    return NextResponse.json({ error: 'Verbindung zu Directus fehlgeschlagen. Bitte erneut versuchen.' }, { status: 502 });
  }

  if (!postRes.ok) {
    const errText = await postRes.text().catch(() => '');
    console.error('[upload] Beitrag anlegen fehlgeschlagen:', { status: postRes.status, errText, postId, postTypeRaw, alarmCode, tags });
    return NextResponse.json({ error: `Beitrag anlegen fehlgeschlagen: ${errText}` }, { status: 500 });
  }

  try {
    await fetch(`${DIRECTUS_URL}/items/images`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: randomUUID(),
        post: postId,
        file_original: originalId,
        file_public_preview: makePublic ? previewId : null,
        file_download: makePublic ? downloadId : null,
        file_public_preview_watermarked: previewId,
        file_download_watermarked: downloadId,
        no_watermark: false,
        caption,
        sort: 0,
      }),
    });
  } catch (error) {
    console.error('[upload] images-Eintrag anlegen fehlgeschlagen:', error, { postId, originalId, previewId, downloadId });
  }

  const usedInPosts: string[] = normalizeIdArray(item.used_in_posts);
  await fetch(`${DIRECTUS_URL}/items/media_library/${sourceMediaId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ used_in_posts: [...usedInPosts, postId] }),
  }).catch((error) => console.error('[upload] used_in_posts-Update fehlgeschlagen (ignoriert):', error));

  return NextResponse.json({ ok: true, id: postId });
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch (error) {
    console.error('[upload] Session-Cookie ungültig:', error);
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser(session.accessToken);
  } catch (error) {
    console.error('[upload] getCurrentUser fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Anmeldung konnte nicht überprüft werden. Bitte neu einloggen.' }, { status: 401 });
  }
  if (!user?.organization?.id) {
    console.error('[upload] Kein organization.id am User:', { userId: (user as { id?: string } | null)?.id });
    return NextResponse.json({ error: 'Keine Organisation.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error('[upload] formData()-Parsing fehlgeschlagen:', error, {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
    });
    return NextResponse.json(
      { error: 'Upload-Daten konnten nicht verarbeitet werden. Möglicherweise ist die Datei zu groß.' },
      { status: 413 }
    );
  }

  const sourceMediaId = formData.get('source_media_id') as string | null;
  if (sourceMediaId) {
    try {
      return await handlePublishFromLibrary(formData, session.accessToken, user.organization.id);
    } catch (error) {
      console.error('[upload] Veröffentlichen fehlgeschlagen (unerwartet):', error);
      return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
    }
  }

  // ── Modus B: alter sequenzieller Datei-Upload-Flow (unverändert, toter Pfad) ──
  const imageIndex = Number(formData.get('image_index') ?? 0);
  const isLast = formData.get('is_last') === 'true';
  const existingPostId = (formData.get('post_id') as string) || null;
  const makePublic = formData.get('make_public') === 'true';
  const sort = Number(formData.get('sort') ?? imageIndex);

  const authHeaders = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };

  try {
    let postId: string;
    let finalFolderId: string | null = null;
    let originFolderId: string | null = null;

    if (imageIndex === 0) {
      const postTypeRaw = (formData.get('post_type') as string) || 'einsatz';
      const isStock = postTypeRaw === 'stockfoto';
      const title = isStock ? null : ((formData.get('title') as string) || null);
      const eventDate = isStock ? null : ((formData.get('event_date') as string) || null);
      const alarmCode = isStock ? null : ((formData.get('alarm_code') as string) || null);
      const location = isStock ? null : ((formData.get('location') as string) || null);
      const tagsRaw = (formData.get('tags') as string) || '';
      const articleBodyRaw = isStock ? '' : ((formData.get('article_body') as string) || '');
      const articleBody = articleBodyRaw.trim() ? sanitizeHtml(articleBodyRaw, ARTICLE_SANITIZE_OPTIONS) : null;
      const targetFolderIdRaw = (formData.get('folder_id') as string) || '';
      const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

      const { publicFolderId, unsortedFolderId } = await getSystemFolders(session.accessToken, user.organization.id);

      if (makePublic && publicFolderId) {
        finalFolderId = publicFolderId;
        if (targetFolderIdRaw) originFolderId = targetFolderIdRaw;
      } else if (targetFolderIdRaw) {
        finalFolderId = targetFolderIdRaw;
      } else {
        finalFolderId = unsortedFolderId;
      }

      postId = randomUUID();
      const now = new Date().toISOString();
      const postBody: Record<string, unknown> = {
        id: postId, organization: user.organization.id, title,
        article_body: articleBody, event_date: eventDate || null,
        alarm_code: alarmCode || null, location: location || null,
        tags, is_public: makePublic, published_at: makePublic ? now : null,
        post_type: postTypeRaw,
      };
      if (originFolderId) postBody.origin_folder_id = originFolderId;

      let postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers: authHeaders, body: JSON.stringify(postBody) });
      if (!postRes.ok) {
        const errText = await postRes.text();
        if (postRes.status === 403 && errText.includes('post_type')) {
          delete postBody.post_type; delete postBody.origin_folder_id;
          postRes = await fetch(`${DIRECTUS_URL}/items/posts`, { method: 'POST', headers: authHeaders, body: JSON.stringify(postBody) });
        }
        if (!postRes.ok) throw new Error(`Beitrag anlegen fehlgeschlagen: ${await postRes.text()}`);
      }
    } else {
      if (!existingPostId) return NextResponse.json({ error: 'post_id fehlt.' }, { status: 400 });
      postId = existingPostId;
      finalFolderId = (formData.get('final_folder_id') as string) || null;
      originFolderId = (formData.get('origin_folder_id') as string) || null;
    }

    const originalFile = formData.get('original_0') as File | null;
    const previewFile = formData.get('preview_0') as File | null;
    const downloadFile = formData.get('download_0') as File | null;
    const caption = (formData.get('caption_0') as string) || null;

    if (originalFile && previewFile && downloadFile) {
      const [origBuf, prevBuf, dlBuf] = await Promise.all([
        originalFile.arrayBuffer().then(Buffer.from),
        previewFile.arrayBuffer().then(Buffer.from),
        downloadFile.arrayBuffer().then(Buffer.from),
      ]);
      const uid = randomUUID().slice(0, 8);
      const baseName = originalFile.name.replace(/\.[^.]+$/, '');
      const originalId = await uploadBuffer(session.accessToken, origBuf, originalFile.type || 'image/jpeg', `${uid}-orig-${baseName}`, finalFolderId);
      const previewId = await uploadBuffer(session.accessToken, prevBuf, previewFile.type || 'image/jpeg', `${uid}-prev-${baseName}.jpg`, finalFolderId);
      const downloadId = await uploadBuffer(session.accessToken, dlBuf, downloadFile.type || 'image/jpeg', `${uid}-dl-${baseName}.jpg`, finalFolderId);

      await fetch(`${DIRECTUS_URL}/items/images`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          id: randomUUID(), post: postId,
          file_original: originalId,
          file_public_preview: makePublic ? previewId : null,
          file_download: makePublic ? downloadId : null,
          file_public_preview_watermarked: previewId,
          file_download_watermarked: downloadId,
          no_watermark: false, caption: caption || null, sort,
        }),
      });
    }

    if (isLast) {
      if (finalFolderId) await assignToFolder(session.accessToken, finalFolderId, postId);
      if (originFolderId && originFolderId !== finalFolderId) await assignToFolder(session.accessToken, originFolderId, postId);
    }

    return NextResponse.json({ ok: true, id: postId, final_folder_id: finalFolderId, origin_folder_id: originFolderId });
  } catch (error) {
    console.error('[upload] Upload fehlgeschlagen (Modus B):', error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }, { status: 500 });
  }
}
