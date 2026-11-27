import React, { useState, useEffect } from 'react';
import { UserSession, ThemeConfig, InternalChatThread } from '../types';
import { LayoutDashboard, Settings, ShoppingBag, LogOut, ShieldCheck, User, ArrowRight, Users, Wallet, MessageSquare, Phone } from 'lucide-react';
import { subscribeToFirestoreEmployees } from '../services/firebase';
import { hasAdminPanelAccess, hasCRMAccess, hasRRHHAccess, hasCostsAccess } from '../utils/permissions';
import { PamperoLogo } from './PamperoLogo';
import { isColorDark } from '../context/ThemeContext';

interface HubViewProps {
  userSession: UserSession;
  theme?: ThemeConfig;
  onOpenCRM: () => void;
  onOpenRRHH?: () => void;
  onOpenCosts?: () => void;
  onOpenContacts?: () => void;
  onOpenAdmin: () => void;
  onOpenCatalog: () => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  unreadChatCount?: number;
  unreadChatThreads?: InternalChatThread[];
  onOpenChat?: (threadId?: string) => void;
}

export const HubView: React.FC<HubViewProps> = ({
  userSession,
  theme,
  onOpenCRM,
  onOpenRRHH,
  onOpenCosts,
  onOpenContacts,
  onOpenAdmin,
  onOpenCatalog,
  onLogout,
  onOpenProfile,
  unreadChatCount = 0,
  unreadChatThreads = [],
  onOpenChat,
}) => {
  const accent = theme?.accentColor || '#FDB813';
  // Hub Pampero oficial: Verde profundo #18231C con acentos dorados
  const hubBg = (theme?.hubBgColor && theme.hubBgColor !== '#FAF8F5' && theme.hubBgColor !== '#FFFFFF' && theme.hubBgColor !== '#F5F2EC')
    ? theme.hubBgColor
    : '#18231C';
  const isHubDark = isColorDark(hubBg);
  const hubText = theme?.hubTextColor || (isHubDark ? '#F5F2EC' : '#18231C');

  const [livePermTick, setLivePermTick] = useState(0);

  useEffect(() => {
    if (userSession.role !== 'employee') return;
    const unsubEmp = subscribeToFirestoreEmployees(() => {
      setLivePermTick((n) => n + 1);
    });
    return () => unsubEmp();
  }, [userSession.role]);

  void livePermTick;
  const canSeeCRM = hasCRMAccess(userSession);
  const canSeeRRHH = hasRRHHAccess(userSession) && Boolean(onOpenRRHH);
  const canSeeCosts = hasCostsAccess(userSession) && Boolean(onOpenCosts);
  const canSeeAdminPanel = hasAdminPanelAccess(userSession);

  const canSeeContacts = Boolean(onOpenContacts);

  const visibleCardsCount =
    (canSeeCRM ? 1 : 0) +
    (canSeeRRHH ? 1 : 0) +
    (canSeeCosts ? 1 : 0) +
    (canSeeContacts ? 1 : 0) +
    (canSeeAdminPanel ? 1 : 0) +
    (onOpenChat ? 1 : 0) +
    1; // Catálogo Público siempre visible

  const gridColsClass =
    visibleCardsCount >= 5
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6'
      : visibleCardsCount === 4
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6'
        : visibleCardsCount === 3
          ? 'grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8'
          : 'grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-3xl mx-auto w-full';

  const operatorName =
    userSession.clientData?.fullName ||
    (userSession.role === 'admin' ? 'Administrador Maestro Joaquín Nievas' : userSession.email?.split('@')[0] || 'Operador');

  const operatorBranch = (userSession as any).branch || 'Gran Mendoza';
  const st = theme?.siteTexts;

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col font-sans selection:bg-[#FDB813] selection:text-black">
      {/* Top Header */}
      <header
        style={{ backgroundColor: hubBg, color: hubText }}
        className="border-b border-black/30 px-4 sm:px-8 py-3.5 shadow-md sticky top-0 z-40 transition-colors"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <PamperoLogo 
              customUrl={theme?.customLogoUrl || theme?.logoUrl}
              height={36}
              navBgColor={hubBg}
              onDarkBackground={isHubDark}
            />
            <div className={`border-l pl-3.5 hidden sm:block ${isHubDark ? 'border-white/20' : 'border-neutral-300'}`}>
              <span className={`text-[10px] tracking-[0.25em] font-extrabold uppercase block leading-tight ${isHubDark ? 'text-amber-400' : 'text-[#B9522F]'}`}>
                {st?.hubHeaderTag || 'HUB DE TRABAJO INTERNO'}
              </span>
              <span className={`text-xs font-medium ${isHubDark ? 'text-[#DCD4C9]/80' : 'text-[#6F6860]'}`}>
                {st?.hubHeaderSub || 'Pampero Gran Mendoza · Sistema Operativo'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-right">
              <div className="hidden md:block">
                <p className={`text-xs font-bold leading-tight ${isHubDark ? 'text-white' : 'text-[#18231C]'}`}>
                  {operatorName}
                </p>
                <p className={`text-[10px] ${isHubDark ? 'text-neutral-300' : 'text-[#6F6860]'}`}>
                  {userSession.role === 'admin'
                    ? (st?.hubRoleAdminText || 'Super Administrador')
                    : userSession.sellerRole === 'encargado'
                      ? (st?.hubRoleEmployeeText || 'Encargado General · Todos los Locales')
                      : `Sucursal: ${operatorBranch}`}
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

            {onOpenChat && (
              <button
                type="button"
                onClick={() => onOpenChat()}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-white/20"
                title={st?.chatTitle || 'Abrir Chat Interno'}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">{st?.chatNavBtnText || 'Chat'}</span>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black tabular-nums animate-pulse">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}

            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-white/20"
                title="Mi Perfil & Seguridad (2FA)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Seguridad 2FA</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 hover:bg-red-900/60 hover:text-white text-neutral-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{st?.hubLogoutBtnText || 'Salir'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hub Content */}
      <main className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Welcome Banner */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#18231C] text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-4 shadow-xs">
            <span>Sesión Autorizada · {userSession.role === 'admin' ? 'Modo Administración' : 'Modo Operador'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#18231C] uppercase tracking-wide">
            {st?.hubTitle || 'Hub de Trabajo Interno'}
          </h1>
          <p className="text-sm sm:text-base text-[#6F6860] max-w-xl mx-auto mt-2">
            {st?.hubSubtitle || (
              <>Bienvenido/a, <strong className="text-[#18231C]">{operatorName}</strong>. Seleccioná el área a la que deseás ingresar:</>
            )}
          </p>
        </div>

        {/* Notificación Banner de Mensajes Nuevos en Chat Interno */}
        {onOpenChat && unreadChatCount > 0 && (
          <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-600 rounded-xs shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 font-black shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2 justify-center sm:justify-start">
                  <span>Mensajes nuevos en Chat Interno</span>
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-black shadow-xs tabular-nums">
                    {unreadChatCount} {unreadChatCount === 1 ? 'sin leer' : 'sin leer'}
                  </span>
                </h3>
                <p className="text-xs text-[#6F6860] mt-0.5">
                  {unreadChatThreads.length > 0
                    ? unreadChatThreads.slice(0, 2).map((t) => `${t.lastSenderName || 'Contacto'}: "${(t.lastMessageText || (t as any).lastMessage || '').slice(0, 45)}"`).join(' · ')
                    : 'Tenés mensajes directos esperando respuesta en el Chat Interno.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChat(unreadChatThreads[0]?.id)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs text-xs font-black uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>Responder Ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dynamic Action Cards */}
        <div className={`grid ${gridColsClass}`}>
          {/* 1. Gestión / CRM */}
          {canSeeCRM && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#B9522F] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group relative">
              <div className="relative w-16 h-16 rounded-xs bg-amber-50 text-[#B9522F] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-amber-200">
                <LayoutDashboard className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                {st?.hubCrmCardText || 'Gestión / CRM'}
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                {st?.hubCrmCardDesc || 'Tablero Kanban con cotizaciones entrantes, pedidos en curso, visitas a empresas y seguimiento comercial.'}
              </p>
              <button
                type="button"
                id="btn-hub-crm"
                onClick={onOpenCRM}
                className="w-full py-3.5 px-4 rounded-xs bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-[#B9522F]"
              >
                <span>{st?.hubCrmBtnText || 'Ir a Gestión / CRM'}</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 2. RRHH */}
          {canSeeRRHH && onOpenRRHH && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-emerald-700 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group relative">
              <div className="w-16 h-16 rounded-xs bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-emerald-200">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                {st?.hubRrhhCardText || 'RRHH'}
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                {st?.hubRrhhCardDesc || 'Legajos de personal, fichaje de llegada con horario y GPS exacto por local, horarios y vacaciones.'}
              </p>
              <button
                type="button"
                id="btn-hub-rrhh"
                onClick={onOpenRRHH}
                className="w-full py-3.5 px-4 rounded-xs bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-700"
              >
                <span>{st?.hubRrhhBtnText || 'Ir a RRHH'}</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 2B. Costos & Finanzas (Solo Administradores y Encargados autorizados) */}
          {canSeeCosts && onOpenCosts && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#18231C] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group relative">
              <div className="w-16 h-16 rounded-xs bg-[#FAF8F5] text-[#18231C] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-[#DCD4C9]">
                <Wallet className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                {st?.hubCostsCardText || 'Costos & Finanzas'}
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                {st?.hubCostsCardDesc || 'Dashboard de situación y liquidez, cheques emitidos y recibidos, caja chica por local y control de costos.'}
              </p>
              <button
                type="button"
                id="btn-hub-costs"
                onClick={onOpenCosts}
                className="w-full py-3.5 px-4 rounded-xs bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-[#18231C]"
              >
                <span>{st?.hubCostsBtnText || 'Ir a Costos'}</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-[#FDB813] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 2C. Contactos (Base unificada: Colaboradores, Clientes, Proveedores, Cuentas Importantes) */}
          {canSeeContacts && onOpenContacts && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-teal-700 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group relative">
              <div className="w-16 h-16 rounded-xs bg-teal-50 text-teal-800 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-teal-200">
                <Phone className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                Contactos
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                Base unificada con filtros dinámicos para colaboradores, clientes, proveedores y cuentas importantes (ARCA, ATM, bancos y servicios).
              </p>
              <button
                type="button"
                id="btn-hub-contacts"
                onClick={onOpenContacts}
                className="w-full py-3.5 px-4 rounded-xs bg-teal-700 hover:bg-teal-800 text-white text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-teal-700"
              >
                <span>Ir a Contactos</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 2D. Chat Interno (Mensajería directa Administradores / Colaboradores / Clientes) */}
          {onOpenChat && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-blue-700 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group relative">
              <div className="relative w-16 h-16 rounded-xs bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-blue-200">
                <MessageSquare className="w-8 h-8" />
                {unreadChatCount > 0 && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md border-2 border-white tabular-nums">
                    {unreadChatCount}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                {st?.hubChatCardText || 'Chat Interno'}
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                {(st?.hubChatCardDesc || 'Mensajería directa en tiempo real entre administradores, colaboradores de locales y clientes registrados.').replace(/\bempleados\b/gi, 'colaboradores')}
              </p>
              <button
                type="button"
                id="btn-hub-chat"
                onClick={() => onOpenChat()}
                className="w-full py-3.5 px-4 rounded-xs bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-blue-700"
              >
                <span>{st?.hubChatBtnText || 'Abrir Chat'}</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 3. Panel de Control (Oculto para colaboradores sin ventanas habilitadas) */}
          {canSeeAdminPanel && (
            <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#18231C] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group">
              <div className="w-16 h-16 rounded-xs bg-neutral-100 text-[#18231C] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-neutral-300">
                <Settings className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
                {st?.hubAdminCardText || 'Panel de Control'}
              </h2>
              <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
                {st?.hubAdminCardDesc || 'Administración de catálogo, precios, promociones, operadores, locales y configuración integral.'}
              </p>
              <button
                type="button"
                id="btn-hub-admin"
                onClick={onOpenAdmin}
                className="w-full py-3.5 px-4 rounded-xs bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-[#18231C]"
              >
                <span>{st?.hubAdminBtnText || 'Panel de Control'}</span>
                <ArrowRight className="w-4 h-4 shrink-0 text-[#FDB813] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 4. Catálogo Público */}
          <div className="bg-white rounded-xs border-2 border-[#DCD4C9] hover:border-[#FDB813] shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col p-6 text-center group">
            <div className="w-16 h-16 rounded-xs bg-amber-50/60 text-[#18231C] flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform border border-amber-300">
              <ShoppingBag className="w-8 h-8" style={{ color: accent }} />
            </div>
            <h2 className="text-lg font-black text-[#18231C] uppercase tracking-wider mb-2">
              {st?.hubCatalogCardText || 'Catálogo Público'}
            </h2>
            <p className="text-xs text-[#6F6860] leading-relaxed mb-6 flex-1">
              {st?.hubCatalogCardDesc || 'Acceso directo a la tienda y catálogo de productos para consultar prendas, precios y visualización desde la vista del cliente.'}
            </p>
            <button
              type="button"
              id="btn-hub-catalog"
              onClick={onOpenCatalog}
              style={{ backgroundColor: accent, borderColor: accent }}
              className="w-full py-3.5 px-4 rounded-xs hover:brightness-105 text-[#18231C] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border"
            >
              <span>{st?.hubCatalogBtnText || 'Ver Catálogo'}</span>
              <ArrowRight className="w-4 h-4 shrink-0 text-[#18231C] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

