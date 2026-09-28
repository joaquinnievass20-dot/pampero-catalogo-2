import React from 'react';
import { CRMUniformSimulatorTab } from '../crm/CRMUniformSimulatorTab';
import { ArrowLeft, Sparkles, Building2, ShieldCheck, HelpCircle } from 'lucide-react';
import { ThemeConfig } from '../../types';

interface ClientUniformSimulatorViewProps {
  onBackToHome: () => void;
  theme: ThemeConfig;
}

export const ClientUniformSimulatorView: React.FC<ClientUniformSimulatorViewProps> = ({
  onBackToHome,
  theme,
}) => {
  const accent = theme?.accentColor || '#FDB813';

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* Top Banner Navigation */}
      <div className="bg-[#18231C] text-white border-b border-black py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 hover:bg-white/10 rounded-xs text-[#FAF8F5] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Inicio</span>
            </button>
            <span className="text-neutral-500 hidden sm:inline">|</span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FDB813]" />
              <span className="font-display font-bold uppercase tracking-wider text-sm sm:text-base">
                Armador de Uniformes Virtual · Pampero Mendoza
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-neutral-300">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Bordados Computarizados IRAM
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Intro highlight for companies */}
        <div className="mb-6 p-4 sm:p-5 bg-white border border-[#DCD4C9] rounded-xs shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#B9522F] block">
              HERRAMIENTA CORPORATIVA PARA EMPRESAS Y PROFESIONALES
            </span>
            <h1 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-wider text-[#18231C] mt-1">
              Visualizá el logo de tu empresa bordado sobre prendas Pampero
            </h1>
            <p className="text-xs text-[#6F6860] mt-1 max-w-2xl leading-relaxed">
              Seleccioná tu prenda (chomba piqué, campera softshell, camisa grafa o chaleco), subí el logo en formato PNG o JPG, elegí la ubicación y el tamaño, y solicitá una cotización inmediata con ficha técnica incluida.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#FAF8F5] p-3 rounded-xs border border-[#DCD4C9] text-xs text-[#18231C] shrink-0">
            <Building2 className="w-5 h-5 text-[#B9522F] shrink-0" />
            <div>
              <span className="font-bold block">Ventas Corporativas</span>
              <span className="text-[11px] text-[#6F6860]">Descuentos por escala +10 prendas</span>
            </div>
          </div>
        </div>

        {/* Embedded Simulator */}
        <CRMUniformSimulatorTab />
      </div>
    </div>
  );
};
