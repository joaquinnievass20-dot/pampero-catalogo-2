import React, { useState, useMemo } from 'react';
import { Product, UserSession, ThemeConfig, MainCategory, Promotion } from '../types';
import { ProductCard } from './ProductCard';
import { CATEGORY_HIERARCHY, CategoryStructure, loadStoredCategoryHierarchy } from '../data/categories';
import { getColorHex, getColorCode } from '../utils/colorUtils';
import { ChevronDown, ChevronRight, SlidersHorizontal, X, ArrowLeft, History, Search } from 'lucide-react';

interface CatalogViewProps {
  products: Product[];
  currentCategory: MainCategory;
  userSession: UserSession | null;
  theme: ThemeConfig;
  promotions?: Promotion[];
  activePromoFilter: string | null;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSelectCategory: (cat: MainCategory) => void;
  onClearPromoFilter: () => void;
  onViewProductDetail?: (product: Product) => void;
  onViewProduct?: (product: Product) => void;
  onQuickAddProduct?: (product: Product) => void;
  onOpenPromos: () => void;
  onBackToHome: () => void;
  currentSection?: string;
  onSelectSection?: (s: string) => void;
  currentSubCategory?: string;
  onSelectSubCategory?: (sub: string) => void;
  categoryHierarchy?: CategoryStructure[];
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  currentCategory,
  userSession,
  theme,
  promotions,
  activePromoFilter,
  searchQuery = '',
  onSearchChange,
  onSelectCategory,
  onClearPromoFilter,
  onViewProductDetail,
  onViewProduct,
  onQuickAddProduct,
  onOpenPromos,
  onBackToHome,
  categoryHierarchy,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const activeSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (onSearchChange) onSearchChange(val);
  };

  const [selectedSection, setSelectedSection] = useState<string>('Todas');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<string>('destacados');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Reliable handler for opening product detail
  const handleOpenProduct = onViewProductDetail || onViewProduct || (() => {});

  const accent = theme.accentColor || '#FDB813';

  // Helper to normalize category
  const sanitizeCategory = (rawCat: any): MainCategory => {
    if (rawCat === 'Mujer' || rawCat === '1' || rawCat === 1) return 'Mujer';
    if (rawCat === 'Infantil' || rawCat === '2' || rawCat === 2) return 'Infantil';
    if (rawCat === 'Venta Corporativa' || rawCat === '3' || rawCat === 3) return 'Venta Corporativa';
    const s = String(rawCat || '').toLowerCase();
    if (s.includes('mujer')) return 'Mujer';
    if (s.includes('infan') || s.includes('niñ')) return 'Infantil';
    if (s.includes('corp') || s.includes('venta')) return 'Venta Corporativa';
    return 'Hombre';
  };

  const activeHierarchy = useMemo(() => {
    return categoryHierarchy && categoryHierarchy.length > 0 ? categoryHierarchy : loadStoredCategoryHierarchy();
  }, [categoryHierarchy]);

  // Get current category definition from activeHierarchy
  const currentCategoryDef = useMemo(() => {
    return activeHierarchy.find((c) => c.name === currentCategory) || activeHierarchy[0] || CATEGORY_HIERARCHY[0];
  }, [currentCategory, activeHierarchy]);

  // Helper to check if a product is industrial or corporate
  const isIndustrialProduct = (p: Product) => {
    return Boolean(
      p.isCorporateOnly ||
      p.category === 'Venta Corporativa' ||
      (p.section && p.section.toLowerCase() === 'industria') ||
      (p.subCategory && p.subCategory.toLowerCase().includes('industria'))
    );
  };

  // Extract all unique colors from products for this category
  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products
      .filter((p) => {
        const isInd = isIndustrialProduct(p);
        if (isInd) return currentCategory === 'Venta Corporativa';
        if (currentCategory === 'Venta Corporativa') return false;
        if (currentCategory === 'Hombre') return sanitizeCategory(p.category) === 'Hombre' || Boolean(p.isUnisex);
        if (currentCategory === 'Mujer') return sanitizeCategory(p.category) === 'Mujer' || Boolean(p.isUnisex);
        return sanitizeCategory(p.category) === currentCategory;
      })
      .forEach((p) => {
        p.availableColors?.forEach((c) => set.add(c));
      });
    return Array.from(set);
  }, [products, currentCategory]);

  // Recently viewed items from memory
  const recentlyViewed = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('pampero_viewed_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 4);
      }
    } catch {}
    return [];
  }, []);

  const categoryTaglines: Record<MainCategory, string> = {
    Hombre: 'Trabajo, campo y ciudad con la misma nobleza de siempre.',
    Mujer: 'Prendas de carácter, pensadas para durar temporadas enteras.',
    Infantil: 'La misma resistencia, en talles chicos.',
    'Venta Corporativa': 'Equipamiento e indumentaria para equipos de trabajo.',
  };

  // Filter products according to category, search, section, subcategory, color, and promo
  const filteredProducts = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();

    return products.filter((p) => {
      const prodCategory = sanitizeCategory(p.category);

      // Search Query filter
      if (q) {
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesCode = (p.code || '').toLowerCase().includes(q);
        const matchesSec = (p.section || '').toLowerCase().includes(q);
        const matchesSub = (p.subCategory || '').toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesFeat = (p.features || []).some((f) => f.toLowerCase().includes(q));
        const matchesCol = (p.availableColors || []).some((c) => c.toLowerCase().includes(q));
        const matchesCat = prodCategory.toLowerCase().includes(q);

        const isMatch = matchesName || matchesCode || matchesSec || matchesSub || matchesDesc || matchesFeat || matchesCol || matchesCat;
        if (!isMatch) return false;
      }

      // 1. Promo filter (if applied)
      if (activePromoFilter) {
        const promoLower = activePromoFilter.toLowerCase();
        const matchesPromo =
          (p.promotionTag && p.promotionTag.toLowerCase().includes(promoLower)) ||
          (p.section && p.section.toLowerCase().includes(promoLower)) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(promoLower)) ||
          (promoLower.includes('promo') && p.discountPercentage && p.discountPercentage > 0);
        if (!matchesPromo) return false;
      } else if (!q) {
        // Respect category filter with Unisex and Industrial rules
        const isInd = isIndustrialProduct(p);
        if (isInd) {
          // Industrial products go directly and exclusively to Venta Corporativa
          if (currentCategory !== 'Venta Corporativa') return false;
        } else {
          // Non-industrial items do not belong to Venta Corporativa
          if (currentCategory === 'Venta Corporativa') return false;
          if (currentCategory === 'Hombre') {
            // Appears in Hombre if category is Hombre or if marked Unisex
            if (prodCategory !== 'Hombre' && !p.isUnisex) return false;
          } else if (currentCategory === 'Mujer') {
            // Appears in Mujer if category is Mujer or if marked Unisex
            if (prodCategory !== 'Mujer' && !p.isUnisex) return false;
          } else if (currentCategory === 'Infantil') {
            if (prodCategory !== 'Infantil') return false;
          }
        }
      }

      // 2. Section/Line filter
      if (selectedSection !== 'Todas') {
        const sectionMatch =
          (p.section && p.section.toLowerCase() === selectedSection.toLowerCase()) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(selectedSection.toLowerCase())) ||
          (p.name && p.name.toLowerCase().includes(selectedSection.toLowerCase()));
        if (!sectionMatch) return false;
      }

      // 3. SubCategory filter
      if (selectedSubCategory && selectedSubCategory !== 'Ver Todo') {
        const subMatch =
          (p.subCategory && p.subCategory.toLowerCase() === selectedSubCategory.toLowerCase()) ||
          (p.name && p.name.toLowerCase().includes(selectedSubCategory.toLowerCase()));
        if (!subMatch) return false;
      }

      // 4. Color filter
      if (selectedColor) {
        const hasColor = p.availableColors?.some((c) =>
          c.toLowerCase().includes(selectedColor.toLowerCase())
        );
        if (!hasColor) return false;
      }

      return true;
    });
  }, [products, currentCategory, activeSearch, activePromoFilter, selectedSection, selectedSubCategory, selectedColor]);

  // Sort products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortOrder === 'precio-asc') {
      return list.sort((a, b) => {
        const priceA = a.discountPercentage ? a.price * (1 - a.discountPercentage / 100) : a.price;
        const priceB = b.discountPercentage ? b.price * (1 - b.discountPercentage / 100) : b.price;
        return priceA - priceB;
      });
    }
    if (sortOrder === 'precio-desc') {
      return list.sort((a, b) => {
        const priceA = a.discountPercentage ? a.price * (1 - a.discountPercentage / 100) : a.price;
        const priceB = b.discountPercentage ? b.price * (1 - b.discountPercentage / 100) : b.price;
        return priceB - priceA;
      });
    }
    if (sortOrder === 'nombre') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Default 'destacados'
    return list.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
  }, [filteredProducts, sortOrder]);

  return (
    <div className="min-h-screen bg-[#F5F2EC] text-[#22201D] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Navigation Breadcrumb / Category switcher */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-[#DCD4C9]/80 pb-4">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#6F6860] hover:text-[#18231C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            INICIO
          </button>

          {/* Quick main category pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {activeHierarchy.map((cat) => {
              const isSelected = currentCategory === cat.name && !activePromoFilter;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    if (activePromoFilter) onClearPromoFilter();
                    setSelectedSection('Todas');
                    setSelectedSubCategory(null);
                    onSelectCategory(cat.name);
                  }}
                  style={{
                    backgroundColor: isSelected ? (theme.primaryColor || '#18231C') : '#FFFFFF',
                    color: isSelected ? '#F5F2EC' : '#18231C',
                    borderColor: isSelected ? (theme.primaryColor || '#18231C') : '#DCD4C9',
                  }}
                  className="px-3.5 py-1.5 rounded-xs border text-xs font-bold uppercase tracking-[0.15em] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Header */}
        <div className="mb-8">
          <p 
            style={{ color: accent }}
            className="text-[11px] uppercase tracking-[0.25em] font-bold"
          >
            {activePromoFilter ? 'PROMOCIÓN VIGENTE' : 'CATÁLOGO OFICIAL'}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mt-1">
            <div>
              <h1 className="font-display text-5xl sm:text-6xl tracking-[0.04em] text-[#18231C] uppercase font-bold">
                {activePromoFilter ? activePromoFilter : currentCategory}
              </h1>
              <p className="mt-1 text-sm text-[#6F6860] font-sans">
                {activePromoFilter
                  ? 'Artículos seleccionados con descuento exclusivo en Pampero Gran Mendoza.'
                  : categoryTaglines[currentCategory]}
              </p>
            </div>

            {/* Active promo alert badge if filtered */}
            {activePromoFilter && (
              <button
                type="button"
                onClick={onClearPromoFilter}
                style={{
                  backgroundColor: `${accent}15`,
                  borderColor: accent,
                  color: accent,
                }}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs border text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <span>Filtro activo: {activePromoFilter}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Product Search Bar */}
        <div className="mb-6 bg-white p-3 sm:p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por nombre, código PAM (ej. PAM-101), sección o color..."
                className="w-full pl-10 pr-9 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs sm:text-sm text-[#18231C] placeholder-[#8C827A] focus:outline-none focus:border-[#FDB813] focus:bg-white transition-all font-medium"
              />
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#18231C] p-1 text-xs font-bold cursor-pointer"
                  title="Borrar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#6F6860] shrink-0">
              <span className="font-semibold text-[#18231C]">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'artículo' : 'artículos'}
                {activeSearch ? ` encontrados` : ''}
              </span>

              {activeSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  style={{ color: accent }}
                  className="text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-6 flex items-center justify-between bg-white p-3 rounded-xs border border-[#DCD4C9]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
            {filteredProducts.length} Artículos
          </span>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#18231C]"
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: accent }} />
            <span>Filtros & Categorías</span>
          </button>
        </div>

        {/* Main Grid: Sidebar + Products */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column Sidebar */}
          <aside className={`lg:col-span-3 space-y-8 ${mobileFilterOpen ? 'block' : 'hidden lg:block'}`}>
            
            {/* 1. SECCIONES Y SUBCATEGORÍAS JERÁRQUICAS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                  LÍNEAS / SECCIONES
                </h2>
                {(selectedSection !== 'Todas' || selectedSubCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSection('Todas');
                      setSelectedSubCategory(null);
                    }}
                    style={{ color: accent }}
                    className="text-[10px] uppercase tracking-wider font-semibold hover:underline cursor-pointer"
                  >
                    Ver Todas
                  </button>
                )}
              </div>

              <ul className="space-y-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSection('Todas');
                      setSelectedSubCategory(null);
                    }}
                    style={{
                      color: selectedSection === 'Todas' ? accent : undefined,
                      fontWeight: selectedSection === 'Todas' ? '700' : 'normal',
                    }}
                    className={`text-sm tracking-wide transition-colors cursor-pointer w-full text-left py-1 ${
                      selectedSection === 'Todas' ? '' : 'text-[#544E47] hover:text-[#18231C]'
                    }`}
                  >
                    Todas las líneas
                  </button>
                </li>

                {currentCategoryDef.sections.map((sec) => {
                  const isSectionActive = selectedSection === sec.name;
                  return (
                    <li key={sec.name} className="border-b border-[#DCD4C9]/40 pb-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSectionActive) {
                            setSelectedSection('Todas');
                            setSelectedSubCategory(null);
                          } else {
                            setSelectedSection(sec.name);
                            setSelectedSubCategory(null);
                          }
                        }}
                        style={{
                          color: isSectionActive ? accent : undefined,
                        }}
                        className={`text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-between w-full py-1 ${
                          isSectionActive ? 'font-bold' : 'text-[#544E47] hover:text-[#18231C]'
                        }`}
                      >
                        <span>{sec.name}</span>
                        {isSectionActive ? (
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: accent }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </button>

                      {/* Subcategories dropdown under section */}
                      {isSectionActive && (
                        <ul className="mt-1.5 ml-3 space-y-1 pl-2 border-l-2 border-[#DCD4C9]">
                          {sec.subCategories.map((sub) => {
                            const isSubActive = selectedSubCategory === sub;
                            return (
                              <li key={sub}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubCategory(isSubActive ? null : sub)}
                                  style={{
                                    color: isSubActive ? accent : undefined,
                                    fontWeight: isSubActive ? '700' : 'normal',
                                  }}
                                  className={`text-xs tracking-wide transition-colors py-0.5 w-full text-left cursor-pointer ${
                                    isSubActive ? '' : 'text-neutral-600 hover:text-neutral-900'
                                  }`}
                                >
                                  {sub}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>


            {/* 3. ORDEN */}
            <div>
              <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-3">
                ORDENAR POR
              </h2>
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#DCD4C9] rounded-xs px-3.5 py-2.5 text-xs text-[#18231C] uppercase tracking-wider font-medium focus:outline-none focus:border-[#FDB813] cursor-pointer"
                >
                  <option value="destacados">Destacados y Ofertas</option>
                  <option value="precio-asc">Menor precio</option>
                  <option value="precio-desc">Mayor precio</option>
                  <option value="nombre">Nombre A-Z</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#6F6860] absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* 4. Link: Ver promociones vigentes */}
            <div className="pt-2 border-t border-[#DCD4C9]/60">
              <button
                type="button"
                onClick={onOpenPromos}
                style={{ color: accent }}
                className="text-xs underline font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all cursor-pointer"
              >
                Ver promociones vigentes
              </button>
            </div>

          </aside>

          {/* Right Column: 4-Column Product Grid */}
          <main className="lg:col-span-9">
            {/* Results count & Active filters info */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#DCD4C9]/60 text-xs text-[#6F6860]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#18231C]">
                  {sortedProducts.length} artículos encontrados
                </span>
                {selectedSection !== 'Todas' && (
                  <span className="bg-neutral-200/80 text-neutral-800 px-2 py-0.5 rounded-xs font-medium">
                    Línea: {selectedSection}
                  </span>
                )}
                {selectedSubCategory && (
                  <span className="bg-neutral-200/80 text-neutral-800 px-2 py-0.5 rounded-xs font-medium">
                    {selectedSubCategory}
                  </span>
                )}
                {selectedColor && (
                  <span className="bg-neutral-200/80 text-neutral-800 px-2 py-0.5 rounded-xs font-medium flex items-center gap-1">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getColorHex(selectedColor) }} 
                    />
                    Color: {selectedColor}
                  </span>
                )}
              </div>
            </div>

            {/* Products Grid: 2 columns on mobile, 4 columns on large screens */}
            {sortedProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
                {sortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    userSession={userSession}
                    theme={theme}
                    promotions={promotions}
                    onViewDetail={handleOpenProduct}
                    onQuickAdd={onQuickAddProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white/50 border border-[#DCD4C9] rounded-xs px-4">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#6F6860]">
                  {activeSearch 
                    ? `No se encontraron artículos para "${activeSearch}"`
                    : 'No se encontraron productos con los filtros seleccionados'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange('')}
                      style={{ backgroundColor: accent }}
                      className="px-5 py-2.5 text-xs text-white uppercase tracking-wider font-bold rounded-xs cursor-pointer shadow-xs"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange('');
                      setSelectedSection('Todas');
                      setSelectedSubCategory(null);
                      setSelectedColor(null);
                      if (activePromoFilter) onClearPromoFilter();
                    }}
                    className="px-5 py-2.5 text-xs text-[#18231C] border border-[#18231C] uppercase tracking-wider font-bold rounded-xs cursor-pointer hover:bg-[#18231C] hover:text-white transition-colors"
                  >
                    Restablecer todos los filtros
                  </button>
                </div>
              </div>
            )}

            {/* Vistos recientemente memory section */}
            {recentlyViewed.length > 0 && (
              <div className="mt-16 pt-8 border-t border-[#DCD4C9]">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4" style={{ color: accent }} />
                  <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-neutral-700">
                    Vistos recientemente en tu navegación
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {recentlyViewed.map((p: Product) => (
                    <div 
                      key={`recent-${p.id}`}
                      onClick={() => onViewProductDetail(p)}
                      className="group cursor-pointer bg-white p-2.5 rounded-xs border border-[#DCD4C9] hover:border-neutral-700 transition-all shadow-2xs"
                    >
                      <img 
                        src={p.image} 
                        alt={p.name} 
                        className="w-full aspect-square object-cover rounded-xs" 
                      />
                      <p className="mt-1.5 text-xs font-semibold text-neutral-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] font-bold" style={{ color: accent }}>
                        $ {p.price.toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
