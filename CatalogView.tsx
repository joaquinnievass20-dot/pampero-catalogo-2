import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, UserSession, ThemeConfig, MainCategory, Promotion } from '../types';
import { ProductCard } from './ProductCard';
import { CATEGORY_HIERARCHY, CategoryStructure, loadStoredCategoryHierarchy } from '../data/categories';
import { getColorHex } from '../utils/colorUtils';
import { trackSearchEvent, trackFilterEvent } from '../utils/analytics';
import { 
  ChevronDown, 
  ChevronRight, 
  SlidersHorizontal, 
  X, 
  ArrowLeft, 
  History, 
  Search,
  Filter,
  DollarSign,
  RotateCcw,
  Check,
  Tag
} from 'lucide-react';

export type PriceRangePreset = 'all' | 'under-40k' | '40k-75k' | '75k-120k' | 'over-120k' | 'custom';

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
  // Search state
  const [localSearch, setLocalSearch] = useState('');
  const activeSearch = searchQuery !== undefined && searchQuery !== '' ? searchQuery : localSearch;

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (onSearchChange) onSearchChange(val);
  };

  // Filter states
  const [selectedSection, setSelectedSection] = useState<string>('Todas');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<string>('destacados');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Price range filters
  const [priceRange, setPriceRange] = useState<PriceRangePreset>('all');
  const [customMinPrice, setCustomMinPrice] = useState<string>('');
  const [customMaxPrice, setCustomMaxPrice] = useState<string>('');
  const [isPriceDropdownOpen, setIsPriceDropdownOpen] = useState(false);
  const priceDropdownRef = useRef<HTMLDivElement>(null);

  // Reliable handler for opening product detail
  const handleOpenProduct = onViewProductDetail || onViewProduct || (() => {});

  const accent = theme.accentColor || '#FDB813';

  // Close price dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (priceDropdownRef.current && !priceDropdownRef.current.contains(e.target as Node)) {
        setIsPriceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Helper to normalize category
  const sanitizeCategory = (rawCat: any): MainCategory => {
    if (!rawCat) return 'Hombre';
    const str = String(rawCat).trim();
    if (str === 'Mujer' || str === '1') return 'Mujer';
    if (str === 'Infantil' || str === '2') return 'Infantil';
    if (str === 'Venta Corporativa' || str === '3') return 'Venta Corporativa';
    const s = str.toLowerCase();
    if (s.includes('mujer')) return 'Mujer';
    if (s.includes('infan') || s.includes('niñ')) return 'Infantil';
    if (s.includes('corp') || s.includes('venta')) return 'Venta Corporativa';
    if (str.length > 0) return str as MainCategory;
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

  // Extract all unique available subcategories for this category (ignoring out of stock)
  const availableSubCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.inStock === false) return;
      const cat = sanitizeCategory(p.category);
      const isInd = isIndustrialProduct(p);
      let belongs = false;
      if (isInd) {
        belongs = currentCategory === 'Venta Corporativa';
      } else {
        if (currentCategory === 'Venta Corporativa') belongs = false;
        else if (currentCategory === 'Hombre') belongs = cat === 'Hombre' || Boolean(p.isUnisex);
        else if (currentCategory === 'Mujer') belongs = cat === 'Mujer' || Boolean(p.isUnisex);
        else belongs = cat === currentCategory;
      }
      if (belongs && p.subCategory) {
        set.add(p.subCategory.trim());
      }
    });
    return Array.from(set).sort();
  }, [products, currentCategory]);

  // Extract all unique colors from products for this category
  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products
      .filter((p) => {
        if (p.inStock === false) return false;
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
        if (Array.isArray(parsed)) return parsed.filter((p: Product) => p.inStock !== false).slice(0, 4);
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

  // Filter products according to stock, category, search, section, subcategory, color, promo, and price
  const filteredProducts = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();

    return products.filter((p) => {
      // 0. Control de Stock: Si el producto está marcado como sin stock (inStock === false), ocultarlo del catálogo público
      if (p.inStock === false) return false;

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
          if (currentCategory !== 'Venta Corporativa') return false;
        } else {
          if (currentCategory === 'Venta Corporativa') return false;
          if (currentCategory === 'Hombre') {
            if (prodCategory !== 'Hombre' && !p.isUnisex) return false;
          } else if (currentCategory === 'Mujer') {
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
      if (selectedSubCategory && selectedSubCategory !== 'Todas') {
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

      // 5. Price range filter
      const effectivePrice = p.discountPercentage && p.discountPercentage > 0
        ? Math.round(p.price * (1 - p.discountPercentage / 100))
        : p.price;

      if (priceRange === 'under-40k' && effectivePrice > 40000) return false;
      if (priceRange === '40k-75k' && (effectivePrice < 40000 || effectivePrice > 75000)) return false;
      if (priceRange === '75k-120k' && (effectivePrice < 75000 || effectivePrice > 120000)) return false;
      if (priceRange === 'over-120k' && effectivePrice < 120000) return false;
      if (priceRange === 'custom') {
        const minVal = customMinPrice !== '' ? Number(customMinPrice) : null;
        const maxVal = customMaxPrice !== '' ? Number(customMaxPrice) : null;
        if (minVal !== null && !isNaN(minVal) && effectivePrice < minVal) return false;
        if (maxVal !== null && !isNaN(maxVal) && effectivePrice > maxVal) return false;
      }

      return true;
    });
  }, [
    products, 
    currentCategory, 
    activeSearch, 
    activePromoFilter, 
    selectedSection, 
    selectedSubCategory, 
    selectedColor, 
    priceRange, 
    customMinPrice, 
    customMaxPrice
  ]);

  // Track search metrics when query changes with results
  useEffect(() => {
    if (activeSearch.trim().length >= 2) {
      const timeout = setTimeout(() => {
        trackSearchEvent(activeSearch, filteredProducts.length);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [activeSearch, filteredProducts.length]);

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

  const handleResetAllFilters = () => {
    handleSearchChange('');
    setSelectedSection('Todas');
    setSelectedSubCategory(null);
    setSelectedColor(null);
    setPriceRange('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    if (activePromoFilter) onClearPromoFilter();
  };

  const hasAnyActiveFilter = Boolean(
    activeSearch ||
    selectedSection !== 'Todas' ||
    selectedSubCategory ||
    selectedColor ||
    priceRange !== 'all' ||
    activePromoFilter
  );

  const priceRangeLabel: Record<PriceRangePreset, string> = {
    all: 'Todos los precios',
    'under-40k': 'Hasta $40.000',
    '40k-75k': '$40.000 a $75.000',
    '75k-120k': '$75.000 a $120.000',
    'over-120k': 'Más de $120.000',
    custom: customMinPrice || customMaxPrice 
      ? `$${customMinPrice || '0'} - $${customMaxPrice || '∞'}`
      : 'Personalizado',
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC] text-[#22201D] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Navigation Breadcrumb / Category switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#DCD4C9]/80 pb-4">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#6F6860] hover:text-[#18231C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            INICIO
          </button>

          {/* Quick main category pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
                    trackFilterEvent('category', cat.name);
                  }}
                  style={{
                    backgroundColor: isSelected ? (theme.primaryColor || '#18231C') : '#FFFFFF',
                    color: isSelected ? '#F5F2EC' : '#18231C',
                    borderColor: isSelected ? (theme.primaryColor || '#18231C') : '#DCD4C9',
                  }}
                  className="px-3.5 py-1.5 rounded-xs border text-xs font-bold uppercase tracking-[0.15em] transition-all cursor-pointer shadow-2xs whitespace-nowrap hover:border-[#18231C]"
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Header */}
        <div className="mb-6">
          <p 
            style={{ color: accent }}
            className="text-[11px] uppercase tracking-[0.25em] font-bold"
          >
            {activePromoFilter ? 'PROMOCIÓN VIGENTE' : 'CATÁLOGO OFICIAL'}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mt-1">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-[0.04em] text-[#18231C] uppercase font-bold">
                {activePromoFilter ? activePromoFilter : currentCategory}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#6F6860] font-sans">
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

        {/* Buscador Rápido y Filtros Avanzados Minimalistas */}
        <div className="mb-8 space-y-3">
          {/* Main search and filter toolbar */}
          <div className="bg-white p-3 sm:p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Buscador Rápido */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={activeSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar por nombre, código PAM (ej. PAM-101), sección o color..."
                  className="w-full pl-10 pr-9 py-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs sm:text-sm text-[#18231C] placeholder-[#8C827A] focus:outline-none focus:border-[#18231C] focus:bg-white transition-all font-medium"
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

              {/* Price Filter Dropdown Pill */}
              <div className="relative shrink-0" ref={priceDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
                  className={`w-full md:w-auto px-3.5 py-2.5 rounded-xs border text-xs font-bold uppercase tracking-wider flex items-center justify-between md:justify-start gap-2 cursor-pointer transition-colors ${
                    priceRange !== 'all'
                      ? 'bg-[#18231C] text-white border-[#18231C]'
                      : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-white hover:border-[#18231C]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" style={{ color: priceRange !== 'all' ? accent : '#6F6860' }} />
                    <span>Precio: {priceRangeLabel[priceRange]}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                {/* Price popover */}
                {isPriceDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#18231C] rounded-xs shadow-xl p-3 z-30 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-1.5 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                        Filtrar por Precio
                      </span>
                      {priceRange !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPriceRange('all');
                            setCustomMinPrice('');
                            setCustomMaxPrice('');
                          }}
                          className="text-[10px] text-[#6F6860] hover:text-[#18231C] font-semibold"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {(
                        [
                          ['all', 'Todos los precios'],
                          ['under-40k', 'Hasta $40.000'],
                          ['40k-75k', '$40.000 a $75.000'],
                          ['75k-120k', '$75.000 a $120.000'],
                          ['over-120k', 'Más de $120.000'],
                        ] as [PriceRangePreset, string][]
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setPriceRange(key);
                            trackFilterEvent('price', label);
                            setIsPriceDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs flex items-center justify-between transition-colors ${
                            priceRange === key
                              ? 'bg-[#18231C] text-white font-bold'
                              : 'text-[#4A453F] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <span>{label}</span>
                          {priceRange === key && <Check className="w-3.5 h-3.5 text-[#FDB813]" />}
                        </button>
                      ))}
                    </div>

                    {/* Custom range input */}
                    <div className="pt-2 border-t border-[#DCD4C9] space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                        Rango Personalizado ($)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Mínimo"
                          value={customMinPrice}
                          onChange={(e) => {
                            setCustomMinPrice(e.target.value);
                            setPriceRange('custom');
                          }}
                          className="w-full px-2 py-1 text-xs border border-[#DCD4C9] rounded-xs text-[#18231C]"
                        />
                        <input
                          type="number"
                          placeholder="Máximo"
                          value={customMaxPrice}
                          onChange={(e) => {
                            setCustomMaxPrice(e.target.value);
                            setPriceRange('custom');
                          }}
                          className="w-full px-2 py-1 text-xs border border-[#DCD4C9] rounded-xs text-[#18231C]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPriceDropdownOpen(false)}
                        className="w-full py-1 text-center bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Order selector in toolbar */}
              <div className="relative shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    trackFilterEvent('sort', e.target.value);
                  }}
                  className="w-full md:w-auto appearance-none bg-[#FAF8F5] hover:bg-white border border-[#DCD4C9] rounded-xs pl-3 pr-8 py-2.5 text-xs text-[#18231C] uppercase tracking-wider font-bold focus:outline-none focus:border-[#18231C] cursor-pointer transition-colors"
                >
                  <option value="destacados">Destacados & Ofertas</option>
                  <option value="precio-asc">Menor precio</option>
                  <option value="precio-desc">Mayor precio</option>
                  <option value="nombre">Nombre A-Z</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#6F6860] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Quick Subcategory Pills Row */}
            {availableSubCategories.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#DCD4C9]/70 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] shrink-0">
                  Subcategorías:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubCategory(null);
                    trackFilterEvent('subcategory', 'Todas');
                  }}
                  className={`px-3 py-1 rounded-xs text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    !selectedSubCategory
                      ? 'bg-[#18231C] text-white'
                      : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-white hover:text-[#18231C] border border-[#DCD4C9]'
                  }`}
                >
                  Todas
                </button>
                {availableSubCategories.map((sub) => {
                  const isActive = selectedSubCategory === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setSelectedSubCategory(isActive ? null : sub);
                        trackFilterEvent('subcategory', sub);
                      }}
                      className={`px-3 py-1 rounded-xs text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-[#18231C] text-white'
                          : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-white hover:text-[#18231C] border border-[#DCD4C9]'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Filter Chips Bar */}
          {hasAnyActiveFilter && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/70 rounded-xs border border-[#DCD4C9] text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#18231C]" />
                Filtros activos:
              </span>

              {activeSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Búsqueda: &ldquo;{activeSearch}&rdquo;
                  <button type="button" onClick={() => handleSearchChange('')} className="hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedSection !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Línea: {selectedSection}
                  <button type="button" onClick={() => setSelectedSection('Todas')} className="hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedSubCategory && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Subcategoría: {selectedSubCategory}
                  <button type="button" onClick={() => setSelectedSubCategory(null)} className="hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {priceRange !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Precio: {priceRangeLabel[priceRange]}
                  <button 
                    type="button" 
                    onClick={() => {
                      setPriceRange('all');
                      setCustomMinPrice('');
                      setCustomMaxPrice('');
                    }} 
                    className="hover:text-rose-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedColor && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Color: {selectedColor}
                  <button type="button" onClick={() => setSelectedColor(null)} className="hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {activePromoFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[11px] font-medium">
                  Promo: {activePromoFilter}
                  <button type="button" onClick={onClearPromoFilter} className="hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetAllFilters}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* Mobile filter toggle button */}
        <div className="lg:hidden mb-6 flex items-center justify-between bg-white p-3 rounded-xs border border-[#DCD4C9]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
            {sortedProducts.length} {sortedProducts.length === 1 ? 'Artículo' : 'Artículos'}
          </span>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#18231C]"
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: accent }} />
            <span>{mobileFilterOpen ? 'Ocultar Filtros' : 'Filtros Laterales'}</span>
          </button>
        </div>

        {/* Main Grid: Sidebar + Products */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column Sidebar */}
          <aside className={`lg:col-span-3 space-y-6 ${mobileFilterOpen ? 'block' : 'hidden lg:block'}`}>
            
            {/* 1. SECCIONES Y SUBCATEGORÍAS JERÁRQUICAS */}
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9]">
              <div className="flex items-center justify-between mb-3 border-b border-[#DCD4C9] pb-2">
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

            {/* 2. RANGO DE PRECIO (SIDEBAR) */}
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] space-y-3">
              <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
                <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                  RANGO DE PRECIO
                </h2>
                {priceRange !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPriceRange('all');
                      setCustomMinPrice('');
                      setCustomMaxPrice('');
                    }}
                    style={{ color: accent }}
                    className="text-[10px] uppercase tracking-wider font-semibold hover:underline cursor-pointer"
                  >
                    Borrar
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    ['all', 'Todos los precios'],
                    ['under-40k', 'Hasta $40.000'],
                    ['40k-75k', '$40.000 a $75.000'],
                    ['75k-120k', '$75.000 a $120.000'],
                    ['over-120k', 'Más de $120.000'],
                  ] as [PriceRangePreset, string][]
                ).map(([key, label]) => (
                  <label 
                    key={key} 
                    className="flex items-center gap-2 cursor-pointer text-xs text-[#544E47] hover:text-[#18231C]"
                  >
                    <input
                      type="radio"
                      name="sidebarPriceRange"
                      checked={priceRange === key}
                      onChange={() => {
                        setPriceRange(key);
                        trackFilterEvent('price', label);
                      }}
                      className="text-[#18231C] focus:ring-[#FDB813]"
                    />
                    <span className={priceRange === key ? 'font-bold text-[#18231C]' : ''}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Custom Min / Max in Sidebar */}
              <div className="pt-2 border-t border-[#DCD4C9]/70 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                  Definir Mínimo y Máximo
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Mín $"
                    value={customMinPrice}
                    onChange={(e) => {
                      setCustomMinPrice(e.target.value);
                      setPriceRange('custom');
                    }}
                    className="w-full px-2 py-1 text-xs border border-[#DCD4C9] rounded-xs text-[#18231C]"
                  />
                  <input
                    type="number"
                    placeholder="Máx $"
                    value={customMaxPrice}
                    onChange={(e) => {
                      setCustomMaxPrice(e.target.value);
                      setPriceRange('custom');
                    }}
                    className="w-full px-2 py-1 text-xs border border-[#DCD4C9] rounded-xs text-[#18231C]"
                  />
                </div>
              </div>
            </div>

            {/* 3. COLORES DISPONIBLES */}
            {availableColors.length > 0 && (
              <div className="bg-white p-4 rounded-xs border border-[#DCD4C9]">
                <div className="flex items-center justify-between mb-3 border-b border-[#DCD4C9] pb-2">
                  <h2 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                    COLORES
                  </h2>
                  {selectedColor && (
                    <button
                      type="button"
                      onClick={() => setSelectedColor(null)}
                      style={{ color: accent }}
                      className="text-[10px] uppercase tracking-wider font-semibold hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isColActive = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(isColActive ? null : color)}
                        title={color}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-xs border text-xs transition-all cursor-pointer ${
                          isColActive
                            ? 'border-[#18231C] bg-[#18231C] text-white font-bold'
                            : 'border-[#DCD4C9] bg-white text-[#18231C] hover:border-[#18231C]'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" 
                          style={{ backgroundColor: getColorHex(color) }}
                        />
                        <span className="truncate max-w-[80px]">{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. ACCESO A PROMOS */}
            <div className="bg-[#18231C] text-[#F5F2EC] p-4 rounded-xs border border-[#18231C] space-y-2">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#FDB813] block">
                BENEFICIOS ESPECIALES
              </span>
              <p className="text-xs text-[#DCD4C9]">
                Descubrí los descuentos y promociones por cantidad o temporada vigentes.
              </p>
              <button
                type="button"
                onClick={onOpenPromos}
                className="w-full py-2 bg-[#FDB813] hover:bg-amber-400 text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors shadow-xs"
              >
                Ver Promociones
              </button>
            </div>

          </aside>

          {/* Right Column: Products Grid */}
          <main className="lg:col-span-9">
            {/* Results count header */}
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-[#DCD4C9]/70 text-xs text-[#6F6860]">
              <span className="font-bold text-[#18231C]">
                {sortedProducts.length} {sortedProducts.length === 1 ? 'artículo disponible' : 'artículos disponibles'}
              </span>
              <span className="text-[11px] text-[#6F6860]">
                Hacé clic en cualquier artículo para ver sus talles, colores y detalles
              </span>
            </div>

            {/* Products Grid */}
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
              <div className="py-20 text-center bg-white/60 border border-[#DCD4C9] rounded-xs px-4">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#6F6860]">
                  {activeSearch 
                    ? `No se encontraron artículos para "${activeSearch}"`
                    : 'No se encontraron artículos con los filtros seleccionados'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="px-5 py-2.5 text-xs text-white bg-[#18231C] hover:bg-black uppercase tracking-wider font-bold rounded-xs cursor-pointer shadow-xs transition-colors"
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
                      onClick={() => handleOpenProduct(p)}
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
