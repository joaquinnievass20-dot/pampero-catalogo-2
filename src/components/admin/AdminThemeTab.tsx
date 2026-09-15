import React, { useState, useRef, useEffect } from 'react';
import { ThemeConfig } from '../../types';
import { 
  Palette, 
  Upload, 
  Image, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Type, 
  SlidersHorizontal, 
  Eye, 
  Layout, 
  ArrowRight,
  HelpCircle,
  Save,
  Tag
} from 'lucide-react';
import { PamperoLogo } from '../PamperoLogo';
import { AdminColorArticlesSection } from './AdminColorArticlesSection';

interface AdminThemeTabProps {
  theme: ThemeConfig;
  onUpdateTheme: (newTheme: ThemeConfig) => void;
  triggerSaveNotice: () => void;
}

export const FONT_OPTIONS = [
  { id: 'Montserrat', name: 'Montserrat (Geométrica Limpia)', description: 'Diseño limpio y contemporáneo para marcas prémium' },
  { id: 'Roboto', name: 'Roboto (Moderna & Versátil)', description: 'Claridad excepcional, equilibrio y lectura fluida' },
  { id: 'Open Sans', name: 'Open Sans (Cálida & Neutra)', description: 'Diseño amigable optimizado para pantallas y comercio' },
  { id: 'Inter', name: 'Inter (Neutral Moderna)', description: 'Máxima legibilidad digital y precisión suiza' },
  { id: 'Lato', name: 'Lato (Armónica & Elegante)', description: 'Líneas semiredondeadas que brindan calidez y seriedad' },
  { id: 'Bebas Neue', name: 'Bebas Neue (Oficial Pampero)', description: 'Titulares condensados contundentes de máxima visibilidad' },
  { id: 'Barlow', name: 'Barlow (Industrial & Moderno)', description: 'Tipografía técnica equilibrada para indumentaria operativa' },
  { id: 'Oswald', name: 'Oswald (Condensada Fuerte)', description: 'Líneas rectas y presencia sólida de alto impacto' },
  { id: 'Playfair Display', name: 'Playfair Display (Tradición)', description: 'Estilo clásico con serifa para líneas artesanales' },
  { id: 'Anton', name: 'Anton (Impacto Visual)', description: 'Trazos gruesos e imponentes para cartelería' },
  { id: 'Roboto Condensed', name: 'Roboto Condensed (Técnica)', description: 'Funcional, legible y optimizada para catálogos' },
];

export interface PresetPalette {
  id: string;
  name: string;
  tagline: string;
  description: string;
  theme: Partial<ThemeConfig>;
  previewDots: string[];
}

export const PRESET_PALETTES: PresetPalette[] = [
  {
    id: 'pampero_oficial',
    name: 'Pampero Oficial Gran Mendoza',
    tagline: 'Paleta auténtica de pampero.com.ar',
    description: 'Verde pampero profundo, amarillo oficial Pampero (#FDB813), lino piedra y tipografía Bebas Neue.',
    previewDots: ['#18231C', '#FDB813', '#F5F2EC', '#DCD4C9'],
    theme: {
      primaryColor: '#18231C',
      accentColor: '#FDB813',
      hoverAccentColor: '#E0A310',
      buttonTextColor: '#18231C',
      iconColor: '#FDB813',
      panelBgColor: '#FAF8F5',
      secondaryColor: '#DCD4C9',
      backgroundColor: '#F5F2EC',
      textColor: '#18231C',
      headerBgColor: '#18231C',
      headerTextColor: '#F5F2EC',
      seasonBadgeBg: '#18231C',
      seasonBadgeText: '#F5F2EC',
      discountBadgeBg: '#FDB813',
      discountBadgeText: '#18231C',
      cardBgColor: '#ECE5DC',
      cardBorderColor: '#DCD4C9',
      fontFamily: 'Bebas Neue',
      logoUrl: '/logo-oficial.png.png',
      customLogoUrl: '/logo-oficial.png.png',
    },
  },
  {
    id: 'tierra_aventura',
    name: 'Tierra, Cuero & Aventura',
    tagline: 'Línea rural, outdoor y campestre',
    description: 'Oliva profundo, tonos cuero tostado, arena cálida y tipografía Oswald.',
    previewDots: ['#28331E', '#99582A', '#F7F4EB', '#EAE5D9'],
    theme: {
      primaryColor: '#28331E',
      accentColor: '#99582A',
      hoverAccentColor: '#7B421C',
      buttonTextColor: '#FFFFFF',
      iconColor: '#99582A',
      panelBgColor: '#F7F4EB',
      secondaryColor: '#EAE5D9',
      backgroundColor: '#F7F4EB',
      textColor: '#28331E',
      headerBgColor: '#28331E',
      headerTextColor: '#F7F4EB',
      seasonBadgeBg: '#28331E',
      seasonBadgeText: '#F7F4EB',
      discountBadgeBg: '#99582A',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#EAE5D9',
      cardBorderColor: '#D3CBBA',
      fontFamily: 'Oswald',
    },
  },
  {
    id: 'noche_industrial',
    name: 'Seguridad & Noche Industrial',
    tagline: 'Minería, petróleo, refinerías y obras viales',
    description: 'Negro grafito, naranja de alta visibilidad vial, fondos titanio y tipografía Barlow.',
    previewDots: ['#121212', '#E85D04', '#F8F9FA', '#2B2D42'],
    theme: {
      primaryColor: '#121212',
      accentColor: '#E85D04',
      hoverAccentColor: '#DC2F02',
      buttonTextColor: '#FFFFFF',
      iconColor: '#E85D04',
      panelBgColor: '#F8F9FA',
      secondaryColor: '#E2E8F0',
      backgroundColor: '#F8F9FA',
      textColor: '#121212',
      headerBgColor: '#121212',
      headerTextColor: '#FFFFFF',
      seasonBadgeBg: '#121212',
      seasonBadgeText: '#FFFFFF',
      discountBadgeBg: '#E85D04',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#EEF0F2',
      cardBorderColor: '#CBD5E1',
      fontFamily: 'Barlow',
    },
  },
  {
    id: 'azul_corporativo',
    name: 'Corporativo & Logística Operativa',
    tagline: 'Licitaciones, empresas de servicios y flotas',
    description: 'Azul marino institucional, ámbar de seguridad, fondos hielo y tipografía Montserrat.',
    previewDots: ['#0F1E36', '#E76F51', '#F0F4F8', '#CBD5E1'],
    theme: {
      primaryColor: '#0F1E36',
      accentColor: '#E76F51',
      hoverAccentColor: '#D45A3C',
      buttonTextColor: '#FFFFFF',
      iconColor: '#E76F51',
      panelBgColor: '#F0F4F8',
      secondaryColor: '#CBD5E1',
      backgroundColor: '#F0F4F8',
      textColor: '#0F1E36',
      headerBgColor: '#0F1E36',
      headerTextColor: '#FFFFFF',
      seasonBadgeBg: '#0F1E36',
      seasonBadgeText: '#FFFFFF',
      discountBadgeBg: '#E76F51',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#E2E8F0',
      cardBorderColor: '#94A3B8',
      fontFamily: 'Montserrat',
    },
  },
  {
    id: 'borgona_tradicion',
    name: 'Borgoña & Tradición Cuyana',
    tagline: 'Línea de campo, vendimia y estancias',
    description: 'Bordo vino mendocino, carbón cálido, lino suave y tipografía Playfair Display.',
    previewDots: ['#1C1917', '#881337', '#FAF7F2', '#E7E0D6'],
    theme: {
      primaryColor: '#1C1917',
      accentColor: '#881337',
      hoverAccentColor: '#70102D',
      buttonTextColor: '#FFFFFF',
      iconColor: '#881337',
      panelBgColor: '#FAF7F2',
      secondaryColor: '#E7E0D6',
      backgroundColor: '#FAF7F2',
      textColor: '#1C1917',
      headerBgColor: '#1C1917',
      headerTextColor: '#FAF7F2',
      seasonBadgeBg: '#1C1917',
      seasonBadgeText: '#FAF7F2',
      discountBadgeBg: '#881337',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#EFEAE2',
      cardBorderColor: '#D8CEBE',
      fontFamily: 'Playfair Display',
    },
  },
  {
    id: 'grafito_titanio',
    name: 'Grafito & Titanio Puro',
    tagline: 'Línea técnica de alta precisión',
    description: 'Negro grafito, gris pizarra, azul acrónimo y tipografía Inter.',
    previewDots: ['#0F172A', '#2563EB', '#F8FAFC', '#E2E8F0'],
    theme: {
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      hoverAccentColor: '#1D4ED8',
      buttonTextColor: '#FFFFFF',
      iconColor: '#2563EB',
      panelBgColor: '#F8FAFC',
      secondaryColor: '#E2E8F0',
      backgroundColor: '#F8FAFC',
      textColor: '#0F172A',
      headerBgColor: '#0F172A',
      headerTextColor: '#F8FAFC',
      seasonBadgeBg: '#0F172A',
      seasonBadgeText: '#F8FAFC',
      discountBadgeBg: '#2563EB',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#F1F5F9',
      cardBorderColor: '#CBD5E1',
      fontFamily: 'Inter',
    },
  },
  {
    id: 'arena_dorada',
    name: 'Arena Pampeana & Cosecha',
    tagline: 'Cosecha, silos y labor agropecuaria',
    description: 'Marrón suela oscuro, mostaza cereal, arena cálida y tipografía Anton.',
    previewDots: ['#3F2E21', '#D97706', '#FBF8F1', '#E8DFD0'],
    theme: {
      primaryColor: '#3F2E21',
      accentColor: '#D97706',
      hoverAccentColor: '#B45309',
      buttonTextColor: '#FFFFFF',
      iconColor: '#D97706',
      panelBgColor: '#FBF8F1',
      secondaryColor: '#E8DFD0',
      backgroundColor: '#FBF8F1',
      textColor: '#3F2E21',
      headerBgColor: '#3F2E21',
      headerTextColor: '#FBF8F1',
      seasonBadgeBg: '#3F2E21',
      seasonBadgeText: '#FBF8F1',
      discountBadgeBg: '#D97706',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#EDE4D5',
      cardBorderColor: '#D6C8B5',
      fontFamily: 'Anton',
    },
  },
  {
    id: 'vendimia_cuyo',
    name: 'Vendimia Andina & Bodegas',
    tagline: 'Identidad vitivinícola de Mendoza',
    description: 'Borgoña roble, cobre cuyano, lino de montaña y tipografía Playfair Display.',
    previewDots: ['#3D0C11', '#C36B32', '#FDFBF7', '#EFE7DE'],
    theme: {
      primaryColor: '#3D0C11',
      accentColor: '#C36B32',
      hoverAccentColor: '#9C4E23',
      buttonTextColor: '#FFFFFF',
      iconColor: '#C36B32',
      panelBgColor: '#FDFBF7',
      secondaryColor: '#EFE7DE',
      backgroundColor: '#FDFBF7',
      textColor: '#3D0C11',
      headerBgColor: '#3D0C11',
      headerTextColor: '#FDFBF7',
      seasonBadgeBg: '#3D0C11',
      seasonBadgeText: '#FDFBF7',
      discountBadgeBg: '#C36B32',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#EFE7DE',
      cardBorderColor: '#D8CDC2',
      fontFamily: 'Playfair Display',
    },
  },
  {
    id: 'minimal_clean',
    name: 'Minimal Clean Blanco & Rojo',
    tagline: 'Contraste contemporáneo directo',
    description: 'Carbón puro, rojo Pampero enérgico, fondo blanco nieve y tipografía Bebas Neue.',
    previewDots: ['#1A1A1A', '#D90429', '#FFFFFF', '#EAEAEA'],
    theme: {
      primaryColor: '#1A1A1A',
      accentColor: '#D90429',
      hoverAccentColor: '#B00320',
      buttonTextColor: '#FFFFFF',
      iconColor: '#D90429',
      panelBgColor: '#FFFFFF',
      secondaryColor: '#EAEAEA',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A1A',
      headerBgColor: '#1A1A1A',
      headerTextColor: '#FFFFFF',
      seasonBadgeBg: '#1A1A1A',
      seasonBadgeText: '#FFFFFF',
      discountBadgeBg: '#D90429',
      discountBadgeText: '#FFFFFF',
      cardBgColor: '#F5F5F5',
      cardBorderColor: '#E0E0E0',
      fontFamily: 'Bebas Neue',
    },
  },
];

export const AdminThemeTab: React.FC<AdminThemeTabProps> = ({
  theme,
  onUpdateTheme,
  triggerSaveNotice,
}) => {
  // Mode selection: 'palettes' | 'manual'
  const [editorMode, setEditorMode] = useState<'palettes' | 'manual'>('palettes');
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

  // Sync state if prop changes
  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  // Real-time theme update helper: immediately saves to localStorage and updates parent app
  const applyLiveChange = (field: keyof ThemeConfig, value: any) => {
    const updated = { ...currentTheme, [field]: value };
    if (field === 'customLogoUrl') {
      updated.logoUrl = value;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pampero_custom_logo', value);
      }
    }
    if (field === 'logoHeight') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pampero_logo_height', value.toString());
      }
    }
    setCurrentTheme(updated);
    onUpdateTheme(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(updated));
      localStorage.setItem('pampero_theme_config', JSON.stringify(updated));
    }
  };

  const handleSaveAllTheme = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(currentTheme));
      localStorage.setItem('pampero_theme_config', JSON.stringify(currentTheme));
      if (currentTheme.customLogoUrl) {
        localStorage.setItem('pampero_custom_logo', currentTheme.customLogoUrl);
      }
      if (currentTheme.logoHeight) {
        localStorage.setItem('pampero_logo_height', currentTheme.logoHeight.toString());
      }
    }
    onUpdateTheme(currentTheme);
    try {
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: currentTheme }),
      });
    } catch (err) {
      console.error('[THEME] Error saving theme to server:', err);
    }
    triggerSaveNotice();
  };

  // Logo file upload handler with direct server persistence
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccioná un archivo de imagen válido (PNG, JPG, SVG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // 1. Immediate optimistic update
        applyLiveChange('customLogoUrl', dataUrl);
        triggerSaveNotice();

        // 2. Direct server persistence
        try {
          const resp = await fetch('/api/theme/logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, filename: file.name }),
          });
          const result = await resp.json();
          if (result.success && result.theme) {
            setCurrentTheme(result.theme);
            onUpdateTheme(result.theme);
            if (typeof window !== 'undefined') {
              localStorage.setItem('pampero_catalog_theme', JSON.stringify(result.theme));
              localStorage.setItem('pampero_custom_logo', result.logoUrl);
            }
          }
        } catch (err) {
          console.error('[LOGO UPLOAD] Error persisting logo to server:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply complete preset palette in 1 click
  const handleSelectPalette = async (preset: PresetPalette) => {
    const merged: ThemeConfig = {
      ...currentTheme,
      ...preset.theme,
    };
    setCurrentTheme(merged);
    onUpdateTheme(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(merged));
      localStorage.setItem('pampero_theme_config', JSON.stringify(merged));
    }
    try {
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: merged }),
      });
    } catch (err) {
      console.error('[THEME] Error saving preset to server:', err);
    }
    triggerSaveNotice();
  };

  // Reset to original Pampero Official
  const handleResetOfficial = async () => {
    const official = PRESET_PALETTES[0].theme;
    const merged: ThemeConfig = {
      ...currentTheme,
      ...official,
      customLogoUrl: '/logo-oficial.png.png',
      logoUrl: '/logo-oficial.png.png',
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('pampero_custom_logo', '/logo-oficial.png.png');
      localStorage.setItem('pampero_catalog_theme', JSON.stringify(merged));
      localStorage.setItem('pampero_theme_config', JSON.stringify(merged));
    }
    setCurrentTheme(merged);
    onUpdateTheme(merged);
    try {
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: merged }),
      });
    } catch (err) {
      console.error('[THEME] Error resetting theme on server:', err);
    }
    triggerSaveNotice();
  };

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* Top Banner & Mode Switcher */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <Palette className="w-6 h-6 text-[#B9522F]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Diseño, Colores, Logo & Tipografía
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Todos los cambios se aplican <strong>en tiempo real e instantáneamente</strong> en todo el catálogo y portada.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAllTheme}
              className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              Guardar Cambios del Tema
            </button>
            <button
              type="button"
              onClick={handleResetOfficial}
              className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[11px] font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#B9522F]" />
              Restablecer Oficial
            </button>
          </div>
        </div>

        {/* 3 Clear Options Toggle: Palettes vs Manual with Mockup vs Color Codes */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-[#B9522F]" />
            Elegí cómo querés editar el aspecto:
          </span>

          <div className="inline-flex flex-wrap rounded-xs border border-[#DCD4C9] p-1 bg-[#F5F2EC] w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => setEditorMode('palettes')}
              className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                editorMode === 'palettes'
                  ? 'bg-[#18231C] text-[#F5F2EC] shadow-xs'
                  : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              1. Paletas Completas
            </button>

            <button
              type="button"
              onClick={() => setEditorMode('manual')}
              className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                editorMode === 'manual'
                  ? 'bg-[#18231C] text-[#F5F2EC] shadow-xs'
                  : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <Eye className="w-4 h-4" style={{ color: currentTheme.accentColor || '#FDB813' }} />
              2. Edición Manual 100%
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN OBLIGATORIA: LOGO DE LA MARCA */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCD4C9] pb-3">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Image className="w-4 h-4" style={{ color: currentTheme.accentColor || '#FDB813' }} />
              Logo Oficial de la Empresa / Sitio
            </h4>
            <p className="text-xs text-[#6F6860]">
              Cargá el archivo de tu logo y regulá el tamaño en píxeles. Se actualiza <strong>automáticamente y al instante</strong> en la cabecera, portada, pie de página y paneles.
            </p>
          </div>
          {(currentTheme.customLogoUrl && currentTheme.customLogoUrl !== '/logo-oficial.png.png') && (
            <button
              type="button"
              onClick={() => {
                applyLiveChange('customLogoUrl', '/logo-oficial.png.png');
                triggerSaveNotice();
              }}
              className="text-xs text-red-600 hover:text-red-800 font-bold uppercase tracking-wider underline flex items-center gap-1 cursor-pointer"
            >
              Restablecer al logo oficial estándar Pampero
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* File input controls */}
          <div className="md:col-span-7 space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1.5">
                1. Subir Archivo de Imagen desde tu Computadora (PNG, JPG, SVG, WEBP)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Seleccionar Archivo de Logo
                </button>
                <span className="text-xs text-[#6F6860] font-medium">
                  {currentTheme.customLogoUrl ? '✓ Archivo cargado y aplicado' : 'Sin archivo seleccionado aún'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DCD4C9]/60">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                2. O Pegar enlace / URL directa de la imagen
              </label>
              <input
                type="text"
                value={currentTheme.customLogoUrl || ''}
                onChange={(e) => applyLiveChange('customLogoUrl', e.target.value)}
                placeholder="https://misitio.com/logo-pampero.png"
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            {/* 3. Logo Height Slider & Number Input */}
            <div className="pt-2 border-t border-[#DCD4C9]/60">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                  3. Tamaño / Altura del Logo (Agrandar o Achicar)
                </label>
                <span className="text-xs font-mono font-bold text-[#B9522F]">
                  {currentTheme.logoHeight || 44} px
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="24"
                  max="120"
                  value={currentTheme.logoHeight || 44}
                  onChange={(e) => applyLiveChange('logoHeight', Number(e.target.value))}
                  className="flex-1 accent-[#B9522F] cursor-pointer"
                />
                <input
                  type="number"
                  min="20"
                  max="140"
                  value={currentTheme.logoHeight || 44}
                  onChange={(e) => applyLiveChange('logoHeight', Number(e.target.value))}
                  className="w-20 px-2 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold text-center"
                />
              </div>
              <p className="text-[10px] text-[#6F6860] mt-1">
                Aumentá este valor para que el logo se vea grande y nítido tanto en la barra superior como en el panel de control.
              </p>
            </div>
          </div>

          {/* Dual Preview Box: on Light and Dark backgrounds */}
          <div className="md:col-span-5 bg-[#FAF8F5] p-4 rounded-xs border border-[#DCD4C9] space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6F6860] block">
              Previsualización del Logo Aplicado ({currentTheme.logoHeight || 44}px)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {/* Over Light Bg */}
              <div className="p-3 bg-[#F5F2EC] border border-[#DCD4C9] rounded-xs flex flex-col items-center justify-center min-h-[85px] overflow-hidden">
                <span className="text-[9px] text-[#6F6860] uppercase mb-1">Fondo Claro</span>
                <PamperoLogo 
                  customUrl={currentTheme.customLogoUrl || currentTheme.logoUrl} 
                  height={currentTheme.logoHeight || 44} 
                />
              </div>
              {/* Over Dark Bg */}
              <div className="p-3 bg-[#18231C] text-white border border-neutral-800 rounded-xs flex flex-col items-center justify-center min-h-[85px] overflow-hidden">
                <span className="text-[9px] text-[#DCD4C9]/70 uppercase mb-1">Fondo Oscuro</span>
                <PamperoLogo 
                  customUrl={currentTheme.customLogoUrl || currentTheme.logoUrl} 
                  height={currentTheme.logoHeight || 44} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPCIÓN 1: PALETAS DE COLORES COMPLETAS (1 CLIC) */}
      {/* ========================================================================= */}
      {editorMode === 'palettes' && (
        <div className="bg-white p-5 sm:p-6 rounded-xs border border-[#DCD4C9] space-y-6 shadow-2xs animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: currentTheme.accentColor || '#FDB813' }} />
              Paletas Oficiales & Temáticas Listas para Usar
            </h4>
            <p className="text-xs text-[#6F6860] mt-1">
              Hacé un solo clic en cualquiera de estas paletas para cambiar de inmediato todos los colores, tipografía, cuadritos y botones del catálogo de forma 100% armónica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESET_PALETTES.map((preset) => {
              const isSelected =
                currentTheme.primaryColor === preset.theme.primaryColor &&
                currentTheme.accentColor === preset.theme.accentColor &&
                currentTheme.backgroundColor === preset.theme.backgroundColor;

              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPalette(preset)}
                  className={`p-4 rounded-xs border-2 cursor-pointer transition-all space-y-3 relative ${
                    isSelected
                      ? 'border-[#FDB813] bg-[#FDB813]/10 shadow-sm ring-2 ring-[#FDB813]/30'
                      : 'border-[#DCD4C9] bg-[#FAF8F5] hover:border-[#18231C] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span 
                        className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs flex items-center gap-1"
                        style={{ backgroundColor: currentTheme.accentColor || '#FDB813', color: '#18231C' }}
                      >
                        <Check className="w-3 h-3" /> Activa
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#6F6860] leading-relaxed">
                    {preset.description}
                  </p>

                  {/* 4 Swatches */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#DCD4C9]/60">
                    <div className="flex items-center gap-1.5">
                      {preset.previewDots.map((dotColor, idx) => (
                        <div
                          key={idx}
                          className="size-6 rounded-full border border-black/20 shadow-2xs"
                          style={{ backgroundColor: dotColor }}
                          title={dotColor}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] ml-auto">
                      Fuente: {preset.theme.fontFamily}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <div 
            className="p-3 bg-[#FAF8F5] border-l-4 rounded-r-xs text-xs text-[#4A453F] flex items-center gap-2"
            style={{ borderLeftColor: currentTheme.accentColor || '#FDB813' }}
          >
            <HelpCircle className="w-4 h-4 shrink-0" style={{ color: currentTheme.accentColor || '#FDB813' }} />
            <span>
              ¿Querés ajustar detalles específicos como el color del badge de descuento o el fondo de las tarjetas? Cambiá a la <strong>Opción 2: Edición Manual con Captura en Vivo</strong> arriba.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPCIÓN 2: EDICIÓN MANUAL CON CAPTURA / MAQUETA EN VIVO */}
      {/* ========================================================================= */}
      {editorMode === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* COLUMNA IZQUIERDA: CONTROLES DETALLADOS */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. TIPOGRAFÍA */}
            <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3">
              <div className="border-b border-[#DCD4C9] pb-2">
                <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
                  <span className="size-5 rounded-full bg-[#18231C] text-[#F5F2EC] text-[10px] font-bold grid place-items-center">
                    T
                  </span>
                  Tipografía de Titulares & Catálogo
                </h4>
                <p className="text-xs text-[#6F6860]">
                  Seleccioná la fuente para todos los títulos, nombres de artículos y navegación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FONT_OPTIONS.map((f) => {
                  const isSelected = currentTheme.fontFamily === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => applyLiveChange('fontFamily', f.id)}
                      className={`p-2.5 rounded-xs border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#FDB813] bg-[#FDB813]/10'
                          : 'border-[#DCD4C9] bg-[#FAF8F5] hover:border-[#18231C]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#18231C]">{f.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FDB813]" />}
                      </div>
                      <div
                        className="text-sm font-bold uppercase text-[#18231C] mt-1 truncate"
                        style={{ fontFamily: f.id }}
                      >
                        PAMPERO 2026
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. SELECTORES DE COLOR CON IDENTIFICADOR NUMÉRICO */}
            <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
              <div className="border-b border-[#DCD4C9] pb-2">
                <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: currentTheme.accentColor || '#FDB813' }} />
                  Controles de Color Individuales (Conexión en Vivo)
                </h4>
                <p className="text-xs text-[#6F6860]">
                  Cada control tiene un número <span className="font-bold" style={{ color: currentTheme.accentColor || '#FDB813' }}>[1 al 7]</span> que corresponde exactamente a la captura de la derecha.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* [1] Cabecera & Footer */}
                <div
                  onMouseEnter={() => setHighlightTarget('header')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">1</span>
                      Cabecera & Barra Superior
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.headerBgColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.headerBgColor || '#18231C'}
                      onChange={(e) => applyLiveChange('headerBgColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.headerBgColor || '#18231C'}
                      onChange={(e) => applyLiveChange('headerBgColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [2] Color Principal de Marca */}
                <div
                  onMouseEnter={() => setHighlightTarget('primary')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">2</span>
                      Color Principal (Botones/Acción)
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.primaryColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.primaryColor || '#18231C'}
                      onChange={(e) => applyLiveChange('primaryColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.primaryColor || '#18231C'}
                      onChange={(e) => applyLiveChange('primaryColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [3] Color de Acento (Amarillo Oficial Pampero) */}
                <div
                  onMouseEnter={() => setHighlightTarget('accent')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span 
                        className="size-4 rounded-full text-[9px] font-bold grid place-items-center"
                        style={{ backgroundColor: currentTheme.accentColor || '#FDB813', color: '#18231C' }}
                      >
                        3
                      </span>
                      Color de Acento & Ofertas
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.accentColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.accentColor || '#FDB813'}
                      onChange={(e) => applyLiveChange('accentColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.accentColor || '#FDB813'}
                      onChange={(e) => applyLiveChange('accentColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [4] Fondo General del Sitio */}
                <div
                  onMouseEnter={() => setHighlightTarget('background')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">4</span>
                      Fondo General (Lienzo)
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.backgroundColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.backgroundColor || '#F5F2EC'}
                      onChange={(e) => applyLiveChange('backgroundColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.backgroundColor || '#F5F2EC'}
                      onChange={(e) => applyLiveChange('backgroundColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [5] Tarjeta de Producto Fondo */}
                <div
                  onMouseEnter={() => setHighlightTarget('card')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">5</span>
                      Fondo Tarjetas de Producto
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.cardBgColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.cardBgColor || '#ECE5DC'}
                      onChange={(e) => applyLiveChange('cardBgColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.cardBgColor || '#ECE5DC'}
                      onChange={(e) => applyLiveChange('cardBgColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [6] Cuadrito Badge de Temporada */}
                <div
                  onMouseEnter={() => setHighlightTarget('seasonBadge')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">6</span>
                      Badge de Temporada
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.seasonBadgeBg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.seasonBadgeBg || '#18231C'}
                      onChange={(e) => applyLiveChange('seasonBadgeBg', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.seasonBadgeBg || '#18231C'}
                      onChange={(e) => applyLiveChange('seasonBadgeBg', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [7] Cuadrito Badge de Descuento (-15% OFF) */}
                <div
                  onMouseEnter={() => setHighlightTarget('discountBadge')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span 
                        className="size-4 rounded-full text-[9px] font-bold grid place-items-center"
                        style={{ backgroundColor: currentTheme.discountBadgeBg || '#FDB813', color: '#18231C' }}
                      >
                        7
                      </span>
                      Badge Descuento (-% OFF)
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.discountBadgeBg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.discountBadgeBg || '#FDB813'}
                      onChange={(e) => applyLiveChange('discountBadgeBg', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.discountBadgeBg || '#FDB813'}
                      onChange={(e) => applyLiveChange('discountBadgeBg', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [8] Efecto Hover al Pasar el Mouse en Botones */}
                <div
                  onMouseEnter={() => setHighlightTarget('hoverAccent')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span 
                        className="size-4 rounded-full text-[9px] font-bold grid place-items-center"
                        style={{ backgroundColor: currentTheme.hoverAccentColor || '#E0A310', color: '#18231C' }}
                      >
                        8
                      </span>
                      Efecto Hover (Al pasar el mouse)
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.hoverAccentColor || '#E0A310'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.hoverAccentColor || '#E0A310'}
                      onChange={(e) => applyLiveChange('hoverAccentColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.hoverAccentColor || '#E0A310'}
                      onChange={(e) => applyLiveChange('hoverAccentColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [9] Color de Texto en Botones Principales */}
                <div
                  onMouseEnter={() => setHighlightTarget('buttonText')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">9</span>
                      Texto de Botones
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.buttonTextColor || '#FFFFFF'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.buttonTextColor || '#FFFFFF'}
                      onChange={(e) => applyLiveChange('buttonTextColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.buttonTextColor || '#FFFFFF'}
                      onChange={(e) => applyLiveChange('buttonTextColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [10] Color de Loguitos e Íconos Secundarios */}
                <div
                  onMouseEnter={() => setHighlightTarget('iconColor')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span 
                        className="size-4 rounded-full text-[9px] font-bold grid place-items-center"
                        style={{ backgroundColor: currentTheme.iconColor || currentTheme.accentColor || '#FDB813', color: '#18231C' }}
                      >
                        10
                      </span>
                      Color de Loguitos e Íconos
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.iconColor || currentTheme.accentColor || '#FDB813'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.iconColor || currentTheme.accentColor || '#FDB813'}
                      onChange={(e) => applyLiveChange('iconColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.iconColor || currentTheme.accentColor || '#FDB813'}
                      onChange={(e) => applyLiveChange('iconColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [11] Fondo del Panel de Control & Modales */}
                <div
                  onMouseEnter={() => setHighlightTarget('panelBg')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">11</span>
                      Fondo Panel de Control & Ventanas
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.panelBgColor || '#FAF8F5'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.panelBgColor || '#FAF8F5'}
                      onChange={(e) => applyLiveChange('panelBgColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.panelBgColor || '#FAF8F5'}
                      onChange={(e) => applyLiveChange('panelBgColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

                {/* [12] Contornos y Bordes de Tarjetas */}
                <div
                  onMouseEnter={() => setHighlightTarget('cardBorder')}
                  onMouseLeave={() => setHighlightTarget(null)}
                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2 hover:border-[#18231C] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#18231C] uppercase flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-[#18231C] text-[#F5F2EC] text-[9px] grid place-items-center">12</span>
                      Contornos y Bordes de Tarjetas
                    </span>
                    <span className="text-[10px] font-mono text-[#6F6860]">{currentTheme.cardBorderColor || '#DCD4C9'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.cardBorderColor || '#DCD4C9'}
                      onChange={(e) => applyLiveChange('cardBorderColor', e.target.value)}
                      className="size-8 rounded-xs cursor-pointer border border-[#DCD4C9]"
                    />
                    <input
                      type="text"
                      value={currentTheme.cardBorderColor || '#DCD4C9'}
                      onChange={(e) => applyLiveChange('cardBorderColor', e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                    />
                  </div>
                </div>

              </div>

              {/* Botón Guardar Cambios al pie de edición manual */}
              <div className="pt-4 border-t border-[#DCD4C9] flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAllTheme}
                  className="px-6 py-2.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4 text-emerald-400" />
                  Guardar Cambios del Tema
                </button>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: "EL CUADRITO CON LA CAPTURA EN VIVO" */}
          <div className="lg:col-span-5 space-y-3">
            <div className="sticky top-20 bg-white p-4 rounded-xs border-2 border-[#18231C] shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" style={{ color: currentTheme.accentColor || '#FDB813' }} />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                    Captura en Vivo del Catálogo
                  </span>
                </div>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase px-2 py-0.5 rounded-xs animate-pulse">
                  Tiempo Real
                </span>
              </div>

              {/* LA MAQUETA INTERACTIVA */}
              <div
                className="rounded-xs border overflow-hidden transition-all text-xs"
                style={{
                  backgroundColor: currentTheme.backgroundColor || '#F5F2EC',
                  borderColor: currentTheme.cardBorderColor || '#DCD4C9',
                  color: currentTheme.textColor || '#18231C',
                }}
              >
                {/* 1. Header Mockup */}
                <div
                  className={`p-3 transition-all flex items-center justify-between border-b ${
                    highlightTarget === 'header' ? 'ring-2 ring-offset-2' : ''
                  }`}
                  style={{
                    backgroundColor: currentTheme.headerBgColor || '#18231C',
                    color: currentTheme.headerTextColor || '#F5F2EC',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <PamperoLogo customUrl={currentTheme.customLogoUrl || currentTheme.logoUrl} size="sm" />
                    <span className="text-[8px] bg-white/20 px-1 py-0.5 rounded font-mono">[1]</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase" style={{ fontFamily: currentTheme.fontFamily }}>
                    <span>Hombre</span>
                    <span>Mujer</span>
                    <span>Industria</span>
                  </div>
                </div>

                {/* 2. Banner de temporada mockup */}
                <div className="p-3 border-b border-[#DCD4C9]/40 flex items-center justify-between bg-black/5">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#6F6860] block font-bold">
                      Catálogo Gran Mendoza
                    </span>
                    <h5 className="text-base font-bold uppercase tracking-wider" style={{ fontFamily: currentTheme.fontFamily }}>
                      Indumentaria Oficial 2026
                    </h5>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-xs text-[9px] font-bold uppercase tracking-wider ${
                      highlightTarget === 'seasonBadge' ? 'ring-2 ring-[#FDB813]' : ''
                    }`}
                    style={{
                      backgroundColor: currentTheme.seasonBadgeBg || '#18231C',
                      color: currentTheme.seasonBadgeText || '#F5F2EC',
                    }}
                  >
                    [6] Temporada 2026
                  </span>
                </div>

                {/* 3. Product Card Mockup */}
                <div className="p-4">
                  <div
                    className={`rounded-xs border overflow-hidden p-2 transition-all ${
                      highlightTarget === 'card' ? 'ring-2 ring-[#FDB813]' : ''
                    }`}
                    style={{
                      backgroundColor: currentTheme.cardBgColor || '#ECE5DC',
                      borderColor: currentTheme.cardBorderColor || '#DCD4C9',
                    }}
                  >
                    <div className="relative aspect-[4/3] bg-neutral-200 rounded-xs overflow-hidden mb-2">
                      <img
                        src="https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80"
                        alt="Demo Product"
                        className="w-full h-full object-cover"
                      />
                      {/* Badge Temporada */}
                      <span
                        className="absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded-xs text-[8px] font-bold uppercase"
                        style={{
                          backgroundColor: currentTheme.seasonBadgeBg || '#18231C',
                          color: currentTheme.seasonBadgeText || '#F5F2EC',
                        }}
                      >
                        [6] NUEVO
                      </span>

                      {/* Badge Descuento */}
                      <span
                        className={`absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase shadow-xs ${
                          highlightTarget === 'discountBadge' ? 'ring-2 ring-white' : ''
                        }`}
                        style={{
                          backgroundColor: currentTheme.discountBadgeBg || '#FDB813',
                          color: currentTheme.discountBadgeText || '#18231C',
                        }}
                      >
                        [7] -20% OFF
                      </span>
                    </div>

                    {/* Titulo y Precios */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-wider text-[#6F6860] font-bold">
                          PAMPERO URBANO
                        </span>
                        <span className="text-[8px] bg-neutral-200 px-1 py-0.5 rounded font-mono">[5] Tarjeta</span>
                      </div>
                      <h6 className="text-sm font-bold uppercase tracking-wider leading-tight" style={{ fontFamily: currentTheme.fontFamily }}>
                        Campera Softshell Térmica
                      </h6>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-xs text-neutral-400 line-through font-mono">
                          $120.000
                        </span>
                        <span
                          className="text-base font-bold font-mono"
                          style={{ color: currentTheme.accentColor || '#FDB813' }}
                        >
                          $96.000
                        </span>
                        <span 
                          className="text-[8px] font-bold"
                          style={{ color: currentTheme.accentColor || '#FDB813' }}
                        >
                          [3] Acento
                        </span>
                      </div>

                      {/* Boton Agregar */}
                      <button
                        type="button"
                        className="w-full mt-2 py-1.5 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs"
                        style={{
                          backgroundColor: currentTheme.primaryColor || '#18231C',
                          color: currentTheme.buttonTextColor || '#FFFFFF',
                        }}
                      >
                        <span>[2] Agregar a Cotización</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guía Explicativa Rápida */}
              <div className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[11px] text-[#4A453F] space-y-1">
                <strong className="block text-[10px] uppercase tracking-wider text-[#18231C]">
                  ¿Cómo funciona la captura?
                </strong>
                <p>
                  Pasá el mouse por cualquier control de la izquierda para ver qué elemento se ilumina en esta captura. Cuando movés el color, <strong>se actualiza en el momento sin recargar</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
