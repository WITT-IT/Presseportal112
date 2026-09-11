// Erkennung des echten Bildformats anhand der ersten Dateibytes
// ("Magic Bytes"), NICHT anhand der Dateiendung oder des vom Browser
// gemeldeten MIME-Typs.
//
// WARUM DAS NÖTIG IST -- zwei Gründe, ein Sicherheits- und ein
// Funktionsgrund:
//
// 1. FUNKTION: Der Browser meldet über File.type nicht immer einen
//    korrekten Wert. Bei Dateien aus Bildbearbeitungsprogrammen, von
//    Netzlaufwerken oder aus manchen Foto-Apps ist der Wert leer oder
//    falsch. Wurde dieser Wert bisher ungeprüft an Directus
//    durchgereicht, landete die Datei dort z.B. als
//    "application/octet-stream" -- Directus kann sie dann weder
//    verkleinern noch als Bild ausliefern, und im Portal erscheint nur
//    ein kaputtes Bild-Symbol.
//
// 2. SICHERHEIT: Ohne diese Prüfung findet serverseitig überhaupt keine
//    Inhaltsprüfung statt. Jede beliebige Datei ließe sich mit der
//    Endung .jpg hochladen und würde gespeichert -- auf einer Plattform,
//    die Dateien von Behörden annimmt und an Journalisten weiterreicht,
//    ist das kein theoretisches Risiko.

export type DetectedImage = { mime: string; ext: string; label: string };

// Formate, die Browser zuverlässig darstellen UND Directus/sharp
// verarbeiten kann. Nur was hier steht, wird angenommen.
const SUPPORTED: Record<string, DetectedImage> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG' },
  png: { mime: 'image/png', ext: 'png', label: 'PNG' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP' },
  gif: { mime: 'image/gif', ext: 'gif', label: 'GIF' },
  avif: { mime: 'image/avif', ext: 'avif', label: 'AVIF' },
};

// Formate, die zwar Bilder sind, aber im Web nicht funktionieren. Werden
// bewusst ERKANNT statt einfach ignoriert, damit die Fehlermeldung sagen
// kann, WAS das Problem ist -- "HEIC wird nicht unterstützt, bitte als
// JPEG exportieren" hilft weiter, "Upload fehlgeschlagen" nicht.
const UNSUPPORTED: Record<string, string> = {
  heic: 'HEIC/HEIF (iPhone-Format)',
  tiff: 'TIFF',
  bmp: 'BMP',
};

export type SniffResult =
  | { ok: true; image: DetectedImage }
  | { ok: false; reason: 'unsupported'; formatLabel: string }
  | { ok: false; reason: 'not-an-image' };

export function sniffImage(buffer: Buffer): SniffResult {
  if (buffer.length < 12) return { ok: false, reason: 'not-an-image' };

  const ascii = (start: number, end: number) => buffer.toString('ascii', start, end);

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ok: true, image: SUPPORTED.jpeg };
  }
  // PNG: 89 'PNG'
  if (buffer[0] === 0x89 && ascii(1, 4) === 'PNG') {
    return { ok: true, image: SUPPORTED.png };
  }
  // GIF: 'GIF87a' / 'GIF89a'
  if (ascii(0, 3) === 'GIF') {
    return { ok: true, image: SUPPORTED.gif };
  }
  // WebP: 'RIFF' .... 'WEBP'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { ok: true, image: SUPPORTED.webp };
  }
  // ISO-BMFF-Container: AVIF und HEIC teilen sich dieselbe Struktur und
  // unterscheiden sich nur über die "Brand" ab Byte 8.
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return { ok: true, image: SUPPORTED.avif };
    }
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) {
      return { ok: false, reason: 'unsupported', formatLabel: UNSUPPORTED.heic };
    }
  }
  // TIFF: 'II*\0' (little endian) oder 'MM\0*' (big endian)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return { ok: false, reason: 'unsupported', formatLabel: UNSUPPORTED.tiff };
  }
  // BMP: 'BM'
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { ok: false, reason: 'unsupported', formatLabel: UNSUPPORTED.bmp };
  }

  return { ok: false, reason: 'not-an-image' };
}

// Dateiendungen, die im Browser VOR dem Upload akzeptiert werden.
// Bewusst identisch zur Liste oben -- HEIC ist hier absichtlich NICHT
// enthalten: iPhone-Fotos sind standardmäßig HEIC, können aber von keinem
// Browser dargestellt werden. Früher wurden sie angenommen, hochgeladen,
// gespeichert -- und erschienen dann dauerhaft als kaputtes Bild. Eine
// sofortige, verständliche Ablehnung ist ehrlicher als ein Upload, der
// scheinbar klappt und dann nichts zeigt.
export const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

// Für das accept-Attribut von <input type="file">.
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');

// Obergrenze pro Einzeldatei. Kein technisches Muss, sondern eine
// bewusste Grenze: Alles darüber deutet auf ein unbearbeitetes RAW-Derivat
// oder eine versehentlich hochgeladene Riesendatei hin. Ohne Grenze
// scheitert so etwas später irgendwo unterwegs mit einer unverständlichen
// Meldung -- besser gleich hier, mit klarer Begründung.
export const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024;
