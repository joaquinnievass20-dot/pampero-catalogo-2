import React, { useState } from 'react';
import { 
  LookbookItem, 
  LookbookHotspot, 
  Product, 
  ThemeConfig 
} from '../types';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Eye, 
  ShoppingBag, 
  Check, 
  ExternalLink,
  Layers,
  Tag
} from 'lucide-react';

interface LookbookViewProps {
  lookbook: LookbookItem[];
  products: Product[];
  theme: ThemeConfig;
  onBackToStore: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export const LookbookView: React.FC<LookbookViewProps> = ({
  lookbook,
  products,
  theme,
  onBackToStore,
  onSelectProduct,
  onAddToCart,
}) => {
  const [activeLookIndex, setActiveLookIndex] = useState<number>(0);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const accent = theme.accentColor || '#FDB813';
  const currentLook = lookbook[activeLookIndex] || lookbook[0];

  // Lookup product for a given hotspot
  const getProductForHotspot = (hotspot: LookbookHotspot): Product | undefined => {
    return products.find(
      (p) => p.id === hotspot.productId || p.code.toLowerCase().trim() === hotspot.productId.toLowerCase().trim()
    );
  };

  const handleNextLook = () => {
    setActiveHotspotId(null);
    setActiveLookIndex((prev) => (prev + 1) % lookbook.length);
  };

  const handlePrevLook = () => {
    setActiveHotspotId(null);
    setActiveLookIndex((prev) => (prev - 1 + lookbook.length) % lookbook.length);
  };

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      setAddedNotice(product.id);
      setTimeout(() => setAddedNotice(null), 2000);
    }
  };

  if (!currentLook) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-neutral-600">No hay looks disponibles en el catálogo interactivo.</p>
        <button
          onClick={onBackToStore}
          className="mt-4 px-6 py-2.5 rounded-xs font-bold text-xs uppercase"
          style={{ backgroundColor: accent, color: '#18231C' }}
        >
          Volver a la tienda
        </button>
      </div>
    );
  }

  // Active hotspot and product if selected
  const activeHotspot = currentLook.hotspots.find((h) => h.id === activeHotspotId);
  const activeProduct = activeHotspot ? getProductForHotspot(activeHotspot) : null;

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F5F2EC] text-[#18231C] pb-16 animate-fadeIn">
      {/* Top Header bar */}
      <div 
        className="border-b border-[#DCD4C9] bg-white py-4 px-4 sm:px-8 shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="btn-lookbook-back-store"
              type="button"
              onClick={onBackToStore}
              className="p-2 rounded-xs border border-[#DCD4C9] hover:bg-[#FAF8F5] transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#18231C] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Tienda</span>
            </button>
            <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-0.5 text-[10px] font-black uppercase rounded-xs tracking-wider"
                  style={{ backgroundColor: accent, color: '#18231C' }}
                >
                  INTERACTIVO
                </span>
                <h1 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-[#18231C] leading-none">
                  Catálogo Interactivo & Lookbook
                </h1>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Hacé clic en los puntos interactivos sobre el equipo para ver cada prenda en detalle.
              </p>
            </div>
          </div>

          {/* Look Switcher Carousel Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {lookbook.map((look, idx) => (
              <button
                key={look.id}
                type="button"
                onClick={() => {
                  setActiveHotspotId(null);
                  setActiveLookIndex(idx);
                }}
                className={`px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                  idx === activeLookIndex
                    ? 'shadow-xs'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                }`}
                style={{
                  backgroundColor: idx === activeLookIndex ? (theme.primaryColor || '#18231C') : undefined,
                  color: idx === activeLookIndex ? (theme.headerTextColor || '#F5F2EC') : undefined,
                  borderColor: idx === activeLookIndex ? accent : undefined,
                }}
              >
                Look #{idx + 1}: {look.title.split('·')[0].trim()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Stage Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left / Center: The Interactive Campaign Canvas */}
          <div className="lg:col-span-8 space-y-3">
            <div className="relative rounded-xs border border-[#DCD4C9] bg-[#18231C] shadow-lg select-none group">
              
              {/* Campaign Image */}
              <div className="relative w-full aspect-[4/5] sm:aspect-[16/11] max-h-[680px] bg-black flex items-center justify-center rounded-xs">
                {/* Background image & vignette cleanly clipped */}
                <div className="absolute inset-0 overflow-hidden rounded-xs pointer-events-none">
                  <img
                    src={currentLook.imageUrl}
                    alt={currentLook.title}
                    className="w-full h-full object-cover object-center"
                  />

                  {/* Dark Vignette Overlay to pop the hotspots */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                </div>

                {/* Top Overlay Badge & Title */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                  <div className="bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xs border border-white/20 text-white max-w-[85%] shadow-md">
                    <span 
                      className="text-[10px] font-black uppercase tracking-widest block"
                      style={{ color: accent }}
                    >
                      {currentLook.season || 'PAMPERO OFICIAL'}
                    </span>
                    <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-wider text-white truncate">
                      {currentLook.title}
                    </h2>
                  </div>

                  {/* Hotspots Counter Pill */}
                  <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xs border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
                    <span>{currentLook.hotspots.length} prendas</span>
                  </div>
                </div>

                {/* Click outside backdrop when a hotspot tooltip is open */}
                {activeHotspotId && (
                  <div 
                    className="absolute inset-0 z-25 cursor-default" 
                    onClick={() => setActiveHotspotId(null)} 
                  />
                )}

                {/* HOTSPOTS INTERACTIVE PINS */}
                {currentLook.hotspots.map((hs, index) => {
                  const product = getProductForHotspot(hs);
                  const isSelected = hs.id === activeHotspotId;
                  const isUpper = hs.y <= 40; // 40% superior de la imagen

                  return (
                    <div
                      key={hs.id}
                      style={{
                        left: `${hs.x}%`,
                        top: `${hs.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute ${isSelected ? 'z-40' : 'z-20'}`}
                    >
                      {/* Interactive Trigger Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveHotspotId(isSelected ? null : hs.id);
                        }}
                        className={`group/pin relative flex items-center justify-center p-2 cursor-pointer transition-transform duration-200 ${
                          isSelected ? 'scale-125' : 'hover:scale-115'
                        }`}
                        title={hs.label || product?.name || 'Prenda interactiva'}
                      >
                        {/* Radar Pulse Effect */}
                        <span
                          className="absolute w-8 h-8 rounded-full opacity-75 animate-ping"
                          style={{ backgroundColor: accent }}
                        />

                        {/* Outer Glow Ring */}
                        <span
                          className={`absolute w-7 h-7 rounded-full shadow-lg border-2 transition-colors ${
                            isSelected ? 'bg-black border-white' : 'bg-[#18231C] border-white/90'
                          }`}
                        />

                        {/* Center Icon/Dot */}
                        <span
                          className="relative z-10 w-3 h-3 rounded-full flex items-center justify-center font-black text-[9px]"
                          style={{ backgroundColor: accent, color: '#18231C' }}
                        >
                          {index + 1}
                        </span>

                        {/* Floating Tooltip Label (Desktop hover preview) */}
                        <span 
                          className={`hidden sm:group-hover/pin:flex absolute ${
                            hs.x > 75 ? 'right-full mr-2' : 'left-full ml-2'
                          } px-2.5 py-1 rounded-xs bg-black/90 text-white text-[11px] font-bold whitespace-nowrap border border-white/20 shadow-xl pointer-events-none items-center gap-1.5 ${
                            isSelected ? '!hidden' : ''
                          }`}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                          {hs.label || product?.name || 'Ver Prenda'}
                        </span>
                      </button>

                      {/* Dynamic Product Detail Tooltip (Renders downwards if y <= 40%, upwards if y > 40%) */}
                      {isSelected && product && (
                        <div 
                          className={`absolute z-50 w-[290px] sm:w-[320px] max-w-[calc(100vw-36px)] bg-white rounded-xs border-2 shadow-2xl p-3 sm:p-4 text-[#18231C] animate-fadeIn cursor-default select-text ${
                            isUpper ? 'top-full mt-2' : 'bottom-full mb-2'
                          } ${
                            hs.x <= 25 
                              ? 'left-0' 
                              : hs.x >= 75 
                              ? 'right-0' 
                              : 'left-1/2 -translate-x-1/2'
                          }`}
                          style={{ borderColor: accent }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={product.image || product.images?.[0]}
                              alt={product.name}
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xs border border-neutral-200 shrink-0 bg-neutral-100"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 truncate">
                                  {product.code}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveHotspotId(null);
                                  }}
                                  className="text-neutral-400 hover:text-neutral-800 text-sm font-bold px-1 cursor-pointer"
                                  title="Cerrar detalle"
                                >
                                  ×
                                </button>
                              </div>
                              <h4 className="font-bold text-xs sm:text-sm text-neutral-900 leading-snug line-clamp-2 mt-0.5">
                                {product.name}
                              </h4>
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className="font-display font-bold text-base text-neutral-900">
                                  ${product.price.toLocaleString('es-AR')}
                                </span>
                                {product.corporatePrice && product.corporatePrice < product.price && (
                                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                                    Mayorista: ${product.corporatePrice.toLocaleString('es-AR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons inside the pin popup */}
                          <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectProduct(product);
                              }}
                              className="flex-1 py-1.5 px-3 rounded-xs font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-opacity cursor-pointer hover:opacity-90"
                              style={{ backgroundColor: accent, color: '#18231C' }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Detalle
                            </button>

                            {onAddToCart && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(product, e)}
                                className="p-1.5 rounded-xs border border-neutral-300 hover:bg-neutral-100 text-neutral-800 transition-colors cursor-pointer"
                                title="Cotizar prenda"
                              >
                                {addedNotice === product.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ShoppingBag className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Carousel Prev/Next Overlay Buttons */}
                <button
                  type="button"
                  onClick={handlePrevLook}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xs bg-black/60 hover:bg-black text-white transition-colors border border-white/20 shadow-lg cursor-pointer"
                  title="Look anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextLook}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xs bg-black/60 hover:bg-black text-white transition-colors border border-white/20 shadow-lg cursor-pointer"
                  title="Siguiente look"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Caption under the image */}
              {currentLook.subtitle && (
                <div className="p-3 bg-white border-t border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
                  <span>{currentLook.subtitle}</span>
                  <span className="text-[11px] font-bold text-neutral-400">
                    {activeLookIndex + 1} de {lookbook.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: All Garments in this Look (Card list for direct click) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xs border border-[#DCD4C9] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCD4C9]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: accent }} />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                    Prendas de este Look ({currentLook.hotspots.length})
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  Toca para abrir
                </span>
              </div>

              {/* List of items */}
              <div className="mt-3 space-y-2.5">
                {currentLook.hotspots.map((hs, index) => {
                  const product = getProductForHotspot(hs);
                  const isSelected = hs.id === activeHotspotId;

                  if (!product) {
                    return (
                      <div key={hs.id} className="p-2 bg-neutral-50 rounded-xs text-xs text-neutral-400">
                        {hs.label || `Prenda #${index + 1}`} (No vinculada)
                      </div>
                    );
                  }

                  return (
                    <div
                      key={hs.id}
                      onClick={() => {
                        setActiveHotspotId(hs.id);
                      }}
                      className={`p-3 rounded-xs border transition-all cursor-pointer flex items-center gap-3 group ${
                        isSelected 
                          ? 'border-2 shadow-sm bg-neutral-50' 
                          : 'border-[#DCD4C9] hover:border-neutral-400 bg-white'
                      }`}
                      style={{
                        borderColor: isSelected ? accent : undefined,
                      }}
                    >
                      {/* Marker Number */}
                      <span 
                        className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0"
                        style={{ 
                          backgroundColor: isSelected ? accent : '#18231C',
                          color: isSelected ? '#18231C' : '#F5F2EC'
                        }}
                      >
                        {index + 1}
                      </span>

                      {/* Product Thumbnail */}
                      <img
                        src={product.image || product.images?.[0]}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-xs border border-neutral-200 shrink-0 bg-neutral-100"
                      />

                      {/* Product Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-neutral-500">
                            {product.code}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-xs bg-neutral-100 text-neutral-600 font-semibold">
                            {product.subCategory || product.section}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#18231C] truncate group-hover:text-amber-600 transition-colors mt-0.5">
                          {product.name}
                        </h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-display font-bold text-sm text-[#18231C]">
                            ${product.price.toLocaleString('es-AR')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProduct(product);
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:underline"
                            style={{ color: accent }}
                          >
                            Ver Ficha
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Call to action */}
              <div className="mt-4 pt-3 border-t border-[#DCD4C9] text-center">
                <button
                  type="button"
                  onClick={onBackToStore}
                  className="w-full py-2.5 rounded-xs font-bold text-xs uppercase tracking-wider border border-[#DCD4C9] hover:bg-[#FAF8F5] transition-colors text-[#18231C] cursor-pointer"
                >
                  Explorar Todo el Catálogo
                </button>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-[#18231C] text-white p-4 rounded-xs border border-black/30 space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" style={{ color: accent }} />
                <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                  Dotaciones & Conjuntos Pampero
                </h4>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Podés pedir cotización mayorista o minorista de cada equipo completo agregando cada una de las prendas al cotizador de Gran Mendoza.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
