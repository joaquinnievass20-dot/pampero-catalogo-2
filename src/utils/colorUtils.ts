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

export function getProductImageForColor(product: Product, colorNameOrCode?: string): string {
  if (!product) return '';
  if (!colorNameOrCode || !product.imagesByColor) return product.image;

  const key = colorNameOrCode.trim();

  // 1. Direct match
  if (product.imagesByColor[key]) {
    return product.imagesByColor[key];
  }

  // 2. Case insensitive
  const lower = key.toLowerCase();
  for (const [k, url] of Object.entries(product.imagesByColor)) {
    if (k.toLowerCase() === lower && url) return url;
  }

  // 3. By code
  const code = getColorCode(key);
  if (code && product.imagesByColor[code]) {
    return product.imagesByColor[code];
  }

  // 4. Fuzzy match
  for (const [k, url] of Object.entries(product.imagesByColor)) {
    if ((k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) && url) {
      return url;
    }
  }

  return product.image;
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
