import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung von Presseportal112.de.',
};

export default function DatenschutzPage() {
  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[760px]">
        <h1 className="mb-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em]">
          Datenschutzerklärung
        </h1>
        <p className="mb-10 font-mono text-[11.5px] text-ink-3">Stand: 27. Juli 2026</p>

        <div className="prose-article text-[14.5px] text-ink">
          <h2>1. Verantwortlicher</h2>
          <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
          <p>
            Pressportal112.de
            Benedict Möller
            <br />
            Leopoldstraße 7
            <br />
            88682 Salem
            <br />
            Telefon: +49 (0) 176 83055821
          </p>
          <p>(im Folgenden „wir&quot; oder „der Betreiber&quot;)</p>

          <h2>2. Allgemeines zur Datenverarbeitung</h2>
          <p>
            Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies
            zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und
            Leistungen erforderlich ist. Soweit wir für Verarbeitungsvorgänge eine Einwilligung
            einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage. Bei der Verarbeitung
            zur Erfüllung eines Vertrags bzw. vorvertraglicher Maßnahmen dient Art. 6 Abs. 1 lit.
            b DSGVO als Rechtsgrundlage. Soweit die Verarbeitung zur Wahrung berechtigter
            Interessen erforderlich ist, dient Art. 6 Abs. 1 lit. f DSGVO als Rechtsgrundlage.
          </p>

          <h2>3. Hosting</h2>
          <p>Diese Website wird bei einem externen Dienstleister gehostet:</p>
          <p>
            1&amp;1 IONOS SE
            <br />
            Elgendorfer Str. 57
            <br />
            56410 Montabaur
          </p>
          <p>
            Bei IONOS werden alle Daten gespeichert und verarbeitet, die zum Betrieb dieser
            Website und der zugehörigen Backend-Systeme erforderlich sind, insbesondere
            IP-Adressen, Zugriffs-/Server-Logdaten sowie alle über die Website eingegebenen
            Inhalte. Der Einsatz erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO sowie Art.
            28 DSGVO. Mit IONOS besteht ein Vertrag über Auftragsverarbeitung (AVV) gemäß Art. 28
            DSGVO. Die Server befinden sich nach Angaben von IONOS in Deutschland.
          </p>

          <h2>3.1 Erhebung von Zugriffsdaten und Logfiles</h2>
          <p>
            Beim Aufruf unserer Website erfasst der Webserver automatisiert u. a. IP-Adresse,
            Datum und Uhrzeit des Zugriffs, aufgerufene Seite, verwendeten Browser sowie die
            zuvor besuchte Seite. Diese Daten dienen ausschließlich der Gewährleistung eines
            störungsfreien Betriebs und der Abwehr von Angriffen (Art. 6 Abs. 1 lit. f DSGVO).
            Diese Website betreibt derzeit keine eigene, darüber hinausgehende Besucherzählung
            oder Analyse-/Tracking-Software.
          </p>

          <h2>4. Cookies</h2>
          <p>
            Wir setzen ausschließlich technisch notwendige Cookies ein. Für angemeldete Nutzer
            aus registrierten Organisationen wird nach dem Login ein Cookie mit dem Namen
            <code> pp_session</code> gesetzt. Es speichert ausschließlich eine verschlüsselte
            Sitzungskennung, ist clientseitig nicht auslesbar und läuft nach 10 Minuten
            Inaktivität automatisch ab. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO i. V. m. §
            25 Abs. 2 Nr. 2 TDDDG. Es werden keine Cookies zu Marketing-, Tracking- oder
            Analysezwecken eingesetzt.
          </p>

          <h2>5. Eingebundene externe Ressourcen</h2>
          <p>
            Schriftarten werden beim Bauen der Website automatisch auf unseren eigenen Server
            heruntergeladen und von dort ausgeliefert — es findet kein Nachladen von externen
            Google-Servern zur Laufzeit statt. Für Symbole wird die Bibliothek „Tabler Icons&quot;
            über ein externes Content-Delivery-Netzwerk (cdnjs.cloudflare.com, Cloudflare, Inc.)
            nachgeladen, wobei die IP-Adresse an Cloudflare übermittelt wird (Art. 6 Abs. 1 lit.
            f DSGVO).
          </p>

          <h2>6. Kontaktformular</h2>
          <p>
            Bei Nutzung des Kontaktformulars werden Name, E-Mail-Adresse, ggf. ausgewählte
            Organisation, Betreff und Nachricht gespeichert und zusätzlich per E-Mail an die
            gewählte Organisation bzw. die allgemeine Redaktionsadresse weitergeleitet
            (Rechtsgrundlage: Art. 6 Abs. 1 lit. f bzw. lit. b DSGVO). Die Weiterleitung erfolgt
            über einen externen E-Mail-Versanddienst, siehe Ziffer 10.
          </p>

          <h2>7. Registrierung und Nutzerkonten für Organisationen</h2>
          <p>
            Mitarbeitende angeschlossener Organisationen können sich registrieren. Dabei werden
            Vorname, Nachname, dienstliche E-Mail-Adresse, ein verschlüsselt gespeichertes
            Passwort sowie gewünschte Organisation und Gewerk erhoben (Art. 6 Abs. 1 lit. b
            DSGVO). Das Konto wird erst nach manueller Prüfung durch den Betreiber freigeschaltet.
            Nach Freischaltung können Nutzer im internen Bereich Bilder hochladen, veröffentlichen,
            bearbeiten und löschen.
          </p>

          <h2>8. Presse-Alarm</h2>
          <p>
            Nutzer können sich freiwillig für E-Mail-Benachrichtigungen bei neuen Fotos
            anmelden. Hierfür werden E-Mail-Adresse und ausgewählte Gewerke gespeichert. Die
            Anmeldung erfolgt im Double-Opt-in-Verfahren: Erst nach Bestätigung per Klick auf
            einen Link in der Bestätigungsmail wird der Dienst aktiv (Art. 6 Abs. 1 lit. a
            DSGVO). Die Einwilligung kann jederzeit über den Abmeldelink in jeder
            Benachrichtigungsmail widerrufen werden.
          </p>

          <h2>9. Presse-Korb / Pressemappe</h2>
          <p>
            Die Auswahl gesammelter Fotos wird ausschließlich lokal im Browser gespeichert
            (Local Storage) und nicht an unsere Server übertragen, solange kein Download
            ausgelöst wird. Beim Download werden die IDs der ausgewählten, ohnehin öffentlich
            zugänglichen Fotos kurzzeitig übermittelt, um die ZIP-Datei zusammenzustellen.
          </p>

          <h2>10. Versand von E-Mails</h2>
          <p>
            Für den Versand von E-Mails nutzen wir einen externen E-Mail-Versanddienst
            (SMTP-Anbieter).
          </p>
          <p>
            <em>
              [Platzhalter — bitte ergänzen, sobald der SMTP-Anbieter final feststeht: Name und
              Anschrift des Anbieters, ob ein Auftragsverarbeitungsvertrag besteht, Serverstandort]
            </em>
          </p>

          <h2>11. Veröffentlichte Einsatzfotos und Artikel</h2>
          <p>
            Angeschlossene Organisationen veröffentlichen in eigener Verantwortung Einsatzfotos
            samt Begleittext. Für die presserechtliche und persönlichkeitsrechtliche
            Zulässigkeit der Veröffentlichung eines konkreten Bildes (u. a. Kunsturhebergesetz,
            Landespressegesetze) ist die jeweils hochladende Organisation verantwortlich.
            Veröffentlichte Bilder sind zur redaktionellen Verwendung unter Quellenangabe „Foto:
            [Organisation] / presseportal112.de&quot; freigegeben. Betroffene Personen, die einer
            Veröffentlichung widersprechen möchten, können sich über das Kontaktformular an uns
            wenden.
          </p>

          <h2>12. Ihre Rechte als betroffene Person</h2>
          <ul>
            <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung Ihrer bei uns gespeicherten Daten (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
          </ul>
          <p>Zur Ausübung dieser Rechte wenden Sie sich bitte an die oben genannten Kontaktdaten.</p>

          <h2>13. Beschwerderecht bei einer Aufsichtsbehörde</h2>
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für
            Baden-Württemberg zuständig:
          </p>
          <p>
            Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit
            Baden-Württemberg
            <br />
            Königstraße 10a, 70173 Stuttgart
          </p>

          <h2>14. SSL-/TLS-Verschlüsselung</h2>
          <p>
            Diese Seite nutzt aus Sicherheitsgründen eine SSL-/TLS-Verschlüsselung zum Schutz der
            Übertragung vertraulicher Inhalte, erkennbar an „https://&quot; und dem
            Schloss-Symbol Ihres Browsers.
          </p>

          <h2>15. Speicherdauer</h2>
          <p>
            Sofern innerhalb dieser Erklärung keine speziellere Speicherdauer genannt wurde,
            verbleiben personenbezogene Daten bei uns, bis der Verarbeitungszweck entfällt oder
            eine berechtigte Löschung angefordert wird.
          </p>

          <h2>16. Änderung dieser Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den
            aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen
            umzusetzen.
          </p>
        </div>
      </div>
    </section>
  );
}
