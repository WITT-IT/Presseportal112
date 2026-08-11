// Erzeugt zwei mit Organisations-Wasserzeichen versehene Varianten eines
// Bildes -- läuft komplett im Browser (Canvas-API), das Original wird nie
// verändert hochgeladen.
//
// Fußzeilen-Wasserzeichen statt diagonalem Schriftzug: ein dunkler
// Verlaufsbalken am unteren Bildrand, weißer Text darüber. Der Verlauf
// normalisiert den Untergrund -- die Lesbarkeit hängt dadurch nicht mehr
// davon ab, ob darunter ein helles oder dunkles Motiv liegt, wie es bei
// reinem Text-auf-Bild (auch mit Kontur) immer ein Stück weit der Fall ist.

export type WatermarkResult = {
  preview: Blob;
  download: Blob;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    img.src = URL.createObjectURL(file);
  });
}

function drawWatermarked(
  img: HTMLImageElement,
  maxWidth: number,
  watermarkText: string
): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Dein Browser unterstützt die Bildbearbeitung nicht.');

  ctx.drawImage(img, 0, 0, width, height);

  const label = `© ${watermarkText} · Presseportal112.de`;

  // Fußzeilen-Höhe proportional zur Bildhöhe, mit sinnvollen Grenzen nach
  // oben und unten -- bei sehr kleinen Vorschaubildern bleibt sie noch
  // lesbar, bei sehr großen Downloads wird sie nicht unnötig dominant.
  const footerHeight = Math.round(Math.min(Math.max(height * 0.07, 34), 96));
  const padding = Math.round(footerHeight * 0.32);

  // Dunkler Verlauf von transparent nach halbtransparent-schwarz -- läuft
  // über die doppelte Fußzeilenhöhe nach oben aus, damit der Übergang zum
  // Bild weich ist statt einer harten Kante.
  const gradient = ctx.createLinearGradient(0, height - footerHeight * 2, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - footerHeight * 2, width, footerHeight * 2);

  // Text mittig in der Fußzeile, linksbündig mit Innenabstand. Schriftgröße
  // an die Fußzeilenhöhe gekoppelt, dann bei Bedarf so weit verkleinert,
  // dass auch ein langer Organisationsname nicht über den Bildrand oder in
  // den rechten Rand hineinragt.
  let fontSize = Math.round(footerHeight * 0.36);
  const maxTextWidth = width - padding * 2;
  ctx.font = `700 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(label).width;
  if (textWidth > maxTextWidth) {
    fontSize = Math.max(11, Math.floor(fontSize * (maxTextWidth / textWidth)));
    ctx.font = `700 ${fontSize}px sans-serif`;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textY = height - footerHeight / 2;

  // Zusätzlich zum Verlauf noch ein dezenter dunkler Schatten hinter dem
  // Text -- kostet auf einem Bild mit ohnehin dunklem Verlauf fast nichts,
  // schützt aber zuverlässig die letzten paar Pixel bei sehr hellen,
  // überstrahlten Fotomotiven (z. B. Blaulicht-Reflexionen).
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(label, padding + 1, textY + 1);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, padding, textY);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      'image/jpeg',
      quality
    );
  });
}

export async function createWatermarkedVariants(
  file: File,
  watermarkText: string
): Promise<WatermarkResult> {
  const img = await loadImage(file);
  try {
    const previewCanvas = drawWatermarked(img, 1600, watermarkText);
    const downloadCanvas = drawWatermarked(img, 2400, watermarkText);
    const [preview, download] = await Promise.all([
      canvasToBlob(previewCanvas, 0.86),
      canvasToBlob(downloadCanvas, 0.92),
    ]);
    return { preview, download };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
