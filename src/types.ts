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
  nearestBranch?: string;
  companyLocation?: string;
  locationUrl?: string;
}

export interface CompanyClient {
  repFullName: string;
  companyName: string;
  cuit: string;
  institutionalEmail: string;
  institutionalPhone: string;
  address: Address;
  nearestBranch?: string;
  companyLocation?: string;
  locationUrl?: string;
}

export interface UserSession {
  id?: string;
  email?: string;
  name?: string;
  role: 'admin' | 'client' | 'employee';
  clientType?: ClientType | 'consumidor' | 'empresa' | 'empleado';
  clientData?: ConsumerClient | CompanyClient | any;
  permissions?: string[];
  loggedAt?: string;
  quoteHistory?: ReceivedQuote[];
  totpSecret?: string;
  mfaEnrolled?: boolean;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  password?: string;
  branch?: string;
  sellerName?: string;
  sellerRole?: 'admin' | 'encargado' | 'local' | 'vendedor';
  crmScope?: 'all' | 'branch_only' | 'own_only';
  canControlTasks?: boolean;
}

export interface Seller {
  id: string;
  name: string;
  branch: string; // 'Maipú' | 'Ciudad' | 'Luján' | 'Todas'
  phone?: string;
  email?: string;
  active: boolean;
}

export type CRMTabKey = 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers' | 'costs';

export interface EmployeeAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'employee';
  allowedTabs: string[]; // e.g. ['promos', 'mass_images', 'prices', 'coupons', 'variants', 'products', 'branches', 'quotes', 'users', 'analytics', 'crm']
  crmTabs?: CRMTabKey[]; // CRM specific tab permissions
  crmTasksConfigured?: boolean;
  crmCalendarConfigured?: boolean;
  canControlTasks?: boolean; // Permite auditar tareas y cargar fotos de respaldo
  sellerRole?: 'admin' | 'encargado' | 'local' | 'vendedor';
  branch?: string; // 'Maipú' | 'Ciudad' | 'Luján' | 'Todas'
  sellerName?: string;
  crmScope?: 'all' | 'branch_only' | 'own_only'; // 'all': todos los locales/empresas, 'branch_only': sucursal, 'own_only': solo su cartera
  avatarUrl?: string;
  mustChangePassword?: boolean;
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
  linkedHolidayId?: string; // Feriado o fecha comercial vinculada
  scheduledStartDate?: string; // YYYY-MM-DD opcional
  scheduledEndDate?: string; // YYYY-MM-DD opcional
}

export interface RegisteredUser {
  id: string;
  type: 'consumidor' | 'empresa' | 'admin' | 'empleado' | 'vendedor';
  role?: 'admin' | 'employee' | 'client';
  name: string;
  repName?: string;
  username?: string;
  email: string;
  password?: string;
  initialPassword?: string;
  phone: string;
  cuitOrDni?: string;
  address?: string;
  city?: string;
  branch?: string;
  nearestBranch?: string;
  companyLocation?: string;
  locationUrl?: string;
  sellerRole?: 'admin' | 'encargado' | 'local' | 'vendedor';
  crmScope?: 'all' | 'branch_only' | 'own_only';
  allowedTabs?: string[];
  crmTabs?: CRMTabKey[];
  canControlTasks?: boolean;
  createdAt: string;
  updatedAt?: string;
  status: 'active' | 'pending' | 'suspended';
  pricingTier?: 'Consumidor Final' | 'Corporativo / Mayorista' | 'Administrador';
  avatarUrl?: string;
  mustChangePassword?: boolean;
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

export interface SiteTextsConfig {
  // 1. Menú Principal Superior (Navbar)
  announcementBarText?: string;
  searchPlaceholder?: string;
  quoteButtonText?: string;
  loginButtonText?: string;
  navHombreText?: string;
  navMujerText?: string;
  navInfantilText?: string;
  navCorporativaText?: string;
  navPromosText?: string;
  
  // 2. Portada & Hero
  heroTitleLine1?: string;
  heroTitleLine2?: string;
  heroSubtitle?: string;
  heroPrimaryBtnText?: string;
  heroCorporateBtnText?: string;
  heroWhatsAppBtnText?: string;
  landingTopNotice?: string;
  
  // 3. Catálogo Público (Filtros, Grilla, Tarjetas de Producto)
  catalogTitle?: string;
  catalogSubtitle?: string;
  catalogSearchPlaceholder?: string;
  viewProductCardText?: string;
  addToQuoteBtnText?: string;
  whatsappConsultBtnText?: string;

  // 4. Ficha de Producto (Detalle y Modal)
  productDetailSizeLabel?: string;
  productDetailColorLabel?: string;
  productDetailAddBtnText?: string;
  productDetailWhatsappBtnText?: string;
  productDetailGuaranteeText?: string;
  
  // 5. Ventana Emergente de Mi Pedido (QuoteDrawer)
  quoteDrawerTitle?: string;
  quoteDrawerSendBtnText?: string;
  quoteDrawerObservationsPlaceholder?: string;
  emptyCartTitle?: string;
  emptyCartSubtitle?: string;

  // 6. Pantalla/Modal de Login y Registro
  authLoginTitle?: string;
  authLoginSubtitle?: string;
  authLoginBtnText?: string;
  authRegisterTitle?: string;
  authRegisterSubtitle?: string;
  authToRegisterLinkText?: string;
  authToStaffLinkText?: string;

  // 7. Hub de Trabajo / Menú Principal Interno
  hubTitle?: string;
  hubSubtitle?: string;
  hubCrmCardText?: string;
  hubAdminCardText?: string;
  hubCatalogCardText?: string;
  hubLogoutBtnText?: string;

  // 8. Módulo CRM y Tableros Kanban
  crmTitle?: string;
  crmSubtitle?: string;
  crmColCotizacionText?: string;
  crmColProduccionText?: string;
  crmColListoText?: string;
  crmNewOrderBtnText?: string;

  // 9. Servicios Corporativos (Portal de Talles, Simulador)
  sizingPortalTitle?: string;
  sizingPortalSubtitle?: string;
  uniformSimulatorTitle?: string;
  uniformSimulatorSubtitle?: string;
  corporateQuoteBtnText?: string;

  // 10. Pie de Página y Contacto (Footer)
  footerTagline?: string;
  footerAbout?: string;
  footerPhone?: string;
  footerEmail?: string;
  footerAddress?: string;

  // Compatibilidad con campos previos de screenTexts
  landingTitle1?: string;
  landingTitle2?: string;
  landingSubtitle?: string;
  landingButtonText?: string;
  quoteEmail?: string;
  quotePhone?: string;
  quoteObservationsPlaceholder?: string;
  authTitle?: string;
  authSubtitle?: string;
}

export interface ThemeConfig {
  primaryColor: string; // e.g., #18231C
  accentColor: string;  // e.g., #FDB813
  secondaryColor: string; // e.g., #DCD4C9
  backgroundColor?: string; // e.g., #F5F2EC
  textColor?: string; // e.g., #18231C
  headerBgColor?: string; // e.g., #FFFFFF (Navbar)
  headerTextColor?: string; // e.g., #18231C
  headerAccentColor?: string; // Color de acento/enlace activo exclusivo del Navbar
  headerBorderColor?: string; // Color de borde inferior del Navbar
  hubBgColor?: string; // Menú de Administrador/Empleados (Hub y CRM)
  hubTextColor?: string; // Color de texto en Menú Administrador
  catalogTitleColor?: string; // Textos y títulos del catálogo
  catalogTextColor?: string; // Textos descriptivos del catálogo
  secondaryTextColor?: string; // Color para textos secundarios/descriptivos
  cardPriceColor?: string; // Color específico de precio en tarjetas
  buttonBgColor?: string; // Color de fondo de botones generales
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

  // --- VARIABLES AISLADAS POR VENTANA (AISLAMIENTO ABSOLUTO) ---
  // 1. Menú Principal Superior (Navbar)
  navbarBgColor?: string;
  navbarTextColor?: string;
  navbarSecondaryTextColor?: string;
  navbarButtonBg?: string;
  navbarButtonTextColor?: string;
  navbarButtonHoverBg?: string;
  navbarBorderColor?: string;

  // 2. Catálogo Público (Filtros, Grilla, Tarjetas de Producto)
  catalogBgColor?: string;
  catalogSecondaryTextColor?: string;
  catalogCardBgColor?: string;
  catalogCardBorderColor?: string;
  catalogCardPriceColor?: string;
  catalogButtonBg?: string;
  catalogButtonTextColor?: string;
  catalogButtonHoverBg?: string;

  // 3. Ficha de Producto (Detalle y Modal)
  productDetailBgColor?: string;
  productDetailTextColor?: string;
  productDetailSecondaryTextColor?: string;
  productDetailBorderColor?: string;
  productDetailButtonBg?: string;
  productDetailButtonTextColor?: string;
  productDetailButtonHoverBg?: string;

  // 4. Ventana Emergente de "Mi Pedido" (QuoteDrawer)
  quoteDrawerBgColor?: string;
  quoteDrawerTextColor?: string;
  quoteDrawerSecondaryTextColor?: string;
  quoteDrawerBorderColor?: string;
  quoteDrawerButtonBg?: string;
  quoteDrawerButtonTextColor?: string;
  quoteDrawerButtonHoverBg?: string;
  quoteDrawerButtonText?: string;

  // 5. Pantalla/Modal de Login y Registro (Auth)
  loginModalBgColor?: string;
  loginModalTextColor?: string;
  loginModalSecondaryTextColor?: string;
  loginModalBorderColor?: string;
  loginModalButtonBg?: string;
  loginModalButtonTextColor?: string;
  loginModalButtonHoverBg?: string;
  loginModalButtonText?: string;

  // 6. Hub de Trabajo / Menú Principal Interno
  hubSecondaryTextColor?: string;
  hubCardBgColor?: string;
  hubBorderColor?: string;
  hubAccentColor?: string;
  hubButtonBg?: string;
  hubButtonTextColor?: string;
  hubButtonHoverBg?: string;

  // 7. Módulo CRM y Tableros Kanban
  crmHeaderBgColor?: string;
  crmHeaderTextColor?: string;
  crmSecondaryTextColor?: string;
  crmHeaderBorderColor?: string;
  crmCardBgColor?: string;
  crmCardTextColor?: string;
  crmCardBorderColor?: string;
  crmCardHeaderBg?: string;
  crmButtonBg?: string;
  crmButtonTextColor?: string;
  crmButtonHoverBg?: string;

  // 8. Servicios Corporativos (Portal de Talles, Simulador)
  corporateServicesBgColor?: string;
  corporateServicesTextColor?: string;
  corporateServicesSecondaryTextColor?: string;
  corporateServicesBorderColor?: string;
  corporateServicesButtonBg?: string;
  corporateServicesButtonTextColor?: string;
  corporateServicesButtonHoverBg?: string;

  // 9. Footer (Pie de página)
  footerBgColor?: string;
  footerTextColor?: string;
  footerSecondaryTextColor?: string;
  footerBorderColor?: string;
  footerAccentColor?: string;
  footerButtonBg?: string;
  footerButtonTextColor?: string;
  footerButtonHoverBg?: string;

  // Secciones adicionales existentes
  announcementBgColor?: string;
  announcementTextColor?: string;
  announcementAccentColor?: string;
  heroBgColor?: string;
  heroTextColor?: string;
  heroButtonBg?: string;
  heroButtonText?: string;
  heroAccentColor?: string;
  cardTextColor?: string;
  cardButtonBg?: string;
  cardButtonText?: string;

  siteTexts?: SiteTextsConfig;
  screenTexts?: SiteTextsConfig;
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

// --- AUDIT LOGS (REGISTRO DE AUDITORÍA) ---
export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO date
  userEmail?: string;
  userName?: string;
  userRole?: string;
  user?: string; // alias
  role?: string; // alias
  module: 'Catálogo' | 'Precios' | 'CRM' | 'Usuarios' | 'Sucursales' | 'Promociones' | 'Portal Talles' | 'Configuración' | 'Perfil' | string;
  action: 'Crear' | 'Editar' | 'Eliminar' | 'Estado' | 'Subir Archivo' | 'Importación' | 'Seguridad' | string;
  details?: string;
  detail?: string; // alias
  targetId?: string;
  metadata?: Record<string, any>;
}

// --- CRM & MANAGEMENT TYPES ---
export type CRMOrderStatus = 'cotizacion' | 'sena_50' | 'produccion' | 'listo' | 'entregado' | 'cancelado';

export interface CRMOrder {
  id: string;
  orderNumber?: string; // Structured tracking code [E|C][M|C|L][DDMM][00000] or legacy #N
  trackingCode?: string; // Persistent tracking ID across Visitas & Seguimiento
  originVisitId?: string;
  date: string;
  createdAt?: string;
  quoteId?: string;
  clientName: string;
  clientType: 'consumidor_final' | 'empresa';
  clientPhone?: string;
  clientEmail?: string;
  companyLocation?: string;
  locationUrl?: string;
  channel?: 'WhatsApp' | 'Excel' | 'Web';
  status: CRMOrderStatus;
  columnId?: string;
  step?: string;
  seller: string;
  branch: string;
  totalUnits: number;
  totalEstimated: number;
  delayDays?: number;
  observations?: string;
  observationDate?: string; // YYYY-MM-DD fecha de la observación
  reminderDate?: string; // YYYY-MM-DD fecha para recordatorio/calendario
  reminderTime?: string; // HH:mm opcional
  reminderNote?: string;
  observationHistory?: ObservationHistoryEntry[];
  blockReason?: string;
  items?: any[];
  updatedAt: string;
  userId?: string;
  quotePdfUrl?: string; // Archivo PDF oficial adjunto por ventas/empleado
  quotePdfName?: string;
  quotePdfUploadedAt?: string;
  quotePdfUploadedBy?: string;
  clientApprovalStatus?: 'pendiente' | 'aprobada' | 'rechazada' | 'approved' | 'rejected';
  clientApprovalDate?: string;
  clientRejectionReason?: string;
}

export type LeadVisitStatus = 'programada' | 'realizada' | 'presupuesto_enviado' | 'cerrada' | 'cancelada';

export interface ObservationHistoryEntry {
  id: string;
  observationDate: string; // YYYY-MM-DD
  text: string;
  reminderDate?: string; // YYYY-MM-DD
  reminderTime?: string; // HH:mm
  author: string;
  createdAt: string;
}

export interface LeadVisit {
  id: string;
  trackingCode?: string; // Structured tracking ID [E|C][M|C|L][DDMM][00000]
  date: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  companyLocation?: string;
  locationUrl?: string;
  seller: string; // Nombre libre del vendedor asignado
  branch: string;
  status: LeadVisitStatus;
  columnId?: string;
  step?: string;
  kanbanStep?: string;
  objective: string;
  nextStep: string;
  nextStepDate?: string;
  estimatedUnits?: number;
  notes?: string;
  observationDate?: string; // YYYY-MM-DD fecha de la observación
  reminderDate?: string; // YYYY-MM-DD fecha para recordatorio/calendario
  reminderTime?: string; // HH:mm opcional
  reminderNote?: string;
  observationHistory?: ObservationHistoryEntry[];
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

export interface CRMSale {
  id: string; // e.g. "sale-123456" o "2026-10-15-Maipú"
  date: string; // YYYY-MM-DD
  branch: string; // Local e.g. "Maipú", "Ciudad", "Luján"
  period?: 'Diario' | 'Semanal' | 'Mensual' | string;
  amount?: number; // Monto Total de Venta
  totalDaily?: number; // Compatibilidad con cierres diarios
  detail?: string; // Detalle opcional de la venta/cierre
  registeredBy?: string;
  rawDate?: string;
  importedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- CRM TASKS KANBAN (3. TAREAS DEL EQUIPO) ---
export type CRMTaskImportance = 'urgente' | 'alta' | 'media' | 'baja';
export type CRMTaskScheduleType = 'immediate' | 'specific_date' | 'periodic' | 'monthly';

export interface CRMTaskAdvanceLog {
  id: string;
  author: string;
  authorRole?: 'admin' | 'local' | 'vendedor';
  note: string;
  progressPercent: number;
  createdAt: string;
}

export interface CRMTaskComment {
  id: string;
  author: string;
  authorEmail?: string;
  authorRole?: 'admin' | 'local' | 'vendedor';
  text: string;
  createdAt: string;
}

export interface CRMTaskEvidencePhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  createdAt: string;
}

export interface CRMTaskTag {
  id: string;
  name: string;
  color: string;
}

export interface CRMTaskTemplate {
  id: string;
  title: string;
  description?: string;
  defaultImportance: CRMTaskImportance;
  defaultTags?: string[];
  defaultRequiredAdvance?: string;
  defaultTargetProgressPercent?: number;
  defaultBranch?: string;
}

export interface CRMTask {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  importance: CRMTaskImportance;
  assignedTo: string;
  assignedToList?: string[]; // Múltiples responsables
  assignedToEmail?: string;
  createdBy: string;
  createdByEmail?: string;
  branch: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  requiredAdvance?: string; // Qué se necesita de avance (definido/editable por Encargado del Local o Admin)
  targetProgressPercent?: number; // % mínimo requerido por Encargado del Local (default 100)
  progressPercent: number; // 0 - 100
  tags?: string[]; // Etiquetas (Stock, Control de pedidos, Salón, etc.)
  templateId?: string;
  advanceLogs?: CRMTaskAdvanceLog[];
  comments?: CRMTaskComment[]; // Historial inmutable de comentarios (no se pueden borrar)
  evidencePhotos?: CRMTaskEvidencePhoto[]; // Fotos de respaldo subidas por controladores
  scheduleType?: CRMTaskScheduleType;
  activationDate?: string; // YYYY-MM-DD
  recurrenceDays?: number;
  activationMonths?: number[]; // 1..12
  isActivated?: boolean;
  lastActivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CRMCalendarEventType = 'vencimiento' | 'tarea' | 'seguimiento' | 'visita' | 'reunion' | 'otro';

export interface CRMCalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  eventType: CRMCalendarEventType;
  branch?: string;
  visibilityType: 'all' | 'branch' | 'custom';
  visibleToUsers?: string[]; // Nombres o emails autorizados cuando visibilityType === 'custom'
  createdBy: string;
  createdByEmail?: string;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarHolidayScope = 'argentina' | 'mendoza' | 'ciudad' | 'maipu' | 'lujan' | 'comercial';

export interface CalendarHolidayItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  recurringAnnual: boolean;
  scope: CalendarHolidayScope;
  category: 'feriado_nacional' | 'feriado_provincial' | 'aniversario_local' | 'campana_comercial' | 'fecha_importante';
  description?: string;
  marketingIdea?: string;
  linkedPromotionId?: string;
  active: boolean;
}

export interface CalendarModuleConfig {
  showArgentinaHolidays: boolean;
  showMendozaHolidays: boolean;
  showLocalHolidays: boolean;
  showCommercialDates: boolean;
  allowStaffCreateEvents: boolean;
  defaultVisibilityType: 'all' | 'branch';
}

