import React, { useState, useMemo, useEffect } from 'react';
import { Product, UserSession, ThemeConfig, Promotion, SpecialSizeRange } from '../types';
import { 
  X, 
  Check, 
  MessageCircle, 
  ShieldCheck, 
  Ruler, 
  Truck, 
  Plus, 
  Minus, 
  Tag, 
  Building2,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getProductImageForColor, getAllImagesForColor, getColorHex, getColorCode } from '../utils/colorUtils';
import { findSpecialRangeForSize, resolveSpecialRangeSizes, normalizeSpecialSuffix } from '../utils/sizeUtils';
import { getProductActivePromotion } from '../utils/promoUtils';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  userSession: UserSession | null;
  theme: ThemeConfig;
  promotions?: Promotion[];
  onAddToCart: (
    product: Product,
    quantity: number,
    color?: string,
    size?: string,
    specialRange?: SpecialSizeRange,
    adjustedPrice?: number,
    codeWithSuffix?: string
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  userSession,
  theme,
  promotions,
  onAddToCart,
}) => {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSelectedColor(product.availableColors?.[0] || '');
    setSelectedSize(product.availableSizes?.[0] || '');
    setSelectedImageIndex(0);
    setQuantity(1);
  }, [product?.id]);

  const resolvedSpecialRanges = useMemo(() => {
    if (!product) return [];
    return (product.specialSizeRanges || []).map((r) => ({
      ...r,
      suffix: normalizeSpecialSuffix(r.suffix),
      rangeLabel: r.rangeLabel || r.sizeRangeLabel || r.label || `Talles Especiales ${r.suffix || '-1'}`,
      sizes: resolveSpecialRangeSizes(r),
    }));
  }, [product]);

  const allImages: string[] = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (Array.isArray(product.images)) list.push(...product.images.filter(Boolean));
    if (Array.isArray(product.imagesMen)) list.push(...product.imagesMen.filter(Boolean));
    if (Array.isArray(product.imagesWomen)) list.push(...product.imagesWomen.filter(Boolean));
    if (product.imagesByColor && typeof product.imagesByColor === 'object') {
      for (const u of Object.values(product.imagesByColor)) {
        if (u && typeof u === 'string' && !list.includes(u)) list.push(u);
      }
    }
    if (product.image && !list.includes(product.image)) list.unshift(product.image);
    const activeCol = selectedColor || product.availableColors?.[0] || '';
    for (const cImg of getAllImagesForColor(product, activeCol).slice().reverse()) {
      if (cImg && !list.includes(cImg)) list.unshift(cImg);
    }
    const unique = list.filter((u, idx, self) => Boolean(u && u.trim()) && self.indexOf(u) === idx);
    return unique.length > 0 ? unique : ['/logo.png'];
  }, [product, selectedColor]);

  if (!product) return null;

  const isCompany = userSession?.clientType === 'empresa';
  const currentSize =
    selectedSize ||
    (product.availableSizes && product.availableSizes.length > 0
      ? product.availableSizes[0]
      : resolvedSpecialRanges[0]?.sizes[0] || '');
  const currentColor = selectedColor || (product.availableColors && product.availableColors.length > 0 ? product.availableColors[0] : '');

  const activeSpecialRange = findSpecialRangeForSize(product, currentSize);
  const activeProductCode = activeSpecialRange
    ? `${product.code}${normalizeSpecialSuffix(activeSpecialRange.suffix)}`
    : product.code;

  const effectivePrice = activeSpecialRange
    ? (isCompany && activeSpecialRange.corporatePrice ? activeSpecialRange.corporatePrice : activeSpecialRange.price)
    : (isCompany && product.corporatePrice ? product.corporatePrice : product.price);
  const hasDiscount = Boolean(product.discountPercentage && product.discountPercentage > 0);
  const discountedPrice = hasDiscount
    ? Math.round(effectivePrice * (1 - (product.discountPercentage || 0) / 100))
    : effectivePrice;

  const activePromo = getProductActivePromotion(product, promotions);
  const promoBadgeLabel = activePromo ? (activePromo.badge || product.promotionTag || activePromo.tagFilter) : null;

  const handleSelectColor = (col: string) => {
    setSelectedColor(col);
    const colorMatches = getAllImagesForColor(product, col);
    const targetImg = colorMatches[0];
    if (targetImg) {
      const idx = allImages.findIndex((u) => u === targetImg);
      setSelectedImageIndex(idx !== -1 ? idx : 0);
    }
  };

  const handleAdd = () => {
    onAddToCart(
      product,
      quantity,
      currentColor,
      currentSize,
      activeSpecialRange || undefined,
      discountedPrice,
      activeProductCode
    );
    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleWhatsAppInquiry = () => {
    const clientName =
      userSession?.clientType === 'empresa'
        ? `${(userSession.clientData as any)?.companyName} (Rep: ${(userSession.clientData as any)?.repFullName})`
        : (userSession?.clientData as any)?.fullName || 'Cliente';

    const message = `Hola Pampero Gran Mendoza! Soy ${clientName}. Quisiera consultar disponibilidad y cotización del siguiente artículo de su catálogo digital:
- *Producto:* ${product.name} (Código: ${activeProductCode})
- *Categoría:* ${product.category} > ${product.section} (${product.subCategory})
- *Talle:* ${currentSize}${activeSpecialRange ? ` (${activeSpecialRange.rangeLabel})` : ''}
- *Color:* ${currentColor}
- *Cantidad deseada:* ${quantity} unidades
- *Precio de referencia:* $${discountedPrice.toLocaleString('es-AR')} c/u`;

    const url = `https://wa.me/${theme.whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const accent = theme.accentColor || '#FDB813';
  const displayedImage = getProductImageForColor(product, currentColor);
  const fallbackImg = (displayedImage && displayedImage.trim()) || (product.image && product.image.trim()) || '/logo.png';
  const safeIdx = selectedImageIndex >= allImages.length ? 0 : selectedImageIndex;
  const activeImageUrl = (allImages[safeIdx] && allImages[safeIdx].trim()) || fallbackImg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        id="product-detail-card"
        style={{
          backgroundColor: theme.productDetailBgColor || '#FFFFFF',
          borderColor: theme.productDetailBorderColor || '#E5E5E5',
          color: theme.productDetailTextColor || '#18231C',
        }}
        className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col md:flex-row max-h-[92vh] overflow-y-auto"
      >
        {/* Left: Product Image Gallery & Badges */}
        <div className="md:w-1/2 relative bg-neutral-100 flex flex-col justify-between min-h-[300px] md:min-h-[440px]">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden group">
            <img
              src={activeImageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-opacity duration-300 max-h-[360px] md:max-h-[420px]"
              referrerPolicy="no-referrer"
            />

            {/* Carousel navigation arrows */}
            {allImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-neutral-800 hover:bg-white hover:scale-110 transition-all cursor-pointer z-10"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-neutral-800 hover:bg-white hover:scale-110 transition-all cursor-pointer z-10"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Photo indicator pill */}
                <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full z-10">
                  {selectedImageIndex + 1} / {allImages.length}
                </div>
              </>
            )}

            {/* Badges on image */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
              <span 
                style={{ backgroundColor: theme.primaryColor || '#18231C' }}
                className="px-2.5 py-1 rounded-xs text-white text-[10px] font-black tracking-wider uppercase"
              >
                {product.category} · {product.section}
              </span>
              {promoBadgeLabel && (
                <span 
                  style={{ backgroundColor: theme.seasonBadgeBg || '#18231C' }}
                  className="px-2.5 py-1 rounded-xs text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-sm"
                >
                  <Tag className="w-3 h-3" />
                  {promoBadgeLabel}
                </span>
              )}
              {hasDiscount && (
                <span 
                  style={{ backgroundColor: theme.discountBadgeBg || accent }}
                  className="px-2 py-0.5 rounded-xs text-white text-xs font-black shadow-sm"
                >
                  -{product.discountPercentage}% OFF
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 md:hidden p-2 rounded-full bg-white/80 backdrop-blur text-neutral-800"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Multiple Photos Thumbnail Strip */}
          {allImages.filter(url => Boolean(url && url.trim())).length > 1 && (
            <div className="bg-[#FAF8F5] p-2 border-t border-[#DCD4C9] flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-[#6F6860] uppercase tracking-wider px-1">
                Fotos ({allImages.filter(url => Boolean(url && url.trim())).length}):
              </span>
              {allImages.filter(url => Boolean(url && url.trim())).map((imgUrl, imgIdx) => (
                <button
                  key={imgIdx}
                  type="button"
                  onClick={() => setSelectedImageIndex(imgIdx)}
                  style={{
                    borderColor: selectedImageIndex === imgIdx ? (theme.primaryColor || '#18231C') : undefined,
                  }}
                  className={`w-11 h-11 rounded-xs border-2 overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                    selectedImageIndex === imgIdx
                      ? 'ring-2 ring-black/20 scale-105 opacity-100'
                      : 'border-[#DCD4C9] opacity-70 hover:opacity-100'
                  }`}
                  title={`Ver foto ${imgIdx + 1}`}
                >
                  <img
                    src={imgUrl || '/logo.png'}
                    alt={`${product.name} foto ${imgIdx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details & Buying / Inquiring */}
        <div className="md:w-1/2 p-6 flex flex-col justify-between">
          <div>
            <div className="hidden md:flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  Art. {activeProductCode}
                </span>
                {activeSpecialRange && (
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                    {activeSpecialRange.rangeLabel}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-900 p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#111111] leading-tight mb-2">
              {product.name}
            </h2>

            {/* Price section */}
            <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-neutral-100 flex-wrap">
              <div className="text-2xl font-black text-[#111111]">
                ${discountedPrice.toLocaleString('es-AR')}
              </div>
              {hasDiscount && (
                <div className="text-sm font-medium text-neutral-400 line-through">
                  ${effectivePrice.toLocaleString('es-AR')}
                </div>
              )}
              {activeSpecialRange && (
                <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                  Precio Talle Especial ({activeSpecialRange.suffix})
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              {product.description}
            </p>

            {/* Features Checklist */}
            {product.features && product.features.length > 0 && (
              <div className="mb-4 space-y-1.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200/80">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block mb-1">
                  Especificaciones Técnicas Pampero:
                </span>
                {product.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-neutral-700">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: theme.iconColor || accent }} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sizes selector (Standard + Special Ranges) */}
            {((product.availableSizes && product.availableSizes.length > 0) || resolvedSpecialRanges.length > 0) && (
              <div className="mb-3 space-y-2.5">
                {product.availableSizes && product.availableSizes.length > 0 && (
                  <div>
                    <span className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5 text-neutral-400" />
                      Talle: <strong className="text-neutral-900">{currentSize}</strong>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.availableSizes
                        .filter(
                          (sz) =>
                            !resolvedSpecialRanges.some((r) =>
                              r.sizes.some((rs) => rs.toUpperCase() === sz.trim().toUpperCase())
                            )
                        )
                        .map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            style={{
                              borderColor: currentSize === size ? accent : undefined,
                              backgroundColor: currentSize === size ? `${accent}15` : undefined,
                              color: currentSize === size ? accent : undefined,
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                              currentSize === size
                                ? 'shadow-xs'
                                : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {resolvedSpecialRanges.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200">
                    {resolvedSpecialRanges.map((range) => {
                      const rPrice = isCompany && range.corporatePrice ? range.corporatePrice : range.price;
                      return (
                        <div key={range.id || range.suffix} className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-950">
                              <span className="font-mono bg-[#18231C] text-white px-1 py-0.5 rounded-xs mr-1.5">
                                {range.suffix}
                              </span>
                              {range.rangeLabel}
                            </span>
                            <span className="font-bold text-amber-900">${rPrice.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {range.sizes.map((size) => (
                              <button
                                key={`${range.suffix}-${size}`}
                                type="button"
                                onClick={() => setSelectedSize(size)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                                  currentSize === size
                                    ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                                    : 'bg-white border-amber-300 text-amber-900 hover:border-amber-500'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Colors selector with Swatches */}
            {product.availableColors && product.availableColors.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Color: <strong className="text-neutral-900">{currentColor}</strong>
                  </span>
                  {getColorCode(currentColor) && (
                    <span className="text-[10px] font-mono font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-xs">
                      Art. {getColorCode(currentColor)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.availableColors.map((col) => {
                    const isSelected = currentColor === col;
                    const hex = getColorHex(col);
                    const code = getColorCode(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => handleSelectColor(col)}
                        style={{
                          borderColor: isSelected ? (theme.primaryColor || '#18231C') : undefined,
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'text-neutral-900 font-bold bg-neutral-100 ring-1 ring-neutral-900/15 shadow-2xs'
                            : 'border-neutral-200 hover:border-neutral-300 text-neutral-700 bg-white'
                        }`}
                      >
                        <span 
                          className="w-3 h-3 rounded-full border border-neutral-300 shrink-0" 
                          style={{ backgroundColor: hex }} 
                        />
                        <span>{col}</span>
                        {code && (
                          <span className="text-[9px] font-mono text-neutral-400">
                            [{code}]
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Cantidad:
              </span>
              <div className="flex items-center border border-neutral-300 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-l-lg"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-bold text-xs">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-r-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <button
              id="btn-add-to-quote"
              type="button"
              onClick={handleAdd}
              style={{
                backgroundColor: addedSuccess ? '#059669' : (theme.productDetailButtonBg || theme.primaryColor || '#18231C'),
                color: theme.productDetailButtonTextColor || theme.buttonTextColor || '#FFFFFF'
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
            >
              {addedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Agregado a Mi Pedido!
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {theme.siteTexts?.productDetailAddBtnText || 'Agregar a Mi Pedido'}
                </>
              )}
            </button>

            <button
              id="btn-consult-whatsapp"
              type="button"
              onClick={handleWhatsAppInquiry}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              {theme.siteTexts?.productDetailWhatsappBtnText || 'Consultar Disponibilidad por WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
