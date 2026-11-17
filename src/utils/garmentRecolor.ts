/**
 * Motor Canvas para teñido realista EXCLUSIVO de la prenda en el Armador de Uniformes
 * y limpieza de fondo blanco en logos corporativos.
 *
 * Protege el fondo del estudio (flood-fill desde bordes) y tonos de piel humana (YCbCr),
 * aplicando el color elegido únicamente sobre la tela preservando sombras, pliegues y costuras.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (isNaN(num)) return [28, 28, 28];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function loadCorsImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function isSkinTone(r: number, g: number, b: number): boolean {
  // Conversión YCbCr clásica para detectar rostro/manos de modelos y evitar teñir piel
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y > 60 && cb >= 77 && cb <= 127 && cr >= 134 && cr <= 173 && r > g && r > b;
}

/**
 * Recolorea únicamente la prenda de una imagen manteniendo intactos fondo y piel,
 * y preservando luces, sombras y textura textil.
 * Retorna dataUrl o null si el origen bloquea lectura CORS.
 */
export async function recolorGarmentOnly(
  imageUrl: string,
  targetHex: string,
  options: { preserveSkin?: boolean; bgTolerance?: number } = {}
): Promise<string | null> {
  if (!imageUrl || !targetHex) return null;
  const { preserveSkin = true, bgTolerance = 30 } = options;

  try {
    const img = await loadCorsImage(imageUrl);
    const maxDim = 900;
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return null;

    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);

    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch {
      // Canvas tainted por CORS externo sin headers Access-Control-Allow-Origin
      return null;
    }

    const data = imgData.data;
    const total = w * h;

    // 1. Muestrear esquinas/bordes para identificar el fondo del estudio
    const sampleCoords = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
      [Math.floor(w / 2), 2],
    ];
    const bgSamples = sampleCoords.map(([sx, sy]) => {
      const cx = Math.max(0, Math.min(w - 1, sx));
      const cy = Math.max(0, Math.min(h - 1, sy));
      const idx = (cy * w + cx) * 4;
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    });

    const isBackgroundLike = (r: number, g: number, b: number, a: number) => {
      if (a < 30) return true;
      for (const [sr, sg, sb, sa] of bgSamples) {
        if (sa < 30) continue;
        const dr = r - sr;
        const dg = g - sg;
        const db = b - sb;
        const dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
        if (dist <= bgTolerance) return true;
      }
      return false;
    };

    // Flood-fill BFS desde bordes para marcar fondo conectado (no toca partes blancas internas de la prenda)
    const visited = new Uint8Array(total);
    const isBg = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const pushIfBg = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      visited[p] = 1;
      const idx = p * 4;
      if (isBackgroundLike(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        isBg[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      pushIfBg(x, 0);
      pushIfBg(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
      pushIfBg(0, y);
      pushIfBg(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) pushIfBg(x - 1, y);
      if (x < w - 1) pushIfBg(x + 1, y);
      if (y > 0) pushIfBg(x, y - 1);
      if (y < h - 1) pushIfBg(x, y + 1);
    }

    // 2. Calcular luminancia promedio de la prenda para normalizar relieve y pliegues
    let lumSum = 0;
    let garmentCount = 0;
    for (let p = 0; p < total; p++) {
      if (isBg[p]) continue;
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (preserveSkin && isSkinTone(r, g, b)) continue;
      lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
      garmentCount++;
    }

    if (garmentCount === 0) return null;
    const avgLum = Math.max(45, lumSum / garmentCount);

    const [tR, tG, tB] = hexToRgb(targetHex);
    const targetLum = 0.299 * tR + 0.587 * tG + 0.114 * tB;
    const isTargetVeryLight = targetLum > 225;
    const isTargetVeryDark = targetLum < 45;

    // 3. Aplicar teñido textil preservando sombras, costuras y textura
    for (let p = 0; p < total; p++) {
      if (isBg[p]) continue;
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (preserveSkin && isSkinTone(r, g, b)) continue;

      const origLum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Factor relativo de pliegues/iluminación alrededor de 1.0
      const shadeFactor = Math.min(1.65, Math.max(0.28, origLum / avgLum));

      let outR: number;
      let outG: number;
      let outB: number;

      if (isTargetVeryLight) {
        // Blanco / tonos muy claros: desaturar prenda y mapear a luces altas conservando costuras
        const mapped = Math.min(252, Math.max(150, 210 * Math.pow(shadeFactor, 0.45)));
        outR = (mapped * tR) / 255;
        outG = (mapped * tG) / 255;
        outB = (mapped * tB) / 255;
      } else if (isTargetVeryDark) {
        // Negro / azul noche muy oscuro: comprimir rango sin empastar totalmente las costuras
        const boost = 0.72 + shadeFactor * 0.55;
        outR = Math.min(255, tR * boost + origLum * 0.08);
        outG = Math.min(255, tG * boost + origLum * 0.08);
        outB = Math.min(255, tB * boost + origLum * 0.08);
      } else {
        // Colores medios / intensos: multiplicar por el factor de sombreado real de la tela
        const effectiveShade = Math.pow(shadeFactor, 0.85);
        outR = Math.min(255, tR * effectiveShade);
        outG = Math.min(255, tG * effectiveShade);
        outB = Math.min(255, tB * effectiveShade);
      }

      // Mezcla sutil con micro-textura original (12%) para mayor realismo textil
      data[idx] = Math.round(outR * 0.9 + (origLum * 0.1));
      data[idx + 1] = Math.round(outG * 0.9 + (origLum * 0.1));
      data[idx + 2] = Math.round(outB * 0.9 + (origLum * 0.1));
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[GARMENT RECOLOR] Fallback a foto original:', err);
    return null;
  }
}

/**
 * Elimina el fondo blanco/claro rectangular de un logo JPG/PNG para que se integre
 * naturalmente sobre la tela de la prenda en vez de verse como un parche cuadrado.
 */
export async function stripLogoWhiteBackground(logoUrl: string): Promise<{
  cleanDataUrl: string;
  aspectRatio: number;
} | null> {
  if (!logoUrl) return null;
  try {
    const img = await loadCorsImage(logoUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { cleanDataUrl: logoUrl, aspectRatio: w / h };

    ctx.drawImage(img, 0, 0);
    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch {
      return { cleanDataUrl: logoUrl, aspectRatio: w / h };
    }

    const data = imgData.data;
    const total = w * h;

    // Verificar si ya tiene canal alfa real en las esquinas
    const cornerAlpha = [
      data[3],
      data[(w - 1) * 4 + 3],
      data[((h - 1) * w) * 4 + 3],
      data[(total - 1) * 4 + 3],
    ];
    const hasAlpha = cornerAlpha.some((a) => a < 200);
    if (hasAlpha) {
      return { cleanDataUrl: logoUrl, aspectRatio: w / h };
    }

    // Verificar si las esquinas son blancas o casi blancas (e.g. R,G,B > 235)
    const isWhiteLike = (r: number, g: number, b: number) =>
      r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 22;

    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const tryPush = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      visited[p] = 1;
      const idx = p * 4;
      if (isWhiteLike(data[idx], data[idx + 1], data[idx + 2])) {
        data[idx + 3] = 0;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      tryPush(x, 0);
      tryPush(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
      tryPush(0, y);
      tryPush(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) tryPush(x - 1, y);
      if (x < w - 1) tryPush(x + 1, y);
      if (y > 0) tryPush(x, y - 1);
      if (y < h - 1) tryPush(x, y + 1);
    }

    // Recortar al bounding box del logo limpio
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    if (found && maxX > minX && maxY > minY) {
      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      const trimCanvas = document.createElement('canvas');
      trimCanvas.width = cw;
      trimCanvas.height = ch;
      const trimCtx = trimCanvas.getContext('2d');
      if (trimCtx) {
        trimCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        return {
          cleanDataUrl: trimCanvas.toDataURL('image/png'),
          aspectRatio: cw / ch,
        };
      }
    }

    return {
      cleanDataUrl: canvas.toDataURL('image/png'),
      aspectRatio: w / h,
    };
  } catch {
    return null;
  }
}
