import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ThemeConfig, SiteTextsConfig, Product } from '../../types';
import { INITIAL_PRODUCTS } from '../../data/initialData';
import { PamperoLogo } from '../PamperoLogo';
import { isColorDark } from '../../context/ThemeContext';
import { saveFirestoreStoreConfig, recordAuditLog } from '../../services/firebase';
import { 
  Layout, 
  Palette, 
  Type, 
  Sliders, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Save, 
  RotateCcw, 
  Eye, 
  Check, 
  Search, 
  ShoppingBag, 
  MessageCircle, 
  X, 
  ChevronRight, 
  Sparkles, 
  Tag,
  Maximize2,
  MousePointer,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Shirt,
  Layers,
  Compass,
  Briefcase,
  SlidersHorizontal,
  Package,
  Kanban,
  FileText,
  User,
  Building2,
  Image as ImageIcon
} from 'lucide-react';

interface AdminVisualCatalogEditorProps {
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  triggerSaveNotice: () => void;
}

export type VisualSectionKey = 
  | 'navbar'
  | 'announcement'
  | 'hero'
  | 'category_nav'
  | 'catalog_cards'
  | 'product_detail'
  | 'quote_drawer'
  | 'corporate_services'
  | 'uniform_simulator'
  | 'sizing_portal'
  | 'lookbook'
  | 'order_tracking'
  | 'auth_modal'
  | 'hub_admin'
  | 'crm_board'
  | 'crm_card'
  | 'footer'
  | 'global_buttons';

export type CanvasViewMode = 
  | 'catalog'
  | 'product_detail'
  | 'quote'
  | 'login'
  | 'lookbook'
  | 'simulator'
  | 'hub'
  | 'crm';

interface ColorPickerRowProps {
  label: string;
  sublabel?: string;
  value?: string;
  defaultValue: string;
  onChange: (color: string) => void;
}

const ColorPickerRow: React.FC<ColorPickerRowProps> = ({
  label,
  sublabel,
  value,
  defaultValue,
  onChange,
}) => {
  const activeColor = value || defaultValue;
  const popularSwatches = [
    '#18231C', '#FDB813', '#F5F2EC', '#FFFFFF', '#000000', 
    '#DCD4C9', '#B9522F', '#0F1E36', '#28331E', '#E85D04', 
    '#10B981', '#3B82F6', '#EF4444'
  ];

  return (
    <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block">
            {label}
          </span>
          {sublabel && (
            <span className="text-[10px] text-[#6F6860] block">{sublabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={activeColor.startsWith('#') ? activeColor : defaultValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded-xs cursor-pointer border border-[#DCD4C9] p-0.5 bg-white"
            title="Seleccionar color con la paleta"
          />
          <input
            type="text"
            value={activeColor}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 px-1.5 py-1 text-center font-mono text-[11px] font-bold uppercase bg-white border border-[#DCD4C9] rounded-xs text-[#18231C]"
            placeholder="#18231C"
          />
        </div>
      </div>

      {/* Muestras rápidas */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[9px] uppercase font-bold text-[#6F6860] mr-1">Rápidos:</span>
        {popularSwatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`w-5 h-5 rounded-xs border transition-transform hover:scale-110 cursor-pointer ${
              activeColor.toLowerCase() === hex.toLowerCase()
                ? 'ring-2 ring-[#B9522F] scale-110 shadow-xs'
                : 'border-neutral-300'
            }`}
            style={{ backgroundColor: hex }}
            title={hex}
          />
        ))}
      </div>
    </div>
  );
};

export const AdminVisualCatalogEditor: React.FC<AdminVisualCatalogEditorProps> = ({
  theme,
  onUpdateTheme,
  triggerSaveNotice,
}) => {
  const [localTheme, setLocalTheme] = useState<ThemeConfig>(theme);
  const [activeSection, setActiveSection] = useState<VisualSectionKey>('navbar');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [canvasView, setCanvasView] = useState<CanvasViewMode>('catalog');
  const [isInspectorActive, setIsInspectorActive] = useState(true);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const updateField = (field: keyof ThemeConfig, val: any) => {
    setLocalTheme((prev) => {
      const updated = { ...prev, [field]: val };
      if (field === 'customLogoUrl') {
        updated.logoUrl = val;
        try { localStorage.setItem('pampero_custom_logo', val); } catch {}
      }
      if (field === 'logoHeight') {
        try { localStorage.setItem('pampero_logo_height', val.toString()); } catch {}
      }
      onUpdateTheme(updated);
      try {
        localStorage.setItem('pampero_catalog_theme', JSON.stringify(updated));
        localStorage.setItem('pampero_theme_config', JSON.stringify(updated));
      } catch {}

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveFirestoreStoreConfig({ theme: updated }).catch(() => {});
      }, 500);

      return updated;
    });
  };

  const updateSiteText = (textField: keyof SiteTextsConfig, textVal: string) => {
    setLocalTheme((prev) => {
      const currentTexts = prev.siteTexts || prev.screenTexts || {};
      const updatedTexts: SiteTextsConfig = {
        ...currentTexts,
        [textField]: textVal,
      };
      const updated: ThemeConfig = {
        ...prev,
        siteTexts: updatedTexts,
        screenTexts: updatedTexts,
      };
      onUpdateTheme(updated);
      try {
        localStorage.setItem('pampero_catalog_theme', JSON.stringify(updated));
        localStorage.setItem('pampero_theme_config', JSON.stringify(updated));
        localStorage.setItem('pampero_site_texts', JSON.stringify(updatedTexts));
      } catch {}

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveFirestoreStoreConfig({ theme: updated }).catch(() => {});
      }, 500);

      return updated;
    });
  };

  const handleManualSave = async () => {
    try {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(localTheme));
      localStorage.setItem('pampero_theme_config', JSON.stringify(localTheme));
      if (localTheme.siteTexts) {
        localStorage.setItem('pampero_site_texts', JSON.stringify(localTheme.siteTexts));
      }
    } catch {}
    onUpdateTheme(localTheme);
    await saveFirestoreStoreConfig({ theme: localTheme }).catch(() => {});
    recordAuditLog({
      module: 'Diseño & Tema',
      action: 'Guardar Tema Visual',
      details: `Cambios visuales guardados desde el Estudio Visual en Vivo (Sección: ${activeSection})`,
    });
    setIsSavedNotice(true);
    triggerSaveNotice();
    setTimeout(() => setIsSavedNotice(false), 4000);
  };

  const previewProducts = useMemo(() => {
    return INITIAL_PRODUCTS.slice(0, 4);
  }, []);

  const selectedSampleProduct = previewProducts[0];

  const resolvedTexts: SiteTextsConfig = localTheme.siteTexts || localTheme.screenTexts || {
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
    addToQuoteBtnText: 'AGREGAR A MI PEDIDO',
    quoteDrawerTitle: 'Mi Pedido',
    quoteDrawerSendBtnText: 'Enviar Pedido por WhatsApp',
    footerTagline: 'Catálogo digital de exhibición oficial · Gran Mendoza',
    footerAbout: 'Indumentaria y calzado oficial Pampero para trabajo, campo y tiempo libre en la provincia de Mendoza.',
    footerPhone: '261 527-6713',
    footerEmail: 'pamperGranMendoza@gmail.com',
    footerAddress: 'Pescara 250 (Maipú) · San Martín 477 (Ciudad) · Patricios 384 (Luján)',
  };

  const canvasContainerWidth = 
    deviceView === 'mobile' ? 'max-w-[400px]' : (deviceView === 'tablet' ? 'max-w-[768px]' : 'w-full');

  const ALL_SECTIONS: Array<{ key: VisualSectionKey; label: string; icon: any; targetView: CanvasViewMode }> = [
    { key: 'navbar', label: '1. Navbar Principal & Logo', icon: Layout, targetView: 'catalog' },
    { key: 'announcement', label: '2. Micro-Anuncios & WhatsApp', icon: MessageCircle, targetView: 'catalog' },
    { key: 'hero', label: '3. Portada / Landing Hero', icon: Sparkles, targetView: 'catalog' },
    { key: 'category_nav', label: '4. Menú de Categorías & Filtros', icon: Layers, targetView: 'catalog' },
    { key: 'catalog_cards', label: '5. Tarjetas de Producto (Cards)', icon: Tag, targetView: 'catalog' },
    { key: 'product_detail', label: '6. Ficha Detalle / Modal', icon: Eye, targetView: 'product_detail' },
    { key: 'quote_drawer', label: '7. Ventana Mi Pedido', icon: ShoppingBag, targetView: 'quote' },
    { key: 'corporate_services', label: '8. Servicios Corporativos', icon: Building2, targetView: 'catalog' },
    { key: 'uniform_simulator', label: '9. Armador de Uniformes', icon: Shirt, targetView: 'simulator' },
    { key: 'sizing_portal', label: '10. Curva de Talles', icon: SlidersHorizontal, targetView: 'simulator' },
    { key: 'lookbook', label: '11. Lookbook Campaña', icon: ImageIcon, targetView: 'lookbook' },
    { key: 'order_tracking', label: '12. Estado de Pedido', icon: Package, targetView: 'quote' },
    { key: 'auth_modal', label: '13. Modal Login / Acceso', icon: Lock, targetView: 'login' },
    { key: 'hub_admin', label: '14. Hub Empleados / Admin', icon: Compass, targetView: 'hub' },
    { key: 'crm_board', label: '15. Tablero & Cabecera CRM', icon: Kanban, targetView: 'crm' },
    { key: 'crm_card', label: '16. Ficha de Pedido en CRM', icon: FileText, targetView: 'crm' },
    { key: 'footer', label: '17. Pie de Página (Footer)', icon: MapPin, targetView: 'catalog' },
    { key: 'global_buttons', label: '18. Botones & Tipografía Global', icon: Palette, targetView: 'catalog' },
  ];

  return (
    <div className="bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs shadow-sm overflow-hidden flex flex-col">
      {/* 1. BARRA SUPERIOR DE HERRAMIENTAS DEL ESTUDIO */}
      <div className="bg-[#18231C] text-[#F5F2EC] p-3 px-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#28331E]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[#B9522F] text-white rounded-xs">
            <Layout className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-white">
                Estudio Visual en Vivo del Catálogo
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-xs">
                18 Secciones Reales
              </span>
            </div>
            <p className="text-[10px] text-[#DCD4C9]/80 hidden sm:block">
              Navegá entre las 18 secciones reales del sistema o hacé clic sobre cualquier elemento del lienzo para editarlo en directo.
            </p>
          </div>
        </div>

        {/* Controles de Vista & Guardado */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Pantalla */}
          <div className="bg-[#28331E] p-1 rounded-xs flex items-center gap-1 border border-[#3A492E]">
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={`p-1.5 rounded-xs text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                deviceView === 'desktop' ? 'bg-[#18231C] text-white shadow-2xs font-bold' : 'text-[#DCD4C9] hover:text-white'
              }`}
              title="Vista de Escritorio"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden md:inline">PC</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('tablet')}
              className={`p-1.5 rounded-xs text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                deviceView === 'tablet' ? 'bg-[#18231C] text-white shadow-2xs font-bold' : 'text-[#DCD4C9] hover:text-white'
              }`}
              title="Vista de Tablet"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden md:inline">Tablet</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={`p-1.5 rounded-xs text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                deviceView === 'mobile' ? 'bg-[#18231C] text-white shadow-2xs font-bold' : 'text-[#DCD4C9] hover:text-white'
              }`}
              title="Vista Móvil"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden md:inline">Móvil</span>
            </button>
          </div>

          {/* Toggle Inspector Interactivo */}
          <button
            type="button"
            onClick={() => setIsInspectorActive(!isInspectorActive)}
            className={`px-2.5 py-1.5 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border cursor-pointer transition-colors ${
              isInspectorActive 
                ? 'bg-[#B9522F] text-white border-[#B9522F]' 
                : 'bg-[#28331E] text-[#DCD4C9] border-[#3A492E] hover:text-white'
            }`}
            title="Hacer clic en el catálogo para seleccionar sección"
          >
            <MousePointer className="w-3 h-3" />
            <span>{isInspectorActive ? 'Clic para Editar: ON' : 'Clic para Editar: OFF'}</span>
          </button>

          {/* Botón Guardar Cambios */}
          <button
            type="button"
            onClick={handleManualSave}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>Guardar en Vivo</span>
          </button>
        </div>
      </div>

      {/* Banner de Confirmación */}
      {isSavedNotice && (
        <div className="bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>¡Diseño guardado y sincronizado con éxito para todos los usuarios!</span>
        </div>
      )}

      {/* 2. PESTAÑAS DE SECCIONES (18 SECCIONES COMPLETAS Y REALES) */}
      <div className="bg-white border-b border-[#DCD4C9] px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#6F6860] shrink-0 mr-1">
          Secciones:
        </span>
        {ALL_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => {
                setActiveSection(sec.key);
                setCanvasView(sec.targetView);
              }}
              className={`px-3 py-1.5 rounded-xs text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#18231C] text-[#F5F2EC] shadow-2xs ring-1 ring-[#18231C]'
                  : 'bg-[#FAF8F5] text-[#4A453F] hover:bg-[#ECE5DC] border border-[#DCD4C9]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FDB813]' : 'text-[#B9522F]'}`} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. SPLIT STUDIO: PANEL DE CONTROLES (IZQUIERDA) + LIENZO INTERACTIVO (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[700px]">
        {/* PANEL LATERAL DE EDICIÓN QUIRÚRGICA */}
        <div className="lg:col-span-4 bg-white border-r border-[#DCD4C9] p-4 space-y-5 overflow-y-auto max-h-[820px]">
          {/* Header de la sección activa */}
          <div className="border-b border-[#DCD4C9] pb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#B9522F] block">
                Editor Específico
              </span>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                {ALL_SECTIONS.find((s) => s.key === activeSection)?.label}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[10px] font-mono text-[#6F6860]">
              ID: {activeSection}
            </span>
          </div>

          {/* CONTROLES SEGÚN SECCIÓN SELECCIONADA */}
          
          {/* ===================== 1. NAVBAR ===================== */}
          {activeSection === 'navbar' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Fondo del Navbar"
                sublabel="Fondo de la barra principal"
                value={localTheme.headerBgColor}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('headerBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Textos y Menús"
                sublabel="Hombre, Mujer, Infantil, Venta Corporativa"
                value={localTheme.headerTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('headerTextColor', c)}
              />
              <ColorPickerRow
                label="Color de Acento / Enlace Activo"
                sublabel="Línea indicadora y resaltados"
                value={localTheme.headerAccentColor}
                defaultValue={localTheme.accentColor || '#FDB813'}
                onChange={(c) => updateField('headerAccentColor', c)}
              />
              <ColorPickerRow
                label="Borde Inferior del Navbar"
                sublabel="Línea sutil que separa del catálogo"
                value={localTheme.headerBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('headerBorderColor', c)}
              />

              {/* Slider de Altura de Logo */}
              <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                    Altura / Tamaño del Logo
                  </span>
                  <span className="text-xs font-mono font-bold text-[#B9522F]">
                    {localTheme.logoHeight || 44} px
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="24"
                    max="110"
                    value={localTheme.logoHeight || 44}
                    onChange={(e) => updateField('logoHeight', Number(e.target.value))}
                    className="flex-1 accent-[#B9522F] cursor-pointer"
                  />
                  <input
                    type="number"
                    min="20"
                    max="120"
                    value={localTheme.logoHeight || 44}
                    onChange={(e) => updateField('logoHeight', Number(e.target.value))}
                    className="w-16 px-1.5 py-1 text-center font-mono text-xs border border-[#DCD4C9] rounded-xs bg-white"
                  />
                </div>
              </div>

              {/* Textos del Navbar */}
              <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block">
                  Textos del Navbar
                </span>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Placeholder del Buscador
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.searchPlaceholder || ''}
                    onChange={(e) => updateSiteText('searchPlaceholder', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="Buscar en el catálogo..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Texto Botón "Mi Pedido"
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.quoteButtonText || ''}
                    onChange={(e) => updateSiteText('quoteButtonText', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="Mi Pedido"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================== 2. MICRO-ANUNCIOS ===================== */}
          {activeSection === 'announcement' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo de la Barra de Anuncios"
                value={localTheme.announcementBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('announcementBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Texto del Anuncio"
                value={localTheme.announcementTextColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('announcementTextColor', c)}
              />
              <ColorPickerRow
                label="Color de Acento / Enlace WhatsApp"
                value={localTheme.announcementAccentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('announcementAccentColor', c)}
              />
              <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block">
                  Texto del Micro-Anuncio
                </label>
                <textarea
                  rows={2}
                  value={resolvedTexts.announcementBarText || ''}
                  onChange={(e) => updateSiteText('announcementBarText', e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                  placeholder="CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO"
                />
              </div>
            </div>
          )}

          {/* ===================== 3. HERO / PORTADA ===================== */}
          {activeSection === 'hero' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Fondo del Hero"
                value={localTheme.heroBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('heroBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Títulos y Textos"
                value={localTheme.heroTextColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('heroTextColor', c)}
              />
              <ColorPickerRow
                label="Color Botón Principal Hero"
                value={localTheme.heroButtonBg}
                defaultValue="#FDB813"
                onChange={(c) => updateField('heroButtonBg', c)}
              />
              <ColorPickerRow
                label="Texto Botón Principal Hero"
                value={localTheme.heroButtonText}
                defaultValue="#18231C"
                onChange={(c) => updateField('heroButtonText', c)}
              />
              <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block">
                  Textos del Hero
                </span>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Título Línea 1
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.heroTitleLine1 || ''}
                    onChange={(e) => updateSiteText('heroTitleLine1', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs font-bold"
                    placeholder="INDUMENTARIA QUE"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Título Línea 2
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.heroTitleLine2 || ''}
                    onChange={(e) => updateSiteText('heroTitleLine2', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs font-bold"
                    placeholder="AGUANTA EL TRABAJO"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Subtítulo / Mensaje
                  </label>
                  <textarea
                    rows={2}
                    value={resolvedTexts.heroSubtitle || ''}
                    onChange={(e) => updateSiteText('heroSubtitle', e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="Confeccionada bajo estrictas normas de resistencia..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================== 4. CATEGORÍAS & FILTROS ===================== */}
          {activeSection === 'category_nav' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Acento en Menús y Filtros"
                value={localTheme.headerAccentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('headerAccentColor', c)}
              />
              <ColorPickerRow
                label="Color de Texto en Pestañas"
                value={localTheme.headerTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('headerTextColor', c)}
              />
              <ColorPickerRow
                label="Fondo de la Barra de Filtros"
                value={localTheme.secondaryColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('secondaryColor', c)}
              />
            </div>
          )}

          {/* ===================== 5. TARJETAS DE PRODUCTO ===================== */}
          {activeSection === 'catalog_cards' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo de la Tarjeta"
                value={localTheme.cardBgColor}
                defaultValue="#ECE5DC"
                onChange={(c) => updateField('cardBgColor', c)}
              />
              <ColorPickerRow
                label="Borde de la Tarjeta"
                value={localTheme.cardBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('cardBorderColor', c)}
              />
              <ColorPickerRow
                label="Texto de Nombre del Producto"
                value={localTheme.cardTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('cardTextColor', c)}
              />
              <ColorPickerRow
                label="Color de Precio en Tarjeta"
                value={localTheme.cardPriceColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('cardPriceColor', c)}
              />
              <ColorPickerRow
                label="Fondo de Botón 'AGREGAR'"
                value={localTheme.cardButtonBg}
                defaultValue={localTheme.buttonBgColor || '#18231C'}
                onChange={(c) => updateField('cardButtonBg', c)}
              />
              <ColorPickerRow
                label="Texto de Botón 'AGREGAR'"
                value={localTheme.cardButtonText}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('cardButtonText', c)}
              />
              <ColorPickerRow
                label="Fondo Badge Temporada"
                value={localTheme.seasonBadgeBg}
                defaultValue="#18231C"
                onChange={(c) => updateField('seasonBadgeBg', c)}
              />
              <ColorPickerRow
                label="Fondo Badge Descuento"
                value={localTheme.discountBadgeBg}
                defaultValue="#FDB813"
                onChange={(c) => updateField('discountBadgeBg', c)}
              />
            </div>
          )}

          {/* ===================== 6. FICHA DETALLE / MODAL ===================== */}
          {activeSection === 'product_detail' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Modal de Detalle"
                value={localTheme.cardBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('cardBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Títulos Técnicos"
                value={localTheme.catalogTitleColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('catalogTitleColor', c)}
              />
              <ColorPickerRow
                label="Botón Cotizar / Agregar"
                value={localTheme.buttonBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('buttonBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Acento en Talles & Colores"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
            </div>
          )}

          {/* ===================== 7. VENTANA MI PEDIDO ===================== */}
          {activeSection === 'quote_drawer' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo de Ventana 'Mi Pedido'"
                value={localTheme.quoteDrawerBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('quoteDrawerBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Textos y Títulos"
                value={localTheme.quoteDrawerTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('quoteDrawerTextColor', c)}
              />
              <ColorPickerRow
                label="Borde de Separadores"
                value={localTheme.quoteDrawerBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('quoteDrawerBorderColor', c)}
              />
              <ColorPickerRow
                label="Fondo Botón 'Enviar Pedido'"
                value={localTheme.quoteDrawerButtonBg}
                defaultValue="#25D366"
                onChange={(c) => updateField('quoteDrawerButtonBg', c)}
              />
              <ColorPickerRow
                label="Texto Botón 'Enviar Pedido'"
                value={localTheme.quoteDrawerButtonText}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('quoteDrawerButtonText', c)}
              />
            </div>
          )}

          {/* ===================== 8. SERVICIOS CORPORATIVOS ===================== */}
          {activeSection === 'corporate_services' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Acento Servicios"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
              <ColorPickerRow
                label="Fondo de Tarjetas de Servicios"
                value={localTheme.cardBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('cardBgColor', c)}
              />
            </div>
          )}

          {/* ===================== 9. ARMADOR DE UNIFORMES ===================== */}
          {activeSection === 'uniform_simulator' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Simulador"
                value={localTheme.panelBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('panelBgColor', c)}
              />
              <ColorPickerRow
                label="Color Botón de Cotización"
                value={localTheme.buttonBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('buttonBgColor', c)}
              />
              <ColorPickerRow
                label="Color Acento de Bordado"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
            </div>
          )}

          {/* ===================== 10. CURVA DE TALLES ===================== */}
          {activeSection === 'sizing_portal' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Portal de Talles"
                value={localTheme.panelBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('panelBgColor', c)}
              />
              <ColorPickerRow
                label="Borde de Tablas de Talles"
                value={localTheme.cardBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('cardBorderColor', c)}
              />
            </div>
          )}

          {/* ===================== 11. LOOKBOOK CAMPAÑA ===================== */}
          {activeSection === 'lookbook' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Puntos Hotspot"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
              <ColorPickerRow
                label="Fondo de Etiqueta Flotante"
                value={localTheme.primaryColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('primaryColor', c)}
              />
            </div>
          )}

          {/* ===================== 12. ESTADO DE PEDIDO ===================== */}
          {activeSection === 'order_tracking' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color de Barra de Progreso"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
              <ColorPickerRow
                label="Fondo de Tarjeta de Tracking"
                value={localTheme.panelBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('panelBgColor', c)}
              />
            </div>
          )}

          {/* ===================== 13. AUTH MODAL ===================== */}
          {activeSection === 'auth_modal' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Modal de Login"
                value={localTheme.loginModalBgColor}
                defaultValue="#FAF8F5"
                onChange={(c) => updateField('loginModalBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Textos y Títulos"
                value={localTheme.loginModalTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('loginModalTextColor', c)}
              />
              <ColorPickerRow
                label="Borde del Modal"
                value={localTheme.loginModalBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('loginModalBorderColor', c)}
              />
              <ColorPickerRow
                label="Fondo Botón Ingresar"
                value={localTheme.loginModalButtonBg}
                defaultValue="#18231C"
                onChange={(c) => updateField('loginModalButtonBg', c)}
              />
              <ColorPickerRow
                label="Texto Botón Ingresar"
                value={localTheme.loginModalButtonText}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('loginModalButtonText', c)}
              />
            </div>
          )}

          {/* ===================== 14. HUB ADMIN ===================== */}
          {activeSection === 'hub_admin' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Menú de Administrador"
                value={localTheme.hubBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('hubBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Textos y Menús del Hub"
                value={localTheme.hubTextColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('hubTextColor', c)}
              />
              <ColorPickerRow
                label="Color de Acento en el Hub"
                value={localTheme.hubAccentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('hubAccentColor', c)}
              />
              <ColorPickerRow
                label="Borde de Tarjetas en el Hub"
                value={localTheme.hubBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('hubBorderColor', c)}
              />
            </div>
          )}

          {/* ===================== 15. CRM BOARD ===================== */}
          {activeSection === 'crm_board' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo de la Cabecera CRM"
                value={localTheme.crmHeaderBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('crmHeaderBgColor', c)}
              />
              <ColorPickerRow
                label="Texto de la Cabecera CRM"
                value={localTheme.crmHeaderTextColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('crmHeaderTextColor', c)}
              />
              <ColorPickerRow
                label="Borde de Columnas Kanban"
                value={localTheme.cardBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('cardBorderColor', c)}
              />
            </div>
          )}

          {/* ===================== 16. CRM CARD ===================== */}
          {activeSection === 'crm_card' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo de la Tarjeta de Pedido en CRM"
                value={localTheme.crmCardBgColor}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('crmCardBgColor', c)}
              />
              <ColorPickerRow
                label="Texto de la Tarjeta en CRM"
                value={localTheme.crmCardTextColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('crmCardTextColor', c)}
              />
              <ColorPickerRow
                label="Borde de la Tarjeta en CRM"
                value={localTheme.crmCardBorderColor}
                defaultValue="#DCD4C9"
                onChange={(c) => updateField('crmCardBorderColor', c)}
              />
            </div>
          )}

          {/* ===================== 17. FOOTER ===================== */}
          {activeSection === 'footer' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Fondo del Footer"
                value={localTheme.footerBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('footerBgColor', c)}
              />
              <ColorPickerRow
                label="Color de Textos"
                value={localTheme.footerTextColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('footerTextColor', c)}
              />
              <ColorPickerRow
                label="Borde Superior del Footer"
                value={localTheme.footerBorderColor}
                defaultValue="rgba(255, 255, 255, 0.15)"
                onChange={(c) => updateField('footerBorderColor', c)}
              />
              <div className="p-3 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block">
                  Textos del Footer
                </span>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Tagline de Marca
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.footerTagline || ''}
                    onChange={(e) => updateSiteText('footerTagline', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="Catálogo digital de exhibición oficial..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Teléfono Central
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.footerPhone || ''}
                    onChange={(e) => updateSiteText('footerPhone', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="261 527-6713"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#6F6860] uppercase block mb-0.5">
                    Email de Contacto
                  </label>
                  <input
                    type="text"
                    value={resolvedTexts.footerEmail || ''}
                    onChange={(e) => updateSiteText('footerEmail', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    placeholder="pamperogranmendoza@gmail.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================== 18. BOTONES & TIPOGRAFÍA GLOBAL ===================== */}
          {activeSection === 'global_buttons' && (
            <div className="space-y-4 animate-fadeIn">
              <ColorPickerRow
                label="Color Primario de la Marca"
                value={localTheme.primaryColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('primaryColor', c)}
              />
              <ColorPickerRow
                label="Color de Acento Principal"
                value={localTheme.accentColor}
                defaultValue="#FDB813"
                onChange={(c) => updateField('accentColor', c)}
              />
              <ColorPickerRow
                label="Fondo General del Sitio (Lienzo)"
                value={localTheme.backgroundColor}
                defaultValue="#F5F2EC"
                onChange={(c) => updateField('backgroundColor', c)}
              />
              <ColorPickerRow
                label="Color de Botones Globales"
                value={localTheme.buttonBgColor}
                defaultValue="#18231C"
                onChange={(c) => updateField('buttonBgColor', c)}
              />
              <ColorPickerRow
                label="Texto de Botones Globales"
                value={localTheme.buttonTextColor}
                defaultValue="#FFFFFF"
                onChange={(c) => updateField('buttonTextColor', c)}
              />
            </div>
          )}
        </div>

        {/* LIENZO INTERACTIVO DEL CATÁLOGO REAL (DERECHA) */}
        <div className="lg:col-span-8 bg-[#EAE5D9]/40 p-3 sm:p-5 flex flex-col items-center justify-start overflow-y-auto max-h-[820px]">
          {/* Header del marco de dispositivo */}
          <div className={`${canvasContainerWidth} transition-all duration-300 flex items-center justify-between text-[10px] text-[#6F6860] uppercase tracking-wider mb-2 px-1`}>
            <span>
              Vista en Vivo: <strong>{deviceView.toUpperCase()}</strong> ({canvasView})
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'catalog', label: 'Catálogo' },
                { id: 'product_detail', label: 'Ficha Detalle' },
                { id: 'quote', label: 'Mi Pedido' },
                { id: 'simulator', label: 'Uniformes' },
                { id: 'lookbook', label: 'Lookbook' },
                { id: 'login', label: 'Login' },
                { id: 'hub', label: 'Hub' },
                { id: 'crm', label: 'CRM' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setCanvasView(v.id as CanvasViewMode)}
                  className={`px-2 py-0.5 rounded-xs font-bold cursor-pointer transition-colors text-[10px] ${
                    canvasView === v.id ? 'bg-[#18231C] text-white shadow-2xs' : 'bg-white text-[#4A453F] hover:bg-[#DCD4C9]'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* LIENZO PRINCIPAL RENDERIZADO CON COMPONENTES FIELES */}
          <div 
            className={`${canvasContainerWidth} bg-[#F5F2EC] rounded-xs shadow-md border border-[#DCD4C9] overflow-hidden transition-all duration-300`}
            style={{
              backgroundColor: localTheme.backgroundColor || '#F5F2EC',
              fontFamily: `'${localTheme.fontFamily || 'Montserrat'}', sans-serif`,
            }}
          >
            {/* MICRO-ANUNCIO INTERACTIVO */}
            <div
              onClick={() => { if (isInspectorActive) setActiveSection('announcement'); }}
              className={`py-1.5 px-3 text-center text-[10px] tracking-wider uppercase font-bold transition-all relative group cursor-pointer ${
                activeSection === 'announcement' ? 'ring-2 ring-emerald-500 ring-inset' : ''
              }`}
              style={{
                backgroundColor: localTheme.announcementBgColor || '#18231C',
                color: localTheme.announcementTextColor || '#F5F2EC',
              }}
            >
              <span>{resolvedTexts.announcementBarText}</span>
              {isInspectorActive && (
                <span className="hidden group-hover:inline-block absolute right-2 top-0.5 bg-emerald-500 text-white text-[8px] font-mono px-1 rounded-xs">
                  Clic para editar
                </span>
              )}
            </div>

            {/* NAVBAR INTERACTIVO (Fiel a la nueva especificación con Logo a la izquierda) */}
            <header
              onClick={() => { if (isInspectorActive) setActiveSection('navbar'); }}
              className={`px-4 py-2.5 transition-all relative group cursor-pointer border-b ${
                activeSection === 'navbar' ? 'ring-2 ring-emerald-500 ring-inset' : ''
              }`}
              style={{
                backgroundColor: localTheme.headerBgColor || '#FFFFFF',
                color: localTheme.headerTextColor || '#18231C',
                borderColor: localTheme.headerBorderColor || '#DCD4C9',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Logo a la izquierda */}
                <div className="shrink-0 flex items-center pr-3">
                  <PamperoLogo
                    customUrl={localTheme.customLogoUrl || localTheme.logoUrl}
                    height={localTheme.logoHeight || 38}
                    navBgColor={localTheme.headerBgColor || '#FFFFFF'}
                  />
                </div>

                {/* Categorías a la izquierda-centro */}
                <div 
                  onClick={(e) => { if (isInspectorActive) { e.stopPropagation(); setActiveSection('category_nav'); } }}
                  className="hidden md:flex items-center gap-3 text-xs font-bold uppercase tracking-wider flex-1"
                >
                  <span className="border-b-2 pb-0.5" style={{ borderColor: localTheme.headerAccentColor || localTheme.accentColor || '#FDB813' }}>
                    Hombre
                  </span>
                  <span className="opacity-75 hover:opacity-100">Mujer</span>
                  <span className="opacity-75 hover:opacity-100 hidden sm:inline">Infantil</span>
                  <span className="opacity-75 hover:opacity-100 hidden lg:inline">Venta Corporativa</span>
                  <span className="opacity-75 hover:opacity-100 hidden xl:inline text-[#B9522F]">Servicios Corporativos</span>
                </div>

                {/* Buscador & Acciones a la derecha */}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[11px] text-[#6F6860]">
                    <Search className="w-3 h-3" />
                    <span>{resolvedTexts.searchPlaceholder || 'Buscar...'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCanvasView('quote'); setActiveSection('quote_drawer'); }}
                    className="px-2.5 py-1.5 rounded-xs text-[11px] font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-xs"
                    style={{
                      backgroundColor: localTheme.buttonBgColor || localTheme.primaryColor || '#18231C',
                      color: localTheme.buttonTextColor || '#FFFFFF',
                    }}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-[#FDB813]" />
                    <span className="hidden sm:inline">{resolvedTexts.quoteButtonText || 'Mi Pedido'}</span>
                    <span className="w-4 h-4 rounded-full bg-[#FDB813] text-[#18231C] text-[10px] font-black flex items-center justify-center">
                      2
                    </span>
                  </button>

                  {/* Cuadrado de usuario */}
                  <div className="w-8 h-8 rounded-xs border border-[#DCD4C9] bg-white flex items-center justify-center font-bold text-xs text-[#18231C] shadow-2xs">
                    J
                  </div>
                </div>
              </div>

              {isInspectorActive && (
                <span className="hidden group-hover:inline-block absolute top-1 left-2 bg-emerald-500 text-white text-[8px] font-mono px-1 rounded-xs">
                  [Navbar & Logo] Clic para editar
                </span>
              )}
            </header>

            {/* VISTA 1: CATÁLOGO REGULAR COMPLETO */}
            {canvasView === 'catalog' && (
              <div>
                {/* HERO / PORTADA */}
                <div
                  onClick={() => { if (isInspectorActive) setActiveSection('hero'); }}
                  className={`p-6 sm:p-8 transition-all relative group cursor-pointer text-center ${
                    activeSection === 'hero' ? 'ring-2 ring-emerald-500 ring-inset' : ''
                  }`}
                  style={{
                    backgroundColor: localTheme.heroBgColor || '#18231C',
                    color: localTheme.heroTextColor || '#F5F2EC',
                  }}
                >
                  <span className="text-[10px] tracking-widest uppercase font-bold text-[#FDB813] mb-1 block">
                    Pampero Mendoza · Colección 2026
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-1">
                    {resolvedTexts.heroTitleLine1 || 'INDUMENTARIA QUE'}
                  </h1>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none mb-2 text-[#FDB813]">
                    {resolvedTexts.heroTitleLine2 || 'AGUANTA EL TRABAJO'}
                  </h2>
                  <p className="text-xs max-w-md mx-auto opacity-80 mb-4">
                    {resolvedTexts.heroSubtitle}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xs font-bold text-xs uppercase tracking-wider shadow-xs cursor-pointer"
                      style={{
                        backgroundColor: localTheme.heroButtonBg || '#FDB813',
                        color: localTheme.heroButtonText || '#18231C',
                      }}
                    >
                      {resolvedTexts.heroPrimaryBtnText || 'VER CATÁLOGO'}
                    </button>
                    <button
                      type="button"
                      className="px-3.5 py-2 rounded-xs font-bold text-xs uppercase tracking-wider border border-white/30 text-white cursor-pointer"
                    >
                      VENTA CORPORATIVA
                    </button>
                  </div>
                  {isInspectorActive && (
                    <span className="hidden group-hover:inline-block absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-mono px-1 rounded-xs">
                      [Hero] Clic para editar
                    </span>
                  )}
                </div>

                {/* CATÁLOGO DE PRODUCTOS (TARJETAS) */}
                <div
                  onClick={() => { if (isInspectorActive) setActiveSection('catalog_cards'); }}
                  className={`p-4 sm:p-6 transition-all relative group cursor-pointer ${
                    activeSection === 'catalog_cards' ? 'ring-2 ring-emerald-500 ring-inset' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#DCD4C9]">
                    <div>
                      <h3 
                        className="font-black text-sm uppercase tracking-wider"
                        style={{ color: localTheme.catalogTitleColor || localTheme.textColor || '#18231C' }}
                      >
                        {resolvedTexts.catalogTitle || 'CATÁLOGO OFICIAL'}
                      </h3>
                      <p 
                        className="text-[11px]"
                        style={{ color: localTheme.secondaryTextColor || '#6F6860' }}
                      >
                        {resolvedTexts.catalogSubtitle}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-[#6F6860] uppercase">
                      4 Artículos en Exhibición
                    </span>
                  </div>

                  {/* Grid de Productos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {previewProducts.map((prod, idx) => (
                      <div
                        key={prod.id}
                        onClick={(e) => {
                          if (isInspectorActive) {
                            e.stopPropagation();
                            setCanvasView('product_detail');
                            setActiveSection('product_detail');
                          }
                        }}
                        className="rounded-xs border overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5 shadow-2xs cursor-pointer"
                        style={{
                          backgroundColor: localTheme.cardBgColor || '#ECE5DC',
                          borderColor: localTheme.cardBorderColor || '#DCD4C9',
                        }}
                      >
                        <div className="relative aspect-4/3 bg-[#FAF8F5] overflow-hidden flex items-center justify-center p-2">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="max-h-full max-w-full object-contain"
                          />
                          {idx === 0 && (
                            <span 
                              className="absolute top-1 left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-2xs"
                              style={{
                                backgroundColor: localTheme.seasonBadgeBg || '#18231C',
                                color: localTheme.seasonBadgeText || '#F5F2EC',
                              }}
                            >
                              Temporada 2026
                            </span>
                          )}
                          {idx === 1 && (
                            <span 
                              className="absolute top-1 right-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-2xs"
                              style={{
                                backgroundColor: localTheme.discountBadgeBg || '#FDB813',
                                color: localTheme.discountBadgeText || '#18231C',
                              }}
                            >
                              -15% OFF
                            </span>
                          )}
                        </div>

                        <div className="p-2.5 flex flex-col gap-1">
                          <span className="text-[9px] font-mono font-bold text-[#6F6860]">
                            {prod.code}
                          </span>
                          <h4 
                            className="font-bold text-xs uppercase line-clamp-1"
                            style={{ color: localTheme.cardTextColor || localTheme.textColor || '#18231C' }}
                          >
                            {prod.name}
                          </h4>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span 
                              className="text-xs font-black font-mono"
                              style={{ color: localTheme.cardPriceColor || localTheme.catalogTitleColor || '#18231C' }}
                            >
                              ${(prod.price || 45000).toLocaleString('es-AR')}
                            </span>
                            <span className="text-[9px] text-[#6F6860] uppercase">IVA Inc.</span>
                          </div>

                          <button
                            type="button"
                            className="mt-2 w-full py-1.5 rounded-xs text-[10px] font-bold uppercase tracking-wider shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                            style={{
                              backgroundColor: localTheme.cardButtonBg || localTheme.buttonBgColor || '#18231C',
                              color: localTheme.cardButtonText || localTheme.buttonTextColor || '#FFFFFF',
                            }}
                          >
                            <ShoppingBag className="w-3 h-3 text-[#FDB813]" />
                            <span>{resolvedTexts.addToQuoteBtnText || 'AGREGAR'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isInspectorActive && (
                    <span className="hidden group-hover:inline-block absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-mono px-1 rounded-xs">
                      [Tarjetas de Producto] Clic para editar
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* VISTA 2: FICHA DETALLADA / MODAL DE PRODUCTO */}
            {canvasView === 'product_detail' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('product_detail'); }}
                className={`p-6 transition-all relative group cursor-pointer ${
                  activeSection === 'product_detail' ? 'ring-2 ring-emerald-500 ring-inset' : ''
                }`}
                style={{
                  backgroundColor: localTheme.cardBgColor || '#FAF8F5',
                  color: localTheme.cardTextColor || '#18231C',
                }}
              >
                <div className="bg-white rounded-xs border p-5 shadow-md grid grid-cols-1 md:grid-cols-2 gap-5" style={{ borderColor: localTheme.cardBorderColor || '#DCD4C9' }}>
                  <div className="bg-[#FAF8F5] rounded-xs p-4 flex items-center justify-center min-h-[220px]">
                    <img 
                      src={selectedSampleProduct?.image || '/placeholder.png'} 
                      alt="Detalle" 
                      className="max-h-52 object-contain"
                    />
                  </div>
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold text-[#6F6860]">
                      CÓDIGO: {selectedSampleProduct?.code || 'PAM-001'}
                    </span>
                    <h3 className="font-black text-lg uppercase">
                      {selectedSampleProduct?.name || 'Camisa de Trabajo Reforzada'}
                    </h3>
                    <div className="text-xl font-black font-mono" style={{ color: localTheme.cardPriceColor || '#18231C' }}>
                      ${(selectedSampleProduct?.price || 48000).toLocaleString('es-AR')}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Talle:</span>
                      <div className="flex gap-1.5">
                        {['38', '40', '42', '44', '46'].map((sz, i) => (
                          <span 
                            key={sz} 
                            className={`px-2 py-1 border text-xs font-bold rounded-2xs ${i === 2 ? 'bg-[#18231C] text-white' : 'bg-white'}`}
                          >
                            {sz}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full py-2.5 rounded-xs font-bold text-xs uppercase tracking-wider text-white shadow-xs"
                      style={{ backgroundColor: localTheme.buttonBgColor || '#18231C' }}
                    >
                      AGREGAR A MI PEDIDO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 3: VENTANA MI PEDIDO (DRAWER) */}
            {canvasView === 'quote' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('quote_drawer'); }}
                className={`p-5 transition-all relative group cursor-pointer ${
                  activeSection === 'quote_drawer' ? 'ring-2 ring-emerald-500 ring-inset' : ''
                }`}
                style={{
                  backgroundColor: localTheme.quoteDrawerBgColor || '#FAF8F5',
                  color: localTheme.quoteDrawerTextColor || '#18231C',
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: localTheme.quoteDrawerBorderColor || '#DCD4C9' }}>
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-[#B9522F]" />
                    <h3 className="font-black text-sm uppercase tracking-wider">
                      {resolvedTexts.quoteDrawerTitle || 'Mi Pedido'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#6F6860]">2 Artículos</span>
                </div>

                <div className="py-4 space-y-3">
                  <div className="p-3 bg-white rounded-xs border flex items-center justify-between" style={{ borderColor: localTheme.quoteDrawerBorderColor || '#DCD4C9' }}>
                    <div>
                      <span className="font-bold text-xs uppercase block">Camisa de Trabajo Clásica</span>
                      <span className="text-[10px] text-[#6F6860]">Talle: 42 · Color: Azul Marino · Cant: 2</span>
                    </div>
                    <span className="font-mono font-bold text-xs">$96.000</span>
                  </div>

                  <div className="p-3 bg-white rounded-xs border flex items-center justify-between" style={{ borderColor: localTheme.quoteDrawerBorderColor || '#DCD4C9' }}>
                    <div>
                      <span className="font-bold text-xs uppercase block">Pantalón Cargo Reforzado</span>
                      <span className="text-[10px] text-[#6F6860]">Talle: 44 · Color: Verde Oliva · Cant: 1</span>
                    </div>
                    <span className="font-mono font-bold text-xs">$68.500</span>
                  </div>
                </div>

                <div className="pt-3 border-t space-y-3" style={{ borderColor: localTheme.quoteDrawerBorderColor || '#DCD4C9' }}>
                  <div className="flex justify-between font-black text-sm uppercase">
                    <span>Total Estimado:</span>
                    <span className="font-mono">$164.500</span>
                  </div>
                  <button
                    type="button"
                    className="w-full py-2.5 rounded-xs font-bold text-xs uppercase tracking-wider shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: localTheme.quoteDrawerButtonBg || '#25D366',
                      color: localTheme.quoteDrawerButtonText || '#FFFFFF',
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{resolvedTexts.quoteDrawerSendBtnText || 'Enviar Pedido por WhatsApp'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* VISTA 4: LOGIN / ACCESO */}
            {canvasView === 'login' && (
              <div
                onClick={() => { if (isInspectorActive) setActiveSection('auth_modal'); }}
                className={`p-6 sm:p-8 max-w-md mx-auto my-6 rounded-xs border transition-all relative group cursor-pointer ${
                  activeSection === 'auth_modal' ? 'ring-2 ring-emerald-500 ring-inset' : ''
                }`}
                style={{
                  backgroundColor: localTheme.loginModalBgColor || '#FAF8F5',
                  color: localTheme.loginModalTextColor || '#18231C',
                  borderColor: localTheme.loginModalBorderColor || '#DCD4C9',
                }}
              >
                <div className="text-center mb-5">
                  <span className="text-xs font-black uppercase tracking-wider text-[#B9522F] block">
                    Acceso al Sistema
                  </span>
                  <h3 className="font-black text-lg uppercase tracking-tight">
                    Ingresar a mi Cuenta
                  </h3>
                  <p className="text-xs text-[#6F6860] mt-1">
                    Clientes, Empresas y Empleados de Pampero
                  </p>
                </div>

                <div className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-[#6F6860]">
                      Email o CUIT
                    </label>
                    <input
                      type="text"
                      disabled
                      value="cliente@empresa.com"
                      className="w-full p-2 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-[#6F6860]">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      disabled
                      value="••••••••••••"
                      className="w-full p-2 text-xs bg-white border border-[#DCD4C9] rounded-xs"
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full py-2.5 rounded-xs font-bold text-xs uppercase tracking-wider shadow-xs cursor-pointer mt-2"
                    style={{
                      backgroundColor: localTheme.loginModalButtonBg || '#18231C',
                      color: localTheme.loginModalButtonText || '#FFFFFF',
                    }}
                  >
                    INICIAR SESIÓN
                  </button>
                </div>
              </div>
            )}

            {/* VISTA 5: ARMADOR DE UNIFORMES */}
            {canvasView === 'simulator' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('uniform_simulator'); }}
                className="p-6 bg-[#FAF8F5] space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-black text-sm uppercase">Armador de Uniformes Virtual</h3>
                    <p className="text-xs text-[#6F6860]">Simulador de bordado y estampas corporativas para empresas.</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-xs">
                    Empresas
                  </span>
                </div>
                <div className="bg-white p-4 border rounded-xs flex items-center justify-center min-h-[180px]">
                  <Shirt className="w-16 h-16 text-[#18231C]" />
                </div>
              </div>
            )}

            {/* VISTA 6: LOOKBOOK */}
            {canvasView === 'lookbook' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('lookbook'); }}
                className="p-6 bg-[#FAF8F5] space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-black text-sm uppercase">Lookbook Campaña Cuyo 2026</h3>
                    <p className="text-xs text-[#6F6860]">Fotografías de campo con puntos interactivos.</p>
                  </div>
                </div>
                <div className="bg-neutral-800 rounded-xs p-8 text-center text-white relative min-h-[180px] flex items-center justify-center">
                  <span className="text-xs uppercase font-bold tracking-widest text-amber-300">
                    Campaña Visual Pampero
                  </span>
                  <div className="absolute top-1/3 left-1/3 w-6 h-6 rounded-full bg-amber-400 text-black font-bold flex items-center justify-center text-xs animate-ping" />
                  <div className="absolute top-1/3 left-1/3 w-6 h-6 rounded-full bg-amber-400 text-black font-bold flex items-center justify-center text-xs">
                    +
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 7: HUB DE EMPLEADOS / ADMIN */}
            {canvasView === 'hub' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('hub_admin'); }}
                className="p-6 space-y-4"
                style={{ backgroundColor: localTheme.hubBgColor || '#18231C', color: localTheme.hubTextColor || '#F5F2EC' }}
              >
                <div className="flex items-center justify-between border-b pb-3 border-white/20">
                  <h3 className="font-black text-sm uppercase">Menú Principal de Trabajo</h3>
                  <span className="text-xs font-bold text-[#FDB813]">Acceso Staff</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white/10 rounded-xs border border-white/20">
                    <Kanban className="w-6 h-6 text-[#FDB813] mb-2" />
                    <h4 className="font-bold text-xs uppercase">CRM Pedidos</h4>
                  </div>
                  <div className="p-4 bg-white/10 rounded-xs border border-white/20">
                    <Tag className="w-6 h-6 text-[#FDB813] mb-2" />
                    <h4 className="font-bold text-xs uppercase">Gestión Catálogo</h4>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 8: CRM KANBAN */}
            {canvasView === 'crm' && (
              <div 
                onClick={() => { if (isInspectorActive) setActiveSection('crm_board'); }}
                className="p-5 bg-[#FAF8F5] space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: localTheme.cardBorderColor || '#DCD4C9' }}>
                  <h3 className="font-black text-sm uppercase">CRM Gestión Comercial</h3>
                  <span className="text-xs font-bold text-emerald-700 font-mono">12 Órdenes Activas</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1. Cotización', '2. Seña 50%', '3. Listo'].map((col) => (
                    <div key={col} className="bg-neutral-100 p-2 rounded-xs border border-neutral-300 space-y-2">
                      <span className="text-[10px] font-bold uppercase text-neutral-600">{col}</span>
                      <div 
                        onClick={(e) => { e.stopPropagation(); setActiveSection('crm_card'); }}
                        className="p-2.5 rounded-xs border text-xs shadow-2xs cursor-pointer"
                        style={{
                          backgroundColor: localTheme.crmCardBgColor || '#FFFFFF',
                          borderColor: localTheme.crmCardBorderColor || '#DCD4C9',
                          color: localTheme.crmCardTextColor || '#18231C',
                        }}
                      >
                        <span className="font-bold block">Bodega Los Andes S.A.</span>
                        <span className="text-[10px] text-[#6F6860]">$240.000 · 40 prendas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FOOTER INTERACTIVO */}
            <footer
              onClick={() => { if (isInspectorActive) setActiveSection('footer'); }}
              className={`p-6 transition-all relative group cursor-pointer border-t text-xs ${
                activeSection === 'footer' ? 'ring-2 ring-emerald-500 ring-inset' : ''
              }`}
              style={{
                backgroundColor: localTheme.footerBgColor || '#18231C',
                color: localTheme.footerTextColor || '#F5F2EC',
                borderColor: localTheme.footerBorderColor || 'rgba(255, 255, 255, 0.15)',
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="mb-2">
                    <PamperoLogo
                      customUrl={localTheme.customLogoUrl || localTheme.logoUrl}
                      height={32}
                      navBgColor={localTheme.footerBgColor || '#18231C'}
                      onDarkBackground={true}
                    />
                  </div>
                  <p className="text-[11px] opacity-80">
                    {resolvedTexts.footerAbout}
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-[11px] uppercase tracking-wider mb-2 text-[#FDB813]">
                    Sucursales Gran Mendoza
                  </h5>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    {resolvedTexts.footerAddress}
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-[11px] uppercase tracking-wider mb-2 text-[#FDB813]">
                    Contacto & Asesoramiento
                  </h5>
                  <p className="text-[11px] opacity-80 flex items-center gap-1.5 mb-1">
                    <Phone className="w-3 h-3 text-[#FDB813]" />
                    <span>{resolvedTexts.footerPhone}</span>
                  </p>
                  <p className="text-[11px] opacity-80 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-[#FDB813]" />
                    <span>{resolvedTexts.footerEmail}</span>
                  </p>
                </div>
              </div>

              {isInspectorActive && (
                <span className="hidden group-hover:inline-block absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-mono px-1 rounded-xs">
                  [Footer] Clic para editar
                </span>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
