import { Product } from '../types';
import { sanitizeCategory } from '../data/categories';
import { saveFirestoreProducts } from '../services/firebase';

export const PAMPERO_PRODUCTS_KEY = 'pampero_catalog_products';
export const PAMPERO_BACKUP_KEY = 'pampero_products_backup';
export const PAMPERO_BACKUP_META_KEY = 'pampero_products_backup_meta';

/**
 * Guarda una copia de respaldo indestructible de todo el catálogo en localStorage.
 */
export function saveCatalogBackup(products: Product[]): void {
  if (!Array.isArray(products)) return;

  try {
    const sanitized = products.map((p) => ({
      ...p,
      category: sanitizeCategory(p.category),
      section: p.section || '',
      subCategory: p.subCategory || '',
    }));

    const serialized = JSON.stringify(sanitized);
    localStorage.setItem(PAMPERO_PRODUCTS_KEY, serialized);
    localStorage.setItem(PAMPERO_BACKUP_KEY, serialized);
    localStorage.setItem(
      PAMPERO_BACKUP_META_KEY,
      JSON.stringify({
        count: sanitized.length,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('[PAMPERO BACKUP] Error guardando respaldo en localStorage:', err);
  }
}

/**
 * Recupera el catálogo de respaldo desde localStorage.
 */
export function loadCatalogBackup(): Product[] | null {
  try {
    const backupRaw = localStorage.getItem(PAMPERO_BACKUP_KEY) || localStorage.getItem(PAMPERO_PRODUCTS_KEY);
    if (!backupRaw) return null;

    const parsed: Product[] = JSON.parse(backupRaw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p) => ({
        ...p,
        category: sanitizeCategory(p.category),
        section: p.section || '',
        subCategory: p.subCategory || '',
      }));
    }
  } catch (err) {
    console.warn('[PAMPERO BACKUP] Error leyendo respaldo local:', err);
  }
  return null;
}

/**
 * Comprueba si el backend devolvió un catálogo vacío o reseteado.
 * No resucita productos eliminados intencionalmente por el usuario.
 */
export function isServerCatalogReset(serverProducts: Product[] | undefined | null, localBackup: Product[] | null): boolean {
  if (!localBackup || localBackup.length === 0) return false;

  // Solo si el servidor devolvió un array completamente vacío o nulo
  if (!serverProducts || !Array.isArray(serverProducts) || serverProducts.length === 0) {
    return true;
  }

  return false;
}

/**
 * Envía el catálogo restaurado mediante el SDK oficial de Firebase en lugar de fetch antiguo.
 */
export async function syncBackupToServer(products: Product[]): Promise<boolean> {
  try {
    await saveFirestoreProducts(products);
    console.log(`[PAMPERO PERSISTENCE] ¡Catálogo sincronizado exitosamente en Cloud Firestore! (${products.length} productos)`);
    return true;
  } catch (err) {
    console.warn('[PAMPERO PERSISTENCE] Error sincronizando catálogo con Firestore:', err);
    return false;
  }
}
