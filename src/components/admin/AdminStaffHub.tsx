import React from 'react';
import { UserSession, ThemeConfig, CRMOrder, LeadVisit } from '../../types';
import { PamperoLogo } from '../PamperoLogo';
import { 
  LayoutDashboard, 
  Settings, 
  ShoppingBag, 
  Sparkles, 
  Shirt, 
  BookOpen, 
  Bell, 
  LogOut, 
  Eye, 
  ShieldCheck, 
  Building2, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  Users,
  Compass,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface AdminStaffHubProps {
  userSession: UserSession;
  theme: ThemeConfig;
  orders: CRMOrder[];
  visits: LeadVisit[];
  onOpenCRM: () => void;
  onOpenAdminPanel: () => void;
  onOpenCatalog: () => void;
  onOpenUniformSimulator: () => void;
  onOpenSizingPortal: () => void;
  onOpenLookbook: () => void;
  onOpenNotifications: () => void;
  onStartSimulation: (role: 'client' | 'employee') => void;
  onLogout: () => void;
}

export const AdminStaffHub: React.FC<AdminStaffHubProps> = ({
  userSession,
  theme,
  orders,
  visits,
  onOpenCRM,
  onOpenAdminPanel,
  onOpenCatalog,
  onOpenUniformSimulator,
  onOpenSizingPortal,
  onOpenLookbook,
  onOpenNotifications,
  onStartSimulation,
  onLogout,
}) => {
  const isAdmin = userSession.role === 'admin';
  const accent = theme?.accentColor || '#FDB813';
  const primaryBg = theme?.primaryColor || '#18231C';

  // Calculate alerts for the badge and summary
  const delayedOrders = orders.filter((o) => {
    const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOld > 7 && (o.status === 'cotizacion' || o.status === 'sena_50');
  });
  const blockedOrders = orders.filter((o) => Boolean(o.blockReason));
  const activeQuotesCount = orders.filter((o) => o.status === 'cotizacion').length;
  const inProductionCount = orders.filter((o) => o.status === 'produccion').length;
  const totalAlertsCount = delayedOrders.length + blockedOrders.length;

  const staffName = userSession.clientData?.fullName || (isAdmin ? 'Administrador General' : userSession.email?.split('@')[0] || 'Personal Pampero');
  const staffBranch = (userSession as any).branch || 'Gran Mendoza';

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col">
      {/* Top Staff Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#18231C] text-[#F5F2EC] border-b border-black/40 shadow-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <PamperoLogo 
              customUrl={theme.customLogoUrl || theme.logoUrl}
              height={34}
              size="sm"
            />
            <div className="hidden sm:block border-l border-white/20 pl-3.5">
              <span className="text-[10px] tracking-[0.25em] font-extrabold uppercase text-amber-400 block leading-tight">
                PORTAL INTERNO DE GESTIÓN
              </span>
              <span className="text-xs text-[#DCD4C9]/80 font-medium">
                {isAdmin ? 'Panel de Control & Dirección' : `Sucursal: ${staffBranch}`}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Notifications Bell (Pop-up Modal Trigger) */}
            <button
              id="btn-hub-notifications"
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xs bg-white/10 hover:bg-white/20 text-[#F5F2EC] transition-all cursor-pointer flex items-center gap-1.5"
              title="Abrir Centro de Notificaciones y Alertas"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold hidden md:inline">Notificaciones</span>
              {totalAlertsCount > 0 && (
                <span className="bg-red-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {totalAlertsCount}
                </span>
              )}
            </button>

            {/* User Info Capsule */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xs bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-amber-400 text-[#18231C] flex items-center justify-center font-bold text-xs">
                {staffName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left text-xs leading-tight">
                <span className="font-bold text-white block">{staffName}</span>
                <span className="text-[10px] text-amber-300 font-semibold">{isAdmin ? 'Administrador' : 'Empleado'}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xs bg-white/10 hover:bg-red-600/80 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Welcome Banner & Simulation Bar (for Admin) */}
        <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-xs p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#B9522F]">
                Sesión Activa · {isAdmin ? 'Nivel Administrador' : 'Nivel Personal Pampero'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[#18231C] font-bold">
              Bienvenido, {staffName}
            </h1>
            <p className="text-xs sm:text-sm text-[#6F6860] mt-0.5 max-w-xl">
              Seleccioná un módulo para operar. Los clientes no tienen acceso a esta sección ni a la información privada de cotizaciones o márgenes.
            </p>
          </div>

          {/* Admin Simulation Mode Buttons */}
          {isAdmin && (
            <div className="w-full md:w-auto p-3 bg-[#FAF8F5] border border-amber-300/80 rounded-xs shrink-0 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#18231C] uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5 text-[#B9522F]" />
                <span>Simulador de Vistas</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartSimulation('client')}
                  className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="Entrar a ver la web tal cual la ve un Cliente"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simular Cliente</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartSimulation('employee')}
                  className="px-3 py-1.5 bg-white border border-[#DCD4C9] hover:bg-neutral-100 text-[#18231C] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Entrar a ver la web con vista restringida de Empleado"
                >
                  <Users className="w-3.5 h-3.5 text-[#B9522F]" />
                  <span>Simular Empleado</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Urgent Alerts Banner if any */}
        {totalAlertsCount > 0 && (
          <div 
            onClick={onOpenNotifications}
            className="p-4 bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border-2 border-red-300 rounded-xs shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:border-red-400 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-red-950 uppercase tracking-wider block">
                  Hay {totalAlertsCount} Alertas que Requieren Atención Inmediata
                </span>
                <span className="text-xs text-red-800">
                  {delayedOrders.length} cotizaciones demoradas (&gt;7 días) y {blockedOrders.length} pedidos bloqueados. Clic para ver el detalle y reactivar por WhatsApp.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xs text-xs font-bold uppercase tracking-wider shrink-0 transition-colors shadow-xs"
            >
              Ver Notificaciones
            </button>
          </div>
        )}

        {/* Primary 3 Executive Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Tablero de Gestión / CRM */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#B9522F] shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xs bg-[#B9522F]/10 text-[#B9522F] flex items-center justify-center group-hover:bg-[#B9522F] group-hover:text-white transition-colors">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xs bg-[#B9522F]/10 text-[#B9522F]">
                  Módulo Comercial
                </span>
              </div>

              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#18231C] font-bold">
                  Menú de Gestión / CRM
                </h3>
                <p className="text-xs text-[#6F6860] mt-1 leading-relaxed">
                  Kanban interactivo de pedidos, seguimiento de clientes, seña 50%, orden de bordados, seguimiento a proveedores y visitas comerciales.
                </p>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DCD4C9]/60">
                <div className="p-2 bg-[#FAF8F5] rounded-xs text-left">
                  <span className="text-[10px] font-bold text-[#8C827A] uppercase block">Cotizaciones</span>
                  <span className="text-base font-bold text-[#18231C]">{activeQuotesCount} activas</span>
                </div>
                <div className="p-2 bg-[#FAF8F5] rounded-xs text-left">
                  <span className="text-[10px] font-bold text-[#8C827A] uppercase block">En Taller</span>
                  <span className="text-base font-bold text-[#18231C]">{inProductionCount} en curso</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenCRM}
              className="mt-6 w-full py-2.5 px-4 bg-[#B9522F] hover:bg-[#a04424] text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer group-hover:brightness-105"
            >
              <span>Abrir Tablero de Gestión</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Panel de Control */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-amber-400 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xs bg-amber-400/20 text-[#18231C] flex items-center justify-center group-hover:bg-[#FDB813] transition-colors">
                  <Settings className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xs bg-amber-100 text-amber-900">
                  {isAdmin ? 'Configuración Total' : 'Panel Asignado'}
                </span>
              </div>

              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#18231C] font-bold">
                  Panel de Control
                </h3>
                <p className="text-xs text-[#6F6860] mt-1 leading-relaxed">
                  Carga y edición de productos, fotos individuales y masivas, precios, promociones, sucursales, vendedores, permisos y notificaciones.
                </p>
              </div>

              <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]/60 text-xs text-[#6F6860] space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-[#18231C]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Carga de fotos por código#color#género#posición</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-[#18231C]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sincronización segura compartida en la nube</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenAdminPanel}
              style={{ backgroundColor: accent, color: '#18231C' }}
              className="mt-6 w-full py-2.5 px-4 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer hover:brightness-105"
            >
              <span>{isAdmin ? 'Abrir Panel de Control' : 'Acceder a Mis Pestañas'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: Ver Catálogo */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#18231C] shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xs bg-[#18231C]/10 text-[#18231C] flex items-center justify-center group-hover:bg-[#18231C] group-hover:text-white transition-colors">
                  <Compass className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xs bg-neutral-100 text-neutral-800">
                  Exhibición
                </span>
              </div>

              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-[#18231C] font-bold">
                  Catálogo Digital
                </h3>
                <p className="text-xs text-[#6F6860] mt-1 leading-relaxed">
                  Revisá cómo se ven los artículos, fotos de modelos Hombre y Mujer, filtros por subcategoría, stock disponible y precios de lista.
                </p>
              </div>

              <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]/60 text-xs text-[#6F6860]">
                Permite verificar novedades recién subidas o consultar especificaciones técnicas ante una llamada de un cliente.
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenCatalog}
              className="mt-6 w-full py-2.5 px-4 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <span>Explorar Catálogo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Secondary Interactive Tools Row */}
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-[#DCD4C9] pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#B9522F]" />
              <span>Herramientas Interactivas Pampero (Uso Interno & Clientes)</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Tool 1: Armador de Uniformes */}
            <div 
              onClick={onOpenUniformSimulator}
              className="p-4 bg-white border border-[#DCD4C9] hover:border-[#FDB813] rounded-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xs bg-amber-50 text-[#B9522F] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-bold text-xs text-[#18231C] uppercase tracking-wider group-hover:text-[#B9522F] transition-colors truncate">
                  Armador de Uniformes
                </h5>
                <p className="text-[11px] text-[#6F6860] line-clamp-1">
                  Simulador de bordado con logo de empresa
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8C827A] group-hover:text-[#18231C] shrink-0" />
            </div>

            {/* Tool 2: Portal de Talles */}
            <div 
              onClick={onOpenSizingPortal}
              className="p-4 bg-white border border-[#DCD4C9] hover:border-[#18231C] rounded-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xs bg-neutral-100 text-[#18231C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Shirt className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-bold text-xs text-[#18231C] uppercase tracking-wider group-hover:text-[#18231C] transition-colors truncate">
                  Portal de Talles Empresas
                </h5>
                <p className="text-[11px] text-[#6F6860] line-clamp-1">
                  Planilla digital de talles por operario
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8C827A] group-hover:text-[#18231C] shrink-0" />
            </div>

            {/* Tool 3: Catálogo Interactivo Lookbook */}
            <div 
              onClick={onOpenLookbook}
              className="p-4 bg-white border border-[#DCD4C9] hover:border-[#18231C] rounded-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xs bg-neutral-100 text-[#18231C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-bold text-xs text-[#18231C] uppercase tracking-wider group-hover:text-[#18231C] transition-colors truncate">
                  Catálogo Interactivo
                </h5>
                <p className="text-[11px] text-[#6F6860] line-clamp-1">
                  Campañas visuales con puntos interactivos
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8C827A] group-hover:text-[#18231C] shrink-0" />
            </div>

          </div>
        </div>

      </main>
    </div>
  );
};
