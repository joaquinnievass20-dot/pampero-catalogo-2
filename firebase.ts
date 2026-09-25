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
  Product,
  Promotion,
  ThemeConfig,
  BranchLocation,
  DiscountCoupon,
  VolumeDiscountRule,
  CategoryHierarchyItem,
  LookbookItem,
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

try {
  db = createFirestoreInstance();
  isInitialized = db !== null;
  if (db) {
    console.log('[FIREBASE] Cloud Firestore connected to project:', firebaseConfig.projectId);
  }
} catch (error) {
  console.warn('[FIREBASE] Initialization warning (offline/fallback mode):', error);
  db = null;
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


// --- CRM FIREBASE INTEGRATION ---
export const saveCRMOrder = async (orderData: any) => {
  const firestoreDb = db || getFirebaseDb();
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
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_orders');
  return onSnapshot(colRef, (snapshot) => {
    const orders = snapshot.docs.map(doc => doc.data() as any);
    onUpdate(orders);
  }, (error) => {
    console.error('Error listening to CRM orders:', error);
  });
};

// --- LEADS & VISITAS COMERCIALES ---
export const saveLeadVisit = async (visitData: any) => {
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
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, 'crm_leads_visitas', visitId));
  } catch (err) {
    console.error('Error deleting lead visit:', err);
  }
};

export const subscribeToLeadVisits = (onUpdate: (visits: any[]) => void) => {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_leads_visitas');
  return onSnapshot(colRef, (snapshot) => {
    const visits = snapshot.docs.map(doc => doc.data() as any);
    onUpdate(visits);
  }, (error) => {
    console.error('Error listening to lead visits:', error);
  });
};

// --- PEDIDOS A PROVEEDOR (MACATA / PAMPERO CENTRAL) ---
export const saveSupplierOrder = async (orderData: any) => {
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
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, 'crm_pedidos_proveedor', orderId));
  } catch (err) {
    console.error('Error deleting supplier order:', err);
  }
};

export const subscribeToSupplierOrders = (onUpdate: (orders: any[]) => void) => {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_pedidos_proveedor');
  return onSnapshot(colRef, (snapshot) => {
    const orders = snapshot.docs.map(doc => doc.data() as any);
    onUpdate(orders);
  }, (error) => {
    console.error('Error listening to supplier orders:', error);
  });
};

// --- PORTAL DE TALLES EMPRESARIAL ---
export const saveSizingCampaign = async (campaignData: any) => {
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
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_sizing_campaigns');
  return onSnapshot(colRef, (snapshot) => {
    const campaigns = snapshot.docs.map(doc => doc.data() as any);
    onUpdate(campaigns);
  }, (error) => {
    console.error('Error listening to sizing campaigns:', error);
  });
};

export const saveEmployeeSizeEntry = async (entryData: any) => {
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
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return () => {};
  const colRef = collection(firestoreDb, 'crm_employee_sizes');
  return onSnapshot(colRef, (snapshot) => {
    const all = snapshot.docs.map(doc => doc.data() as any);
    const filtered = campaignId === 'all' ? all : all.filter(e => e.campaignId === campaignId);
    onUpdate(filtered);
  }, (error) => {
    console.error('Error listening to employee size entries:', error);
  });
};

