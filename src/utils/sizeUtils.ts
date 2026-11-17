import { Product, SpecialSizeRange } from '../types';

export interface DynamicSizeCatalog {
  letters: string[];
  pants: string[];
  shoes: string[];
  unique: string[];
}

// Localized Spanish scale used by Pampero (CH, M, G, MG, XG, etc.)
export const DEFAULT_SIZES: DynamicSizeCatalog = {
  letters: ['XCH', 'CH', 'M', 'G', 'MG', 'XG', 'XXG', '3XG', 'Especial'],
  pants: ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'],
  shoes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
  unique: ['Talle Único', 'Ajustable', '35 Litros', 'Único'],
};

const STORAGE_KEY = 'pampero_custom_sizes_v2';

export function getStoredSizes(): DynamicSizeCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SIZES;
    const parsed = JSON.parse(raw);
    return {
      letters: Array.isArray(parsed.letters) && parsed.letters.length > 0 ? parsed.letters : DEFAULT_SIZES.letters,
      pants: Array.isArray(parsed.pants) && parsed.pants.length > 0 ? parsed.pants : DEFAULT_SIZES.pants,
      shoes: Array.isArray(parsed.shoes) && parsed.shoes.length > 0 ? parsed.shoes : DEFAULT_SIZES.shoes,
      unique: Array.isArray(parsed.unique) && parsed.unique.length > 0 ? parsed.unique : DEFAULT_SIZES.unique,
    };
  } catch {
    return DEFAULT_SIZES;
  }
}

export function saveStoredSizes(config: DynamicSizeCatalog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving custom sizes config:', e);
  }
}

export function resetToDefaultSizes(): DynamicSizeCatalog {
  saveStoredSizes(DEFAULT_SIZES);
  return DEFAULT_SIZES;
}

export function addSizeToCatalog(group: keyof DynamicSizeCatalog, size: string): DynamicSizeCatalog {
  const current = getStoredSizes();
  const trimmed = size.trim().toUpperCase();
  if (!trimmed || current[group].includes(trimmed)) return current;
  const updated = {
    ...current,
    [group]: [...current[group], trimmed],
  };
  saveStoredSizes(updated);
  return updated;
}

export function removeSizeFromCatalog(group: keyof DynamicSizeCatalog, size: string): DynamicSizeCatalog {
  const current = getStoredSizes();
  const updated = {
    ...current,
    [group]: current[group].filter((s) => s !== size),
  };
  saveStoredSizes(updated);
  return updated;
}

export function updateSizeInCatalog(group: keyof DynamicSizeCatalog, oldSize: string, newSize: string): DynamicSizeCatalog {
  const current = getStoredSizes();
  const trimmed = newSize.trim().toUpperCase();
  if (!trimmed) return current;
  const updated = {
    ...current,
    [group]: current[group].map((s) => (s === oldSize ? trimmed : s)),
  };
  saveStoredSizes(updated);
  return updated;
}

/** Normaliza sufijos de talles especiales ("1", "_1", "-1" -> "-1") */
export function normalizeSpecialSuffix(suffix?: string): string {
  const raw = String(suffix || '').trim();
  if (!raw) return '-1';
  const digits = raw.replace(/^[-_]+/, '');
  return `-${digits}`;
}

/** Expande un texto de talles o rango ("50, 52, 54", "50 al 58", "50-58", "XXL, 3XL") */
export function parseSpecialSizesString(input: string): string[] {
  const clean = String(input || '').trim();
  if (!clean) return [];

  // 1. Detectar rango numérico explícito tipo "50 al 58", "50 a 58", "50-58"
  const rangeMatch = clean.match(/(\d{2})\s*(?:al|a|-|–|hasta)\s*(\d{2})/i);
  if (rangeMatch && !clean.includes(',')) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start && end - start <= 30) {
      const step = end - start >= 2 && start % 2 === 0 && end % 2 === 0 ? 2 : 1;
      const out: string[] = [];
      for (let s = start; s <= end; s += step) {
        out.push(String(s));
      }
      return out;
    }
  }

  // 2. Lista separada por comas, punto y coma o barras
  if (/[,;/]/.test(clean)) {
    return clean
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 3. Separada por espacios si no tiene palabras descriptivas
  const tokens = clean
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((t) => t && !/^(talles?|al|a|del|hasta|especiales?)$/i.test(t));
  return tokens.length > 0 ? tokens : [clean];
}

/** Devuelve los valores por defecto según el sufijo (-1, -2, -3) */
export function inferDefaultRangeForSuffix(suffix: string): {
  suffix: string;
  rangeLabel: string;
  fromSize: string;
  toSize: string;
  sizes: string[];
} {
  const norm = normalizeSpecialSuffix(suffix);
  if (norm === '-1') {
    return {
      suffix: '-1',
      rangeLabel: 'Talles Especiales 50 al 58',
      fromSize: '50',
      toSize: '58',
      sizes: ['50', '52', '54', '56', '58'],
    };
  }
  if (norm === '-2') {
    return {
      suffix: '-2',
      rangeLabel: 'Talles Especiales 60 al 66',
      fromSize: '60',
      toSize: '66',
      sizes: ['60', '62', '64', '66'],
    };
  }
  if (norm === '-3') {
    return {
      suffix: '-3',
      rangeLabel: 'Talles Especiales 68 al 72',
      fromSize: '68',
      toSize: '72',
      sizes: ['68', '70', '72'],
    };
  }
  return {
    suffix: norm,
    rangeLabel: `Talles Especiales (${norm})`,
    fromSize: '',
    toSize: '',
    sizes: [],
  };
}

/** Resuelve la lista efectiva de talles de un rango especial (incluso para productos viejos guardados con sizes: []) */
export function resolveSpecialRangeSizes(range: SpecialSizeRange): string[] {
  if (!range) return [];
  if (Array.isArray(range.sizes) && range.sizes.length > 0) {
    return range.sizes.map((s) => String(s).trim()).filter(Boolean);
  }
  const from = range.fromSize || range.minSize || '';
  const to = range.toSize || range.maxSize || '';
  if (from && to) {
    const parsed = parseSpecialSizesString(`${from} al ${to}`);
    if (parsed.length > 0) return parsed;
  }
  const labelText = range.rangeLabel || range.sizeRangeLabel || range.label || '';
  if (labelText) {
    const parsed = parseSpecialSizesString(labelText);
    if (parsed.length > 0 && !(parsed.length === 1 && parsed[0] === labelText)) {
      return parsed;
    }
  }
  if (range.suffix) {
    return inferDefaultRangeForSuffix(range.suffix).sizes;
  }
  return [];
}

/** Busca el rango de talle especial al que pertenece un talle seleccionado */
export function findSpecialRangeForSize(product: Product, size?: string): SpecialSizeRange | null {
  if (!product || !size || !Array.isArray(product.specialSizeRanges) || product.specialSizeRanges.length === 0) {
    return null;
  }
  const target = String(size).trim().toUpperCase();
  if (!target) return null;

  for (const range of product.specialSizeRanges) {
    const resolved = resolveSpecialRangeSizes(range);
    if (resolved.some((s) => String(s).trim().toUpperCase() === target)) {
      return {
        ...range,
        sizes: resolved,
        rangeLabel: range.rangeLabel || range.sizeRangeLabel || range.label || `Talles Especiales ${range.suffix || '-1'}`,
        suffix: normalizeSpecialSuffix(range.suffix),
      };
    }
  }
  return null;
}

