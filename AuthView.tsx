import React, { useState } from 'react';
import { UserSession, ThemeConfig, RegisteredUser } from '../types';
import { PamperoLogo } from './PamperoLogo';
import { ShieldCheck, ArrowLeft, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD } from '../utils/authInit';
import { saveFirestoreUser, authenticateDualUser } from '../services/firebase';

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

  // Errors & Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Submit Login (Dual Email o Nombre de Usuario con Cloud Firestore y Firebase Auth)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const idClean = email.trim();
    const passClean = password.trim();

    if (!idClean || !passClean) {
      setErrorMessage('Ingresá tu correo electrónico o nombre de usuario y tu contraseña.');
      return;
    }

    try {
      const authResult = await authenticateDualUser(idClean, passClean);
      if (authResult.success && authResult.session) {
        const userDisplayName = authResult.session.clientData?.fullName || authResult.session.email || 'Usuario';
        setSuccessMessage(`¡Bienvenido/a, ${userDisplayName}! Ingresando al sistema...`);
        setTimeout(() => {
          onLogin(authResult.session!);
        }, 350);
      } else {
        setErrorMessage(authResult.error || 'Credenciales incorrectas. Verificá tu correo o usuario y tu contraseña.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al autenticar. Intentá nuevamente.');
    }
  };

  // Submit Admin or Employee Login (Dual Email o Nombre de Usuario con verificación segura)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const userClean = adminUser.trim();
    const passClean = adminPass.trim();

    if (!userClean || !passClean) {
      setErrorMessage('Completá usuario o email y contraseña.');
      return;
    }

    try {
      const authResult = await authenticateDualUser(userClean, passClean);
      if (authResult.success && authResult.session) {
        if (authResult.session.role !== 'admin' && authResult.session.role !== 'employee') {
          setErrorMessage('Esta cuenta no cuenta con permisos de Administrador o Empleado. Por favor ingresá desde la pestaña principal "INGRESAR".');
          return;
        }
        const userDisplayName = authResult.session.clientData?.fullName || authResult.session.email || 'Administrador';
        setSuccessMessage(`Acceso autorizado para ${userDisplayName}. Redirigiendo al Hub de Trabajo Interno...`);
        setTimeout(() => {
          onLogin(authResult.session!);
        }, 350);
      } else {
        setErrorMessage(authResult.error || 'Credenciales incorrectas para el panel de administración.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al autenticar en administración.');
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

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                        CONTRASEÑA
                      </label>
                      <input
                        type="password"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="••••••••••••"
                        autoComplete="new-password"
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                      />
                      <div className="mt-1">
                        <span className="text-[10px] text-[#8C847B]">
                          Acceso protegido exclusivo para la administración de Pampero Gran Mendoza.
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        backgroundColor: primary,
                        color: btnText
                      }}
                      className="w-full mt-4 py-3.5 hover:brightness-110 font-bold text-[11px] uppercase tracking-[0.3em] rounded-xs transition-all shadow-xs cursor-pointer"
                    >
                      INGRESAR AL PANEL
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

                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-[#4A453F] mb-1.5">
                          CONTRASEÑA
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          autoComplete="new-password"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-[#DCD4C9] rounded-xs text-sm text-[#18231C] focus:outline-none focus:border-[#FDB813]"
                        />
                      </div>

                      <button
                        type="submit"
                        style={{
                          backgroundColor: primary,
                          color: btnText
                        }}
                        className="w-full mt-4 py-3.5 hover:brightness-110 font-bold text-[11px] uppercase tracking-[0.3em] rounded-xs transition-all shadow-xs cursor-pointer"
                      >
                        INGRESAR
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
    </div>
  );
};
