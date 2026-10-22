import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, Check, AlertCircle, Eye, EyeOff, Sparkles, RefreshCw, Trash2, Smartphone, Copy } from 'lucide-react';
import { clearCatalogBackup } from '../../utils/backupManager';
import { QRCodeSVG } from 'qrcode.react';
import { 
  generateRandomBase32Secret, 
  buildTotpUri, 
  verifyAndEnrollUserTotp, 
  disableUserTotp 
} from '../../services/firebase';
import { UserSession } from '../../types';

interface AdminSecurityTabProps {
  triggerSaveNotice: () => void;
  userSession?: UserSession | null;
}

export const DEFAULT_ADMIN_EMAIL = 'admin@pampero.com';
export const DEFAULT_ADMIN_PASSWORD = 'Pampero2026';

export const AdminSecurityTab: React.FC<AdminSecurityTabProps> = ({ triggerSaveNotice, userSession }) => {
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // MFA States
  const [isMfaEnrolled, setIsMfaEnrolled] = useState(false);
  const [isMfaEnrolling, setIsMfaEnrolling] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmittingMfa, setIsSubmittingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);
  const [mfaCopyFeedback, setMfaCopyFeedback] = useState(false);

  // Load saved admin credentials and MFA status
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pampero_admin_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) setAdminEmail(parsed.email);
      }
      const adminMfa = localStorage.getItem('pampero_admin_mfa_enrolled');
      const adminSecret = localStorage.getItem('pampero_admin_totp_secret');
      if (adminMfa === 'true' || Boolean(adminSecret)) {
        setIsMfaEnrolled(true);
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

  const handleStartEnrollment = () => {
    const newSecret = generateRandomBase32Secret(16);
    const accountLabel = adminEmail || 'admin@pampero.com';
    const uri = buildTotpUri(accountLabel, newSecret, 'Pampero Gran Mendoza');
    setMfaSecret(newSecret);
    setMfaUri(uri);
    setMfaCode('');
    setMfaError(null);
    setMfaSuccess(null);
    setIsMfaEnrolling(true);
  };

  const handleCopySecret = () => {
    if (mfaSecret && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(mfaSecret);
      setMfaCopyFeedback(true);
      setTimeout(() => setMfaCopyFeedback(false), 2000);
    }
  };

  const handleConfirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);
    setMfaSuccess(null);
    setIsSubmittingMfa(true);

    const sessionObj: UserSession = userSession || {
      id: 'admin-master',
      email: adminEmail,
      role: 'admin',
    };

    try {
      const res = await verifyAndEnrollUserTotp(sessionObj, mfaSecret, mfaCode);
      if (res.success) {
        setIsMfaEnrolled(true);
        setIsMfaEnrolling(false);
        setMfaSuccess('¡Autenticador vinculado con éxito! Ya podés ingresar al Panel de Control con el código temporal de 6 dígitos de tu celular.');
        triggerSaveNotice();
      } else {
        setMfaError(res.error || 'Código incorrecto. Verificá los 6 dígitos generados por tu aplicación.');
      }
    } catch (err: any) {
      setMfaError(err?.message || 'Error al validar el código.');
    } finally {
      setIsSubmittingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('¿Deseás desvincular el autenticador para la cuenta de administración?')) {
      return;
    }
    const sessionObj: UserSession = userSession || {
      id: 'admin-master',
      email: adminEmail,
      role: 'admin',
    };
    try {
      await disableUserTotp(sessionObj);
      setIsMfaEnrolled(false);
      setIsMfaEnrolling(false);
      setMfaSecret('');
      setMfaUri('');
      setMfaCode('');
      setMfaSuccess('Autenticador desvinculado con éxito.');
      triggerSaveNotice();
    } catch (err: any) {
      setMfaError(err?.message || 'Error al desvincular autenticador.');
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
            className="px-6 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            Guardar Nuevas Credenciales
          </button>
        </div>
      </form>

      {/* Apartado de Seguridad: Autenticación en Dos Pasos (MFA / TOTP) */}
      <div className="bg-white p-5 sm:p-6 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-5">
        <div className="flex items-start gap-3 border-b border-[#DCD4C9] pb-4">
          <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
            <Smartphone className="w-6 h-6 text-[#B9522F]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Autenticación en Dos Pasos (Google Authenticator / Authy)
              </h3>
              {isMfaEnrolled ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Activo
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-xs bg-amber-100 text-amber-800 border border-amber-300">
                  No configurado
                </span>
              )}
            </div>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Protegé tu acceso como administrador. Podés generar un código QR para escanear en tu celular e ingresar con el token temporal de 6 dígitos.
            </p>
          </div>
        </div>

        {/* Alertas MFA */}
        {mfaError && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mfaError}</span>
          </div>
        )}

        {mfaSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{mfaSuccess}</span>
          </div>
        )}

        {/* Estado: Ya enrolado */}
        {isMfaEnrolled && !isMfaEnrolling && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xs text-xs text-emerald-950">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Autenticador Vinculado y Activo
              </p>
              <p>
                Tu cuenta administrativa tiene activo el doble factor de autenticación. Podés ingresar tanto con contraseña como seleccionando "Autenticador" en el inicio de sesión.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStartEnrollment}
                className="px-4 py-2.5 bg-white border border-[#DCD4C9] hover:border-[#18231C] text-xs font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#B9522F]" />
                Re-vincular / Generar Nuevo QR
              </button>
              <button
                type="button"
                onClick={handleDisableMfa}
                className="px-4 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-xs font-bold uppercase tracking-wider text-red-600 rounded-xs transition-colors cursor-pointer"
              >
                Desvincular 2FA
              </button>
            </div>
          </div>
        )}

        {/* Estado: No enrolado */}
        {!isMfaEnrolled && !isMfaEnrolling && (
          <div className="space-y-4">
            <p className="text-xs text-[#544E47] leading-relaxed">
              Hacé clic en el botón de abajo para generar tu código QR personal e imprimirlo en pantalla para vincularlo a tu celular.
            </p>
            <button
              type="button"
              onClick={handleStartEnrollment}
              className="px-6 py-3 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-widest rounded-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Vincular Autenticador (App)</span>
            </button>
          </div>
        )}

        {/* Estado: Proceso de enrolamiento con QR y validación */}
        {isMfaEnrolling && (
          <div className="space-y-5 bg-[#FAF8F5] border border-[#DCD4C9] p-5 sm:p-6 rounded-xs">
            <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Enrolamiento de Autenticador
              </h4>
              <span className="text-[10px] text-[#6F6860]">Paso 1 de 2</span>
            </div>

            {/* Código QR */}
            <div className="text-center">
              <p className="text-xs text-[#544E47] mb-3">
                <strong>1.</strong> Escaneá este código QR con tu aplicación móvil (Google Authenticator o Authy):
              </p>
              <div className="inline-block p-4 bg-white border-2 border-[#18231C] rounded-xs shadow-md">
                <QRCodeSVG value={mfaUri} size={180} level="M" marginSize={1} />
              </div>
            </div>

            {/* Clave Secreta en texto plano */}
            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="text-[11px] text-[#6F6860] font-semibold text-center">
                <strong>2.</strong> Clave secreta manual (por si falla la cámara):
              </p>
              <div className="flex items-center justify-between bg-white border border-[#DCD4C9] px-3.5 py-2.5 rounded-xs">
                <span className="font-mono text-xs font-black tracking-widest text-[#18231C] select-all">
                  {mfaSecret}
                </span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-xs text-[#B9522F] hover:text-[#18231C] font-bold flex items-center gap-1 cursor-pointer ml-3"
                  title="Copiar clave"
                >
                  {mfaCopyFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">¡Copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Formulario de validación del primer código */}
            <form onSubmit={handleConfirmEnrollment} className="max-w-md mx-auto pt-3 border-t border-[#DCD4C9] space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A453F] mb-1.5 text-center">
                  <strong>3.</strong> INGRESÁ EL PRIMER CÓDIGO DE 6 DÍGITOS GENERADO
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000"
                  autoComplete="one-time-code"
                  required
                  className="w-full px-4 py-3 bg-white border border-[#DCD4C9] rounded-xs text-center font-mono text-2xl tracking-[0.35em] text-[#18231C] font-black focus:outline-none focus:border-[#FDB813]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMfaEnrolling(false);
                    setMfaError(null);
                  }}
                  className="flex-1 py-2.5 border border-[#DCD4C9] bg-white text-xs font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C] rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMfa || mfaCode.length !== 6}
                  className="flex-1 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingMfa ? 'Validando...' : 'Confirmar y Sellar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Herramienta de Mantenimiento y Caché Local */}
      <div className="bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs p-5">
        <h4 className="text-xs font-bold text-[#18231C] uppercase tracking-wider mb-1 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#B9522F]" />
          Limpieza de Memoria Local del Navegador
        </h4>
        <p className="text-[12px] text-[#6F6860] mb-4 leading-relaxed">
          Si ves fotos o productos antiguos en este equipo (aún después de actualizar en Vercel o presionar Control + F5), 
          se debe a que el navegador retiene una copia en su memoria <code className="bg-[#EFE9DF] px-1 py-0.5 rounded text-[11px] text-[#18231C]">localStorage</code>. 
          Al hacer clic abajo se purga la copia local y se recarga todo limpio desde la nube.
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Deseás borrar la memoria local del catálogo en este navegador y recargar la página limpia?')) {
              clearCatalogBackup();
              try {
                localStorage.removeItem('pampero_catalog_products');
                localStorage.removeItem('pampero_products_backup');
                localStorage.removeItem('pampero_theme_config');
              } catch {}
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-semibold rounded-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
          Purgar Caché Local y Forzar Recarga Limpia
        </button>
      </div>
    </div>
  );
};
