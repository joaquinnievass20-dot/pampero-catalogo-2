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
    storage = getStorage(app);
    return storage;
  } catch (err) {
    console.warn('[FIREBASE STORAGE] Initialization warning:', err);
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
 * Uploads an image File, Blob, or base64 data URL EXCLUSIVELY to Firebase Storage
 * and returns the public accessible download URL with cache-busting timestamp.
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | Blob | string,
  folder: string = 'catalog'
): Promise<string> {
  const stor = storage || getFirebaseStorage();
  if (!stor) {
    throw new Error('Firebase Storage no disponible.');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  // If already an external persistent URL (and not base64 / blob / local upload), keep it
  if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) && !fileOrDataUrl.includes('/uploads/')) {
    return fileOrDataUrl;
  }

  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')) {
    // Base64 Data URL
    let ext = 'jpg';
    if (fileOrDataUrl.includes('image/png')) ext = 'png';
    else if (fileOrDataUrl.includes('image/webp')) ext = 'webp';
    const filePath = `${folder}/${timestamp}_${randomSuffix}.${ext}`;
    const storageRef = ref(stor, filePath);
    const result = await uploadString(storageRef, fileOrDataUrl, 'data_url');
    const downloadUrl = await getDownloadURL(result.ref);
    return `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}v=${timestamp}`;
  } else if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
    const originalName = (fileOrDataUrl as File).name || 'image.jpg';
    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${folder}/${timestamp}_${cleanName}`;
    const storageRef = ref(stor, filePath);
    const result = await uploadBytes(storageRef, fileOrDataUrl, {
      contentType: (fileOrDataUrl as File).type || 'image/jpeg',
    });
    const downloadUrl = await getDownloadURL(result.ref);
    return `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}v=${timestamp}`;
  } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('/uploads/')) {
    // Legacy local path migration: cannot re-read file if erased, return as-is
    return fileOrDataUrl;
  }

  throw new Error('Formato de imagen inválido para subir a Firebase Storage.');
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
    console.error('[FIREBASE] Error saving products batch to Firestore:', err);
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
  } catch (err) {
    console.error('[FIREBASE] Error updating store_config in Firestore:', err);
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


import { 
  INITIAL_CRM_ORDERS, 
  INITIAL_LEAD_VISITS, 
  INITIAL_SUPPLIER_ORDERS, 
  INITIAL_SIZING_CAMPAIGNS, 
  INITIAL_EMPLOYEE_SIZES 
} from '../data/initialCRMData';

// --- CRM FIREBASE INTEGRATION ---
export const saveCRMOrder = async (orderData: any) => {
  const firestoreDb = db || getFirebaseDb();
  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_orders') || '[]');
    const updated = [orderData, ...local.filter((o: any) => o.id !== orderData.id)];
    localStorage.setItem('pampero_crm_orders', JSON.stringify(updated));
  } catch {}

  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'crm_orders', orderData.id);
    await setDoc(docRef, { ...orderData, updatedAt: new Date().toISOString() }, { merge: true });
    console.log('[FIREBASE] CRM Order Saved:', orderData.id);
  } catch (err) {
    console.error('Error saving CRM order:', err);
  }
};

export const deleteCRMOrder = async (orderId: string) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_crm_orders') || '[]');
    const updated = local.filter((o: any) => o.id !== orderId);
    localStorage.setItem('pampero_crm_orders', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, 'crm_orders', orderId));
    console.log('[FIREBASE] CRM Order Deleted:', orderId);
  } catch (err) {
    console.error('Error deleting CRM order:', err);
  }
};

export const subscribeToCRMOrders = (onUpdate: (orders: any[]) => void) => {
  // 1. Initial immediate local or seed load
  try {
    const local = localStorage.getItem('pampero_crm_orders');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed);
      } else {
        onUpdate(INITIAL_CRM_ORDERS);
        localStorage.setItem('pampero_crm_orders', JSON.stringify(INITIAL_CRM_ORDERS));
      }
    } else {
      onUpdate(INITIAL_CRM_ORDERS);
      localStorage.setItem('pampero_crm_orders', JSON.stringify(INITIAL_CRM_ORDERS));
    }
  } catch {
    onUpdate(INITIAL_CRM_ORDERS);
  }

  // 2. Realtime listener from Firestore
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_orders');
  return onSnapshot(colRef, (snapshot) => {
    if (!snapshot.empty) {
      const orders = snapshot.docs.map(doc => doc.data() as any);
      localStorage.setItem('pampero_crm_orders', JSON.stringify(orders));
      onUpdate(orders);
    }
  }, (error) => {
    console.warn('Fallback CRM orders listener:', error);
  });
};

// --- LEADS & VISITAS COMERCIALES ---
export const saveLeadVisit = async (visitData: any) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_lead_visits') || '[]');
    const updated = [visitData, ...local.filter((v: any) => v.id !== visitData.id)];
    localStorage.setItem('pampero_lead_visits', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'crm_leads_visitas', visitData.id);
    await setDoc(docRef, { ...visitData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving lead visit:', err);
  }
};

export const deleteLeadVisit = async (visitId: string) => {
  try {
    const local = JSON.parse(localStorage.getItem('pampero_lead_visits') || '[]');
    const updated = local.filter((v: any) => v.id !== visitId);
    localStorage.setItem('pampero_lead_visits', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, 'crm_leads_visitas', visitId));
  } catch (err) {
    console.error('Error deleting lead visit:', err);
  }
};

export const subscribeToLeadVisits = (onUpdate: (visits: any[]) => void) => {
  try {
    const local = localStorage.getItem('pampero_lead_visits');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) onUpdate(parsed);
      else onUpdate(INITIAL_LEAD_VISITS);
    } else {
      onUpdate(INITIAL_LEAD_VISITS);
    }
  } catch {
    onUpdate(INITIAL_LEAD_VISITS);
  }

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_leads_visitas');
  return onSnapshot(colRef, (snapshot) => {
    if (!snapshot.empty) {
      const visits = snapshot.docs.map(doc => doc.data() as any);
      localStorage.setItem('pampero_lead_visits', JSON.stringify(visits));
      onUpdate(visits);
    }
  }, (error) => {
    console.warn('Error listening to lead visits:', error);
  });
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

export const subscribeToSizingCampaigns = (onUpdate: (campaigns: any[]) => void) => {
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

export const subscribeToEmployeeSizeEntries = (campaignId: string, onUpdate: (entries: any[]) => void) => {
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

  // Keep local backup as safety
  try {
    const local: RegisteredUser[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
    const updated = [sanitizedUser, ...local.filter((u) => u.id !== userId && u.email?.toLowerCase() !== user.email?.toLowerCase())];
    localStorage.setItem('pampero_registered_users', JSON.stringify(updated));
  } catch {}

  if (!firestoreDb) {
    return { success: true };
  }

  try {
    const docRef = doc(firestoreDb, 'usuarios', userId);
    const cleaned = JSON.parse(JSON.stringify(sanitizedUser, (k, v) => (v === undefined ? null : v)));
    await setDoc(docRef, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true });

    // Also mirror to 'users' collection for international consistency
    const docRefMirror = doc(firestoreDb, 'users', userId);
    await setDoc(docRefMirror, { ...cleaned, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    console.log('[FIREBASE] Registered User Saved in Cloud Firestore:', sanitizedUser.email || userId);
    return { success: true };
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Could not save user to Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
};

export const deleteFirestoreUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const local: RegisteredUser[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
    const updated = local.filter((u) => u.id !== userId);
    localStorage.setItem('pampero_registered_users', JSON.stringify(updated));
  } catch {}

  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return { success: true };

  try {
    await deleteDoc(doc(firestoreDb, 'usuarios', userId));
    await deleteDoc(doc(firestoreDb, 'users', userId)).catch(() => {});
    console.log('[FIREBASE] User Deleted from Cloud Firestore:', userId);
    return { success: true };
  } catch (err: any) {
    console.error('[FIREBASE ERROR] Could not delete user from Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
};

export const subscribeToFirestoreUsers = (
  onUpdate: (users: RegisteredUser[]) => void
): () => void => {
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
      (error) => {
        console.warn('[FIREBASE] Real-time users listener offline notice:', error.message);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    console.warn('[FIREBASE] Error subscribing to usuarios:', err?.message || err);
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



