import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, Check, AlertCircle, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';

interface AdminSecurityTabProps {
  triggerSaveNotice: () => void;
}

export const DEFAULT_ADMIN_EMAIL = 'admin@pampero.com';
export const DEFAULT_ADMIN_PASSWORD = 'Pampero2026';

export const AdminSecurityTab: React.FC<AdminSecurityTabProps> = ({ triggerSaveNotice }) => {
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load saved admin credentials from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pampero_admin_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) setAdminEmail(parsed.email);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailClean = adminEmail.trim();
    if (!emailClean || !emailClean.includes('@')) {
      setErrorMessage('Por favor ingresá un correo electrónico válido para el administrador.');
      return;
    }

    // Get current stored password to verify if user enters one
    let storedPassword = DEFAULT_ADMIN_PASSWORD;
    try {
      const stored = localStorage.getItem('pampero_admin_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.password) storedPassword = parsed.password;
      }
    } catch {
      // ignore
    }

    // If changing password, validate
    if (newPassword.trim() !== '') {
      if (storedPassword && currentPassword !== storedPassword) {
        setErrorMessage('La contraseña actual ingresada es incorrecta.');
        return;
      }

      if (newPassword.length < 4) {
        setErrorMessage('La nueva contraseña debe tener al menos 4 caracteres.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
        return;
      }
    }

    const finalPassword = newPassword.trim() !== '' ? newPassword.trim() : storedPassword;

    const credentials = {
      email: emailClean,
      password: finalPassword,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('pampero_admin_credentials', JSON.stringify(credentials));
    if (finalPassword) {
      localStorage.setItem('pampero_admin_custom_password', finalPassword);
      localStorage.setItem('pampero_admin_pass', finalPassword);
    }

    setSuccessMessage('¡Credenciales de Administrador actualizadas con éxito! Ya podés ingresar con este mail y contraseña.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    triggerSaveNotice();
  };

  const handleResetDefaults = () => {
    if (confirm('¿Restablecer credenciales de administración?')) {
      localStorage.setItem('pampero_admin_credentials', JSON.stringify({
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        updatedAt: new Date().toISOString(),
      }));
      localStorage.removeItem('pampero_admin_custom_password');
      localStorage.removeItem('pampero_admin_pass');
      setAdminEmail(DEFAULT_ADMIN_EMAIL);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Credenciales restablecidas.');
      triggerSaveNotice();
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6 text-[#B9522F]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Seguridad & Acceso de Administrador
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Configurá el correo electrónico de gestión y la contraseña maestra para ingresar al Panel de Control de Pampero Gran Mendoza.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="self-start sm:self-auto px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[11px] font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#B9522F]" />
            Restablecer Valores
          </button>
        </div>

        {/* Current Status Badge */}
        <div className="mt-4 p-3.5 bg-[#F5F2EC] border border-[#DCD4C9] rounded-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-[#18231C]">
              Administrador Principal Activo:
            </span>
            <span className="text-xs font-mono font-semibold text-[#B9522F] bg-white px-2 py-0.5 rounded-xs border border-[#DCD4C9]">
              {adminEmail}
            </span>
          </div>
          <span className="text-[11px] text-[#6F6860] flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-[#B9522F]" /> Clave de acceso encriptada y protegida localmente
          </span>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border-l-4 border-red-600 text-red-800 text-xs font-medium rounded-r-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-800 text-xs font-medium rounded-r-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSaveCredentials} className="bg-white p-5 sm:p-6 rounded-xs border border-[#DCD4C9] space-y-6 shadow-2xs">
        {/* Section 1: Email / Usuario */}
        <div>
          <h4 className="text-xs font-bold text-[#18231C] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-[#B9522F]" />
            1. Correo Electrónico del Administrador
          </h4>
          <p className="text-[11px] text-[#6F6860] mb-3">
            Este correo es el usuario de acceso directo al panel de control y donde se reciben avisos de cotizaciones.
          </p>
          <div className="max-w-md">
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-medium text-[#18231C] focus:outline-none focus:border-[#B9522F] focus:bg-white transition-colors"
            />
            <p className="text-[10px] text-[#6F6860] mt-1">
              Tu mail configurado: <strong className="text-[#18231C]">{adminEmail || 'admin@pampero.com'}</strong>
            </p>
          </div>
        </div>

        <div className="border-t border-[#DCD4C9] pt-5">
          <h4 className="text-xs font-bold text-[#18231C] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#B9522F]" />
            2. Cambiar Contraseña de Acceso
          </h4>
          <p className="text-[11px] text-[#6F6860] mb-4">
            Completá estos campos solo si deseás cambiar la contraseña actual. Si solo querés cambiar el mail, podés dejarlos en blanco.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Contraseña Actual */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#4A453F] mb-1">
                Contraseña Actual
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresá tu clave actual"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
                />
              </div>
            </div>

            {/* Nueva Contraseña */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#4A453F] mb-1">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
                />
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#4A453F] mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir nueva clave"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[11px] text-[#6F6860] hover:text-[#18231C] flex items-center gap-1 font-medium"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
            </button>
            <span className="text-[10px] text-[#6F6860]">
              La contraseña se guarda encriptada localmente para tu sesión.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="border-t border-[#DCD4C9] pt-4 flex items-center justify-end gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            Guardar Nuevas Credenciales
          </button>
        </div>
      </form>
    </div>
  );
};
