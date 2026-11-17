import React, { useState, useRef, useEffect } from 'react';
import {
  Shirt,
  Upload,
  Sparkles,
  RotateCcw,
  MessageCircle,
  Eye,
  Move,
  Maximize2,
  FlipHorizontal,
  Loader2,
  Sliders,
} from 'lucide-react';
import {
  fetchFirestoreStoreConfig,
  fetchFirestoreProducts,
  subscribeToFirestoreSimulatorConfig,
  uploadImageToStorage,
} from '../../services/firebase';
import { Product } from '../../types';
import { getColorHex, getProductImageForColor, getColorCode } from '../../utils/colorUtils';
import { recolorGarmentOnly, stripLogoWhiteBackground } from '../../utils/garmentRecolor';

interface GarmentPreset {
  id: string;
  name: string;
  category: string;
  baseImage: string;
  backImage?: string;
  imagesByColor?: Record<string, string>;
  availableColors: { name: string; hex: string }[];
}

const DEFAULT_GARMENTS: GarmentPreset[] = [
  {
    id: 'chomba',
    name: 'Chomba Pampero Piqué Clásica',
    category: 'Indumentaria Corporativa',
    baseImage: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Azul Marino', hex: '#1B263B' },
      { name: 'Negro', hex: '#1C1C1C' },
      { name: 'Verde Oliva', hex: '#3E4A35' },
      { name: 'Blanco', hex: '#F8F9FA' },
      { name: 'Rojo', hex: '#8B0000' },
    ],
  },
  {
    id: 'camisa',
    name: 'Camisa de Trabajo Pampero Soler',
    category: 'Industria & Laboral',
    baseImage: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Azul Marino', hex: '#1A2938' },
      { name: 'Beige Arena', hex: '#D7C4A5' },
      { name: 'Verde Oliva', hex: '#3C4934' },
      { name: 'Gris Topo', hex: '#585E64' },
    ],
  },
  {
    id: 'campera',
    name: 'Campera Softshell Térmica Pampero',
    category: 'Abrigos Técnicos',
    baseImage: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Azul Marino', hex: '#152238' },
      { name: 'Verde Militar', hex: '#3B4436' },
      { name: 'Bordeaux', hex: '#5E1925' },
    ],
  },
  {
    id: 'chaleco',
    name: 'Chaleco de Seguridad Alta Visibilidad',
    category: 'Seguridad Industrial',
    baseImage: 'https://images.unsplash.com/photo-1578873375972-02656910609f?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Naranja Flúor', hex: '#FF6700' },
      { name: 'Amarillo Flúor', hex: '#E2F700' },
    ],
  },
];

type LogoPosition = 'pecho_izq' | 'pecho_centro' | 'espalda' | 'manga' | 'manual';
type LogoTechnique = 'bordado' | 'estampado';
type GarmentViewSide = 'frente' | 'espalda';

const PRESET_COORDS: Record<Exclude<LogoPosition, 'manual'>, { x: number; y: number; defaultCm: number }> = {
  pecho_izq: { x: 61, y: 34, defaultCm: 9 },
  pecho_centro: { x: 50, y: 36, defaultCm: 14 },
  espalda: { x: 50, y: 31, defaultCm: 24 },
  manga: { x: 24, y: 40, defaultCm: 7 },
};

function isHexLight(hex: string): boolean {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (isNaN(num)) return false;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 175;
}

function detectBackImage(prod: Product, primaryImage: string): string | undefined {
  const explicit = (prod as any).backImage;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }

  const allUrls = [
    ...(Array.isArray(prod.images) ? prod.images : []),
    ...(Array.isArray(prod.imagesMen) ? prod.imagesMen : []),
    ...(Array.isArray(prod.imagesWomen) ? prod.imagesWomen : []),
  ].filter((u): u is string => Boolean(u && u.trim() && u.trim() !== primaryImage));

  // 1. Buscar etiqueta explícita de espalda o posición #2 Pampero
  const namedBack = allUrls.find((u) => {
    const lower = u.toLowerCase();
    return (
      lower.includes('espalda') ||
      lower.includes('back') ||
      lower.includes('dorso') ||
      lower.includes('atras') ||
      lower.includes('reverso') ||
      /[#%_]2\.(jpg|jpeg|png|webp)/i.test(u) ||
      /%232\./i.test(u)
    );
  });
  if (namedBack) return namedBack;

  // 2. Fallback: segunda imagen de galería si existe
  if (allUrls.length > 0) {
    return allUrls[0];
  }
  return undefined;
}

export const CRMUniformSimulatorTab: React.FC = () => {
  const [garmentsList, setGarmentsList] = useState<GarmentPreset[]>(DEFAULT_GARMENTS);
  const [selectedGarment, setSelectedGarment] = useState<GarmentPreset>(DEFAULT_GARMENTS[0]);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null); // null = Color original de la foto
  const [viewSide, setViewSide] = useState<GarmentViewSide>('frente');

  // Logo estado & ajustes
  const [rawLogoUrl, setRawLogoUrl] = useState<string | null>(null);
  const [cleanLogoUrl, setCleanLogoUrl] = useState<string | null>(null);
  const [stripWhiteBg, setStripWhiteBg] = useState(true);
  const [logoAspectRatio, setLogoAspectRatio] = useState(1.6);
  const [logoName, setLogoName] = useState<string>('');
  const [technique, setTechnique] = useState<LogoTechnique>('bordado');
  const [position, setPosition] = useState<LogoPosition>('pecho_izq');

  // Tamaño real en cm y posicionamiento libre X/Y (%) + rotación
  const [logoWidthCm, setLogoWidthCm] = useState<number>(9);
  const [logoCoords, setLogoCoords] = useState<{ x: number; y: number }>({ x: 61, y: 34 });
  const [logoRotation, setLogoRotation] = useState<number>(0);
  const [logoOpacity, setLogoOpacity] = useState<number>(95);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  // Recolor canvas cache
  const [recoloredImageUrl, setRecoloredImageUrl] = useState<string | null>(null);
  const [isRecoloring, setIsRecoloring] = useState(false);
  const recolorCacheRef = useRef<Map<string, string>>(new Map());

  const [companyName, setCompanyName] = useState('');
  const [estimatedQuantity, setEstimatedQuantity] = useState('30');
  const previewRef = useRef<HTMLDivElement>(null);

  // Load configured articles and custom garments from Firestore and localStorage
  useEffect(() => {
    const loadDynamicGarments = async () => {
      try {
        let storeConfig: any = null;
        try {
          const raw = localStorage.getItem('pampero_simulator_config');
          if (raw) storeConfig = JSON.parse(raw);
        } catch {}

        if (!storeConfig) {
          const remote = await fetchFirestoreStoreConfig();
          if (remote?.simulatorConfig) storeConfig = remote.simulatorConfig;
        }

        let catalogProducts: Product[] = [];
        try {
          const rawProds = localStorage.getItem('pampero_catalog_products');
          if (rawProds) catalogProducts = JSON.parse(rawProds);
        } catch {}

        if (catalogProducts.length === 0) {
          const remoteProds = await fetchFirestoreProducts();
          if (remoteProds) catalogProducts = remoteProds;
        }

        const enabledIds: string[] = storeConfig?.enabledProductIds || [];
        const customGarments: any[] = storeConfig?.customGarments || [];

        const dynamicItems: GarmentPreset[] = [];

        // 1. Add enabled catalog products
        if (enabledIds.length > 0 && catalogProducts.length > 0) {
          enabledIds.forEach((id) => {
            const prod = catalogProducts.find((p) => p.id === id || p.code === id);
            if (prod) {
              const image = prod.image || (prod.images && prod.images[0]);
              if (image) {
                const rawColors =
                  prod.availableColors && prod.availableColors.length > 0
                    ? prod.availableColors
                    : (prod as any).colors ||
                      ((prod as any).variants
                        ? ((prod as any).variants as any[]).map((v) => v.color).filter(Boolean)
                        : []);

                const colors =
                  Array.isArray(rawColors) && rawColors.length > 0
                    ? rawColors.map((c: string) => ({
                        name: String(c),
                        hex: getColorHex(String(c)),
                      }))
                    : [
                        { name: 'Azul Marino', hex: '#1B263B' },
                        { name: 'Negro', hex: '#1C1C1C' },
                        { name: 'Verde Oliva', hex: '#3E4A35' },
                        { name: 'Blanco', hex: '#F8F9FA' },
                      ];

                dynamicItems.push({
                  id: prod.id || prod.code,
                  name: prod.name,
                  category: prod.category || 'Indumentaria Oficial',
                  baseImage: image,
                  backImage: detectBackImage(prod, image),
                  imagesByColor: prod.imagesByColor,
                  availableColors: colors,
                });
              }
            }
          });
        }

        // 2. Add custom uploaded garments
        if (customGarments.length > 0) {
          customGarments.forEach((cg) => {
            dynamicItems.push({
              id: cg.id,
              name: cg.name,
              category: cg.category,
              baseImage: cg.baseImage,
              backImage: cg.backImage,
              availableColors: cg.availableColors || [{ name: 'Estándar', hex: '#1C1C1C' }],
            });
          });
        }

        if (dynamicItems.length > 0) {
          setGarmentsList(dynamicItems);
          setSelectedGarment(dynamicItems[0]);
          setSelectedColor(null);
        }
      } catch (err) {
        console.warn('[SIMULATOR] Error cargando prendas configuradas:', err);
      }
    };

    loadDynamicGarments();

    const unsub = subscribeToFirestoreSimulatorConfig((remoteCfg) => {
      if (remoteCfg) {
        try {
          localStorage.setItem('pampero_simulator_config', JSON.stringify(remoteCfg));
          loadDynamicGarments();
        } catch {}
      }
    });

    return () => unsub();
  }, []);

  // Determinar qué imagen fuente mostrar según vista (frente/espalda) y color real si existe en imagesByColor
  const colorSpecificImage = (() => {
    if (!selectedColor || !selectedGarment.imagesByColor || viewSide === 'espalda') return null;
    const fakeProd = {
      image: '',
      imagesByColor: selectedGarment.imagesByColor,
    } as Product;
    const matched = getProductImageForColor(fakeProd, selectedColor.name);
    if (matched) return matched;
    const code = getColorCode(selectedColor.name);
    if (code && selectedGarment.imagesByColor[code]) return selectedGarment.imagesByColor[code];
    return null;
  })();

  const activeRawImage =
    viewSide === 'espalda'
      ? selectedGarment.backImage || selectedGarment.baseImage
      : colorSpecificImage || selectedGarment.baseImage;

  const isUsingFallbackForBack = viewSide === 'espalda' && !selectedGarment.backImage;

  // Ejecutar teñido exclusivo de la prenda en Canvas cuando se elige un color sin foto propia
  useEffect(() => {
    let cancelled = false;

    if (!selectedColor || colorSpecificImage || !activeRawImage) {
      setRecoloredImageUrl(null);
      setIsRecoloring(false);
      return;
    }

    const cacheKey = `${activeRawImage}__${selectedColor.hex}`;
    const cached = recolorCacheRef.current.get(cacheKey);
    if (cached) {
      setRecoloredImageUrl(cached);
      setIsRecoloring(false);
      return;
    }

    setIsRecoloring(true);
    recolorGarmentOnly(activeRawImage, selectedColor.hex, {
      preserveSkin: true,
      bgTolerance: 30,
    })
      .then((res) => {
        if (cancelled) return;
        if (res) {
          recolorCacheRef.current.set(cacheKey, res);
          setRecoloredImageUrl(res);
        } else {
          setRecoloredImageUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsRecoloring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRawImage, selectedColor, colorSpecificImage]);

  // Procesar logo cargado: detectar proporciones reales y limpiar fondo blanco si se habilitó
  useEffect(() => {
    let cancelled = false;
    if (!rawLogoUrl) {
      setCleanLogoUrl(null);
      return;
    }

    const measureNatural = () => {
      const img = new Image();
      if (!rawLogoUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled && img.naturalWidth && img.naturalHeight) {
          setLogoAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = rawLogoUrl;
    };

    if (!stripWhiteBg) {
      setCleanLogoUrl(rawLogoUrl);
      measureNatural();
      return;
    }

    stripLogoWhiteBackground(rawLogoUrl).then((res) => {
      if (cancelled) return;
      if (res) {
        setCleanLogoUrl(res.cleanDataUrl);
        setLogoAspectRatio(res.aspectRatio);
      } else {
        setCleanLogoUrl(rawLogoUrl);
        measureNatural();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rawLogoUrl, stripWhiteBg]);

  // File upload handler para el logo del cliente (soporta dataURL inmediato para edición fluida + Storage)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoName(file.name);

    // Leer primero como DataURL local para preservar dimensiones y quitar fondo blanco sin bloqueo CORS
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) setRawLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);

    // También respaldar en Storage en segundo plano si aplica
    try {
      await uploadImageToStorage(file, 'simulator-logos');
    } catch (err) {
      console.warn('[SIMULATOR] Respaldo local activo para logo:', err);
    }
  };

  const handleUseSampleLogo = () => {
    setRawLogoUrl('/logo-oficial.png.png');
    setLogoName('Logo Pampero Oficial');
  };

  // Cambiar ubicación preestablecida + cambiar automáticamente a frente/espalda si hay foto
  const handleSelectPosition = (nextPos: LogoPosition) => {
    setPosition(nextPos);
    if (nextPos === 'espalda') {
      setViewSide('espalda');
    } else if (nextPos !== 'manual') {
      setViewSide('frente');
    }

    if (nextPos !== 'manual') {
      const preset = PRESET_COORDS[nextPos];
      setLogoCoords({ x: preset.x, y: preset.y });
      setLogoWidthCm(preset.defaultCm);
    }
  };

  // Arrastre manual directo sobre la prenda (Pointer Events)
  const updateCoordsFromPointer = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const xPct = Math.min(92, Math.max(8, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(92, Math.max(8, ((clientY - rect.top) / rect.height) * 100));
    setLogoCoords({
      x: Math.round(xPct * 10) / 10,
      y: Math.round(yPct * 10) / 10,
    });
    setPosition('manual');
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeLogoUrl) return;
    setIsDraggingLogo(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    updateCoordsFromPointer(e.clientX, e.clientY);
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingLogo) return;
    updateCoordsFromPointer(e.clientX, e.clientY);
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingLogo) return;
    setIsDraggingLogo(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const activeLogoUrl = cleanLogoUrl || rawLogoUrl;
  const displayedGarmentImage = recoloredImageUrl || activeRawImage || '/logo.png';

  // Escala proporcional realista: torso promedio ~50 cm equivale al 100% del marco de prenda
  const widthPercent = Math.min(68, Math.max(7, (logoWidthCm / 48) * 100));
  const calculatedHeightCm = Math.round((logoWidthCm / Math.max(0.2, logoAspectRatio)) * 10) / 10;

  // Modo de integración del logo según claridad de la tela elegida
  const isLightGarment = selectedColor ? isHexLight(selectedColor.hex) : false;

  const positionLabel =
    position === 'pecho_izq'
      ? 'Pecho Izquierdo'
      : position === 'pecho_centro'
      ? 'Pecho Centro'
      : position === 'espalda'
      ? 'Espalda'
      : position === 'manga'
      ? 'Manga'
      : `Posición Manual (${viewSide === 'espalda' ? 'Espalda' : 'Frente'} · X:${Math.round(logoCoords.x)}% Y:${Math.round(logoCoords.y)}%)`;

  const handleRequestQuote = () => {
    const text = encodeURIComponent(
      `Hola Pampero Gran Mendoza! Vengo del Armador de Uniformes Virtual con un diseño corporativo.\n\n` +
        `• Empresa: ${companyName.trim() || 'Mi Empresa'}\n` +
        `• Prenda: ${selectedGarment.name}\n` +
        `• Color: ${selectedColor ? selectedColor.name : 'Color Original de Muestra'}\n` +
        `• Aplicación: ${technique === 'bordado' ? 'Bordado Computarizado' : 'Estampado Transfer HD'}\n` +
        `• Ubicación: ${positionLabel}\n` +
        `• Medida del Logo: ${logoWidthCm} cm ancho × ${calculatedHeightCm} cm alto\n` +
        `• Cantidad estimada: ${estimatedQuantity} prendas\n\n` +
        `¿Podrían cotizarme con matriz de bordado incluida?`
    );
    window.open(`https://wa.me/5492615276713?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#B9522F]" />
            Armador de Uniformes Virtual (Simulador de Bordado)
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Subí el logo de tu empresa, elegí color real de tela, medilo en centímetros y arrastralo directo sobre la prenda (frente o espalda).
          </p>
        </div>

        <button
          onClick={handleRequestQuote}
          className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          Cotizar este Uniforme por WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Mockup Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col items-center justify-center">
          <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#ECE5DC] text-xs">
            <div className="flex items-center gap-2 font-bold text-[#18231C]">
              <Eye className="w-4 h-4 text-[#B9522F]" />
              <span className="truncate max-w-[240px] sm:max-w-xs">{selectedGarment.name}</span>
            </div>

            {/* Selector Vista Frente / Espalda */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-xs border border-[#DCD4C9]">
              <button
                type="button"
                onClick={() => {
                  setViewSide('frente');
                  if (position === 'espalda') handleSelectPosition('pecho_izq');
                }}
                className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                  viewSide === 'frente'
                    ? 'bg-[#18231C] text-white'
                    : 'text-[#6F6860] hover:text-[#18231C]'
                }`}
              >
                Frente
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewSide('espalda');
                  if (position !== 'espalda' && position !== 'manual') {
                    setPosition('espalda');
                    setLogoCoords({ x: PRESET_COORDS.espalda.x, y: PRESET_COORDS.espalda.y });
                    setLogoWidthCm(PRESET_COORDS.espalda.defaultCm);
                  }
                }}
                className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${
                  viewSide === 'espalda'
                    ? 'bg-[#18231C] text-white'
                    : 'text-[#6F6860] hover:text-[#18231C]'
                }`}
              >
                <FlipHorizontal className="w-3 h-3" />
                Espalda
                {selectedGarment.backImage && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Foto de espalda disponible" />
                )}
              </button>
            </div>
          </div>

          {isUsingFallbackForBack && (
            <div className="w-full mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xs text-[11px] text-amber-900 flex items-center justify-between gap-2">
              <span>
                Esta prenda aún no tiene cargada una foto trasera exclusiva (se muestra la vista principal como referencia).
              </span>
            </div>
          )}

          {/* Interactive Garment & Logo Viewport (Drag & Drop directo) */}
          <div
            ref={previewRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            className={`relative w-full max-w-md aspect-square bg-white rounded-xs overflow-hidden border border-[#DCD4C9] shadow-inner flex items-center justify-center select-none touch-none ${
              activeLogoUrl ? 'cursor-crosshair' : ''
            }`}
          >
            {/* Base / Recolored Garment Photo */}
            <img
              src={displayedGarmentImage}
              alt={selectedGarment.name}
              draggable={false}
              className="w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200"
              onError={(e) => {
                e.currentTarget.src = '/logo.png';
              }}
            />

            {isRecoloring && (
              <div className="absolute top-2.5 left-2.5 z-30 bg-black/75 text-white px-2.5 py-1 rounded-xs text-[10px] font-bold flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-[#FDB813]" />
                Aplicando color a la tela...
              </div>
            )}

            {/* Overlaid Logo integrado en la tela y arrastrable */}
            {activeLogoUrl && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleViewportPointerDown(e);
                }}
                className={`absolute z-20 cursor-grab active:cursor-grabbing ${
                  isDraggingLogo ? 'ring-1 ring-[#FDB813]/80 rounded-xs' : 'transition-[left,top,width,transform] duration-150'
                }`}
                style={{
                  top: `${logoCoords.y}%`,
                  left: `${logoCoords.x}%`,
                  width: `${widthPercent}%`,
                  transform: `translate(-50%, -50%) rotate(${logoRotation}deg)`,
                }}
              >
                <div
                  className="relative w-full"
                  style={{
                    opacity: logoOpacity / 100,
                    mixBlendMode: isLightGarment ? 'multiply' : 'normal',
                    filter:
                      technique === 'bordado'
                        ? 'contrast(1.06) saturate(1.12) drop-shadow(0px 1px 1.5px rgba(0,0,0,0.45))'
                        : 'contrast(1.03) drop-shadow(0px 0.5px 1px rgba(0,0,0,0.28))',
                  }}
                >
                  <img
                    src={activeLogoUrl}
                    alt="Logo Empresa"
                    draggable={false}
                    className="w-full h-auto object-contain block pointer-events-none select-none"
                  />
                  {technique === 'bordado' && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 3px)',
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {!activeLogoUrl && (
              <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/65 backdrop-blur-xs text-white p-4 rounded-xs text-center max-w-[210px] pointer-events-none">
                <Upload className="w-6 h-6 mx-auto mb-1.5 text-amber-400" />
                <p className="text-xs font-bold uppercase">Subí tu logo</p>
                <p className="text-[10px] text-white/80 mt-0.5">para verlo aplicado en la prenda</p>
              </div>
            )}

            {/* Drag hint badge */}
            {activeLogoUrl && (
              <div className="absolute bottom-2.5 left-2.5 z-30 bg-black/65 backdrop-blur-xs text-white px-2 py-0.5 rounded-xs text-[10px] font-semibold flex items-center gap-1 pointer-events-none">
                <Move className="w-3 h-3 text-[#FDB813]" />
                <span>Arrastrá el logo con el mouse o dedo</span>
              </div>
            )}

            {/* Color badge */}
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/65 backdrop-blur-xs text-white px-2 py-0.5 rounded-xs text-[9px] font-bold tracking-wider uppercase pointer-events-none flex items-center gap-1.5">
              {selectedColor && (
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/50"
                  style={{ backgroundColor: selectedColor.hex }}
                />
              )}
              <span>{selectedColor ? selectedColor.name : 'Foto Original'}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 w-full text-xs text-[#6F6860] px-1">
            <span>
              Técnica: <strong className="text-[#18231C] uppercase">{technique === 'bordado' ? 'Bordado' : 'Transfer HD'}</strong>
            </span>
            <span>
              Medida: <strong className="text-[#18231C] font-mono">{logoWidthCm} × {calculatedHeightCm} cm</strong>
            </span>
            <span>
              Vista: <strong className="text-[#18231C] uppercase">{viewSide}</strong>
            </span>
          </div>
        </div>

        {/* Right Column: Controls & Configuration (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-5">
          {/* 1. Empresa y Cantidad */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              1. Datos de la Empresa
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nombre de la Empresa"
                  className="w-full px-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-[#FAF8F5]"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={estimatedQuantity}
                  onChange={(e) => setEstimatedQuantity(e.target.value)}
                  placeholder="Prendas"
                  title="Cantidad estimada de uniformes"
                  className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-[#FAF8F5]"
                />
              </div>
            </div>
          </div>

          {/* 2. Subir Logo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                2. Subir Logo de la Empresa
              </h4>
              <button
                type="button"
                onClick={handleUseSampleLogo}
                className="text-[10px] font-bold text-[#B9522F] hover:underline cursor-pointer"
              >
                Usar Logo de Prueba
              </button>
            </div>

            <label className="border-2 border-dashed border-[#DCD4C9] hover:border-[#B9522F] rounded-xs p-3 flex flex-col items-center justify-center cursor-pointer bg-[#FAF8F5] transition-colors">
              <Upload className="w-5 h-5 text-[#8C827A] mb-1" />
              <span className="text-xs font-bold text-[#18231C] truncate max-w-full">
                {logoName ? logoName : 'Hacé clic para cargar logo (PNG o JPG)'}
              </span>
              <span className="text-[10px] text-[#6F6860] mt-0.5">
                Ajusta tamaño e integra sobre la tela automáticamente
              </span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>

            {rawLogoUrl && (
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#18231C] cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={stripWhiteBg}
                  onChange={(e) => setStripWhiteBg(e.target.checked)}
                  className="accent-[#B9522F]"
                />
                <span>Quitar fondo blanco del logo para integrarlo a la tela</span>
              </label>
            )}
          </div>

          {/* 3. Selección de Prenda */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              3. Tipo de Prenda
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
              {garmentsList.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedGarment(g);
                    setSelectedColor(null);
                    setViewSide('frente');
                  }}
                  className={`p-2.5 rounded-xs border text-left text-xs transition-all cursor-pointer ${
                    selectedGarment.id === g.id
                      ? 'border-[#B9522F] bg-[#B9522F]/10 font-bold text-[#18231C]'
                      : 'border-[#DCD4C9] hover:border-[#18231C] text-[#6F6860]'
                  }`}
                >
                  <p className="truncate font-semibold text-[#18231C]">{g.name}</p>
                  <p className="text-[10px] text-[#8C827A] truncate">
                    {g.category}
                    {g.backImage ? ' · Frente/Espalda' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Color Real de la Prenda (sin filtro sobre toda la foto) */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              4. Color de Tela (Solo Prenda)
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedColor(null)}
                className={`px-2.5 py-1 rounded-xs border text-xs cursor-pointer ${
                  selectedColor === null
                    ? 'border-[#18231C] bg-[#18231C] text-white font-bold'
                    : 'border-[#DCD4C9] bg-white text-[#18231C] hover:bg-[#FAF8F5]'
                }`}
              >
                Original
              </button>
              {selectedGarment.availableColors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-xs cursor-pointer ${
                    selectedColor?.name === c.name
                      ? 'border-[#18231C] bg-[#18231C] text-white font-bold'
                      : 'border-[#DCD4C9] bg-white text-[#18231C] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Ubicación (Prestablecida o Manual) y Técnica */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1.5">
                5. Ubicación
              </h4>
              <select
                value={position}
                onChange={(e) => handleSelectPosition(e.target.value as LogoPosition)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C]"
              >
                <option value="pecho_izq">Pecho Izquierdo</option>
                <option value="pecho_centro">Pecho Centro</option>
                <option value="espalda">Espalda Superior</option>
                <option value="manga">Manga</option>
                <option value="manual">Posición Manual (Arrastre)</option>
              </select>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1.5">
                6. Técnica
              </h4>
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value as LogoTechnique)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C]"
              >
                <option value="bordado">Bordado Computarizado</option>
                <option value="estampado">Estampado Transfer HD</option>
              </select>
            </div>
          </div>

          {/* 7. Tamaño del Logo en cm (input numérico + slider según proporción del logo) */}
          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-[#B9522F]" />
                7. Tamaño del Logo (cm)
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={3}
                  max={34}
                  step={0.5}
                  value={logoWidthCm}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setLogoWidthCm(Math.min(34, Math.max(3, v)));
                  }}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold text-center border border-[#DCD4C9] rounded-xs bg-white text-[#18231C]"
                />
                <span className="text-[11px] font-mono text-[#6F6860]">cm ancho</span>
              </div>
            </div>

            <input
              type="range"
              min={3}
              max={34}
              step={0.5}
              value={logoWidthCm}
              onChange={(e) => setLogoWidthCm(Number(e.target.value))}
              className="w-full accent-[#B9522F] cursor-pointer"
            />

            <div className="flex items-center justify-between text-[10px] text-[#6F6860]">
              <span>Proporción imagen: {calculatedHeightCm} cm de alto estimado</span>
              <span>Estándar bolsillo: 8–10 cm</span>
            </div>

            {/* Ajuste fino manual de ángulo / integración */}
            <div className="pt-2 border-t border-[#ECE5DC] grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-[#4A453F] mb-1">
                  <span>Inclinación / Ángulo</span>
                  <span className="font-mono">{logoRotation}°</span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  value={logoRotation}
                  onChange={(e) => setLogoRotation(Number(e.target.value))}
                  className="w-full accent-[#18231C] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-[#4A453F] mb-1">
                  <span>Integración Tela</span>
                  <span className="font-mono">{logoOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={65}
                  max={100}
                  value={logoOpacity}
                  onChange={(e) => setLogoOpacity(Number(e.target.value))}
                  className="w-full accent-[#18231C] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setLogoRotation(0);
                  setLogoOpacity(95);
                  handleSelectPosition(position === 'manual' ? 'pecho_izq' : position);
                }}
                className="text-[10px] font-bold text-[#6F6860] hover:text-[#18231C] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restablecer posición y ángulo
              </button>
            </div>
          </div>

          {/* WhatsApp CTA Action */}
          <div className="pt-3 border-t border-[#ECE5DC]">
            <button
              onClick={handleRequestQuote}
              className="w-full py-2.5 bg-[#18231C] hover:bg-black text-white font-bold uppercase tracking-wider text-xs rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366] fill-current" />
              Solicitar Cotización con este Diseño
            </button>
            <p className="text-[10px] text-center text-[#8C827A] mt-2">
              Se enviará la configuración detallada a nuestro equipo de ventas en Gran Mendoza.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
