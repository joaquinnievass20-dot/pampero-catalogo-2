import React from 'react';
import { UserSession, ThemeConfig } from '../types';
import { LayoutDashboard, Settings, ShoppingBag, LogOut, ShieldCheck, User, ArrowRight } from 'lucide-react';

interface HubViewProps {
  userSession: UserSession;
  theme?: ThemeConfig;
  onOpenCRM: () => void;
  onOpenAdmin: () => void;
  onOpenCatalog: () => void;
  onLogout: () => void;
}

export const HubView: React.FC<HubViewProps> = ({
  userSession,
  theme,
  onOpenCRM,
  onOpenAdmin,
  onOpenCatalog,
  onLogout,
}) => {
  const accent = theme?.accentColor || '#FDB813';
  const primaryBg = theme?.primaryColor || '#18231C';

  const operatorName =
    userSession.clientData?.fullName ||
    (userSession.role === 'admin' ? 'Administrador General' : userSession.email?.split('@')[0] || 'Personal Pampero');

  const operatorBranch = (userSession as any).branch || 'Gran Mendoza';

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col font-sans selection:bg-[#FDB813] selection:text-black">
      {/* Top Header */}
      <header
        style={{ backgroundColor: primaryBg }}
        className="text-[#F5F2EC] border-b border-black/40 px-4 sm:px-8 py-3.5 shadow-md sticky top-0 z-40"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-oficial.png.png"
              alt="Pampero Oficial"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== window.location.origin + '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
            <div className="border-l border-white/20 pl-3.5 hidden sm:block">
              <span className="text-[10px] tracking-[0.25em] font-extrabold uppercase text-amber-400 block leading-tight">
                MENÚ PRINCIPAL
              </span>
              <span className="text-xs text-[#DCD4C9]/80 font-medium">
                Pampero Gran Mendoza · Sistema Operativo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-right">
              <div className="hidden md:block">
                <p className="text-xs font-bold text-white leading-tight">{operatorName}</p>
                <p className="text-[10px] text-neutral-400">
                  {userSession.role === 'admin' ? 'Administrador' : `Sucursal: ${operatorBranch}`}
                </p>
              </div>
              <div
                style={{ backgroundColor: `${accent}25`, borderColor: accent }}
                className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black text-amber-300"
              >
                {userSession.role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <User className="w-4 h-4 text-amber-400" />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 hover:bg-red-900/60 hover:text-white text-neutral-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hub Content */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Welcome Banner */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#18231C] text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-4 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{userSession.role === 'admin' ? 'MODO ADMINISTRADOR' : 'MODO EMPLEADO'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#18231C] uppercase tracking-wide">
            Menú Principal
          </h1>
          <p className="text-sm sm:text-base text-[#6F6860] max-w-xl mx-auto mt-2">
            Bienvenido/a, <strong className="text-[#18231C]">{operatorName}</strong>. Seleccioná el área a la que deseás ingresar:
          </p>
        </div>

        {/* 3 Large Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* 1. Gestión / CRM */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#B9522F] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 sm:p-8 text-center group">
            <div className="w-16 h-16 rounded-xs bg-amber-50 text-[#B9522F] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-amber-200">
              <LayoutDashboard className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
              Gestión / CRM
            </h2>
            <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
              Tablero Kanban con cotizaciones entrantes, pedidos en curso, visitas a empresas y seguimiento comercial.
            </p>
            <button
              type="button"
              id="btn-hub-crm"
              onClick={onOpenCRM}
              className="w-full py-3.5 px-4 rounded-xs bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ir a Gestión / CRM</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 2. Panel de Control */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#18231C] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 sm:p-8 text-center group">
            <div className="w-16 h-16 rounded-xs bg-neutral-100 text-[#18231C] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-neutral-300">
              <Settings className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
              Panel de Control
            </h2>
            <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
              Administración de catálogo, precios, promociones, operadores, locales y configuración integral.
            </p>
            <button
              type="button"
              id="btn-hub-admin"
              onClick={onOpenAdmin}
              style={{ backgroundColor: primaryBg }}
              className="w-full py-3.5 px-4 rounded-xs hover:bg-black text-[#F5F2EC] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Panel de Control</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 3. Ver Catálogo Público */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#FDB813] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 sm:p-8 text-center group">
            <div className="w-16 h-16 rounded-xs bg-amber-50/60 text-[#18231C] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-amber-300">
              <ShoppingBag className="w-8 h-8" style={{ color: accent }} />
            </div>
            <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
              Ver Catálogo Público
            </h2>
            <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
              Explorar la tienda digital y fichas de producto con la misma experiencia visual que tienen los clientes.
            </p>
            <button
              type="button"
              id="btn-hub-catalog"
              onClick={onOpenCatalog}
              style={{ backgroundColor: accent }}
              className="w-full py-3.5 px-4 rounded-xs hover:brightness-105 text-[#18231C] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ver Catálogo Público</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
