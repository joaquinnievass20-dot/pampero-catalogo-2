import React, { useState } from 'react';
import { Product, UserSession, ThemeConfig, Promotion } from '../types';
import { Building2 } from 'lucide-react';
import { getColorHex, getProductImageForColor, recordProductInteraction } from '../utils/colorUtils';
import { getProductActivePromotion } from '../utils/promoUtils';

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

  const handleClick = () => {
    recordProductInteraction(product, 'click');
    onViewDetail(product);
  };

  return (
    <div
      id={`product-card-${product.id}`}
      className="group block select-none"
    >
      {/* Product Image Box */}
      <div 
        onClick={handleClick}
        style={{ borderColor: cardBorder }}
        className="relative overflow-hidden rounded-xs bg-[#ECE5DC] border cursor-pointer transition-colors"
      >
        <img
          src={displayedImage}
          alt={product.name}
          loading="lazy"
          className="aspect-[9/11] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />

        {/* Top left badge if present and linked to an active promotion */}
        {promoBadgeLabel && (
          <span 
            style={{ 
              backgroundColor: theme.seasonBadgeBg || '#18231C',
              color: theme.seasonBadgeText || '#F5F2EC'
            }}
            className="absolute left-2.5 top-2.5 rounded-xs px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] shadow-2xs"
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
            className="absolute right-2.5 top-2.5 rounded-xs px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] shadow-2xs"
          >
            -{product.discountPercentage}%
          </span>
        )}

        {/* Slide-up "Ver ficha" bar on hover */}
        <span 
          style={{ backgroundColor: theme.primaryColor || '#18231C' }}
          className="absolute inset-x-0 bottom-0 translate-y-full py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#F5F2EC] transition-transform duration-300 group-hover:translate-y-0"
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedColor(col);
                }}
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
      <div className="mt-2 min-w-0" onClick={handleClick}>
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
          className="mt-0.5 truncate text-sm font-medium text-[#22201D] transition-colors cursor-pointer"
          style={{
            '--hover-color': accent
          } as React.CSSProperties}
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
