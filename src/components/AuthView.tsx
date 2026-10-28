import React, { useState } from 'react';
import { UserSession, ThemeConfig, RegisteredUser } from '../types';
import { PamperoLogo } from './PamperoLogo';
import { 
  ShieldCheck, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  KeyRound, 
  Mail, 
  X, 
  Send,
  Smartphone,
  Eye,
  EyeOff,
  QrCode,
  MessageCircle
} from 'lucide-react';
import { MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD } from '../utils/authInit';
import { saveFirestoreUser, authenticateDualUser, sendUserPasswordResetEmail } from '../services/firebase';

interface AuthViewProps {
  onLogin: (session: UserSession) => void;
  onBackToHome: () => void;
  initialMode?: 'login' | 'register' | 'admin';
  initialType?: 'consumidor' | 'empresa';
  theme?: ThemeConfig;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onLogin,
  onBackToHome,
  initialMode = 'register',
  initialType = 'consumidor',
  theme,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(initialMode);
  const [accountType, setAccountType] = useState<'consumidor' | 'empresa'>(initialType);

  const primary = theme?.primaryColor || '#18231C';
  const accent = theme?.accentColor || '#FDB813';
  const bg = theme?.backgroundColor || '#F5F2EC';
  const text = theme?.textColor || '#18231C';
  const btnText = theme?.buttonTextColor || '#FFFFFF';
  const panelBg = theme?.panelBgColor || '#FAF8F5';
  const borderCol = theme?.cardBorderColor || theme?.secondaryColor || '#DCD4C9';

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Admin Login Fields
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Dual Login Method States (Contraseña tradicional o Código de Autenticador TOTP/MFA)
  const [loginMethod, setLoginMethod] = useState<'password' | 'totp'>('password');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);

  // Admin Dual Login Method States
  const [adminLoginMethod, setAdminLoginMethod] = useState<'password' | 'totp'>('password');
  const [adminTotpCode, setAdminTotpCode] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Errors & Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot Password States (Recuperación Segura por Correo)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    if (!forgotEmail.trim()) {
      setForgotError('Ingresá tu correo electrónico registrado.');
      return;
    }
    setIsSendingReset(true);

    try {
      await sendUserPasswordResetEmail(forgotEmail.trim()).catch(() => {});
    } catch {}

    setIsSendingReset(false);
    setForgotSuccess(
      `Hemos registrado tu solicitud para ${forgotEmail.trim()}. Se envió el enlace de recuperación a tu casilla (revisá también spam o no deseados). Podés utilizar las siguientes opciones de restauración:`
    );
  };

  // Submit Registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Por favor completá el email y contraseña.');
      return;
    }
    if (tab === 'register' && !fullName && accountType === 'consumidor') {
      setErrorMessage('Ingresá tu nombre completo.');
      return;
    }
    if (tab === 'register' && accountType === 'empresa' && !companyName) {
      setErrorMessage('Ingresá la razón social o nombre de tu empresa.');
      return;
    }

    const session: UserSession = {
      id: 'usr-' + Date.now(),
      email: email.trim(),
      role: 'client',
      clientType: accountType,
      clientData: {
        fullName: fullName.trim() || (email ? email.split('@')[0] : 'Usuario'),
        companyName: companyName.trim(),
        cuit: cuit.trim(),
        phone: phone.trim(),
        address: `${street.trim()} ${streetNumber.trim()}`.trim(),
        postalCode: postalCode.trim(),
      },
    };

    // Save to Firestore & local registered users pool for AdminPanel
    const newUser: RegisteredUser = {
      id: session.id || `usr-${Date.now()}`,
      type: accountType === 'empresa' ? 'empresa' : 'consumidor',
      name: accountType === 'empresa' ? companyName.trim() : (fullName.trim() || (email ? email.split('@')[0] : 'Usuario')),
      repName: accountType === 'empresa' ? fullName.trim() : undefined,
      email: email.trim(),
      phone: phone.trim(),
      cuitOrDni: cuit.trim(),
      address: `${street.trim()} ${streetNumber.trim()}`.trim(),
      city: 'Gran Mendoza',
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active' as const,
      pricingTier: accountType === 'empresa' ? 'Corporativo / Mayorista' : 'Consumidor Final',
    };

    saveFirestoreUser(newUser).catch((err) => {
      console.warn('[FIREBASE] Error guardando usuario registrado:', err);
    });

    setSuccessMessage('¡Cuenta creada con éxito! Ingresando al catálogo...');
    setTimeout(() => {
      onLogin(session);
    }, 400);
  };

  // Submit Login (Dual Email o Nombre de Usuario con Contraseña o Código de Autenticador)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const idClean = email.trim();

    if (!idClean) {
      setErrorMessage('Ingresá tu correo electrónico o nombre de usuario.');
      return;
    }

    if (loginMethod === 'password') {
      const passClean = password.trim();
      if (!passClean) {
        setErrorMessage('Ingresá tu contraseña para acceder.');
        return;
      }
    } else {
      const codeClean = totpCode.trim().replace(/\D/g, '');
      if (codeClean.length !== 6) {
        setErrorMessage('Ingresá el código numérico de 6 dígitos generado por tu aplicación de autenticador.');
        return;
      }
    }

    try {
      const credentialToValidate = loginMethod === 'password' ? password.trim() : totpCode.trim().replace(/\D/g, '');
      const authResult = await authenticateDualUser(idClean, credentialToValidate, loginMethod);

      if (authResult.success && authResult.session) {
        const userDisplayName = authResult.session.clientData?.fullName || authResult.session.email || 'Usuario';
        
        // Control de Rutas Estricto: Administrador y Empleado redirigen a vista interna
        if (authResult.session.role === 'admin') {
          setSuccessMessage(`Acceso Administrador autorizado para ${userDisplayName}. Redirigiendo a Panel de Control...`);
        } else if (authResult.session.role === 'employee') {
          setSuccessMessage(`Acceso Personal autorizado para ${userDisplayName}. Redirigiendo a Gestión / CRM...`);
        } else {
          setSuccessMessage(`¡Bienvenido/a, ${userDisplayName}! Ingresando al catálogo...`);
        }

        setTimeout(() => {
          onLogin(authResult.session!);
        }, 350);
      } else {
        setErrorMessage(
          authResult.error || 
          (loginMethod === 'totp' 
            ? 'Código de autenticador incorrecto o expirado. Verificá tu aplicación e intentá nuevamente.' 
            : 'Credenciales incorrectas. Verificá tu correo o usuario y tu contraseña.')
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al autenticar. Intentá nuevamente.');
    }
  };

  // Submit Admin or Employee Login (Dual Email o Nombre de Usuario con Contraseña o Autenticador)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const userClean = adminUser.trim();

    if (!userClean) {
      setErrorMessage('Completá tu usuario o email de administración.');
      return;
    }

    if (adminLoginMethod === 'password') {
      const passClean = adminPass.trim();
      if (!passClean) {
        setErrorMessage('Ingresá tu contraseña de administrador o empleado.');
        return;
      }
    } else {
      const codeClean = adminTotpCode.trim().replace(/\D/g, '');
      if (codeClean.length !== 6) {
        setErrorMessage('Ingresá el código numérico de 6 dígitos del autenticador.');
        return;
      }
    }

    try {
      const credentialToValidate = adminLoginMethod === 'password' ? adminPass.trim() : adminTotpCode.trim().replace(/\D/g, '');
      const authResult = await authenticateDualUser(userClean, credentialToValidate, adminLoginMethod);

      if (authResult.success && authResult.session) {
        const userDisplayName = authResult.session.clientData?.fullName || authResult.session.email || 'Usuario';
        
        // Si el usuario es un cliente autenticado, permitirle acceso directo al catálogo
        if (authResult.session.role === 'client') {
          setSuccessMessage(`¡Bienvenido/a, ${userDisplayName}! Ingresando al catálogo...`);
          setTimeout(() => {
            onLogin(authResult.session!);
          }, 350);
          return;
        }

        if (authResult.session.role === 'admin') {
          setSuccessMessage(`Acceso Administrador autorizado para ${userDisplayName}. Redirigiendo a Panel de Control...`);
        } else {
          setSuccessMessage(`Acceso Personal autorizado para ${userDisplayName}. Redirigiendo a Gestión / CRM...`);
        }

        setTimeout(() => {
          onLogin(authResult.session!);
        }, 350);
      } else {
        setErrorMessage(
          authResult.error || 
          (adminLoginMethod === 'totp' ? 'Código de autenticador no válido o expirado.' : 'Credenciales incorrectas.')
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al autenticar.');
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors selection:bg-[#FDB813] selection:text-black"
      style={{ backgroundColor: bg, color: text }}
    >
      {/* 1. Micro Top Announcement */}
      <div 
        style={{
          backgroundColor: theme?.headerBgColor || primary,
          color: theme?.headerTextColor || '#F5F2EC'
        }}
        className="text-[11px] py-1.5 px-4 text-center uppercase tracking-[0.35em] font-medium border-b border-black/20 select-none"
      >
        CATÁLOGO DIGITAL · EXHIBICIÓN DE PRODUCTO
      </div>

      {/* 2. Top Bar matching Screenshot 1 */}
      <header 
        style={{
          backgroundColor: bg,
          borderColor: borderCol
        }}
        className="border-b px-4 sm:px-8 py-3.5 transition-colors"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="cursor-pointer" onClick={onBackToHome} title="Volver al inicio">
            <PamperoLogo 
              customUrl={theme?.customLogoUrl || theme?.logoUrl}
              height={theme?.logoHeight || 44}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="text-xs font-semibold text-[#6F6860] hover:text-[#18231C] uppercase tracking-[0.2em] hidden sm:inline-flex items-center gap-1 mr-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              style={{
                backgroundColor: primary,
                color: btnText
              }}
              className="hover:brightness-110 px-6 py-2 rounded-xs text-[11px] uppercase tracking-[0.25em] font-semibold transition-all shadow-2xs cursor-pointer"
            >
              INGRESAR
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Content: Exact 2-Column layout from Screenshot 1 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Heading & Information */}
          <div className="lg:col-span-6 lg:pt-6">
            <p 
              style={{ color: accent }}
              className="text-[11px] uppercase tracking-[0.3em] font-bold"
            >
              ACCESO AL CATÁLOGO
            </p>

            <h1 
              style={{ 
                color: text,
                fontFamily: theme?.fontFamily || 'Bebas Neue' 
              }}
              className="mt-4 text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-[0.04em] uppercase font-bold"
            >
              UNA CUENTA,<br />TODO EL CATÁLOGO
            </h1>

            <p className="mt-6 text-sm sm:text-base leading-relaxed text-[#544E47] max-w-lg">
              Elegí el tipo de cuenta según cómo comprás: consumidor final o empresa. Los datos se usan solo para identificar tu cuenta y para el contacto comercial.
            </p>

            {/* Bullets from Screenshot 1 */}
            <ul className="mt-8 space-y-2.5 text-sm text-[#3E3933]">
              <li className="flex items-center gap-2">
                <span style={{ color: accent }} className="font-bold">·</span>
                <span>Fichas de producto con talles y colores</span>
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: accent }} className="font-bold">·</span>
                <span>Promociones y descuentos vigentes</span>
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: accent }} className="font-bold">·</span>
                <span>Listados por categoría, línea y subcategoría</span>
              </li>
            </ul>

            {/* Admin private link from Screenshot 1 */}
            <div className="mt-12 pt-6 border-t border-[#DCD4C9]/60">
              {tab !== 'admin' ? (
                <p className="text-xs text-[#6F6860]">
                  ¿Sos administrador?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('admin');
                      setErrorMessage(null);
                    }}
                    className="text-[#18231C] hover:underline font-bold transition-colors"
                  >
                    Ingresá por el acceso privado.
                  </button>
                </p>
              ) : (
                <p className="text-xs text-[#6F6860]">
                  ¿Sos cliente o empresa?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('register');
                      setErrorMessage(null);
                    }}
                    className="text-[#18231C] hover:underline font-bold transition-colors"
                  >
                    Volver al registro de usuario.
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Form Card (Pixel match to Screenshot 1) */}
          <div className="lg:col-span-6 max-w-xl w-full mx-auto lg:ml-auto">
            <div 
              style={{
                backgroundColor: panelBg,
                borderColor: borderCol
              }}
              className="border rounded-xs shadow-sm p-6 sm:p-8 transition-colors"
            >
              
              {/* Top Switch Tabs (Always visible for easy switching) */}
              <div className="grid grid-cols-3 gap-0 mb-6 bg-[#ECE5DC] p-1 rounded-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  style={tab === 'login' ? { backgroundColor: primary, color: btnText } : undefined}
                  className={`py-2.5 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-bold transition-all text-center rounded-xs cursor-pointer ${
                    tab === 'login'
                      ? 'shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  INGRESAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  style={tab === 'register' ? { backgroundColor: primary, color: btnText } : undefined}
                  className={`py-2.5 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-bold transition-all text-center rounded-xs cursor-pointer ${
                    tab === 'register'
                      ? 'shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  REGISTRARME
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  style={tab === 'admin' ? { backgroundColor: primary, color: btnText } : undefined}
                  className={`py-2.5 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-bold transition-all text-center rounded-xs cursor-pointer ${
                    tab === 'admin'
                      ? 'shadow-2xs'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  EMPLEADOS / ADMIN
                </button>
              </div>

              {/* If Admin / Employee Mode */}
              {tab === 'admin' ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck style={{ color: accent }} className="w-5 h-5" />
                    <p style={{ color: accent }} className="text-[11px] uppercase tracking-[0.3em] font-bold">
                      ACCESO PRIVADO DE GESTIÓN
                    </p>
                  </div>
                  <h2 
                    style={{ color: text, fontFamily: theme?.fontFamily || 'Bebas Neue' }}
                    className="text-4xl uppercase tracking-wide font-bold"
                  >
                    ADMINISTRACIÓN Y EMPLEADOS
                  </h2>
                  <p className="text-xs text-[#6F6860] mt-1 mb-6">
                    Ingresá con tu usuario o email y contraseña autorizada (Administrador o Empleado) para acceder al panel de control.
                  </p>

                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                        EMAIL O NOMBRE DE USUARIO
                      </label>
                      <input
                        type="text"
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                        placeholder="correo@empresa.com o usuario"
                        autoComplete="new-password"
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                    </div>

                    {/* Selector de Método de Validación Dual: Contraseña vs Autenticador */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                        MÉTODO DE INGRESO
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-[#ECE5DC] p-1 rounded-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminLoginMethod('password');
                            setErrorMessage(null);
                          }}
                          className={`py-2 px-3 text-xs font-bold rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            adminLoginMethod === 'password'
                              ? 'bg-[#18231C] text-white shadow-2xs'
                              : 'text-[#6F6860] hover:text-[#18231C]'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Contraseña</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminLoginMethod('totp');
                            setErrorMessage(null);
                          }}
                          className={`py-2 px-3 text-xs font-bold rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            adminLoginMethod === 'totp'
                              ? 'bg-[#18231C] text-white shadow-2xs'
                              : 'text-[#6F6860] hover:text-[#18231C]'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Autenticador</span>
                        </button>
                      </div>
                    </div>

                    {adminLoginMethod === 'password' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                            CONTRASEÑA
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(adminUser || '');
                              setForgotError(null);
                              setForgotSuccess(null);
                              setShowForgotModal(true);
                            }}
                            className="text-[11px] text-[#B9522F] hover:text-[#18231C] font-semibold underline cursor-pointer shrink-0 ml-2"
                          >
                            ¿Olvidaste tu clave?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showAdminPassword ? 'text' : 'password'}
                            value={adminPass}
                            onChange={(e) => setAdminPass(e.target.value)}
                            placeholder="••••••••••••"
                            autoComplete="new-password"
                            required={adminLoginMethod === 'password'}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer p-0.5"
                            title={showAdminPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                          >
                            {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <span className="text-[10px] text-[#8C847B] block mt-1">
                          Acceso protegido exclusivo de Pampero Gran Mendoza.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                            CÓDIGO DE AUTENTICADOR (MFA)
                          </label>
                          <span className="text-[10px] text-[#8C847B]">6 dígitos numéricos</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={adminTotpCode}
                          onChange={(e) => setAdminTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000 000"
                          autoComplete="one-time-code"
                          required={adminLoginMethod === 'totp'}
                          className="w-full px-4 py-3 bg-white border border-[#DCD4C9] rounded-xs text-center font-mono text-xl tracking-[0.35em] text-[#18231C] font-bold focus:outline-none focus:border-[#FDB813] placeholder:text-neutral-300 placeholder:tracking-widest"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setShowTotpModal(true)}
                            className="text-xs text-[#B9522F] hover:text-[#18231C] font-semibold flex items-center gap-1.5 cursor-pointer underline transition-colors"
                          >
                            <span>ℹ️ ¿Cómo funciona el Autenticador?</span>
                          </button>
                          <span className="text-[10px] text-[#6F6860]">Token temporal (30s)</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      style={{
                        backgroundColor: primary,
                        color: btnText
                      }}
                      className="w-full mt-4 py-3.5 hover:brightness-110 font-bold text-[11px] uppercase tracking-[0.3em] rounded-xs transition-all shadow-xs cursor-pointer"
                    >
                      {adminLoginMethod === 'totp' ? 'INGRESAR AL PANEL CON AUTENTICADOR' : 'INGRESAR AL PANEL'}
                    </button>

                    <div className="text-center pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTab('register');
                          setErrorMessage(null);
                        }}
                        className="text-xs text-[#6F6860] hover:text-[#18231C] underline"
                      >
                        ← Volver a crear cuenta de cliente
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Standard Client Mode (Screenshot 1) */
                <div>

                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {/* TAB 1: REGISTRARME (Exact Screenshot 1) */}
                  {tab === 'register' && (
                    <>
                      {/* Mensaje motivador y persuasivo sobre beneficios de registrarse */}
                      <div className="mb-5 p-4 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] flex items-start gap-3 shadow-2xs">
                        <div 
                          style={{ backgroundColor: `${accent}25` }} 
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        >
                          <Sparkles className="w-4 h-4" style={{ color: accent }} />
                        </div>
                        <div className="text-xs text-[#544E47] leading-relaxed">
                          <p className="font-bold text-[#18231C] text-xs uppercase tracking-wider mb-1">
                            ¡Registrate y aprovechá todos los beneficios Pampero!
                          </p>
                          <p>
                            Creá tu cuenta en pocos segundos para disfrutar de <strong>atención personalizada</strong>, <strong>máxima agilización en cotizaciones para empresas y ventas corporativas</strong>, y el <strong>guardado permanente de tu historial de presupuestos</strong> para gestionar tus pedidos y reordenar con total comodidad.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleRegister} className="space-y-4">
                      {/* TIPO DE CUENTA */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          TIPO DE CUENTA
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAccountType('consumidor')}
                            style={accountType === 'consumidor' ? { borderColor: accent, color: accent } : undefined}
                            className={`py-2.5 px-3 border text-center text-xs uppercase tracking-[0.15em] font-semibold transition-all rounded-xs cursor-pointer ${
                              accountType === 'consumidor'
                                ? 'bg-black/5'
                                : 'border-[#DCD4C9] text-[#6F6860] bg-white hover:border-black/30'
                            }`}
                          >
                            CONSUMIDOR FINAL
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountType('empresa')}
                            style={accountType === 'empresa' ? { borderColor: accent, color: accent } : undefined}
                            className={`py-2.5 px-3 border text-center text-xs uppercase tracking-[0.15em] font-semibold transition-all rounded-xs cursor-pointer ${
                              accountType === 'empresa'
                                ? 'bg-black/5'
                                : 'border-[#DCD4C9] text-[#6F6860] bg-white hover:border-black/30'
                            }`}
                          >
                            EMPRESA
                          </button>
                        </div>
                      </div>

                      {/* NOMBRE COMPLETO */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          NOMBRE COMPLETO
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Ingresar nombre completo"
                          required={accountType === 'consumidor'}
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* If Empresa: Extra fields */}
                      {accountType === 'empresa' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                              RAZÓN SOCIAL / EMPRESA
                            </label>
                            <input
                              type="text"
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              placeholder="Razón Social o Empresa"
                              required
                              className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                              CUIT
                            </label>
                            <input
                              type="text"
                              value={cuit}
                              onChange={(e) => setCuit(e.target.value)}
                              placeholder="30-XXXXXXXX-X"
                              className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                            />
                          </div>
                        </div>
                      )}

                      {/* EMAIL */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          EMAIL
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="correo@empresa.com"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* CONTRASEÑA */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          CONTRASEÑA
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* TELÉFONO */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          TELÉFONO
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ej: 2612345678"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* DOMICILIO ACTUAL (2 cols: CALLE | NÚMERO) */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          DOMICILIO ACTUAL
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={street}
                              onChange={(e) => setStreet(e.target.value)}
                              placeholder="Calle"
                              className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={streetNumber}
                              onChange={(e) => setStreetNumber(e.target.value)}
                              placeholder="Número"
                              className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* CÓDIGO POSTAL */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          CÓDIGO POSTAL
                        </label>
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="5500"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* Submit Button from Screenshot 1 */}
                      <button
                        type="submit"
                        style={{
                          backgroundColor: primary,
                          color: btnText
                        }}
                        className="w-full mt-3 py-3.5 hover:brightness-110 font-bold text-[11px] uppercase tracking-[0.3em] rounded-xs transition-all shadow-xs cursor-pointer"
                      >
                        CREAR CUENTA
                      </button>

                      {/* Bottom link from Screenshot 1 */}
                      <p className="text-center text-xs text-[#6F6860] pt-2">
                        ¿Ya tenés cuenta?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setTab('login');
                            setErrorMessage(null);
                          }}
                          style={{ color: accent }}
                          className="hover:underline font-semibold cursor-pointer"
                        >
                          Ingresá
                        </button>
                      </p>
                    </form>
                    </>
                  )}

                  {/* TAB 2: INGRESAR */}
                  {tab === 'login' && (
                    <>
                      {/* Mensaje motivador y recordatorio de beneficios */}
                      <div className="mb-5 p-4 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] flex items-start gap-3 shadow-2xs">
                        <div 
                          style={{ backgroundColor: `${accent}25` }} 
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        >
                          <Sparkles className="w-4 h-4" style={{ color: accent }} />
                        </div>
                        <div className="text-xs text-[#544E47] leading-relaxed">
                          <p className="font-bold text-[#18231C] text-xs uppercase tracking-wider mb-1">
                            Tu espacio Pampero
                          </p>
                          <p>
                            Ingresá a tu cuenta para consultar tu <strong>historial de cotizaciones guardadas</strong>, agilizar tus <strong>pedidos corporativos</strong> y recibir <strong>atención personalizada</strong> para vos o tu empresa.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          EMAIL O NOMBRE DE USUARIO
                        </label>
                        <input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="correo@empresa.com o nombre de usuario"
                          autoComplete="new-password"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      {/* Selector de Método de Validación Dual: Contraseña vs Autenticador */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          MÉTODO DE VALIDACIÓN
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-[#ECE5DC] p-1 rounded-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginMethod('password');
                              setErrorMessage(null);
                            }}
                            className={`py-2 px-3 text-xs font-bold rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              loginMethod === 'password'
                                ? 'bg-[#18231C] text-white shadow-2xs'
                                : 'text-[#6F6860] hover:text-[#18231C]'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Contraseña</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLoginMethod('totp');
                              setErrorMessage(null);
                            }}
                            className={`py-2 px-3 text-xs font-bold rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              loginMethod === 'totp'
                                ? 'bg-[#18231C] text-white shadow-2xs'
                                : 'text-[#6F6860] hover:text-[#18231C]'
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Autenticador</span>
                          </button>
                        </div>
                      </div>

                      {loginMethod === 'password' ? (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                              CONTRASEÑA
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setForgotEmail(email || '');
                                setForgotError(null);
                                setForgotSuccess(null);
                                setShowForgotModal(true);
                              }}
                              className="text-[11px] text-[#B9522F] hover:text-[#18231C] font-semibold underline cursor-pointer"
                            >
                              ¿Olvidaste tu contraseña?
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••••••"
                              autoComplete="new-password"
                              required={loginMethod === 'password'}
                              className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer p-0.5"
                              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F]">
                              CÓDIGO DE AUTENTICADOR (MFA)
                            </label>
                            <span className="text-[10px] text-[#8C847B]">6 dígitos numéricos</span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000 000"
                            autoComplete="one-time-code"
                            required={loginMethod === 'totp'}
                            className="w-full px-4 py-3 bg-white border border-[#DCD4C9] rounded-xs text-center font-mono text-xl tracking-[0.35em] text-[#18231C] font-bold focus:outline-none focus:border-[#FDB813] placeholder:text-neutral-300 placeholder:tracking-widest"
                          />
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => setShowTotpModal(true)}
                              className="text-xs text-[#B9522F] hover:text-[#18231C] font-semibold flex items-center gap-1.5 cursor-pointer underline transition-colors"
                            >
                              <span>ℹ️ ¿Cómo funciona el Autenticador?</span>
                            </button>
                            <span className="text-[10px] text-[#6F6860]">Expira cada 30 seg</span>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        style={{
                          backgroundColor: primary,
                          color: btnText
                        }}
                        className="w-full mt-4 py-3.5 hover:brightness-110 font-bold text-[11px] uppercase tracking-[0.3em] rounded-xs transition-all shadow-xs cursor-pointer"
                      >
                        {loginMethod === 'totp' ? 'INGRESAR CON AUTENTICADOR' : 'INGRESAR'}
                      </button>

                      <p className="text-center text-xs text-[#6F6860] pt-2">
                        ¿No tenés cuenta todavía?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setTab('register');
                            setErrorMessage(null);
                          }}
                          style={{ color: accent }}
                          className="hover:underline font-semibold cursor-pointer"
                        >
                          Registrate
                        </button>
                      </p>
                    </form>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Modal: Recuperación de Contraseña Segura (Firebase Auth sendPasswordResetEmail) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs shadow-2xl max-w-md w-full p-6 sm:p-7 relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-800 transition-colors p-1"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div 
                style={{ backgroundColor: `${accent}25` }} 
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              >
                <KeyRound className="w-5 h-5" style={{ color: '#B9522F' }} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                  Recuperar Contraseña
                </h3>
                <p className="text-xs text-[#6F6860]">
                  Restablecimiento oficial de clave
                </p>
              </div>
            </div>

            <p className="text-xs text-[#544E47] leading-relaxed mb-4">
              Ingresá el correo electrónico asociado a tu cuenta. Te enviaremos un enlace automático y seguro a tu casilla de correo para que puedas crear una nueva contraseña sin intermediarios.
            </p>

            {forgotError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <span className="leading-relaxed">{forgotSuccess}</span>
                </div>

                <div className="space-y-2 pt-1">
                  {/* Opción 1: Reenviar código al correo (Próximamente) */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-100 border border-neutral-300 rounded-xs text-neutral-600 text-xs font-semibold">
                    <span>Reenviar código al correo</span>
                    <span className="text-[10px] bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-bold">
                      (Próximamente)
                    </span>
                  </div>

                  {/* Opción 2: Contactar al administrador por WhatsApp (2613868944) */}
                  <a
                    href={`https://wa.me/5492613868944?text=${encodeURIComponent(
                      `Hola Administrador, necesito restaurar el acceso a mi cuenta en el Catálogo Pampero para el correo: ${forgotEmail.trim()}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span className="text-center leading-tight">
                      Contactar al administrador por WhatsApp (2613868944) para restaurar el acceso
                    </span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccess(null);
                  }}
                  className="w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-xs hover:brightness-110 cursor-pointer transition-all border border-[#DCD4C9] bg-white text-[#18231C] mt-2"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A453F] mb-1.5">
                    CORREO ELECTRÓNICO REGISTRADO
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="tunombre@ejemplo.com"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C] bg-white rounded-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    style={{ backgroundColor: primary, color: btnText }}
                    className="flex-1 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xs hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSendingReset ? (
                      <span>Enviando...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Enlace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Instructivo: ¿Cómo funciona el Autenticador? */}
      {showTotpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs shadow-2xl max-w-lg w-full p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowTotpModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-800 transition-colors p-1 cursor-pointer"
              title="Cerrar instructivo"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div 
                style={{ backgroundColor: `${accent}25` }} 
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              >
                <Smartphone className="w-6 h-6" style={{ color: '#B9522F' }} />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#B9522F]">
                  SEGURIDAD Y ACCESO PROTEGIDO
                </span>
                <h3 className="font-bold text-lg text-[#18231C] uppercase tracking-wide">
                  ¿Cómo funciona el Autenticador?
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#544E47] leading-relaxed mb-5">
              El acceso mediante código temporal de autenticador te brinda protección reforzada contra accesos no autorizados. Seguí estos 3 pasos:
            </p>

            {/* 3 Pasos requeridos paso a paso */}
            <div className="space-y-3.5 mb-6">
              {/* Paso 1 */}
              <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs flex items-start gap-3 shadow-2xs">
                <div className="w-7 h-7 rounded-full bg-[#18231C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Paso 1: Descargá la aplicación.
                  </h4>
                  <p className="text-xs text-[#544E47] leading-relaxed">
                    Instalás <strong>Google Authenticator</strong> o <strong>Authy</strong> en tu celular.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[#6F6860]">
                    <span className="bg-[#ECE5DC] px-2 py-0.5 rounded-xs font-semibold">Google Play Store</span>
                    <span className="bg-[#ECE5DC] px-2 py-0.5 rounded-xs font-semibold">Apple App Store</span>
                  </div>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs flex items-start gap-3 shadow-2xs">
                <div className="w-7 h-7 rounded-full bg-[#18231C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Paso 2: Primer Ingreso y Vinculación.
                  </h4>
                  <p className="text-xs text-[#544E47] leading-relaxed">
                    Si es tu primera vez, ingresá seleccionando la opción "Contraseña" (usando la clave que te entregó la administración). Una vez adentro, andá al menú de tu Perfil, entrá a la sección "Seguridad" y hacé clic en "Vincular Autenticador". Escaneá el código QR con tu aplicación.
                  </p>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs flex items-start gap-3 shadow-2xs">
                <div className="w-7 h-7 rounded-full bg-[#18231C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Paso 3: Ingresos Diarios.
                  </h4>
                  <p className="text-xs text-[#544E47] leading-relaxed">
                    ¡Listo! A partir de tu próximo inicio de sesión, simplemente seleccioná la opción "Autenticador" en esta pantalla e ingresá el código de 6 dígitos de tu celular para acceder de forma rápida y segura.
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso informativo de seguridad */}
            <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9]/80 rounded-xs text-[11px] text-[#6F6860] mb-5 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Consejo de seguridad:</strong> Cada código es de uso temporal y se regenera automáticamente. No compartas nunca tus códigos con nadie.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowTotpModal(false)}
              style={{ backgroundColor: primary, color: btnText }}
              className="w-full py-3 font-bold text-xs uppercase tracking-wider rounded-xs hover:brightness-110 cursor-pointer transition-all shadow-xs"
            >
              Entendido, volver a la pantalla de ingreso
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
