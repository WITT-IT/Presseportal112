import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum von Presseportal112.de.',
};

export default function ImpressumPage() {
  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[760px]">
        <h1 className="mb-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.01em]">
          Impressum
        </h1>
        <p className="mb-10 font-mono text-[11.5px] text-ink-3">
          Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)
        </p>

        <div className="prose-article text-[14.5px] text-ink">
          <h2>Diensteanbieter</h2>
          <p>
            Möller Photography
            <br />
            <em>Benedict Möller</em>
            <br />
            Leopoldstraße 7
            <br />
            88682 Salem
          </p>

          <h2>Kontakt</h2>
          <p>
            Telefon: +49 (0) 176 83055821
            <br />
            E-Mail: <em>kontakt@presseportal112.de</em>
          </p>

          

          <h2>Technischer Betrieb / Hosting</h2>
          <p>Der technische Betrieb erfolgt durch:</p>
          <p>
            Witt IT-Solutions
            <br />
            Alexander Witt
            <br />
            Emil-Higelin-Straße 9
            <br />
            88048 Friedrichshafen
          </p>
          <p>
            Die Server werden bei der 1&amp;1 IONOS SE, Elgendorfer Str. 57, 56410 Montabaur,
            betrieben.
          </p>

          <h2>Streitschlichtung</h2>
          <p>
            Die EU-Plattform zur Online-Streitbeilegung (OS-Plattform) wurde zum 20. Juli 2025
            von der Europäischen Kommission endgültig eingestellt.
          </p>
          <p>
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen
            Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir
            als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen. Eine Haftung ist erst ab Kenntnis einer konkreten
            Rechtsverletzung möglich; bei Bekanntwerden werden entsprechende Inhalte umgehend
            entfernt.
          </p>
          <p>
            Von angeschlossenen Organisationen hochgeladene Einsatzfotos und Begleittexte sind
            fremde Inhalte im Sinne dieser Regelung; die jeweils hochladende Organisation ist für
            die Rechtmäßigkeit dieser Inhalte selbst verantwortlich.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
            keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
            Anbieter verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir
            entsprechende Links umgehend entfernen.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte unterliegen dem deutschen
            Urheberrecht. Die veröffentlichten Einsatzfotos sind presserechtlich unter
            Quellenangabe „Foto: [Organisation] / presseportal112.de&quot; zur redaktionellen
            Berichterstattung freigegeben; die Bildrechte verbleiben bei der jeweils
            hochladenden Organisation. Eine darüberhinausgehende, insbesondere kommerzielle
            Nutzung ist ohne gesonderte Zustimmung nicht gestattet.
          </p>
        </div>
      </div>
    </section>
  );
}
