// Erzeugt zwei mit Organisations-Wasserzeichen versehene Varianten eines
// Bildes -- läuft komplett im Browser (Canvas-API), das Original wird nie
// verändert hochgeladen.
//
// Ein einzelner, großer, diagonaler Schriftzug statt eines Wiederholungs-
// musters -- bewusst auf Kundenwunsch reduziert. Schriftgröße wird
// automatisch nach unten angepasst, falls der Text (organisationsabhängig
// unterschiedlich lang) sonst über den Bildrand hinausragen würde.

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
  const angleDeg = -28;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';

  // Startgröße großzügig, dann bei Bedarf nach unten anpassen -- lange
  // Organisationsnamen dürfen nicht über den Bildrand hinausragen.
  let fontSize = Math.round(width * 0.07);
  const maxTextWidth = Math.hypot(width, height) * 0.82; // Bilddiagonale als Obergrenze
  ctx.font = `700 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(label).width;
  if (textWidth > maxTextWidth) {
    fontSize = Math.max(14, Math.floor(fontSize * (maxTextWidth / textWidth)));
    ctx.font = `700 ${fontSize}px sans-serif`;
  }
  ctx.lineWidth = Math.max(1.5, fontSize * 0.05);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();

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
