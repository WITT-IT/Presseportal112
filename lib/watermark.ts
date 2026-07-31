// Erzeugt zwei mit Organisations-Wasserzeichen versehene Varianten eines
// Bildes -- läuft komplett im Browser (Canvas-API), das Original wird nie
// verändert hochgeladen.
//
// Das Wasserzeichen ist bewusst ein WIEDERHOLENDES, diagonales Muster über
// die gesamte Bildfläche, kein einzelner Balken in einer Ecke -- ein
// einzelner Balken lässt sich durch simples Zuschneiden entfernen, ein
// flächendeckendes Muster nicht, ohne das Bild selbst unbrauchbar zu machen.

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
  const fontSize = Math.max(15, Math.round(width * 0.022));
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Halbtransparente Füllung plus dünner dunkler Rand -- so bleibt der
  // Text sowohl auf hellen als auch auf dunklen Bildbereichen lesbar,
  // ohne das Foto selbst zu sehr zu verdecken.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = Math.max(1, fontSize * 0.045);

  const textWidth = ctx.measureText(label).width;
  const stepX = textWidth + fontSize * 3.2;
  const stepY = fontSize * 5.2;
  const angleDeg = -28;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  // Großzügig über die (durch die Drehung vergrößerte) sichtbare Fläche
  // hinaus kacheln, damit auch die Ecken nach dem Rotieren lückenlos
  // abgedeckt sind.
  const overshoot = Math.hypot(width, height);
  for (let y = -overshoot; y < height + overshoot; y += stepY) {
    for (let x = -overshoot; x < width + overshoot; x += stepX) {
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    }
  }
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
