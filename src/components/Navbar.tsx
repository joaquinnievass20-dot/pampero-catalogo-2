import React, { useState, useEffect, useRef } from 'react';
import { 
  MainCategory, 
  Promotion, 
  UserSession, 
  ThemeConfig 
} from '../types';
import { CATEGORY_HIERARCHY } from '../data/categories';
import { CorporateServicesDropdown } from './CorporateServicesDropdown';
import { PamperoLogo } from './PamperoLogo';
import { UserNavMenu } from './UserNavMenu';
import { isColorDark } from '../context/ThemeContext';
import { 
  ShoppingBag, 
  User, 
  Menu, 
  X, 
  Tag, 
  ChevronDown, 
  ShieldCheck, 
  LogOut, 
  Settings, 
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
  onOpenRRHH?: () => void;
  onOpenCosts?: () => void;
  onOpenHub?: () => void;
  promotions: Promotion[];
  activePromoFilter: string | null;
  onSelectPromo: (promo: Promotion) => void;
  theme: ThemeConfig;
  unreadChatCount?: number;
  onOpenChat?: () => void;
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
  onOpenRRHH,
  onOpenCosts,
  onOpenHub,
  promotions,
  activePromoFilter,
  onSelectPromo,
  theme,
  unreadChatCount = 0,
  onOpenChat,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<number | null>(null);

  // Shrink on scroll effect states (> 50px)
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      if (scrollPos > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ACÁ CONSUMIMOS LAS VARIABLES ESPECÍFICAS Y AISLADAS DEL NAVBAR
  const navBg = theme.navbarBgColor || theme.headerBgColor || '#FFFFFF';
  const isNavDark = isColorDark(navBg);
  const navTextColor = theme.navbarTextColor || theme.headerTextColor || (isNavDark ? '#F5F2EC' : '#22201D');
  const accent = theme.navbarSecondaryTextColor || theme.headerAccentColor || theme.accentColor || '#FDB813';
  const hoverAccent = theme.navbarButtonHoverBg || theme.hoverAccentColor || '#E0A310';
  const navBorder = theme.navbarBorderColor || theme.headerBorderColor || (isNavDark ? 'rgba(255, 255, 255, 0.15)' : '#E5E5E5');
  const iconColor = theme.iconColor || accent;

  const hexToRgba = (hexColor: string, alpha: number, fallbackRgba: string): string => {
    const clean = (hexColor || '').trim();
    if (!clean.startsWith('#')) return fallbackRgba;
    const raw = clean.slice(1);
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (full.length !== 6) return fallbackRgba;
    const num = parseInt(full, 16);
    if (isNaN(num)) return fallbackRgba;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  const scrolledBg = hexToRgba(
    navBg,
    0.46,
    isNavDark ? 'rgba(24, 35, 28, 0.46)' : 'rgba(255, 255, 255, 0.46)'
  );

  const mainCategories: MainCategory[] = ['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'];

  const getCategoryLabel = (cat: MainCategory) => {
    if (cat === 'Hombre') return theme.siteTexts?.navHombreText || 'Hombre';
    if (cat === 'Mujer') return theme.siteTexts?.navMujerText || 'Mujer';
    if (cat === 'Infantil') return theme.siteTexts?.navInfantilText || 'Infantil';
    if (cat === 'Venta Corporativa') return theme.siteTexts?.navCorporativaText || 'Venta Corporativa';
    return cat;
  };

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

  const isCompressActive = isScrolled;

  return (
    <header 
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        isScrolled ? 'shadow-xs backdrop-blur-lg' : 'shadow-xs'
      }`}
      style={{
        backgroundColor: isScrolled ? scrolledBg : navBg,
        borderColor: isScrolled
          ? (isNavDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
          : navBorder,
        backdropFilter: isScrolled ? 'blur(14px) saturate(140%)' : undefined,
        WebkitBackdropFilter: isScrolled ? 'blur(14px) saturate(140%)' : undefined,
      }}
    >
      {/* Barra Principal: Logo Dinámico (Izquierda al inicio, Centrado al scrollear) + Categorías + UserNavMenu */}
      <div 
        className={`relative flex items-center justify-between max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 transition-all duration-300 ${
          isScrolled ? 'min-h-[44px] sm:min-h-[48px] py-1' : 'min-h-[58px] sm:min-h-[66px] py-2.5 sm:py-3.5'
        }`}
      >
        {/* LADO IZQUIERDO: Logo (cuando estamos arriba) + Categorías (se ocultan al scrollear) */}
        <div className="flex items-center gap-2 lg:gap-4 z-20 min-w-0 shrink">
          {/* Botón Menú Móvil (< lg) o Botón Categorías compacto cuando está scrolleado */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-xs hover:bg-black/5 text-neutral-800 transition-colors cursor-pointer flex items-center gap-1.5 ${
              isScrolled ? 'flex' : 'lg:hidden'
            }`}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de categorías'}
            title="Categorías y Secciones"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {isScrolled && (
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
                Categorías
              </span>
            )}
          </button>

          {/* Logo a la izquierda cuando estamos arriba (!isScrolled) */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`cursor-pointer shrink-0 flex items-center pr-2 transition-all duration-300 ${
              isScrolled ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100 hover:opacity-95'
            }`}
            title="Pampero Gran Mendoza · Volver arriba"
          >
            <PamperoLogo 
              customUrl={theme.customLogoUrl || theme.logoUrl} 
              height={Math.min(theme.logoHeight || 44, 46)} 
              navBgColor={navBg} 
            />
          </div>

          {/* Categorías Principales directas: Hombre, Mujer, Infantil, Venta Corporativa (se ocultan al scrollear) */}
          <nav 
            className={`transition-all duration-300 items-center gap-x-1 xl:gap-x-2 ${
              isScrolled 
                ? 'opacity-0 max-w-0 overflow-hidden pointer-events-none hidden' 
                : 'hidden lg:flex'
            }`} 
            aria-label="Categorías principales"
          >
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
                      color: (isCurrent || isDropdownOpen) ? accent : navTextColor,
                      borderBottomColor: isCurrent ? accent : 'transparent',
                    }}
                    className="py-2 px-2 xl:px-3 font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer font-display border-b-2 hover:text-amber-500 hover:border-amber-500 whitespace-nowrap"
                  >
                    <span>{getCategoryLabel(cat)}</span>
                    {categoryDef?.sections && categoryDef.sections.length > 0 && (
                      <ChevronDown 
                        className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : 'opacity-60'}`} 
                      />
                    )}
                  </button>

                  {/* Mega Menu Flyout Dropdown */}
                  {isDropdownOpen && categoryDef?.sections && categoryDef.sections.length > 0 && (
                    <div 
                      className="absolute top-full left-0 w-[640px] max-w-[80vw] bg-white rounded-b-xs shadow-2xl border border-neutral-200 p-5 z-50 animate-fadeIn"
                      style={{ borderTopColor: accent, borderTopWidth: '3px' }}
                    >
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-100">
                        <div>
                          <span className="font-display text-sm font-bold text-neutral-900 tracking-wide uppercase">
                            Catálogo {cat}
                          </span>
                          <span className="text-[11px] text-neutral-500 ml-2 font-normal">
                            Seleccioná una sección para filtrar
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
                          className="text-xs font-bold uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Ver Todo {cat} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {categoryDef.sections.map((sec) => (
                          <div key={sec.name} className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat);
                                onSelectSection(sec.name);
                                onSelectSubCategory('Todos');
                                setActiveDropdown(null);
                              }}
                              className="font-display font-bold text-xs uppercase tracking-wider block text-left text-neutral-900 transition-colors flex items-center gap-1.5 hover:text-amber-600 cursor-pointer"
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: accent }} 
                              />
                              <span>{sec.name}</span>
                            </button>

                            <div className="pl-3 space-y-0.5 border-l border-neutral-200">
                              {sec.subCategories.slice(0, 6).map((sub) => {
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
                                    className="text-[11px] text-neutral-600 hover:text-black block text-left truncate w-full transition-colors py-0.5 cursor-pointer"
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

            {/* Venta Corporativa */}
            <div className="ml-1">
              <CorporateServicesDropdown
                onOpenLookbook={onOpenLookbook || (() => {})}
                onOpenSizingPortal={onOpenSizingPortal || (() => {})}
                onOpenUniformSimulator={onOpenUniformSimulator || (() => {})}
                theme={theme}
              />
            </div>
          </nav>
        </div>

        {/* LOGO CENTRADO AL SCROLLEAR (isScrolled) */}
        {isScrolled && (
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center cursor-pointer select-none max-h-10 overflow-hidden px-2 hover:opacity-95 transition-all duration-300" 
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Pampero Gran Mendoza · Volver arriba"
          >
            <PamperoLogo 
              customUrl={theme.customLogoUrl || theme.logoUrl} 
              height={Math.min(theme.logoHeight || 30, 30)} 
              navBgColor={navBg} 
            />
          </div>
        )}

        {/* LADO DERECHO: USER NAV MENU (Mi Pedido + Usuario Cuadrado) */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 z-20 shrink-0">

          {/* Menú de Usuario Unificado & Mi Pedido (Permanente, no desaparece al scrollear) */}
          <UserNavMenu
            userSession={userSession}
            cartCount={cartCount}
            onOpenCart={onOpenCart}
            onOpenAuth={onOpenAuth}
            onLogout={onLogout}
            onOpenAdmin={onOpenAdmin}
            onOpenCRM={onOpenCRM}
            onOpenRRHH={onOpenRRHH}
            onOpenCosts={onOpenCosts}
            onOpenHub={onOpenHub}
            onOpenProfile={onOpenProfile}
            onOpenUniformSimulator={onOpenUniformSimulator}
            onOpenSizingPortal={onOpenSizingPortal}
            theme={theme}
            isDarkHeader={isNavDark}
            squareTrigger={true}
            unreadChatCount={unreadChatCount}
            onOpenChat={onOpenChat}
          />
        </div>
      </div>

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
                  <span>Portal de Talles para Colaboradores</span>
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