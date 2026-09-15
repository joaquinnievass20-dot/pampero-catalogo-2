import React, { useState, useEffect } from 'react';
import { Product, UserSession, ThemeConfig } from '../types';
import { ArrowLeft, MessageCircle, ShoppingBag, Check, Building2, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { getColorHex, getColorCode, getProductImageForColor, recordProductInteraction } from '../utils/colorUtils';

interface ProductDetailViewProps {
  product: Product;
  userSession: UserSession | null;
  theme: ThemeConfig;
  onBack?: () => void;
  onBackToCatalog?: () => void;
  onAddToCart: (product: Product, selectedColor?: string, selectedSize?: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  userSession,
  theme,
  onBack,
  onBackToCatalog,
  onAddToCart,
}) => {
  const handleBack = onBackToCatalog || onBack || (() => {});
  const colors = product.availableColors || ['Negro', 'Azul trabajo', 'Arena'];
  const sizes = product.availableSizes || ['S', 'M', 'L', 'XL', 'XXL'];

  const [selectedColor, setSelectedColor] = useState<string>(colors[0] || '');
  const [selectedSize, setSelectedSize] = useState<string>(sizes[0] || '');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Collect all product images for gallery/carousel
  const allImages: string[] = [
    ...(Array.isArray(product.images) && product.images.length > 0 ? product.images : []),
    product.image
  ].filter((url, index, self): url is string => Boolean(url) && self.indexOf(url) === index);

  // Update active image if color changes and matches a color-specific image
  useEffect(() => {
    const colorImg = getProductImageForColor(product, selectedColor);
    const foundIdx = allImages.findIndex(img => img === colorImg);
    if (foundIdx !== -1) {
      setActiveImageIndex(foundIdx);
    }
  }, [selectedColor, product]);

  // Record view/click interaction
  useEffect(() => {
    if (product) {
      recordProductInteraction(product, 'click');
    }
  }, [product]);

  const isCompany = userSession?.clientType === 'empresa';
  const basePrice = isCompany && product.corporatePrice ? product.corporatePrice : product.price;
  const hasDiscount = Boolean(product.discountPercentage && product.discountPercentage > 0);
  const discountedPrice = hasDiscount
    ? Math.round(basePrice * (1 - (product.discountPercentage || 0) / 100))
    : basePrice;

  const accent = theme.accentColor || '#FDB813';
  const displayedImage = allImages[activeImageIndex] || getProductImageForColor(product, selectedColor);

  const handleAddToCart = () => {
    onAddToCart(product, selectedColor, selectedSize);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1800);
  };

  const whatsappMessage = encodeURIComponent(
    `Hola Pampero Gran Mendoza, quisiera consultar disponibilidad del producto ${product.name} (Código: ${product.code}), en color ${selectedColor} y talle ${selectedSize}.`
  );

  return (
    <div className="min-h-screen bg-[#F5F2EC] text-[#22201D] font-sans pb-16">
      {/* 1. Micro Announcement */}
      <div 
        className="text-[#F5F2EC] text-[11px] py-1.5 px-4 text-center uppercase tracking-[0.35em] font-medium border-b border-black select-none"
        style={{ backgroundColor: theme.primaryColor || '#18231C' }}
      >
        CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back Button matching Screenshot 4 */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] font-bold text-[#6F6860] hover:text-[#18231C] transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          VOLVER AL CATÁLOGO
        </button>

        {/* 2-Column Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          
          {/* Left Column: Big Product Image & Carousel Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-square w-full rounded-xs bg-[#ECE5DC] border border-[#DCD4C9] overflow-hidden shadow-xs group">
              <img
                src={displayedImage}
                alt={`${product.name} - ${selectedColor}`}
                className="w-full h-full object-cover transition-opacity duration-300"
                referrerPolicy="no-referrer"
              />

              {/* Carousel navigation arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#18231C] hover:bg-white hover:scale-110 transition-all cursor-pointer z-10"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#18231C] hover:bg-white hover:scale-110 transition-all cursor-pointer z-10"
                    aria-label="Foto siguiente"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Photo counter */}
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-full z-10">
                    {activeImageIndex + 1} / {allImages.length}
                  </div>
                </>
              )}

              {hasDiscount && !allImages.length && (
                <span 
                  style={{ 
                    backgroundColor: theme.discountBadgeBg || accent,
                    color: theme.discountBadgeText || '#FFFFFF' 
                  }}
                  className="absolute top-4 right-4 rounded-xs px-2.5 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-xs"
                >
                  -{product.discountPercentage}%
                </span>
              )}

              {product.promotionTag && (
                <span 
                  style={{ 
                    backgroundColor: theme.seasonBadgeBg || '#18231C',
                    color: theme.seasonBadgeText || '#F5F2EC' 
                  }}
                  className="absolute top-4 left-4 rounded-xs px-2.5 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-xs"
                >
                  {product.promotionTag}
                </span>
              )}

              {/* Current Color Overlay Tag */}
              {selectedColor && (
                <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-xs flex items-center gap-1.5 font-mono">
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-white/40" 
                    style={{ backgroundColor: getColorHex(selectedColor) }} 
                  />
                  <span>{selectedColor}</span>
                  {getColorCode(selectedColor) && (
                    <span className="opacity-70 text-[9px]">({getColorCode(selectedColor)})</span>
                  )}
                </div>
              )}
            </div>

            {/* Thumbnail Strip Gallery */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {allImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    style={{
                      borderColor: activeImageIndex === idx ? (theme.primaryColor || '#18231C') : '#DCD4C9'
                    }}
                    className={`w-16 h-16 rounded-xs border-2 overflow-hidden flex-shrink-0 transition-all cursor-pointer bg-neutral-100 ${
                      activeImageIndex === idx 
                        ? 'ring-2 ring-black/20 scale-105 opacity-100 shadow-sm' 
                        : 'opacity-70 hover:opacity-100 hover:border-neutral-500'
                    }`}
                  >
                    <img 
                      src={imgUrl} 
                      alt={`Miniatura ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Information & Options */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Category / Line */}
            <div>
              <p 
                style={{ color: accent }}
                className="text-[11px] uppercase tracking-[0.3em] font-bold"
              >
                {product.section} · {product.subCategory}
              </p>

              {/* Title in Bebas Neue */}
              <h1 className="mt-2 font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-[0.04em] text-[#18231C] uppercase font-bold">
                {product.name}
              </h1>

              {/* Code */}
              <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#6F6860] font-semibold">
                CÓDIGO {product.code}
              </p>
            </div>

            {/* Price Line */}
            <div className="flex items-baseline gap-3 pt-1 border-t border-[#DCD4C9]/60">
              <span className="font-sans text-3xl sm:text-4xl font-bold text-[#18231C]">
                $ {discountedPrice.toLocaleString('es-AR')}
              </span>

              {hasDiscount && (
                <span className="text-base text-[#6F6860] line-through font-medium">
                  $ {basePrice.toLocaleString('es-AR')}
                </span>
              )}

              {hasDiscount && (
                <span 
                  style={{ backgroundColor: accent }}
                  className="rounded-xs px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider"
                >
                  -{product.discountPercentage}%
                </span>
              )}

              {isCompany && (
                <span 
                  style={{ color: accent }}
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" /> Precio Corporativo
                </span>
              )}
            </div>

            {/* COLOR Selection with Swatches & Codes */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                  COLOR: <span className="text-neutral-900 font-extrabold">{selectedColor}</span>
                </label>
                {getColorCode(selectedColor) && (
                  <span className="text-[11px] font-mono font-bold text-neutral-500 bg-neutral-200/70 px-2 py-0.5 rounded-xs">
                    Art. {getColorCode(selectedColor)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((color) => {
                  const isSelected = selectedColor === color;
                  const hex = getColorHex(color);
                  const code = getColorCode(color);
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      style={{
                        borderColor: isSelected ? (theme.primaryColor || '#18231C') : '#DCD4C9',
                      }}
                      className={`px-3 py-2 text-xs uppercase tracking-[0.12em] font-semibold rounded-xs border transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#18231C] text-white shadow-xs ring-1 ring-[#18231C]'
                          : 'bg-white text-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0" 
                        style={{ backgroundColor: hex }} 
                      />
                      <span>{color}</span>
                      {code && (
                        <span className="text-[10px] font-mono text-neutral-400 font-normal">
                          [{code}]
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TALLE Selection */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-2.5">
                TALLE
              </label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      style={{
                        borderColor: isSelected ? (theme.primaryColor || '#18231C') : '#DCD4C9',
                        backgroundColor: isSelected ? (theme.primaryColor || '#18231C') : '#FFFFFF',
                        color: isSelected ? '#F5F2EC' : '#18231C',
                      }}
                      className="min-w-[44px] h-[40px] px-3 flex items-center justify-center text-xs uppercase tracking-[0.15em] font-bold rounded-xs border transition-all cursor-pointer shadow-2xs"
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="text-xs sm:text-sm text-[#544E47] leading-relaxed pt-2">
              <p>
                {product.description ||
                  'Prenda de catálogo Pampero confeccionada bajo estrictas normas de durabilidad y confort. Telas resistentes al desgarro, costuras dobles y triples de seguridad, apta para labor rural, industria y uso urbano diario.'}
              </p>
            </div>

            {/* Notice Box */}
            <div className="p-3.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-xs text-[#6F6860] leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
              <span>
                Catálogo de exhibición oficial: no se procesan cobros en línea. Consultá disponibilidad inmediata por WhatsApp o en nuestros locales de Gran Mendoza.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {/* WhatsApp consultation button */}
              <a
                href={`https://wa.me/${theme.whatsappNumber || '5492615276713'}?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                style={{ backgroundColor: accent }}
                className="w-full flex items-center justify-center gap-2 rounded-xs px-6 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-white transition-all shadow-sm hover:brightness-110 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>CONSULTAR POR WHATSAPP</span>
              </a>

              {/* Add to quote bag button */}
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full flex items-center justify-center gap-2 rounded-xs border border-[#18231C] bg-transparent hover:bg-[#18231C] text-[#18231C] hover:text-[#F5F2EC] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.25em] transition-all cursor-pointer"
              >
                {addedAnimation ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>¡AGREGADO A LA COTIZACIÓN!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>AGREGAR A MI LISTA DE COTIZACIÓN</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
