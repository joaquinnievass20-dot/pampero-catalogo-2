import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  runTransaction,
  setLogLevel,
  Firestore,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';
import {
  Product,
  Promotion,
  ThemeConfig,
  BranchLocation,
  DiscountCoupon,
  VolumeDiscountRule,
  CategoryHierarchyItem,
  LookbookItem,
  RegisteredUser,
  EmployeeAccount,
  CRMExpense,
  CostCategoryConfig,
} from '../types';

/**
 * Firebase Client Configuration
 * Priority order:
 * 1. Environment variables defined in Vercel (VITE_FIREBASE_*)
 * 2. Pre-configured production credentials for pampero-catalogo
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBdm1e7vvz4Y2zY76ma2sLiWpYNTtkTQd4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pampero-catalogo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pampero-catalogo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pampero-catalogo.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "477433504739",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:477433504739:web:51344feaa4ffac8a7f36d6",
};

export let db: Firestore | null = null;
export let storage: FirebaseStorage | null = null;
let isInitialized = false;

function createFirestoreInstance(): Firestore | null {
  try {
    try {
      setLogLevel('error');
    } catch {}
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    try {
      // Force long polling to prevent WebSocket / WebChannel streaming 10s timeouts
      // in browser iframes, strict proxies, or offline fallback scenarios.
      return initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch {
      return getFirestore(app);
    }
  } catch (error) {
    console.warn('[FIREBASE] Initialization warning (offline/fallback mode):', error);
    return null;
  }
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (storage) return storage;
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const rawBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '').trim();
    const cleanBucket = rawBucket.replace(/^gs:\/\//, '');

    // Conexión Directa: inicializa Firebase Storage consumiendo VITE_FIREBASE_STORAGE_BUCKET
    storage = cleanBucket ? getStorage(app, `gs://${cleanBucket}`) : getStorage(app);

    // Evitar que el SDK de Firebase Storage se cuelgue en reintentos infinitos
    storage.maxUploadRetryTime = 10000;
    storage.maxOperationRetryTime = 10000;
    return storage;
  } catch (err) {
    console.error('[FIREBASE STORAGE] Error al inicializar Storage con VITE_FIREBASE_STORAGE_BUCKET:', err);
    return null;
  }
}

try {
  db = createFirestoreInstance();
  storage = getFirebaseStorage();
  isInitialized = db !== null;
  if (db) {
    console.log('[FIREBASE] Cloud Firestore connected to project:', firebaseConfig.projectId);
  }
} catch (error) {
  console.warn('[FIREBASE] Initialization warning (offline/fallback mode):', error);
  db = null;
  storage = null;
  isInitialized = false;
}

export function getFirebaseDb(): Firestore | null {
  if (db) return db;
  db = createFirestoreInstance();
  isInitialized = db !== null;
  return db;
}

export function isFirebaseReady(): boolean {
  return (isInitialized && db !== null) || getFirebaseDb() !== null;
}

/**
 * Conexión Directa: Sube archivos directo a Firebase Storage utilizando uploadBytes y getDownloadURL.
 * Inicializado correctamente consumiendo VITE_FIREBASE_STORAGE_BUCKET.
 * Bloque try/catch robusto: si la imagen no sube, reporta console.error y no se congela.
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | Blob | string,
  folder: string = 'catalog'
): Promise<string> {
  // Si ya es una URL persistente accesible (http/https y no blob/base64), mantenerla
  if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) && !fileOrDataUrl.includes('/uploads/')) {
    return fileOrDataUrl;
  }

  const stor = storage || getFirebaseStorage();
  if (!stor) {
    console.error('[STORAGE ERROR] Firebase Storage no está disponible. Verificá VITE_FIREBASE_STORAGE_BUCKET.');
    throw new Error('Firebase Storage no disponible. Verificá la variable VITE_FIREBASE_STORAGE_BUCKET.');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  try {
    let storageRef;
    let uploadPromise;

    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')) {
      let ext = 'jpg';
      if (fileOrDataUrl.includes('image/png')) ext = 'png';
      else if (fileOrDataUrl.includes('image/webp')) ext = 'webp';
      const filePath = `${folder}/${timestamp}_${randomSuffix}.${ext}`;
      storageRef = ref(stor, filePath);
      uploadPromise = uploadString(storageRef, fileOrDataUrl, 'data_url');
    } else if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      const originalName = (fileOrDataUrl as File).name || 'image.jpg';
      const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folder}/${timestamp}_${cleanName}`;
      storageRef = ref(stor, filePath);
      const contentType = (fileOrDataUrl as File).type || 'image/jpeg';
      uploadPromise = uploadBytes(storageRef, fileOrDataUrl, { contentType });
    } else {
      throw new Error('Formato de imagen inválido para subir a Firebase Storage.');
    }

    // Direct upload with uploadBytes / uploadString
    const uploadResult = await uploadPromise;
    // Direct getDownloadURL
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return downloadUrl;
  } catch (err: any) {
    console.error('[STORAGE ERROR EXACTO]:', err?.code || err?.name, err?.message || err);
    throw err;
  }
}

/**
 * Executes a promise with an automatic timeout to prevent stalling
 * if the device or network connection is offline or unstable.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operación de Firestore cancelada por timeout (${timeoutMs}ms)`)), timeoutMs)
    ),
  ]);
}

// ==========================================
// PRODUCTS PERSISTENCE (Cloud Firestore)
// ==========================================

export async function fetchFirestoreProducts(): Promise<Product[] | null> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return null;
  try {
    const fetchAction = async () => {
      let snapshot = await getDocs(collection(firestoreDb, 'productos'));
      if (snapshot.empty) {
        snapshot = await getDocs(collection(firestoreDb, 'products'));
      }
      return snapshot;
    };

    const snapshot = await withTimeout(fetchAction(), 7000);
    if (!snapshot || snapshot.empty) {
      return null;
    }
    const products: Product[] = [];
    const seenIds = new Set<string>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Product;
      const sku = docSnap.id || data.code || data.id;
      if (!seenIds.has(sku)) {
        seenIds.add(sku);
        products.push({
          ...data,
          id: sku,
          code: data.code || sku,
        });
      }
    });
    return products;
  } catch (err: any) {
    console.warn('[FIREBASE] Aviso de lectura en Cloud Firestore (modo offline/fallback activo):', err?.message || err);
    return null;
  }
}

export async function saveFirestoreProducts(products: Product[]): Promise<{ success: boolean; error?: string }> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) {
    const msg = 'La conexión a Cloud Firestore no está inicializada.';
    console.warn('[FIREBASE]', msg);
    return { success: false, error: msg };
  }
  if (!Array.isArray(products) || products.length === 0) {
    return { success: false, error: 'Lista de productos vacía.' };
  }
  try {
    // Firestore writeBatch has a maximum limit of 500 operations per batch
    const BATCH_SIZE = 200;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestoreDb);
      const chunk = products.slice(i, i + BATCH_SIZE);
      chunk.forEach((p) => {
        const sku = (p.code || p.id || '').trim();
        if (!sku) return;
        const docRefEs = doc(firestoreDb, 'productos', sku);
        const docRefEn = doc(firestoreDb, 'products', sku);
        // Deeply sanitize undefined values
        const cleaned = JSON.parse(
          JSON.stringify(
            {
              ...p,
              id: sku,
              code: sku,
              updatedAt: new Date().toISOString(),
            },
            (k, v) => (v === undefined ? null : v)
          )
        );
        batch.set(docRefEs, cleaned, { merge: true });
        batch.set(docRefEn, cleaned, { merge: true });
      });
      await batch.commit();
    }

    // Also update metadata timestamp
    const metaRef = doc(firestoreDb, 'store_config', 'metadata');
    await setDoc(
      metaRef,
      {
        totalProducts: products.length,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[FIREBASE] Saved ${products.length} products to Cloud Firestore.`);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn('[FIREBASE] Modo offline / permisos en Firestore para productos:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Saves or updates a single product directly in Cloud Firestore
 */
export async function saveSingleFirestoreProduct(product: Product): Promise<{ success: boolean; error?: string }> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) {
    const msg = 'No hay conexión activa con Cloud Firestore de Firebase.';
    console.error('[FIREBASE ERROR]', msg);
    return { success: false, error: msg };
  }
  try {
    const sku = (product.code || product.id || '').trim();
    if (!sku) {
      throw new Error('El producto no tiene un código o SKU válido.');
    }
    const docRefEs = doc(firestoreDb, 'productos', sku);
    const docRefEn = doc(firestoreDb, 'products', sku);
    // Sanitize any undefined fields to avoid Firestore WriteBatch rejection
    const cleaned = JSON.parse(
      JSON.stringify(
        {
          ...product,
          id: sku,
          code: sku,
          updatedAt: new Date().toISOString(),
        },
        (k, v) => (v === undefined ? null : v)
      )
    );
    await setDoc(docRefEs, cleaned, { merge: true });
    await setDoc(docRefEn, cleaned, { merge: true });
    console.log(`[FIREBASE] Producto guardado exitosamente en Firestore (${sku}):`, product.name);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[FIREBASE ERROR] Falló la promesa de guardado para el producto ${product.name}:`, err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Deletes a single product from Cloud Firestore
 */
export async function deleteFirestoreProductDoc(productId: string): Promise<{ success: boolean; error?: string }> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) {
    return { success: false, error: 'Firebase no inicializado' };
  }
  try {
    const docRef = doc(firestoreDb, 'products', productId);
    const docRefEs = doc(firestoreDb, 'productos', productId);
    await deleteDoc(docRef);
    await deleteDoc(docRefEs).catch(() => {});
    console.log(`[FIREBASE] Producto eliminado de Firestore: ${productId}`);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[FIREBASE ERROR] No se pudo eliminar el producto ${productId}:`, err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Real-time listener for products collection in Cloud Firestore
 */
export function subscribeToFirestoreProducts(
  onProductsChange: (products: Product[]) => void
): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'productos');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const products: Product[] = [];
          const seenIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Product;
            const sku = docSnap.id || data.code || data.id;
            if (!seenIds.has(sku)) {
              seenIds.add(sku);
              products.push({
                ...data,
                id: sku,
                code: data.code || sku,
              });
            }
          });
          onProductsChange(products);
        }
      },
      (error) => {
        console.warn('[FIREBASE] Real-time products listener offline warning:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error attaching real-time products listener:', err?.message || err);
    return () => {};
  }
}

// ==========================================
// STORE CONFIGURATION PERSISTENCE (Cloud Firestore)
// ==========================================

export interface FirestoreStoreConfig {
  categories?: CategoryHierarchyItem[];
  promotions?: Promotion[];
  theme?: ThemeConfig;
  branches?: BranchLocation[];
  coupons?: DiscountCoupon[];
  volumeDiscounts?: VolumeDiscountRule[];
  lookbook?: LookbookItem[];
  sizingPortalConfig?: any;
  simulatorConfig?: any;
  updatedAt?: string;
}

export async function fetchFirestoreStoreConfig(): Promise<FirestoreStoreConfig | null> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return null;
  try {
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    const docSnap = await withTimeout(getDoc(configDocRef), 7000);
    if (!docSnap || !docSnap.exists()) {
      return null;
    }
    return docSnap.data() as FirestoreStoreConfig;
  } catch (err: any) {
    console.warn('[FIREBASE] Aviso de lectura de configuración (modo offline/fallback activo):', err?.message || err);
    return null;
  }
}

export async function saveFirestoreStoreConfig(partialConfig: Partial<FirestoreStoreConfig>): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return false;
  try {
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    const cleaned = JSON.parse(JSON.stringify(partialConfig));
    await setDoc(
      configDocRef,
      {
        ...cleaned,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('[FIREBASE] Updated store_config in Cloud Firestore');
    return true;
  } catch (err: any) {
    console.warn('[FIREBASE] store_config modo offline / permisos:', err?.message || err);
    return false;
  }
}

// ==========================================
// REAL-TIME LISTENER (Live Sync across tabs & devices)
// ==========================================

export function subscribeToFirestoreStoreConfig(
  onConfigChange: (config: FirestoreStoreConfig) => void
): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  try {
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onConfigChange(docSnap.data() as FirestoreStoreConfig);
        }
      },
      (error) => {
        console.warn('[FIREBASE] Real-time listener offline fallback:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error attaching real-time listener:', err?.message || err);
    return () => {};
  }
}

// ==========================================
// DEDICATED PROMOTIONS PERSISTENCE (Cloud Firestore & Storage)
// ==========================================

/**
 * Uploads a banner image to Firebase Storage exclusively using uploadBytes and getDownloadURL.
 * Saves directly into the 'promotions/' directory and returns the public download URL.
 */
export async function uploadPromotionBanner(
  file: File,
  promoId: string = `promo-${Date.now()}`
): Promise<string> {
  const stor = storage || getFirebaseStorage();
  if (!stor) {
    console.error('[STORAGE ERROR] Firebase Storage no está disponible.');
    throw new Error('Firebase Storage no disponible.');
  }

  const timestamp = Date.now();
  const originalName = file.name || 'banner.jpg';
  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `promotions/${promoId}_${timestamp}_${cleanName}`;
  const storageRef = ref(stor, filePath);
  const contentType = file.type || 'image/jpeg';

  try {
    const uploadResult = await uploadBytes(storageRef, file, { contentType });
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    console.log('[FIREBASE STORAGE] Banner de promoción subido a Storage exitosamente:', downloadUrl);
    return downloadUrl;
  } catch (err: any) {
    console.error('[FIREBASE STORAGE ERROR] Error subiendo banner a Storage:', err?.message || err);
    throw err;
  }
}

/**
 * Saves a promotion document in the dedicated 'promotions' collection in Cloud Firestore.
 * Preserves all typography properties (textColor, fontSize, subtitleColor, subtitleFontSize)
 * and the public Firebase Storage banner URL.
 */
export async function saveFirestorePromotion(promo: Promotion): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return false;

  try {
    const promoId = promo.id || `promo-${Date.now()}`;
    const docRef = doc(firestoreDb, 'promotions', promoId);

    const payload = {
      id: promoId,
      title: promo.title || '',
      subtitle: promo.subtitle || '',
      badge: promo.badge || '',
      bannerImage: promo.bannerImage || '',
      categoryFilter: promo.categoryFilter || null,
      tagFilter: promo.tagFilter || '',
      discountOnly: Boolean(promo.discountOnly),
      discountPercentage: Number(promo.discountPercentage) || 0,
      associatedProductCodes: Array.isArray(promo.associatedProductCodes) ? promo.associatedProductCodes : [],
      active: promo.active !== false,
      textColor: promo.textColor || '#FFFFFF',
      fontSize: promo.fontSize || '72px',
      subtitleColor: promo.subtitleColor || '#DCD4C9',
      subtitleFontSize: promo.subtitleFontSize || '16px',
      primaryBtnText: promo.primaryBtnText || 'VER CATÁLOGO',
      buttons: Array.isArray(promo.buttons)
        ? promo.buttons.map((b) => ({
            id: b.id,
            label: b.label || '',
            actionType: b.actionType || 'catalog',
            actionValue: b.actionValue || '',
            style: b.style || 'primary',
          }))
        : [],
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, payload, { merge: true });
    console.log('[FIREBASE] Promoción guardada en colección dedicated promotions:', promoId);
    return true;
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Error guardando promoción en Firestore:', err);
    return false;
  }
}

/**
 * Deletes a promotion document from the dedicated 'promotions' collection in Cloud Firestore.
 */
export async function deleteFirestorePromotion(promoId: string): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return false;

  try {
    const docRef = doc(firestoreDb, 'promotions', promoId);
    await deleteDoc(docRef);
    console.log('[FIREBASE] Promoción eliminada de Firestore:', promoId);
    return true;
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Error eliminando promoción de Firestore:', err);
    return false;
  }
}

/**
 * Saves multiple promotions in batch into the dedicated 'promotions' collection in Cloud Firestore.
 */
export async function saveFirestorePromotionsBatch(promos: Promotion[]): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !Array.isArray(promos)) return false;

  try {
    const batch = writeBatch(firestoreDb);
    for (const promo of promos) {
      const promoId = promo.id || `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const docRef = doc(firestoreDb, 'promotions', promoId);
      const payload = {
        id: promoId,
        title: promo.title || '',
        subtitle: promo.subtitle || '',
        badge: promo.badge || '',
        bannerImage: promo.bannerImage || '',
        categoryFilter: promo.categoryFilter || null,
        tagFilter: promo.tagFilter || '',
        discountOnly: Boolean(promo.discountOnly),
        discountPercentage: Number(promo.discountPercentage) || 0,
        associatedProductCodes: Array.isArray(promo.associatedProductCodes) ? promo.associatedProductCodes : [],
        active: promo.active !== false,
        textColor: promo.textColor || '#FFFFFF',
        fontSize: promo.fontSize || '72px',
        subtitleColor: promo.subtitleColor || '#DCD4C9',
        subtitleFontSize: promo.subtitleFontSize || '16px',
        primaryBtnText: promo.primaryBtnText || 'VER CATÁLOGO',
        buttons: Array.isArray(promo.buttons)
          ? promo.buttons.map((b) => ({
              id: b.id,
              label: b.label || '',
              actionType: b.actionType || 'catalog',
              actionValue: b.actionValue || '',
              style: b.style || 'primary',
            }))
          : [],
        updatedAt: new Date().toISOString(),
      };
      batch.set(docRef, payload, { merge: true });
    }
    await batch.commit();
    console.log('[FIREBASE] Batch de promociones persistido en Firestore.');
    return true;
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Error guardando batch de promociones en Firestore:', err);
    return false;
  }
}

/**
 * Real-time onSnapshot listener for the dedicated 'promotions' collection in Cloud Firestore.
 * Notifies subscriber of all updates in live time across admin and public client views.
 */
export function subscribeToFirestorePromotions(
  onUpdate: (promos: Promotion[]) => void,
  onError?: (err: Error) => void
): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'promotions');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Promotion[] = [];
          snapshot.docs.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              title: data.title || '',
              subtitle: data.subtitle || '',
              badge: data.badge || '',
              bannerImage: data.bannerImage || '',
              categoryFilter: data.categoryFilter || undefined,
              tagFilter: data.tagFilter || '',
              discountOnly: Boolean(data.discountOnly),
              discountPercentage: Number(data.discountPercentage) || 0,
              associatedProductCodes: Array.isArray(data.associatedProductCodes) ? data.associatedProductCodes : [],
              active: data.active !== false,
              textColor: data.textColor || '#FFFFFF',
              fontSize: data.fontSize || '72px',
              subtitleColor: data.subtitleColor || '#DCD4C9',
              subtitleFontSize: data.subtitleFontSize || '16px',
              primaryBtnText: data.primaryBtnText || 'VER CATÁLOGO',
              buttons: Array.isArray(data.buttons) ? data.buttons : [],
            });
          });
          onUpdate(list);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        console.warn('[FIREBASE] Advertencia en listener de promociones:', error.message);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error suscribiendo a colección promotions:', err);
    return () => {};
  }
}

/**
 * Seeds initial promotions to Cloud Firestore if the 'promotions' collection is currently empty.
 */
export async function seedInitialPromotionsIfEmpty(initialPromos: Promotion[]): Promise<void> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !Array.isArray(initialPromos) || initialPromos.length === 0) return;

  try {
    const snap = await getDocs(collection(firestoreDb, 'promotions'));
    if (snap.empty) {
      console.log('[FIREBASE] Sembrando promociones iniciales en colección promotions...');
      await saveFirestorePromotionsBatch(initialPromos);
      console.log('[FIREBASE] Promociones iniciales sembradas exitosamente en Firestore.');
    }
  } catch (err) {
    console.warn('[FIREBASE] Aviso verificando o sembrando promociones iniciales:', err);
  }
}


import { 
  INITIAL_CRM_ORDERS, 
  INITIAL_LEAD_VISITS, 
  INITIAL_SUPPLIER_ORDERS, 
  INITIAL_SIZING_CAMPAIGNS, 
  INITIAL_EMPLOYEE_SIZES 
} from '../data/initialCRMData';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../utils/encodingUtils';

// --- CRM FIREBASE INTEGRATION ---
export const saveCRMOrder = async (orderData: any): Promise<{ success: boolean; id: string; error?: string }> => {
  const orderId = orderData.id || `PED-${Date.now().toString().slice(-6)}`;
  const initialStatus = orderData.status || orderData.columnId || 'cotizacion';
  const columnId = orderData.columnId || initialStatus;

  const fullOrder = sanitizeObjectEncoding({
    ...orderData,
    id: orderId,
    status: initialStatus,
    columnId: columnId,
    updatedAt: new Date().toISOString(),
    createdAt: orderData.createdAt || new Date().toISOString(),
  });

  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_orders') || '[]');
    const updated = [fullOrder, ...local.filter((o: any) => o.id !== fullOrder.id)];
    localStorage.setItem('pampero_crm_orders', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'crm_orders', fullOrder.id);
      const cleaned = JSON.parse(JSON.stringify(fullOrder, (k, v) => (v === undefined ? null : v)));
      await setDoc(docRef, cleaned, { merge: true });
      console.log('[FIREBASE] CRM Order Saved to crm_orders:', fullOrder.id);
      return { success: true, id: fullOrder.id };
    } catch (err: any) {
      console.error('[FIREBASE ERROR] Error saving CRM order:', err);
      return { success: false, id: fullOrder.id, error: err?.message };
    }
  }
  return { success: true, id: fullOrder.id };
};

export const deleteCRMOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_orders') || '[]');
    const updated = local.filter((o: any) => o.id !== orderId);
    localStorage.setItem('pampero_crm_orders', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, 'crm_orders', orderId));
      console.log('[FIREBASE] CRM Order Deleted from crm_orders:', orderId);
      return { success: true };
    } catch (err: any) {
      console.error('[FIREBASE ERROR] Error deleting CRM order:', err);
      return { success: false, error: err?.message };
    }
  }
  return { success: true };
};

export const subscribeToCRMOrders = (onUpdate: (orders: any[]) => void): () => void => {
  // 1. Initial immediate local or seed load
  try {
    const local = localStorage.getItem('pampero_crm_orders');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed.map(sanitizeObjectEncoding));
      } else {
        onUpdate(INITIAL_CRM_ORDERS.map(sanitizeObjectEncoding));
        localStorage.setItem('pampero_crm_orders', JSON.stringify(INITIAL_CRM_ORDERS));
      }
    } else {
      onUpdate(INITIAL_CRM_ORDERS.map(sanitizeObjectEncoding));
      localStorage.setItem('pampero_crm_orders', JSON.stringify(INITIAL_CRM_ORDERS));
    }
  } catch {
    onUpdate(INITIAL_CRM_ORDERS.map(sanitizeObjectEncoding));
  }

  // 2. Realtime listener from Firestore
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'crm_orders');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const orders = snapshot.docs.map(doc => sanitizeObjectEncoding({ id: doc.id, ...doc.data() }) as any);
        localStorage.setItem('pampero_crm_orders', JSON.stringify(orders));
        onUpdate(orders);
      }
    }, (error) => {
      console.warn('CRM orders listener warning (offline/local fallback):', error.message);
    });
  } catch (err) {
    console.warn('Error initiating subscribeToCRMOrders:', err);
    return () => {};
  }
};

// --- LEADS & VISITAS COMERCIALES ---
export const saveLeadVisit = async (visitData: any): Promise<{ success: boolean; id: string; error?: string }> => {
  const visitId = visitData.id || `VIS-${Date.now().toString().slice(-6)}`;
  const initialCol = visitData.columnId || visitData.step || visitData.kanbanStep || 'primer_contacto';
  
  const fullVisit = sanitizeObjectEncoding({
    ...visitData,
    id: visitId,
    columnId: initialCol,
    step: visitData.step || initialCol,
    kanbanStep: visitData.kanbanStep || initialCol,
    status: visitData.status || (initialCol === 'convertida' ? 'cerrada' : initialCol === 'previo_cotizacion' ? 'presupuesto_enviado' : initialCol === 'reunion' ? 'realizada' : 'programada'),
    updatedAt: new Date().toISOString(),
    createdAt: visitData.createdAt || new Date().toISOString(),
  });

  try {
    const local = JSON.parse(localStorage.getItem('pampero_lead_visits') || '[]');
    const updated = [fullVisit, ...local.filter((v: any) => v.id !== fullVisit.id)];
    localStorage.setItem('pampero_lead_visits', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'crm_leads_visitas', fullVisit.id);
      const cleaned = JSON.parse(JSON.stringify(fullVisit, (k, v) => (v === undefined ? null : v)));
      await setDoc(docRef, cleaned, { merge: true });
      console.log('[FIREBASE] Lead Visit Saved to crm_leads_visitas:', fullVisit.id);
      return { success: true, id: fullVisit.id };
    } catch (err: any) {
      console.error('[FIREBASE ERROR] Error saving lead visit:', err);
      return { success: false, id: fullVisit.id, error: err?.message };
    }
  }
  return { success: true, id: fullVisit.id };
};

export const deleteLeadVisit = async (visitId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_lead_visits') || '[]');
    const updated = local.filter((v: any) => v.id !== visitId);
    localStorage.setItem('pampero_lead_visits', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, 'crm_leads_visitas', visitId));
      console.log('[FIREBASE] Lead visit deleted from crm_leads_visitas:', visitId);
      return { success: true };
    } catch (err: any) {
      console.error('[FIREBASE ERROR] Error deleting lead visit:', err);
      return { success: false, error: err?.message };
    }
  }
  return { success: true };
};

export const subscribeToLeadVisits = (onUpdate: (visits: any[]) => void): () => void => {
  try {
    const local = localStorage.getItem('pampero_lead_visits');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) onUpdate(parsed.map(sanitizeObjectEncoding));
      else onUpdate(INITIAL_LEAD_VISITS.map(sanitizeObjectEncoding));
    } else {
      onUpdate(INITIAL_LEAD_VISITS.map(sanitizeObjectEncoding));
    }
  } catch {
    onUpdate(INITIAL_LEAD_VISITS.map(sanitizeObjectEncoding));
  }

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'crm_leads_visitas');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const visits = snapshot.docs.map(doc => sanitizeObjectEncoding({ id: doc.id, ...doc.data() }) as any);
        localStorage.setItem('pampero_lead_visits', JSON.stringify(visits));
        onUpdate(visits);
      }
    }, (error) => {
      console.warn('Lead visits listener warning (offline/local fallback):', error.message);
    });
  } catch (err) {
    console.warn('Error initiating subscribeToLeadVisits:', err);
    return () => {};
  }
};

// --- PEDIDOS A PROVEEDOR (MACATA / PAMPERO CENTRAL) ---
export const saveSupplierOrder = async (orderData: any) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_supplier_orders') || '[]');
    const updated = [orderData, ...local.filter((o: any) => o.id !== orderData.id)];
    localStorage.setItem('pampero_supplier_orders', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'crm_pedidos_proveedor', orderData.id);
    await setDoc(docRef, { ...orderData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving supplier order:', err);
  }
};

export const deleteSupplierOrder = async (orderId: string) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_supplier_orders') || '[]');
    const updated = local.filter((o: any) => o.id !== orderId);
    localStorage.setItem('pampero_supplier_orders', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, 'crm_pedidos_proveedor', orderId));
  } catch (err) {
    console.error('Error deleting supplier order:', err);
  }
};

export const subscribeToSupplierOrders = (onUpdate: (orders: any[]) => void) => {
  try {
    const local = localStorage.getItem('pampero_supplier_orders');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) onUpdate(parsed);
      else onUpdate(INITIAL_SUPPLIER_ORDERS);
    } else {
      onUpdate(INITIAL_SUPPLIER_ORDERS);
    }
  } catch {
    onUpdate(INITIAL_SUPPLIER_ORDERS);
  }

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'crm_pedidos_proveedor');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const orders = snapshot.docs.map(doc => doc.data() as any);
        localStorage.setItem('pampero_supplier_orders', JSON.stringify(orders));
        onUpdate(orders);
      }
    }, (error) => {
      console.warn('Error listening to supplier orders:', error);
    });
  } catch (err) {
    console.warn('Exception in subscribeToSupplierOrders:', err);
    return () => {};
  }
};

// --- PORTAL DE TALLES EMPRESARIAL ---
export const saveSizingCampaign = async (campaignData: any) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_sizing_campaigns') || '[]');
    const updated = [campaignData, ...local.filter((c: any) => c.id !== campaignData.id)];
    localStorage.setItem('pampero_sizing_campaigns', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'crm_sizing_campaigns', campaignData.id);
    await setDoc(docRef, { ...campaignData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving sizing campaign:', err);
  }
};

export const subscribeToSizingCampaigns = (onUpdate: (campaigns: any[]) => void): () => void => {
  try {
    const local = localStorage.getItem('pampero_sizing_campaigns');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) onUpdate(parsed);
      else onUpdate(INITIAL_SIZING_CAMPAIGNS);
    } else {
      onUpdate(INITIAL_SIZING_CAMPAIGNS);
    }
  } catch {
    onUpdate(INITIAL_SIZING_CAMPAIGNS);
  }

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'crm_sizing_campaigns');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const campaigns = snapshot.docs.map(doc => doc.data() as any);
        localStorage.setItem('pampero_sizing_campaigns', JSON.stringify(campaigns));
        onUpdate(campaigns);
      }
    }, (error) => {
      console.warn('Error listening to sizing campaigns:', error);
    });
  } catch (err) {
    console.warn('Exception in subscribeToSizingCampaigns:', err);
    return () => {};
  }
};

export const saveEmployeeSizeEntry = async (entryData: any) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_employee_sizes') || '[]');
    const updated = [entryData, ...local.filter((e: any) => e.id !== entryData.id)];
    localStorage.setItem('pampero_employee_sizes', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'crm_employee_sizes', entryData.id);
    await setDoc(docRef, { ...entryData, submittedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving employee size entry:', err);
  }
};

export const subscribeToEmployeeSizeEntries = (campaignId: string, onUpdate: (entries: any[]) => void): () => void => {
  try {
    const local = localStorage.getItem('pampero_employee_sizes');
    let list = INITIAL_EMPLOYEE_SIZES;
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    }
    const filtered = campaignId === 'all' ? list : list.filter(e => e.campaignId === campaignId);
    onUpdate(filtered);
  } catch {
    onUpdate(INITIAL_EMPLOYEE_SIZES);
  }

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'crm_employee_sizes');
    return onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const all = snapshot.docs.map(doc => doc.data() as any);
        localStorage.setItem('pampero_employee_sizes', JSON.stringify(all));
        const filtered = campaignId === 'all' ? all : all.filter(e => e.campaignId === campaignId);
        onUpdate(filtered);
      }
    }, (error) => {
      console.warn('Error listening to employee size entries:', error);
    });
  } catch (err) {
    console.warn('Exception in subscribeToEmployeeSizeEntries:', err);
    return () => {};
  }
};

// ==========================================
// REGISTERED USERS PERSISTENCE (Cloud Firestore)
// ==========================================

export const saveFirestoreUser = async (user: RegisteredUser): Promise<{ success: boolean; error?: string }> => {
  const firestoreDb = db || getFirebaseDb();
  const userId = user.id || (user.email ? user.email.replace(/[^a-zA-Z0-9_-]/g, '_') : `user-${Date.now()}`);
  const sanitizedUser: RegisteredUser = {
    ...user,
    id: userId,
  };

  // 1. Keep local backup as safety in pampero_registered_users
  try {
    const local: RegisteredUser[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
    const updated = [
      sanitizedUser,
      ...local.filter((u) => u.id !== userId && (!u.email || u.email.toLowerCase() !== (sanitizedUser.email || '').toLowerCase()))
    ];
    localStorage.setItem('pampero_registered_users', JSON.stringify(updated));
  } catch {}

  // 2. If user is an employee or seller, sync with pampero_employees and pampero_sellers
  const isEmployeeRole = sanitizedUser.role === 'employee' || sanitizedUser.type === 'empleado' || sanitizedUser.type === 'vendedor';
  if (isEmployeeRole) {
    try {
      const empLocal: any[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
      const empRecord = {
        id: userId,
        name: sanitizedUser.name,
        email: sanitizedUser.email,
        password: sanitizedUser.password || sanitizedUser.initialPassword || 'Pampero2026',
        role: 'employee',
        branch: sanitizedUser.branch || 'Maipú',
        allowedTabs: sanitizedUser.allowedTabs || ['products', 'variants', 'prices', 'mass_images', 'promos', 'quotes', 'crm'],
        crmTabs: sanitizedUser.crmTabs || ['visits', 'board', 'suppliers', 'costs'],
        active: sanitizedUser.status === 'active',
        createdAt: sanitizedUser.createdAt || new Date().toISOString(),
      };
      const updatedEmp = [
        empRecord,
        ...empLocal.filter((e: any) => e.id !== userId && e.email?.toLowerCase() !== (sanitizedUser.email || '').toLowerCase())
      ];
      localStorage.setItem('pampero_employees', JSON.stringify(updatedEmp));

      // Also sync to sellers pool for CRM
      const sellLocal: any[] = JSON.parse(localStorage.getItem('pampero_sellers') || '[]');
      const sellRecord = {
        id: userId,
        name: sanitizedUser.name,
        branch: sanitizedUser.branch || 'Maipú',
        phone: sanitizedUser.phone,
        email: sanitizedUser.email,
        role: sanitizedUser.sellerRole || 'vendedor',
        active: sanitizedUser.status === 'active',
      };
      const updatedSell = [
        sellRecord,
        ...sellLocal.filter((s: any) => s.id !== userId && s.email?.toLowerCase() !== (sanitizedUser.email || '').toLowerCase())
      ];
      localStorage.setItem('pampero_sellers', JSON.stringify(updatedSell));
    } catch {}
  }

  if (!firestoreDb) {
    return { success: true };
  }

  try {
    const docRef = doc(firestoreDb, 'usuarios', userId);
    const cleaned = JSON.parse(JSON.stringify(sanitizedUser, (k, v) => (v === undefined ? null : v)));
    await setDoc(docRef, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true });

    // Also mirror to 'users' collection
    const docRefMirror = doc(firestoreDb, 'users', userId);
    await setDoc(docRefMirror, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    // If employee, also write to 'empleados'
    if (isEmployeeRole) {
      const empDocRef = doc(firestoreDb, 'empleados', userId);
      await setDoc(empDocRef, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    // Graceful offline fallback
    return { success: true };
  }
};

export const deleteFirestoreUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const local: RegisteredUser[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
    const updated = local.filter((u) => u.id !== userId);
    localStorage.setItem('pampero_registered_users', JSON.stringify(updated));

    const empLocal: any[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
    localStorage.setItem('pampero_employees', JSON.stringify(empLocal.filter((e: any) => e.id !== userId)));

    const sellLocal: any[] = JSON.parse(localStorage.getItem('pampero_sellers') || '[]');
    localStorage.setItem('pampero_sellers', JSON.stringify(sellLocal.filter((s: any) => s.id !== userId)));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return { success: true };

  try {
    await deleteDoc(doc(firestoreDb, 'usuarios', userId)).catch(() => {});
    await deleteDoc(doc(firestoreDb, 'users', userId)).catch(() => {});
    await deleteDoc(doc(firestoreDb, 'empleados', userId)).catch(() => {});
    await deleteDoc(doc(firestoreDb, 'vendedores', userId)).catch(() => {});
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
};

export const subscribeToFirestoreUsers = (
  onUpdate: (users: RegisteredUser[]) => void
): () => void => {
  // 1. Initial immediate emission from localStorage or fallback
  try {
    const localRaw = localStorage.getItem('pampero_registered_users');
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed);
      }
    }
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'usuarios');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: RegisteredUser[] = [];
          const seen = new Set<string>();
          snapshot.docs.forEach((d) => {
            const data = d.data() as RegisteredUser;
            const uId = d.id || data.id;
            const emailKey = (data.email || '').toLowerCase().trim();
            const dedupeKey = emailKey || uId;
            if (!seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              list.push({
                ...data,
                id: uId,
              });
            }
          });
          try {
            localStorage.setItem('pampero_registered_users', JSON.stringify(list));
          } catch {}
          onUpdate(list);
        }
      },
      (_error) => {
        // Silently handle error (no console spam or re-render storms)
      }
    );
    return unsubscribe;
  } catch (err: any) {
    return () => {};
  }
};

export const seedInitialFirestoreUsersIfEmpty = async (initialUsers: RegisteredUser[]): Promise<void> => {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !Array.isArray(initialUsers) || initialUsers.length === 0) return;

  try {
    const snap = await getDocs(collection(firestoreDb, 'usuarios'));
    if (snap.empty) {
      console.log('[FIREBASE] Seeding initial registered users to Cloud Firestore...');
      const batch = writeBatch(firestoreDb);
      initialUsers.forEach((u) => {
        const uId = u.id || (u.email ? u.email.replace(/[^a-zA-Z0-9_-]/g, '_') : `user-${Math.random().toString(36).slice(2)}`);
        const docRef = doc(firestoreDb, 'usuarios', uId);
        const cleaned = JSON.parse(JSON.stringify(u, (k, v) => (v === undefined ? null : v)));
        batch.set(docRef, { ...cleaned, createdAt: u.createdAt || new Date().toISOString() }, { merge: true });
      });
      await batch.commit();
      console.log('[FIREBASE] Initial registered users seeded successfully.');
    }
  } catch (err) {
    console.warn('[FIREBASE] Error checking or seeding registered users:', err);
  }
};

// ==========================================
// OPERADORES Y LOCALES (Cloud Firestore)
// ==========================================

export const saveFirestoreEmployee = async (employee: EmployeeAccount): Promise<{ success: boolean; error?: string }> => {
  const empId = employee.id || `emp-${Date.now()}`;
  const sanitized: EmployeeAccount = {
    ...employee,
    id: empId,
  };

  // Local mirror
  try {
    const local: EmployeeAccount[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
    const updated = [sanitized, ...local.filter((e) => e.id !== empId)];
    localStorage.setItem('pampero_employees', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return { success: true };

  try {
    const docRef = doc(firestoreDb, 'empleados', empId);
    const cleaned = JSON.parse(JSON.stringify(sanitized, (k, v) => (v === undefined ? null : v)));
    await setDoc(docRef, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true });

    // Mirror to 'employees' collection
    const docRefMirror = doc(firestoreDb, 'employees', empId);
    await setDoc(docRefMirror, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    console.log('[FIREBASE] Employee / Operator saved in Firestore:', sanitized.name);
    return { success: true };
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Could not save employee to Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
};

export const deleteFirestoreEmployee = async (empId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const local: EmployeeAccount[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
    const updated = local.filter((e) => e.id !== empId);
    localStorage.setItem('pampero_employees', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return { success: true };

  try {
    await deleteDoc(doc(firestoreDb, 'empleados', empId));
    await deleteDoc(doc(firestoreDb, 'employees', empId)).catch(() => {});
    console.log('[FIREBASE] Employee / Operator deleted from Firestore:', empId);
    return { success: true };
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Could not delete employee from Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
};

export const subscribeToFirestoreEmployees = (
  onUpdate: (employees: EmployeeAccount[]) => void
): () => void => {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'empleados');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: EmployeeAccount[] = [];
          const seen = new Set<string>();
          snapshot.docs.forEach((d) => {
            const data = d.data() as EmployeeAccount;
            const empId = d.id || data.id;
            if (!seen.has(empId)) {
              seen.add(empId);
              list.push({
                ...data,
                id: empId,
              });
            }
          });
          try {
            localStorage.setItem('pampero_employees', JSON.stringify(list));
          } catch {}
          onUpdate(list);
        }
      },
      (error) => {
        console.warn('[FIREBASE] Real-time employees listener offline notice:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error subscribing to empleados:', err?.message || err);
    return () => {};
  }
};

export const seedInitialFirestoreEmployeesIfEmpty = async (initialEmployees: EmployeeAccount[]): Promise<void> => {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !Array.isArray(initialEmployees) || initialEmployees.length === 0) return;

  try {
    const snap = await getDocs(collection(firestoreDb, 'empleados'));
    if (snap.empty) {
      console.log('[FIREBASE] Seeding initial employees to Cloud Firestore...');
      const batch = writeBatch(firestoreDb);
      initialEmployees.forEach((emp) => {
        const docRef = doc(firestoreDb, 'empleados', emp.id);
        const cleaned = JSON.parse(JSON.stringify(emp, (k, v) => (v === undefined ? null : v)));
        batch.set(docRef, { ...cleaned, createdAt: emp.createdAt || new Date().toISOString() }, { merge: true });
      });
      await batch.commit();
      console.log('[FIREBASE] Initial employees seeded successfully.');
    }
  } catch (err) {
    console.warn('[FIREBASE] Error seeding employees to Firestore:', err);
  }
};

// ==========================================
// CRM EXPENSES (CONTROL DE COSTOS)
// Collection: crm_expenses
// Strictly Cloud Firestore SDK with optimistic cache & error resiliency
// ==========================================

export async function saveCRMExpense(expense: CRMExpense): Promise<{ success: boolean; id: string; error?: string }> {
  const expenseId = expense.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cleanExpense = sanitizeObjectEncoding({
    ...expense,
    id: expenseId,
    amount: Number(expense.amount) || 0,
    updatedAt: new Date().toISOString(),
    createdAt: expense.createdAt || new Date().toISOString(),
  });

  // Local cache backup
  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_expenses') || '[]');
    const updated = [cleanExpense, ...local.filter((e: any) => e.id !== cleanExpense.id)];
    localStorage.setItem('pampero_crm_expenses', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'crm_expenses', cleanExpense.id);
      const cleaned = JSON.parse(
        JSON.stringify(
          cleanExpense,
          (k, v) => (v === undefined ? null : v)
        )
      );
      await setDoc(docRef, cleaned, { merge: true });
      return { success: true, id: cleanExpense.id };
    } catch (err: any) {
      console.warn('[FIREBASE] saveCRMExpense warning:', err?.message || err);
      return { success: false, id: cleanExpense.id, error: err?.message || 'Error guardando en Firestore' };
    }
  }
  return { success: true, id: cleanExpense.id };
}

export async function deleteCRMExpense(expenseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_expenses') || '[]');
    const updated = local.filter((e: any) => e.id !== expenseId);
    localStorage.setItem('pampero_crm_expenses', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'crm_expenses', expenseId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (err: any) {
      console.warn('[FIREBASE] deleteCRMExpense error:', err?.message || err);
      return { success: false, error: err?.message || 'Error eliminando en Firestore' };
    }
  }
  return { success: true };
}

export function subscribeToCRMExpenses(
  onUpdate: (expenses: CRMExpense[]) => void,
  onError?: (err: Error) => void
): () => void {
  // Load initial local data
  try {
    const local = localStorage.getItem('pampero_crm_expenses');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed.map(sanitizeObjectEncoding));
      }
    }
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'crm_expenses');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: CRMExpense[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as CRMExpense;
          list.push(
            sanitizeObjectEncoding({
              ...data,
              id: d.id,
              amount: Number(data.amount) || 0,
            })
          );
        });
        // Sort by date descending
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        localStorage.setItem('pampero_crm_expenses', JSON.stringify(list));
        onUpdate(list);
      },
      (error) => {
        console.warn('[FIREBASE] Real-time crm_expenses listener offline notice:', error.message);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error subscribing to crm_expenses:', err);
    return () => {};
  }
}

// ==========================================
// CORRELATIVE ORDER NUMBER (Transaction-based #1, #2, #3...)
// ==========================================

export async function getNextCorrelativeOrderNumber(): Promise<{ number: number; formatted: string }> {
  const firestoreDb = db || getFirebaseDb();
  const storageKey = 'pampero_last_correlative_order';

  if (firestoreDb) {
    try {
      const counterRef = doc(firestoreDb, 'counters', 'orders');
      const nextNum = await runTransaction(firestoreDb, async (transaction) => {
        const snap = await transaction.get(counterRef);
        let current = 0;
        if (snap.exists()) {
          current = Number(snap.data()?.lastOrderNumber) || 0;
        }
        const updated = current + 1;
        transaction.set(counterRef, {
          lastOrderNumber: updated,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        return updated;
      });

      localStorage.setItem(storageKey, String(nextNum));
      return { number: nextNum, formatted: `#${nextNum}` };
    } catch (err) {
      console.warn('[FIREBASE COUNTER] Error en transacción correlativa, usando respaldo:', err);
    }
  }

  // Local fallback
  let localCount = 1;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      localCount = (parseInt(saved, 10) || 0) + 1;
    }
  } catch {}
  localStorage.setItem(storageKey, String(localCount));
  return { number: localCount, formatted: `#${localCount}` };
}

// ==========================================
// COST CATEGORIES PERSISTENCE (Categorías de Costos Fijo / Variable)
// ==========================================

export const DEFAULT_COST_CATEGORIES: CostCategoryConfig[] = [
  { id: 'cat-alquiler', name: 'Alquiler', defaultType: 'Fijo', isSystem: true },
  { id: 'cat-sueldos-base', name: 'Sueldos base', defaultType: 'Fijo', isSystem: true },
  { id: 'cat-impuestos-servicios', name: 'Impuestos/Servicios', defaultType: 'Fijo', isSystem: true },
  { id: 'cat-fletes', name: 'Fletes', defaultType: 'Variable', isSystem: true },
  { id: 'cat-insumos-embalaje', name: 'Insumos/Embalaje', defaultType: 'Variable', isSystem: true },
  { id: 'cat-mantenimiento', name: 'Mantenimiento', defaultType: 'Variable', isSystem: true },
  { id: 'cat-viaticos', name: 'Viáticos', defaultType: 'Variable', isSystem: true },
  { id: 'cat-comisiones', name: 'Comisiones', defaultType: 'Variable', isSystem: true },
  { id: 'cat-marketing', name: 'Marketing y Publicidad', defaultType: 'Variable', isSystem: true },
  { id: 'cat-otros', name: 'Otros Gastos', defaultType: 'Variable', isSystem: true },
];

export async function fetchCostCategories(): Promise<CostCategoryConfig[]> {
  const firestoreDb = db || getFirebaseDb();
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'store_config', 'cost_categories');
      const snap = await getDoc(docRef);
      if (snap.exists() && Array.isArray(snap.data()?.categories)) {
        return snap.data().categories as CostCategoryConfig[];
      }
    } catch (err) {
      console.warn('[COST CATEGORIES] Fallback a local:', err);
    }
  }
  try {
    const saved = localStorage.getItem('pampero_cost_categories');
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_COST_CATEGORIES;
}

export async function saveCostCategories(categories: CostCategoryConfig[]): Promise<boolean> {
  try {
    localStorage.setItem('pampero_cost_categories', JSON.stringify(categories));
    const firestoreDb = db || getFirebaseDb();
    if (firestoreDb) {
      const docRef = doc(firestoreDb, 'store_config', 'cost_categories');
      await setDoc(docRef, {
        categories,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    return true;
  } catch (err) {
    console.error('[COST CATEGORIES ERROR]:', err);
    return false;
  }
}

export function subscribeToCostCategories(onUpdate: (cats: CostCategoryConfig[]) => void): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) {
    onUpdate(DEFAULT_COST_CATEGORIES);
    return () => {};
  }
  try {
    const docRef = doc(firestoreDb, 'store_config', 'cost_categories');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.categories)) {
          onUpdate(snap.data().categories);
        } else {
          onUpdate(DEFAULT_COST_CATEGORIES);
        }
      },
      (_err) => {
        onUpdate(DEFAULT_COST_CATEGORIES);
      }
    );
  } catch {
    onUpdate(DEFAULT_COST_CATEGORIES);
    return () => {};
  }
}

// ==========================================
// KANBAN COLUMNS PERSISTENCE (Visitas y Seguimiento Empresas)
// ==========================================

export interface KanbanColumnConfig {
  id: string;
  label: string;
  color: string;
  description?: string;
}

export const DEFAULT_VISIT_COLUMNS: KanbanColumnConfig[] = [
  { id: 'primer_contacto', label: '1. Primer Contacto', color: '#3B82F6', description: 'Contacto inicial telefónico, WhatsApp o prospección' },
  { id: 'reunion', label: '2. Reunión / Visita', color: '#8B5CF6', description: 'Visita en planta/oficina o presentación en local' },
  { id: 'previo_cotizacion', label: '3. Previo a Cotización', color: '#F97316', description: 'Relevamiento de prendas, talles y muestras físicas' },
  { id: 'convertida', label: '4. Pasado a Seguimiento', color: '#10B981', description: 'Avanzado con éxito al tablero de Seguimiento Empresas' },
];

export const DEFAULT_COMPANY_COLUMNS: KanbanColumnConfig[] = [
  { id: 'cotizacion', label: 'Cotización Recibida', color: '#FDB813', description: 'Solicitud ingresada desde la web o mostrador' },
  { id: 'sena_50', label: 'Aprobado / Seña 50%', color: '#F97316', description: 'Confirmado por el cliente con pago de anticipo' },
  { id: 'produccion', label: 'En Bordados / Taller', color: '#8B5CF6', description: 'Prendas confeccionándose o estampándose' },
  { id: 'listo', label: 'Listo para Retirar', color: '#10B981', description: 'Control de calidad aprobado en sucursal' },
  { id: 'entregado', label: 'Entregado / Cerrado', color: '#3B82F6', description: 'Retirado por el cliente o despachado con remito' },
];

export async function saveKanbanColumns(config: { visits?: KanbanColumnConfig[]; companies?: KanbanColumnConfig[] }): Promise<boolean> {
  try {
    if (config.visits) {
      localStorage.setItem('pampero_kanban_visits_cols', JSON.stringify(config.visits));
    }
    if (config.companies) {
      localStorage.setItem('pampero_kanban_company_cols', JSON.stringify(config.companies));
    }
    const firestoreDb = db || getFirebaseDb();
    if (firestoreDb) {
      const docRef = doc(firestoreDb, 'store_config', 'kanban_columns');
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    return true;
  } catch (err) {
    console.error('[KANBAN COLUMNS SAVE ERROR]:', err);
    return false;
  }
}

export function subscribeToKanbanColumns(onUpdate: (data: { visits: KanbanColumnConfig[]; companies: KanbanColumnConfig[] }) => void): () => void {
  const getInitial = () => {
    let visits = DEFAULT_VISIT_COLUMNS;
    let companies = DEFAULT_COMPANY_COLUMNS;
    try {
      const v = localStorage.getItem('pampero_kanban_visits_cols');
      if (v) visits = JSON.parse(v);
      const c = localStorage.getItem('pampero_kanban_company_cols');
      if (c) companies = JSON.parse(c);
    } catch {}
    return {
      visits: (visits || DEFAULT_VISIT_COLUMNS).map(sanitizeObjectEncoding),
      companies: (companies || DEFAULT_COMPANY_COLUMNS).map(sanitizeObjectEncoding),
    };
  };

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) {
    onUpdate(getInitial());
    return () => {};
  }

  try {
    const docRef = doc(firestoreDb, 'store_config', 'kanban_columns');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rawVisits = Array.isArray(data?.visits) && data.visits.length > 0 ? data.visits : DEFAULT_VISIT_COLUMNS;
        const rawCompanies = Array.isArray(data?.companies) && data.companies.length > 0 ? data.companies : DEFAULT_COMPANY_COLUMNS;
        const visits = rawVisits.map(sanitizeObjectEncoding);
        const companies = rawCompanies.map(sanitizeObjectEncoding);
        localStorage.setItem('pampero_kanban_visits_cols', JSON.stringify(visits));
        localStorage.setItem('pampero_kanban_company_cols', JSON.stringify(companies));
        onUpdate({ visits, companies });
      } else {
        onUpdate(getInitial());
      }
    }, () => {
      onUpdate(getInitial());
    });
  } catch {
    onUpdate(getInitial());
    return () => {};
  }
}

// ==========================================
// DEDICATED LOOKBOOK PERSISTENCE (Cloud Firestore & Storage)
// ==========================================

export async function saveFirestoreLookbook(looks: LookbookItem[]): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !Array.isArray(looks)) return false;

  try {
    // 1. Save in store_config main doc
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    await setDoc(configDocRef, { lookbook: looks, updatedAt: new Date().toISOString() }, { merge: true });

    // 2. Also persist each look into dedicated 'lookbook' collection
    const batch = writeBatch(firestoreDb);
    looks.forEach((look, index) => {
      const lookId = look.id || `look-${index + 1}`;
      const docRef = doc(firestoreDb, 'lookbook', lookId);
      batch.set(docRef, { ...look, id: lookId, order: index + 1, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
    console.log('[FIREBASE] Lookbook guardado en Firestore exitosamente');
    return true;
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Error guardando lookbook en Firestore:', err);
    return false;
  }
}

export function subscribeToFirestoreLookbook(
  onUpdate: (looks: LookbookItem[]) => void
): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const colRef = collection(firestoreDb, 'lookbook');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: LookbookItem[] = [];
          snapshot.docs.forEach((d) => {
            items.push(d.data() as LookbookItem);
          });
          items.sort((a, b) => (a.order || 0) - (b.order || 0));
          onUpdate(items);
        }
      },
      (error) => {
        console.warn('[FIREBASE] Advertencia en listener de lookbook:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error suscribiendo a lookbook:', err);
    return () => {};
  }
}

// ==========================================
// DEDICATED UNIFORM SIMULATOR PERSISTENCE (Cloud Firestore & Storage)
// ==========================================

export async function saveFirestoreSimulatorConfig(simulatorConfig: any): Promise<boolean> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb || !simulatorConfig) return false;

  try {
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    await setDoc(configDocRef, { simulatorConfig, updatedAt: new Date().toISOString() }, { merge: true });

    const simDocRef = doc(firestoreDb, 'simulator_config', 'main');
    await setDoc(simDocRef, { ...simulatorConfig, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    console.log('[FIREBASE] Configuración del simulador guardada en Firestore');
    return true;
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Error guardando simulador en Firestore:', err);
    return false;
  }
}

export function subscribeToFirestoreSimulatorConfig(
  onUpdate: (config: any) => void
): () => void {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};

  try {
    const configDocRef = doc(firestoreDb, 'store_config', 'main');
    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.simulatorConfig) {
            onUpdate(data.simulatorConfig);
          }
        }
      },
      (error) => {
        console.warn('[FIREBASE] Advertencia en listener del simulador:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error suscribiendo a simulador:', err);
    return () => {};
  }
}






