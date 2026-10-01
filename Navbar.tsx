import React, { useState, useEffect, useRef } from 'react';
import { 
  MainCategory, 
  Promotion, 
  UserSession, 
  ThemeConfig 
} from '../types';
import { CATEGORY_HIERARCHY } from '../data/categories';
import { CorporateServicesDropdown } from './CorporateServicesDropdown';
import { 
  Search, 
  ShoppingBag, 
  User, 
  Menu, 
  X, 
  Tag, 
  ChevronDown, 
  Building2, 
  ShieldCheck, 
  LogOut, 
  Phone,
  Settings,
  History,
  TrendingUp,
  ArrowRight,
  Compass,
  Briefcase
} from 'lucide-react';

interface NavbarProps {
  currentCategory: MainCategory;
  currentSection: string;
  currentSubCategory: string;
  onSelectCategory: (cat: MainCategory) => void;
  onSelectSection: (sec: string) => void;
  onSelectSubCategory: (sub: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  userSession: UserSession | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenProfile?: () => void;
  onOpenLookbook?: () => void;
  onOpenUniformSimulator?: () => void;
  onOpenSizingPortal?: () => void;
  onOpenCRM?: () => void;
  onOpenHub?: () => void;
  promotions: Promotion[];
  activePromoFilter: string | null;
  onSelectPromo: (promo: Promotion) => void;
  theme: ThemeConfig;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCategory,
  currentSection,
  currentSubCategory,
  onSelectCategory,
  onSelectSection,
  onSelectSubCategory,
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  userSession,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenProfile,
  onOpenLookbook,
  onOpenUniformSimulator,
  onOpenSizingPortal,
  onOpenCRM,
  onOpenHub,
  promotions,
  activePromoFilter,
  onSelectPromo,
  theme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const dropdownTimeoutRef = useRef<number | null>(null);

  // ACÁ REEMPLAZAMOS EL TERRACOTA POR EL AMARILLO OFICIAL DE PAMPERO
  const accent = theme.accentColor || '#FDB813';
  const hoverAccent = theme.hoverAccentColor || '#E0A310';
  const iconColor = theme.iconColor || accent;

  const userKey = userSession?.email ? userSession.email.toLowerCase().trim() : 'guest';
  const userSearchHistoryKey = `pampero_search_history_${userKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(userSearchHistoryKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 5));
          return;
        }
      }
      setRecentSearches([]);
    } catch {
      setRecentSearches([]);
    }
  }, [userSearchHistoryKey]);

  const recordSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;

    try {
      const existingHistory: string[] = JSON.parse(localStorage.getItem(userSearchHistoryKey) || '[]');
      const filtered = [trimmed, ...existingHistory.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      localStorage.setItem(userSearchHistoryKey, JSON.stringify(filtered));
      setRecentSearches(filtered.slice(0, 5));

      const metricsRaw = localStorage.getItem('pampero_search_analytics') || '{}';
      const metrics: Record<string, { count: number; lastSearched: string }> = JSON.parse(metricsRaw);
      const key = trimmed.toLowerCase();
      metrics[key] = {
        count: (metrics[key]?.count || 0) + 1,
        lastSearched: new Date().toISOString(),
      };
      localStorage.setItem('pampero_search_analytics', JSON.stringify(metrics));
    } catch {}
  };

  const handleSearchSubmit = (term: string) => {
    onSearchChange(term);
    recordSearch(term);
    setIsSearchFocused(false);
  };

  const mainCategories: MainCategory[] = ['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'];

  const getClientName = () => {
    if (!userSession) return '';
    if (userSession.clientData?.fullName) return userSession.clientData.fullName;
    if (userSession.clientData?.companyName) return userSession.clientData.companyName;
    if (userSession.email) return userSession.email.split('@')[0];
    return 'Mi Cuenta';
  };

  const handleDropdownEnter = (cat: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(cat);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-xs border-b border-neutral-200">
      <div 
        className="text-white text-[11px] py-1.5 px-4 sm:px-8 border-b border-black/30 transition-colors select-none"
        style={{ backgroundColor: theme.primaryColor || '#18231C' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-4 text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3 h-3" style={{ color: accent }} />
              Ventas WhatsApp: <strong>+{theme.whatsappNumber || '5492615276713'}</strong>
            </span>
            <span className="hidden md:inline text-neutral-500">|</span>
            <span className="hidden md:inline text-neutral-300">
              Distribución oficial en Gran Mendoza
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userSession ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1 font-semibold text-white hover:text-amber-300 transition-colors p-1 rounded-xs hover:bg-white/10 cursor-pointer"
                  title="Editar mis datos de contacto y dirección"
                >
                  {userSession.role === 'admin' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : userSession.role === 'employee' ? (
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  ) : userSession.clientType === 'empresa' ? (
                    <Building2 className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{getClientName()}</span>
                </button>

                {(userSession.role === 'admin' || userSession.role === 'employee') && onOpenHub && (
                  <button
                    type="button"
                    onClick={onOpenHub}
                    className="flex items-center gap-1 font-bold text-amber-300 hover:text-white transition-colors px-2 py-0.5 rounded-xs bg-black/30 hover:bg-black/50 text-[10px] uppercase tracking-wider cursor-pointer"
                    title="Ir al Hub de Trabajo Interno"
                  >
                    <Compass className="w-3 h-3 text-amber-400" />
                    <span className="hidden sm:inline">Hub de Trabajo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLogout}
                  className="text-neutral-400 hover:text-white p-0.5 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="hover:text-white font-bold transition-colors flex items-center gap-1 text-xs"
                style={{ color: '#F5F2EC' }}
              >
                <User className="w-3.5 h-3.5" style={{ color: accent }} /> Iniciar Sesión / Crear Cuenta
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          
          {/* LOGO BLOQUEADO ESTRICTAMENTE POR CSS */}
          <div 
            className="cursor-pointer shrink-0" 
            onClick={() => {
              onSelectCategory('Hombre');
              onSelectSection('Todos');
              onSelectSubCategory('Todos');
            }}
          >
            <img 
              src="/logo-oficial.png.png" 
              alt="Pampero Indumentaria" 
              className="h-14 w-auto object-contain shrink-0" 
              onError={(e) => {
                if (e.currentTarget.src !== window.location.origin + '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
          </div>

          <div className="hidden sm:flex flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="main-search-input"
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsSearchFocused(false), 250);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(searchQuery);
                }
              }}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar en el catálogo (bombacha, borcego, campera)..."
              className="w-full pl-10 pr-8 py-2 text-xs rounded-full border border-neutral-300 outline-none bg-neutral-50/70 transition-all"
              style={{
                borderColor: isSearchFocused ? accent : undefined,
                boxShadow: isSearchFocused ? `0 0 0 2px ${accent}22` : undefined,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            )}

            {isSearchFocused && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 z-50 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3" style={{ color: accent }} /> Búsquedas recientes
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      localStorage.removeItem('pampero_search_history');
                      setRecentSearches([]);
                    }}
                    className="text-neutral-400 hover:text-neutral-700 normal-case tracking-normal"
                  >
                    Borrar historial
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSearchSubmit(term);
                      }}
                      className="px-2.5 py-1 rounded-full text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center gap-1 transition-colors"
                    >
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-open-quote-drawer"
              type="button"
              onClick={onOpenCart}
              className="relative p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-all flex items-center gap-2 cursor-pointer"
              title="Ver lista de cotización"
            >
              <ShoppingBag className="w-5 h-5" style={{ color: iconColor }} />
              <span className="hidden md:inline font-bold text-xs text-neutral-900">Cotización</span>
              {cartCount > 0 && (
                <span 
                  style={{ backgroundColor: accent }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-xs"
                >
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-neutral-700 hover:bg-neutral-100"
              aria-label="Menú móvil"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <div className="sm:hidden mt-3 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                recordSearch(searchQuery);
              }
            }}
            placeholder="Buscar en el catálogo..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 outline-none"
          />
        </div>
      </div>

      <nav className="hidden lg:block border-t border-neutral-200 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            {mainCategories.map((cat) => {
              const categoryDef = CATEGORY_HIERARCHY.find((c) => c.name === cat);
              const isCurrent = currentCategory === cat;
              const isDropdownOpen = activeDropdown === cat;

              return (
                <div
                  key={cat}
                  className="relative group"
                  onMouseEnter={() => handleDropdownEnter(cat)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat);
                      onSelectSection('Todos');
                      onSelectSubCategory('Todos');
                      setActiveDropdown(null);
                    }}
                    style={{
                      borderColor: (isCurrent || isDropdownOpen) ? accent : 'transparent',
                      color: (isCurrent || isDropdownOpen) ? accent : '#22201D',
                      backgroundColor: isDropdownOpen ? `${accent}0A` : 'transparent',
                    }}
                    className="py-3.5 px-5 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all border-b-2 cursor-pointer font-display"
                  >
                    {cat}
                    {categoryDef?.sections && categoryDef.sections.length > 0 && (
                      <ChevronDown 
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : 'opacity-60'}`} 
                      />
                    )}
                  </button>

                  {isDropdownOpen && categoryDef?.sections && categoryDef.sections.length > 0 && (
                    <div 
                      className="absolute top-full left-0 w-[720px] max-w-[85vw] bg-white rounded-b-xl shadow-2xl border border-neutral-200 p-6 z-50 animate-fadeIn"
                      style={{ borderTopColor: accent, borderTopWidth: '3px' }}
                    >
                      <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
                        <div>
                          <span className="font-display text-base font-bold text-neutral-900 tracking-wide uppercase">
                            Catálogo {cat}
                          </span>
                          <span className="text-[11px] text-neutral-500 ml-2 font-normal">
                            Seleccioná una sección o subcategoría para filtrar
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat);
                            onSelectSection('Todos');
                            onSelectSubCategory('Todos');
                            setActiveDropdown(null);
                          }}
                          style={{ color: accent }}
                          className="text-xs font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                        >
                          Ver Todo {cat} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {categoryDef.sections.map((sec) => (
                          <div key={sec.name} className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat);
                                onSelectSection(sec.name);
                                onSelectSubCategory('Todos');
                                setActiveDropdown(null);
                              }}
                              className="font-display font-bold text-xs uppercase tracking-wider block text-left text-neutral-900 transition-colors group/sec flex items-center gap-1.5"
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: accent }} 
                              />
                              <span className="group-hover/sec:underline">{sec.name}</span>
                            </button>

                            <div className="pl-3 space-y-1 border-l border-neutral-200">
                              {sec.subCategories.map((sub) => {
                                const isSubActive = currentCategory === cat && currentSection === sec.name && currentSubCategory === sub;
                                return (
                                  <button
                                    key={sub}
                                    type="button"
                                    onClick={() => {
                                      onSelectCategory(cat);
                                      onSelectSection(sec.name);
                                      onSelectSubCategory(sub);
                                      setActiveDropdown(null);
                                    }}
                                    style={{
                                      color: isSubActive ? accent : undefined,
                                      fontWeight: isSubActive ? 700 : 400,
                                    }}
                                    className="text-[11px] text-neutral-600 hover:text-black block text-left truncate w-full transition-colors py-0.5 hover:translate-x-0.5"
                                  >
                                    {sub}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Menú unificado obligatorio: Servicios Corporativos (Catálogo Interactivo, Portal de Talles, Armador de Uniformes) */}
            <div className="ml-3 py-2 flex items-center">
              <CorporateServicesDropdown
                onOpenLookbook={onOpenLookbook || (() => {})}
                onOpenSizingPortal={onOpenSizingPortal || (() => {})}
                onOpenUniformSimulator={onOpenUniformSimulator || (() => {})}
                theme={theme}
              />
            </div>
          </div>

          {promotions.length > 0 && (
            <div className="flex items-center gap-2 py-2">
              {promotions.slice(0, 2).map((promo) => (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => onSelectPromo(promo)}
                  style={{
                    backgroundColor: activePromoFilter === promo.tagFilter ? accent : `${accent}12`,
                    color: activePromoFilter === promo.tagFilter ? '#FFFFFF' : accent,
                  }}
                  className="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all shadow-2xs hover:scale-[1.02]"
                >
                  <Tag className="w-3 h-3" />
                  {promo.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-neutral-200 p-4 space-y-4 animate-fadeIn max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
              Grandes Categorías
            </span>
            {mainCategories.map((cat) => {
              const isCurrent = currentCategory === cat;
              const def = CATEGORY_HIERARCHY.find((c) => c.name === cat);
              return (
                <div key={cat} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat);
                      onSelectSection('Todos');
                      onSelectSubCategory('Todos');
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      backgroundColor: isCurrent ? `${accent}15` : undefined,
                      color: isCurrent ? accent : undefined,
                    }}
                    className="w-full text-left py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex justify-between items-center text-neutral-800"
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] text-neutral-400">Ver Todo →</span>
                  </button>

                  {def?.sections && (
                    <div className="pl-4 space-y-1">
                      {def.sections.map((sec) => (
                        <div key={sec.name} className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCategory(cat);
                              onSelectSection(sec.name);
                              onSelectSubCategory('Todos');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full text-left font-bold text-xs text-neutral-800 hover:text-black flex items-center gap-1"
                          >
                            • {sec.name}
                          </button>
                          <div className="pl-3 mt-1 flex flex-wrap gap-1">
                            {sec.subCategories.slice(0, 5).map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => {
                                  onSelectCategory(cat);
                                  onSelectSection(sec.name);
                                  onSelectSubCategory(sub);
                                  setMobileMenuOpen(false);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                              >
                                {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Menú unificado móvil: Servicios Corporativos */}
          <div className="pt-3 border-t border-neutral-200 space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
              Servicios Corporativos
            </span>
            <div className="space-y-1">
              {onOpenLookbook && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenLookbook();
                  }}
                  className="w-full text-left py-2 px-3 rounded-lg text-xs font-bold text-neutral-800 hover:bg-neutral-100 flex items-center justify-between"
                >
                  <span>Catálogo Interactivo / Lookbook</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              )}
              {onOpenSizingPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSizingPortal();
                  }}
                  className="w-full text-left py-2 px-3 rounded-lg text-xs font-bold text-neutral-800 hover:bg-neutral-100 flex items-center justify-between"
                >
                  <span>Portal de Talles para Empleados</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              )}
              {onOpenUniformSimulator && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenUniformSimulator();
                  }}
                  className="w-full text-left py-2 px-3 rounded-lg text-xs font-bold text-neutral-800 hover:bg-neutral-100 flex items-center justify-between"
                >
                  <span>Armador de Uniformes Virtual</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 space-y-2">
            {userSession ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">
                  {getClientName()}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-xs text-red-600 font-bold"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                style={{ backgroundColor: accent }}
                className="w-full py-2 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Iniciar Sesión / Crear Cuenta
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};