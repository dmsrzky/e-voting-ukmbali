"use client";

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

/** Perkecil foto KTM ke sisi terpanjang `max` px, JPEG. Foto HP 3 MB → ±200–350 KB. */
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal kompres"))), "image/jpeg", quality)
  );
}

/**
 * Perkecil foto paslon (maks. tinggi `maxH` px) dan JAGA transparansi.
 * PNG/WebP → WebP (tetap transparan, jauh lebih kecil); JPG → JPG.
 */
export async function resizePortrait(file: File, maxH = 1200): Promise<{ blob: Blob; ext: string; type: string }> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxH / img.naturalHeight, 1000 / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const alpha = file.type === "image/png" || file.type === "image/webp";
  if (!alpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const want = alpha ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto"))), want, 0.88)
  );
  // browser lama yang tidak bisa WebP akan mengembalikan PNG
  const type = blob.type || want;
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return { blob, ext, type };
}

/** Siapkan gambar untuk OCR: grayscale + kontras naik. */
export async function prepForOcr(blob: Blob): Promise<HTMLCanvasElement> {
  const img = await loadImage(blob);
  const target = 1800;
  const scale = target / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const c = Math.max(0, Math.min(255, (g - 128) * 1.4 + 128));
    d[i] = d[i + 1] = d[i + 2] = c;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
