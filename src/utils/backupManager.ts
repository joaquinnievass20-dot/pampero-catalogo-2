import { Product } from '../types';
import { sanitizeCategory } from '../data/categories';

export const PAMPERO_PRODUCTS_KEY = 'pampero_catalog_products';
export const PAMPERO_BACKUP_KEY = 'pampero_products_backup';
export const PAMPERO_BACKUP_META_KEY = 'pampero_products_backup_meta';

/**
 * Guarda una copia de respaldo indestructible de todo el catálogo en localStorage.
 */
export function saveCatalogBackup(products: Product[]): void {
  if (!Array.isArray(products) || products.length === 0) return;

  try {
    const sanitized = products.map((p) => ({
      ...p,
      category: sanitizeCategory(p.category),
      section: p.section || 'Urbano',
      subCategory: p.subCategory || 'General',
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
        section: p.section || 'Urbano',
        subCategory: p.subCategory || 'General',
      }));
    }
  } catch (err) {
    console.warn('[PAMPERO BACKUP] Error leyendo respaldo local:', err);
  }
  return null;
}

/**
 * Comprueba si el backend devolvió un catálogo vacío, reseteado a la fábrica o con pérdida de productos.
 */
export function isServerCatalogReset(serverProducts: Product[] | undefined | null, localBackup: Product[] | null): boolean {
  if (!localBackup || localBackup.length === 0) return false;

  // Si el servidor devolvió un array vacío o nulo
  if (!serverProducts || !Array.isArray(serverProducts) || serverProducts.length === 0) {
    return true;
  }

  // Si el servidor tiene MENOS productos que la copia de respaldo local
  if (serverProducts.length < localBackup.length) {
    return true;
  }

  // Si el servidor carece de productos personalizados que sí están en el respaldo local
  const serverIds = new Set(
    serverProducts.map((p) => (p.id || '').trim().toLowerCase())
  );
  const serverCodes = new Set(
    serverProducts.map((p) => (p.code || '').trim().toLowerCase())
  );

  const missingProducts = localBackup.filter((lp) => {
    const id = (lp.id || '').trim().toLowerCase();
    const code = (lp.code || '').trim().toLowerCase();
    const hasId = id ? serverIds.has(id) : false;
    const hasCode = code ? serverCodes.has(code) : false;
    return !hasId && !hasCode;
  });

  return missingProducts.length > 0;
}

/**
 * Envía el catálogo restaurado de vuelta al servidor mediante POST para reconstruir el almacenamiento en disco.
 */
export async function syncBackupToServer(products: Product[]): Promise<boolean> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ products }),
    });

    if (res.ok) {
      console.log(`[PAMPERO PERSISTENCE] ¡Catálogo de respaldo restaurado exitosamente en el backend! (${products.length} productos)`);
      return true;
    } else {
      console.error('[PAMPERO PERSISTENCE] Falló la respuesta del servidor al restaurar productos.');
      return false;
    }
  } catch (err) {
    console.error('[PAMPERO PERSISTENCE] Error de red enviando catálogo de respaldo al servidor:', err);
    return false;
  }
}
