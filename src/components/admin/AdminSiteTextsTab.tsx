import React, { useState, useEffect } from 'react';
import { ThemeConfig, SiteTextsConfig } from '../../types';
import {
  Type,
  Save,
  Check,
  RotateCcw,
  Layout,
  Sparkles,
  Search,
  ShoppingBag,
  MapPin,
  Eye,
  Lock,
  Layers,
  Kanban,
  Briefcase,
  Users,
  Wallet,
  MessageSquare,
} from 'lucide-react';
import { saveFirestoreStoreConfig, recordAuditLog } from '../../services/firebase';

interface AdminSiteTextsTabProps {
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  triggerSaveNotice: () => void;
}

type SiteTextSectionId =
  | 'header'
  | 'hero'
  | 'catalog'
  | 'product_detail'
  | 'quote'
  | 'auth'
  | 'hub'
  | 'crm'
  | 'corporate'
  | 'footer'
  | 'rrhh'
  | 'costs'
  | 'chat';

const DEFAULT_SITE_TEXTS: SiteTextsConfig = {
  // 1. Header & Navbar
  announcementBarText: 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO',
  searchPlaceholder: 'Buscar en el catálogo...',
  quoteButtonText: 'Mi Pedido',
  loginButtonText: 'INGRESAR',
  navHombreText: 'Hombre',
  navMujerText: 'Mujer',
  navInfantilText: 'Infantil',
  navCorporativaText: 'Venta Corporativa',
  navPromosText: 'Promociones',

  // 2. Portada & Hero
  heroTitleLine1: 'INDUMENTARIA QUE',
  heroTitleLine2: 'AGUANTA EL TRABAJO',
  heroSubtitle: 'Catálogo digital de exhibición. Hombre, mujer, infantil y venta corporativa, con fichas de producto, talles, colores y promociones vigentes.',
  heroPrimaryBtnText: 'VER CATÁLOGO',
  heroCorporateBtnText: 'CUENTA EMPRESA',
  heroWhatsAppBtnText: 'CONSULTAR POR WHATSAPP',

  // 3. Catálogo & Tarjetas
  catalogTitle: 'CATÁLOGO OFICIAL',
  catalogSubtitle: 'Artículos de máxima resistencia para campo, industria y ciudad.',
  catalogSearchPlaceholder: 'Buscar por nombre, código PAM, sección o color...',
  viewProductCardText: 'Ver ficha',
  addToQuoteBtnText: 'AGREGAR A MI PEDIDO',
  whatsappConsultBtnText: 'CONSULTAR POR WHATSAPP',

  // 4. Ficha de Producto
  productDetailSizeLabel: 'Seleccionar Talle:',
  productDetailColorLabel: 'Color Seleccionado:',
  productDetailAddBtnText: 'AGREGAR A MI PEDIDO',
  productDetailWhatsappBtnText: 'CONSULTAR POR WHATSAPP',
  productDetailGuaranteeText: 'Catálogo de exhibición oficial: no se procesan cobros en línea. Consultá disponibilidad inmediata por WhatsApp o en nuestros locales de Gran Mendoza.',

  // 5. Mi Pedido & Cotizador
  quoteDrawerTitle: 'Mi Pedido',
  quoteDrawerSendBtnText: 'Pasar a WhatsApp',
  quoteDrawerObservationsPlaceholder: 'Ej: Bordado de logo Pampero en pecho izquierdo, solicitud de muestra física, plazos de entrega...',
  emptyCartTitle: 'Tu pedido está vacío',
  emptyCartSubtitle: 'Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.',

  // 6. Acceso, Login & Registro
  authLoginTitle: 'ACCESO AL CATÁLOGO',
  authLoginSubtitle: 'Elegí el tipo de cuenta según cómo comprás: consumidor final o empresa. Los datos se usan solo para identificar tu cuenta y para el contacto comercial.',
  authLoginBtnText: 'INGRESAR',
  authRegisterTitle: 'ACCESO AL CATÁLOGO',
  authRegisterSubtitle: 'Elegí el tipo de cuenta según cómo comprás: consumidor final o empresa. Los datos se usan solo para identificar tu cuenta y para el contacto comercial.',
  authStaffTitle: 'ADMINISTRACIÓN Y COLABORADORES',
  authStaffSubtitle: 'Ingresá con tu usuario o email y contraseña autorizada (Administrador o Colaborador) para acceder al panel de control.',
  authToRegisterLinkText: 'Regístrate',
  authToStaffLinkText: 'Acceso para Colaboradores/Admin',

  // 7. Hub de Trabajo Interno
  hubHeaderTag: 'HUB DE TRABAJO INTERNO',
  hubHeaderSub: 'Pampero Gran Mendoza · Sistema Operativo',
  hubTitle: 'Hub de Trabajo Interno',
  hubSubtitle: '',
  hubRoleAdminText: 'Super Administrador',
  hubRoleEmployeeText: 'Encargado General · Todos los Locales',
  hubCrmCardText: 'Gestión / CRM',
  hubCrmCardDesc: 'Tablero Kanban con cotizaciones entrantes, pedidos en curso, visitas a empresas y seguimiento comercial.',
  hubCrmBtnText: 'Ir a Gestión / CRM',
  hubRrhhCardText: 'RRHH',
  hubRrhhCardDesc: 'Legajos de personal, fichaje de llegada con horario y GPS exacto por local, horarios y vacaciones.',
  hubRrhhBtnText: 'Ir a RRHH',
  hubCostsCardText: 'Costos & Finanzas',
  hubCostsCardDesc: 'Dashboard de situación y liquidez, cheques emitidos y recibidos, caja chica por local y control de costos.',
  hubCostsBtnText: 'Ir a Costos',
  hubChatCardText: 'Chat Interno',
  hubChatCardDesc: 'Mensajería directa en tiempo real entre administradores, colaboradores de locales y clientes registrados.',
  hubChatBtnText: 'Abrir Chat',
  hubAdminCardText: 'Panel de Control',
  hubAdminCardDesc: 'Administración de catálogo, precios, promociones, operadores, locales y configuración integral.',
  hubAdminBtnText: 'Panel de Control',
  hubCatalogCardText: 'Catálogo Público',
  hubCatalogCardDesc: 'Acceso directo a la tienda y catálogo de productos para consultar prendas, precios y visualización desde la vista del cliente.',
  hubCatalogBtnText: 'Ver Catálogo',
  hubLogoutBtnText: 'Salir',

  // 8. Gestión / CRM
  crmTitle: 'Gestión Pampero',
  crmSubtitle: 'Pampero Gran Mendoza',
  crmBackBtnText: 'Volver al Hub',
  crmNewOrderBtnText: 'Nuevo Pedido',
  crmTabVisitsText: '1. Visitas Comerciales',
  crmTabBoardText: '2. Seguimiento Empresas',
  crmTabTasksText: '3. Tareas',
  crmTabCalendarText: '4. Calendario',
  crmTabSuppliersText: 'Pedidos Proveedor',
  crmTabCostsText: 'Control de Costos',
  crmColCotizacionText: 'Cotización Recibida',
  crmColProduccionText: 'En Producción',
  crmColListoText: 'Listo para Retiro',
  crmVisitsTitle: 'Visitas Comerciales',
  crmVisitsSubtitle: 'Registro de visitas en terreno, prospección corporativa y seguimiento de cuentas en Gran Mendoza.',
  crmNewVisitBtnText: 'Registrar Visita',
  crmTasksTitle: 'Tablero de Tareas Operativas',
  crmTasksSubtitle: 'Organización interna, entregas, cobros, seguimientos y vencimientos asignados al equipo.',
  crmNewTaskBtnText: 'Nueva Tarea',
  crmCalendarTitle: 'Calendario Comercial & Vencimientos',
  crmCalendarSubtitle: 'Feriados comerciales, tareas pendientes, visitas agendadas, entregas y recordatorios internos.',
  crmNewEventBtnText: 'Nuevo Evento / Recordatorio',
  crmSuppliersTitle: 'Pedidos a Proveedores & Stock',
  crmSuppliersSubtitle: 'Agrupación automática de faltantes del catálogo y reposición por proveedor.',
  crmShortagesTitle: 'Faltantes & Pedido a Proveedor',
  crmShortagesBtnText: 'Faltantes',
  crmObservationsBtnText: 'Observaciones',
  crmNotifBtnText: 'Notificaciones',
  crmNotifTitle: 'Centro de Alertas & Notificaciones',

  // 9. Servicios Corporativos
  sizingPortalTitle: 'Portal de Curva de Talles Corporativos',
  sizingPortalSubtitle: 'Planilla y relevamiento de indumentaria para personal de empresas',
  uniformSimulatorTitle: 'Armador de Uniformes Virtual · Pampero Mendoza',
  uniformSimulatorSubtitle: 'Diseñá y previsualizá la dotación completa de tu cuadrilla',
  corporateQuoteBtnText: 'SOLICITAR COTIZACIÓN DE DOTACIÓN',

  // 10. Footer & Contacto
  footerContactTitle: 'CONTACTO',
  footerBranchesTitle: 'LOCALES',
  footerTagline: 'Atención personalizada a particulares y ventas corporativas para cualquier tipo de empresa.',
  footerAbout: 'Catálogo digital de exhibición. Precios e imágenes sujetos a actualización. Distribución oficial en Gran Mendoza.',
  footerPhone: '261 527-6713',
  footerEmail: 'pamperogranmendoza@gmail.com',
  footerAddress: 'Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)',
  footerWhatsappBtnText: '',
  footerAdminLinkText: 'Acceso Administrador (Panel de Control)',

  // 11. RRHH
  rrhhTitle: 'Recursos Humanos',
  rrhhSubtitle: 'Control de asistencia GPS, legajo de personal y cronograma por sucursal.',
  rrhhFichajeTabText: '1. Fichaje GPS',
  rrhhLegajoTabText: '2. Mi Legajo & Horarios',
  rrhhFichajeCardTitle: 'Fichaje de Llegada al Local',
  rrhhFichajeCardSubtitle: 'Registrá tu ingreso o salida con fecha, hora exacta y ubicación GPS verificada.',
  rrhhFichajeBtnText: 'Registrar Llegada Ahora',
  rrhhAdminBtnText: 'Configurar en Panel',
  rrhhBackBtnText: 'Volver al Hub',

  // 12. Costos & Finanzas
  costsTitle: 'Costos & Finanzas',
  costsSubtitle: 'Liquidez, cheques, caja chica por local y control operativo',
  costsTabDashboardText: '1. Dashboard & Liquidez',
  costsTabCostsText: '2. Costos y Ventas',
  costsTabInvoicesText: '3. Facturas & Gastos',
  costsTabChecksText: '4. Cheques Emitidos y Recibidos',
  costsTabPettyCashText: '5. Caja Chica por Local',
  costsDashTitle: 'Tablero Financiero & Liquidez Global',
  costsDashSubtitle: 'Cruce en tiempo real de ventas CRM, costos fijos/variables, cartera de cheques y saldos de caja chica.',
  costsBackBtnText: 'Volver al Hub',

  // 13. Chat Interno
  chatTitle: 'Chat Interno Pampero',
  chatSubtitle: 'Mensajería directa en tiempo real con administradores, colaboradores y clientes.',
  chatInputPlaceholder: 'Escribí un mensaje directo...',
  chatSendBtnText: 'Enviar',
  chatNavBtnText: 'Chat / Mensajes',
};

export const AdminSiteTextsTab: React.FC<AdminSiteTextsTabProps> = ({
  theme,
  onUpdateTheme,
  triggerSaveNotice,
}) => {
  const [activeSection, setActiveSection] = useState<SiteTextSectionId>('header');

  const [siteTexts, setSiteTexts] = useState<SiteTextsConfig>(() => ({
    ...DEFAULT_SITE_TEXTS,
    ...(theme?.siteTexts || {}),
    ...(theme?.screenTexts || {}),
  }));

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (theme?.siteTexts || theme?.screenTexts) {
      setSiteTexts((prev) => ({
        ...prev,
        ...(theme?.siteTexts || {}),
        ...(theme?.screenTexts || {}),
      }));
    }
  }, [theme]);

  const handleChange = (field: keyof SiteTextsConfig, val: string) => {
    const updatedTexts: SiteTextsConfig = {
      ...siteTexts,
      [field]: val,
    };
    setSiteTexts(updatedTexts);

    const updatedTheme: ThemeConfig = {
      ...theme,
      siteTexts: updatedTexts,
      screenTexts: updatedTexts,
    };
    onUpdateTheme(updatedTheme);
    try {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(updatedTheme));
      localStorage.setItem('pampero_theme_config', JSON.stringify(updatedTheme));
    } catch {}
  };

  const handleSaveAll = async () => {
    const updatedTheme: ThemeConfig = {
      ...theme,
      siteTexts,
      screenTexts: siteTexts,
    };
    onUpdateTheme(updatedTheme);
    try {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(updatedTheme));
      localStorage.setItem('pampero_theme_config', JSON.stringify(updatedTheme));
    } catch {}

    await saveFirestoreStoreConfig({
      theme: updatedTheme,
      siteTexts,
    });

    recordAuditLog({
      module: 'Textos de la Interfaz',
      action: 'Actualizar Textos',
      details: 'El administrador actualizó los textos dinámicos globales de la tienda.',
    }).catch(() => {});

    triggerSaveNotice();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetDefaults = () => {
    if (!confirm('¿Deseás restaurar todos los textos predeterminados originales de la plataforma?')) return;
    setSiteTexts({ ...DEFAULT_SITE_TEXTS });
    const updatedTheme: ThemeConfig = {
      ...theme,
      siteTexts: { ...DEFAULT_SITE_TEXTS },
      screenTexts: { ...DEFAULT_SITE_TEXTS },
    };
    onUpdateTheme(updatedTheme);
    saveFirestoreStoreConfig({ theme: updatedTheme, siteTexts: { ...DEFAULT_SITE_TEXTS } });
    triggerSaveNotice();
  };

  const renderInput = (
    label: string,
    field: keyof SiteTextsConfig,
    placeholder: string,
    hint?: string,
    multiline = false,
    span2 = false
  ) => (
    <div className={`space-y-1.5 ${span2 ? 'md:col-span-2' : ''}`}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={2}
          value={siteTexts[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
        />
      ) : (
        <input
          type="text"
          value={siteTexts[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
        />
      )}
      {hint && <span className="text-[10px] text-[#6F6860] block">{hint}</span>}
    </div>
  );

  const SECTIONS: Array<{ id: SiteTextSectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'header', label: '1. Cabecera & Menú', icon: Layout },
    { id: 'hero', label: '2. Portada & Hero', icon: Sparkles },
    { id: 'catalog', label: '3. Catálogo & Tarjetas', icon: Search },
    { id: 'product_detail', label: '4. Ficha Producto', icon: Eye },
    { id: 'quote', label: '5. Mi Pedido', icon: ShoppingBag },
    { id: 'auth', label: '6. Login & Registro', icon: Lock },
    { id: 'hub', label: '7. Hub Interno', icon: Layers },
    { id: 'crm', label: '8. Gestión / CRM', icon: Kanban },
    { id: 'corporate', label: '9. Corporativo', icon: Briefcase },
    { id: 'footer', label: '10. Footer & Contacto', icon: MapPin },
    { id: 'rrhh', label: '11. RRHH', icon: Users },
    { id: 'costs', label: '12. Costos & Finanzas', icon: Wallet },
    { id: 'chat', label: '13. Chat Interno', icon: MessageSquare },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <Type className="w-6 h-6 text-[#FDB813]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Textos de la Interfaz & Mensajes (13 Secciones)
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Personalizá títulos, pestañas, botones, tarjetas del Hub, enlaces de acceso, placeholders y pie de página sin modificar código.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4 text-amber-400" />}
              {isSaved ? '¡Guardado con Éxito!' : 'Guardar Todos los Textos'}
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[11px] font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar textos de fábrica"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#B9522F]" />
              Restablecer
            </button>
          </div>
        </div>

        {/* Section Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#18231C] text-[#F5F2EC] shadow-xs'
                    : 'bg-[#FAF8F5] text-[#6F6860] hover:text-[#18231C] border border-[#DCD4C9]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FDB813]' : 'opacity-70'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: HEADER & NAVBAR */}
      {activeSection === 'header' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Layout className="w-4 h-4 text-[#FDB813]" />
              Encabezado, Anuncios, Categorías y Barra Superior
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Micro-anuncio superior (Cintillo informativo)', 'announcementBarText', 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO', 'Franja superior oscura sobre el Navbar.')}
            {renderInput('Placeholder del buscador rápido en Navbar', 'searchPlaceholder', 'Buscar en el catálogo...')}
            {renderInput('Texto del botón de Carrito / Cotización', 'quoteButtonText', 'Mi Pedido')}
            {renderInput('Texto botón Ingresar / Iniciar Sesión', 'loginButtonText', 'INGRESAR')}
            {renderInput('Etiqueta categoría: Hombre', 'navHombreText', 'Hombre')}
            {renderInput('Etiqueta categoría: Mujer', 'navMujerText', 'Mujer')}
            {renderInput('Etiqueta categoría: Infantil', 'navInfantilText', 'Infantil')}
            {renderInput('Etiqueta categoría: Venta Corporativa', 'navCorporativaText', 'Venta Corporativa')}
            {renderInput('Etiqueta pestaña Promociones', 'navPromosText', 'Promociones')}
          </div>
        </div>
      )}

      {/* SECTION 2: HERO */}
      {activeSection === 'hero' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FDB813]" />
              Portada Principal (Hero Slider)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título Principal — Línea 1', 'heroTitleLine1', 'INDUMENTARIA QUE')}
            {renderInput('Título Principal — Línea 2', 'heroTitleLine2', 'AGUANTA EL TRABAJO')}
            {renderInput('Subtítulo / Mensaje de Marca (Hero)', 'heroSubtitle', DEFAULT_SITE_TEXTS.heroSubtitle || '', undefined, true, true)}
            {renderInput('Texto del Botón Primario', 'heroPrimaryBtnText', 'VER CATÁLOGO')}
            {renderInput('Texto del Botón Corporativo / Empresas', 'heroCorporateBtnText', 'CUENTA EMPRESA')}
            {renderInput('Texto del Botón WhatsApp Portada', 'heroWhatsAppBtnText', 'CONSULTAR POR WHATSAPP')}
          </div>
        </div>
      )}

      {/* SECTION 3: CATALOG */}
      {activeSection === 'catalog' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#FDB813]" />
              Catálogo General & Tarjetas de Producto
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título General del Catálogo', 'catalogTitle', 'CATÁLOGO OFICIAL')}
            {renderInput('Placeholder de búsqueda en catálogo', 'catalogSearchPlaceholder', 'Buscar por nombre, código PAM, sección o color...')}
            {renderInput('Subtítulo / Bajada del catálogo', 'catalogSubtitle', 'Artículos de máxima resistencia para campo, industria y ciudad.', undefined, false, true)}
            {renderInput('Texto hover en tarjeta de producto', 'viewProductCardText', 'Ver ficha')}
            {renderInput('Botón "Agregar a Mi Pedido"', 'addToQuoteBtnText', 'AGREGAR A MI PEDIDO')}
            {renderInput('Botón "Consultar por WhatsApp"', 'whatsappConsultBtnText', 'CONSULTAR POR WHATSAPP')}
          </div>
        </div>
      )}

      {/* SECTION 4: PRODUCT DETAIL */}
      {activeSection === 'product_detail' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#FDB813]" />
              Ficha de Producto (Vista Detallada & Modal)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Etiqueta selector de talles', 'productDetailSizeLabel', 'Seleccionar Talle:')}
            {renderInput('Etiqueta selector de color', 'productDetailColorLabel', 'Color Seleccionado:')}
            {renderInput('Botón principal Agregar a Mi Pedido', 'productDetailAddBtnText', 'AGREGAR A MI PEDIDO')}
            {renderInput('Botón Consultar por WhatsApp', 'productDetailWhatsappBtnText', 'CONSULTAR POR WHATSAPP')}
            {renderInput('Aviso de garantía / exhibición oficial', 'productDetailGuaranteeText', DEFAULT_SITE_TEXTS.productDetailGuaranteeText || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 5: MI PEDIDO */}
      {activeSection === 'quote' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FDB813]" />
              Ventana Emergente de Mi Pedido & Cotizador
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título de la Ventana Emergente', 'quoteDrawerTitle', 'Mi Pedido')}
            {renderInput('Texto del Botón Enviar WhatsApp', 'quoteDrawerSendBtnText', 'Pasar a WhatsApp')}
            {renderInput('Título cuando el pedido está vacío', 'emptyCartTitle', 'Tu pedido está vacío')}
            {renderInput('Subtítulo cuando el pedido está vacío', 'emptyCartSubtitle', 'Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.')}
            {renderInput('Placeholder de Observaciones adicionales', 'quoteDrawerObservationsPlaceholder', DEFAULT_SITE_TEXTS.quoteDrawerObservationsPlaceholder || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 6: AUTH / LOGIN & REGISTRO */}
      {activeSection === 'auth' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#FDB813]" />
              Pantalla de Login, Registro & Acceso Staff
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Etiqueta superior Login Cliente', 'authLoginTitle', 'ACCESO AL CATÁLOGO')}
            {renderInput('Botón principal Ingresar', 'authLoginBtnText', 'INGRESAR')}
            {renderInput('Bajada descriptiva Login Cliente', 'authLoginSubtitle', DEFAULT_SITE_TEXTS.authLoginSubtitle || '', undefined, true, true)}
            {renderInput('Etiqueta superior Registro', 'authRegisterTitle', 'ACCESO AL CATÁLOGO')}
            {renderInput('Texto enlace Ir a Registro', 'authToRegisterLinkText', 'Regístrate')}
            {renderInput('Bajada descriptiva Registro', 'authRegisterSubtitle', DEFAULT_SITE_TEXTS.authRegisterSubtitle || '', undefined, true, true)}
            {renderInput('Título acceso Colaboradores & Admin', 'authStaffTitle', 'ADMINISTRACIÓN Y COLABORADORES')}
            {renderInput('Texto enlace Acceso Colaboradores/Admin', 'authToStaffLinkText', 'Acceso para Colaboradores/Admin')}
            {renderInput('Bajada acceso Colaboradores & Admin', 'authStaffSubtitle', DEFAULT_SITE_TEXTS.authStaffSubtitle || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 7: HUB INTERNO */}
      {activeSection === 'hub' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FDB813]" />
              Menú Hub de Trabajo (Módulos y Tarjetas)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Etiqueta superior barra Hub', 'hubHeaderTag', 'HUB DE TRABAJO INTERNO')}
            {renderInput('Subtítulo barra Hub', 'hubHeaderSub', 'Pampero Gran Mendoza · Sistema Operativo')}
            {renderInput('Título principal del Hub', 'hubTitle', 'Hub de Trabajo Interno')}
            {renderInput('Botón Salir del Hub', 'hubLogoutBtnText', 'Salir')}
            {renderInput('Etiqueta rol Super Administrador', 'hubRoleAdminText', 'Super Administrador')}
            {renderInput('Etiqueta rol Encargado General', 'hubRoleEmployeeText', 'Encargado General · Todos los Locales')}
            {renderInput('Subtítulo personalizado Hub (opcional)', 'hubSubtitle', 'Dejá vacío para mostrar el saludo dinámico con el nombre del operador.', 'Si se deja vacío muestra el saludo automático con el nombre.', false, true)}

            {renderInput('Tarjeta CRM — Título', 'hubCrmCardText', 'Gestión / CRM')}
            {renderInput('Tarjeta CRM — Botón', 'hubCrmBtnText', 'Ir a Gestión / CRM')}
            {renderInput('Tarjeta CRM — Descripción', 'hubCrmCardDesc', DEFAULT_SITE_TEXTS.hubCrmCardDesc || '', undefined, true, true)}

            {renderInput('Tarjeta RRHH — Título', 'hubRrhhCardText', 'RRHH')}
            {renderInput('Tarjeta RRHH — Botón', 'hubRrhhBtnText', 'Ir a RRHH')}
            {renderInput('Tarjeta RRHH — Descripción', 'hubRrhhCardDesc', DEFAULT_SITE_TEXTS.hubRrhhCardDesc || '', undefined, true, true)}

            {renderInput('Tarjeta Costos — Título', 'hubCostsCardText', 'Costos & Finanzas')}
            {renderInput('Tarjeta Costos — Botón', 'hubCostsBtnText', 'Ir a Costos')}
            {renderInput('Tarjeta Costos — Descripción', 'hubCostsCardDesc', DEFAULT_SITE_TEXTS.hubCostsCardDesc || '', undefined, true, true)}

            {renderInput('Tarjeta Chat Interno — Título', 'hubChatCardText', 'Chat Interno')}
            {renderInput('Tarjeta Chat Interno — Botón', 'hubChatBtnText', 'Abrir Chat')}
            {renderInput('Tarjeta Chat Interno — Descripción', 'hubChatCardDesc', DEFAULT_SITE_TEXTS.hubChatCardDesc || '', undefined, true, true)}

            {renderInput('Tarjeta Panel de Control — Título', 'hubAdminCardText', 'Panel de Control')}
            {renderInput('Tarjeta Panel de Control — Botón', 'hubAdminBtnText', 'Panel de Control')}
            {renderInput('Tarjeta Panel de Control — Descripción', 'hubAdminCardDesc', DEFAULT_SITE_TEXTS.hubAdminCardDesc || '', undefined, true, true)}

            {renderInput('Tarjeta Catálogo Público — Título', 'hubCatalogCardText', 'Catálogo Público')}
            {renderInput('Tarjeta Catálogo Público — Botón', 'hubCatalogBtnText', 'Ver Catálogo')}
            {renderInput('Tarjeta Catálogo Público — Descripción', 'hubCatalogCardDesc', DEFAULT_SITE_TEXTS.hubCatalogCardDesc || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 8: GESTIÓN / CRM */}
      {activeSection === 'crm' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Kanban className="w-4 h-4 text-[#FDB813]" />
              Módulo Gestión Pampero (CRM, Pestañas, Sub-vistas y Tableros)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título de cabecera CRM', 'crmTitle', 'Gestión Pampero')}
            {renderInput('Subtítulo cabecera CRM', 'crmSubtitle', 'Pampero Gran Mendoza')}
            {renderInput('Texto botón volver al Hub', 'crmBackBtnText', 'Volver al Hub')}
            {renderInput('Texto botón Nuevo Pedido', 'crmNewOrderBtnText', 'Nuevo Pedido')}
            {renderInput('Pestaña 1 (Visitas)', 'crmTabVisitsText', '1. Visitas Comerciales')}
            {renderInput('Pestaña 2 (Tablero Empresas)', 'crmTabBoardText', '2. Seguimiento Empresas')}
            {renderInput('Pestaña 3 (Tareas)', 'crmTabTasksText', '3. Tareas')}
            {renderInput('Pestaña 4 (Calendario)', 'crmTabCalendarText', '4. Calendario')}
            {renderInput('Pestaña Pedidos Proveedor', 'crmTabSuppliersText', 'Pedidos Proveedor')}
            {renderInput('Pestaña Control de Costos', 'crmTabCostsText', 'Control de Costos')}
            {renderInput('Etiqueta columna Cotización', 'crmColCotizacionText', 'Cotización Recibida')}
            {renderInput('Etiqueta columna Producción', 'crmColProduccionText', 'En Producción')}
            {renderInput('Etiqueta columna Listo', 'crmColListoText', 'Listo para Retiro')}
            {renderInput('Botón Notificaciones CRM', 'crmNotifBtnText', 'Notificaciones')}
            {renderInput('Título modal Notificaciones', 'crmNotifTitle', 'Centro de Alertas & Notificaciones')}
            {renderInput('Botón Faltantes', 'crmShortagesBtnText', 'Faltantes')}
            {renderInput('Título modal Faltantes', 'crmShortagesTitle', 'Faltantes & Pedido a Proveedor')}
            {renderInput('Botón Observaciones', 'crmObservationsBtnText', 'Observaciones')}
            {renderInput('Visitas — Título', 'crmVisitsTitle', 'Visitas Comerciales')}
            {renderInput('Visitas — Botón nueva visita', 'crmNewVisitBtnText', 'Registrar Visita')}
            {renderInput('Visitas — Subtítulo', 'crmVisitsSubtitle', DEFAULT_SITE_TEXTS.crmVisitsSubtitle || '', undefined, true, true)}
            {renderInput('Tareas — Título', 'crmTasksTitle', 'Tablero de Tareas Operativas')}
            {renderInput('Tareas — Botón nueva tarea', 'crmNewTaskBtnText', 'Nueva Tarea')}
            {renderInput('Tareas — Subtítulo', 'crmTasksSubtitle', DEFAULT_SITE_TEXTS.crmTasksSubtitle || '', undefined, true, true)}
            {renderInput('Calendario — Título', 'crmCalendarTitle', 'Calendario Comercial & Vencimientos')}
            {renderInput('Calendario — Botón nuevo evento', 'crmNewEventBtnText', 'Nuevo Evento / Recordatorio')}
            {renderInput('Calendario — Subtítulo', 'crmCalendarSubtitle', DEFAULT_SITE_TEXTS.crmCalendarSubtitle || '', undefined, true, true)}
            {renderInput('Proveedores — Título', 'crmSuppliersTitle', 'Pedidos a Proveedores & Stock')}
            {renderInput('Proveedores — Subtítulo', 'crmSuppliersSubtitle', DEFAULT_SITE_TEXTS.crmSuppliersSubtitle || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 9: SERVICIOS CORPORATIVOS */}
      {activeSection === 'corporate' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#FDB813]" />
              Servicios Corporativos (Curva de Talles & Armador de Uniformes)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título Portal de Curva de Talles', 'sizingPortalTitle', 'Portal de Curva de Talles Corporativos')}
            {renderInput('Botón cotización B2B', 'corporateQuoteBtnText', 'SOLICITAR COTIZACIÓN DE DOTACIÓN')}
            {renderInput('Subtítulo Portal de Talles', 'sizingPortalSubtitle', DEFAULT_SITE_TEXTS.sizingPortalSubtitle || '', undefined, true, true)}
            {renderInput('Título Armador de Uniformes', 'uniformSimulatorTitle', 'Armador de Uniformes Virtual · Pampero Mendoza')}
            {renderInput('Subtítulo Armador de Uniformes', 'uniformSimulatorSubtitle', DEFAULT_SITE_TEXTS.uniformSimulatorSubtitle || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 10: FOOTER & CONTACT */}
      {activeSection === 'footer' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FDB813]" />
              Pie de Página & Información de Contacto
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título Columna Contacto', 'footerContactTitle', 'CONTACTO')}
            {renderInput('Título Columna Locales', 'footerBranchesTitle', 'LOCALES')}
            {renderInput('Teléfono o WhatsApp visible', 'footerPhone', '261 527-6713')}
            {renderInput('Correo Electrónico de Contacto', 'footerEmail', 'pamperogranmendoza@gmail.com')}
            {renderInput('Texto botón WhatsApp Footer (opcional)', 'footerWhatsappBtnText', 'Dejar vacío para usar WhatsApp + teléfono')}
            {renderInput('Enlace Acceso Panel en Footer', 'footerAdminLinkText', 'Acceso Administrador (Panel de Control)')}
            {renderInput('Lema o Frase Institucional (Tagline)', 'footerTagline', DEFAULT_SITE_TEXTS.footerTagline || '', undefined, false, true)}
            {renderInput('Dirección / Sucursales resumen', 'footerAddress', DEFAULT_SITE_TEXTS.footerAddress || '', undefined, false, true)}
            {renderInput('Párrafo institucional sobre la marca', 'footerAbout', DEFAULT_SITE_TEXTS.footerAbout || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 11: RRHH */}
      {activeSection === 'rrhh' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              Módulo Recursos Humanos (Fichaje GPS, Legajo y Cronograma)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título cabecera RRHH', 'rrhhTitle', 'Recursos Humanos')}
            {renderInput('Botón Volver al Hub', 'rrhhBackBtnText', 'Volver al Hub')}
            {renderInput('Subtítulo cabecera RRHH', 'rrhhSubtitle', DEFAULT_SITE_TEXTS.rrhhSubtitle || '', undefined, true, true)}
            {renderInput('Pestaña 1 (Fichaje GPS)', 'rrhhFichajeTabText', '1. Fichaje GPS')}
            {renderInput('Pestaña 2 (Mi Legajo)', 'rrhhLegajoTabText', '2. Mi Legajo & Horarios')}
            {renderInput('Título tarjeta de fichaje', 'rrhhFichajeCardTitle', 'Fichaje de Llegada al Local')}
            {renderInput('Botón principal de fichaje', 'rrhhFichajeBtnText', 'Registrar Llegada Ahora')}
            {renderInput('Subtítulo tarjeta de fichaje', 'rrhhFichajeCardSubtitle', DEFAULT_SITE_TEXTS.rrhhFichajeCardSubtitle || '', undefined, true, true)}
            {renderInput('Botón Configurar en Panel', 'rrhhAdminBtnText', 'Configurar en Panel')}
          </div>
        </div>
      )}

      {/* SECTION 12: COSTOS & FINANZAS */}
      {activeSection === 'costs' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#FDB813]" />
              Módulo Costos & Finanzas (Dashboard, Facturas, Cheques, Caja Chica)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título cabecera Costos', 'costsTitle', 'Costos & Finanzas')}
            {renderInput('Botón Volver al Hub', 'costsBackBtnText', 'Volver al Hub')}
            {renderInput('Subtítulo cabecera Costos', 'costsSubtitle', DEFAULT_SITE_TEXTS.costsSubtitle || '', undefined, false, true)}
            {renderInput('Pestaña 1 (Dashboard)', 'costsTabDashboardText', '1. Dashboard & Liquidez')}
            {renderInput('Pestaña 2 (Costos y Ventas)', 'costsTabCostsText', '2. Costos y Ventas')}
            {renderInput('Pestaña 3 (Facturas & Gastos)', 'costsTabInvoicesText', '3. Facturas & Gastos')}
            {renderInput('Pestaña 4 (Cheques)', 'costsTabChecksText', '4. Cheques Emitidos y Recibidos')}
            {renderInput('Pestaña 5 (Caja Chica)', 'costsTabPettyCashText', '5. Caja Chica por Local')}
            {renderInput('Título Dashboard Liquidez', 'costsDashTitle', 'Tablero Financiero & Liquidez Global')}
            {renderInput('Subtítulo Dashboard Liquidez', 'costsDashSubtitle', DEFAULT_SITE_TEXTS.costsDashSubtitle || '', undefined, true, true)}
          </div>
        </div>
      )}

      {/* SECTION 13: CHAT INTERNO */}
      {activeSection === 'chat' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#FDB813]" />
              Chat Interno & Mensajería en Tiempo Real
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderInput('Título ventana de Chat', 'chatTitle', 'Chat Interno Pampero')}
            {renderInput('Botón de menú / acceso rápido', 'chatNavBtnText', 'Chat / Mensajes')}
            {renderInput('Subtítulo ventana de Chat', 'chatSubtitle', DEFAULT_SITE_TEXTS.chatSubtitle || '', undefined, true, true)}
            {renderInput('Placeholder cuadro de mensaje', 'chatInputPlaceholder', 'Escribí un mensaje directo...')}
            {renderInput('Botón Enviar mensaje', 'chatSendBtnText', 'Enviar')}
          </div>
        </div>
      )}
    </div>
  );
};
