import React, { useState } from 'react';
import { ThemeConfig, SiteTextsConfig } from '../../types';
import { 
  Palette, 
  Type, 
  Save, 
  RotateCcw, 
  Check, 
  SlidersHorizontal, 
  Eye, 
  Sparkles,
  Layers,
  Layout,
  ShoppingBag,
  LogIn,
  LayoutGrid,
  Kanban,
  FileSpreadsheet,
  Globe,
  ChevronDown,
  PanelLeft,
  Users,
  Wallet,
  MessageSquare
} from 'lucide-react';
import { isColorDark } from '../../context/ThemeContext';

export type SectionKey = 
  | 'navbar'
  | 'catalog'
  | 'product_detail'
  | 'quote_drawer'
  | 'auth'
  | 'hub'
  | 'crm'
  | 'corporate_services'
  | 'footer'
  | 'sidebar'
  | 'rrhh'
  | 'costs'
  | 'chat';

interface SectionDefinition {
  id: SectionKey;
  name: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description: string;
  badge: string;
}

export const SYSTEM_SECTIONS: SectionDefinition[] = [
  {
    id: 'navbar',
    name: '1. Menú Principal Superior (Navbar)',
    shortLabel: 'Navbar',
    icon: Layout,
    description: 'Barra superior, logo dinámico, enlaces de categorías (Hombre, Mujer, etc.), micro-anuncios y botones de usuario.',
    badge: 'Cabecera'
  },
  {
    id: 'catalog',
    name: '2. Catálogo Público (Filtros, Grilla, Tarjetas de Producto)',
    shortLabel: 'Catálogo',
    icon: LayoutGrid,
    description: 'Lienzo de la tienda, cabecera de colección, barra de búsqueda, filtros de categorías y tarjetas de producto.',
    badge: 'Tienda'
  },
  {
    id: 'product_detail',
    name: '3. Ficha de Producto (Detalle y Modal)',
    shortLabel: 'Ficha Detalle',
    icon: Eye,
    description: 'Ventana emergente y vista completa del producto, selector de talles, colores, cantidades y botón de cotización.',
    badge: 'Producto'
  },
  {
    id: 'quote_drawer',
    name: '4. Ventana Emergente de "Mi Pedido" (Carrito)',
    shortLabel: 'Mi Pedido',
    icon: ShoppingBag,
    description: 'Panel lateral desplegable con el resumen de artículos agregados, observaciones y botón de envío a WhatsApp.',
    badge: 'Carrito'
  },
  {
    id: 'auth',
    name: '5. Pantalla/Modal de Login y Registro',
    shortLabel: 'Login & Registro',
    icon: LogIn,
    description: 'Formulario de acceso para clientes (Consumidor Final y Empresas), registro de nuevas cuentas y enlaces a Staff.',
    badge: 'Acceso'
  },
  {
    id: 'hub',
    name: '6. Hub de Trabajo / Menú Principal Interno',
    shortLabel: 'Hub Interno',
    icon: Layers,
    description: 'Menú principal de bienvenida para Administradores y Empleados autorizados con accesos a CRM, Panel y Catálogo.',
    badge: 'Interno'
  },
  {
    id: 'crm',
    name: '7. Módulo CRM y Tableros Kanban',
    shortLabel: 'CRM Kanban',
    icon: Kanban,
    description: 'Tablero de cotizaciones, estados de pedidos (Cotización, Seña 50%, Producción, Listo), filtros y métricas comerciales.',
    badge: 'Gestión'
  },
  {
    id: 'corporate_services',
    name: '8. Servicios Corporativos (Portal de Talles, Simulador)',
    shortLabel: 'Corporativo',
    icon: FileSpreadsheet,
    description: 'Herramientas B2B para relevamiento de talles de personal en cuadrillas y armador interactivo de uniformes.',
    badge: 'Servicios B2B'
  },
  {
    id: 'footer',
    name: '9. Footer (Pie de página)',
    shortLabel: 'Footer',
    icon: Globe,
    description: 'Bloque inferior con teléfonos, WhatsApp comercial, redes sociales, direcciones de sucursales y datos institucionales.',
    badge: 'Pie de Página'
  },
  {
    id: 'sidebar',
    name: '10. Barra Lateral Interna (CRM, Panel, RRHH, Costos)',
    shortLabel: 'Barra Lateral',
    icon: PanelLeft,
    description: 'Personalizá el color de fondo, textos, ítem activo y acento de la barra lateral izquierda en todos los módulos internos.',
    badge: 'Navegación'
  },
  {
    id: 'rrhh',
    name: '11. Módulo RRHH (Fichaje GPS & Legajos)',
    shortLabel: 'RRHH',
    icon: Users,
    description: 'Títulos, pestañas, textos de fichaje GPS y botones del módulo de Recursos Humanos.',
    badge: 'Personal'
  },
  {
    id: 'costs',
    name: '12. Módulo Costos & Finanzas',
    shortLabel: 'Costos',
    icon: Wallet,
    description: 'Títulos, pestañas de Dashboard, Facturas, Cheques y Caja Chica por local.',
    badge: 'Finanzas'
  },
  {
    id: 'chat',
    name: '13. Chat Interno & Mensajería',
    shortLabel: 'Chat Interno',
    icon: MessageSquare,
    description: 'Títulos, botones y placeholders del chat en tiempo real entre administradores, empleados y clientes.',
    badge: 'Mensajería'
  }
];

interface SectionThemeEditorProps {
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  onLiveChange: (field: keyof ThemeConfig, value: any) => void;
  onLiveTextChange: (field: keyof SiteTextsConfig, value: string) => void;
  onSaveAll: () => Promise<void>;
  triggerSaveNotice: () => void;
}

export const SectionThemeEditor: React.FC<SectionThemeEditorProps> = ({
  theme,
  onUpdateTheme,
  onLiveChange,
  onLiveTextChange,
  onSaveAll,
  triggerSaveNotice,
}) => {
  const [selectedSection, setSelectedSection] = useState<SectionKey>('navbar');
  const [savingNotice, setSavingNotice] = useState(false);

  const activeSectionDef = SYSTEM_SECTIONS.find((s) => s.id === selectedSection) || SYSTEM_SECTIONS[0];
  const siteTexts: SiteTextsConfig = theme.siteTexts || theme.screenTexts || {};

  const handleSave = async () => {
    setSavingNotice(true);
    await onSaveAll();
    triggerSaveNotice();
    setTimeout(() => setSavingNotice(false), 2000);
  };

  // Helper para renderizar un control de color completo con swatches
  const renderColorField = (
    label: string,
    field: keyof ThemeConfig,
    currentValue: string | undefined,
    fallbackValue: string,
    swatches: string[] = ['#18231C', '#FDB813', '#FFFFFF', '#F5F2EC', '#6F6860', '#DCD4C9']
  ) => {
    const val = currentValue || fallbackValue;
    const isDark = isColorDark(val);

    return (
      <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs space-y-2 shadow-2xs hover:border-[#18231C] transition-colors">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
            {label}
          </label>
          <span className="text-[10px] font-mono font-bold text-[#6F6860] uppercase bg-[#FAF8F5] px-1.5 py-0.5 rounded-xs border border-[#DCD4C9]">
            {val}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative size-9 shrink-0 rounded-xs overflow-hidden border border-[#DCD4C9] shadow-xs">
            <input
              type="color"
              value={val.startsWith('#') ? val : '#18231C'}
              onChange={(e) => onLiveChange(field, e.target.value)}
              className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer"
            />
          </div>
          <input
            type="text"
            value={val}
            onChange={(e) => onLiveChange(field, e.target.value)}
            className="flex-1 px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold uppercase text-[#18231C] focus:outline-none focus:border-[#FDB813]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[9px] uppercase tracking-wider text-[#8C827A] font-medium mr-1">Rápidos:</span>
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => onLiveChange(field, swatch)}
              title={swatch}
              className={`size-5 rounded-xs border border-black/20 hover:scale-110 transition-transform cursor-pointer ${
                val.toLowerCase() === swatch.toLowerCase() ? 'ring-2 ring-[#FDB813] scale-105' : ''
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Helper para renderizar un control de texto con contador
  const renderTextField = (
    label: string,
    field: keyof SiteTextsConfig,
    currentValue: string | undefined,
    fallbackValue: string,
    isTextarea = false,
    placeholder = ''
  ) => {
    const val = currentValue !== undefined ? currentValue : fallbackValue;

    return (
      <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs space-y-1.5 shadow-2xs hover:border-[#18231C] transition-colors">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
            {label}
          </label>
          <span className="text-[10px] text-[#8C827A] font-mono">
            {val.length} caracteres
          </span>
        </div>

        {isTextarea ? (
          <textarea
            rows={3}
            value={val}
            placeholder={placeholder}
            onChange={(e) => onLiveTextChange(field, e.target.value)}
            className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813] transition-colors leading-relaxed"
          />
        ) : (
          <input
            type="text"
            value={val}
            placeholder={placeholder}
            onChange={(e) => onLiveTextChange(field, e.target.value)}
            className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813] transition-colors"
          />
        )}
      </div>
    );
  };

  // Helper para restablecer la sección activa
  const handleResetSection = () => {
    if (!confirm(`¿Restablecer los valores visuales de "${activeSectionDef.name}" a los predeterminados oficiales?`)) return;

    let updated = { ...theme };
    let updatedTexts = { ...siteTexts };

    switch (selectedSection) {
      case 'navbar':
        delete updated.navbarBgColor;
        delete updated.navbarTextColor;
        delete updated.navbarSecondaryTextColor;
        delete updated.navbarButtonBg;
        delete updated.navbarButtonTextColor;
        delete updated.navbarButtonHoverBg;
        delete updated.navbarBorderColor;
        delete updatedTexts.announcementBarText;
        delete updatedTexts.searchPlaceholder;
        delete updatedTexts.quoteButtonText;
        delete updatedTexts.loginButtonText;
        break;
      case 'catalog':
        delete updated.catalogBgColor;
        delete updated.catalogTitleColor;
        delete updated.catalogTextColor;
        delete updated.catalogSecondaryTextColor;
        delete updated.catalogCardBgColor;
        delete updated.catalogCardBorderColor;
        delete updated.catalogCardPriceColor;
        delete updated.catalogButtonBg;
        delete updated.catalogButtonTextColor;
        delete updated.catalogButtonHoverBg;
        delete updatedTexts.catalogTitle;
        delete updatedTexts.catalogSubtitle;
        delete updatedTexts.catalogSearchPlaceholder;
        delete updatedTexts.viewProductCardText;
        delete updatedTexts.addToQuoteBtnText;
        delete updatedTexts.whatsappConsultBtnText;
        break;
      case 'product_detail':
        delete updated.productDetailBgColor;
        delete updated.productDetailTextColor;
        delete updated.productDetailSecondaryTextColor;
        delete updated.productDetailBorderColor;
        delete updated.productDetailButtonBg;
        delete updated.productDetailButtonTextColor;
        delete updated.productDetailButtonHoverBg;
        delete updatedTexts.productDetailSizeLabel;
        delete updatedTexts.productDetailColorLabel;
        delete updatedTexts.productDetailAddBtnText;
        delete updatedTexts.productDetailWhatsappBtnText;
        delete updatedTexts.productDetailGuaranteeText;
        break;
      case 'quote_drawer':
        delete updated.quoteDrawerBgColor;
        delete updated.quoteDrawerTextColor;
        delete updated.quoteDrawerSecondaryTextColor;
        delete updated.quoteDrawerBorderColor;
        delete updated.quoteDrawerButtonBg;
        delete updated.quoteDrawerButtonTextColor;
        delete updated.quoteDrawerButtonHoverBg;
        delete updatedTexts.quoteDrawerTitle;
        delete updatedTexts.quoteDrawerSendBtnText;
        delete updatedTexts.quoteDrawerObservationsPlaceholder;
        delete updatedTexts.emptyCartTitle;
        delete updatedTexts.emptyCartSubtitle;
        break;
      case 'auth':
        delete updated.loginModalBgColor;
        delete updated.loginModalTextColor;
        delete updated.loginModalSecondaryTextColor;
        delete updated.loginModalBorderColor;
        delete updated.loginModalButtonBg;
        delete updated.loginModalButtonTextColor;
        delete updated.loginModalButtonHoverBg;
        delete updatedTexts.authLoginTitle;
        delete updatedTexts.authLoginSubtitle;
        delete updatedTexts.authLoginBtnText;
        delete updatedTexts.authRegisterTitle;
        delete updatedTexts.authRegisterSubtitle;
        delete updatedTexts.authStaffTitle;
        delete updatedTexts.authStaffSubtitle;
        delete updatedTexts.authToRegisterLinkText;
        delete updatedTexts.authToStaffLinkText;
        break;
      case 'hub':
        delete updated.hubBgColor;
        delete updated.hubTextColor;
        delete updated.hubSecondaryTextColor;
        delete updated.hubCardBgColor;
        delete updated.hubBorderColor;
        delete updated.hubAccentColor;
        delete updated.hubButtonBg;
        delete updated.hubButtonTextColor;
        delete updated.hubButtonHoverBg;
        delete updatedTexts.hubHeaderTag;
        delete updatedTexts.hubHeaderSub;
        delete updatedTexts.hubTitle;
        delete updatedTexts.hubSubtitle;
        delete updatedTexts.hubCrmCardText;
        delete updatedTexts.hubCrmCardDesc;
        delete updatedTexts.hubCrmBtnText;
        delete updatedTexts.hubRrhhCardText;
        delete updatedTexts.hubRrhhCardDesc;
        delete updatedTexts.hubRrhhBtnText;
        delete updatedTexts.hubAdminCardText;
        delete updatedTexts.hubAdminCardDesc;
        delete updatedTexts.hubAdminBtnText;
        delete updatedTexts.hubCatalogCardText;
        delete updatedTexts.hubCatalogCardDesc;
        delete updatedTexts.hubCatalogBtnText;
        delete updatedTexts.hubLogoutBtnText;
        break;
      case 'crm':
        delete updated.crmHeaderBgColor;
        delete updated.crmHeaderTextColor;
        delete updated.crmSecondaryTextColor;
        delete updated.crmHeaderBorderColor;
        delete updated.crmCardBgColor;
        delete updated.crmCardTextColor;
        delete updated.crmCardBorderColor;
        delete updated.crmCardHeaderBg;
        delete updated.crmButtonBg;
        delete updated.crmButtonTextColor;
        delete updated.crmButtonHoverBg;
        delete updatedTexts.crmTitle;
        delete updatedTexts.crmSubtitle;
        delete updatedTexts.crmBackBtnText;
        delete updatedTexts.crmColCotizacionText;
        delete updatedTexts.crmColProduccionText;
        delete updatedTexts.crmColListoText;
        delete updatedTexts.crmNewOrderBtnText;
        delete updatedTexts.crmTabVisitsText;
        delete updatedTexts.crmTabBoardText;
        delete updatedTexts.crmTabTasksText;
        delete updatedTexts.crmTabCalendarText;
        delete updatedTexts.crmTabSuppliersText;
        delete updatedTexts.crmTabCostsText;
        break;
      case 'corporate_services':
        delete updated.corporateServicesBgColor;
        delete updated.corporateServicesTextColor;
        delete updated.corporateServicesSecondaryTextColor;
        delete updated.corporateServicesBorderColor;
        delete updated.corporateServicesButtonBg;
        delete updated.corporateServicesButtonTextColor;
        delete updated.corporateServicesButtonHoverBg;
        delete updatedTexts.sizingPortalTitle;
        delete updatedTexts.sizingPortalSubtitle;
        delete updatedTexts.uniformSimulatorTitle;
        delete updatedTexts.uniformSimulatorSubtitle;
        delete updatedTexts.corporateQuoteBtnText;
        break;
      case 'footer':
        delete updated.footerBgColor;
        delete updated.footerTextColor;
        delete updated.footerSecondaryTextColor;
        delete updated.footerBorderColor;
        delete updated.footerAccentColor;
        delete updated.footerButtonBg;
        delete updated.footerButtonTextColor;
        delete updated.footerButtonHoverBg;
        delete updatedTexts.footerContactTitle;
        delete updatedTexts.footerBranchesTitle;
        delete updatedTexts.footerTagline;
        delete updatedTexts.footerAbout;
        delete updatedTexts.footerPhone;
        delete updatedTexts.footerEmail;
        delete updatedTexts.footerAddress;
        delete updatedTexts.footerWhatsappBtnText;
        delete updatedTexts.footerAdminLinkText;
        break;
      case 'sidebar':
        delete updated.sidebarBgColor;
        delete updated.sidebarTextColor;
        delete updated.sidebarActiveBgColor;
        delete updated.sidebarAccentColor;
        break;
      case 'rrhh':
        delete updatedTexts.rrhhTitle;
        delete updatedTexts.rrhhSubtitle;
        delete updatedTexts.rrhhFichajeTabText;
        delete updatedTexts.rrhhLegajoTabText;
        delete updatedTexts.rrhhFichajeCardTitle;
        delete updatedTexts.rrhhFichajeCardSubtitle;
        delete updatedTexts.rrhhFichajeBtnText;
        delete updatedTexts.rrhhAdminBtnText;
        delete updatedTexts.rrhhBackBtnText;
        break;
      case 'costs':
        delete updatedTexts.costsTitle;
        delete updatedTexts.costsSubtitle;
        delete updatedTexts.costsTabDashboardText;
        delete updatedTexts.costsTabCostsText;
        delete updatedTexts.costsTabInvoicesText;
        delete updatedTexts.costsTabChecksText;
        delete updatedTexts.costsTabPettyCashText;
        delete updatedTexts.costsDashTitle;
        delete updatedTexts.costsDashSubtitle;
        delete updatedTexts.costsBackBtnText;
        break;
      case 'chat':
        delete updatedTexts.chatTitle;
        delete updatedTexts.chatSubtitle;
        delete updatedTexts.chatInputPlaceholder;
        delete updatedTexts.chatSendBtnText;
        delete updatedTexts.chatNavBtnText;
        break;
    }

    updated.siteTexts = updatedTexts;
    updated.screenTexts = updatedTexts;
    onUpdateTheme(updated);
    try {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(updated));
      localStorage.setItem('pampero_theme_config', JSON.stringify(updated));
    } catch {}
    triggerSaveNotice();
  };

  return (
    <div className="space-y-6">
      {/* Selector Superior de Sección (Desplegable exhaustivo de 9 ventanas) */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-xs border-2 border-[#18231C] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
              Aislamiento Activo
            </span>
            <span className="text-xs text-[#6F6860]">
              {SYSTEM_SECTIONS.length} Ventanas Disponibles
            </span>
          </div>
          <h4 className="font-bold text-sm sm:text-base uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            Editor Exhaustivo por Secciones
          </h4>
          <p className="text-xs text-[#6F6860] max-w-xl">
            Seleccioná una ventana del desplegable. Modificar una sección altera <strong>únicamente</strong> sus propias variables sin afectar el resto de la plataforma.
          </p>
        </div>

        {/* Desplegable Principal Obligatorio */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <label htmlFor="section-select-dropdown" className="text-xs font-extrabold uppercase tracking-wider text-[#18231C]">
            Ventana a Editar:
          </label>
          <div className="relative">
            <select
              id="section-select-dropdown"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value as SectionKey)}
              className="w-full sm:w-auto px-4 py-2.5 pr-10 bg-white border-2 border-[#18231C] rounded-xs text-xs font-bold text-[#18231C] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#FDB813] cursor-pointer shadow-xs min-w-[320px]"
            >
              {SYSTEM_SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#18231C] absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Barra de Acceso Rápido por Pestañas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
        {SYSTEM_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === selectedSection;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedSection(sec.id)}
              className={`px-3 py-2 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#18231C] text-white shadow-xs'
                  : 'bg-white border border-[#DCD4C9] text-[#4A453F] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-[#8C827A]'}`} />
              <span>{sec.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Banner Informativo de la Sección Seleccionada */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xs bg-[#18231C] text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
            {activeSectionDef.shortLabel.substring(0, 3).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                {activeSectionDef.name}
              </h5>
              <span className="px-2 py-0.5 rounded-full bg-[#F5F2EC] text-[#18231C] text-[10px] font-bold uppercase">
                {activeSectionDef.badge}
              </span>
            </div>
            <p className="text-xs text-[#6F6860] mt-0.5">
              {activeSectionDef.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetSection}
            className="px-3 py-2 bg-white border border-[#DCD4C9] hover:bg-neutral-100 text-[#6F6860] hover:text-red-700 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restablecer valores originales de esta sección"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restablecer Sección</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={savingNotice}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            {savingNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savingNotice ? '¡Guardado!' : 'Guardar Sección'}</span>
          </button>
        </div>
      </div>

      {/* CONTENEDOR DE DOS COLUMNAS: COLORES (IZQUIERDA) vs TEXTOS (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ============================================================== */}
        {/* COLUMNA IZQUIERDA: PALETA DE COLORES AISLADA (6 Columnas)      */}
        {/* ============================================================== */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#18231C]">
            <h5 className="font-extrabold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              1. Colores de la Sección (Aislados)
            </h5>
            <span className="text-[10px] text-emerald-700 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200">
              ✓ No Afecta Otras Ventanas
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. NAVBAR */}
            {selectedSection === 'navbar' && (
              <>
                {renderColorField('Color de Fondo (Navbar)', 'navbarBgColor', theme.navbarBgColor, theme.headerBgColor || '#FFFFFF')}
                {renderColorField('Color de Textos Principales / Enlaces', 'navbarTextColor', theme.navbarTextColor, theme.headerTextColor || '#18231C')}
                {renderColorField('Color de Textos Secundarios / Acento Enlace Activo', 'navbarSecondaryTextColor', theme.navbarSecondaryTextColor, theme.headerAccentColor || theme.accentColor || '#FDB813')}
                {renderColorField('Color de Botones (Mi Pedido, Ingresar)', 'navbarButtonBg', theme.navbarButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Texto en Botones', 'navbarButtonTextColor', theme.navbarButtonTextColor, '#FFFFFF')}
                {renderColorField('Color de Botón al pasar el Mouse (Hover)', 'navbarButtonHoverBg', theme.navbarButtonHoverBg, theme.hoverAccentColor || '#FDB813')}
                {renderColorField('Color de Borde Inferior', 'navbarBorderColor', theme.navbarBorderColor, theme.headerBorderColor || '#E5E5E5')}
              </>
            )}

            {/* 2. CATÁLOGO */}
            {selectedSection === 'catalog' && (
              <>
                {renderColorField('Color de Fondo del Catálogo', 'catalogBgColor', theme.catalogBgColor, theme.backgroundColor || '#F5F2EC')}
                {renderColorField('Color de Título Principal del Catálogo', 'catalogTitleColor', theme.catalogTitleColor, '#18231C')}
                {renderColorField('Color de Textos Secundarios / Subtítulos / Filtros', 'catalogSecondaryTextColor', theme.catalogSecondaryTextColor, theme.catalogTextColor || '#6F6860')}
                {renderColorField('Color de Fondo de Tarjeta de Producto', 'catalogCardBgColor', theme.catalogCardBgColor, theme.cardBgColor || '#ECE5DC')}
                {renderColorField('Color de Borde de Tarjeta de Producto', 'catalogCardBorderColor', theme.catalogCardBorderColor, theme.cardBorderColor || '#DCD4C9')}
                {renderColorField('Color de Botones en Catálogo ("Ver Ficha")', 'catalogButtonBg', theme.catalogButtonBg, theme.cardButtonBg || theme.buttonBgColor || '#18231C')}
                {renderColorField('Color de Texto en Botón de Tarjeta', 'catalogButtonTextColor', theme.catalogButtonTextColor, theme.cardButtonText || '#FFFFFF')}
                {renderColorField('Color de Botón Catálogo (Hover)', 'catalogButtonHoverBg', theme.catalogButtonHoverBg, theme.hoverAccentColor || '#FDB813')}
              </>
            )}

            {/* 3. FICHA DE PRODUCTO */}
            {selectedSection === 'product_detail' && (
              <>
                {renderColorField('Color de Fondo de la Ficha / Modal', 'productDetailBgColor', theme.productDetailBgColor, '#FFFFFF')}
                {renderColorField('Color de Textos Principales (Nombre, Precios)', 'productDetailTextColor', theme.productDetailTextColor, '#18231C')}
                {renderColorField('Color de Textos Secundarios (Características, Código)', 'productDetailSecondaryTextColor', theme.productDetailSecondaryTextColor, '#6F6860')}
                {renderColorField('Color de Borde del Contenedor', 'productDetailBorderColor', theme.productDetailBorderColor, theme.cardBorderColor || '#DCD4C9')}
                {renderColorField('Color de Botón Principal ("Agregar a Mi Pedido")', 'productDetailButtonBg', theme.productDetailButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Texto de Botón Principal', 'productDetailButtonTextColor', theme.productDetailButtonTextColor, '#FFFFFF')}
                {renderColorField('Color de Botón Principal (Hover)', 'productDetailButtonHoverBg', theme.productDetailButtonHoverBg, theme.hoverAccentColor || '#FDB813')}
              </>
            )}

            {/* 4. MI PEDIDO (QUOTE DRAWER) */}
            {selectedSection === 'quote_drawer' && (
              <>
                {renderColorField('Color de Fondo del Panel de Pedido', 'quoteDrawerBgColor', theme.quoteDrawerBgColor, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Textos Principales', 'quoteDrawerTextColor', theme.quoteDrawerTextColor, '#FFFFFF')}
                {renderColorField('Color de Textos Secundarios / Totales', 'quoteDrawerSecondaryTextColor', theme.quoteDrawerSecondaryTextColor, '#DCD4C9')}
                {renderColorField('Color de Borde del Panel', 'quoteDrawerBorderColor', theme.quoteDrawerBorderColor, '#324436')}
                {renderColorField('Color de Botón de Envío ("Pasar a WhatsApp")', 'quoteDrawerButtonBg', theme.quoteDrawerButtonBg, theme.accentColor || '#FDB813')}
                {renderColorField('Color de Texto en Botón de Envío', 'quoteDrawerButtonTextColor', theme.quoteDrawerButtonTextColor, '#18231C')}
                {renderColorField('Color de Botón de Envío (Hover)', 'quoteDrawerButtonHoverBg', theme.quoteDrawerButtonHoverBg, theme.hoverAccentColor || '#E0A310')}
              </>
            )}

            {/* 5. AUTH (LOGIN / REGISTRO) */}
            {selectedSection === 'auth' && (
              <>
                {renderColorField('Color de Fondo de la Pantalla de Ingreso', 'loginModalBgColor', theme.loginModalBgColor, theme.panelBgColor || '#FAF8F5')}
                {renderColorField('Color de Textos Principales / Títulos', 'loginModalTextColor', theme.loginModalTextColor, theme.textColor || '#18231C')}
                {renderColorField('Color de Textos Secundarios / Enlaces', 'loginModalSecondaryTextColor', theme.loginModalSecondaryTextColor, '#6F6860')}
                {renderColorField('Color de Borde de la Tarjeta de Ingreso', 'loginModalBorderColor', theme.loginModalBorderColor, theme.cardBorderColor || '#DCD4C9')}
                {renderColorField('Color de Botón de Ingreso / Registro', 'loginModalButtonBg', theme.loginModalButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Texto en Botón de Ingreso', 'loginModalButtonTextColor', theme.loginModalButtonTextColor, '#FFFFFF')}
                {renderColorField('Color de Botón de Ingreso (Hover)', 'loginModalButtonHoverBg', theme.loginModalButtonHoverBg, theme.hoverAccentColor || '#FDB813')}
              </>
            )}

            {/* 6. HUB INTERNO */}
            {selectedSection === 'hub' && (
              <>
                {renderColorField('Color de Fondo del Hub Interno', 'hubBgColor', theme.hubBgColor, '#18231C')}
                {renderColorField('Color de Textos Principales / Saludo', 'hubTextColor', theme.hubTextColor, '#F5F2EC')}
                {renderColorField('Color de Textos Secundarios / Bajadas', 'hubSecondaryTextColor', theme.hubSecondaryTextColor, '#DCD4C9')}
                {renderColorField('Color de Fondo de Tarjetas de Módulos', 'hubCardBgColor', theme.hubCardBgColor, '#FFFFFF')}
                {renderColorField('Color de Borde de Tarjetas', 'hubBorderColor', theme.hubBorderColor, 'rgba(255, 255, 255, 0.15)')}
                {renderColorField('Color de Botón de Acción de Tarjeta', 'hubButtonBg', theme.hubButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Botón de Acción (Hover)', 'hubButtonHoverBg', theme.hubButtonHoverBg, theme.accentColor || '#FDB813')}
              </>
            )}

            {/* 7. CRM KANBAN */}
            {selectedSection === 'crm' && (
              <>
                {renderColorField('Color de Fondo de Cabecera CRM', 'crmHeaderBgColor', theme.crmHeaderBgColor, '#FFFFFF')}
                {renderColorField('Color de Textos de Cabecera CRM', 'crmHeaderTextColor', theme.crmHeaderTextColor, '#18231C')}
                {renderColorField('Color de Textos Secundarios CRM', 'crmSecondaryTextColor', theme.crmSecondaryTextColor, '#6F6860')}
                {renderColorField('Color de Fondo de Tarjetas Kanban', 'crmCardBgColor', theme.crmCardBgColor, '#FFFFFF')}
                {renderColorField('Color de Textos en Tarjeta Kanban', 'crmCardTextColor', theme.crmCardTextColor, '#18231C')}
                {renderColorField('Color de Borde de Tarjeta Kanban', 'crmCardBorderColor', theme.crmCardBorderColor, '#DCD4C9')}
                {renderColorField('Color de Botones de Gestión / Acciones CRM', 'crmButtonBg', theme.crmButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Botón CRM (Hover)', 'crmButtonHoverBg', theme.crmButtonHoverBg, theme.accentColor || '#FDB813')}
              </>
            )}

            {/* 8. SERVICIOS CORPORATIVOS */}
            {selectedSection === 'corporate_services' && (
              <>
                {renderColorField('Color de Fondo de la Pantalla', 'corporateServicesBgColor', theme.corporateServicesBgColor, theme.backgroundColor || '#F5F2EC')}
                {renderColorField('Color de Textos Principales', 'corporateServicesTextColor', theme.corporateServicesTextColor, '#18231C')}
                {renderColorField('Color de Textos Secundarios / Instrucciones', 'corporateServicesSecondaryTextColor', theme.corporateServicesSecondaryTextColor, '#6F6860')}
                {renderColorField('Color de Borde de Paneles de Dotación', 'corporateServicesBorderColor', theme.corporateServicesBorderColor, '#DCD4C9')}
                {renderColorField('Color de Botones de Relevamiento / Cotización', 'corporateServicesButtonBg', theme.corporateServicesButtonBg, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Texto en Botón de Relevamiento', 'corporateServicesButtonTextColor', theme.corporateServicesButtonTextColor, '#FFFFFF')}
                {renderColorField('Color de Botón de Relevamiento (Hover)', 'corporateServicesButtonHoverBg', theme.corporateServicesButtonHoverBg, theme.accentColor || '#FDB813')}
              </>
            )}

            {/* 9. FOOTER */}
            {selectedSection === 'footer' && (
              <>
                {renderColorField('Color de Fondo del Pie de Página', 'footerBgColor', theme.footerBgColor, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Textos Principales / Títulos de Columna', 'footerTextColor', theme.footerTextColor, '#F5F2EC')}
                {renderColorField('Color de Textos Secundarios / Descripciones', 'footerSecondaryTextColor', theme.footerSecondaryTextColor, '#DCD4C9')}
                {renderColorField('Color de Borde Superior del Footer', 'footerBorderColor', theme.footerBorderColor, '#28331E')}
                {renderColorField('Color de Botón de Contacto / WhatsApp', 'footerButtonBg', theme.footerButtonBg, theme.footerAccentColor || theme.accentColor || '#FDB813')}
                {renderColorField('Color de Texto en Botón de Contacto', 'footerButtonTextColor', theme.footerButtonTextColor, '#FFFFFF')}
                {renderColorField('Color de Botón de Contacto (Hover)', 'footerButtonHoverBg', theme.footerButtonHoverBg, theme.hoverAccentColor || '#E0A310')}
              </>
            )}

            {/* 10. BARRA LATERAL INTERNA (y compartida con RRHH / Costos) */}
            {(selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs') && (
              <>
                {renderColorField('Color de Fondo de la Barra Lateral', 'sidebarBgColor', theme.sidebarBgColor, theme.primaryColor || '#18231C')}
                {renderColorField('Color de Textos en la Barra Lateral', 'sidebarTextColor', theme.sidebarTextColor, '#DCD4C9')}
                {renderColorField('Color de Fondo del Ítem Activo', 'sidebarActiveBgColor', theme.sidebarActiveBgColor, '#2B3B30')}
                {renderColorField('Color de Acento / Íconos Activos', 'sidebarAccentColor', theme.sidebarAccentColor, theme.accentColor || '#FDB813')}
              </>
            )}

            {/* 13. CHAT INTERNO */}
            {selectedSection === 'chat' && (
              <>
                {renderColorField('Color Principal Cabecera Chat', 'primaryColor', theme.primaryColor, '#18231C')}
                {renderColorField('Color de Acento Mensajes / Badges', 'accentColor', theme.accentColor, '#FDB813')}
              </>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMNA DERECHA: TEXTOS & CONTENIDOS DE LA SECCIÓN (6 Columnas) */}
        {/* ============================================================== */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#18231C]">
            <h5 className="font-extrabold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-600" />
              2. Textos & Contenidos de la Sección
            </h5>
            <span className="text-[10px] text-amber-800 font-bold uppercase bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
              ⚡ Edición en Tiempo Real
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. NAVBAR TEXTS */}
            {selectedSection === 'navbar' && (
              <>
                {renderTextField('Micro-anuncio superior (Barra informativa)', 'announcementBarText', siteTexts.announcementBarText, 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO')}
                {renderTextField('Placeholder del buscador superior', 'searchPlaceholder', siteTexts.searchPlaceholder, 'Buscar en el catálogo...')}
                {renderTextField('Texto del Botón "Mi Pedido"', 'quoteButtonText', siteTexts.quoteButtonText, 'MI PEDIDO')}
                {renderTextField('Texto del Botón "Ingresar"', 'loginButtonText', siteTexts.loginButtonText, 'INGRESAR')}
                {renderTextField('Etiqueta Categoría 1', 'navHombreText', siteTexts.navHombreText, 'HOMBRE')}
                {renderTextField('Etiqueta Categoría 2', 'navMujerText', siteTexts.navMujerText, 'MUJER')}
                {renderTextField('Etiqueta Categoría 3', 'navInfantilText', siteTexts.navInfantilText, 'INFANTIL')}
                {renderTextField('Etiqueta Categoría 4', 'navCorporativaText', siteTexts.navCorporativaText, 'VENTA CORPORATIVA')}
                {renderTextField('Etiqueta Pestaña Promociones', 'navPromosText', siteTexts.navPromosText, 'PROMOS')}
              </>
            )}

            {/* 2. CATALOG TEXTS */}
            {selectedSection === 'catalog' && (
              <>
                {renderTextField('Título Principal del Catálogo', 'catalogTitle', siteTexts.catalogTitle, 'CATÁLOGO OFICIAL')}
                {renderTextField('Subtítulo Descriptivo del Catálogo', 'catalogSubtitle', siteTexts.catalogSubtitle, 'Artículos de máxima resistencia para campo, industria y ciudad.', true)}
                {renderTextField('Placeholder de Búsqueda de Productos', 'catalogSearchPlaceholder', siteTexts.catalogSearchPlaceholder, 'Buscar por nombre, código PAM, sección o color...')}
                {renderTextField('Texto en Tarjeta de Producto ("Ver ficha")', 'viewProductCardText', siteTexts.viewProductCardText, 'Ver ficha')}
                {renderTextField('Texto de Botón "Agregar a Mi Pedido"', 'addToQuoteBtnText', siteTexts.addToQuoteBtnText, 'AGREGAR A MI PEDIDO')}
                {renderTextField('Texto de Botón "Consultar por WhatsApp"', 'whatsappConsultBtnText', siteTexts.whatsappConsultBtnText, 'CONSULTAR POR WHATSAPP')}
              </>
            )}

            {/* 3. PRODUCT DETAIL TEXTS */}
            {selectedSection === 'product_detail' && (
              <>
                {renderTextField('Etiqueta Selector de Talles', 'productDetailSizeLabel', siteTexts.productDetailSizeLabel, 'Seleccionar Talle:')}
                {renderTextField('Etiqueta Selector de Color', 'productDetailColorLabel', siteTexts.productDetailColorLabel, 'Color Seleccionado:')}
                {renderTextField('Texto Botón "Agregar a Mi Pedido"', 'productDetailAddBtnText', siteTexts.productDetailAddBtnText, 'AGREGAR A MI PEDIDO')}
                {renderTextField('Texto Botón "Consultar por WhatsApp"', 'productDetailWhatsappBtnText', siteTexts.productDetailWhatsappBtnText, 'CONSULTAR POR WHATSAPP')}
                {renderTextField('Texto de Garantía y Confianza', 'productDetailGuaranteeText', siteTexts.productDetailGuaranteeText, 'Garantía Oficial Pampero · Alta Resistencia y Nobleza', true)}
              </>
            )}

            {/* 4. QUOTE DRAWER TEXTS */}
            {selectedSection === 'quote_drawer' && (
              <>
                {renderTextField('Título de la Ventana Emergente', 'quoteDrawerTitle', siteTexts.quoteDrawerTitle, 'Mi Pedido')}
                {renderTextField('Texto de Botón de Envío', 'quoteDrawerSendBtnText', siteTexts.quoteDrawerSendBtnText, 'Pasar a WhatsApp')}
                {renderTextField('Placeholder para Observaciones del Cliente', 'quoteDrawerObservationsPlaceholder', siteTexts.quoteDrawerObservationsPlaceholder, 'Observaciones para el asesor: talles específicos, colores alternativos o sucursal de retiro preferida...', true)}
                {renderTextField('Título cuando el Carrito está Vacío', 'emptyCartTitle', siteTexts.emptyCartTitle, 'Tu pedido está vacío')}
                {renderTextField('Mensaje cuando el Carrito está Vacío', 'emptyCartSubtitle', siteTexts.emptyCartSubtitle, 'Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.', true)}
              </>
            )}

            {/* 5. AUTH TEXTS */}
            {selectedSection === 'auth' && (
              <>
                {renderTextField('Título de Formulario de Ingreso', 'authLoginTitle', siteTexts.authLoginTitle, 'ACCESO AL CATÁLOGO')}
                {renderTextField('Bajada de Formulario de Ingreso', 'authLoginSubtitle', siteTexts.authLoginSubtitle, 'Elegí el tipo de cuenta según cómo comprás: consumidor final o empresa.', true)}
                {renderTextField('Texto de Botón Principal "Ingresar"', 'authLoginBtnText', siteTexts.authLoginBtnText, 'INGRESAR')}
                {renderTextField('Título de Formulario de Registro', 'authRegisterTitle', siteTexts.authRegisterTitle, 'ACCESO AL CATÁLOGO')}
                {renderTextField('Bajada de Formulario de Registro', 'authRegisterSubtitle', siteTexts.authRegisterSubtitle, 'Registrate para solicitar presupuestos y seguimiento comercial', true)}
                {renderTextField('Título Acceso Empleados / Admin', 'authStaffTitle', siteTexts.authStaffTitle, 'ADMINISTRACIÓN Y EMPLEADOS')}
                {renderTextField('Bajada Acceso Empleados / Admin', 'authStaffSubtitle', siteTexts.authStaffSubtitle, 'Ingresá con tu usuario o email y contraseña autorizada.', true)}
                {renderTextField('Enlace para Ir a Registro', 'authToRegisterLinkText', siteTexts.authToRegisterLinkText, 'Regístrate')}
                {renderTextField('Enlace para Acceso Empleados / Admin', 'authToStaffLinkText', siteTexts.authToStaffLinkText, 'Acceso para Empleados/Admin')}
              </>
            )}

            {/* 6. HUB TEXTS */}
            {selectedSection === 'hub' && (
              <>
                {renderTextField('Etiqueta Superior del Hub', 'hubHeaderTag', siteTexts.hubHeaderTag, 'HUB DE TRABAJO INTERNO')}
                {renderTextField('Subtítulo Barra del Hub', 'hubHeaderSub', siteTexts.hubHeaderSub, 'Pampero Gran Mendoza · Sistema Operativo')}
                {renderTextField('Título Principal del Hub', 'hubTitle', siteTexts.hubTitle, 'Hub de Trabajo Interno')}
                {renderTextField('Subtítulo del Hub (opcional)', 'hubSubtitle', siteTexts.hubSubtitle, '')}
                {renderTextField('Etiqueta Rol Super Administrador', 'hubRoleAdminText', siteTexts.hubRoleAdminText, 'Super Administrador')}
                {renderTextField('Etiqueta Rol Encargado General', 'hubRoleEmployeeText', siteTexts.hubRoleEmployeeText, 'Encargado General · Todos los Locales')}
                {renderTextField('Título Tarjeta Gestión / CRM', 'hubCrmCardText', siteTexts.hubCrmCardText, 'Gestión / CRM')}
                {renderTextField('Descripción Tarjeta CRM', 'hubCrmCardDesc', siteTexts.hubCrmCardDesc, 'Tablero Kanban con cotizaciones, pedidos, visitas y seguimiento.', true)}
                {renderTextField('Botón Tarjeta CRM', 'hubCrmBtnText', siteTexts.hubCrmBtnText, 'Ir a Gestión / CRM')}
                {renderTextField('Título Tarjeta RRHH', 'hubRrhhCardText', siteTexts.hubRrhhCardText, 'RRHH')}
                {renderTextField('Descripción Tarjeta RRHH', 'hubRrhhCardDesc', siteTexts.hubRrhhCardDesc, 'Legajos de personal, fichaje GPS por local, horarios y vacaciones.', true)}
                {renderTextField('Botón Tarjeta RRHH', 'hubRrhhBtnText', siteTexts.hubRrhhBtnText, 'Ir a RRHH')}
                {renderTextField('Título Tarjeta Costos & Finanzas', 'hubCostsCardText', siteTexts.hubCostsCardText, 'Costos & Finanzas')}
                {renderTextField('Descripción Tarjeta Costos', 'hubCostsCardDesc', siteTexts.hubCostsCardDesc, 'Dashboard financiero y de liquidez, cheques, caja chica por local y costos.', true)}
                {renderTextField('Botón Tarjeta Costos', 'hubCostsBtnText', siteTexts.hubCostsBtnText, 'Ir a Costos')}
                {renderTextField('Título Tarjeta Chat Interno', 'hubChatCardText', siteTexts.hubChatCardText, 'Chat Interno')}
                {renderTextField('Descripción Tarjeta Chat', 'hubChatCardDesc', siteTexts.hubChatCardDesc, 'Mensajería directa en tiempo real con administradores, empleados y clientes.', true)}
                {renderTextField('Botón Tarjeta Chat', 'hubChatBtnText', siteTexts.hubChatBtnText, 'Abrir Chat')}
                {renderTextField('Título Tarjeta Panel de Control', 'hubAdminCardText', siteTexts.hubAdminCardText, 'Panel de Control')}
                {renderTextField('Descripción Tarjeta Panel', 'hubAdminCardDesc', siteTexts.hubAdminCardDesc, 'Administración de catálogo, precios, promociones y locales.', true)}
                {renderTextField('Botón Tarjeta Panel', 'hubAdminBtnText', siteTexts.hubAdminBtnText, 'Panel de Control')}
                {renderTextField('Título Tarjeta Catálogo Público', 'hubCatalogCardText', siteTexts.hubCatalogCardText, 'Catálogo Público')}
                {renderTextField('Descripción Tarjeta Catálogo', 'hubCatalogCardDesc', siteTexts.hubCatalogCardDesc, 'Acceso directo a la tienda y catálogo de productos.', true)}
                {renderTextField('Botón Tarjeta Catálogo', 'hubCatalogBtnText', siteTexts.hubCatalogBtnText, 'Ver Catálogo')}
                {renderTextField('Texto de Botón "Cerrar Sesión / Salir"', 'hubLogoutBtnText', siteTexts.hubLogoutBtnText, 'Salir')}
              </>
            )}

            {/* 7. CRM TEXTS */}
            {selectedSection === 'crm' && (
              <>
                {renderTextField('Título de la Cabecera CRM', 'crmTitle', siteTexts.crmTitle, 'Gestión Pampero')}
                {renderTextField('Subtítulo del CRM', 'crmSubtitle', siteTexts.crmSubtitle, 'Pampero Gran Mendoza')}
                {renderTextField('Botón Volver al Hub', 'crmBackBtnText', siteTexts.crmBackBtnText, 'Volver al Hub')}
                {renderTextField('Texto de Botón "Nuevo Pedido"', 'crmNewOrderBtnText', siteTexts.crmNewOrderBtnText, 'Nuevo Pedido')}
                {renderTextField('Pestaña 1: Visitas Comerciales', 'crmTabVisitsText', siteTexts.crmTabVisitsText, '1. Visitas Comerciales')}
                {renderTextField('Pestaña 2: Seguimiento Empresas', 'crmTabBoardText', siteTexts.crmTabBoardText, '2. Seguimiento Empresas')}
                {renderTextField('Pestaña 3: Tareas', 'crmTabTasksText', siteTexts.crmTabTasksText, '3. Tareas')}
                {renderTextField('Pestaña 4: Calendario', 'crmTabCalendarText', siteTexts.crmTabCalendarText, '4. Calendario')}
                {renderTextField('Pestaña Pedidos Proveedor', 'crmTabSuppliersText', siteTexts.crmTabSuppliersText, 'Pedidos Proveedor')}
                {renderTextField('Pestaña Control de Costos', 'crmTabCostsText', siteTexts.crmTabCostsText, 'Control de Costos')}
                {renderTextField('Título Columna 1 (Cotizaciones)', 'crmColCotizacionText', siteTexts.crmColCotizacionText, 'Cotización Recibida')}
                {renderTextField('Título Columna 2 (Producción)', 'crmColProduccionText', siteTexts.crmColProduccionText, 'En Producción')}
                {renderTextField('Título Columna 3 (Listo)', 'crmColListoText', siteTexts.crmColListoText, 'Listo para Retiro')}
                {renderTextField('Botón Notificaciones', 'crmNotifBtnText', siteTexts.crmNotifBtnText, 'Notificaciones')}
                {renderTextField('Título Ventana Notificaciones', 'crmNotifTitle', siteTexts.crmNotifTitle, 'Centro de Alertas & Notificaciones')}
                {renderTextField('Botón Faltantes', 'crmShortagesBtnText', siteTexts.crmShortagesBtnText, 'Faltantes')}
                {renderTextField('Título Ventana Faltantes', 'crmShortagesTitle', siteTexts.crmShortagesTitle, 'Faltantes & Pedido a Proveedor')}
                {renderTextField('Botón Observaciones', 'crmObservationsBtnText', siteTexts.crmObservationsBtnText, 'Observaciones')}
                {renderTextField('Visitas — Título', 'crmVisitsTitle', siteTexts.crmVisitsTitle, 'Visitas Comerciales')}
                {renderTextField('Visitas — Subtítulo', 'crmVisitsSubtitle', siteTexts.crmVisitsSubtitle, 'Registro de visitas en terreno y prospección corporativa.', true)}
                {renderTextField('Visitas — Botón', 'crmNewVisitBtnText', siteTexts.crmNewVisitBtnText, 'Registrar Visita')}
                {renderTextField('Tareas — Título', 'crmTasksTitle', siteTexts.crmTasksTitle, 'Tablero de Tareas Operativas')}
                {renderTextField('Tareas — Subtítulo', 'crmTasksSubtitle', siteTexts.crmTasksSubtitle, 'Organización interna, entregas, cobros y seguimientos.', true)}
                {renderTextField('Tareas — Botón', 'crmNewTaskBtnText', siteTexts.crmNewTaskBtnText, 'Nueva Tarea')}
                {renderTextField('Calendario — Título', 'crmCalendarTitle', siteTexts.crmCalendarTitle, 'Calendario Comercial & Vencimientos')}
                {renderTextField('Calendario — Subtítulo', 'crmCalendarSubtitle', siteTexts.crmCalendarSubtitle, 'Feriados, tareas, visitas y recordatorios.', true)}
                {renderTextField('Calendario — Botón', 'crmNewEventBtnText', siteTexts.crmNewEventBtnText, 'Nuevo Evento / Recordatorio')}
                {renderTextField('Proveedores — Título', 'crmSuppliersTitle', siteTexts.crmSuppliersTitle, 'Pedidos a Proveedores & Stock')}
                {renderTextField('Proveedores — Subtítulo', 'crmSuppliersSubtitle', siteTexts.crmSuppliersSubtitle, 'Agrupación automática de faltantes del catálogo.', true)}
              </>
            )}

            {/* 8. CORPORATE SERVICES TEXTS */}
            {selectedSection === 'corporate_services' && (
              <>
                {renderTextField('Título Portal de Curva de Talles', 'sizingPortalTitle', siteTexts.sizingPortalTitle, 'Portal de Curva de Talles Corporativos')}
                {renderTextField('Subtítulo Portal de Talles', 'sizingPortalSubtitle', siteTexts.sizingPortalSubtitle, 'Planilla y relevamiento de indumentaria para personal de empresas', true)}
                {renderTextField('Título Simulador de Uniformes', 'uniformSimulatorTitle', siteTexts.uniformSimulatorTitle, 'Armador de Uniformes Virtual · Pampero Mendoza')}
                {renderTextField('Subtítulo Simulador de Uniformes', 'uniformSimulatorSubtitle', siteTexts.uniformSimulatorSubtitle, 'Diseñá y previsualizá la dotación completa de tu cuadrilla', true)}
                {renderTextField('Texto de Botón de Cotización B2B', 'corporateQuoteBtnText', siteTexts.corporateQuoteBtnText, 'SOLICITAR COTIZACIÓN DE DOTACIÓN')}
              </>
            )}

            {/* 9. FOOTER TEXTS */}
            {selectedSection === 'footer' && (
              <>
                {renderTextField('Título Columna Contacto', 'footerContactTitle', siteTexts.footerContactTitle, 'CONTACTO')}
                {renderTextField('Título Columna Locales', 'footerBranchesTitle', siteTexts.footerBranchesTitle, 'LOCALES')}
                {renderTextField('Lema o Bajada Institucional', 'footerTagline', siteTexts.footerTagline, 'Atención personalizada a particulares y ventas corporativas.')}
                {renderTextField('Párrafo de Presentación de la Empresa', 'footerAbout', siteTexts.footerAbout, 'Catálogo digital de exhibición oficial en Gran Mendoza.', true)}
                {renderTextField('Teléfono de Contacto', 'footerPhone', siteTexts.footerPhone, '261 527-6713')}
                {renderTextField('Email de Contacto', 'footerEmail', siteTexts.footerEmail, 'pamperogranmendoza@gmail.com')}
                {renderTextField('Dirección de Sucursales', 'footerAddress', siteTexts.footerAddress, 'Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)', true)}
                {renderTextField('Texto Botón WhatsApp Footer', 'footerWhatsappBtnText', siteTexts.footerWhatsappBtnText, 'WhatsApp 261 527-6713')}
                {renderTextField('Enlace Acceso Administrador Footer', 'footerAdminLinkText', siteTexts.footerAdminLinkText, 'Acceso Administrador (Panel de Control)')}
              </>
            )}

            {/* 10. BARRA LATERAL TEXTS INFO */}
            {selectedSection === 'sidebar' && (
              <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#4A453F] space-y-2">
                <p className="font-bold text-[#18231C] uppercase">Barra Lateral Unificada</p>
                <p>
                  Los 4 controles de color a la izquierda actualizan la barra lateral en <strong>Gestión Pampero</strong>, <strong>Panel de Control</strong>, <strong>RRHH</strong> y <strong>Costos & Finanzas</strong>. Para editar los nombres de cada módulo o pestaña, elegí la sección correspondiente arriba.
                </p>
              </div>
            )}

            {/* 11. RRHH TEXTS */}
            {selectedSection === 'rrhh' && (
              <>
                {renderTextField('Título Módulo RRHH', 'rrhhTitle', siteTexts.rrhhTitle, 'Recursos Humanos')}
                {renderTextField('Subtítulo Módulo RRHH', 'rrhhSubtitle', siteTexts.rrhhSubtitle, 'Control de asistencia GPS, legajo de personal y cronograma por sucursal.', true)}
                {renderTextField('Pestaña 1: Fichaje GPS', 'rrhhFichajeTabText', siteTexts.rrhhFichajeTabText, '1. Fichaje GPS')}
                {renderTextField('Pestaña 2: Mi Legajo', 'rrhhLegajoTabText', siteTexts.rrhhLegajoTabText, '2. Mi Legajo & Horarios')}
                {renderTextField('Título Tarjeta Fichaje', 'rrhhFichajeCardTitle', siteTexts.rrhhFichajeCardTitle, 'Fichaje de Llegada al Local')}
                {renderTextField('Subtítulo Tarjeta Fichaje', 'rrhhFichajeCardSubtitle', siteTexts.rrhhFichajeCardSubtitle, 'Registrá tu ingreso o salida con fecha, hora exacta y ubicación GPS verificada.', true)}
                {renderTextField('Botón Registrar Llegada', 'rrhhFichajeBtnText', siteTexts.rrhhFichajeBtnText, 'Registrar Llegada Ahora')}
                {renderTextField('Botón Configurar en Panel', 'rrhhAdminBtnText', siteTexts.rrhhAdminBtnText, 'Configurar en Panel')}
                {renderTextField('Botón Volver al Hub', 'rrhhBackBtnText', siteTexts.rrhhBackBtnText, 'Volver al Hub')}
              </>
            )}

            {/* 12. COSTOS & FINANZAS TEXTS */}
            {selectedSection === 'costs' && (
              <>
                {renderTextField('Título Módulo Costos', 'costsTitle', siteTexts.costsTitle, 'Costos & Finanzas')}
                {renderTextField('Subtítulo Módulo Costos', 'costsSubtitle', siteTexts.costsSubtitle, 'Liquidez, cheques, caja chica por local y control operativo', true)}
                {renderTextField('Pestaña 1: Dashboard', 'costsTabDashboardText', siteTexts.costsTabDashboardText, '1. Dashboard & Liquidez')}
                {renderTextField('Pestaña 2: Costos y Ventas', 'costsTabCostsText', siteTexts.costsTabCostsText, '2. Costos y Ventas')}
                {renderTextField('Pestaña 3: Facturas & Gastos', 'costsTabInvoicesText', siteTexts.costsTabInvoicesText, '3. Facturas & Gastos')}
                {renderTextField('Pestaña 4: Cheques', 'costsTabChecksText', siteTexts.costsTabChecksText, '4. Cheques Emitidos y Recibidos')}
                {renderTextField('Pestaña 5: Caja Chica', 'costsTabPettyCashText', siteTexts.costsTabPettyCashText, '5. Caja Chica por Local')}
                {renderTextField('Título Dashboard Liquidez', 'costsDashTitle', siteTexts.costsDashTitle, 'Tablero Financiero & Liquidez Global')}
                {renderTextField('Subtítulo Dashboard Liquidez', 'costsDashSubtitle', siteTexts.costsDashSubtitle, 'Cruce en tiempo real de ventas CRM, costos, cheques y caja chica.', true)}
                {renderTextField('Botón Volver al Hub', 'costsBackBtnText', siteTexts.costsBackBtnText, 'Volver al Hub')}
              </>
            )}

            {/* 13. CHAT INTERNO TEXTS */}
            {selectedSection === 'chat' && (
              <>
                {renderTextField('Título Ventana Chat', 'chatTitle', siteTexts.chatTitle, 'Chat Interno Pampero')}
                {renderTextField('Subtítulo Ventana Chat', 'chatSubtitle', siteTexts.chatSubtitle, 'Mensajería directa en tiempo real con administradores, empleados y clientes.', true)}
                {renderTextField('Botón Menú / Acceso Chat', 'chatNavBtnText', siteTexts.chatNavBtnText, 'Chat / Mensajes')}
                {renderTextField('Placeholder Caja de Mensaje', 'chatInputPlaceholder', siteTexts.chatInputPlaceholder, 'Escribí un mensaje directo...')}
                {renderTextField('Botón Enviar', 'chatSendBtnText', siteTexts.chatSendBtnText, 'Enviar')}
              </>
            )}
          </div>
        </div>
      </div>

      {/* TARJETA DE PREVISUALIZACIÓN DE LA SECCIÓN */}
      <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#DCD4C9] space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h5 className="font-extrabold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-500" />
            Previsualización Rápida de {activeSectionDef.name}
          </h5>
          <span className="text-[10px] text-[#8C827A] uppercase font-mono">
            Muestra de Elementos con Variables Asignadas
          </span>
        </div>

        {/* Live Preview Box */}
        <div 
          className="p-5 rounded-xs border transition-all"
          style={{
            backgroundColor: 
              selectedSection === 'navbar' ? (theme.navbarBgColor || theme.headerBgColor || '#FFFFFF') :
              selectedSection === 'catalog' ? (theme.catalogBgColor || theme.backgroundColor || '#F5F2EC') :
              selectedSection === 'product_detail' ? (theme.productDetailBgColor || '#FFFFFF') :
              selectedSection === 'quote_drawer' ? (theme.quoteDrawerBgColor || theme.primaryColor || '#18231C') :
              selectedSection === 'auth' ? (theme.loginModalBgColor || theme.panelBgColor || '#FAF8F5') :
              selectedSection === 'hub' ? (theme.hubBgColor || '#18231C') :
              selectedSection === 'crm' ? (theme.crmHeaderBgColor || '#FFFFFF') :
              selectedSection === 'corporate_services' ? (theme.corporateServicesBgColor || theme.backgroundColor || '#F5F2EC') :
              (selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs') ? (theme.sidebarBgColor || theme.primaryColor || '#18231C') :
              selectedSection === 'chat' ? (theme.primaryColor || '#18231C') :
              (theme.footerBgColor || theme.primaryColor || '#18231C'),
            borderColor: '#DCD4C9'
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span 
                className="text-sm font-extrabold uppercase tracking-wider block"
                style={{
                  color: 
                    selectedSection === 'navbar' ? (theme.navbarTextColor || theme.headerTextColor || '#18231C') :
                    selectedSection === 'catalog' ? (theme.catalogTitleColor || '#18231C') :
                    selectedSection === 'product_detail' ? (theme.productDetailTextColor || '#18231C') :
                    selectedSection === 'quote_drawer' ? (theme.quoteDrawerTextColor || '#FFFFFF') :
                    selectedSection === 'auth' ? (theme.loginModalTextColor || theme.textColor || '#18231C') :
                    selectedSection === 'hub' ? (theme.hubTextColor || '#F5F2EC') :
                    selectedSection === 'crm' ? (theme.crmHeaderTextColor || '#18231C') :
                    selectedSection === 'corporate_services' ? (theme.corporateServicesTextColor || '#18231C') :
                    (selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs') ? (theme.sidebarTextColor || '#F5F2EC') :
                    selectedSection === 'chat' ? '#FFFFFF' :
                    (theme.footerTextColor || '#F5F2EC')
                }}
              >
                {selectedSection === 'navbar' && (siteTexts.announcementBarText || 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO')}
                {selectedSection === 'catalog' && (siteTexts.catalogTitle || 'CATÁLOGO OFICIAL')}
                {selectedSection === 'product_detail' && 'Camisa Ombú Manga Larga (Ejemplo)'}
                {selectedSection === 'quote_drawer' && (siteTexts.quoteDrawerTitle || 'Mi Pedido')}
                {selectedSection === 'auth' && (siteTexts.authLoginTitle || 'ACCESO AL CATÁLOGO')}
                {selectedSection === 'hub' && (siteTexts.hubTitle || 'HUB DE TRABAJO INTERNO')}
                {selectedSection === 'crm' && (siteTexts.crmTitle || 'Gestión Pampero')}
                {selectedSection === 'corporate_services' && (siteTexts.sizingPortalTitle || 'Portal de Curva de Talles')}
                {selectedSection === 'sidebar' && 'Barra Lateral · Menú Activo'}
                {selectedSection === 'rrhh' && (siteTexts.rrhhTitle || 'Recursos Humanos')}
                {selectedSection === 'costs' && (siteTexts.costsTitle || 'Costos & Finanzas')}
                {selectedSection === 'chat' && (siteTexts.chatTitle || 'Chat Interno Pampero')}
                {selectedSection === 'footer' && (siteTexts.footerTagline || 'Catálogo digital de exhibición oficial')}
              </span>
              <p 
                className="text-xs"
                style={{
                  color: 
                    selectedSection === 'navbar' ? (theme.navbarSecondaryTextColor || theme.headerAccentColor || '#6F6860') :
                    selectedSection === 'catalog' ? (theme.catalogSecondaryTextColor || '#6F6860') :
                    selectedSection === 'product_detail' ? (theme.productDetailSecondaryTextColor || '#6F6860') :
                    selectedSection === 'quote_drawer' ? (theme.quoteDrawerSecondaryTextColor || '#DCD4C9') :
                    selectedSection === 'auth' ? (theme.loginModalSecondaryTextColor || '#6F6860') :
                    selectedSection === 'hub' ? (theme.hubSecondaryTextColor || '#DCD4C9') :
                    selectedSection === 'crm' ? (theme.crmSecondaryTextColor || '#6F6860') :
                    selectedSection === 'corporate_services' ? (theme.corporateServicesSecondaryTextColor || '#6F6860') :
                    (selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs') ? (theme.sidebarTextColor || '#DCD4C9') :
                    selectedSection === 'chat' ? '#DCD4C9' :
                    (theme.footerSecondaryTextColor || '#DCD4C9')
                }}
              >
                Previsualización en tiempo real de tipografía, contraste y botones asignados.
              </p>
            </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xs text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              style={{
                backgroundColor: 
                  selectedSection === 'navbar' ? (theme.navbarButtonBg || theme.primaryColor || '#18231C') :
                  selectedSection === 'catalog' ? (theme.catalogButtonBg || theme.cardButtonBg || '#18231C') :
                  selectedSection === 'product_detail' ? (theme.productDetailButtonBg || theme.primaryColor || '#18231C') :
                  selectedSection === 'quote_drawer' ? (theme.quoteDrawerButtonBg || theme.accentColor || '#FDB813') :
                  selectedSection === 'auth' ? (theme.loginModalButtonBg || theme.primaryColor || '#18231C') :
                  selectedSection === 'hub' ? (theme.hubButtonBg || theme.primaryColor || '#18231C') :
                  selectedSection === 'crm' ? (theme.crmButtonBg || theme.primaryColor || '#18231C') :
                  selectedSection === 'corporate_services' ? (theme.corporateServicesButtonBg || theme.primaryColor || '#18231C') :
                  (selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs') ? (theme.sidebarAccentColor || theme.accentColor || '#FDB813') :
                  selectedSection === 'chat' ? (theme.accentColor || '#FDB813') :
                  (theme.footerButtonBg || theme.footerAccentColor || '#FDB813'),
                color: 
                  selectedSection === 'navbar' ? (theme.navbarButtonTextColor || '#FFFFFF') :
                  selectedSection === 'catalog' ? (theme.catalogButtonTextColor || '#FFFFFF') :
                  selectedSection === 'product_detail' ? (theme.productDetailButtonTextColor || '#FFFFFF') :
                  selectedSection === 'quote_drawer' ? (theme.quoteDrawerButtonTextColor || '#18231C') :
                  selectedSection === 'auth' ? (theme.loginModalButtonTextColor || '#FFFFFF') :
                  selectedSection === 'hub' ? (theme.hubButtonTextColor || '#FFFFFF') :
                  selectedSection === 'crm' ? (theme.crmButtonTextColor || '#FFFFFF') :
                  selectedSection === 'corporate_services' ? (theme.corporateServicesButtonTextColor || '#FFFFFF') :
                  (selectedSection === 'sidebar' || selectedSection === 'rrhh' || selectedSection === 'costs' || selectedSection === 'chat') ? '#18231C' :
                  (theme.footerButtonTextColor || '#FFFFFF')
              }}
            >
              {selectedSection === 'navbar' && (siteTexts.quoteButtonText || 'MI PEDIDO')}
              {selectedSection === 'catalog' && (siteTexts.viewProductCardText || 'Ver ficha')}
              {selectedSection === 'product_detail' && (siteTexts.productDetailAddBtnText || 'AGREGAR A MI PEDIDO')}
              {selectedSection === 'quote_drawer' && (siteTexts.quoteDrawerSendBtnText || 'Pasar a WhatsApp')}
              {selectedSection === 'auth' && (siteTexts.authLoginBtnText || 'INGRESAR')}
              {selectedSection === 'hub' && (siteTexts.hubCrmCardText || 'IR A GESTIÓN / CRM')}
              {selectedSection === 'crm' && (siteTexts.crmNewOrderBtnText || 'Nuevo Pedido')}
              {selectedSection === 'corporate_services' && (siteTexts.corporateQuoteBtnText || 'SOLICITAR COTIZACIÓN')}
              {selectedSection === 'sidebar' && 'Ítem Activo'}
              {selectedSection === 'rrhh' && (siteTexts.rrhhFichajeBtnText || 'Registrar Llegada Ahora')}
              {selectedSection === 'costs' && (siteTexts.costsTabDashboardText || 'Dashboard & Liquidez')}
              {selectedSection === 'chat' && (siteTexts.chatSendBtnText || 'Enviar')}
              {selectedSection === 'footer' && 'CONSULTAR POR WHATSAPP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
