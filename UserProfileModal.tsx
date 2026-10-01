import React, { useState, useEffect } from 'react';
import { UserSession, ThemeConfig } from '../types';
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
  Compass,
  Settings,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession | null;
  onUpdateSession: (updatedSession: UserSession) => void;
  onOpenHub?: () => void;
  onOpenAdmin?: () => void;
  theme: ThemeConfig;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userSession,
  onUpdateSession,
  onOpenHub,
  onOpenAdmin,
  theme,
}) => {
  if (!isOpen || !userSession) return null;

  const accent = theme?.accentColor || '#FDB813';
  const isCompany = userSession.clientType === 'empresa';
  const isStaff = userSession.role === 'admin' || userSession.role === 'employee';
  const d = userSession.clientData || {};

  const [activeTab, setActiveTab] = useState<'profile' | 'quotes'>('profile');
  const [quoteHistory, setQuoteHistory] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

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

  // Load quotes and live sync with CRM orders
  useEffect(() => {
    try {
      const savedQuotesRaw = localStorage.getItem('pampero_received_quotes');
      const crmOrdersRaw = localStorage.getItem('pampero_crm_orders');
      const crmOrders: any[] = crmOrdersRaw ? JSON.parse(crmOrdersRaw) : [];
      let list: any[] = savedQuotesRaw ? JSON.parse(savedQuotesRaw) : [];

      // Filter by current user or company
      const userEmail = (userSession.email || '').toLowerCase().trim();
      const userClientName = (userSession.clientData?.fullName || (userSession.clientData as any)?.companyName || '').toLowerCase().trim();

      const userQuotes = list.filter((q: any) => {
        if (!userEmail && !userClientName) return true;
        const qEmail = (q.clientEmail || '').toLowerCase().trim();
        const qName = (q.clientName || '').toLowerCase().trim();
        return (userEmail && qEmail === userEmail) || (userClientName && qName.includes(userClientName));
      });

      // Synchronize with CRM status
      const merged = (userQuotes.length > 0 ? userQuotes : list).map((q: any) => {
        const crmMatch = crmOrders.find(
          (o: any) => o.id === q.id || o.quoteId === q.id || (q.id && o.id?.includes(q.id))
        );
        return {
          ...q,
          liveStatus: crmMatch?.status || q.status || 'cotizacion',
          crmOrder: crmMatch,
        };
      });

      setQuoteHistory(merged);
    } catch {
      setQuoteHistory([]);
    }
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

    // 1. Save to pampero_session
    try {
      localStorage.setItem('pampero_session', JSON.stringify(updatedSession));
    } catch {}

    // 2. Also update pampero_registered_users pool
    try {
      const usersStr = localStorage.getItem('pampero_registered_users');
      if (usersStr) {
        const users = JSON.parse(usersStr);
        const updatedUsers = users.map((u: any) => {
          if (u.id === userSession.id || (userSession.email && u.email === userSession.email)) {
            return {
              ...u,
              name: isCompany ? (companyName.trim() || fullName.trim()) : fullName.trim(),
              repName: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              cuitOrDni: cuit.trim(),
              address: formattedAddressStr,
              city: city.trim(),
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

        {/* Staff Quick Action Bar: Primary "Menú Principal" vs Secondary "Panel de Control" */}
        {isStaff && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-950 uppercase">
              Accesos de {userSession.role === 'admin' ? 'Administrador' : 'Personal Pampero'}:
            </span>
            <div className="flex items-center gap-2">
              {onOpenHub && (
                <button
                  type="button"
                  onClick={onOpenHub}
                  className="px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Ir al Menú Principal de Personal"
                >
                  <Compass className="w-3.5 h-3.5 text-[#FDB813]" />
                  <span>Menú Principal</span>
                </button>
              )}
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                  title="Abrir Panel de Control"
                >
                  <Settings className="w-3.5 h-3.5 text-[#6F6860]" />
                  <span>Panel de Control</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-[#DCD4C9] bg-[#ECE5DC]/60 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={activeTab === 'profile' ? { borderColor: accent, color: '#18231C' } : {}}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-b-2 font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            Datos de Contacto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quotes')}
            style={activeTab === 'quotes' ? { borderColor: accent, color: '#18231C' } : {}}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
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
                  placeholder="Ej. Distribuidora Cuyo S.A."
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
                  placeholder="Tu nombre y apellido"
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
                placeholder="20-xxxxxxxx-x"
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
                  placeholder="tucorreo@ejemplo.com"
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
                  placeholder="Ej. +54 9 261 123-4567"
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
                  placeholder="Ej. San Martín"
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
                  placeholder="1234"
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
                placeholder="Maipú / Mendoza"
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

        {/* TAB 2: Quote History & Live CRM Tracking */}
        {activeTab === 'quotes' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {/* Quick Order Number Search Box */}
            <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-2">
              <label className="block text-[11px] font-bold text-[#18231C] uppercase tracking-wider flex items-center justify-between">
                <span>Consultar Estado de Mi Pedido por Número</span>
                <span className="text-[10px] text-[#B9522F] font-semibold">En tiempo real</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#8C827A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Ingresá tu número de pedido (ej: COT-892101 o PED-...)"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>

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
                    {quoteHistory.length} {quoteHistory.length === 1 ? 'Cotización registrada' : 'Cotizaciones registradas'}
                  </span>
                  <span className="text-[11px] text-[#6F6860]">
                    Sincronizado con Seguimiento Empresas
                  </span>
                </div>

                {quoteHistory
                  .filter((q) => {
                    if (!orderSearchQuery.trim()) return true;
                    const qId = (q.id || '').toLowerCase();
                    const s = orderSearchQuery.trim().toLowerCase();
                    return qId.includes(s);
                  })
                  .map((q, idx) => {
                  const dateStr = q.date ? new Date(q.date).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : 'Fecha reciente';

                  const currentStep = q.liveStatus || q.status || 'cotizacion';
                  const stepOrder = ['cotizacion', 'sena_50', 'produccion', 'listo', 'entregado'];
                  const stepIndex = stepOrder.indexOf(currentStep);
                  const stepLabels: Record<string, string> = {
                    cotizacion: '1. Cotización Recibida',
                    sena_50: '2. Aprobado / Seña 50%',
                    produccion: '3. En Bordados / Taller',
                    listo: '4. Listo para Retirar',
                    entregado: '5. Entregado / Cerrado',
                  };

                  return (
                    <div
                      key={q.id || idx}
                      className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3 shadow-2xs hover:border-[#18231C] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-[#ECE5DC] pb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-[#18231C] px-2 py-0.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                              {q.id || `COT-#${idx + 1}`}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase rounded-xs">
                              {stepLabels[currentStep] || currentStep}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#6F6860] mt-1.5">
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

                      {/* Live Step Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[10px] font-bold text-[#6F6860] uppercase">
                          <span>Estado actual:</span>
                          <span className="text-[#B9522F]">{stepLabels[currentStep] || 'En Proceso'}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {stepOrder.map((stepKey, sIdx) => {
                            const isCompleted = stepIndex >= sIdx;
                            const isCurrent = stepIndex === sIdx;
                            return (
                              <div
                                key={stepKey}
                                className={`h-2 rounded-full transition-all ${
                                  isCurrent
                                    ? 'bg-[#B9522F] ring-2 ring-[#B9522F]/30 animate-pulse'
                                    : isCompleted
                                    ? 'bg-[#18231C]'
                                    : 'bg-[#ECE5DC]'
                                }`}
                                title={stepLabels[stepKey]}
                              />
                            );
                          })}
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
      </div>
    </div>
  );
};
