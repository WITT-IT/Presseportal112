// Zentrale Validierung für alles, was als ID in eine Directus-Filter-URL
// wandert.
//
// WARUM DAS ÜBERHAUPT NÖTIG IST:
// Directus-REST-Filter werden im ganzen Projekt per simpler Template-
// String-Verkettung gebaut, z.B.
//   `${DIRECTUS_URL}/items/media_library/${id}`
//   `${DIRECTUS_URL}/items/folders?filter[folder][_eq]=${folder}`
// "id" bzw. "folder" kommen dabei direkt aus der Anfrage (Body, Query-
// Parameter) -- ungeprüft, unkodiert. Directus-Primärschlüssel sind in
// diesem Projekt durchgängig UUIDs (randomUUID() beim Anlegen). Ein
// String, der KEIN UUID ist, hat in einer solchen URL nichts verloren --
// im besten Fall liefert Directus einen Fehler, im schlechtesten Fall
// lassen sich über Sonderzeichen wie "&" zusätzliche Filter-Parameter in
// die Query-String einschmuggeln (z.B. um die Organisationsgrenze zu
// umgehen).
//
// Die Lösung ist nicht, jede URL auf URLSearchParams umzustellen (großer,
// riskanter Umbau an vielen Stellen gleichzeitig), sondern JEDEN Wert, der
// in eine solche URL wandert, VORHER als echtes UUID zu verifizieren.
// Ein gültiges UUID kann per Definition keine Injection-Zeichen enthalten
// -- das macht die nachgelagerte String-Verkettung wieder sicher, ohne
// jede einzelne Stelle umbauen zu müssen.

// Bewusst NICHT auf UUID v4 (Versions-/Variantenbits) eingeschränkt --
// nur auf die generelle Form. Einzelne Directus-Systemfelder oder
// zukünftige Collections könnten andere UUID-Versionen verwenden; uns
// interessiert hier ausschließlich, dass die Zeichenkette der UUID-Form
// entspricht und damit injektionssicher ist, nicht ihre exakte Version.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Für Fälle, in denen ein Feld optional ist (z.B. "folder": null = Wurzel).
// null/undefined sind gültig, jeder andere Nicht-UUID-Wert nicht.
export function isUuidOrNull(value: unknown): value is string | null {
  return value === null || value === undefined || isUuid(value);
}

// Einheitliche Fehlerantwort, damit jede Route dieselbe Formulierung nutzt
// und nichts über den tatsächlichen Grund der Ablehnung verrät.
export function invalidIdResponse(label = 'ID') {
  return { error: `Ungültige ${label}.`, status: 400 as const };
}
