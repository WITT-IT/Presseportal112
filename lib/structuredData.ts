// JSON.stringify entkommt zwar Anführungszeichen korrekt, aber NICHT den
// literalen Text "</script>" -- käme der in einem nutzergenerierten Titel
// vor, würde er unser eigenes <script>-Tag vorzeitig beenden und den Rest
// als HTML interpretieren lassen. Deshalb "<" grundsätzlich escapen, bevor
// der JSON-LD-Block per dangerouslySetInnerHTML eingebettet wird.
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
