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
