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
  MessageCircle, 
  Info,
  Layers,
  MapPin
} from 'lucide-react';
import { saveFirestoreStoreConfig, recordAuditLog } from '../../services/firebase';

interface AdminSiteTextsTabProps {
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  triggerSaveNotice: () => void;
}

export const AdminSiteTextsTab: React.FC<AdminSiteTextsTabProps> = ({
  theme,
  onUpdateTheme,
  triggerSaveNotice,
}) => {
  const [activeSection, setActiveSection] = useState<
    'header' | 'hero' | 'catalog' | 'quote' | 'footer'
  >('header');

  const [siteTexts, setSiteTexts] = useState<SiteTextsConfig>(() => ({
    announcementBarText: 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO',
    searchPlaceholder: 'Buscar en el catálogo...',
    quoteButtonText: 'Mi Pedido',
    loginButtonText: 'Iniciar Sesión / Crear Cuenta',
    heroTitleLine1: 'INDUMENTARIA QUE',
    heroTitleLine2: 'AGUANTA EL TRABAJO',
    heroSubtitle: 'Confeccionada bajo estrictas normas de resistencia. Ropa de trabajo, campo y aventura con garantía de nobleza.',
    heroPrimaryBtnText: 'VER CATÁLOGO',
    heroCorporateBtnText: 'VENTA CORPORATIVA',
    heroWhatsAppBtnText: 'CONSULTAR POR WHATSAPP',
    catalogTitle: 'CATÁLOGO OFICIAL',
    catalogSubtitle: 'Artículos de máxima resistencia para campo, industria y ciudad.',
    catalogSearchPlaceholder: 'Buscar por nombre, código PAM, sección o color...',
    viewProductCardText: 'Ver ficha',
    addToQuoteBtnText: 'AGREGAR A MI PEDIDO',
    whatsappConsultBtnText: 'CONSULTAR POR WHATSAPP',
    quoteDrawerTitle: 'Mi Pedido',
    quoteDrawerSendBtnText: 'Enviar Pedido por WhatsApp',
    quoteDrawerObservationsPlaceholder: 'Observaciones para el asesor: talles específicos, colores alternativos o sucursal de retiro preferida...',
    emptyCartTitle: 'Tu pedido está vacío',
    emptyCartSubtitle: 'Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.',
    footerTagline: 'Catálogo digital de exhibición oficial · Gran Mendoza',
    footerAbout: 'Indumentaria y calzado oficial Pampero para trabajo, campo y tiempo libre en la provincia de Mendoza.',
    footerPhone: '261 527-6713',
    footerEmail: 'pamperogranmendoza@gmail.com',
    footerAddress: 'Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)',
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
    if (!confirm('¿Deseás restaurar todos los textos predeterminados originales de la tienda?')) return;
    const defaults: SiteTextsConfig = {
      announcementBarText: 'CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO',
      searchPlaceholder: 'Buscar en el catálogo...',
      quoteButtonText: 'Mi Pedido',
      loginButtonText: 'Iniciar Sesión / Crear Cuenta',
      heroTitleLine1: 'INDUMENTARIA QUE',
      heroTitleLine2: 'AGUANTA EL TRABAJO',
      heroSubtitle: 'Confeccionada bajo estrictas normas de resistencia. Ropa de trabajo, campo y aventura con garantía de nobleza.',
      heroPrimaryBtnText: 'VER CATÁLOGO',
      heroCorporateBtnText: 'VENTA CORPORATIVA',
      heroWhatsAppBtnText: 'CONSULTAR POR WHATSAPP',
      catalogTitle: 'CATÁLOGO OFICIAL',
      catalogSubtitle: 'Artículos de máxima resistencia para campo, industria y ciudad.',
      catalogSearchPlaceholder: 'Buscar por nombre, código PAM, sección o color...',
      viewProductCardText: 'Ver ficha',
      addToQuoteBtnText: 'AGREGAR A MI PEDIDO',
      whatsappConsultBtnText: 'CONSULTAR POR WHATSAPP',
      quoteDrawerTitle: 'Mi Pedido',
      quoteDrawerSendBtnText: 'Enviar Pedido por WhatsApp',
      quoteDrawerObservationsPlaceholder: 'Observaciones para el asesor: talles específicos, colores alternativos o sucursal de retiro preferida...',
      emptyCartTitle: 'Tu pedido está vacío',
      emptyCartSubtitle: 'Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.',
      footerTagline: 'Catálogo digital de exhibición oficial · Gran Mendoza',
      footerAbout: 'Indumentaria y calzado oficial Pampero para trabajo, campo y tiempo libre en la provincia de Mendoza.',
      footerPhone: '261 527-6713',
      footerEmail: 'pamperogranmendoza@gmail.com',
      footerAddress: 'Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)',
    };
    setSiteTexts(defaults);
    const updatedTheme: ThemeConfig = {
      ...theme,
      siteTexts: defaults,
      screenTexts: defaults,
    };
    onUpdateTheme(updatedTheme);
    saveFirestoreStoreConfig({ theme: updatedTheme, siteTexts: defaults });
    triggerSaveNotice();
  };

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
                Textos de la Interfaz & Mensajes
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Personalizá todos los títulos, placeholders de búsqueda, llamados a la acción (CTA) y mensajes del sistema sin editar código.
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
          {[
            { id: 'header', label: '1. Barra Superior & Navbar', icon: Layout },
            { id: 'hero', label: '2. Portada & Hero Principal', icon: Sparkles },
            { id: 'catalog', label: '3. Catálogo & Fichas', icon: Search },
            { id: 'quote', label: '4. Mi Pedido & Cotizador', icon: ShoppingBag },
            { id: 'footer', label: '5. Pie de Página & Contacto', icon: MapPin },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id as any)}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 cursor-pointer transition-all ${
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
              Encabezado, Anuncios y Barra Superior
            </h4>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Configurá los textos que aparecen en la barra superior y en el menú de navegación principal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Micro-anuncio superior (Cintillo informativo)
              </label>
              <input
                type="text"
                value={siteTexts.announcementBarText || ''}
                onChange={(e) => handleChange('announcementBarText', e.target.value)}
                placeholder="CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
              <span className="text-[10px] text-[#6F6860]">Aparece en la franja superior oscura sobre el Navbar.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Placeholder del buscador rápido en Navbar
              </label>
              <input
                type="text"
                value={siteTexts.searchPlaceholder || ''}
                onChange={(e) => handleChange('searchPlaceholder', e.target.value)}
                placeholder="Buscar en el catálogo..."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
              <span className="text-[10px] text-[#6F6860]">Texto tenue que guía al usuario en la barra de búsqueda de la cabecera.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto del botón de Carrito / Cotización
              </label>
              <input
                type="text"
                value={siteTexts.quoteButtonText || ''}
                onChange={(e) => handleChange('quoteButtonText', e.target.value)}
                placeholder="Mi Pedido"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
              <span className="text-[10px] text-[#6F6860]">Etiqueta del botón flotante y menú de acceso al carrito.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto de Iniciar Sesión / Registrarse
              </label>
              <input
                type="text"
                value={siteTexts.loginButtonText || ''}
                onChange={(e) => handleChange('loginButtonText', e.target.value)}
                placeholder="Iniciar Sesión / Crear Cuenta"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
              <span className="text-[10px] text-[#6F6860]">Botón mostrado para usuarios visitantes antes de identificarse.</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: HERO & PORTADA */}
      {activeSection === 'hero' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FDB813]" />
              Portada Principal (Hero Slider)
            </h4>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Personalizá el mensaje central que ven los clientes al ingresar por primera vez a la tienda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Título Principal — Línea 1
              </label>
              <input
                type="text"
                value={siteTexts.heroTitleLine1 || ''}
                onChange={(e) => handleChange('heroTitleLine1', e.target.value)}
                placeholder="INDUMENTARIA QUE"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Título Principal — Línea 2
              </label>
              <input
                type="text"
                value={siteTexts.heroTitleLine2 || ''}
                onChange={(e) => handleChange('heroTitleLine2', e.target.value)}
                placeholder="AGUANTA EL TRABAJO"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Subtítulo / Mensaje de Marca (Hero)
              </label>
              <textarea
                rows={2}
                value={siteTexts.heroSubtitle || ''}
                onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                placeholder="Confeccionada bajo estrictas normas de resistencia. Ropa de trabajo, campo y aventura con garantía de nobleza."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto del Botón Primario
              </label>
              <input
                type="text"
                value={siteTexts.heroPrimaryBtnText || ''}
                onChange={(e) => handleChange('heroPrimaryBtnText', e.target.value)}
                placeholder="VER CATÁLOGO"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto del Botón Corporativo / Empresas
              </label>
              <input
                type="text"
                value={siteTexts.heroCorporateBtnText || ''}
                onChange={(e) => handleChange('heroCorporateBtnText', e.target.value)}
                placeholder="VENTA CORPORATIVA"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: CATALOG & PRODUCT CARDS */}
      {activeSection === 'catalog' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#FDB813]" />
              Catálogo General & Tarjetas de Producto
            </h4>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Modificá las etiquetas del buscador avanzado, tarjetas de producto y botones de detalle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Título General del Catálogo
              </label>
              <input
                type="text"
                value={siteTexts.catalogTitle || ''}
                onChange={(e) => handleChange('catalogTitle', e.target.value)}
                placeholder="CATÁLOGO OFICIAL"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Placeholder de búsqueda en el catálogo
              </label>
              <input
                type="text"
                value={siteTexts.catalogSearchPlaceholder || ''}
                onChange={(e) => handleChange('catalogSearchPlaceholder', e.target.value)}
                placeholder="Buscar por nombre, código PAM, sección o color..."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Subtítulo / Bajada del catálogo
              </label>
              <input
                type="text"
                value={siteTexts.catalogSubtitle || ''}
                onChange={(e) => handleChange('catalogSubtitle', e.target.value)}
                placeholder="Artículos de máxima resistencia para campo, industria y ciudad."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto de hover en tarjeta de producto
              </label>
              <input
                type="text"
                value={siteTexts.viewProductCardText || ''}
                onChange={(e) => handleChange('viewProductCardText', e.target.value)}
                placeholder="Ver ficha"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
              <span className="text-[10px] text-[#6F6860]">Aparece en la cortinilla inferior al posar el mouse sobre un artículo.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Botón "Agregar a Mi Pedido" (Ficha Detallada)
              </label>
              <input
                type="text"
                value={siteTexts.addToQuoteBtnText || ''}
                onChange={(e) => handleChange('addToQuoteBtnText', e.target.value)}
                placeholder="AGREGAR A MI PEDIDO"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Botón "Consultar por WhatsApp" (Ficha Detallada)
              </label>
              <input
                type="text"
                value={siteTexts.whatsappConsultBtnText || ''}
                onChange={(e) => handleChange('whatsappConsultBtnText', e.target.value)}
                placeholder="CONSULTAR POR WHATSAPP"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: MI PEDIDO & COTIZADOR */}
      {activeSection === 'quote' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FDB813]" />
              Ventana Emergente de Mi Pedido & Cotizador
            </h4>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Personalizá los mensajes de confirmación, observaciones y estados de la orden.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Título de la Ventana Emergente
              </label>
              <input
                type="text"
                value={siteTexts.quoteDrawerTitle || ''}
                onChange={(e) => handleChange('quoteDrawerTitle', e.target.value)}
                placeholder="Mi Pedido"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Texto del Botón Enviar WhatsApp
              </label>
              <input
                type="text"
                value={siteTexts.quoteDrawerSendBtnText || ''}
                onChange={(e) => handleChange('quoteDrawerSendBtnText', e.target.value)}
                placeholder="Enviar Pedido por WhatsApp"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Título cuando el pedido está vacío
              </label>
              <input
                type="text"
                value={siteTexts.emptyCartTitle || ''}
                onChange={(e) => handleChange('emptyCartTitle', e.target.value)}
                placeholder="Tu pedido está vacío"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Subtítulo explicativo cuando el pedido está vacío
              </label>
              <input
                type="text"
                value={siteTexts.emptyCartSubtitle || ''}
                onChange={(e) => handleChange('emptyCartSubtitle', e.target.value)}
                placeholder="Explorá el catálogo Pampero y agregá los artículos que necesites cotizar."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Placeholder de Observaciones adicionales
              </label>
              <textarea
                rows={2}
                value={siteTexts.quoteDrawerObservationsPlaceholder || ''}
                onChange={(e) => handleChange('quoteDrawerObservationsPlaceholder', e.target.value)}
                placeholder="Observaciones para el asesor: talles específicos, colores alternativos o sucursal de retiro preferida..."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: FOOTER & CONTACT */}
      {activeSection === 'footer' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-5 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FDB813]" />
              Pie de Página & Información de Contacto
            </h4>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Configurá los textos institucionales, sucursales y datos de contacto en el pie de página.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Lema o Frase Institucional (Tagline)
              </label>
              <input
                type="text"
                value={siteTexts.footerTagline || ''}
                onChange={(e) => handleChange('footerTagline', e.target.value)}
                placeholder="Catálogo digital de exhibición oficial · Gran Mendoza"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Teléfono o WhatsApp visible
              </label>
              <input
                type="text"
                value={siteTexts.footerPhone || ''}
                onChange={(e) => handleChange('footerPhone', e.target.value)}
                placeholder="261 527-6713"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Correo Electrónico de Contacto
              </label>
              <input
                type="text"
                value={siteTexts.footerEmail || ''}
                onChange={(e) => handleChange('footerEmail', e.target.value)}
                placeholder="pamperogranmendoza@gmail.com"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Dirección / Sucursales
              </label>
              <input
                type="text"
                value={siteTexts.footerAddress || ''}
                onChange={(e) => handleChange('footerAddress', e.target.value)}
                placeholder="Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                Párrafo institucional sobre la marca
              </label>
              <textarea
                rows={2}
                value={siteTexts.footerAbout || ''}
                onChange={(e) => handleChange('footerAbout', e.target.value)}
                placeholder="Indumentaria y calzado oficial Pampero para trabajo, campo y tiempo libre en la provincia de Mendoza."
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
