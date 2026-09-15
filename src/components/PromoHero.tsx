import React from 'react';
import { Promotion } from '../types';
import { Sparkles, ArrowRight, Tag, Percent, X } from 'lucide-react';

interface PromoHeroProps {
  promotions: Promotion[];
  activePromoFilter: string | null;
  onSelectPromo: (promo: Promotion) => void;
  onClearPromoFilter: () => void;
  filteredCount: number;
}

export const PromoHero: React.FC<PromoHeroProps> = ({
  promotions,
  activePromoFilter,
  onSelectPromo,
  onClearPromoFilter,
  filteredCount,
}) => {
  const activePromos = promotions.filter((p) => p.active);
  if (activePromos.length === 0 && !activePromoFilter) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      {/* If a promo filter is currently active, show a high-visibility badge with clear button */}
      {activePromoFilter && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border-2 border-[#E52421] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-[#E52421] text-white flex items-center justify-center font-bold text-xs shrink-0">
              %
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#E52421]">
                Filtro de Promoción Activo:
              </span>{' '}
              <strong className="text-neutral-900 text-sm font-black">"{activePromoFilter}"</strong>{' '}
              <span className="text-xs text-neutral-600">({filteredCount} productos relacionados encontrados)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClearPromoFilter}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <X className="w-3.5 h-3.5" />
            Ver Todo el Catálogo
          </button>
        </div>
      )}

      {/* Promos cards banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {activePromos.map((promo) => {
          const isSelected = activePromoFilter === promo.tagFilter;

          return (
            <div
              key={promo.id}
              onClick={() => onSelectPromo(promo)}
              className={`group relative h-40 sm:h-44 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border ${
                isSelected ? 'ring-4 ring-[#E52421] border-[#E52421]' : 'border-neutral-200'
              }`}
            >
              {/* Background image */}
              <img
                src={promo.bannerImage}
                alt={promo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-75"
                referrerPolicy="no-referrer"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E52421] text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {promo.badge}
                  </span>
                  {promo.discountOnly && (
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-900 text-[10px] font-extrabold uppercase">
                      Descuentos
                    </span>
                  )}
                </div>

                <div>
                  <h3 
                    className="font-black leading-tight group-hover:text-amber-300 transition-colors"
                    style={{
                      color: promo.textColor || '#FFFFFF',
                      fontSize: promo.fontSize ? `clamp(1.1rem, 2vw, ${promo.fontSize})` : '1.125rem',
                    }}
                  >
                    {promo.title}
                  </h3>
                  <p 
                    className="line-clamp-1 mt-0.5"
                    style={{
                      color: promo.subtitleColor || '#D4D4D4',
                      fontSize: promo.subtitleFontSize || '12px',
                    }}
                  >
                    {promo.subtitle}
                  </p>

                  <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-white group-hover:translate-x-1 transition-transform">
                    <span>Ver artículos de esta promo</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#E52421]" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
