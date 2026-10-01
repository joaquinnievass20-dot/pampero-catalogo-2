export type ClientType = 'consumidor_final' | 'empresa';

export interface Address {
  street: string;
  number: string;
  postalCode: string;
  city: string;
}

export interface ConsumerClient {
  fullName: string;
  email: string;
  phone: string;
  address: Address;
}

export interface CompanyClient {
  repFullName: string;
  companyName: string;
  cuit: string;
  institutionalEmail: string;
  institutionalPhone: string;
  address: Address;
}

export interface UserSession {
  id?: string;
  email?: string;
  role: 'admin' | 'client' | 'employee';
  clientType?: ClientType | 'consumidor' | 'empresa' | 'empleado';
  clientData?: ConsumerClient | CompanyClient | any;
  permissions?: string[];
  loggedAt?: string;
  quoteHistory?: ReceivedQuote[];
}

export interface Seller {
  id: string;
  name: string;
  branch: string; // 'Maipú' | 'Ciudad' | 'Luján' | 'Todas'
  phone?: string;
  email?: string;
  active: boolean;
}

export interface EmployeeAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'employee';
  allowedTabs: string[]; // e.g. ['promos', 'mass_images', 'prices', 'coupons', 'variants', 'products', 'branches', 'quotes', 'users', 'analytics', 'crm']
  crmTabs?: ('visits' | 'board' | 'suppliers' | 'costs')[]; // CRM specific tab permissions: visits, board, suppliers, costs
  branch?: string; // 'Maipú' | 'Ciudad' | 'Luján' | 'Todas'
  sellerName?: string;
  crmScope?: 'all' | 'branch_only' | 'own_only'; // 'all': todas las empresas, 'branch_only': sucursal, 'own_only': solo su cartera
  createdAt: string;
  active: boolean;
}

export interface NotificationSettings {
  staleQuoteDays: number; // default 7
  notifyNewQuotes: boolean; // default true
  notifyStaleOrders: boolean; // default true
  notifyBlockedOrders: boolean; // default true
  notifyPendingVisits: boolean; // default true
}

export interface ReceivedQuote {
  id: string;
  date: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientType: string;
  totalUnits: number;
  totalEstimated: number;
  items: Array<{
    code: string;
    name: string;
    quantity: number;
    size: string;
    color: string;
    unitPrice: number;
  }>;
  observations?: string;
  rawText: string;
}

export type MainCategory = 'Hombre' | 'Mujer' | 'Infantil' | 'Venta Corporativa' | string;

export interface SpecialSizeRange {
  id: string;
  suffix?: string; // e.g. "-1", "-2"
  rangeLabel: string; // e.g. "Talles Especiales 50 al 60", "XXL a 4XL"
  sizes: string[]; // e.g. ["50", "52", "54", "56", "58", "60"]
  price: number; // Adjusted Retail Price
  corporatePrice?: number; // Adjusted Corporate Price
  fromSize?: string;
  toSize?: string;
  sizeRangeLabel?: string;
  minSize?: string;
  maxSize?: string;
  label?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: MainCategory;
  section: string; // e.g., 'Urbano', 'Industria', 'Accesorios', 'Aventura', 'Rural' (or 'General')
  subCategory: string; // e.g., 'Abrigos', 'Pantalones y bermudas', 'Bombachas', etc.
  description: string;
  features: string[];
  price: number;
  corporatePrice?: number;
  discountPercentage?: number;
  promotionTag?: string; // e.g., 'Temporada 2026', 'Liquidación', 'Lanzamiento'
  image: string;
  images?: string[]; // Multiple photos ordered by position
  imagesMen?: string[]; // Galería Hombre para productos Unisex
  imagesWomen?: string[]; // Galería Mujer para productos Unisex
  imagesByColor?: Record<string, string>; // Maps color name or code (e.g. "C4" or "Azul Francia") to image URL
  additionalImages?: Array<{ url: string; colorCode?: string; position: number }>;
  availableColors: string[];
  availableSizes: string[];
  standardSizes?: string; // Talles estándar ingresados en formato texto (ej: "38, 40, 42" o "S, M, L, XL")
  sizeType?: 'letters' | 'numbers'; // Letras (S, M, L, XL...) o Números (38, 40, 42... / 39, 40, 41...)
  specialSizeRanges?: SpecialSizeRange[]; // Variantes o rangos de talles especiales diferenciados con sufijos (-1, -2) y precios ajustados
  isUnisex?: boolean; // Si es Unisex, se muestra automáticamente tanto en Hombre como en Mujer
  isCorporateOnly?: boolean; // Si es exclusivo de Venta Corporativa / Línea Industrial
  inStock: boolean;
  isFeatured?: boolean;
}

export interface ColorCodeDef {
  code: string; // e.g. "C1", "C2", "C4"
  name: string; // e.g. "Azul Francia"
  hex: string;  // e.g. "#1E40AF"
  description?: string;
}

export interface ProductMetric {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  clickCount: number;
  searchCount: number;
  lastInteracted: string;
}

export interface PromotionButton {
  id: string;
  label: string; // e.g., "VER ESPECIAL CAMPO", "CUENTA EMPRESA"
  actionType: 'catalog' | 'category' | 'whatsapp' | 'url' | 'auth';
  actionValue?: string; // Tag, category name, URL or message
  style?: 'primary' | 'secondary' | 'outline';
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  bannerImage: string;
  categoryFilter?: string;
  tagFilter: string;
  discountOnly?: boolean;
  discountPercentage?: number;
  associatedProductCodes?: string[]; // IDs or codes of associated products
  active: boolean;
  textColor?: string; // Color de la fuente del título/textos (ej. #FFFFFF)
  fontSize?: string; // Tamaño de la fuente del título (ej. 64px, 72px, 4rem)
  subtitleColor?: string; // Color de la fuente del subtítulo (ej. #DCD4C9)
  subtitleFontSize?: string; // Tamaño de la fuente del subtítulo (ej. 16px, 18px)
  primaryBtnText?: string;
  buttons?: PromotionButton[]; // Botones configurables dinámicos
}

export interface RegisteredUser {
  id: string;
  type: 'consumidor' | 'empresa' | 'admin';
  name: string;
  repName?: string;
  email: string;
  phone: string;
  cuitOrDni?: string;
  address?: string;
  city?: string;
  createdAt: string;
  status: 'active' | 'pending' | 'suspended';
  pricingTier?: 'Consumidor Final' | 'Corporativo / Mayorista';
  notes?: string;
}

export interface DiscountCoupon {
  id: string;
  code: string; // e.g. "edemsa12026", "PAMPERO15"
  description?: string; // e.g. "Descuento corporativo exclusivo EDEMSA"
  discountType: 'percentage' | 'fixed';
  discountValue: number; // e.g. 15 (%) or 25000 ($)
  expirationDate?: string; // YYYY-MM-DD
  expiresAt?: string; // YYYY-MM-DD
  assignedCompany?: string; // e.g. "Edemsa"
  minOrderAmount?: number;
  usageCount?: number;
  usedCount?: number;
  maxUses?: number;
  active?: boolean;
  isActive?: boolean;
}

export interface BranchLocation {
  id: string;
  name: string;
  address: string;
  zone?: string;
  city?: string;
  phone: string;
  whatsappNumber?: string;
  hours?: string;
  openingHours?: string;
  isPrimary?: boolean;
  mapsUrl?: string;
  mapUrl?: string;
}

export interface LookbookHotspot {
  id: string;
  productId: string;        // matches Product.id or Product.code
  x: number;                // percentage 0 to 100
  y: number;                // percentage 0 to 100
  label?: string;           // e.g. "Camisa de Trabajo"
  colorCode?: string;       // optional color indicator
}

export interface LookbookItem {
  id: string;
  title: string;            // e.g. "Campaña Campo & Cosecha"
  subtitle?: string;        // e.g. "Equipamiento de alta resistencia"
  imageUrl: string;         // image url (campaign photo, worker full-body, etc.)
  hotspots: LookbookHotspot[];
  season?: string;          // e.g. "Temporada 2026"
  order?: number;
}

export interface ThemeConfig {
  primaryColor: string; // e.g., #18231C
  accentColor: string;  // e.g., #FDB813
  secondaryColor: string; // e.g., #DCD4C9
  backgroundColor?: string; // e.g., #F5F2EC
  textColor?: string; // e.g., #18231C
  headerBgColor?: string; // e.g., #18231C
  headerTextColor?: string; // e.g., #F5F2EC
  seasonBadgeBg?: string; // e.g., #18231C
  seasonBadgeText?: string; // e.g., #F5F2EC
  discountBadgeBg?: string; // e.g., #FDB813
  discountBadgeText?: string; // e.g., #18231C
  cardBgColor?: string; // e.g., #ECE5DC
  cardBorderColor?: string; // e.g., #DCD4C9
  hoverAccentColor?: string; // e.g., #E0A310
  iconColor?: string; // e.g., #FDB813
  buttonTextColor?: string; // e.g., #FFFFFF
  panelBgColor?: string; // Admin panel background
  panelTextColor?: string;
  panelAccentColor?: string;
  panelBorderColor?: string;
  logoHeight?: number; // e.g. 40px default, up to 90px
  logoOptimalBackground?: 'light' | 'dark'; // Background that best fits the original uploaded logo (default 'light')
  logoAutoInvert?: boolean; // Automatically apply negative color on opposing backgrounds (default true)
  fontFamily: string; // 'Bebas Neue' | 'Barlow' | 'Montserrat' | 'Oswald' | 'Playfair Display' | 'Anton' | 'Roboto Condensed' | 'Archivo Black' | 'Syne' | 'Inter'
  customLogoUrl?: string;
  logoUrl?: string;
  brandTagline: string;
  whatsappNumber: string;
  instagramHandle: string;
  emailContact: string;
  screenTexts?: {
    landingTitle1?: string;
    landingTitle2?: string;
    landingSubtitle?: string;
    landingButtonText?: string;
    landingTopNotice?: string;
    catalogTitle?: string;
    catalogSubtitle?: string;
    quoteEmail?: string;
    quotePhone?: string;
    quoteButtonText?: string;
    quoteObservationsPlaceholder?: string;
    authTitle?: string;
    authSubtitle?: string;
    footerAbout?: string;
    footerPhone?: string;
    footerEmail?: string;
    footerAddress?: string;
  };
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  specialSizeRange?: SpecialSizeRange;
  unitPriceAdjusted?: number;
  codeWithSuffix?: string;
}

export interface QuantityDiscountRule {
  id: string;
  name: string; // e.g., "Mayorista Corporativo +20 unid."
  minQuantity: number; // e.g. 5, 10, 20, 50
  discountPercentage: number; // e.g. 10, 15, 20
  category?: string; // 'Todas' | 'Hombre' | 'Mujer' | 'Infantil' | 'Venta Corporativa'
  subCategory?: string; // 'Todas' or specific subcategory name
  applicableCategory?: string;
  applicableSubCategory?: string;
  active?: boolean;
  isActive?: boolean;
  description?: string;
}

export type VolumeDiscountRule = QuantityDiscountRule;
export type CategoryHierarchyItem = {
  name: MainCategory;
  description?: string;
  sections: Array<{
    name: string;
    subCategories: string[];
  }>;
};



// --- CRM & MANAGEMENT TYPES ---
export type CRMOrderStatus = 'cotizacion' | 'sena_50' | 'produccion' | 'listo' | 'entregado' | 'cancelado';

export interface CRMOrder {
  id: string;
  orderNumber?: string; // Correlative integer order #1, #2, #3...
  date: string;
  quoteId?: string;
  clientName: string;
  clientType: 'consumidor_final' | 'empresa';
  clientPhone?: string;
  clientEmail?: string;
  channel?: 'WhatsApp' | 'Excel' | 'Web';
  status: CRMOrderStatus;
  seller: string;
  branch: string;
  totalUnits: number;
  totalEstimated: number;
  delayDays?: number;
  observations?: string;
  blockReason?: string;
  items?: any[];
  updatedAt: string;
}

export type LeadVisitStatus = 'programada' | 'realizada' | 'presupuesto_enviado' | 'cerrada' | 'cancelada';

export interface LeadVisit {
  id: string;
  date: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  seller: string; // 'Itatí' | 'Guada' | 'Carolina' | 'Gustavo'
  branch: string;
  status: LeadVisitStatus;
  objective: string;
  nextStep: string;
  nextStepDate?: string;
  estimatedUnits?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SupplierOrderStatus = 'borrador' | 'enviado' | 'en_fabricacion' | 'despachado' | 'recibido_completo' | 'recibido_incompleto';

export interface SupplierOrder {
  id: string;
  orderNumber: string;
  supplierName: string; // 'Macata' | 'Pampero Central' | 'Calzado Confort' | 'Otro'
  orderDate: string;
  estimatedArrivalDate: string;
  actualArrivalDate?: string;
  status: SupplierOrderStatus;
  itemsCount: number;
  totalAmount: number;
  itemsDescription: string;
  trackingNumber?: string;
  branchDestination: string;
  responsibleStaff: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSizeEntry {
  id: string;
  campaignId: string;
  companyName: string;
  employeeName: string;
  employeeDni: string;
  department: string;
  gender?: 'Hombre' | 'Mujer';
  shirtSize?: string;
  pantsSize?: string;
  footwearSize?: string;
  jacketSize?: string;
  notes?: string;
  submittedAt: string;
}

export interface SizingCampaign {
  id: string;
  companyName: string;
  cuit?: string;
  contactName: string;
  contactPhone: string;
  active: boolean;
  requiredGarments: string[]; // ['Camisa/Chomba', 'Pantalón/Bombacha', 'Calzado de Seguridad', 'Campera Térmica']
  createdAt: string;
  expiresAt: string;
  entriesCount?: number;
}

// --- COST CONTROL & EXPENSES (CONTROL DE COSTOS) ---
export type ExpenseType = 'Fijo' | 'Variable';

export type ExpenseCategory = 
  | 'Alquiler' 
  | 'Sueldos base'
  | 'Sueldos' 
  | 'Impuestos/Servicios'
  | 'Impuestos' 
  | 'Servicios (Luz/Gas/Agua/Internet)' 
  | 'Fletes'
  | 'Insumos/Embalaje'
  | 'Mantenimiento' 
  | 'Viáticos'
  | 'Comisiones'
  | 'Mercadería e Insumos' 
  | 'Logística y Envíos' 
  | 'Marketing y Publicidad' 
  | 'Otros Gastos';

export interface CRMExpense {
  id: string;
  date: string; // YYYY-MM-DD
  branch: 'Maipú' | 'Ciudad' | 'Luján' | string;
  type: ExpenseType; // 'Fijo' | 'Variable'
  category: ExpenseCategory | string;
  amount: number;
  detail: string;
  registeredBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CostCategoryConfig {
  id: string;
  name: string;
  defaultType: ExpenseType; // 'Fijo' | 'Variable'
  isSystem?: boolean;
  createdAt?: string;
}
