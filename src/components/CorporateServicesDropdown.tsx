import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Shirt, BookOpen, ArrowRight } from 'lucide-react';
import { ThemeConfig } from '../types';

interface CorporateServicesDropdownProps {
  onOpenLookbook: () => void;
  onOpenSizingPortal: () => void;
  onOpenUniformSimulator: () => void;
  theme?: ThemeConfig;
  className?: string;
}

export const CorporateServicesDropdown: React.FC<CorporateServicesDropdownProps> = ({
  onOpenLookbook,
  onOpenSizingPortal,
  onOpenUniformSimulator,
  theme,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const accent = theme?.accentColor || '#FDB813';
  const primaryBg = theme?.primaryColor || '#18231C';

  // Handle outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        id="btn-nav-servicios-corporativos"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          borderColor: isOpen ? accent : 'transparent',
          color: isOpen ? accent : '#18231C',
        }}
        className="px-3.5 py-2 rounded-xs border border-transparent hover:border-[#DCD4C9] text-xs font-black uppercase tracking-wider transition-all cursor-pointer select-none flex items-center gap-1.5 shadow-2xs hover:bg-[#FAF8F5]"
        title="Servicios Corporativos Pampero"
        aria-expanded={isOpen}
      >
        <span>Servicios Corporativos</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#6F6860] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-500' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-[#DCD4C9] shadow-2xl rounded-xs z-50 animate-fadeIn divide-y divide-[#DCD4C9]/60"
          style={{ borderTopColor: accent, borderTopWidth: '3px' }}
        >
          <div className="p-3 bg-[#FAF8F5]">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8C827A] block">
              Soluciones para Empresas
            </span>
            <span className="text-xs font-bold text-[#18231C]">
              Servicios Corporativos Oficiales
            </span>
          </div>

          <div className="p-1.5 space-y-1">
            {/* 1. Catálogo Interactivo */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenLookbook();
              }}
              className="w-full flex items-start gap-2.5 p-2.5 text-left rounded-xs hover:bg-[#FAF8F5] transition-colors group cursor-pointer"
            >
              <div
                style={{ backgroundColor: `${accent}20` }}
                className="w-8 h-8 rounded-xs flex items-center justify-center shrink-0 mt-0.5"
              >
                <BookOpen className="w-4 h-4 text-[#18231C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18231C] group-hover:text-amber-600 transition-colors">
                    Catálogo Interactivo
                  </span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-[#6F6860] leading-tight mt-0.5">
                  Lookbook de campaña con prendas clickeables y fichas técnicas.
                </p>
              </div>
            </button>

            {/* 2. Portal de Talles */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSizingPortal();
              }}
              className="w-full flex items-start gap-2.5 p-2.5 text-left rounded-xs hover:bg-[#FAF8F5] transition-colors group cursor-pointer"
            >
              <div
                style={{ backgroundColor: `${accent}20` }}
                className="w-8 h-8 rounded-xs flex items-center justify-center shrink-0 mt-0.5"
              >
                <Shirt className="w-4 h-4 text-[#18231C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18231C] group-hover:text-amber-600 transition-colors">
                    Portal de Talles
                  </span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-[#6F6860] leading-tight mt-0.5">
                  Relevamiento digital y planilla unificada de talles para tus colaboradores.
                </p>
              </div>
            </button>

            {/* 3. Armador de Uniformes */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenUniformSimulator();
              }}
              className="w-full flex items-start gap-2.5 p-2.5 text-left rounded-xs hover:bg-[#FAF8F5] transition-colors group cursor-pointer"
            >
              <div
                style={{ backgroundColor: `${accent}20` }}
                className="w-8 h-8 rounded-xs flex items-center justify-center shrink-0 mt-0.5"
              >
                <Sparkles className="w-4 h-4 text-[#B9522F]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18231C] group-hover:text-amber-600 transition-colors">
                    Armador de Uniformes
                  </span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-[#6F6860] leading-tight mt-0.5">
                  Simulador de indumentaria corporativa con previsualización de tu logo.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
