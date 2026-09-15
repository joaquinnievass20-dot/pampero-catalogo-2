import React, { useState, useRef, useEffect } from 'react';
import { MainCategory, ThemeConfig } from '../types';
import { CATEGORY_HIERARCHY } from '../data/categories';
import { ChevronDown, ArrowRight, Tag } from 'lucide-react';

interface CategoryMenuNavProps {
  currentCategory?: MainCategory;
  activePromoFilter?: string | null;
  onSelectCategoryItem: (category: MainCategory, section?: string, subCategory?: string) => void;
  onSelectPromo?: (tag: string) => void;
  theme?: ThemeConfig;
  className?: string;
  isDarkHeader?: boolean;
}

export const CategoryMenuNav: React.FC<CategoryMenuNavProps> = ({
  currentCategory,
  activePromoFilter,
  onSelectCategoryItem,
  onSelectPromo,
  theme,
  className = '',
  isDarkHeader = false,
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<MainCategory | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const accent = theme?.accentColor || '#FDB813';
  const textColor = isDarkHeader ? '#F5F2EC' : (theme?.textColor || '#18231C');
  const cardBorder = theme?.cardBorderColor || '#DCD4C9';
  const panelBg = '#FFFFFF';

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setHoveredCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (cat: MainCategory) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHoveredCategory(cat);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setHoveredCategory(null);
    }, 320);
  };

  const categories: MainCategory[] = ['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'];
  const activeStructure = CATEGORY_HIERARCHY.find((c) => c.name === hoveredCategory);

  return (
    <div 
      ref={menuContainerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Links Row */}
      <nav className="flex items-center gap-5 sm:gap-7">
        {categories.map((cat) => {
          const isActive = currentCategory === cat && !activePromoFilter;
          const isHovered = hoveredCategory === cat;

          return (
            <div
              key={cat}
              className="relative py-2"
              onMouseEnter={() => handleMouseEnter(cat)}
            >
              <button
                type="button"
                onClick={() => {
                  if (hoveredCategory === cat) {
                    setHoveredCategory(null);
                    onSelectCategoryItem(cat, 'Todos', 'Todos');
                  } else {
                    setHoveredCategory(cat);
                  }
                }}
                style={{
                  color: isActive || isHovered ? accent : textColor,
                }}
                className={`text-xs font-bold uppercase tracking-[0.18em] transition-colors inline-flex items-center gap-1 cursor-pointer select-none ${
                  isActive ? 'underline underline-offset-8 decoration-2' : ''
                }`}
              >
                <span>{cat}</span>
                <ChevronDown 
                  className={`w-3 h-3 transition-transform duration-200 ${
                    isHovered ? 'rotate-180' : ''
                  }`} 
                  style={{ color: isHovered || isActive ? accent : (isDarkHeader ? '#A89F91' : '#6F6860') }}
                />
              </button>
            </div>
          );
        })}

        {/* Promos Link */}
        {onSelectPromo && (
          <button
            type="button"
            onClick={() => onSelectPromo('Promoción')}
            style={{
              color: activePromoFilter ? accent : textColor,
            }}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] transition-colors hover:opacity-80 cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" style={{ color: accent }} />
            <span>PROMOS</span>
          </button>
        )}
      </nav>

      {/* Hover Mega-Dropdown Structure Panel */}
      {hoveredCategory && activeStructure && (
        <div
          onMouseEnter={() => handleMouseEnter(hoveredCategory)}
          onMouseLeave={handleMouseLeave}
          style={{
            borderColor: cardBorder,
            backgroundColor: panelBg,
          }}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[92vw] max-w-4xl p-6 rounded-xs shadow-2xl border z-50 animate-fadeIn"
        >
          {/* Header of the Dropdown */}
          <div className="flex items-center justify-between border-b border-[#DCD4C9]/60 pb-3 mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-[0.25em]" style={{ color: accent }}>
                ESTRUCTURA DE LÍNEA
              </span>
              <h4 className="font-display text-2xl uppercase tracking-wider text-[#18231C] font-bold leading-none">
                {activeStructure.name}
              </h4>
              <p className="text-xs text-[#6F6860] mt-0.5">
                {activeStructure.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setHoveredCategory(null);
                onSelectCategoryItem(hoveredCategory, 'Todos', 'Todos');
              }}
              style={{ backgroundColor: accent }}
              className="px-4 py-2 rounded-xs text-white text-[11px] font-bold uppercase tracking-wider hover:brightness-110 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <span>Ver Todo {hoveredCategory}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid of Sections & Subcategories */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {activeStructure.sections.map((section) => (
              <div key={section.name} className="space-y-2">
                <div 
                  onClick={() => {
                    setHoveredCategory(null);
                    onSelectCategoryItem(hoveredCategory, section.name, 'Todos');
                  }}
                  className="font-bold text-xs uppercase tracking-wider text-[#18231C] border-b border-[#DCD4C9]/50 pb-1 cursor-pointer hover:opacity-80 transition-colors flex items-center justify-between group"
                >
                  <span>{section.name}</span>
                  <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: accent }}>
                    →
                  </span>
                </div>

                <ul className="space-y-1">
                  {section.subCategories.map((sub) => (
                    <li key={sub}>
                      <button
                        type="button"
                        onClick={() => {
                          setHoveredCategory(null);
                          onSelectCategoryItem(hoveredCategory, section.name, sub);
                        }}
                        className="text-xs text-[#544E47] hover:text-[#18231C] hover:translate-x-0.5 transition-all py-0.5 text-left w-full cursor-pointer flex items-center justify-between group"
                      >
                        <span className="group-hover:font-semibold">{sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
