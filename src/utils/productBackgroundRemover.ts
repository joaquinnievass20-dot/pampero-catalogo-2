/**
 * Utilidad dedicada EXCLUSIVAMENTE a fotos de productos del catálogo.
 * Elimina el fondo de la foto (mediante IA en navegador @imgly/background-removal
 * con respaldo inteligente de recorte de estudio en Canvas) y coloca el producto
 * sobre un fondo blanco puro (#FFFFFF).
 */

export interface BgRemovalResult {
  whiteBgDataUrl: string;
  cutoutPngDataUrl: string;
  whiteBgFile: File;
  engineUsed: 'ai' | 'studio';
}

export interface WhiteBgOptions {
  /** Si true, recorta bordes vacíos y centra el producto con margen limpio */
  studioPadding?: boolean;
  /** Porcentaje de margen por lado cuando studioPadding está activo (0.06 = 6%) */
  paddingRatio?: number;
  /** Dimensión máxima de salida en px */
  maxDimension?: number;
  /** Nombre original del archivo para conservar códigos #color#género#posición */
  fileName?: string;
}

function loadImageFromSource(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    if (typeof source === 'string') {
      if (!source.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}

function dataUrlToFile(dataUrl: string, originalName: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  return new File([u8arr], `${baseName}.${ext}`, { type: mime });
}

/**
 * Compone una imagen/cutout con transparencia sobre fondo blanco puro (#FFFFFF).
 */
export async function compositeCutoutOnWhite(
  cutoutSource: Blob | string,
  options: WhiteBgOptions = {}
): Promise<{ whiteBgDataUrl: string; cutoutPngDataUrl: string; whiteBgFile: File }> {
  const {
    studioPadding = false,
    paddingRatio = 0.06,
    maxDimension = 1200,
    fileName = 'producto.jpg',
  } = options;

  const img = await loadImageFromSource(cutoutSource);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Dibujar en canvas temporal solo si necesitamos escanear bounding box para recorte opcional
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcW;
  tempCanvas.height = srcH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new Error('No se pudo inicializar el contexto de Canvas 2D.');
  }
  tempCtx.drawImage(img, 0, 0);

  const cutoutPngDataUrl =
    typeof cutoutSource === 'string' && cutoutSource.startsWith('data:image/png')
      ? cutoutSource
      : '';

  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (studioPadding) {
    const imgData = tempCtx.getImageData(0, 0, srcW, srcH).data;
    let minX = srcW;
    let minY = srcH;
    let maxX = 0;
    let maxY = 0;
    let foundOpaque = false;

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const alpha = imgData[(y * srcW + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundOpaque = true;
        }
      }
    }

    if (foundOpaque && maxX > minX && maxY > minY) {
      cropX = minX;
      cropY = minY;
      cropW = maxX - minX + 1;
      cropH = maxY - minY + 1;
    }
  }

  // Sin recorte (default): conserva exactamente el encuadre y dimensiones originales sobre fondo blanco puro #FFFFFF
  let outW: number;
  let outH: number;
  let drawX: number;
  let drawY: number;
  let drawW: number;
  let drawH: number;

  if (studioPadding) {
    const boxSize = Math.min(maxDimension, Math.max(cropW, cropH) / (1 - paddingRatio * 2));
    const finalSize = Math.max(600, Math.round(boxSize));
    outW = finalSize;
    outH = finalSize;
    const avail = finalSize * (1 - paddingRatio * 2);
    const scale = Math.min(avail / cropW, avail / cropH);
    drawW = Math.round(cropW * scale);
    drawH = Math.round(cropH * scale);
    drawX = Math.round((outW - drawW) / 2);
    drawY = Math.round((outH - drawH) / 2);
  } else {
    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
    outW = Math.round(srcW * scale);
    outH = Math.round(srcH * scale);
    cropX = 0;
    cropY = 0;
    cropW = srcW;
    cropH = srcH;
    drawX = 0;
    drawY = 0;
    drawW = outW;
    drawH = outH;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('No se pudo generar el lienzo final.');
  }

  // Fondo blanco puro #FFFFFF sin recortar la foto
  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);

  const whiteBgDataUrl = outCanvas.toDataURL('image/jpeg', 0.92);
  const whiteBgFile = dataUrlToFile(whiteBgDataUrl, fileName);

  return { whiteBgDataUrl, cutoutPngDataUrl: cutoutPngDataUrl || whiteBgDataUrl, whiteBgFile };
}

/**
 * Reduce imágenes grandes antes de enviarlas a IA (acelera el proceso 5x–10x manteniendo alta nitidez).
 */
async function preResizeFileForAI(file: File, maxSide = 880): Promise<Blob> {
  const img = await loadImageFromSource(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const maxDim = Math.max(srcW, srcH);
  if (maxDim <= maxSide) {
    return file;
  }
  const scale = maxSide / maxDim;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.92);
  });
}

/**
 * Detecta en ~10ms si los bordes superiores/laterales tienen color de fondo uniforme (estudio/liso).
 */
export async function hasUniformStudioBackground(file: File): Promise<boolean> {
  try {
    const img = await loadImageFromSource(file);
    const w = 120;
    const h = 120;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const pts = [
      [2, 2],
      [Math.floor(w * 0.25), 2],
      [Math.floor(w * 0.5), 2],
      [Math.floor(w * 0.75), 2],
      [w - 3, 2],
      [2, Math.floor(h * 0.25)],
      [w - 3, Math.floor(h * 0.25)],
      [2, Math.floor(h * 0.5)],
      [w - 3, Math.floor(h * 0.5)],
    ];

    const colors = pts.map(([x, y]) => {
      const idx = (y * w + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2]];
    });

    const ref = colors[0];
    let uniformCount = 0;
    for (const [r, g, b] of colors) {
      const dist = Math.sqrt((r - ref[0]) ** 2 * 0.3 + (g - ref[1]) ** 2 * 0.59 + (b - ref[2]) ** 2 * 0.11);
      if (dist <= 22) uniformCount++;
    }

    return uniformCount >= 7;
  } catch {
    return false;
  }
}

/**
 * Motor IA rápido en navegador usando @imgly/background-removal (modelo ligero quint8 + pre-escalado + Worker).
 */
export async function removeProductBackgroundWithAI(
  file: File,
  onProgress?: (percent: number, label: string) => void,
  options: WhiteBgOptions & { timeoutMs?: number } = {}
): Promise<BgRemovalResult> {
  const { timeoutMs = 25000, ...whiteOpts } = options;

  onProgress?.(10, 'Optimizando resolución para borrado rápido...');
  const preparedInput = await preResizeFileForAI(file, 880);

  onProgress?.(20, 'Cargando motor inteligente rápido...');
  const { removeBackground } = await import('@imgly/background-removal');

  const aiPromise = removeBackground(preparedInput, {
    model: 'isnet_quint8',
    proxyToWorker: true,
    output: {
      format: 'image/png',
      quality: 0.92,
    },
    progress: (key: string, current: number, total: number) => {
      if (total > 0) {
        const pct = Math.min(88, Math.max(22, Math.round((current / total) * 65) + 22));
        const label = key.includes('fetch')
          ? 'Descargando modelo rápido (1 sola vez)...'
          : 'Borrando fondo de la foto (sin recortar)...';
        onProgress?.(pct, label);
      }
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('El motor IA superó el tiempo máximo de espera.')), timeoutMs)
  );

  const blob = await Promise.race([aiPromise, timeoutPromise]);

  onProgress?.(94, 'Aplicando fondo blanco puro...');
  const composited = await compositeCutoutOnWhite(blob, {
    studioPadding: false,
    ...whiteOpts,
    fileName: whiteOpts.fileName || file.name,
  });

  onProgress?.(100, '¡Listo!');
  return {
    ...composited,
    engineUsed: 'ai',
  };
}

/**
 * Procesador automático inteligente:
 * - Si el fondo es liso/estudio -> borra al instante (< 0.2 seg) en Canvas sin recortar.
 * - Si el fondo es complejo -> usa motor rápido isnet_quint8 (< pocos segs) con fallback seguro.
 */
export async function removeProductBackgroundFast(
  file: File,
  onProgress?: (percent: number, label: string) => void,
  options: WhiteBgOptions = {}
): Promise<BgRemovalResult> {
  const safeOpts: WhiteBgOptions = {
    studioPadding: false,
    ...options,
    fileName: options.fileName || file.name,
  };

  onProgress?.(8, 'Analizando fondo de la imagen...');
  const isUniform = await hasUniformStudioBackground(file);

  if (isUniform) {
    onProgress?.(45, 'Fondo uniforme detectado · borrando al instante...');
    const studioRes = await removeStudioBackgroundCanvas(file, 32, 14, safeOpts);
    onProgress?.(100, '¡Listo al instante!');
    return studioRes;
  }

  return removeProductBackgroundWithAI(file, onProgress, { ...safeOpts, timeoutMs: 25000 });
}

/**
 * Motor instantáneo de Estudio (Flood-fill desde bordes + suavizado de bordes).
 */
export async function removeStudioBackgroundCanvas(
  fileOrUrl: File | string,
  tolerance: number = 34,
  feather: number = 14,
  options: WhiteBgOptions = {}
): Promise<BgRemovalResult> {
  const img = await loadImageFromSource(fileOrUrl);
  const maxProc = 1200;
  const scale = Math.min(1, maxProc / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible.');

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Muestrear color promedio de las 4 esquinas
  const sampleOffsets = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
  ];
  const samples = sampleOffsets.map(([sx, sy]) => {
    const cx = Math.max(0, Math.min(w - 1, sx));
    const cy = Math.max(0, Math.min(h - 1, sy));
    const idx = (cy * w + cx) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  });

  const colorDist = (r: number, g: number, b: number) => {
    let minD = 9999;
    for (const [sr, sg, sb] of samples) {
      const dr = r - sr;
      const dg = g - sg;
      const db = b - sb;
      const d = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
      if (d < minD) minD = d;
    }
    return minD;
  };

  // Flood-fill BFS desde todo el perímetro para no borrar partes internas del producto
  const totalPixels = w * h;
  const visited = new Uint8Array(totalPixels);
  const bgMask = new Uint8Array(totalPixels); // 1 = fondo
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const tryPush = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    const idx = p * 4;
    const dist = colorDist(data[idx], data[idx + 1], data[idx + 2]);
    if (dist <= tolerance + feather) {
      bgMask[p] = 1;
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

  // Aplicar transparencia suave según distancia al umbral
  for (let p = 0; p < totalPixels; p++) {
    if (bgMask[p]) {
      const idx = p * 4;
      const dist = colorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (dist <= tolerance) {
        data[idx + 3] = 0;
      } else {
        const ratio = (dist - tolerance) / Math.max(1, feather);
        data[idx + 3] = Math.round(Math.min(1, Math.max(0, ratio)) * 255);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const cutoutPngDataUrl = canvas.toDataURL('image/png');
  const fileName = options.fileName || (typeof fileOrUrl === 'string' ? 'producto.jpg' : fileOrUrl.name);
  const composited = await compositeCutoutOnWhite(cutoutPngDataUrl, {
    ...options,
    fileName,
  });

  return {
    ...composited,
    cutoutPngDataUrl,
    engineUsed: 'studio',
  };
}

/**
 * Descarga una foto de producto ya cargada (URL Firebase/HTTPS/local/dataURL)
 * y la convierte en un File listo para procesar en ProductImageBgModal.
 */
export async function fetchImageUrlAsFile(url: string, fallbackName = 'producto.jpg'): Promise<File> {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) {
    throw new Error('La URL de la foto está vacía.');
  }

  // Extraer nombre de archivo útil (conservando posibles códigos #C1#...)
  let derivedName = fallbackName;
  try {
    const withoutQuery = cleanUrl.split('?')[0];
    const lastSeg = decodeURIComponent(withoutQuery.split('/').pop() || '');
    if (lastSeg && !cleanUrl.startsWith('data:') && lastSeg.length < 120) {
      derivedName = lastSeg;
    }
  } catch {}
  if (!/\.(jpe?g|png|webp|gif)$/i.test(derivedName)) {
    derivedName = `${derivedName.replace(/\.[^/.]+$/, '')}.jpg`;
  }

  if (cleanUrl.startsWith('data:')) {
    return dataUrlToFile(cleanUrl, derivedName);
  }

  const tryFetchBlob = async (target: string, mode?: RequestMode): Promise<Blob> => {
    const resp = await fetch(target, mode ? { mode } : undefined);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Imagen vacía.');
    }
    return blob;
  };

  let blob: Blob | null = null;

  // 1. Intentar ruta relativa directa o fetch CORS
  if (cleanUrl.startsWith('/')) {
    blob = await tryFetchBlob(cleanUrl);
  } else {
    try {
      blob = await tryFetchBlob(cleanUrl, 'cors');
    } catch {
      // 2. Respaldo por proxy interno para evitar bloqueos CORS de Firebase Storage / dominios externos
      blob = await tryFetchBlob(`/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`);
    }
  }

  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], derivedName, { type: mime });
}
