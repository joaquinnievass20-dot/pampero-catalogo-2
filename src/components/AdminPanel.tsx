import React, { useState, useEffect } from 'react';
import { 
  Product, 
  Promotion, 
  ThemeConfig, 
  BranchLocation,
  MainCategory,
  DiscountCoupon,
  UserSession,
  LookbookItem,
  CategoryHierarchyItem,
  QuantityDiscountRule,
  SpecialSizeRange
} from '../types';
import { CATEGORY_HIERARCHY } from '../data/categories';
import { AdminThemeTab } from './admin/AdminThemeTab';
import { AdminLookbookTab } from './admin/AdminLookbookTab';
import { AdminPromosTab } from './admin/AdminPromosTab';
import { AdminMassImagesTab } from './admin/AdminMassImagesTab';
import { AdminPricesTab } from './admin/AdminPricesTab';
import { AdminCategoriesTab } from './admin/AdminCategoriesTab';
import { AdminCouponsTab } from './admin/AdminCouponsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminSecurityTab } from './admin/AdminSecurityTab';
import { AdminAnalyticsTab } from './admin/AdminAnalyticsTab';
import { AdminVariantsTab } from './admin/AdminVariantsTab';
import { AdminSizingPortalConfigTab } from './admin/AdminSizingPortalConfigTab';
import { AdminUniformSimulatorConfigTab } from './admin/AdminUniformSimulatorConfigTab';
import { AdminQuotesTab } from './admin/AdminQuotesTab';
import { AdminBulkExcelImportModal } from './admin/AdminBulkExcelImportModal';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminSellersTab } from './admin/AdminSellersTab';
import { AdminErrorBoundary } from './admin/AdminErrorBoundary';
import { compressImage } from '../utils/imageCompressor';
import { parseImageFileName } from '../utils/imageNamingParser';
import { PamperoLogo } from './PamperoLogo';
import { saveCatalogBackup } from '../utils/backupManager';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, getFirebaseDb, saveSingleFirestoreProduct, deleteFirestoreProductDoc, isFirebaseReady, uploadImageToStorage } from '../services/firebase';
import { 
  Palette, 
  Tag, 
  Package, 
  FileSpreadsheet, 
  Building2, 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  Search, 
  Ticket, 
  Images,
  MapPin,
  Clock,
  Phone,
  Users,
  ShieldCheck,
  BarChart3,
  ExternalLink,
  MessageCircle,
  Layers,
  ShoppingBag,
  UserCheck,
  Upload,
  ArrowLeft,
  ArrowRight,
  Star,
  Sparkles,
  FolderTree,
  Sliders,
  Scale,
  Percent,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  Bell,
  Shirt
} from 'lucide-react';

export type AdminTabKey = 
  | 'promos' 
  | 'mass_images' 
  | 'prices' 
  | 'categories'
  | 'coupons' 
  | 'theme' 
  | 'lookbook'
  | 'products' 
  | 'variants' 
  | 'branches' 
  | 'quotes' 
  | 'sellers'
  | 'sizing'
  | 'simulator'
  | 'notifications'
  | 'users' 
  | 'security' 
  | 'analytics';

interface AdminPanelProps {
  isOpen?: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProducts: (newProducts: Product[]) => void;
  onDeleteProduct?: (id: string) => void;
  promotions: Promotion[];
  onUpdatePromotions: (newPromos: Promotion[]) => void;
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  branches: BranchLocation[];
  onUpdateBranches: (newBranches: BranchLocation[]) => void;
  coupons?: DiscountCoupon[];
  onUpdateCoupons: (coupons: DiscountCoupon[]) => void;
  lookbook?: LookbookItem[];
  onUpdateLookbook?: (newLookbook: LookbookItem[]) => Promise<void> | void;
  onSelectPromoFilter?: (promo: Promotion) => void;
  userSession?: UserSession | null;
  categories?: CategoryHierarchyItem[];
  onUpdateCategories?: (newCats: CategoryHierarchyItem[]) => void;
  volumeDiscounts?: QuantityDiscountRule[];
  onUpdateVolumeDiscounts?: (newRules: QuantityDiscountRule[]) => void;
  onOpenHub?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen = true,
  onClose,
  onOpenHub,
  products,
  onUpdateProducts,
  onDeleteProduct,
  promotions,
  onUpdatePromotions,
  theme,
  onUpdateTheme,
  branches,
  onUpdateBranches,
  coupons = [],
  onUpdateCoupons,
  lookbook = [],
  onUpdateLookbook,
  onSelectPromoFilter = () => {},
  userSession,
  categories = [],
  onUpdateCategories = () => {},
  volumeDiscounts = [],
  onUpdateVolumeDiscounts = () => {},
}) => {
  const isEmployee = userSession?.role === 'employee';

  const employeePermissions: string[] = (() => {
    if (!isEmployee) return [];
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) {
        const list = JSON.parse(saved);
        const emp = list.find((e: any) => 
          e.email?.toLowerCase() === userSession?.email?.toLowerCase() || e.id === userSession?.id
        );
        if (emp && emp.allowedTabs) return emp.allowedTabs;
      }
    } catch {}
    return ['products', 'variants', 'prices', 'mass_images', 'quotes'];
  })();

  const isTabVisible = (tabKey: AdminTabKey) => {
    if (!isEmployee) return true;
    if (tabKey === 'security') return false;
    return employeePermissions.includes(tabKey);
  };

  const initialTab: AdminTabKey = isEmployee 
    ? ((employeePermissions[0] as AdminTabKey) || 'products') 
    : 'promos';

  const [activeTab, setActiveTab] = useState<AdminTabKey>(initialTab);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!isTabVisible(activeTab)) {
      const firstAllowed = employeePermissions[0] as AdminTabKey;
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [userSession]);

  const currentHierarchy: CategoryHierarchyItem[] = (categories && categories.length > 0) ? categories : CATEGORY_HIERARCHY;

  // Products Tab internal state
  const [productSearch, setProductSearch] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [standardSizesInput, setStandardSizesInput] = useState('38, 40, 42, 44, 46, 48');
  const [firebaseErrorNotice, setFirebaseErrorNotice] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoUrlMen, setNewPhotoUrlMen] = useState('');
  const [newPhotoUrlWomen, setNewPhotoUrlWomen] = useState('');
  const [newRangeForm, setNewRangeForm] = useState<{
    suffix: string;
    sizeRangeLabel: string;
    sizes: string;
    price: number | '';
    corporatePrice: number | '';
    minSize?: string;
    maxSize?: string;
  }>({
    suffix: '-1',
    sizeRangeLabel: 'Talles 50 al 58',
    sizes: '50, 52, 54, 56, 58',
    price: '',
    corporatePrice: '',
    minSize: '50',
    maxSize: '58',
  });
  const [productForm, setProductForm] = useState<Partial<Product>>({
    code: '',
    name: '',
    category: 'Hombre',
    section: 'Urbano',
    subCategory: 'Abrigos',
    description: '',
    features: ['Calidad Pampero Garantizada', '100% Algodón Reforzado'],
    price: 55000,
    corporatePrice: 46000,
    discountPercentage: 0,
    promotionTag: '',
    isUnisex: false,
    isCorporateOnly: false,
    specialSizeRanges: [],
    image: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80'],
    imagesMen: [],
    imagesWomen: [],
    availableColors: [],
    availableSizes: [],
    standardSizes: '38, 40, 42, 44, 46, 48',
    inStock: true,
  });

  const [activePhotoGalleryTab, setActivePhotoGalleryTab] = useState<'general' | 'men' | 'women'>('general');
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Multi-photo upload processor with automatic compression, filename parsing, and categorization
  const handleUploadPhotos = async (
    filesList: FileList | File[],
    targetScope: 'general' | 'men' | 'women' | 'auto' = 'auto'
  ) => {
    if (!filesList || filesList.length === 0) return;
    setIsUploadingPhotos(true);
    const files = Array.from(filesList);

    const newGeneral: string[] = [];
    const newMen: string[] = [];
    const newWomen: string[] = [];

    for (const file of files) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.82,
        });

        // Subir EXCLUSIVAMENTE a Firebase Storage para sincronizar con todos los usuarios
        const skuPrefix = (productForm.code || (editingProduct ? editingProduct.code : '') || 'producto').replace(/[^a-zA-Z0-9_-]/g, '_');
        const publicUrl = await uploadImageToStorage(compressed, `products/${skuPrefix}`);

        const parsed = parseImageFileName(file.name);
        let determined = targetScope;

        if (determined === 'auto') {
          if (parsed.gender === 'Mujer') {
            determined = 'women';
          } else if (parsed.gender === 'Hombre') {
            determined = 'men';
          } else {
            determined = activePhotoGalleryTab;
          }
        }

        if (determined === 'women') {
          newWomen.push(publicUrl);
        } else if (determined === 'men') {
          newMen.push(publicUrl);
        } else {
          newGeneral.push(publicUrl);
        }
      } catch (err) {
        console.error('Error processing image:', file.name, err);
      }
    }

    setProductForm((prev) => {
      const updatedGeneral = [...(prev.images || (prev.image ? [prev.image] : [])), ...newGeneral];
      const updatedMen = [...(prev.imagesMen || []), ...newMen];
      const updatedWomen = [...(prev.imagesWomen || []), ...newWomen];
      const primary = prev.image || updatedGeneral[0] || updatedMen[0] || updatedWomen[0] || '';

      return {
        ...prev,
        image: primary,
        images: updatedGeneral,
        imagesMen: updatedMen,
        imagesWomen: updatedWomen,
      };
    });

    setIsUploadingPhotos(false);
  };

  // Branches Tab internal state
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchLocation | null>(null);
  const [branchForm, setBranchForm] = useState<Partial<BranchLocation>>({
    name: '',
    address: '',
    city: 'Gran Mendoza',
    phone: '',
    whatsappNumber: '',
    openingHours: 'Lunes a Viernes de 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30',
    mapUrl: '',
    isPrimary: false,
  });

  if (!isOpen) return null;

  const triggerSaveNotice = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Helper to normalize category
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

  // Product Handlers
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name?.trim()) return;

    const sku = (productForm.code || (editingProduct ? editingProduct.code : '') || '').trim();
    if (!sku) {
      setFirebaseErrorNotice('El código o SKU del producto es obligatorio.');
      return;
    }

    // Regla: si se clasifica en Venta Corporativa o se marca explícitamente como exclusivo corporativo
    const isCorp = Boolean(productForm.isCorporateOnly) || productForm.category === 'Venta Corporativa';

    const cleanCategory = sanitizeCategory(productForm.category);
    const cleanSection = (productForm.section || '').trim();
    const cleanSubCategory = (productForm.subCategory || '').trim();

    // Talles Estándar: permitir texto con letras, números, comas y espacios
    const parsedSizes = standardSizesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const cleanSizes = parsedSizes.length > 0 
      ? parsedSizes 
      : (standardSizesInput.trim() ? [standardSizesInput.trim()] : ['Único']);

    // Fotos duales para productos Unisex y galerías Hombre/Mujer
    const imagesMen = Array.isArray(productForm.imagesMen) ? productForm.imagesMen.filter(Boolean) : [];
    const imagesWomen = Array.isArray(productForm.imagesWomen) ? productForm.imagesWomen.filter(Boolean) : [];
    const isUnisex = Boolean(productForm.isUnisex || (imagesMen.length > 0 && imagesWomen.length > 0));

    // Consolidar fotos generales sin descartar ninguna
    let rawImages: string[] = [];
    if (Array.isArray(productForm.images) && productForm.images.length > 0) {
      rawImages = productForm.images.filter(Boolean);
    }
    if (rawImages.length === 0) {
      rawImages = [...imagesMen, ...imagesWomen];
    }
    if (rawImages.length === 0 && productForm.image) {
      rawImages = [productForm.image];
    }
    if (rawImages.length === 0) {
      rawImages = ['https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80'];
    }

    const primaryImage = imagesMen[0] || imagesWomen[0] || rawImages[0] || productForm.image || rawImages[0];

    setIsSavingProduct(true);
    setFirebaseErrorNotice(null);

    try {
      const prodToSave: Product = editingProduct
        ? {
            ...editingProduct,
            ...productForm,
            id: sku || editingProduct.id,
            code: sku || editingProduct.code,
            category: cleanCategory,
            section: cleanSection,
            subCategory: cleanSubCategory,
            isUnisex,
            isCorporateOnly: isCorp,
            specialSizeRanges: Array.isArray(productForm.specialSizeRanges) ? productForm.specialSizeRanges : [],
            availableSizes: cleanSizes,
            standardSizes: standardSizesInput.trim(),
            images: rawImages,
            image: primaryImage,
            imagesMen,
            imagesWomen,
            inStock: productForm.inStock !== false,
          }
        : {
            id: sku,
            code: sku,
            name: (productForm.name || '').trim(),
            category: cleanCategory,
            section: cleanSection,
            subCategory: cleanSubCategory,
            description: productForm.description || '',
            features: productForm.features || ['Resistente', 'Pampero Oficial'],
            price: Number(productForm.price) || 0,
            corporatePrice: Number(productForm.corporatePrice) || Math.round((Number(productForm.price) || 0) * 0.85),
            discountPercentage: Number(productForm.discountPercentage) || 0,
            promotionTag: productForm.promotionTag || '',
            isUnisex,
            isCorporateOnly: isCorp,
            specialSizeRanges: Array.isArray(productForm.specialSizeRanges) ? productForm.specialSizeRanges : [],
            image: primaryImage,
            images: rawImages,
            imagesMen,
            imagesWomen,
            availableColors: productForm.availableColors || [],
            availableSizes: cleanSizes,
            standardSizes: standardSizesInput.trim(),
            inStock: productForm.inStock !== false,
          };

      // 1. Guardado en Cloud Firestore si está listo
      if (isFirebaseReady()) {
        const fireResult = await saveSingleFirestoreProduct(prodToSave);
        if (!fireResult.success) {
          console.warn('[FIREBASE WARNING AL GUARDAR PRODUCTO]:', fireResult.error);
        }
      }

      // 2. Guardado en servidor central Express /api/products
      try {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: prodToSave }),
        });
      } catch (srvErr) {
        console.warn('[SERVER SYNC] Fallback save product:', srvErr);
      }

      // 3. Actualizar estado local y backup
      const updatedList = editingProduct
        ? products.map((p) => (p.id === editingProduct.id ? prodToSave : p))
        : [prodToSave, ...products];

      onUpdateProducts(updatedList);
      saveCatalogBackup(updatedList);

      setEditingProduct(null);
      setIsCreatingProduct(false);
      setFirebaseErrorNotice(null);
      triggerSaveNotice();
    } catch (err: any) {
      console.error('[ERROR CRÍTICO AL GUARDAR PRODUCTO]:', err);
      setFirebaseErrorNotice(`Error inesperado: ${err?.message || String(err)}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleToggleProductStock = (productId: string, currentStock: boolean) => {
    const updated = products.map((p) =>
      p.id === productId ? { ...p, inStock: !currentStock } : p
    );
    onUpdateProducts(updated);
    saveCatalogBackup(updated);
    triggerSaveNotice();
  };

  const handleDeleteProduct = async (id: string, code?: string, name?: string) => {
    let confirmed = true;
    try {
      confirmed = confirm('¿Desea eliminar este producto del catálogo?');
    } catch {
      confirmed = true;
    }
    if (!confirmed) return;

    const targetId = String(id || '').trim();
    const targetCode = String(code || '').trim();
    const targetName = String(name || '').trim();

    // Función que fuerza la eliminación del producto del estado local de React (UI)
    const forceLocalRemoval = () => {
      const remainingProducts = products.filter((p) => {
        const pId = String(p.id || '').trim();
        const pCode = String(p.code || '').trim();
        const pName = String(p.name || '').trim();
        if (id && (p.id === id || pId === id || pId === targetId)) return false;
        if (targetId && (pId === targetId || pCode === targetId || pName === targetId)) return false;
        if (code && (p.code === code || pCode === code)) return false;
        if (targetCode && (pCode === targetCode || pId === targetCode || pName === targetCode)) return false;
        if (targetName && pName === targetName && !pId && !pCode) return false;
        return true;
      });
      onUpdateProducts(remainingProducts);
      saveCatalogBackup(remainingProducts);
      if (onDeleteProduct) {
        onDeleteProduct(id || targetId || targetCode);
      }
      triggerSaveNotice();
    };

    try {
      const firestoreDb = db || getFirebaseDb();
      if (firestoreDb && (targetId || targetCode)) {
        await Promise.race([
          (async () => {
            if (targetId) {
              await deleteDoc(doc(firestoreDb, 'productos', targetId)).catch(() => {});
              await deleteDoc(doc(firestoreDb, 'products', targetId)).catch(() => {});
            }
            if (targetCode && targetCode !== targetId) {
              await deleteDoc(doc(firestoreDb, 'productos', targetCode)).catch(() => {});
              await deleteDoc(doc(firestoreDb, 'products', targetCode)).catch(() => {});
            }
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout Firebase deleteDoc')), 2000)
          ),
        ]);
      }
    } catch (error) {
      console.warn('[FIREBASE] Error al eliminar documento en backend (se fuerza eliminación en UI):', error);
      forceLocalRemoval();
    } finally {
      // El bloque catch o finally DEBE forzar la eliminación del producto del estado local de React
      // para destrabar la interfaz visualmente de una vez por todas.
      forceLocalRemoval();
    }
  };

  // Branch Handlers
  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name?.trim()) return;

    let updated: BranchLocation[];
    if (editingBranch) {
      updated = branches.map((b) =>
        b.id === editingBranch.id ? ({ ...b, ...branchForm } as BranchLocation) : b
      );
    } else {
      const newBranch: BranchLocation = {
        id: 'branch-' + Date.now(),
        name: branchForm.name.trim(),
        address: branchForm.address?.trim() || '',
        city: branchForm.city?.trim() || 'Gran Mendoza',
        phone: branchForm.phone?.trim() || '',
        whatsappNumber: branchForm.whatsappNumber?.trim() || '',
        openingHours: branchForm.openingHours?.trim() || 'Lunes a Viernes de 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30',
        mapUrl: branchForm.mapUrl?.trim() || '',
        isPrimary: Boolean(branchForm.isPrimary),
      };
      updated = [...branches, newBranch];
    }

    onUpdateBranches(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_catalog_branches', JSON.stringify(updated));
    }
    setEditingBranch(null);
    setIsCreatingBranch(false);
    triggerSaveNotice();
  };

  const handleDeleteBranch = (id: string) => {
    if (confirm('¿Estás seguro de que deseás eliminar esta sucursal?')) {
      const updated = branches.filter((b) => b.id !== id);
      onUpdateBranches(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pampero_catalog_branches', JSON.stringify(updated));
      }
      triggerSaveNotice();
    }
  };

  const handleGlobalSave = () => {
    onUpdateTheme(theme);
    onUpdateProducts(products);
    saveCatalogBackup(products);
    onUpdatePromotions(promotions);
    onUpdateBranches(branches);
    onUpdateCoupons(coupons);

    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(theme));
      localStorage.setItem('pampero_theme_config', JSON.stringify(theme));
      localStorage.setItem('pampero_catalog_products', JSON.stringify(products));
      localStorage.setItem('pampero_catalog_promos', JSON.stringify(promotions));
      localStorage.setItem('pampero_catalog_branches', JSON.stringify(branches));
      localStorage.setItem('pampero_discount_coupons', JSON.stringify(coupons));
      if (theme.customLogoUrl) {
        localStorage.setItem('pampero_custom_logo', theme.customLogoUrl);
      }
      if (theme.logoHeight) {
        localStorage.setItem('pampero_logo_height', theme.logoHeight.toString());
      }
    }
    triggerSaveNotice();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.subCategory.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div 
        id="pampero-admin-modal"
        style={{
          borderColor: theme.cardBorderColor || '#DCD4C9',
          backgroundColor: theme.panelBgColor || '#FFFFFF'
        }}
        className="w-full max-w-6xl h-[92vh] max-h-[900px] rounded-xs shadow-2xl flex flex-col overflow-hidden border"
      >
        {/* Top Header matching Pampero brand colors and dynamic theme */}
        <div 
          style={{ 
            backgroundColor: theme.primaryColor || '#18231C',
            color: theme.headerTextColor || '#F5F2EC'
          }}
          className="px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-black/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <PamperoLogo 
              customUrl={theme.customLogoUrl || theme.logoUrl}
              height={theme.logoHeight ? Math.min(theme.logoHeight, 38) : 32}
              size="sm"
            />
            <div>
              <h2 className="font-display text-lg sm:text-xl uppercase tracking-wider flex items-center gap-2 leading-none">
                PANEL DE ADMINISTRACIÓN GENERAL · GRAN MENDOZA
                {savedNotice && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-xs flex items-center gap-1 font-sans font-semibold">
                    <Check className="w-3 h-3" /> Cambios Guardados
                  </span>
                )}
              </h2>
              <p className="text-[11px] opacity-75 mt-0.5 font-sans">
                Gestión oficial de promociones, imágenes masivas, lista de precios, códigos y estilos de marca.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-global-save-admin"
              type="button"
              onClick={handleGlobalSave}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Guardar todos los cambios en el sistema"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Cambios
            </button>
            <button
              id="btn-close-admin-panel"
              onClick={onClose}
              className="opacity-75 hover:opacity-100 p-1.5 rounded-xs hover:bg-white/10 transition-colors"
              title="Cerrar panel de control y volver al catálogo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {(() => {
          const iconColor = theme.iconColor || theme.accentColor || '#FDB813';
          const activeBorderColor = theme.accentColor || '#FDB813';
          return (
            <div className="flex border-b border-[#DCD4C9] bg-[#ECE5DC] px-4 pt-2 gap-1.5 overflow-x-auto text-xs font-bold uppercase tracking-wider">
              
              {/* Promociones */}
              {isTabVisible('promos') && (
                <button
                  id="admin-tab-promos"
                  onClick={() => setActiveTab('promos')}
                  style={{
                    borderTopColor: activeTab === 'promos' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'promos'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Tag className="w-4 h-4" style={{ color: iconColor }} />
                  Promociones ({promotions.length})
                </button>
              )}

              {/* Carga Masiva de Imágenes */}
              {isTabVisible('mass_images') && (
                <button
                  id="admin-tab-mass-images"
                  onClick={() => setActiveTab('mass_images')}
                  style={{
                    borderTopColor: activeTab === 'mass_images' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'mass_images'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Images className="w-4 h-4" style={{ color: iconColor }} />
                  Carga Masiva de Imágenes
                </button>
              )}

              {/* Sincronización de Precios & Excel */}
              {isTabVisible('prices') && (
                <button
                  id="admin-tab-prices"
                  onClick={() => setActiveTab('prices')}
                  style={{
                    borderTopColor: activeTab === 'prices' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'prices'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" style={{ color: iconColor }} />
                  Precios & Planillas ({products.length})
                </button>
              )}

              {/* Categorías & Rubros (Subcategorías dinámicas) */}
              {isTabVisible('categories') && (
                <button
                  id="admin-tab-categories"
                  onClick={() => setActiveTab('categories')}
                  style={{
                    borderTopColor: activeTab === 'categories' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'categories'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <FolderTree className="w-4 h-4" style={{ color: iconColor }} />
                  Categorías & Rubros
                </button>
              )}

              {/* Códigos de Descuento */}
              {isTabVisible('coupons') && (
                <button
                  id="admin-tab-coupons"
                  onClick={() => setActiveTab('coupons')}
                  style={{
                    borderTopColor: activeTab === 'coupons' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'coupons'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Ticket className="w-4 h-4" style={{ color: iconColor }} />
                  Cupones ({coupons.length})
                </button>
              )}

              {/* Logo, Colores & Fuentes */}
              {isTabVisible('theme') && (
                <button
                  id="admin-tab-theme"
                  onClick={() => setActiveTab('theme')}
                  style={{
                    borderTopColor: activeTab === 'theme' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'theme'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Palette className="w-4 h-4" style={{ color: iconColor }} />
                  Logo & Estilos
                </button>
              )}

              {/* Lookbook Interactivo */}
              {isTabVisible('lookbook') && (
                <button
                  id="admin-tab-lookbook"
                  onClick={() => setActiveTab('lookbook')}
                  style={{
                    borderTopColor: activeTab === 'lookbook' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'lookbook'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-4 h-4" style={{ color: iconColor }} />
                  Lookbook Interactivo
                </button>
              )}

              {/* Productos */}
              {isTabVisible('products') && (
                <button
                  id="admin-tab-products"
                  onClick={() => setActiveTab('products')}
                  style={{
                    borderTopColor: activeTab === 'products' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'products'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Package className="w-4 h-4" style={{ color: iconColor }} />
                  Productos ({products.length})
                </button>
              )}

              {/* Colores y Talles por Artículo */}
              {isTabVisible('variants') && (
                <button
                  id="admin-tab-variants"
                  onClick={() => setActiveTab('variants')}
                  style={{
                    borderTopColor: activeTab === 'variants' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'variants'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Layers className="w-4 h-4" style={{ color: iconColor }} />
                  Colores & Talles
                </button>
              )}

              {/* Cotizaciones Recibidas */}
              {isTabVisible('quotes') && (
                <button
                  id="admin-tab-quotes"
                  onClick={() => setActiveTab('quotes')}
                  style={{
                    borderTopColor: activeTab === 'quotes' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'quotes'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" style={{ color: iconColor }} />
                  Cotizaciones
                </button>
              )}

              {/* Sucursales */}
              {isTabVisible('branches') && (
                <button
                  id="admin-tab-branches"
                  onClick={() => setActiveTab('branches')}
                  style={{
                    borderTopColor: activeTab === 'branches' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'branches'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Building2 className="w-4 h-4" style={{ color: iconColor }} />
                  Sucursales ({branches.length})
                </button>
              )}

              {/* Métricas & Búsquedas */}
              {isTabVisible('analytics') && (
                <button
                  id="admin-tab-analytics"
                  onClick={() => setActiveTab('analytics')}
                  style={{
                    borderTopColor: activeTab === 'analytics' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" style={{ color: iconColor }} />
                  Métricas
                </button>
              )}

              {/* Vendedores & Locales */}
              {isTabVisible('sellers') && (
                <button
                  id="admin-tab-sellers"
                  onClick={() => setActiveTab('sellers')}
                  style={{
                    borderTopColor: activeTab === 'sellers' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'sellers'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Users className="w-4 h-4" style={{ color: iconColor }} />
                  Vendedores & Locales
                </button>
              )}

              {/* Configuración Portal de Talles */}
              {isTabVisible('sizing') && (
                <button
                  id="admin-tab-sizing-config"
                  onClick={() => setActiveTab('sizing')}
                  style={{
                    borderTopColor: activeTab === 'sizing' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'sizing'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Shirt className="w-4 h-4" style={{ color: iconColor }} />
                  Portal de Talles
                </button>
              )}

              {/* Configuración Simulador de Bordado */}
              {isTabVisible('simulator') && (
                <button
                  id="admin-tab-simulator-config"
                  onClick={() => setActiveTab('simulator')}
                  style={{
                    borderTopColor: activeTab === 'simulator' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'simulator'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-4 h-4" style={{ color: iconColor }} />
                  Simulador Bordado
                </button>
              )}

              {/* Notificaciones & Alertas */}
              {isTabVisible('notifications') && (
                <button
                  id="admin-tab-notifications"
                  onClick={() => setActiveTab('notifications')}
                  style={{
                    borderTopColor: activeTab === 'notifications' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'notifications'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Bell className="w-4 h-4" style={{ color: iconColor }} />
                  Notificaciones
                </button>
              )}

              {/* Cuentas Creadas */}
              {isTabVisible('users') && (
                <button
                  id="admin-tab-users"
                  onClick={() => setActiveTab('users')}
                  style={{
                    borderTopColor: activeTab === 'users' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <Users className="w-4 h-4" style={{ color: iconColor }} />
                  Cuentas Creadas
                </button>
              )}

              {/* Seguridad & Claves */}
              {isTabVisible('security') && (
                <button
                  id="admin-tab-security"
                  onClick={() => setActiveTab('security')}
                  style={{
                    borderTopColor: activeTab === 'security' ? activeBorderColor : 'transparent',
                  }}
                  className={`py-2.5 px-4 rounded-t-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'security'
                      ? 'bg-white text-[#18231C] border-t-2 shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C] hover:bg-white/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" style={{ color: iconColor }} />
                  Seguridad
                </button>
              )}

            </div>
          );
        })()}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto bg-neutral-50/50">
          <AdminErrorBoundary key={activeTab} tabName={activeTab}>
          
          {/* TAB 1: PROMOCIONES */}
          {activeTab === 'promos' && (
            <AdminPromosTab
              promotions={promotions}
              products={products}
              onUpdatePromotions={onUpdatePromotions}
              onUpdateProducts={onUpdateProducts}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 2: CARGA MASIVA DE IMÁGENES & GOOGLE DRIVE */}
          {activeTab === 'mass_images' && (
            <AdminMassImagesTab
              products={products}
              onUpdateProducts={onUpdateProducts}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 3: PRECIOS & PLANILLAS */}
          {activeTab === 'prices' && (
            <AdminPricesTab
              products={products}
              onUpdateProducts={onUpdateProducts}
              triggerSaveNotice={triggerSaveNotice}
              volumeDiscounts={volumeDiscounts}
              onUpdateVolumeDiscounts={onUpdateVolumeDiscounts}
              categories={currentHierarchy}
            />
          )}

          {/* TAB: SUBCATEGORÍAS & RUBROS */}
          {activeTab === 'categories' && (
            <AdminCategoriesTab
              categories={currentHierarchy}
              onUpdateCategories={onUpdateCategories}
              products={products}
              onUpdateProducts={onUpdateProducts}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 4: CÓDIGOS DE DESCUENTO */}
          {activeTab === 'coupons' && (
            <AdminCouponsTab
              coupons={coupons}
              onUpdateCoupons={onUpdateCoupons}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 5: LOGO, COLORES & FUENTES */}
          {activeTab === 'theme' && (
            <AdminThemeTab
              theme={theme}
              onUpdateTheme={onUpdateTheme}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB: LOOKBOOK INTERACTIVO */}
          {activeTab === 'lookbook' && (
            <AdminLookbookTab
              lookbook={lookbook || []}
              products={products}
              theme={theme}
              onUpdateLookbook={onUpdateLookbook || (() => {})}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 6: PRODUCTOS */}
          {activeTab === 'products' && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9]">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto por nombre o código..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xs border border-[#DCD4C9] text-[#18231C] focus:border-[#FDB813] outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xs bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Importar catálogo masivamente desde Excel o Google Sheets"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  Carga Masiva (Excel / Sheets)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setStandardSizesInput('38, 40, 42, 44, 46, 48');
                    setFirebaseErrorNotice(null);
                    setNewPhotoUrl('');
                    setNewPhotoUrlMen('');
                    setNewPhotoUrlWomen('');
                    setProductForm({
                      code: '',
                      name: '',
                      category: 'Hombre',
                      section: '',
                      subCategory: '',
                      description: '',
                      features: ['Calidad Pampero Garantizada', '100% Algodón Reforzado'],
                      price: 0,
                      corporatePrice: 0,
                      discountPercentage: 0,
                      promotionTag: '',
                      isUnisex: false,
                      isCorporateOnly: false,
                      specialSizeRanges: [],
                      image: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80',
                      images: ['https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80'],
                      imagesMen: [],
                      imagesWomen: [],
                      availableColors: [],
                      availableSizes: ['38', '40', '42', '44', '46', '48'],
                      standardSizes: '38, 40, 42, 44, 46, 48',
                      inStock: true,
                    });
                    setIsCreatingProduct(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xs bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" style={{ color: theme.accentColor || '#FDB813' }} />
                  Nuevo Producto
                </button>
              </div>

              {/* Product Form Modal/Inline */}
              {(isCreatingProduct || editingProduct) && (
                <form
                  onSubmit={handleSaveProduct}
                  className="bg-white p-5 rounded-xs border-2 border-[#18231C] shadow-lg space-y-4 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
                    <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
                      {editingProduct ? `Editar: ${editingProduct.name}` : 'Crear Nuevo Producto'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingProduct(false);
                        setEditingProduct(null);
                      }}
                      className="text-[#6F6860] hover:text-[#18231C] text-xs font-semibold"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Código / SKU *</label>
                      <input
                        type="text"
                        required
                        value={productForm.code}
                        onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Nombre del Producto *</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Categoría Principal *</label>
                      <select
                        value={productForm.category || 'Hombre'}
                        onChange={(e) => {
                          const newCatName = e.target.value as MainCategory;
                          const foundCat = currentHierarchy.find((c) => c.name === newCatName) || currentHierarchy[0];
                          const defaultSec = foundCat.sections[0]?.name || 'Urbano';
                          const defaultSub = foundCat.sections[0]?.subCategories[0] || 'Abrigos';
                          setProductForm({
                            ...productForm,
                            category: newCatName,
                            section: defaultSec,
                            subCategory: defaultSub,
                          });
                        }}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-semibold bg-white"
                      >
                        {currentHierarchy.map((cat) => (
                          <option key={cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Sección / Línea *</label>
                      {(() => {
                        const targetCatName = productForm.category || 'Hombre';
                        const currentCat = currentHierarchy.find((c) => c.name === targetCatName) || currentHierarchy[0];
                        return (
                          <select
                            value={productForm.section || currentCat.sections[0]?.name || 'Urbano'}
                            onChange={(e) => {
                              const newSec = e.target.value;
                              const foundSec = currentCat.sections.find((s) => s.name === newSec);
                              setProductForm({
                                ...productForm,
                                section: newSec,
                                subCategory: foundSec?.subCategories[0] || 'General',
                              });
                            }}
                            className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-semibold bg-white"
                          >
                            {currentCat.sections.map((s) => (
                              <option key={s.name} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Subcategoría *</label>
                      {(() => {
                        const targetCatName = productForm.category || 'Hombre';
                        const currentCat = currentHierarchy.find((c) => c.name === targetCatName) || currentHierarchy[0];
                        const currentSec = currentCat.sections.find((s) => s.name === productForm.section) || currentCat.sections[0];
                        return (
                          <select
                            value={productForm.subCategory || currentSec?.subCategories[0] || 'Abrigos'}
                            onChange={(e) => setProductForm({ ...productForm, subCategory: e.target.value })}
                            className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-semibold bg-white"
                          >
                            {currentSec?.subCategories.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Precio Minorista ($) *</label>
                      <input
                        type="number"
                        required
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Precio Empresa / Mayorista ($)</label>
                      <input
                        type="number"
                        value={productForm.corporatePrice}
                        onChange={(e) => setProductForm({ ...productForm, corporatePrice: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs text-blue-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1">Descuento (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={productForm.discountPercentage}
                        onChange={(e) => setProductForm({ ...productForm, discountPercentage: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-bold"
                        style={{ color: theme.accentColor || '#FDB813' }}
                      />
                    </div>
                  </div>

                  {/* Clasificación: Unisex e Industria / Corporativo */}
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C]">
                      Clasificación de Catálogo (Unisex & Corporativo)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-start gap-2 p-2.5 bg-white border border-[#DCD4C9] rounded-xs cursor-pointer hover:border-[#18231C] transition-colors">
                        <input
                          type="checkbox"
                          checked={Boolean(productForm.isUnisex)}
                          onChange={(e) => setProductForm({ ...productForm, isUnisex: e.target.checked })}
                          className="mt-0.5 rounded text-[#18231C] focus:ring-[#FDB813]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#18231C] block">
                            Artículo Unisex
                          </span>
                          <span className="text-[11px] text-[#6F6860] block leading-tight mt-0.5">
                            Se mostrará automáticamente en ambas categorías de Hombre y Mujer.
                          </span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors ${
                        productForm.isCorporateOnly
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-white border-[#DCD4C9] hover:border-[#18231C]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={Boolean(productForm.isCorporateOnly)}
                          onChange={(e) => {
                            const isCorp = e.target.checked;
                            setProductForm({
                              ...productForm,
                              isCorporateOnly: isCorp,
                            });
                          }}
                          className="mt-0.5 rounded text-amber-600 focus:ring-[#FDB813]"
                        />
                        <div>
                          <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            Exclusivo Venta Corporativa
                          </span>
                          <span className="text-[11px] text-[#6F6860] block leading-tight mt-0.5">
                            Marcar solo si es un producto exclusivo para empresas/dotaciones y no debe ofrecerse a particulares.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Control de Stock (Ocultamiento automático) */}
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#18231C]" />
                        Control de Stock y Disponibilidad
                      </label>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider ${
                        productForm.inStock !== false
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {productForm.inStock !== false ? '● En Stock (Visible)' : '○ Sin Stock (Oculto)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#6F6860]">
                      Si se marca como <strong>Sin Stock</strong>, el producto dejará de ser visible automáticamente en la vista pública del catálogo de clientes para evitar consultas por prendas agotadas.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <label className={`flex items-start gap-2.5 p-2.5 rounded-xs border cursor-pointer transition-all ${
                        productForm.inStock !== false
                          ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-white border-[#DCD4C9] opacity-70 hover:opacity-100'
                      }`}>
                        <input
                          type="radio"
                          name="adminProductInStock"
                          checked={productForm.inStock !== false}
                          onChange={() => setProductForm({ ...productForm, inStock: true })}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            En Stock (Disponible)
                          </span>
                          <span className="text-[11px] text-emerald-800/80 block leading-tight mt-0.5">
                            Exhibir de manera normal en el catálogo público y cotizador.
                          </span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2.5 p-2.5 rounded-xs border cursor-pointer transition-all ${
                        productForm.inStock === false
                          ? 'bg-rose-50 border-rose-500 ring-1 ring-rose-500'
                          : 'bg-white border-[#DCD4C9] opacity-70 hover:opacity-100'
                      }`}>
                        <input
                          type="radio"
                          name="adminProductInStock"
                          checked={productForm.inStock === false}
                          onChange={() => setProductForm({ ...productForm, inStock: false })}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-rose-950 block flex items-center gap-1">
                            <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                            Sin Stock (Agotado)
                          </span>
                          <span className="text-[11px] text-rose-800/80 block leading-tight mt-0.5">
                            Ocultar automáticamente de la vista pública de clientes.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Talles Especiales y Precios Diferenciados */}
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#DCD4C9] pb-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#FDB813]" />
                          Talles Especiales y Precios Diferenciados (Sufijos: -1, -2, etc.)
                        </label>
                        <p className="text-[11px] text-[#6F6860]">
                          Permite que un mismo producto maneje variantes de talles grandes con precio distinto y código sufijo en la cotización.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#6F6860]">
                        {(productForm.specialSizeRanges || []).length} rangos activos
                      </span>
                    </div>

                    {/* Active Special Size Ranges List */}
                    {(productForm.specialSizeRanges && productForm.specialSizeRanges.length > 0) && (
                      <div className="space-y-1.5">
                        {productForm.specialSizeRanges.map((range, rIdx) => (
                          <div
                            key={rIdx}
                            className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white border border-[#DCD4C9] rounded-xs text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold bg-[#18231C] text-white px-2 py-0.5 rounded-xs">
                                {range.suffix}
                              </span>
                              <span className="font-semibold text-[#18231C]">
                                {range.sizeRangeLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-neutral-700">
                                Minorista: <strong className="text-[#18231C]">${range.price.toLocaleString('es-AR')}</strong>
                              </span>
                              {range.corporatePrice ? (
                                <span className="text-blue-800">
                                  Mayorista: <strong>${range.corporatePrice.toLocaleString('es-AR')}</strong>
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (productForm.specialSizeRanges || []).filter((_, idx) => idx !== rIdx);
                                  setProductForm({ ...productForm, specialSizeRanges: updated });
                                }}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xs cursor-pointer"
                                title="Eliminar este rango especial"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Range Inline Form */}
                    <div className="p-2.5 bg-white border border-dashed border-[#DCD4C9] rounded-xs space-y-2">
                      <span className="text-[11px] font-bold text-[#4A453F] uppercase tracking-wider block">
                        + Añadir Rango de Talles Especiales
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#6F6860] mb-0.5">Sufijo Código</label>
                          <input
                            type="text"
                            placeholder="-1"
                            value={newRangeForm.suffix}
                            onChange={(e) => setNewRangeForm({ ...newRangeForm, suffix: e.target.value })}
                            className="w-full px-2 py-1 border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <label className="block text-[10px] font-bold text-[#6F6860] mb-0.5">Rango / Descripción</label>
                          <input
                            type="text"
                            placeholder="ej: Talles 50 al 58"
                            value={newRangeForm.sizeRangeLabel}
                            onChange={(e) => setNewRangeForm({ ...newRangeForm, sizeRangeLabel: e.target.value })}
                            className="w-full px-2 py-1 border border-[#DCD4C9] rounded-xs text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#6F6860] mb-0.5">Precio Minorista ($)</label>
                          <input
                            type="number"
                            placeholder="58000"
                            value={newRangeForm.price}
                            onChange={(e) => setNewRangeForm({ ...newRangeForm, price: e.target.value ? Number(e.target.value) : '' })}
                            className="w-full px-2 py-1 border border-[#DCD4C9] rounded-xs text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#6F6860] mb-0.5">Precio Mayorista ($)</label>
                          <input
                            type="number"
                            placeholder="49000"
                            value={newRangeForm.corporatePrice}
                            onChange={(e) => setNewRangeForm({ ...newRangeForm, corporatePrice: e.target.value ? Number(e.target.value) : '' })}
                            className="w-full px-2 py-1 border border-[#DCD4C9] rounded-xs text-xs text-blue-900 font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newRangeForm.suffix.trim() || !newRangeForm.sizeRangeLabel.trim() || !newRangeForm.price) {
                              alert('Por favor completá el sufijo, la descripción del rango y el precio.');
                              return;
                            }
                            const newRange: SpecialSizeRange = {
                              id: `range-${Date.now()}`,
                              suffix: newRangeForm.suffix.trim(),
                              rangeLabel: newRangeForm.sizeRangeLabel.trim(),
                              sizeRangeLabel: newRangeForm.sizeRangeLabel.trim(),
                              minSize: newRangeForm.minSize || undefined,
                              maxSize: newRangeForm.maxSize || undefined,
                              sizes: [],
                              price: Number(newRangeForm.price),
                              corporatePrice: newRangeForm.corporatePrice ? Number(newRangeForm.corporatePrice) : undefined,
                            };
                            setProductForm({
                              ...productForm,
                              specialSizeRanges: [...(productForm.specialSizeRanges || []), newRange],
                            });
                            // Reset form to next suffix
                            const nextSuffixNum = parseInt(newRangeForm.suffix.replace(/\D/g, ''), 10) || 1;
                            setNewRangeForm({
                              suffix: `-${nextSuffixNum + 1}`,
                              sizeRangeLabel: 'Talles 60 al 66',
                              sizes: '60, 62, 64, 66',
                              minSize: '60',
                              maxSize: '66',
                              price: '',
                              corporatePrice: '',
                            });
                          }}
                          className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#FDB813]" />
                          Guardar Rango Especial
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Colores, Talles Base y Etiqueta Promocional */}
                  <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#B9522F]" />
                      Colores, Talles y Etiqueta de Promoción
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#4A453F] mb-1">
                          Colores Asignados (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Azul Marino, Beige, Verde (vacío si no tiene)"
                          value={(productForm.availableColors || []).join(', ')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const colors = val
                              .split(',')
                              .map((c) => c.trim())
                              .filter(Boolean);
                            setProductForm({ ...productForm, availableColors: colors });
                          }}
                          className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs bg-white"
                        />
                        <span className="text-[10px] text-[#6F6860] block mt-0.5">
                          Sin colores por defecto. Dejar vacío si no aplica selección de color.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#4A453F] mb-1 flex items-center justify-between">
                          <span>Talles Estándares *</span>
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded-xs">Texto / String</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: CH, M, G, MG, XG o 38, 40, 42"
                          value={standardSizesInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStandardSizesInput(val);
                            const sizes = val
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setProductForm({
                              ...productForm,
                              standardSizes: val,
                              availableSizes: sizes,
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs bg-white font-medium focus:border-[#18231C] outline-none"
                        />
                        <span className="text-[10px] text-[#6F6860] block mt-0.5">
                          Permite letras en escala español (CH, M, G, MG, XG), números, comas y espacios.
                        </span>
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const v = 'CH, M, G, MG, XG, XXG';
                              setStandardSizesInput(v);
                              setProductForm({
                                ...productForm,
                                standardSizes: v,
                                availableSizes: v.split(',').map((s) => s.trim()),
                              });
                            }}
                            className="text-[9px] px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-xs cursor-pointer border border-amber-300"
                          >
                            + Letras Español (CH a XXG)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const v = '38, 40, 42, 44, 46, 48';
                              setStandardSizesInput(v);
                              setProductForm({
                                ...productForm,
                                standardSizes: v,
                                availableSizes: v.split(',').map((s) => s.trim()),
                              });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xs font-medium cursor-pointer"
                          >
                            + Pantalones (38 a 48)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const v = 'S, M, L, XL, XXL';
                              setStandardSizesInput(v);
                              setProductForm({
                                ...productForm,
                                standardSizes: v,
                                availableSizes: v.split(',').map((s) => s.trim()),
                              });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xs font-medium cursor-pointer"
                          >
                            + Letras Internacional (S a XXL)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const v = '39, 40, 41, 42, 43, 44, 45';
                              setStandardSizesInput(v);
                              setProductForm({
                                ...productForm,
                                standardSizes: v,
                                availableSizes: v.split(',').map((s) => s.trim()),
                              });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xs font-medium cursor-pointer"
                          >
                            + Calzado (39 a 45)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const v = 'Talle Único';
                              setStandardSizesInput(v);
                              setProductForm({
                                ...productForm,
                                standardSizes: v,
                                availableSizes: [v],
                              });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xs font-medium cursor-pointer"
                          >
                            + Único
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#4A453F] mb-1">
                          Etiqueta de Promoción
                        </label>
                        <input
                          type="text"
                          placeholder="Dejar vacío si no aplica promo"
                          value={productForm.promotionTag || ''}
                          onChange={(e) => setProductForm({ ...productForm, promotionTag: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs bg-white"
                        />
                        <span className="text-[10px] text-[#6F6860] block mt-0.5">
                          Vacío = sin etiqueta fija en la tarjeta.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Photo Manager & Categorization */}
                  <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-4">
                    {/* Header & Gallery Tab Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                          <Images className="w-4 h-4 text-[#B9522F]" />
                          <span>Galería de Fotos & Modelos (Carga Múltiple)</span>
                        </label>
                        <p className="text-[11px] text-[#6F6860] mt-0.5">
                          Subí múltiples fotos a la vez. Si los nombres tienen <strong className="text-[#18231C]">#Hombre</strong>, <strong className="text-[#18231C]">#Mujer</strong> o <strong className="text-[#18231C]">#Femenino</strong>, se asignan automáticamente.
                        </p>
                      </div>

                      {/* Tab Selector: General, Hombre, Mujer */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xs border border-[#DCD4C9] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setActivePhotoGalleryTab('general')}
                          className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                            activePhotoGalleryTab === 'general'
                              ? 'bg-[#18231C] text-white shadow-2xs'
                              : 'text-[#6F6860] hover:text-[#18231C]'
                          }`}
                        >
                          <span>General</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activePhotoGalleryTab === 'general' ? 'bg-amber-400 text-black font-black' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {productForm.images?.length || (productForm.image ? 1 : 0)}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePhotoGalleryTab('men')}
                          className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                            activePhotoGalleryTab === 'men'
                              ? 'bg-blue-900 text-white shadow-2xs'
                              : 'text-[#6F6860] hover:text-blue-900'
                          }`}
                        >
                          <span>Hombre (♂)</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activePhotoGalleryTab === 'men' ? 'bg-blue-200 text-blue-950 font-black' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {productForm.imagesMen?.length || 0}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePhotoGalleryTab('women')}
                          className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                            activePhotoGalleryTab === 'women'
                              ? 'bg-rose-800 text-white shadow-2xs'
                              : 'text-[#6F6860] hover:text-rose-800'
                          }`}
                        >
                          <span>Mujer (♀)</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            activePhotoGalleryTab === 'women' ? 'bg-rose-200 text-rose-950 font-black' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {productForm.imagesWomen?.length || 0}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Format hint badge */}
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xs flex items-center gap-2 text-amber-900 text-xs">
                      <Sparkles className="w-4 h-4 text-[#B9522F] shrink-0" />
                      <div className="flex-1 min-w-0 text-[11px] leading-tight">
                        <strong className="font-bold">Formato inteligente Pampero: </strong>
                        <span>Nombrá tus archivos como </span>
                        <code className="bg-amber-100 px-1 py-0.5 rounded-xs font-mono font-bold text-amber-950">
                          código#color#género#posición.jpg
                        </code>
                        <span> (ej: </span>
                        <code className="bg-amber-100 px-1 py-0.5 rounded-xs font-mono text-amber-950">
                          {productForm.code || '111108004'}#C1#Femenino#1.jpg
                        </code>
                        <span>). Al subirlas se ubican solas en su modelo y posición.</span>
                      </div>
                    </div>

                    {/* Upload Controls Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* From PC */}
                      <label className="border-2 border-dashed border-[#DCD4C9] hover:border-[#18231C] bg-white p-3.5 rounded-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center group transition-colors">
                        <Upload className="w-5 h-5 text-[#6F6860] group-hover:scale-110 group-hover:text-[#18231C] transition-all" />
                        <span className="text-xs font-bold text-[#18231C]">
                          {isUploadingPhotos ? 'Optimizando fotos...' : `Subir fotos a ${activePhotoGalleryTab === 'men' ? 'Hombre' : activePhotoGalleryTab === 'women' ? 'Mujer' : 'General'}`}
                        </span>
                        <span className="text-[10px] text-[#6F6860]">
                          Podés seleccionar múltiples fotos juntas (JPG, PNG, WebP)
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={isUploadingPhotos}
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              handleUploadPhotos(e.target.files, 'auto');
                            }
                          }}
                        />
                      </label>

                      {/* By URL */}
                      <div className="border border-[#DCD4C9] bg-white p-3.5 rounded-xs flex flex-col justify-between gap-2">
                        <span className="text-xs font-bold text-[#18231C]">
                          O agregar por enlace URL:
                        </span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="https://..."
                            value={newPhotoUrl}
                            onChange={(e) => setNewPhotoUrl(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-mono outline-none focus:border-[#FDB813]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newPhotoUrl.trim();
                              if (!trimmed) return;
                              if (activePhotoGalleryTab === 'men') {
                                const list = Array.isArray(productForm.imagesMen) ? [...productForm.imagesMen] : [];
                                setProductForm((prev) => ({ ...prev, imagesMen: [...list, trimmed] }));
                              } else if (activePhotoGalleryTab === 'women') {
                                const list = Array.isArray(productForm.imagesWomen) ? [...productForm.imagesWomen] : [];
                                setProductForm((prev) => ({ ...prev, imagesWomen: [...list, trimmed] }));
                              } else {
                                const list = Array.isArray(productForm.images) ? [...productForm.images] : (productForm.image ? [productForm.image] : []);
                                setProductForm((prev) => ({
                                  ...prev,
                                  images: [...list, trimmed],
                                  image: prev.image || trimmed,
                                }));
                              }
                              setNewPhotoUrl('');
                            }}
                            className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold rounded-xs cursor-pointer shrink-0"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Preview Grid for Active Tab */}
                    {(() => {
                      let activeList: string[] = [];
                      if (activePhotoGalleryTab === 'men') {
                        activeList = productForm.imagesMen || [];
                      } else if (activePhotoGalleryTab === 'women') {
                        activeList = productForm.imagesWomen || [];
                      } else {
                        activeList = (productForm.images && productForm.images.length > 0)
                          ? productForm.images
                          : (productForm.image ? [productForm.image] : []);
                      }

                      if (activeList.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-[#DCD4C9] rounded-xs text-center text-xs text-[#6F6860] space-y-1">
                            <p className="font-semibold text-[#18231C]">
                              No hay fotos cargadas todavía en la galería {activePhotoGalleryTab === 'men' ? 'Hombre' : activePhotoGalleryTab === 'women' ? 'Mujer' : 'General'}.
                            </p>
                            <p className="text-[11px]">
                              Hacé clic en &quot;Subir fotos&quot; arriba para cargar una o varias imágenes de este producto.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                              Fotos {activePhotoGalleryTab === 'men' ? 'Hombre' : activePhotoGalleryTab === 'women' ? 'Mujer' : 'General'} ({activeList.length}):
                            </span>
                            <span className="text-[10px] text-[#6F6860]">
                              Usá las flechas para ordenar. La foto #1 es la portada.
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {activeList.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                className={`bg-white border rounded-xs p-2 flex flex-col justify-between space-y-2 relative transition-all ${
                                  idx === 0
                                    ? 'border-2 border-[#18231C] shadow-xs'
                                    : 'border-[#DCD4C9]'
                                }`}
                              >
                                <div className="w-full h-28 rounded-xs overflow-hidden bg-neutral-100 relative">
                                  <img
                                    src={imgUrl}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span
                                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${
                                      idx === 0 ? 'bg-[#18231C] text-amber-400' : 'bg-black/70 text-white'
                                    }`}
                                  >
                                    {idx === 0 ? '★ Portada' : `#${idx + 1}`}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#ECE5DC]">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => {
                                        if (idx === 0) return;
                                        const updated = [...activeList];
                                        const temp = updated[idx];
                                        updated[idx] = updated[idx - 1];
                                        updated[idx - 1] = temp;
                                        if (activePhotoGalleryTab === 'men') {
                                          setProductForm((prev) => ({ ...prev, imagesMen: updated }));
                                        } else if (activePhotoGalleryTab === 'women') {
                                          setProductForm((prev) => ({ ...prev, imagesWomen: updated }));
                                        } else {
                                          setProductForm((prev) => ({ ...prev, images: updated, image: updated[0] }));
                                        }
                                      }}
                                      className={`p-1 rounded-xs border text-xs cursor-pointer ${
                                        idx === 0 ? 'border-neutral-200 text-neutral-300 cursor-not-allowed' : 'border-[#DCD4C9] text-[#18231C] hover:bg-[#ECE5DC]'
                                      }`}
                                      title="Mover a la izquierda"
                                    >
                                      <ArrowLeft className="w-3 h-3" />
                                    </button>

                                    <button
                                      type="button"
                                      disabled={idx === activeList.length - 1}
                                      onClick={() => {
                                        if (idx === activeList.length - 1) return;
                                        const updated = [...activeList];
                                        const temp = updated[idx];
                                        updated[idx] = updated[idx + 1];
                                        updated[idx + 1] = temp;
                                        if (activePhotoGalleryTab === 'men') {
                                          setProductForm((prev) => ({ ...prev, imagesMen: updated }));
                                        } else if (activePhotoGalleryTab === 'women') {
                                          setProductForm((prev) => ({ ...prev, imagesWomen: updated }));
                                        } else {
                                          setProductForm((prev) => ({ ...prev, images: updated, image: updated[0] }));
                                        }
                                      }}
                                      className={`p-1 rounded-xs border text-xs cursor-pointer ${
                                        idx === activeList.length - 1 ? 'border-neutral-200 text-neutral-300 cursor-not-allowed' : 'border-[#DCD4C9] text-[#18231C] hover:bg-[#ECE5DC]'
                                      }`}
                                      title="Mover a la derecha"
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                    </button>

                                    {idx !== 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...activeList];
                                          const selected = updated.splice(idx, 1)[0];
                                          updated.unshift(selected);
                                          if (activePhotoGalleryTab === 'men') {
                                            setProductForm((prev) => ({ ...prev, imagesMen: updated }));
                                          } else if (activePhotoGalleryTab === 'women') {
                                            setProductForm((prev) => ({ ...prev, imagesWomen: updated }));
                                          } else {
                                            setProductForm((prev) => ({ ...prev, images: updated, image: updated[0] }));
                                          }
                                        }}
                                        className="p-1 rounded-xs border border-[#DCD4C9] text-amber-600 hover:bg-amber-50 text-xs cursor-pointer"
                                        title="Hacer Portada"
                                      >
                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                      </button>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...activeList];
                                      updated.splice(idx, 1);
                                      if (activePhotoGalleryTab === 'men') {
                                        setProductForm((prev) => ({ ...prev, imagesMen: updated }));
                                      } else if (activePhotoGalleryTab === 'women') {
                                        setProductForm((prev) => ({ ...prev, imagesWomen: updated }));
                                      } else {
                                        setProductForm((prev) => ({ ...prev, images: updated, image: updated[0] || '' }));
                                      }
                                    }}
                                    className="p-1 rounded-xs border border-red-200 text-red-600 hover:bg-red-50 text-xs cursor-pointer"
                                    title="Eliminar foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Firebase Error Notice if present */}
                  {firebaseErrorNotice && (
                    <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{firebaseErrorNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFirebaseErrorNotice(null)}
                        className="text-red-700 hover:text-red-900 font-bold text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#DCD4C9]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingProduct(false);
                        setEditingProduct(null);
                      }}
                      className="px-3 py-1.5 rounded-xs border border-[#DCD4C9] text-xs font-semibold hover:bg-neutral-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-1.5 rounded-xs bg-[#18231C] text-white text-xs font-bold uppercase tracking-wider hover:bg-black flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                      Guardar Producto
                    </button>
                  </div>
                </form>
              )}

              {/* Products Table */}
              <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18231C] text-[#F5F2EC] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Imagen</th>
                      <th className="p-3">Código</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Categoría / Sección</th>
                      <th className="p-3 text-right">Precio Lista</th>
                      <th className="p-3 text-right">Precio Empresa</th>
                      <th className="p-3 text-center">Stock</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {filteredProducts.map((p, pIdx) => (
                      <tr key={p.id || p.code || p.name || `p-row-${pIdx}`} className="hover:bg-[#FAF8F5]">
                        <td className="p-3">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-xs border border-[#DCD4C9]"
                          />
                        </td>
                        <td className="p-3 font-mono text-[11px] text-[#6F6860]">{p.code}</td>
                        <td className="p-3">
                          <div className="font-bold text-[#18231C]">{p.name}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.isUnisex && (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded-xs">
                                Unisex
                              </span>
                            )}
                            {p.isCorporateOnly && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-xs">
                                Línea Industrial (Corp)
                              </span>
                            )}
                            {Boolean(p.specialSizeRanges && p.specialSizeRanges.length > 0) && (
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 px-1.5 py-0.2 rounded-xs">
                                {p.specialSizeRanges?.length} Talles Especiales
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-[#6F6860]">{p.category} · {p.section}</td>
                        <td className="p-3 text-right font-bold text-[#18231C]">
                          ${p.price.toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 text-right font-bold text-blue-800">
                          ${(p.corporatePrice || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleProductStock(p.id, p.inStock !== false)}
                            className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                              p.inStock !== false
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                            }`}
                            title={p.inStock !== false ? 'En Stock (Visible en catálogo). Clic para marcar Sin Stock.' : 'Sin Stock (Oculto en catálogo). Clic para marcar En Stock.'}
                          >
                            {p.inStock !== false ? '● En Stock' : '○ Sin Stock'}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setStandardSizesInput(p.standardSizes || (Array.isArray(p.availableSizes) ? p.availableSizes.join(', ') : '38, 40, 42, 44, 46, 48'));
                                setFirebaseErrorNotice(null);
                                setNewPhotoUrl('');
                                setNewPhotoUrlMen('');
                                setNewPhotoUrlWomen('');
                                setProductForm({
                                  ...p,
                                  availableColors: Array.isArray(p.availableColors) ? [...p.availableColors] : [],
                                  availableSizes: Array.isArray(p.availableSizes) && p.availableSizes.length > 0 ? [...p.availableSizes] : ['CH', 'M', 'G', 'MG'],
                                  standardSizes: p.standardSizes || (Array.isArray(p.availableSizes) ? p.availableSizes.join(', ') : ''),
                                  promotionTag: p.promotionTag || '',
                                  isUnisex: Boolean(p.isUnisex),
                                  isCorporateOnly: Boolean(p.isCorporateOnly),
                                  specialSizeRanges: p.specialSizeRanges ? JSON.parse(JSON.stringify(p.specialSizeRanges)) : [],
                                  images: Array.isArray(p.images) && p.images.length > 0 ? [...p.images] : (p.image ? [p.image] : []),
                                  imagesMen: Array.isArray(p.imagesMen) ? [...p.imagesMen] : [],
                                  imagesWomen: Array.isArray(p.imagesWomen) ? [...p.imagesWomen] : [],
                                  inStock: p.inStock !== false,
                                });
                                setIsCreatingProduct(false);
                              }}
                              className="p-1 text-[#6F6860] hover:text-[#18231C]"
                              title="Editar producto"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.code, p.name)}
                              className="p-1 text-[#6F6860] hover:text-red-600"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SUCURSALES */}
          {activeTab === 'branches' && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCD4C9]">
                <div>
                  <h3 className="font-display text-base sm:text-lg uppercase tracking-wider text-[#18231C]">
                    PUNTOS DE VENTA & SUCURSALES ({branches.length})
                  </h3>
                  <p className="text-xs text-[#6F6860] mt-0.5">
                    Administrá locales en Gran Mendoza. Mostrados a los clientes en el pie de página y al cotizar por WhatsApp.
                  </p>
                </div>

                <button
                  id="btn-add-branch"
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setBranchForm({
                      name: '',
                      address: '',
                      city: 'Gran Mendoza',
                      phone: '',
                      whatsappNumber: '',
                      openingHours: 'Lunes a Viernes de 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30',
                      mapUrl: '',
                      isPrimary: branches.length === 0,
                    });
                    setIsCreatingBranch(true);
                  }}
                  style={{
                    backgroundColor: theme.accentColor || '#FDB813',
                    color: theme.buttonTextColor || '#18231C'
                  }}
                  className="px-4 py-2 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs hover:brightness-110 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Nueva Sucursal
                </button>
              </div>

              {/* Add / Edit Branch Form Modal / Drawer */}
              {(isCreatingBranch || editingBranch) && (
                <form
                  onSubmit={handleSaveBranch}
                  className="bg-white p-5 sm:p-6 rounded-xs border-2 border-[#18231C] shadow-lg space-y-4 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
                    <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-4 h-4" style={{ color: theme.accentColor || '#FDB813' }} />
                      {editingBranch ? `Editar Sucursal: ${editingBranch.name}` : 'Nueva Sucursal en Gran Mendoza'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranch(null);
                        setIsCreatingBranch(false);
                      }}
                      className="text-neutral-400 hover:text-neutral-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Nombre del Local *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej: Pampero Luján de Cuyo / Pampero San Martín"
                        value={branchForm.name || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Ciudad / Departamento *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej: Luján de Cuyo, Mendoza"
                        value={branchForm.city || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Dirección Completa *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej: San Martín 850"
                        value={branchForm.address || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Teléfono de Atención
                      </label>
                      <input
                        type="text"
                        placeholder="ej: 261 498-1234"
                        value={branchForm.phone || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        WhatsApp de Ventas
                      </label>
                      <input
                        type="text"
                        placeholder="ej: +54 9 261 527-6713"
                        value={branchForm.whatsappNumber || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, whatsappNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Horarios de Atención
                      </label>
                      <input
                        type="text"
                        placeholder="ej: Lunes a Viernes 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30"
                        value={branchForm.openingHours || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, openingHours: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#4A453F] mb-1 uppercase tracking-wider">
                        Enlace a Google Maps (URL)
                      </label>
                      <input
                        type="url"
                        placeholder="ej: https://maps.google.com/?q=..."
                        value={branchForm.mapUrl || ''}
                        onChange={(e) => setBranchForm({ ...branchForm, mapUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#18231C]">
                        <input
                          type="checkbox"
                          checked={Boolean(branchForm.isPrimary)}
                          onChange={(e) => setBranchForm({ ...branchForm, isPrimary: e.target.checked })}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: theme.accentColor || '#FDB813' }}
                        />
                        <span>¿Es Casa Central / Sucursal Principal?</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-[#DCD4C9]">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranch(null);
                        setIsCreatingBranch(false);
                      }}
                      className="px-4 py-2 rounded-xs border border-[#DCD4C9] text-xs font-semibold text-[#6F6860] hover:bg-neutral-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: theme.primaryColor || '#18231C',
                        color: '#FFFFFF'
                      }}
                      className="px-6 py-2 rounded-xs text-xs font-bold uppercase tracking-wider hover:brightness-110 shadow-xs"
                    >
                      {editingBranch ? 'Actualizar Sucursal' : 'Guardar Sucursal'}
                    </button>
                  </div>
                </form>
              )}

              {/* Branches Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((b) => (
                  <div 
                    key={b.id} 
                    style={{ borderColor: theme.cardBorderColor || '#DCD4C9' }}
                    className="bg-white p-5 rounded-xs border space-y-3 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" style={{ color: theme.iconColor || theme.accentColor || '#FDB813' }} />
                        <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">{b.name}</h4>
                      </div>
                      {b.isPrimary && (
                        <span 
                          style={{ backgroundColor: theme.primaryColor || '#18231C' }}
                          className="text-[10px] uppercase font-bold text-[#F5F2EC] px-2.5 py-0.5 rounded-xs tracking-wider"
                        >
                          Casa Central
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-[#6F6860]">
                      <p className="flex items-center gap-2 text-[#18231C] font-semibold">
                        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: theme.iconColor || theme.accentColor || '#FDB813' }} />
                        {b.address}, {b.city}
                      </p>
                      {b.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-[#6F6860] shrink-0" />
                          Tel: <strong>{b.phone}</strong>
                        </p>
                      )}
                      {b.whatsappNumber && (
                        <p className="flex items-center gap-2">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          WhatsApp: <strong>{b.whatsappNumber}</strong>
                        </p>
                      )}
                      <p className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#6F6860] shrink-0 mt-0.5" />
                        <span>Horario: {b.openingHours}</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-between">
                      {b.mapUrl ? (
                        <a
                          href={b.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 uppercase tracking-wider underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Ver Mapa
                        </a>
                      ) : <span />}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBranch(b);
                            setBranchForm(b);
                            setIsCreatingBranch(false);
                          }}
                          className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1 cursor-pointer border border-[#DCD4C9]"
                        >
                          <Edit3 className="w-3.5 h-3.5" style={{ color: theme.accentColor || '#FDB813' }} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(b.id)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1 cursor-pointer border border-red-200"
                          title="Eliminar sucursal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: CUENTAS CREADAS */}
          {activeTab === 'users' && (
            <AdminUsersTab
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 9: GESTIÓN DE COLORES & TALLES */}
          {activeTab === 'variants' && (
            <AdminVariantsTab
              products={products}
              categories={currentHierarchy}
              onUpdateProducts={onUpdateProducts}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 10: BANDEJA DE COTIZACIONES */}
          {activeTab === 'quotes' && (
            <AdminQuotesTab />
          )}

          {/* TAB 11: CONFIGURACIÓN PORTAL DE TALLES */}
          {activeTab === 'sizing' && (
            <AdminSizingPortalConfigTab
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 12: CONFIGURACIÓN SIMULADOR DE BORDADO */}
          {activeTab === 'simulator' && (
            <AdminUniformSimulatorConfigTab
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 12: SEGURIDAD & CLAVES */}
          {activeTab === 'security' && (
            <AdminSecurityTab
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 13: MÉTRICAS & BÚSQUEDAS */}
          {activeTab === 'analytics' && (
            <AdminAnalyticsTab />
          )}

          {/* TAB 14: VENDEDORES & LOCALES */}
          {activeTab === 'sellers' && (
            <AdminSellersTab
              branches={branches}
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          {/* TAB 15: CONFIGURACIÓN DE NOTIFICACIONES */}
          {activeTab === 'notifications' && (
            <AdminNotificationsTab
              triggerSaveNotice={triggerSaveNotice}
            />
          )}

          </AdminErrorBoundary>
        </div>
      </div>

      {/* Bulk Excel / Google Sheets Import Modal */}
      <AdminBulkExcelImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        existingProducts={products}
        onImportSuccess={(newCatalog) => {
          onUpdateProducts(newCatalog);
          triggerSaveNotice();
        }}
      />
    </div>
  );
};
