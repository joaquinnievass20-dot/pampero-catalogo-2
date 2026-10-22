import React, { useState, useEffect } from 'react';
import { UserSession, ThemeConfig, RegisteredUser } from '../types';
import { 
  saveFirestoreUser,
  generateRandomBase32Secret,
  buildTotpUri,
  verifyAndEnrollUserTotp,
  disableUserTotp
} from '../services/firebase';
import { QRCodeSVG } from 'qrcode.react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Save, 
  X, 
  Check, 
  ShieldCheck,
  ShoppingBag,
  Calendar,
  Clock,
  Package,
  Smartphone,
  Copy,
  AlertCircle,
  RefreshCw,
  KeyRound
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession | null;
  onUpdateSession: (updatedSession: UserSession) => void;
  theme: ThemeConfig;
  initialTab?: 'profile' | 'quotes' | 'security';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userSession,
  onUpdateSession,
  theme,
  initialTab = 'profile',
}) => {
  if (!isOpen || !userSession) return null;

  const accent = theme?.accentColor || '#FDB813';
  const isCompany = userSession.clientType === 'empresa';
  const d = userSession.clientData || {};

  const [activeTab, setActiveTab] = useState<'profile' | 'quotes' | 'security'>(initialTab);
  const [quoteHistory, setQuoteHistory] = useState<any[]>([]);

  // MFA / TOTP 2FA States
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmittingMfa, setIsSubmittingMfa] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Extract initial address parts
  let initialStreet = '';
  let initialNumber = '';
  let initialCity = 'Gran Mendoza';

  if (typeof d.address === 'string') {
    initialStreet = d.address;
  } else if (d.address && typeof d.address === 'object') {
    initialStreet = d.address.street || '';
    initialNumber = d.address.number || '';
    initialCity = d.address.city || 'Gran Mendoza';
  }

  const [fullName, setFullName] = useState(d.fullName || d.repFullName || '');
  const [companyName, setCompanyName] = useState(d.companyName || '');
  const [cuit, setCuit] = useState(d.cuit || '');
  const [email, setEmail] = useState(userSession.email || d.email || d.institutionalEmail || '');
  const [phone, setPhone] = useState(d.phone || d.institutionalPhone || '');
  const [street, setStreet] = useState(initialStreet);
  const [streetNumber, setStreetNumber] = useState(initialNumber);
  const [city, setCity] = useState(initialCity);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Check initial MFA enrollment status
  useEffect(() => {
    if (userSession.mfaEnrolled || userSession.totpSecret) {
      setIsEnrolled(true);
      return;
    }
    if (typeof window !== 'undefined') {
      const adminMfa = localStorage.getItem('pampero_admin_mfa_enrolled');
      const adminSecret = localStorage.getItem('pampero_admin_totp_secret');
      if (userSession.role === 'admin' && (adminMfa === 'true' || Boolean(adminSecret))) {
        setIsEnrolled(true);
        return;
      }

      const userEmail = (userSession.email || '').toLowerCase().trim();
      const userId = userSession.id;

      try {
        const empList: any[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
        const emp = empList.find((e: any) => (e.id && e.id === userId) || (e.email && e.email.toLowerCase().trim() === userEmail));
        if (emp?.mfaEnrolled || emp?.totpSecret) {
          setIsEnrolled(true);
          return;
        }
      } catch {}

      try {
        const uList: any[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
        const u = uList.find((e: any) => (e.id && e.id === userId) || (e.email && e.email.toLowerCase().trim() === userEmail));
        if (u?.mfaEnrolled || u?.totpSecret) {
          setIsEnrolled(true);
          return;
        }
      } catch {}
    }
    setIsEnrolled(false);
  }, [userSession]);

  // Load quote history for this user
  useEffect(() => {
    const userKey = userSession.email ? userSession.email.toLowerCase().trim() : 'guest';
    const userHistoryKey = `pampero_quote_history_${userKey}`;
    
    // 1. Try local storage first
    try {
      const saved = localStorage.getItem(userHistoryKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setQuoteHistory(parsed);
        }
      }
    } catch {}
  }, [userSession.email]);

  const handleStartEnrollment = () => {
    const newSecret = generateRandomBase32Secret(16);
    const accountLabel = userSession.email || fullName || 'usuario';
    const uri = buildTotpUri(accountLabel, newSecret, 'Pampero Gran Mendoza');
    setMfaSecret(newSecret);
    setMfaUri(uri);
    setMfaCode('');
    setEnrollError(null);
    setEnrollSuccess(null);
    setIsEnrolling(true);
  };

  const handleCopySecret = () => {
    if (mfaSecret && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(mfaSecret);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleConfirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);
    setIsSubmittingMfa(true);

    try {
      const res = await verifyAndEnrollUserTotp(userSession, mfaSecret, mfaCode);
      if (res.success) {
        setIsEnrolled(true);
        setIsEnrolling(false);
        setEnrollSuccess('¡Autenticador vinculado y activado con éxito! A partir de tu próximo inicio de sesión, podés ingresar seleccionando la opción "Autenticador" con el código de tu celular.');
        const updatedSession: UserSession = {
          ...userSession,
          totpSecret: mfaSecret,
          mfaEnrolled: true,
        };
        onUpdateSession(updatedSession);
      } else {
        setEnrollError(res.error || 'Código incorrecto. Verificá los 6 dígitos generados por tu aplicación.');
      }
    } catch (err: any) {
      setEnrollError(err?.message || 'Error al validar el código.');
    } finally {
      setIsSubmittingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('¿Estás seguro de que deseás desvincular el autenticador de tu cuenta?')) {
      return;
    }
    setEnrollError(null);
    setEnrollSuccess(null);
    try {
      await disableUserTotp(userSession);
      setIsEnrolled(false);
      setIsEnrolling(false);
      setMfaSecret('');
      setMfaUri('');
      setMfaCode('');
      setEnrollSuccess('Autenticador desvinculado con éxito. Podés ingresar únicamente con tu contraseña.');
      const updatedSession: UserSession = {
        ...userSession,
        totpSecret: undefined,
        mfaEnrolled: false,
      };
      onUpdateSession(updatedSession);
    } catch (err: any) {
      setEnrollError(err?.message || 'Error al desvincular autenticador.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedAddressStr = streetNumber.trim()
      ? `${street.trim()} ${streetNumber.trim()} (${city.trim()})`
      : `${street.trim()} (${city.trim()})`;

    const updatedData = {
      ...d,
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      repFullName: fullName.trim(),
      cuit: cuit.trim(),
      email: email.trim(),
      institutionalEmail: email.trim(),
      phone: phone.trim(),
      institutionalPhone: phone.trim(),
      address: {
        street: street.trim(),
        number: streetNumber.trim(),
        city: city.trim(),
      },
      addressString: formattedAddressStr,
    };

    const updatedSession: UserSession = {
      ...userSession,
      email: email.trim(),
      clientData: updatedData,
    };

    // 1. Save to pampero_user_session (compatible with App.tsx) and pampero_session
    try {
      localStorage.setItem('pampero_user_session', JSON.stringify(updatedSession));
      localStorage.setItem('pampero_session', JSON.stringify(updatedSession));
    } catch {}

    // 2. Persist to Cloud Firestore and pampero_registered_users pool
    const registeredUserToSave: RegisteredUser = {
      id: userSession.id,
      name: isCompany ? (companyName.trim() || fullName.trim()) : fullName.trim(),
      repName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      cuitOrDni: cuit.trim(),
      address: formattedAddressStr,
      city: city.trim(),
      type: isCompany ? 'empresa' : 'consumidor',
      role: userSession.role || 'client',
      status: 'active',
      pricingTier: isCompany ? 'Corporativo / Mayorista' : 'Consumidor Final',
      createdAt: (userSession as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveFirestoreUser(registeredUserToSave).catch((err) => {
      console.warn('[FIRESTORE] Error guardando perfil de cliente:', err);
    });

    try {
      const usersStr = localStorage.getItem('pampero_registered_users');
      if (usersStr) {
        const users = JSON.parse(usersStr);
        const updatedUsers = users.map((u: any) => {
          if (u.id === userSession.id || (userSession.email && u.email === userSession.email)) {
            return {
              ...u,
              ...registeredUserToSave,
            };
          }
          return u;
        });
        localStorage.setItem('pampero_registered_users', JSON.stringify(updatedUsers));
      }
    } catch {}

    onUpdateSession(updatedSession);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-[#F5F2EC] rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between border-b border-[#DCD4C9]">
          <div className="flex items-center gap-3">
            <div 
              style={{ backgroundColor: `${accent}30`, borderColor: `${accent}80` }}
              className="w-9 h-9 rounded-full border flex items-center justify-center text-white"
            >
              {userSession.role === 'admin' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : isCompany ? (
                <Building2 className="w-5 h-5 text-amber-300" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-display text-lg text-white font-bold tracking-wider uppercase leading-none">
                Mi Perfil de Usuario
              </h3>
              <p className="text-[11px] text-[#DCD4C9]/70 mt-1">
                {isCompany ? 'Cuenta Corporativa / Empresa' : 'Consumidor Final'} · Pampero Gran Mendoza
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#DCD4C9] bg-[#ECE5DC]/60 px-6 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={activeTab === 'profile' ? { borderColor: accent, color: '#18231C' } : {}}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'border-b-2 font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            Datos de Contacto
          </button>

          {/* Apartado de Seguridad (Visible y funcional TANTO para cuentas con rol admin como employee) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setEnrollError(null);
            }}
            style={activeTab === 'security' ? { borderColor: accent, color: '#18231C' } : {}}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'security'
                ? 'border-b-2 font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#B9522F]" />
            <span>Seguridad</span>
            {isEnrolled ? (
              <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                2FA Activo
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="2FA Pendiente" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotes')}
            style={activeTab === 'quotes' ? { borderColor: accent, color: '#18231C' } : {}}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'quotes'
                ? 'border-b-2 font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Historial de Cotizaciones
            {quoteHistory.length > 0 && (
              <span 
                style={{ backgroundColor: accent, color: '#18231C' }}
                className="px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold"
              >
                {quoteHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Content form */}
        {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {savedSuccess && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xs text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              ¡Datos actualizados con éxito! Tus cotizaciones ahora llevarán esta información.
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xs text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">Nota importante:</span> Estos datos de contacto y domicilio se incluyen automáticamente en cada solicitud de cotización que envíes al equipo de Pampero Gran Mendoza.
          </div>

          {isCompany && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                Razón Social / Nombre de Empresa *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Razón Social o Empresa"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                {isCompany ? 'Representante / Contacto *' : 'Nombre Completo *'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ingresar nombre completo"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                {isCompany ? 'CUIT *' : 'DNI / CUIT'}
              </label>
              <input
                type="text"
                required={isCompany}
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="XX-XXXXXXXX-X"
                className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 2612345678"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div className="border-t border-[#DCD4C9] pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" style={{ color: accent }} />
              Dirección de Entrega / Facturación
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Calle / Domicilio *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Calle y domicilio"
                  className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Número / Altura
                </label>
                <input
                  type="text"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  placeholder="Altura / Nro"
                  className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Ciudad / Departamento / Provincia
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Localidad / Departamento"
                className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#FDB813]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] rounded-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ backgroundColor: accent }}
              className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-xs flex items-center gap-1.5 shadow-xs hover:brightness-110 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Cambios
            </button>
          </div>
        </form>
        )}

        {/* TAB 2: Quote History */}
        {activeTab === 'quotes' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {quoteHistory.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#ECE5DC] flex items-center justify-center mx-auto text-[#6F6860]">
                  <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                </div>
                <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
                  No hay cotizaciones registradas
                </h4>
                <p className="text-xs text-[#6F6860] max-w-xs mx-auto">
                  Cada vez que agregues productos a tu lista y envíes una cotización por correo o WhatsApp, el carrito se vaciará y quedará registrado aquí en tu historial con todo el detalle de artículos y montos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#DCD4C9]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4A453F]">
                    {quoteHistory.length} {quoteHistory.length === 1 ? 'Cotización enviada' : 'Cotizaciones enviadas'}
                  </span>
                  <span className="text-[11px] text-[#6F6860]">
                    Ordenado por fecha más reciente
                  </span>
                </div>

                {quoteHistory.map((q, idx) => {
                  const dateStr = q.date ? new Date(q.date).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : 'Fecha reciente';

                  return (
                    <div
                      key={q.id || idx}
                      className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3 shadow-2xs hover:border-[#18231C] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-[#ECE5DC] pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#18231C]">
                              {q.id || `COT-#${idx + 1}`}
                            </span>
                            <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase rounded-xs">
                              {q.status === 'enviada_whatsapp' ? 'Enviada por WhatsApp' : 'Recibida en Ventas'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#6F6860] mt-1">
                            <Clock className="w-3 h-3" style={{ color: accent }} />
                            <span>{dateStr}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-[#6F6860] block">Estimado</span>
                          <span className="font-mono font-bold text-sm text-[#18231C]">
                            ${(q.totalEstimated || 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      {/* Items list summary */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-[#6F6860] tracking-wider block">
                          Artículos ({q.totalUnits || q.items?.length || 0} unidades):
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {Array.isArray(q.items) && q.items.map((it: any, itemIdx: number) => {
                            const pName = it.product?.name || it.productName || 'Producto';
                            const pCode = it.product?.code || it.productCode || '';
                            const qty = it.quantity || 1;
                            const size = it.selectedSize ? `Talle: ${it.selectedSize}` : '';
                            const color = it.selectedColor ? `Color: ${it.selectedColor}` : '';
                            const details = [size, color].filter(Boolean).join(' · ');

                            return (
                              <div key={itemIdx} className="flex items-center justify-between text-xs py-1 px-2 rounded-xs bg-[#FAF8F5]">
                                <div className="truncate pr-2">
                                  <span className="font-bold text-[#18231C]">{qty}x </span>
                                  <span className="font-medium text-[#18231C]">{pName}</span>
                                  {pCode && <span className="font-mono text-[10px] text-[#6F6860] ml-1">({pCode})</span>}
                                  {details && <span className="text-[10px] text-[#6F6860] block">{details}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {q.observations && (
                        <p className="text-[11px] text-[#6F6860] bg-[#FAF8F5] p-2 rounded-xs italic">
                          "{q.observations}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN SEGURIDAD: Enrolamiento MFA / TOTP para Admins, Empleados y Clientes */}
        {activeTab === 'security' && (
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Header de la sección */}
            <div className="flex items-start gap-3 p-3.5 bg-white border border-[#DCD4C9] rounded-xs shadow-2xs">
              <div 
                style={{ backgroundColor: `${accent}25` }}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              >
                <Smartphone className="w-5 h-5" style={{ color: '#B9522F' }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
                    Autenticación en Dos Pasos (2FA)
                  </h4>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-xs bg-[#18231C] text-white">
                    {userSession.role === 'admin' ? 'Super Admin' : userSession.role === 'employee' ? 'Personal / CRM' : 'Cliente'}
                  </span>
                </div>
                <p className="text-xs text-[#544E47] leading-relaxed mt-0.5">
                  Generá tu código QR personal para vincular <strong>Google Authenticator</strong> o <strong>Authy</strong> y proteger tus inicios de sesión.
                </p>
              </div>
            </div>

            {/* Mensajes de Alerta / Éxito */}
            {enrollError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{enrollError}</span>
              </div>
            )}

            {enrollSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xs text-xs flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{enrollSuccess}</span>
              </div>
            )}

            {/* Estado 1: Ya enrolado y no en modo de generación */}
            {isEnrolled && !isEnrolling && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Autenticador Vinculado y Activo</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Tu cuenta cuenta con protección de doble factor. Podés ingresar tanto con contraseña como mediante el token numérico de 6 dígitos de tu celular en la pantalla de inicio de sesión.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleStartEnrollment}
                    className="flex-1 py-2.5 px-4 bg-white border border-[#DCD4C9] hover:border-[#18231C] text-xs font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-vincular / Nuevo QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableMfa}
                    className="py-2.5 px-4 bg-white border border-red-200 hover:bg-red-50 text-xs font-bold uppercase tracking-wider text-red-600 rounded-xs cursor-pointer transition-colors"
                  >
                    Desvincular 2FA
                  </button>
                </div>
              </div>
            )}

            {/* Estado 2: No enrolado y no en modo de generación -> Botón para iniciar */}
            {!isEnrolled && !isEnrolling && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xs text-xs text-amber-950 leading-relaxed">
                  <p className="font-bold mb-1">Tu cuenta aún no tiene un autenticador vinculado.</p>
                  <p>
                    Al vincular tu aplicación, contarás con la máxima capa de seguridad corporativa. Si olvidás tu contraseña o necesitás acceso rápido, podrás entrar con el código de 6 dígitos que cambia cada 30 segundos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartEnrollment}
                  style={{ backgroundColor: '#18231C', color: '#FFFFFF' }}
                  className="w-full py-3.5 px-4 font-bold text-xs uppercase tracking-[0.2em] rounded-xs hover:brightness-110 flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs"
                >
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Vincular Autenticador (App)</span>
                </button>
              </div>
            )}

            {/* Estado 3: En proceso de enrolamiento (Muestra Código QR real + Clave secreta + Validación de 6 dígitos) */}
            {isEnrolling && (
              <div className="space-y-4 bg-white border border-[#DCD4C9] p-5 rounded-xs shadow-2xs">
                <div className="border-b border-[#DCD4C9] pb-3 flex items-center justify-between">
                  <h5 className="font-bold text-xs text-[#18231C] uppercase tracking-wider">
                    Vinculación de Dispositivo
                  </h5>
                  <span className="text-[10px] text-[#6F6860]">Paso obligatorio</span>
                </div>

                {/* Paso A: Código QR */}
                <div className="text-center">
                  <p className="text-xs text-[#544E47] mb-3">
                    <strong>1.</strong> Escaneá este código QR con <strong>Google Authenticator</strong> o <strong>Authy</strong>:
                  </p>
                  <div className="inline-block p-3.5 bg-white border-2 border-[#18231C] rounded-xs shadow-sm">
                    <QRCodeSVG 
                      value={mfaUri} 
                      size={180} 
                      level="M" 
                      marginSize={1}
                    />
                  </div>
                </div>

                {/* Paso B: Clave Secreta en texto plano por si falla la cámara */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] text-[#6F6860] font-semibold">
                    <strong>2.</strong> O ingresá la clave secreta manualmente (si tu cámara no escanea):
                  </p>
                  <div className="flex items-center justify-between bg-[#FAF8F5] border border-[#DCD4C9] px-3 py-2 rounded-xs">
                    <span className="font-mono text-xs font-black tracking-widest text-[#18231C] select-all">
                      {mfaSecret}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-xs text-[#B9522F] hover:text-[#18231C] font-bold flex items-center gap-1 cursor-pointer ml-2"
                      title="Copiar clave al portapapeles"
                    >
                      {copyFeedback ? (
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
                  <p className="text-[10px] text-[#8C847B]">
                    En tu app móvil elegí: "Ingresar clave de configuración" y escribí esta clave.
                  </p>
                </div>

                {/* Paso C: Formulario de Validación y Sellado de Enrolamiento con 6 dígitos */}
                <form onSubmit={handleConfirmEnrollment} className="pt-2 border-t border-[#DCD4C9]/70 space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A453F] mb-1.5">
                      <strong>3.</strong> INGRESÁ EL CÓDIGO DE 6 DÍGITOS GENERADO POR TU APP
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
                    <p className="text-[10px] text-[#8C847B] mt-1 text-center">
                      El código cambia cada 30 segundos en tu teléfono móvil.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnrolling(false);
                        setEnrollError(null);
                      }}
                      className="flex-1 py-2.5 border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C] bg-white rounded-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingMfa || mfaCode.length !== 6}
                      style={{ backgroundColor: '#18231C', color: '#FFFFFF' }}
                      className="flex-1 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xs hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSubmittingMfa ? (
                        <span>Validando...</span>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Confirmar y Sellar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
