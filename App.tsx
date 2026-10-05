import React, { useState, useEffect } from 'react';
import { 
  Product, 
  Promotion, 
  ThemeConfig, 
  BranchLocation, 
  UserSession, 
  CartItem, 
  MainCategory,
  DiscountCoupon,
  LookbookItem,
  CategoryHierarchyItem,
  VolumeDiscountRule
} from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_PROMOTIONS, 
  INITIAL_THEME, 
  INITIAL_BRANCHES,
  INITIAL_COUPONS
} from './data/initialData';
import { INITIAL_LOOKBOOK } from './data/initialLookbook';
import { INITIAL_CATEGORY_HIERARCHY } from './data/categories';
import { 
  saveCatalogBackup, 
  loadCatalogBackup, 
  isServerCatalogReset, 
  syncBackupToServer 
} from './utils/backupManager';
import {
  isFirebaseReady,
  fetchFirestoreProducts,
  saveFirestoreProducts,
  fetchFirestoreStoreConfig,
  saveFirestoreStoreConfig,
  subscribeToFirestoreStoreConfig,
  subscribeToFirestoreProducts,
  db,
  getFirebaseDb,
} from './services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { ensureMasterAdminInitialized } from './utils/authInit';
import { trackAddToCart } from './utils/analytics';
import { LandingHero } from './components/LandingHero';
import { CatalogView } from './components/CatalogView';
import { ProductDetailView } from './components/ProductDetailView';
import { LookbookView } from './components/LookbookView';
import { AuthView } from './components/AuthView';
import { AdminPanel } from './components/AdminPanel';
import { CRMView } from './components/crm/CRMView';
import { ClientUniformSimulatorView } from './components/client/ClientUniformSimulatorView';
import { ClientSizingPortalView } from './components/client/ClientSizingPortalView';
import { HubView } from './components/HubView';
import { QuoteDrawer } from './components/QuoteDrawer';
import { UserProfileModal } from './components/UserProfileModal';
import { Footer } from './components/Footer';
import { PamperoLogo } from './components/PamperoLogo';
import { CategoryMenuNav } from './components/CategoryMenuNav';
import { UserNavMenu } from './components/UserNavMenu';
import { CorporateServicesDropdown } from './components/CorporateServicesDropdown';
import { 
  Settings, 
  ShoppingBag, 
  MessageCircle, 
  LogOut, 
  User as UserIcon,
  Tag,
  Search,
  Sparkles,
  Shirt,
  LayoutDashboard
} from 'lucide-react';

export default function App() {
  // Category sanitizer to ensure categories are cleanly mapped without inventing values for empty fields
  const sanitizeCategory = (rawCat: any): MainCategory => {
    if (!rawCat || !String(rawCat).trim()) return '' as MainCategory;
    const str = String(rawCat).trim();
    if (str === 'Mujer' || str === '1') return 'Mujer';
    if (str === 'Infantil' || str === '2') return 'Infantil';
    if (str === 'Venta Corporativa' || str === '3') return 'Venta Corporativa';
    if (str === 'Hombre') return 'Hombre';
    const s = str.toLowerCase();
    if (s.includes('mujer')) return 'Mujer';
    if (s.includes('infan') || s.includes('niñ')) return 'Infantil';
    if (s.includes('corp') || s.includes('venta')) return 'Venta Corporativa';
    return str as MainCategory;
  };

  // 1. Theme Configuration
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('pampero_theme_config');
      return saved ? JSON.parse(saved) : INITIAL_THEME;
    } catch {
      return INITIAL_THEME;
    }
  });

  // Sync theme CSS variables and global font to document and :root
  useEffect(() => {
    const selectedFont = theme.fontFamily || 'Montserrat';

    // 1. Set font-family directly on body and document
    document.body.style.fontFamily = `'${selectedFont}', sans-serif`;
    document.documentElement.style.fontFamily = `'${selectedFont}', sans-serif`;
    document.documentElement.style.setProperty('--font-family', `'${selectedFont}', sans-serif`);
    document.documentElement.style.setProperty('--font-display', `'${selectedFont}', sans-serif`);

    // 2. Ensure Google Font stylesheet is loaded dynamically
    const fontLinkId = 'pampero-dynamic-font';
    let linkEl = document.getElementById(fontLinkId) as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = fontLinkId;
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }
    const fontQuery = encodeURIComponent(selectedFont).replace(/%20/g, '+');
    linkEl.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;

    if (theme.backgroundColor) {
      document.documentElement.style.setProperty('--background', theme.backgroundColor);
    }
    if (theme.textColor) {
      document.documentElement.style.setProperty('--foreground', theme.textColor);
    }
    if (theme.accentColor) {
      document.documentElement.style.setProperty('--accent', theme.accentColor);
    }
    if (theme.headerBgColor) {
      document.documentElement.style.setProperty('--primary', theme.headerBgColor);
    }
    if (theme.seasonBadgeBg) {
      document.documentElement.style.setProperty('--season-badge-bg', theme.seasonBadgeBg);
    }
    if (theme.seasonBadgeText) {
      document.documentElement.style.setProperty('--season-badge-text', theme.seasonBadgeText);
    }
    if (theme.discountBadgeBg) {
      document.documentElement.style.setProperty('--discount-badge-bg', theme.discountBadgeBg);
    }
    if (theme.discountBadgeText) {
      document.documentElement.style.setProperty('--discount-badge-text', theme.discountBadgeText);
    }
  }, [theme]);

  // 2. Catalog Products State (initialized from indestructible local backup or defaults)
  const [products, setProducts] = useState<Product[]>(() => {
    const backup = loadCatalogBackup();
    if (backup && backup.length > 0) {
      return backup;
    }
    return INITIAL_PRODUCTS;
  });

  // Global search query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Real-time catalog & store synchronization function (Cloud Firestore + Express Server)
  const syncFromServer = async () => {
    // 1. Cloud Firestore: Authoritative for persistent storage across Vercel & devices
    if (isFirebaseReady()) {
      try {
        const firestoreProds = await fetchFirestoreProducts();
        if (firestoreProds && firestoreProds.length > 0) {
          const sanitized = firestoreProds.map((p: Product) => ({
            ...p,
            category: sanitizeCategory(p.category),
            section: p.section || '',
            subCategory: p.subCategory || '',
          }));
          setProducts(sanitized);
          saveCatalogBackup(sanitized);
        } else {
          // If Firestore is empty on the first run, seed it with default products
          console.log('[FIREBASE] Cloud Firestore vacío detectado. Sembrando catálogo inicial en la nube...');
          const initialCatalog = loadCatalogBackup() || INITIAL_PRODUCTS;
          saveFirestoreProducts(initialCatalog);
        }

        const firestoreConfig = await fetchFirestoreStoreConfig();
        if (firestoreConfig) {
          if (firestoreConfig.theme) {
            setTheme(firestoreConfig.theme);
            try {
              localStorage.setItem('pampero_theme_config', JSON.stringify(firestoreConfig.theme));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.promotions) && firestoreConfig.promotions.length > 0) {
            setPromotions(firestoreConfig.promotions);
            try {
              localStorage.setItem('pampero_catalog_promos', JSON.stringify(firestoreConfig.promotions));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.branches) && firestoreConfig.branches.length > 0) {
            setBranches(firestoreConfig.branches);
            try {
              localStorage.setItem('pampero_catalog_branches', JSON.stringify(firestoreConfig.branches));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.coupons)) {
            setCoupons(firestoreConfig.coupons);
            try {
              localStorage.setItem('pampero_discount_coupons', JSON.stringify(firestoreConfig.coupons));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.categories) && firestoreConfig.categories.length > 0) {
            setCategories(firestoreConfig.categories);
            try {
              localStorage.setItem('pampero_catalog_categories', JSON.stringify(firestoreConfig.categories));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.volumeDiscounts) && firestoreConfig.volumeDiscounts.length > 0) {
            setVolumeDiscounts(firestoreConfig.volumeDiscounts);
            try {
              localStorage.setItem('pampero_volume_discounts', JSON.stringify(firestoreConfig.volumeDiscounts));
            } catch {}
          }
          if (Array.isArray(firestoreConfig.lookbook) && firestoreConfig.lookbook.length > 0) {
            setLookbook(firestoreConfig.lookbook);
            try {
              localStorage.setItem('pampero_catalog_lookbook', JSON.stringify(firestoreConfig.lookbook));
            } catch {}
          }
        } else {
          // Seed store configuration to Cloud Firestore
          saveFirestoreStoreConfig({
            categories: INITIAL_CATEGORY_HIERARCHY,
            promotions: INITIAL_PROMOTIONS,
            theme: INITIAL_THEME,
            branches: INITIAL_BRANCHES,
            coupons: INITIAL_COUPONS,
            lookbook: INITIAL_LOOKBOOK,
          });
        }
      } catch (_fErr) {
        // Silent fallback to keep console clean and avoid spamming errors
      }
    }
  };

  // Sync products and store configuration in real-time across all devices and tabs
  useEffect(() => {
    // 0. Ensure Master Admin Account ALWAYS exists (even on clean state / Vercel deployment)
    ensureMasterAdminInitialized();

    // Initial sync once on mount
    syncFromServer();

    // Real-time Firestore configuration updates listener
    const unsubscribeFirestore = subscribeToFirestoreStoreConfig((remoteConfig) => {
      if (remoteConfig.theme) setTheme(remoteConfig.theme);
      if (Array.isArray(remoteConfig.promotions) && remoteConfig.promotions.length > 0) setPromotions(remoteConfig.promotions);
      if (Array.isArray(remoteConfig.categories) && remoteConfig.categories.length > 0) setCategories(remoteConfig.categories);
      if (Array.isArray(remoteConfig.volumeDiscounts) && remoteConfig.volumeDiscounts.length > 0) setVolumeDiscounts(remoteConfig.volumeDiscounts);
      if (Array.isArray(remoteConfig.branches) && remoteConfig.branches.length > 0) setBranches(remoteConfig.branches);
      if (Array.isArray(remoteConfig.coupons)) setCoupons(remoteConfig.coupons);
      if (Array.isArray(remoteConfig.lookbook)) setLookbook(remoteConfig.lookbook);
    });

    // Real-time Firestore products listener for instant cross-device image & catalog sync
    const unsubscribeProducts = subscribeToFirestoreProducts((remoteProducts) => {
      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        const sanitized = remoteProducts.map((p) => ({
          ...p,
          category: sanitizeCategory(p.category),
          section: p.section || '',
          subCategory: p.subCategory || '',
        }));
        setProducts(sanitized);
        saveCatalogBackup(sanitized);
      }
    });

    // Revalidate on window focus (e.g. when user returns to tab or opens browser)
    const handleFocus = () => {
      syncFromServer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeFirestore();
      unsubscribeProducts();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 3. Promotions State
  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_promos');
      return saved ? JSON.parse(saved) : INITIAL_PROMOTIONS;
    } catch {
      return INITIAL_PROMOTIONS;
    }
  });

  // 4. Mendoza Branches State
  const [branches, setBranches] = useState<BranchLocation[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_branches');
      return saved ? JSON.parse(saved) : INITIAL_BRANCHES;
    } catch {
      return INITIAL_BRANCHES;
    }
  });

  // 5. Discount Coupons State
  const [coupons, setCoupons] = useState<DiscountCoupon[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_discount_coupons');
      return saved ? JSON.parse(saved) : INITIAL_COUPONS;
    } catch {
      return INITIAL_COUPONS;
    }
  });

  // 6. User Session - strictly null at initial start as requested
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  // Helper functions for isolated cart persistence per active user ID
  const getCartStorageKey = (session: UserSession | null): string => {
    if (session?.id) return `pampero_cart_${session.id}`;
    if (session?.email) return `pampero_cart_${session.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return 'pampero_cart_guest';
  };

  const loadCartFromStorage = (session: UserSession | null): CartItem[] => {
    try {
      const key = getCartStorageKey(session);
      const saved = localStorage.getItem(key);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((it: any) => it && it.product && typeof it.product === 'object' && it.quantity > 0);
      }
      return [];
    } catch {
      return [];
    }
  };

  // 7. Quotation Cart (isolated per user ID, guest fallback)
  const [cart, setCart] = useState<CartItem[]>(() => {
    return loadCartFromStorage(null);
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Lookbook State
  const [lookbook, setLookbook] = useState<LookbookItem[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_lookbook');
      return saved ? JSON.parse(saved) : INITIAL_LOOKBOOK;
    } catch {
      return INITIAL_LOOKBOOK;
    }
  });

  // Dynamic Categories & Hierarchy State
  const [categories, setCategories] = useState<CategoryHierarchyItem[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_CATEGORY_HIERARCHY;
  });

  // Volume Discounts Rules State
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscountRule[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_volume_discounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'vol-1',
        name: 'Mayorista +10 Unidades',
        minQuantity: 10,
        discountPercentage: 10,
        category: 'Todas',
        applicableCategory: 'ALL',
        active: true,
        isActive: true,
      },
      {
        id: 'vol-2',
        name: 'Corporativo Industrial +20 Unid.',
        minQuantity: 20,
        discountPercentage: 15,
        category: 'Venta Corporativa',
        applicableCategory: 'Venta Corporativa',
        active: true,
        isActive: true,
      }
    ];
  });

  // 8. Navigation State
  // View Modes:
  // 'landing' -> Hero with sliding covers & category cards (Screenshot 2)
  // 'auth'    -> Login / Register / Admin Login (Screenshot 1)
  // 'catalog' -> Full catalog with sidebar lines, colors, sort & grid (Screenshot 3)
  // 'product_detail' -> Product detail (Screenshot 4)
  // 'admin'   -> Admin panel (requires admin authentication)
  // 'lookbook' -> Interactive campaign lookbook with hotspots
  // 'crm'      -> Internal Kanban management system
  // 'uniform_simulator' -> Client 3D / live uniform embroidery simulator
  // 'sizing_portal'     -> Client digital employee sizing portal
  // 'hub'               -> Internal staff & admin hub with large action cards
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'catalog' | 'product_detail' | 'admin' | 'lookbook' | 'crm' | 'uniform_simulator' | 'sizing_portal' | 'hub'>('landing');
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register' | 'admin'>('register');
  const [authInitialType, setAuthInitialType] = useState<'consumidor' | 'empresa'>('consumidor');

  // Filtering & Selected Product
  const [currentCategory, setCurrentCategory] = useState<MainCategory>('Hombre');
  const [currentSection, setCurrentSection] = useState<string>('Todos');
  const [currentSubCategory, setCurrentSubCategory] = useState<string>('Todos');
  const [activePromoFilter, setActivePromoFilter] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Quote Drawer
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Persist handlers - Writes directly to Cloud Firestore & updates local state
  const handleUpdateProducts = async (newProducts: Product[]) => {
    const sanitized = newProducts.map((p) => ({
      ...p,
      category: sanitizeCategory(p.category),
    }));
    setProducts(sanitized);
    saveCatalogBackup(sanitized);

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreProducts(sanitized);
  };

  const handleDeleteProduct = async (id: string) => {
    const targetId = String(id || '').trim();

    try {
      const firestoreDb = db || getFirebaseDb();
      if (firestoreDb && targetId) {
        // deleteDoc(doc(db, 'productos', id)) con timeout para evitar congelamiento si la conexión se cuelga
        await Promise.race([
          (async () => {
            await deleteDoc(doc(firestoreDb, 'productos', targetId)).catch(() => {});
            await deleteDoc(doc(firestoreDb, 'products', targetId)).catch(() => {});
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout en llamada deleteDoc de Firestore')), 2000)
          ),
        ]);
      }
    } catch (error) {
      console.warn('[FIREBASE] Error al eliminar documento en backend (forzando eliminación en UI):', error);
      // Crucial: Si deleteDoc falla (porque el ID está corrupto o es de la base vieja),
      // el bloque catch DEBE forzar la eliminación del producto del estado local de React
      setProducts((prev) => {
        const remaining = prev.filter((p) => p.id !== id && String(p.id || '').trim() !== targetId && String(p.code || '').trim() !== targetId);
        saveCatalogBackup(remaining);
        return remaining;
      });
    } finally {
      // El bloque catch o finally DEBE forzar la eliminación del producto del estado local de React
      // (setProducts(prev => prev.filter(p => p.id !== id))) para que desaparezcan visualmente de la tabla sí o sí al apretar el botón
      setProducts((prev) => {
        const remaining = prev.filter((p) => {
          const pId = String(p.id || '').trim();
          const pCode = String(p.code || '').trim();
          const pName = String(p.name || '').trim();
          return p.id !== id && pId !== id && pId !== targetId && pCode !== id && pCode !== targetId && (targetId ? pName !== targetId : true);
        });
        saveCatalogBackup(remaining);
        return remaining;
      });
    }
  };

  const handleUpdatePromotions = async (newPromos: Promotion[]) => {
    setPromotions(newPromos);
    try {
      localStorage.setItem('pampero_catalog_promos', JSON.stringify(newPromos));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ promotions: newPromos });
  };

  const handleUpdateTheme = async (newTheme: ThemeConfig) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('pampero_theme_config', JSON.stringify(newTheme));
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(newTheme));
      if (newTheme.customLogoUrl) {
        localStorage.setItem('pampero_custom_logo', newTheme.customLogoUrl);
      }
      if (newTheme.logoHeight) {
        localStorage.setItem('pampero_logo_height', newTheme.logoHeight.toString());
      }
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ theme: newTheme });
  };

  const handleUpdateBranches = async (newBranches: BranchLocation[]) => {
    setBranches(newBranches);
    try {
      localStorage.setItem('pampero_catalog_branches', JSON.stringify(newBranches));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ branches: newBranches });
  };

  const handleUpdateCoupons = async (newCoupons: DiscountCoupon[]) => {
    setCoupons(newCoupons);
    try {
      localStorage.setItem('pampero_discount_coupons', JSON.stringify(newCoupons));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ coupons: newCoupons });
  };

  const handleUpdateLookbook = async (newLookbook: LookbookItem[]) => {
    setLookbook(newLookbook);
    try {
      localStorage.setItem('pampero_catalog_lookbook', JSON.stringify(newLookbook));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ lookbook: newLookbook });
  };

  const handleUpdateCategories = async (newCategories: CategoryHierarchyItem[]) => {
    setCategories(newCategories);
    try {
      localStorage.setItem('pampero_catalog_categories', JSON.stringify(newCategories));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ categories: newCategories });
  };

  const handleUpdateVolumeDiscounts = async (newDiscounts: VolumeDiscountRule[]) => {
    setVolumeDiscounts(newDiscounts);
    try {
      localStorage.setItem('pampero_volume_discounts', JSON.stringify(newDiscounts));
    } catch {}

    // Persist to Cloud Firestore via Firebase SDK
    saveFirestoreStoreConfig({ volumeDiscounts: newDiscounts });
  };

  const handleLogin = (session: UserSession) => {
    setUserSession(session);
    localStorage.setItem('pampero_user_session', JSON.stringify(session));

    // Cargar carrito específico del usuario autenticado
    const userCart = loadCartFromStorage(session);
    setCart(userCart);

    if (session.role === 'admin' || session.role === 'employee' || session.email?.toLowerCase() === 'joaquinnievass20@gmail.com') {
      setViewMode('hub');
    } else {
      setViewMode('catalog');
    }
  };

  const handleLogout = () => {
    // Aislamiento del Carrito: Vaciar y limpiar caché del carrito del usuario activo y temporal
    const currentKey = getCartStorageKey(userSession);
    try {
      localStorage.removeItem(currentKey);
      localStorage.removeItem('pampero_cart_guest');
      localStorage.removeItem('pampero_quote_cart');
    } catch {}

    setCart([]);
    setUserSession(null);
    localStorage.removeItem('pampero_user_session');
    setViewMode('landing');
  };

  // Cart operations (isolated per active user key)
  const handleAddToCart = (
    product: Product,
    quantity = 1,
    color?: string,
    size?: string,
    specialSizeRange?: any,
    unitPriceAdjusted?: number,
    codeWithSuffix?: string
  ) => {
    trackAddToCart({
      product,
      quantity,
      size,
      color,
      unitPrice: unitPriceAdjusted ?? product.price,
    });

    setCart((prev) => {
      const targetCode = codeWithSuffix || (specialSizeRange?.suffix ? `${product.code}${specialSizeRange.suffix}` : product.code);
      const idx = prev.findIndex(
        (it) => it.product.id === product.id && 
                it.selectedColor === color && 
                it.selectedSize === size && 
                (it.codeWithSuffix || it.product.code) === targetCode
      );
      let updated: CartItem[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx].quantity += quantity;
      } else {
        updated = [
          ...prev,
          {
            product,
            quantity,
            selectedColor: color || product.availableColors?.[0] || 'Estándar',
            selectedSize: size || product.availableSizes?.[0] || 'Único',
            specialSizeRange,
            unitPriceAdjusted,
            codeWithSuffix: targetCode,
          },
        ];
      }
      try {
        const storageKey = getCartStorageKey(userSession);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleUpdateCartQuantity = (
    productId: string,
    delta: number,
    color?: string,
    size?: string,
    codeWithSuffix?: string
  ) => {
    setCart((prev) => {
      const updated = prev
        .map((it) => {
          const matchProduct = it.product.id === productId;
          const matchColor = !color || it.selectedColor === color;
          const matchSize = !size || it.selectedSize === size;
          const matchCode = !codeWithSuffix || (it.codeWithSuffix || it.product.code) === codeWithSuffix;
          if (matchProduct && matchColor && matchSize && matchCode) {
            const newQ = it.quantity + delta;
            return newQ > 0 ? { ...it, quantity: newQ } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[];
      try {
        const storageKey = getCartStorageKey(userSession);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRemoveFromCart = (
    productId: string,
    color?: string,
    size?: string,
    codeWithSuffix?: string
  ) => {
    setCart((prev) => {
      const updated = prev.filter((it) => {
        const matchProduct = it.product.id === productId;
        const matchColor = !color || it.selectedColor === color;
        const matchSize = !size || it.selectedSize === size;
        const matchCode = !codeWithSuffix || (it.codeWithSuffix || it.product.code) === codeWithSuffix;
        return !(matchProduct && matchColor && matchSize && matchCode);
      });
      try {
        const storageKey = getCartStorageKey(userSession);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    try {
      const storageKey = getCartStorageKey(userSession);
      localStorage.removeItem(storageKey);
      localStorage.removeItem('pampero_cart_guest');
    } catch {}
  };

  // Navigation: Open Auth with specific config
  const openAuthScreen = (tab: 'login' | 'register' | 'admin' = 'register', type: 'consumidor' | 'empresa' = 'consumidor') => {
    setAuthInitialTab(tab);
    setAuthInitialType(type);
    setViewMode('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigation: Open Catalog
  const openCatalogScreen = (promoFilter?: string | null, categoryFilter?: MainCategory | null) => {
    if (!userSession) {
      openAuthScreen('register', categoryFilter === 'Venta Corporativa' ? 'empresa' : 'consumidor');
      return;
    }
    if (categoryFilter) {
      setCurrentCategory(categoryFilter);
    }
    if (promoFilter) {
      setActivePromoFilter(promoFilter);
    } else {
      setActivePromoFilter(null);
    }
    setCurrentSection('Todos');
    setCurrentSubCategory('Todos');
    setViewMode('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Product Detail
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('product_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalCartCount = cart.reduce((acc, it) => acc + it.quantity, 0);

  const categoriesList: MainCategory[] = ['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2EC] text-[#22201D] font-sans antialiased selection:bg-[#FDB813] selection:text-black">
      
      {/* Top Header shown on Catalog and Product Detail (Screenshot 3 & 4) */}
      {(viewMode === 'catalog' || viewMode === 'product_detail') && (
        <header className="sticky top-0 z-50 bg-white border-b border-[#DCD4C9] shadow-xs">
          {/* Top Micro Announcement */}
          <div 
            style={{ 
              backgroundColor: theme.primaryColor || '#18231C',
              color: theme.primaryTextColor || '#F5F2EC'
            }}
            className="text-[10px] sm:text-[11px] py-1.5 px-4 flex items-center justify-center gap-3 uppercase tracking-[0.25em] font-medium select-none"
          >
            <span>CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO</span>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            {/* Logo con tamaño bloqueado estrictamente por CSS */}
            <div
              className="cursor-pointer shrink-0"
              onClick={() => setViewMode('landing')}
              title="Volver a la portada principal"
            >
              <img 
                src="/logo-oficial.png.png" 
                alt="Pampero Oficial" 
                className="h-14 w-auto object-contain shrink-0" 
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + '/logo.png') {
                    e.currentTarget.src = '/logo.png';
                  }
                }}
              />
            </div>

            {/* Center Category Navigation with persistent mega-menu dropdown */}
            <div className="hidden lg:flex items-center gap-4">
              <CategoryMenuNav
                currentCategory={currentCategory}
                activePromoFilter={activePromoFilter}
                categoriesHierarchy={categories}
                onSelectCategoryItem={(cat, sec, sub) => {
                  setCurrentCategory(cat);
                  setCurrentSection(sec || 'Todos');
                  setCurrentSubCategory(sub || 'Todos');
                  setActivePromoFilter(null);
                  setViewMode('catalog');
                }}
                onSelectPromo={(tag) => {
                  setActivePromoFilter(tag);
                  setViewMode('catalog');
                }}
                theme={theme}
              />
              <CorporateServicesDropdown
                onOpenLookbook={() => setViewMode('lookbook')}
                onOpenSizingPortal={() => setViewMode('sizing_portal')}
                onOpenUniformSimulator={() => setViewMode('uniform_simulator')}
                theme={theme}
              />
            </div>

            {/* Quick Product Search in Header */}
            <div className="relative hidden md:flex items-center flex-1 max-w-xs mx-2">
              <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (viewMode !== 'catalog') setViewMode('catalog');
                }}
                placeholder="Buscar artículos..."
                className="w-full pl-8.5 pr-7 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] placeholder-[#8C827A] focus:outline-none focus:border-[#FDB813] transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#8C827A] hover:text-[#18231C] text-xs font-bold p-0.5 cursor-pointer"
                  title="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Right User & Quote Actions - Harmonized Dropdown Menu */}
            <UserNavMenu
              userSession={userSession}
              cartCount={totalCartCount}
              onOpenCart={() => setIsCartOpen(true)}
              onOpenAuth={() => openAuthScreen('login', 'consumidor')}
              onLogout={handleLogout}
              onOpenAdmin={() => setViewMode('admin')}
              onOpenCRM={() => setViewMode('crm')}
              onOpenHub={() => setViewMode('hub')}
              onOpenUniformSimulator={() => setViewMode('uniform_simulator')}
              onOpenSizingPortal={() => setViewMode('sizing_portal')}
              onOpenProfile={() => setIsProfileOpen(true)}
              theme={theme}
            />
          </div>
        </header>
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {/* VIEW 1: LANDING PAGE (Screenshot 2: Hero with sliding covers) */}
        {viewMode === 'landing' && (
          <LandingHero
            userSession={userSession}
            theme={theme}
            promotions={promotions}
            categoriesHierarchy={categories}
            onOpenAuth={openAuthScreen}
            onSelectCategory={(cat) => openCatalogScreen(null, cat)}
            onOpenCatalog={(promo, cat) => openCatalogScreen(promo, cat)}
            cartCount={totalCartCount}
            onOpenCart={() => setIsCartOpen(true)}
            onLogout={handleLogout}
            onOpenAdmin={() => setViewMode('admin')}
            onOpenCRM={() => setViewMode('crm')}
            onOpenHub={() => setViewMode('hub')}
            onOpenUniformSimulator={() => setViewMode('uniform_simulator')}
            onOpenSizingPortal={() => setViewMode('sizing_portal')}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenLookbook={() => setViewMode('lookbook')}
          />
        )}

        {/* VIEW 2: AUTH SCREEN (Screenshot 1: Pixel match, Consumer/Company tabs + Admin login) */}
        {viewMode === 'auth' && (
          <AuthView
            initialMode={authInitialTab}
            initialType={authInitialType}
            theme={theme}
            onLogin={handleLogin}
            onBackToHome={() => setViewMode('landing')}
          />
        )}

        {/* VIEW 3: CATALOG VIEW (Screenshot 3: Lines sidebar, colors, sort, 4-col products) */}
        {viewMode === 'catalog' && (
          <CatalogView
            currentCategory={currentCategory}
            onSelectCategory={setCurrentCategory}
            currentSection={currentSection}
            onSelectSection={setCurrentSection}
            currentSubCategory={currentSubCategory}
            onSelectSubCategory={setCurrentSubCategory}
            products={products}
            categoryHierarchy={categories}
            userSession={userSession}
            theme={theme}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onViewProduct={handleSelectProduct}
            onViewProductDetail={handleSelectProduct}
            onQuickAdd={(prod) => handleAddToCart(prod, 1)}
            onBackToHome={() => setViewMode('landing')}
            activePromoFilter={activePromoFilter}
            onClearPromoFilter={() => setActivePromoFilter(null)}
            onOpenPromos={() => setActivePromoFilter('Promoción')}
          />
        )}

        {/* VIEW 4: PRODUCT DETAIL VIEW (Screenshot 4: Back button, square photo, colors, sizes, WhatsApp) */}
        {viewMode === 'product_detail' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            userSession={userSession}
            theme={theme}
            onBackToCatalog={() => setViewMode('catalog')}
            onAddToCart={(prod, col, sz) => handleAddToCart(prod, 1, col, sz)}
          />
        )}

        {/* VIEW 5: LOOKBOOK INTERACTIVE VIEW */}
        {viewMode === 'lookbook' && (
          <LookbookView
            lookbook={lookbook}
            products={products}
            theme={theme}
            onBackToStore={() => setViewMode('catalog')}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(prod) => handleAddToCart(prod, 1)}
          />
        )}

        {/* VIEW 6: ADMIN PANEL (Protected with password) */}
        {viewMode === 'admin' && (
          <AdminPanel
            isOpen={true}
            products={products}
            promotions={promotions}
            theme={theme}
            branches={branches}
            coupons={coupons}
            lookbook={lookbook}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            onUpdateProducts={handleUpdateProducts}
            onDeleteProduct={handleDeleteProduct}
            onUpdatePromotions={handleUpdatePromotions}
            onUpdateTheme={handleUpdateTheme}
            onUpdateBranches={handleUpdateBranches}
            onUpdateCoupons={handleUpdateCoupons}
            onUpdateLookbook={handleUpdateLookbook}
            userSession={userSession}
            onClose={() => setViewMode('hub')}
            onSelectPromoFilter={(promo) => {
              setActivePromoFilter(promo.tagFilter || promo.title);
              setViewMode('catalog');
            }}
          />
        )}
      

          {/* VIEW 7: CRM DASHBOARD */}
          {viewMode === 'crm' && (
            <CRMView
              userSession={userSession}
              onClose={() => setViewMode('hub')}
              theme={theme}
              onSetSession={(s) => setUserSession(s)}
              onOpenAuth={() => openAuthScreen('admin', 'empresa')}
            />
          )}

          {/* VIEW 8: UNIFORM SIMULATOR (Armador de Uniformes Virtual) */}
          {viewMode === 'uniform_simulator' && (
            <ClientUniformSimulatorView
              onBackToHome={() => setViewMode('landing')}
              theme={theme}
            />
          )}

          {/* VIEW 9: SIZING PORTAL (Portal de Talles para Empleados) */}
          {viewMode === 'sizing_portal' && (
            <ClientSizingPortalView
              onBackToHome={() => setViewMode('landing')}
              theme={theme}
              userSession={userSession}
            />
          )}

          {/* VIEW 10: HUB DE TRABAJO (Admin & Employee Work Hub) */}
          {viewMode === 'hub' && userSession && (
            <HubView
              userSession={userSession}
              theme={theme}
              onOpenCRM={() => setViewMode('crm')}
              onOpenAdmin={() => setViewMode('admin')}
              onOpenCatalog={() => setViewMode('catalog')}
              onLogout={handleLogout}
            />
          )}
        </main>

      {/* Footer (with exact Mendoza and Luján de Cuyo addresses) */}
      <Footer
        theme={theme}
        branches={branches}
        onOpenAdmin={() => {
          if (userSession?.role === 'admin') {
            setViewMode('admin');
          } else {
            openAuthScreen('admin', 'empresa');
          }
        }}
        onOpenCRM={() => setViewMode('crm')}
        onOpenUniformSimulator={() => setViewMode('uniform_simulator')}
        onOpenSizingPortal={() => setViewMode('sizing_portal')}
        onSelectCategory={(cat) => openCatalogScreen(null, cat as MainCategory)}
        onOpenLookbook={() => setViewMode('lookbook')}
      />

      {/* Admin Floating Quick Access Button */}
      {userSession?.role === 'admin' && viewMode !== 'admin' && (
        <button
          id="btn-admin-floating-quick"
          type="button"
          onClick={() => setViewMode('admin')}
          className="fixed bottom-6 left-6 z-40 px-4 py-2.5 rounded-xs bg-[#18231C] text-[#F5F2EC] border-2 shadow-2xl hover:bg-black transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider group"
          style={{ borderColor: theme.accentColor || '#FDB813' }}
          title="Panel de Control de Administrador"
        >
          <Settings 
            className="w-4 h-4 group-hover:rotate-45 transition-transform" 
            style={{ color: theme.accentColor || '#FDB813' }} 
          />
          <span>Panel de Control</span>
        </button>
      )}

      {/* Floating WhatsApp Contact Button */}
      <a
        href={`https://wa.me/5492615276713?text=Hola%20Pampero%20Gran%20Mendoza,%20quisiera%20hacer%20una%20consulta%20directa%20sobre%20su%20cat%C3%A1logo.`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-40 w-13 h-13 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
        title="Consultar por WhatsApp a Pampero Gran Mendoza"
      >
        <MessageCircle className="w-7 h-7 fill-current" />
      </a>

      {/* Quote Drawer Modal */}
      <QuoteDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClear={handleClearCart}
        userSession={userSession}
        theme={theme}
        coupons={coupons}
        volumeDiscounts={volumeDiscounts}
      />

      {/* User Profile / Address Editing Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userSession={userSession}
        onUpdateSession={(updatedSession) => {
          setUserSession(updatedSession);
        }}
        theme={theme}
      />

    </div>
  );
}

