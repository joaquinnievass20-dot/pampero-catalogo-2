import React from 'react';
import { MainCategory } from '../types';
import { CATEGORY_HIERARCHY, SectionDef } from '../data/categories';
import { Layers, Filter, Check } from 'lucide-react';

interface CategoryNavFilterProps {
  currentCategory: MainCategory;
  onSelectCategory: (cat: MainCategory) => void;
  currentSection: string;
  onSelectSection: (section: string) => void;
  currentSubCategory: string;
  onSelectSubCategory: (sub: string) => void;
  totalProductsCount: number;
}

export const CategoryNavFilter: React.FC<CategoryNavFilterProps> = ({
  currentCategory,
  onSelectCategory,
  currentSection,
  onSelectSection,
  currentSubCategory,
  onSelectSubCategory,
  totalProductsCount,
}) => {
  const currentCategoryDef = CATEGORY_HIERARCHY.find((c) => c.name === currentCategory);
  const sections: SectionDef[] = currentCategoryDef?.sections || [];

  const activeSectionDef = sections.find((s) => s.name === currentSection);
  const subCategories = activeSectionDef ? activeSectionDef.subCategories : [];

  return (
    <div className="bg-white border-b border-neutral-200 py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        {/* Main Category Tabs row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'] as MainCategory[]).map((cat) => {
              const active = currentCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat);
                    onSelectSection('Todos');
                    onSelectSubCategory('Todos');
                  }}
                  className={`px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
            {totalProductsCount} {totalProductsCount === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        {/* Section Pills (e.g. Urbano, Industria, Accesorios, Aventura, Rural) */}
        {sections.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-neutral-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Sección:
            </span>

            <button
              type="button"
              onClick={() => {
                onSelectSection('Todos');
                onSelectSubCategory('Todos');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                currentSection === 'Todos'
                  ? 'bg-[#E52421] text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Ver Todo
            </button>

            {sections.map((sec) => {
              const isSelected = currentSection === sec.name;
              return (
                <button
                  key={sec.name}
                  type="button"
                  onClick={() => {
                    onSelectSection(sec.name);
                    onSelectSubCategory('Todos');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#E52421] text-white shadow-xs'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {sec.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Subcategory Pills (when a section with subcategories is selected) */}
        {currentSection !== 'Todos' && subCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-neutral-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
              Subcategoría:
            </span>

            <button
              type="button"
              onClick={() => onSelectSubCategory('Todos')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap ${
                currentSubCategory === 'Todos'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Todas
            </button>

            {subCategories.map((sub) => {
              const isSelected = currentSubCategory === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onSelectSubCategory(sub)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
