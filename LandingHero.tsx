import React, { useState, useEffect, useRef } from 'react';
import { MainCategory, UserSession, ThemeConfig, Promotion, PromotionButton, CategoryHierarchyItem } from '../types';
import { PamperoLogo } from './PamperoLogo';
import { CategoryMenuNav } from './CategoryMenuNav';
import { UserNavMenu } from './UserNavMenu';
import { 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  ShoppingBag,
  LogOut,
  Settings,
  Tag,
  Sparkles
} from 'lucide-react';

interface LandingHeroProps {
  userSession: UserSession | null;
  theme?: ThemeConfig;
  promotions?: Promotion[];
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'admin', defaultType?: 'consumidor' | 'empresa') => void;
  onSelectCategory: (cat: MainCategory, section?: string, subCategory?: string) => void;
  onOpenCatalog: (promoFilter?: string | null, categoryFilter?: MainCategory | null, sectionFilter?: string | null, subCategoryFilter?: string | null) => void;
  cartCount: number;
  onOpenCart: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  onOpenProfile?: () => void;
  onOpenLookbook?: () => void;
  categoriesHierarchy?: CategoryHierarchyItem[];
}

interface SlideItem {
  id: string;
  tag: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  primaryBtnText: string;
  showEmpresaBtn: boolean;
  promoFilter: string | null;
  categoryFilter: MainCategory | null;
  bannerImage: string;
  discountPercentage?: number;
  textColor?: string;
  fontSize?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  buttons?: PromotionButton[];
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  userSession,
  theme,
  promotions = [],
  onOpenAuth,
  onSelectCategory,
  onOpenCatalog,
  cartCount,
  onOpenCart,
  onLogout,
  onOpenAdmin,
  onOpenProfile,
  onOpenLookbook,
  categoriesHierarchy,
}) => {
  const accent = theme?.accentColor || '#FDB813';
  const hoverAccent = theme?.hoverAccentColor || '#E0A310';

  // Fallback high-res curated workwear background images for promos
  const fallbackImages = [
    '/hero.jpg',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=1600', // Heavy workwear jacket
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=1600', // Work boots
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=1600', // Bags & backpacks
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=1600', // Construction gear
  ];

  // The carousel slides are fully dynamic and managed from the Admin Panel.
  const activePromos = promotions.filter((p) => p.active !== false);

  const slides: SlideItem[] = activePromos.length > 0
    ? activePromos.map((p, idx) => {
        let line1 = '';
        let line2 = '';

        if (p.title.includes('\n')) {
          const parts = p.title.split('\n');
          line1 = parts[0];
          line2 = parts.slice(1).join(' ');
        } else {
          const words = (p.title || 'PAMPERO').trim().split(/\s+/);
          if (words.length <= 2) {
            line1 = words.join(' ');
            line2 = '';
          } else {
            const mid = Math.ceil(words.length / 2);
            line1 = words.slice(0, mid).join(' ');
            line2 = words.slice(mid).join(' ');
          }
        }

        return {
          id: p.id || `promo-${idx}`,
          tag: p.badge || (p.discountPercentage ? `HASTA ${p.discountPercentage}% OFF` : 'TEMPORADA 2026'),
          titleLine1: line1.toUpperCase(),
          titleLine2: line2.toUpperCase(),
          description: p.subtitle || 'Catálogo digital de exhibición Pampero.',
          primaryBtnText: p.primaryBtnText || (idx === 0 ? 'VER CATÁLOGO' : `VER ${p.title ? p.title.toUpperCase() : 'PROMO'}`),
          showEmpresaBtn: idx === 0 || p.categoryFilter === 'Venta Corporativa',
          promoFilter: p.tagFilter || p.title,
          categoryFilter: (p.categoryFilter as MainCategory) || null,
          bannerImage: p.bannerImage && p.bannerImage.trim() !== '' ? p.bannerImage : fallbackImages[idx % fallbackImages.length],
          discountPercentage: p.discountPercentage,
          textColor: p.textColor,
          fontSize: p.fontSize,
          subtitleColor: p.subtitleColor,
          subtitleFontSize: p.subtitleFontSize,
          buttons: p.buttons && p.buttons.length > 0 ? p.buttons : undefined,
        };
      })
    : [
        {
          id: 'slide-fallback',
          tag: 'TEMPORADA 2026',
          titleLine1: 'INDUMENTARIA QUE',
          titleLine2: 'AGUANTA EL TRABAJO',
          description: 'Catálogo digital de exhibición. Hombre, mujer, infantil y venta corporativa, con fichas de producto, talles, colores y promociones vigentes.',
          primaryBtnText: 'VER CATÁLOGO',
          showEmpresaBtn: true,
          promoFilter: null,
          categoryFilter: null,
          bannerImage: '/hero.jpg',
          textColor: '#FFFFFF',
          fontSize: '72px',
          subtitleColor: '#DCD4C9',
          subtitleFontSize: '16px',
        },
      ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Drag & Swipe gesture state
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Auto slide interval
  useEffect(() => {
    if (isPaused || isDragging) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, isDragging, slides.length]);

  const activeSlide = slides[currentSlide] || slides[0];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Drag handlers for mouse & touch
  const handleDragStart = (clientX: number) => {
    setDragStartX(clientX);
    setIsDragging(true);
  };

  const handleDragEnd = (clientX: number) => {
    if (dragStartX === null) return;
    const diff = clientX - dragStartX;
    if (diff > 50) {
      prevSlide(); // Swiped right -> go to previous
    } else if (diff < -50) {
      nextSlide(); // Swiped left -> go to next
    }
    setDragStartX(null);
    setIsDragging(false);
  };

  // Category cards
  const categoryCards = (categoriesHierarchy && categoriesHierarchy.length > 0)
    ? categoriesHierarchy.map((c) => ({
        slug: c.name as MainCategory,
        name: c.name.toUpperCase(),
        tagline: c.name === 'Hombre'
          ? 'Trabajo, campo y ciudad con la misma nobleza de siempre.'
          : c.name === 'Mujer'
          ? 'Prendas de carácter, pensadas para durar temporadas enteras.'
          : c.name === 'Infantil'
          ? 'La misma resistencia, en talles chicos.'
          : c.name === 'Venta Corporativa'
          ? 'Equipamiento e indumentaria para equipos de trabajo.'
          : `Colección y artículos oficiales de ${c.name}.`,
      }))
    : [
        {
          slug: 'Hombre' as MainCategory,
          name: 'HOMBRE',
          tagline: 'Trabajo, campo y ciudad con la misma nobleza de siempre.',
        },
        {
          slug: 'Mujer' as MainCategory,
          name: 'MUJER',
          tagline: 'Prendas de carácter, pensadas para durar temporadas enteras.',
        },
        {
          slug: 'Infantil' as MainCategory,
          name: 'INFANTIL',
          tagline: 'La misma resistencia, en talles chicos.',
        },
        {
          slug: 'Venta Corporativa' as MainCategory,
          name: 'VENTA CORPORATIVA',
          tagline: 'Equipamiento e indumentaria para equipos de trabajo.',
        },
      ];

  const handleSlideClick = () => {
    if (!userSession) {
      onOpenAuth('register', activeSlide.showEmpresaBtn ? 'consumidor' : 'empresa');
    } else {
      onOpenCatalog(activeSlide.promoFilter, activeSlide.categoryFilter);
    }
  };

  const handleButtonClick = (btn: PromotionButton) => {
    switch (btn.actionType) {
      case 'catalog':
        if (!userSession) {
          onOpenAuth('register', 'consumidor');
        } else {
          onOpenCatalog(btn.actionValue || activeSlide.promoFilter, activeSlide.categoryFilter);
        }
        break;
      case 'category':
        if (!userSession) {
          onOpenAuth('register', btn.actionValue === 'Venta Corporativa' ? 'empresa' : 'consumidor');
        } else {
          onSelectCategory((btn.actionValue as MainCategory) || 'Hombre');
        }
        break;
      case 'whatsapp': {
        const text = btn.actionValue || `Hola Pampero Gran Mendoza! Quisiera consultar sobre: ${activeSlide.titleLine1} ${activeSlide.titleLine2}`;
        window.open(`https://wa.me/${theme?.whatsappNumber || '5492612128105'}?text=${encodeURIComponent(text)}`, '_blank');
        break;
      }
      case 'url':
        if (btn.actionValue) {
          if (btn.actionValue.startsWith('http')) {
            window.open(btn.actionValue, '_blank');
          } else {
            window.location.href = btn.actionValue;
          }
        }
        break;
      case 'auth':
        if (!userSession) {
          onOpenAuth('register', btn.actionValue === 'consumidor' ? 'consumidor' : 'empresa');
        } else {
          onSelectCategory('Venta Corporativa');
        }
        break;
      default:
        handleSlideClick();
        break;
    }
  };

  const handleCategoryClick = (cat: MainCategory) => {
    if (!userSession) {
      onOpenAuth('register', cat === 'Venta Corporativa' ? 'empresa' : 'consumidor');
    } else {
      onSelectCategory(cat);
    }
  };

  return (
    <div className="w-full bg-[#F5F2EC]">
      {/* 1. Micro Top Bar */}
      <div 
        className="text-[#F5F2EC] text-[11px] py-1.5 px-4 flex items-center justify-center gap-3 uppercase tracking-[0.25em] font-medium border-b border-black select-none"
        style={{ backgroundColor: theme?.primaryColor || '#18231C' }}
      >
        <span>CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO</span>
      </div>

      {/* 2. Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#DCD4C9] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="cursor-pointer shrink-0" onClick={() => onOpenCatalog(null, null)} title="Inicio">
            <img 
              src="/logo-oficial.png.png" 
              alt="Pampero Oficial" 
              className="h-14 w-auto object-contain shrink-0" 
              onError={(e) => {
                if (e.currentTarget.src !== window.location.origin + '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
          </div>

          {/* Desktop Categories links with hover mega-menu dropdown */}
          <div className="hidden md:flex items-center gap-4">
            <CategoryMenuNav
              categoriesHierarchy={categoriesHierarchy}
              onSelectCategoryItem={(cat, sec, sub) => {
                onSelectCategory(cat, sec, sub);
              }}
              onSelectPromo={(tag) => onOpenCatalog(tag, null)}
              theme={theme}
            />
            {onOpenLookbook && (
              <button
                type="button"
                onClick={onOpenLookbook}
                className="px-3.5 py-1.5 rounded-xs border border-[#18231C]/30 hover:border-[#18231C] text-[11px] font-bold uppercase tracking-wider text-[#18231C] hover:bg-[#18231C] hover:text-[#F5F2EC] transition-all cursor-pointer select-none"
                title="Catálogo Interactivo"
              >
                Catálogo Interactivo
              </button>
            )}
          </div>

          {/* User / Session State & Quote Cart (Harmonized Dropdown Menu) */}
          <UserNavMenu
            userSession={userSession}
            cartCount={cartCount}
            onOpenCart={onOpenCart}
            onOpenAuth={() => onOpenAuth('login', 'consumidor')}
            onLogout={onLogout}
            onOpenAdmin={onOpenAdmin}
            onOpenProfile={onOpenProfile}
            onOpenCatalog={() => onOpenCatalog(null, null)}
            showCatalogBtn={true}
            theme={theme}
          />
        </div>
      </header>

      {/* 3. Hero Section with SLIDING COVERS / DYNAMIC PROMOTIONS + DRAGGABLE */}
      <section 
        ref={heroRef}
        className="relative isolate overflow-hidden bg-[#18231C] select-none cursor-grab active:cursor-grabbing"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          setIsPaused(false);
          setIsDragging(false);
        }}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseUp={(e) => handleDragEnd(e.clientX)}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX)}
      >
        {/* Dynamic Background Image per Promo */}
        <div className="relative h-[78vh] min-h-[540px] max-h-[780px] w-full overflow-hidden">
          <img
            key={activeSlide.id}
            src={activeSlide.bannerImage}
            alt={activeSlide.titleLine1}
            className="h-full w-full object-cover transition-opacity duration-700 animate-fadeIn"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#18231C]/92 via-[#18231C]/65 to-transparent" />
        </div>

        {/* Square, semi-transparent navigation arrows matching user specification */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-xs flex items-center justify-center bg-black/35 hover:bg-black/70 text-white/90 hover:text-white border border-white/20 hover:border-white/50 backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-105"
          aria-label="Promoción anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-xs flex items-center justify-center bg-black/35 hover:bg-black/70 text-white/90 hover:text-white border border-white/20 hover:border-white/50 backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-105"
          aria-label="Promoción siguiente"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Sliding Text Content starting strictly below navbar */}
        <div className="absolute inset-0 flex items-center pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 pointer-events-none">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl text-white pointer-events-auto mt-4 sm:mt-6">
              
              {/* Badge / Tag with subtle transition and clear separation */}
              <div className="inline-flex items-center gap-2 mb-4 sm:mb-5">
                <span 
                  style={{ backgroundColor: `${accent}DD` }}
                  className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] font-bold px-3.5 py-1.5 rounded-xs text-white shadow-xs"
                >
                  {activeSlide.tag}
                </span>
              </div>

              {/* Big Headline in Bebas Neue with dynamic font color & font size styles */}
              <h1 
                className="font-display text-5xl leading-[0.92] tracking-[0.04em] sm:text-7xl lg:text-8xl uppercase font-bold drop-shadow-sm"
                style={{
                  color: activeSlide.textColor || '#FFFFFF',
                  fontSize: activeSlide.fontSize ? `clamp(2.5rem, 5.5vw, ${activeSlide.fontSize})` : undefined,
                }}
              >
                {activeSlide.titleLine1}
                {activeSlide.titleLine2 && (
                  <>
                    <br />
                    {activeSlide.titleLine2}
                  </>
                )}
              </h1>

              {/* Subtitle description with dynamic font color & font size styles */}
              <p 
                className="mt-5 max-w-lg leading-relaxed font-sans text-sm sm:text-base"
                style={{
                  color: activeSlide.subtitleColor || '#DCD4C9',
                  fontSize: activeSlide.subtitleFontSize || undefined,
                }}
              >
                {activeSlide.description}
              </p>

              {/* Buttons: Fully customizable dynamic buttons or fallback default buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {activeSlide.buttons && activeSlide.buttons.length > 0 ? (
                  activeSlide.buttons.map((btn) => {
                    const isSecondary = btn.style === 'secondary';
                    const isOutline = btn.style === 'outline' || !btn.style || btn.style === 'secondary';
                    const isPrimary = btn.style === 'primary';

                    if (isPrimary) {
                      return (
                        <button
                          key={btn.id}
                          id={`btn-hero-custom-${btn.id}`}
                          type="button"
                          onClick={() => handleButtonClick(btn)}
                          style={{ backgroundColor: accent }}
                          className="inline-flex items-center gap-2 rounded-xs px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white font-bold transition-all shadow-md cursor-pointer hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <span>{btn.label}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={btn.id}
                        id={`btn-hero-custom-${btn.id}`}
                        type="button"
                        onClick={() => handleButtonClick(btn)}
                        className={`inline-flex items-center gap-2 rounded-xs px-6 py-3.5 text-[11px] uppercase tracking-[0.3em] font-bold transition-all cursor-pointer ${
                          isOutline
                            ? 'border border-white/60 hover:border-white text-white hover:bg-white/10'
                            : 'bg-white/90 hover:bg-white text-[#18231C] shadow-sm'
                        }`}
                      >
                        <span>{btn.label}</span>
                      </button>
                    );
                  })
                ) : (
                  <>
                    <button
                      id="btn-hero-primary"
                      type="button"
                      onClick={handleSlideClick}
                      style={{ backgroundColor: accent }}
                      className="inline-flex items-center gap-2 rounded-xs px-7 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white font-bold transition-all shadow-md cursor-pointer hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>{activeSlide.primaryBtnText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {activeSlide.showEmpresaBtn && (
                      <button
                        id="btn-hero-empresa"
                        type="button"
                        onClick={() => {
                          if (!userSession) {
                            onOpenAuth('register', 'empresa');
                          } else {
                            onSelectCategory('Venta Corporativa');
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xs border border-white/50 hover:border-white hover:bg-white/10 px-6 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white font-bold transition-all cursor-pointer"
                      >
                        CUENTA EMPRESA
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Minimalist Carousel Slide Indicators: only the interactive dots/fichitas highlighting the active promotion */}
        <div className="absolute bottom-6 right-6 sm:right-10 z-20 pointer-events-auto">
          <div className="flex items-center gap-2">
            {slides.map((_, i) => {
              const isActive = currentSlide === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide(i);
                  }}
                  style={{
                    backgroundColor: isActive ? accent : 'rgba(255, 255, 255, 0.4)',
                    width: isActive ? '24px' : '8px',
                  }}
                  className="h-2 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/80 shadow-xs"
                  aria-label={`Ir a promoción ${i + 1}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Modern & Minimalist Lookbook Banner */}
      {onOpenLookbook && (
        <section className="relative block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 mb-8 sm:mb-12">
          <div 
            onClick={onOpenLookbook}
            className="group relative overflow-hidden rounded-xs bg-[#18231C] text-[#F5F2EC] border border-[#2B3B30] p-6 sm:p-8 shadow-lg cursor-pointer transition-all duration-300 hover:border-[#FDB813] hover:shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xs bg-white/10 text-white text-[10px] sm:text-[11px] font-bold tracking-[0.25em] uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
                <span>Campaña Oficial 2026 · Experiencia Visual</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl uppercase tracking-tight font-bold text-white leading-tight">
                Catálogo Interactivo
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#DCD4C9] font-sans leading-relaxed max-w-xl">
                Descubrí nuestras prendas oficiales sobre modelos en situaciones reales de trabajo y campo. Tocá los puntos interactivos para explorar detalles, talles y cotizar de inmediato.
              </p>
            </div>

            <div className="shrink-0 flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLookbook();
                }}
                style={{ backgroundColor: accent }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xs text-xs uppercase tracking-[0.25em] font-bold text-white transition-all shadow-md group-hover:scale-[1.02] group-hover:brightness-110 cursor-pointer"
              >
                <span>Explorar Catálogo Interactivo</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Subtle background glow */}
            <div 
              className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none transition-opacity group-hover:opacity-30"
              style={{ backgroundColor: accent }}
            />
          </div>
        </section>
      )}

      {/* 4. Four Large Main Category Cards */}
      <section 
        style={{ borderColor: theme?.cardBorderColor || '#DCD4C9' }}
        className="py-14 sm:py-20 border-b max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoryCards.map((cat) => (
            <div
              key={cat.slug}
              onClick={() => handleCategoryClick(cat.slug)}
              style={{
                backgroundColor: theme?.cardBgColor || '#FFFFFF',
                borderColor: theme?.cardBorderColor || '#DCD4C9',
              }}
              className="p-6 rounded-xs transition-all cursor-pointer group shadow-2xs hover:shadow-md border hover:border-[var(--accent)]"
            >
              <h3 
                style={{ color: theme?.textColor || '#18231C' }}
                className="font-display text-2xl uppercase font-bold transition-colors flex items-center justify-between group-hover:text-[var(--accent)]"
              >
                <span>{cat.name}</span>
                <ArrowRight 
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" 
                  style={{ color: accent }}
                />
              </h3>
              <p className="mt-2 text-xs text-[#6F6860] leading-relaxed">
                {cat.tagline}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
