import React, { useState, useRef, useEffect } from 'react';
import { UserSession, ThemeConfig } from '../types';
import { 
  ShoppingBag, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  Building2, 
  FileText,
  Compass,
  Bell,
  LayoutDashboard,
  Sparkles,
  Shirt,
  Package
} from 'lucide-react';

interface UserNavMenuProps {
  userSession: UserSession | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  onOpenCRM?: () => void;
  onOpenHub?: () => void;
  onOpenUniformSimulator?: () => void;
  onOpenSizingPortal?: () => void;
  onOpenProfile?: () => void;
  onOpenOrderTracking?: () => void;
  onOpenCatalog?: () => void;
  theme?: ThemeConfig;
}

export const UserNavMenu: React.FC<UserNavMenuProps> = ({
  userSession,
  cartCount,
  onOpenCart,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenCRM,
  onOpenHub,
  onOpenUniformSimulator,
  onOpenSizingPortal,
  onOpenProfile,
  onOpenOrderTracking,
  onOpenCatalog,
  theme,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const accent = theme?.accentColor || '#FDB813';
  const primaryBg = theme?.primaryColor || '#18231C';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const getDisplayName = () => {
    if (!userSession) return '';
    if (userSession.clientData?.fullName) return userSession.clientData.fullName;
    if (userSession.clientData?.companyName) return userSession.clientData.companyName;
    if (userSession.email) return userSession.email.split('@')[0];
    return 'Mi Cuenta';
  };

  const getInitial = () => {
    const name = getDisplayName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const getRoleLabel = () => {
    if (!userSession) return '';
    if (userSession.role === 'admin') return 'Administrador';
    if (userSession.role === 'employee') return 'Personal Pampero';
    if (userSession.clientType === 'empresa') return 'Cuenta Corporativa';
    return 'Cliente Registrado';
  };

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
      
      {/* 1. Mi Pedido Button - EXCLUSIVO PARA CLIENTES Y VISITANTES (Oculto para personal porque es el carrito que arma el cliente) */}
      {(!userSession || userSession.role === 'client') && (
        <button
          id="btn-nav-cart-quote"
          type="button"
          onClick={onOpenCart}
          style={{
            backgroundColor: cartCount > 0 ? primaryBg : '#FFFFFF',
            borderColor: cartCount > 0 ? accent : '#DCD4C9',
            color: cartCount > 0 ? '#F5F2EC' : '#18231C',
          }}
          className="relative px-3 sm:px-3.5 py-2 rounded-xs border text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-2xs transition-all hover:brightness-105 shrink-0 cursor-pointer select-none"
          title="Ver Mi Pedido"
          aria-label="Abrir Mi Pedido"
        >
          <ShoppingBag 
            className="w-4 h-4 shrink-0" 
            style={{ color: cartCount > 0 ? accent : '#18231C' }} 
          />
          <span className="hidden sm:inline font-sans text-xs">Mi Pedido</span>
          <span 
            style={{
              backgroundColor: cartCount > 0 ? accent : '#EAE6DF',
              color: cartCount > 0 ? '#18231C' : '#6F6860',
            }}
            className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 shadow-2xs"
          >
            {cartCount}
          </span>
        </button>
      )}

      {/* 3. User Dropdown Menu or INGRESAR Button */}
      {userSession ? (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            id="btn-user-dropdown-toggle"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xs border border-[#DCD4C9] bg-white hover:bg-[#FAF8F5] transition-all cursor-pointer select-none shadow-2xs"
            title="Opciones de cuenta y administración"
            aria-expanded={dropdownOpen}
          >
            {/* Avatar Circle */}
            <div 
              style={{ backgroundColor: `${accent}22`, borderColor: `${accent}66` }}
              className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-black shrink-0"
            >
              <span style={{ color: primaryBg }}>{getInitial()}</span>
            </div>

            {/* Name + Chevron (visible on sm+) */}
            <div className="hidden sm:flex items-center gap-1.5 text-left max-w-[130px]">
              <span className="text-xs font-bold text-[#18231C] truncate leading-tight">
                {getDisplayName()}
              </span>
              <ChevronDown 
                className={`w-3.5 h-3.5 text-[#6F6860] transition-transform duration-200 shrink-0 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`} 
              />
            </div>
          </button>

          {/* Clean Corporate Dropdown Menu */}
          {dropdownOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#DCD4C9] shadow-2xl rounded-xs z-50 animate-fadeIn divide-y divide-[#DCD4C9]/60"
              style={{ borderTopColor: accent, borderTopWidth: '3px' }}
            >
              {/* Header with User Info */}
              <div className="p-3.5 bg-[#FAF8F5]">
                <div className="flex items-center gap-2.5">
                  <div 
                    style={{ backgroundColor: primaryBg, color: accent }}
                    className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-2xs"
                  >
                    {getInitial()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#18231C] truncate">
                      {getDisplayName()}
                    </p>
                    <p className="text-[11px] text-[#6F6860] truncate">
                      {userSession.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[9px] font-extrabold uppercase tracking-wider">
                    {userSession.role === 'admin' ? (
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    ) : userSession.clientType === 'empresa' ? (
                      <Building2 className="w-3 h-3 text-amber-400" />
                    ) : (
                      <UserIcon className="w-3 h-3 text-white" />
                    )}
                    {getRoleLabel()}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="p-1.5 space-y-0.5">
                {/* 1. STAFF ONLY (admin / employee): Hub de Trabajo Interno */}
                {(userSession.role === 'admin' || userSession.role === 'employee') && onOpenHub && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenHub();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] bg-amber-50/80 hover:bg-amber-100 rounded-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#B9522F]" />
                      <span>Menú Principal de Trabajo</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs bg-[#B9522F] text-white">
                      Hub
                    </span>
                  </button>
                )}

                {/* 2. ADMIN ONLY: Panel de Control General */}
                {userSession.role === 'admin' && onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenAdmin();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" style={{ color: accent }} />
                      <span>Panel de Control (Admin)</span>
                    </div>
                    <span 
                      style={{ backgroundColor: `${accent}20`, color: primaryBg }}
                      className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs"
                    >
                      Admin
                    </span>
                  </button>
                )}

                {/* 3. STAFF ONLY (admin / employee): Acceso Directo a CRM si disponible */}
                {(userSession.role === 'admin' || userSession.role === 'employee') && onOpenCRM && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCRM();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-[#B9522F]" />
                      <span>CRM Pampero</span>
                    </div>
                  </button>
                )}

                {/* 4. CLIENT & ADMIN ONLY: Armador de Uniformes */}
                {(userSession.role === 'client' || userSession.role === 'admin') && onOpenUniformSimulator && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenUniformSimulator();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#FDB813]" />
                      <span>Armador de Uniformes</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs bg-amber-100 text-amber-900">
                      Virtual
                    </span>
                  </button>
                )}

                {/* 5. CLIENT (Empresas) & ADMIN: Portal de Talles */}
                {(userSession.role === 'admin' || (userSession.role === 'client' && userSession.clientType === 'empresa')) && onOpenSizingPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenSizingPortal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Shirt className="w-4 h-4 text-[#18231C]" />
                      <span>Portal de Talles Empleados</span>
                    </div>
                  </button>
                )}

                {/* 6. CLIENT & ALL USERS: Estado de mi pedido (Seguimiento en Vivo) */}
                {onOpenOrderTracking && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenOrderTracking();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] bg-blue-50/60 hover:bg-blue-100/80 rounded-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span>Estado de mi pedido</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs bg-blue-600 text-white">
                      En Vivo
                    </span>
                  </button>
                )}

                {/* 7. CLIENT ONLY: Perfil & Datos de Entrega */}
                {userSession.role === 'client' && onOpenProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[#4A453F] hover:text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-[#8C827A]" />
                    <span>Mi Perfil & Datos de Entrega</span>
                  </button>
                )}

                {/* 8. CLIENT ONLY: Mi Pedido */}
                {userSession.role === 'client' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCart();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-[#4A453F] hover:text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#8C827A]" />
                      <span>Mi Pedido</span>
                    </div>
                    {cartCount > 0 && (
                      <span 
                        style={{ backgroundColor: accent, color: '#18231C' }}
                        className="text-[10px] font-black px-1.5 py-0.2 rounded-full"
                      >
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Logout Footer */}
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[#8C827A] hover:text-red-700 hover:bg-red-50/70 rounded-xs transition-colors cursor-pointer font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          id="btn-nav-ingresar"
          type="button"
          onClick={onOpenAuth}
          style={{
            backgroundColor: primaryBg,
            color: '#F5F2EC'
          }}
          className="px-4 sm:px-5 py-2 rounded-xs text-[11px] uppercase tracking-[0.25em] font-bold transition-all shadow-2xs hover:brightness-110 cursor-pointer shrink-0"
        >
          INGRESAR
        </button>
      )}

    </div>
  );
};
