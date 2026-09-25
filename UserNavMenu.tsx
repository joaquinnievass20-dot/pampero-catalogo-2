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
  LayoutDashboard
} from 'lucide-react';

interface UserNavMenuProps {
  userSession: UserSession | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  onOpenCRM?: () => void;
  onOpenProfile?: () => void;
  onOpenCatalog?: () => void;
  showCatalogBtn?: boolean;
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
  onOpenProfile,
  onOpenCatalog,
  showCatalogBtn = false,
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
      
      {/* 1. Optional Shortcut to Catalog */}
      {showCatalogBtn && onOpenCatalog && (
        <button
          type="button"
          onClick={onOpenCatalog}
          style={{ backgroundColor: accent }}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xs text-[#18231C] text-[11px] uppercase tracking-[0.2em] font-extrabold transition-all shadow-2xs hover:brightness-105 cursor-pointer shrink-0"
          title="Ver Catálogo Completo"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Catálogo</span>
        </button>
      )}

      {/* 2. Cotización / Carrito Button - ALWAYS VISIBLE, ACCESSIBLE AND BRANDED */}
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
        title="Ver lista de cotización"
        aria-label="Abrir lista de cotización"
      >
        <ShoppingBag 
          className="w-4 h-4 shrink-0" 
          style={{ color: cartCount > 0 ? accent : '#18231C' }} 
        />
        <span className="hidden sm:inline font-sans text-xs">Cotización</span>
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

      {/* Gestión / CRM Button - Visible for admin/employee */}
      {(userSession?.role === 'admin' || userSession?.role === 'employee') && onOpenCRM && (
        <button
          type="button"
          onClick={onOpenCRM}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xs bg-[#B9522F] text-white hover:bg-[#a04424] text-xs font-bold uppercase tracking-wider transition-all shadow-2xs cursor-pointer select-none shrink-0"
          title="Abrir Tablero de Gestión / CRM"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Gestión / CRM</span>
        </button>
      )}

      {/* Notification Bell (CRM) - Only for admin/employee */}
      {(userSession?.role === 'admin' || userSession?.role === 'employee') && onOpenCRM && (
        <button 
          type="button"
          className="relative p-1.5 sm:p-2 text-[#6F6860] hover:text-[#18231C] transition-colors cursor-pointer"
          title="Notificaciones de Gestión"
          onClick={onOpenCRM}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
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
              className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#DCD4C9] shadow-2xl rounded-xs z-50 animate-fadeIn divide-y divide-[#DCD4C9]/60"
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
                {/* Admin or Employee Panel */}
                {(userSession.role === 'admin' || userSession.role === 'employee') && onOpenAdmin && (
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
                      <span>{userSession.role === 'employee' ? 'Panel de Empleado' : 'Panel de Control'}</span>
                    </div>
                    <span 
                      style={{ backgroundColor: `${accent}20`, color: primaryBg }}
                      className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs"
                    >
                      Admin
                    </span>
                  </button>
                )}

                {/* CRM Dashboard */}
                {(userSession.role === 'admin' || userSession.role === 'employee') && onOpenCRM && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCRM();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-[#B9522F]" />
                      <span>Gestión / CRM</span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs bg-[#B9522F]/10 text-[#B9522F]">
                      Nuevo
                    </span>
                  </button>
                )}

                {/* Profile / Contact Info */}
                {onOpenProfile && (
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

                {/* Quote history / cart access */}
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenCart();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-[#4A453F] hover:text-[#18231C] hover:bg-[#FAF8F5] rounded-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8C827A]" />
                    <span>Lista de Cotización</span>
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
          className="px-4 sm:px-6 py-2 sm:py-2 rounded-xs text-[11px] uppercase tracking-[0.25em] font-bold transition-all shadow-2xs hover:brightness-110 cursor-pointer shrink-0"
        >
          INGRESAR
        </button>
      )}

    </div>
  );
};
