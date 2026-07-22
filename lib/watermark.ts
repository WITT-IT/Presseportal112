// Erzeugt zwei mit Organisations-Wasserzeichen versehene Varianten eines
// Bildes -- läuft komplett im Browser (Canvas-API), das Original wird nie
// verändert hochgeladen. Entspricht dem Verhalten des alten Systems, nur
// ohne den externen Cloudflare Worker dazwischen.

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

  // Halbtransparenter Balken unten, Wasserzeichen-Text rechtsbündig darin.
  const barHeight = Math.max(28, Math.round(height * 0.045));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  const fontSize = Math.max(12, Math.round(barHeight * 0.5));
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(watermarkText, width - 14, height - barHeight / 2, width - 28);

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
