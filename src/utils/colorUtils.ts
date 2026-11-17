import { ColorCodeDef, Product } from '../types';

export const DEFAULT_COLOR_CODES: ColorCodeDef[] = [
  { code: 'C1', name: 'Arena / Beige', hex: '#D8C8B8', description: 'Tono arena pampeano clásico' },
  { code: 'C2', name: 'Verde Oliva', hex: '#4F5D38', description: 'Verde militar / rural' },
  { code: 'C3', name: 'Negro', hex: '#1C1917', description: 'Negro trabajo reforzado' },
  { code: 'C4', name: 'Azul Francia', hex: '#1D4ED8', description: 'Azul francia industrial Pampero' },
  { code: 'C5', name: 'Terracota / Ladrillo', hex: '#B9522F', description: 'Terracota distintivo Pampero' },
  { code: 'C6', name: 'Gris Piedra', hex: '#78716C', description: 'Gris neutro de trabajo' },
  { code: 'C7', name: 'Blanco', hex: '#F8FAFC', description: 'Blanco sanitario y gastronómico' },
  { code: 'C8', name: 'Azul Trabajo / Marino', hex: '#1E293B', description: 'Azul marino clásico gabardina' },
  { code: 'C9', name: 'Marrón Suela', hex: '#78350F', description: 'Marrón cuero vacuno / calzado' },
  { code: 'C10', name: 'Naranja / Amarillo Vial', hex: '#F59E0B', description: 'Alta visibilidad reglamentaria' },
  { code: 'C11', name: 'Rojo Trabajo', hex: '#DC2626', description: 'Rojo brigada / industrial' },
  { code: 'C12', name: 'Bordo / Vino', hex: '#881337', description: 'Bordo cuyano' },
];

export function getSavedColorCodes(): ColorCodeDef[] {
  if (typeof window === 'undefined') return DEFAULT_COLOR_CODES;
  try {
    const saved = localStorage.getItem('pampero_color_codes');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_COLOR_CODES;
}

export function saveColorCodes(codes: ColorCodeDef[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('pampero_color_codes', JSON.stringify(codes));
  } catch {}
}

export function getColorHex(colorNameOrCode: string): string {
  if (!colorNameOrCode) return '#78716C';
  const codes = getSavedColorCodes();
  const lower = colorNameOrCode.toLowerCase().trim();

  // Match by exact code (e.g. "C4")
  const byCode = codes.find((c) => c.code.toLowerCase() === lower);
  if (byCode) return byCode.hex;

  // Match by name
  const byName = codes.find((c) => 
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  if (byName) return byName.hex;

  // Common fallbacks
  if (lower.includes('azul')) return '#1D4ED8';
  if (lower.includes('negro')) return '#1C1917';
  if (lower.includes('verde')) return '#4F5D38';
  if (lower.includes('arena') || lower.includes('beige')) return '#D8C8B8';
  if (lower.includes('terra') || lower.includes('ladrillo')) return '#B9522F';
  if (lower.includes('gris')) return '#78716C';
  if (lower.includes('blanco')) return '#F8FAFC';
  if (lower.includes('marron') || lower.includes('suela')) return '#78350F';
  if (lower.includes('naranja') || lower.includes('amarillo')) return '#F59E0B';

  return '#94A3B8';
}

export function getColorCode(colorName: string): string {
  if (!colorName) return '';
  const codes = getSavedColorCodes();
  const lower = colorName.toLowerCase().trim();

  // If it's already a code like "C4"
  if (/^c\d+$/i.test(lower)) return lower.toUpperCase();

  const found = codes.find((c) => 
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  return found ? found.code : '';
}

export function normalizeColorToken(token: string): string {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  if (/^c0*(\d+)$/i.test(trimmed)) {
    const num = trimmed.replace(/^c0*/i, '');
    return `C${num}`.toUpperCase();
  }
  const codes = getSavedColorCodes();
  const exactCode = codes.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  if (exactCode) return exactCode.code;
  return trimmed;
}

export function resolveColorDef(codeOrName: string): { code: string; name: string; hex: string } {
  const codes = getSavedColorCodes();
  const clean = String(codeOrName || '').trim();
  const normalized = normalizeColorToken(clean);
  const match =
    codes.find((c) => c.code.toLowerCase() === normalized.toLowerCase()) ||
    codes.find((c) => c.name.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(c.name.toLowerCase()));

  if (match) {
    return { code: match.code, name: match.name, hex: match.hex };
  }
  return {
    code: /^c\d+$/i.test(normalized) ? normalized : '',
    name: clean,
    hex: getColorHex(clean),
  };
}

export function colorMatchesToken(colorA: string, colorB: string): boolean {
  const a = String(colorA || '').trim();
  const b = String(colorB || '').trim();
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;

  const normA = normalizeColorToken(a);
  const normB = normalizeColorToken(b);
  if (normA && normB && normA.toLowerCase() === normB.toLowerCase()) return true;

  const defA = resolveColorDef(a);
  const defB = resolveColorDef(b);
  if (defA.code && defB.code && defA.code.toLowerCase() === defB.code.toLowerCase()) return true;
  if (defA.name && defB.name && defA.name.toLowerCase() === defB.name.toLowerCase()) return true;

  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  return lowerA.includes(lowerB) || lowerB.includes(lowerA);
}

function urlContainsColorToken(url: string, targetColor: string): boolean {
  if (!url || !targetColor) return false;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {}
  const def = resolveColorDef(targetColor);
  const tokens = [def.code, targetColor.trim()].filter((t) => t && t.length >= 2);
  for (const tok of tokens) {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match #C1, _C1_, -C1., /C1# etc. (word-boundary or symbol-delimited)
    const regex = new RegExp(`(?:#|_|\\-|\\/|\\s|^)${escaped}(?=#|_|\\-|\\.|\\?|\\s|$)`, 'i');
    if (regex.test(decoded)) return true;
  }
  return false;
}

export function getAllImagesForColor(product: Product, colorNameOrCode?: string): string[] {
  if (!product || !colorNameOrCode) return [];
  const key = colorNameOrCode.trim();
  if (!key) return [];

  const matched: string[] = [];

  // 1. Buscar en imagesByColor con soporte completo de código <-> nombre y normalización (C1 / C01 / Arena)
  if (product.imagesByColor && typeof product.imagesByColor === 'object') {
    for (const [entryKey, url] of Object.entries(product.imagesByColor)) {
      if (url && typeof url === 'string' && colorMatchesToken(key, entryKey)) {
        if (!matched.includes(url)) matched.push(url);
      }
    }
  }

  // 2. Buscar en todas las galerías URLs que tengan el código del color en el nombre de archivo (#C1, #C4, etc.)
  const galleryCandidates: string[] = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.imagesMen) ? product.imagesMen : []),
    ...(Array.isArray(product.imagesWomen) ? product.imagesWomen : []),
    ...(product.image ? [product.image] : []),
  ].filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim()));

  for (const url of galleryCandidates) {
    if (urlContainsColorToken(url, key) && !matched.includes(url)) {
      matched.push(url);
    }
  }

  return matched;
}

export function getProductImageForColor(product: Product, colorNameOrCode?: string): string {
  if (!product) return '';
  if (!colorNameOrCode) return product.image || product.images?.[0] || '';

  const matched = getAllImagesForColor(product, colorNameOrCode);
  if (matched.length > 0) {
    return matched[0];
  }

  return product.image || product.images?.[0] || '';
}

export function getEffectiveColors(product: Product): string[] {
  if (!product) return [];
  if (product.availableColors && product.availableColors.length > 0) {
    return product.availableColors;
  }
  if (product.imagesByColor && Object.keys(product.imagesByColor).length > 0) {
    return Object.keys(product.imagesByColor);
  }
  return ['Estándar'];
}

export function recordProductInteraction(product: Product, type: 'click' | 'search', userEmail?: string): void {
  if (typeof window === 'undefined' || !product) return;
  try {
    const key = 'pampero_product_metrics';
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    const id = product.id;
    if (!current[id]) {
      current[id] = {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        category: product.category,
        clickCount: 0,
        searchCount: 0,
        lastInteracted: new Date().toISOString(),
      };
    }
    if (type === 'click') {
      current[id].clickCount = (current[id].clickCount || 0) + 1;
    } else {
      current[id].searchCount = (current[id].searchCount || 0) + 1;
    }
    current[id].lastInteracted = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(current));

    // Store viewed products isolated per user account
    const userKey = userEmail ? userEmail.toLowerCase().trim() : 'guest';
    const viewedKey = `pampero_viewed_products_${userKey}`;
    const viewedRaw = localStorage.getItem(viewedKey) || '[]';
    const viewed: Product[] = JSON.parse(viewedRaw);
    const filtered = [product, ...viewed.filter((p) => p.id !== product.id)].slice(0, 8);
    localStorage.setItem(viewedKey, JSON.stringify(filtered));
  } catch {}
}
