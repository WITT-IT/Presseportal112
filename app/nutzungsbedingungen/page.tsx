import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen für Bildmaterial',
  description:
    'Bedingungen für die Nutzung von Pressefotos, die über Presseportal112 bereitgestellt werden.',
};

export default function NutzungsbedingungenPage() {
  return (
    <section className="px-8 py-14">
      <div className="mx-auto max-w-[760px]">
        <h1 className="mb-2 font-display text-[32px] font-bold">
          Nutzungsbedingungen für Bildmaterial
        </h1>
        <p className="mb-10 text-[13.5px] text-ink-2">Stand: {new Date().getFullYear()}</p>

        <div className="flex flex-col gap-8 text-[14px] leading-[1.7] text-ink-2">
          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 1 Geltungsbereich
            </h2>
            <p>
              Diese Nutzungsbedingungen gelten für sämtliches Bildmaterial, das
              über presseportal112.de im öffentlichen Bereich oder über eine
              zeitlich begrenzte Medienfreigabe durch die beteiligten
              Blaulichtorganisationen (Feuerwehr, Polizei, DRK, THW)
              bereitgestellt wird. Mit dem Herunterladen oder der Verwendung
              eines Bildes werden diese Bedingungen anerkannt.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 2 Nutzungsrecht
            </h2>
            <p>
              Die bereitstellende Organisation räumt ein einfaches,
              nicht-exklusives Recht ein, das Bildmaterial im Rahmen der
              redaktionellen Presse- und Medienberichterstattung über das
              jeweils dargestellte Ereignis zu nutzen.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 3 Quellenangabe
            </h2>
            <p>
              Bei jeder Veröffentlichung ist die im Bild oder auf der
              Artikelseite angegebene Quelle (die jeweilige Organisation sowie
              „Presseportal112") in unmittelbarer Nähe zum Bild zu nennen.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 4 Ausgeschlossene Nutzung
            </h2>
            <p>
              Nicht gestattet sind insbesondere: Nutzung zu Werbezwecken oder
              in kommerziellem Kontext ohne gesonderte Zustimmung der
              betreffenden Organisation, Veränderungen, die den
              tatsächlichen Zusammenhang des dargestellten Ereignisses
              verfälschen, sowie jede Verwendung, die den Eindruck einer
              Empfehlung oder Unterstützung durch die abgebildete
              Organisation erweckt.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 5 Persönlichkeitsrechte
            </h2>
            <p>
              Das Bildmaterial zeigt dienstliche Einsatzsituationen. Sind
              einzelne Personen erkennbar, sind bei der Weiterverwendung die
              allgemeinen Persönlichkeitsrechte zu beachten — dies gilt in
              besonderem Maße für Minderjährige und für Betroffene von
              Notfällen.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 6 Haftung
            </h2>
            <p>
              Das Bildmaterial wird nach bestem Wissen der jeweiligen
              Organisation bereitgestellt. Eine Gewähr für Vollständigkeit
              oder Aktualität der begleitenden Angaben (Ort, Datum,
              Einsatzstichwort) wird nicht übernommen.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-display text-[16px] font-bold text-ink">
              § 7 Kontakt
            </h2>
            <p>
              Bei Fragen zu einzelnen Bildern oder diesen Nutzungsbedingungen
              wende dich bitte über das{' '}
              <a href="/kontakt" className="font-semibold text-ink underline">
                Kontaktformular
              </a>{' '}
              an die jeweilige Organisation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
