import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, UserSession, ThemeConfig, Promotion } from '../types';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getColorHex, getProductImageForColor, recordProductInteraction } from '../utils/colorUtils';
import { getProductActivePromotion } from '../utils/promoUtils';
import { trackProductClick } from '../utils/analytics';

interface ProductCardProps {
  product: Product;
  userSession: UserSession | null;
  theme: ThemeConfig;
  promotions?: Promotion[];
  onViewDetail: (product: Product) => void;
  onQuickAdd?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  userSession,
  theme,
  promotions,
  onViewDetail,
}) => {
  const isCompany = userSession?.clientType === 'empresa';
  const basePrice = isCompany && product.corporatePrice ? product.corporatePrice : product.price;
  const hasDiscount = Boolean(product.discountPercentage && product.discountPercentage > 0);
  const discountedPrice = hasDiscount
    ? Math.round(basePrice * (1 - (product.discountPercentage || 0) / 100))
    : basePrice;

  const [selectedColor, setSelectedColor] = useState<string>(
    product.availableColors && product.availableColors.length > 0 ? product.availableColors[0] : ''
  );

  const displayedImage = getProductImageForColor(product, selectedColor);
  const accent = theme.accentColor || '#FDB813';
  const iconColor = theme.iconColor || accent;
  const hoverAccent = theme.hoverAccentColor || accent;
  const cardBorder = theme.cardBorderColor || '#DCD4C9';

  // Check if product is actually linked to an active promotion
  const activePromo = getProductActivePromotion(product, promotions);
  const promoBadgeLabel = activePromo ? (activePromo.badge || product.promotionTag || activePromo.tagFilter) : null;

  // Collect all photos available for this product (supporting color variations, unisex and general galleries)
  const allImages = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      list.push(...product.images.filter(Boolean));
    }
    if (Array.isArray(product.imagesMen) && product.imagesMen.length > 0) {
      list.push(...product.imagesMen.filter(Boolean));
    }
    if (Array.isArray(product.imagesWomen) && product.imagesWomen.length > 0) {
      list.push(...product.imagesWomen.filter(Boolean));
    }
    if (product.image && !list.includes(product.image)) {
      list.unshift(product.image);
    }
    const colorImg = getProductImageForColor(product, selectedColor);
    if (colorImg && !list.includes(colorImg)) {
      list.unshift(colorImg);
    }
    const unique = list.filter((url, idx, self) => Boolean(url && url.trim()) && self.indexOf(url) === idx);
    const fallback = (displayedImage && displayedImage.trim()) || (product.image && product.image.trim()) || '/logo.png';
    return unique.length > 0 ? unique : [fallback];
  }, [product, selectedColor, displayedImage]);

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const handleSelectColor = (e: React.MouseEvent, col: string) => {
    e.stopPropagation();
    setSelectedColor(col);
    const colorImg = getProductImageForColor(product, col);
    if (colorImg) {
      const foundIdx = allImages.findIndex((url) => url === colorImg);
      if (foundIdx !== -1) {
        setCurrentImgIndex(foundIdx);
      }
    }
  };

  // Guarded sync for initial or external color adjustments
  useEffect(() => {
    const colorImg = getProductImageForColor(product, selectedColor);
    if (colorImg) {
      const foundIdx = allImages.findIndex((url) => url === colorImg);
      if (foundIdx !== -1) {
        setCurrentImgIndex((prev) => (prev === foundIdx ? prev : foundIdx));
      }
    }
  }, [selectedColor, product.id]);

  const safeImgIndex = Math.min(currentImgIndex, Math.max(0, allImages.length - 1));
  const activeImageUrl = allImages[safeImgIndex] || (displayedImage && displayedImage.trim()) || (product.image && product.image.trim()) || '/logo.png';

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;
    if (Math.abs(diff) > 40 && allImages.length > 1) {
      if (diff > 0) {
        // Swiped left -> next
        setCurrentImgIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
      } else {
        // Swiped right -> prev
        setCurrentImgIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
      }
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordProductInteraction(product, 'click');
    trackProductClick(product, 'catalog_grid_photo');
    onViewDetail(product);
  };

  const handleDetailClick = () => {
    recordProductInteraction(product, 'click');
    trackProductClick(product, 'catalog_grid');
    onViewDetail(product);
  };

  return (
    <div
      id={`product-card-${product.id}`}
      className="group block select-none"
    >
      {/* Product Image Box with Interactive Carousel */}
      <div 
        onClick={handleImageClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ borderColor: cardBorder }}
        className="relative overflow-hidden rounded-xs bg-[#ECE5DC] border cursor-pointer transition-colors"
      >
        <img
          src={activeImageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="aspect-[9/11] w-full object-cover transition-transform duration-200 ease-in-out group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />

        {/* Carousel square semi-transparent navigation arrows (igual al sistema de promociones) */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-xs flex items-center justify-center bg-black/45 hover:bg-black/80 text-white border border-white/20 hover:border-white/50 backdrop-blur-xs transition-all shadow-md cursor-pointer opacity-85 hover:opacity-100 hover:scale-105"
              aria-label="Foto anterior"
              title="Foto anterior"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-xs flex items-center justify-center bg-black/45 hover:bg-black/80 text-white border border-white/20 hover:border-white/50 backdrop-blur-xs transition-all shadow-md cursor-pointer opacity-85 hover:opacity-100 hover:scale-105"
              aria-label="Foto siguiente"
              title="Foto siguiente"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Bottom dots indicators (fichitas interactivas para correr fotos igual al slider de promociones) */}
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1 z-20 pointer-events-auto">
              {allImages.slice(0, 8).map((_, i) => {
                const isActive = safeImgIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImgIndex(i);
                    }}
                    style={{
                      backgroundColor: isActive ? accent : 'rgba(255, 255, 255, 0.65)',
                      width: isActive ? '16px' : '5px',
                    }}
                    className="h-1.5 rounded-full transition-all duration-300 cursor-pointer shadow-xs hover:bg-white"
                    aria-label={`Ver foto ${i + 1}`}
                  />
                );
              })}
            </div>

            {/* Photo counter badge */}
            <div className="absolute bottom-2.5 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs z-10 pointer-events-none">
              {safeImgIndex + 1}/{allImages.length}
            </div>
          </>
        )}

        {/* Top left badge if present and linked to an active promotion */}
        {promoBadgeLabel && (
          <span 
            style={{ 
              backgroundColor: theme.seasonBadgeBg || '#18231C',
              color: theme.seasonBadgeText || '#F5F2EC'
            }}
            className="absolute left-2.5 top-2.5 rounded-xs px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] shadow-2xs z-10"
          >
            {promoBadgeLabel}
          </span>
        )}

        {/* Top right discount badge */}
        {hasDiscount && (
          <span 
            style={{ 
              backgroundColor: theme.discountBadgeBg || accent,
              color: theme.discountBadgeText || '#FFFFFF'
            }}
            className="absolute right-2.5 top-2.5 group-hover:right-11 transition-all rounded-xs px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] shadow-2xs z-10"
          >
            -{product.discountPercentage}%
          </span>
        )}

        {/* Slide-up "Ver ficha" bar on hover */}
        <span 
          onClick={(e) => {
            e.stopPropagation();
            handleDetailClick();
          }}
          style={{ backgroundColor: theme.primaryColor || '#18231C' }}
          className="absolute inset-x-0 bottom-0 translate-y-full py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#F5F2EC] transition-transform duration-300 group-hover:translate-y-0 z-10 cursor-pointer hover:bg-black"
        >
          Ver ficha
        </span>
      </div>

      {/* Color swatches previews */}
      {product.availableColors && product.availableColors.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {product.availableColors.map((col) => {
            const hex = getColorHex(col);
            const isSelected = selectedColor === col;
            return (
              <button
                key={col}
                type="button"
                title={`Color: ${col}`}
                onClick={(e) => handleSelectColor(e, col)}
                style={{
                  backgroundColor: hex,
                  borderColor: isSelected ? (theme.primaryColor || '#18231C') : '#DCD4C9',
                  boxShadow: isSelected ? `0 0 0 1.5px #FFFFFF, 0 0 0 3px ${theme.primaryColor || '#18231C'}` : undefined,
                }}
                className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer hover:scale-125 ${isSelected ? 'scale-110' : ''}`}
              />
            );
          })}
          {selectedColor && (
            <span className="text-[10px] text-neutral-500 capitalize ml-1 font-mono">
              {selectedColor}
            </span>
          )}
        </div>
      )}

      {/* Product metadata */}
      <div className="mt-2 min-w-0" onClick={handleDetailClick}>
        <div className="flex items-center gap-1 flex-wrap">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F6860] truncate font-medium">
            {product.section} · {product.subCategory}
          </p>
          {product.isUnisex && (
            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 rounded-xs border border-emerald-200 uppercase tracking-wider">
              Unisex
            </span>
          )}
          {product.specialSizeRanges && product.specialSizeRanges.length > 0 && (
            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1 rounded-xs border border-amber-200 uppercase tracking-wider">
              Talles Esp. (-1)
            </span>
          )}
        </div>

        <h3 
          className="mt-0.5 truncate text-sm font-medium text-[#22201D] transition-colors cursor-pointer group-hover:text-[#FDB813]"
        >
          {product.name}
        </h3>

        <div className="mt-1 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-[#22201D]">
              $ {discountedPrice.toLocaleString('es-AR')}
            </span>
            {hasDiscount && (
              <span className="text-xs text-[#6F6860] line-through">
                $ {basePrice.toLocaleString('es-AR')}
              </span>
            )}
          </div>

          {isCompany && (
            <span 
              style={{ color: iconColor }}
              className="text-[9px] font-bold flex items-center gap-0.5 uppercase tracking-wider"
            >
              <Building2 className="w-2.5 h-2.5" /> Mayorista
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

