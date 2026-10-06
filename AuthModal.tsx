import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '../services/firebase';
import { UserSession, ClientType, ConsumerClient, CompanyClient } from '../types';
import { PamperoLogo } from './PamperoLogo';
import { 
  User, 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Lock, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface AuthModalProps {
  onLogin: (session: UserSession) => void;
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onLogin,
  isOpen,
  onClose,
  canClose = false,
}) => {
  const [authTab, setAuthTab] = useState<'client' | 'admin'>('client');
  const [clientType, setClientType] = useState<ClientType>('consumidor_final');

  // Consumer Final fields
  const [consumerData, setConsumerData] = useState<ConsumerClient>({
    fullName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      number: '',
      postalCode: '',
      city: 'Gran Mendoza',
    },
  });

  // Company fields
  const [companyData, setCompanyData] = useState<CompanyClient>({
    repFullName: '',
    companyName: '',
    cuit: '',
    institutionalEmail: '',
    institutionalPhone: '',
    address: {
      street: '',
      number: '',
      postalCode: '',
      city: 'Gran Mendoza',
    },
  });

  // Admin credentials
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleConsumerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!consumerData.fullName.trim() || !consumerData.email.trim() || !consumerData.phone.trim()) {
      setFormError('Por favor complete todos los campos obligatorios para ingresar.');
      return;
    }

    if (!consumerData.address.street.trim() || !consumerData.address.number.trim()) {
      setFormError('Por favor ingrese calle y número de domicilio.');
      return;
    }

    // Save lead to local registered clients pool
    saveClientToRegistry('consumidor_final', consumerData);

    onLogin({
      role: 'client',
      clientType: 'consumidor_final',
      clientData: consumerData,
      loggedAt: new Date().toISOString(),
    });
  };

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !companyData.repFullName.trim() ||
      !companyData.companyName.trim() ||
      !companyData.cuit.trim() ||
      !companyData.institutionalEmail.trim() ||
      !companyData.institutionalPhone.trim()
    ) {
      setFormError('Por favor complete los datos institucionales obligatorios.');
      return;
    }

    if (!companyData.address.street.trim() || !companyData.address.number.trim()) {
      setFormError('Por favor ingrese el domicilio de la empresa.');
      return;
    }

    // Save lead to local registered clients pool
    saveClientToRegistry('empresa', companyData);

    onLogin({
      role: 'client',
      clientType: 'empresa',
      clientData: companyData,
      loggedAt: new Date().toISOString(),
    });
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const userClean = adminUser.trim().toLowerCase();
    const passClean = adminPass.trim();

    // 1. Check direct Cloud Firestore registered accounts first (Admins, Employees, Clients)
    try {
      const firestoreDb = getFirebaseDb();
      if (firestoreDb) {
        const snap = await getDocs(collection(firestoreDb, 'usuarios'));
        if (!snap.empty) {
          const matchedDoc = snap.docs.find((d) => {
            const data = d.data();
            const emailMatch = (data.email || '').toLowerCase().trim() === userClean;
            const passMatch = (data.password && data.password === passClean) || 
                              (data.initialPassword && data.initialPassword === passClean);
            return emailMatch && passMatch;
          });
          if (matchedDoc) {
            const matched = matchedDoc.data();
            const isAdminRole = matched.role === 'admin' || matched.type === 'admin';
            const isStaff = matched.role === 'employee' || matched.type === 'empleado' || matched.type === 'vendedor';
            const determinedRole: 'admin' | 'employee' | 'client' = 
              isAdminRole ? 'admin' : (isStaff ? 'employee' : 'client');
            onLogin({
              id: matchedDoc.id,
              role: determinedRole,
              email: matched.email,
              clientType: matched.type === 'empresa' ? 'empresa' : 'consumidor',
              clientData: {
                fullName: matched.repName || matched.name,
                companyName: matched.type === 'empresa' ? matched.name : undefined,
                cuit: matched.cuitOrDni,
                phone: matched.phone,
              },
              loggedAt: new Date().toISOString(),
            });
            return;
          }
        }
      }
    } catch (_fErr) {
      // Continue to local fallbacks
    }

    // 2. Check Employee accounts
    try {
      const empSaved = localStorage.getItem('pampero_employees');
      const empList: any[] = empSaved 
        ? JSON.parse(empSaved) 
        : [
            {
              id: 'emp-1',
              name: 'Ventas Pampero Maipú',
              email: 'ventas@pamperomaipu.com.ar',
              password: 'ventas_pampero',
              role: 'employee',
              allowedTabs: ['products', 'variants', 'prices', 'mass_images', 'promos', 'quotes'],
              active: true,
            }
          ];
      const matchedEmp = empList.find(
        (emp) => emp.active && (emp.email.toLowerCase() === userClean || (emp.username && emp.username.toLowerCase() === userClean)) && emp.password === passClean
      );
      if (matchedEmp) {
        onLogin({
          role: 'employee',
          email: matchedEmp.email,
          clientType: 'empresa',
          clientData: {
            fullName: matchedEmp.name,
            companyName: 'Pampero Maipú - Empleado',
          },
          loggedAt: new Date().toISOString(),
        });
        return;
      }
    } catch {}

    // Check Registered Users (Staff or Clients registered in system with assigned password)
    try {
      const usersRaw = localStorage.getItem('pampero_registered_users');
      if (usersRaw) {
        const list: any[] = JSON.parse(usersRaw);
        const matched = list.find((u) => {
          const emailMatch = u.email?.toLowerCase().trim() === userClean;
          const passMatch = (u.password && u.password === passClean) || (u.initialPassword && u.initialPassword === passClean);
          return emailMatch && passMatch;
        });
        if (matched) {
          const isAdminRole = matched.role === 'admin' || matched.type === 'admin';
          const isStaff = matched.role === 'employee' || matched.type === 'empleado' || matched.type === 'vendedor';
          const determinedRole: 'admin' | 'employee' | 'client' = 
            isAdminRole ? 'admin' : (isStaff ? 'employee' : 'client');
          onLogin({
            id: matched.id,
            role: determinedRole,
            email: matched.email,
            clientType: matched.type === 'empresa' ? 'empresa' : 'consumidor',
            clientData: {
              fullName: matched.repName || matched.name,
              companyName: matched.type === 'empresa' ? matched.name : undefined,
              cuit: matched.cuitOrDni,
              phone: matched.phone,
            },
            loggedAt: new Date().toISOString(),
          });
          return;
        }
      }
    } catch {}

    let savedEmail = 'admin@pampero.com';
    let savedPass = 'Pampero2026';
    try {
      const stored = localStorage.getItem('pampero_admin_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) savedEmail = parsed.email.trim().toLowerCase();
        if (parsed.password) savedPass = parsed.password;
      }
    } catch {
      // ignore
    }

    const legacyPass = localStorage.getItem('pampero_admin_pass');
    const customPass = localStorage.getItem('pampero_admin_custom_password');

    const isUserValid = 
      userClean === 'admin' || 
      userClean === 'admin@pampero.com' || 
      userClean === 'admin@pampero.com.ar' || 
      userClean === 'pampero' || 
      userClean === savedEmail.toLowerCase();

    const isPassValid = 
      passClean === 'Pampero2026' ||
      passClean.toLowerCase() === 'pampero2026' ||
      (savedPass && passClean === savedPass) ||
      (savedPass && passClean.toLowerCase() === savedPass.toLowerCase()) ||
      (customPass && passClean === customPass) ||
      (legacyPass && passClean === legacyPass) ||
      passClean === 'admin' ||
      passClean === 'pampero_admin';

    if (isUserValid && isPassValid) {
      onLogin({
        id: 'admin-master',
        role: 'admin',
        email: savedEmail || 'admin@pampero.com',
        loggedAt: new Date().toISOString(),
      });
    } else {
      setAdminError('Usuario o contraseña de administrador o empleado incorrectos.');
    }
  };

  const saveClientToRegistry = (type: ClientType, data: ConsumerClient | CompanyClient) => {
    try {
      const existing = JSON.parse(localStorage.getItem('pampero_registered_leads') || '[]');
      const newLead = {
        id: 'lead-' + Date.now(),
        type,
        data,
        date: new Date().toLocaleDateString('es-AR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      existing.unshift(newLead);
      localStorage.setItem('pampero_registered_leads', JSON.stringify(existing));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        id="pampero-auth-card" 
        className="w-full max-w-xl my-auto bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
      >
        {/* Header with Pampero Logo */}
        <div className="bg-[#0F172A] text-white p-6 sm:p-8 text-center relative border-b border-neutral-800">
          <div className="flex justify-center mb-3">
            <PamperoLogo variant="light" size="lg" />
          </div>
          <p className="text-neutral-300 text-sm font-medium tracking-wide">
            Catálogo Oficial de Indumentaria, Calzado y Equipamiento de Trabajo
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Acceso Exclusivo Gran Mendoza
          </div>

          {canClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 rounded-lg text-sm"
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Access Switch Tabs: Cliente vs Administrador */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 p-2 gap-2">
          <button
            id="tab-client-access"
            type="button"
            onClick={() => setAuthTab('client')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              authTab === 'client'
                ? 'bg-white text-[#111111] shadow-sm border border-neutral-200/80'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <User className="w-4 h-4 text-[#E52421]" />
            Acceso Clientes
          </button>
          <button
            id="tab-admin-access"
            type="button"
            onClick={() => setAuthTab('admin')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              authTab === 'admin'
                ? 'bg-white text-[#111111] shadow-sm border border-neutral-200/80'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            Admin / Empleados
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {authTab === 'client' ? (
            <div>
              <div className="mb-6">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5">
                  Seleccione su tipo de cuenta para ver precios y cotizaciones:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClientType('consumidor_final')}
                    className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                      clientType === 'consumidor_final'
                        ? 'border-[#E52421] bg-red-50/50 text-[#111111]'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <User className={`w-5 h-5 shrink-0 mt-0.5 ${clientType === 'consumidor_final' ? 'text-[#E52421]' : 'text-neutral-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Consumidor Final</div>
                      <div className="text-xs text-neutral-500">Particular, campo, aventura</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientType('empresa')}
                    className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                      clientType === 'empresa'
                        ? 'border-[#E52421] bg-red-50/50 text-[#111111]'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <Building2 className={`w-5 h-5 shrink-0 mt-0.5 ${clientType === 'empresa' ? 'text-[#E52421]' : 'text-neutral-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Empresa / Razón Social</div>
                      <div className="text-xs text-neutral-500">Dotaciones y venta mayorista</div>
                    </div>
                  </button>
                </div>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <span>⚠️</span> {formError}
                </div>
              )}

              {/* Mensaje motivador y persuasivo sobre beneficios */}
              <div className="mb-5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 text-amber-800">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs text-neutral-700 leading-relaxed">
                  <p className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-0.5">
                    ¡Registrate y aprovechá los beneficios exclusivos!
                  </p>
                  <p>
                    Creá tu cuenta para acceder a <strong>atención personalizada</strong>, <strong>agilización en ventas corporativas y cotizaciones</strong>, y el <strong>guardado permanente de tu historial de cotizaciones</strong> para gestionar tus pedidos con total comodidad.
                  </p>
                </div>
              </div>

              {/* FORM: Consumidor Final */}
              {clientType === 'consumidor_final' ? (
                <form onSubmit={handleConsumerSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                      Nombre Completo *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                      <input
                        id="client-name-input"
                        type="text"
                        required
                        placeholder="Ej. Juan Pérez"
                        value={consumerData.fullName}
                        onChange={(e) => setConsumerData({ ...consumerData, fullName: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] focus:ring-2 focus:ring-red-100 text-sm outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        E-mail *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="client-email-input"
                          type="email"
                          required
                          placeholder="juan@gmail.com"
                          value={consumerData.email}
                          onChange={(e) => setConsumerData({ ...consumerData, email: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] focus:ring-2 focus:ring-red-100 text-sm outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Número de Teléfono / WhatsApp *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="client-phone-input"
                          type="tel"
                          required
                          placeholder="261 555 1234"
                          value={consumerData.phone}
                          onChange={(e) => setConsumerData({ ...consumerData, phone: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] focus:ring-2 focus:ring-red-100 text-sm outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dirección actual de domicilio */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      Dirección de Domicilio *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          id="client-street-input"
                          type="text"
                          required
                          placeholder="Calle"
                          value={consumerData.address.street}
                          onChange={(e) =>
                            setConsumerData({
                              ...consumerData,
                              address: { ...consumerData.address, street: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                        />
                      </div>
                      <div>
                        <input
                          id="client-number-input"
                          type="text"
                          required
                          placeholder="Número"
                          value={consumerData.address.number}
                          onChange={(e) =>
                            setConsumerData({
                              ...consumerData,
                              address: { ...consumerData.address, number: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        id="client-cp-input"
                        type="text"
                        placeholder="Código Postal (ej. 5500)"
                        value={consumerData.address.postalCode}
                        onChange={(e) =>
                          setConsumerData({
                            ...consumerData,
                            address: { ...consumerData.address, postalCode: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                      />
                      <input
                        id="client-city-input"
                        type="text"
                        placeholder="Localidad / Departamento"
                        value={consumerData.address.city}
                        onChange={(e) =>
                          setConsumerData({
                            ...consumerData,
                            address: { ...consumerData.address, city: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                      />
                    </div>
                  </div>

                  <button
                    id="btn-enter-consumer"
                    type="submit"
                    className="w-full mt-5 py-3 px-5 rounded-xl bg-[#E52421] hover:bg-red-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    Ingresar al Catálogo Pampero
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* FORM: Empresa */
                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Representante (quien mira el catálogo) *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="company-rep-input"
                          type="text"
                          required
                          placeholder="Nombre y Apellido"
                          value={companyData.repFullName}
                          onChange={(e) => setCompanyData({ ...companyData, repFullName: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Nombre de la Empresa / Razón Social *
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="company-name-input"
                          type="text"
                          required
                          placeholder="Ej. Bodegas & Viñedos S.A."
                          value={companyData.companyName}
                          onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        CUIT *
                      </label>
                      <div className="relative">
                        <FileText className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="company-cuit-input"
                          type="text"
                          required
                          placeholder="30-XXXXXXXX-X"
                          value={companyData.cuit}
                          onChange={(e) => setCompanyData({ ...companyData, cuit: e.target.value })}
                          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Mail Institucional *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="company-email-input"
                          type="email"
                          required
                          placeholder="compras@empresa.com"
                          value={companyData.institutionalEmail}
                          onChange={(e) => setCompanyData({ ...companyData, institutionalEmail: e.target.value })}
                          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Teléfono Institucional *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                        <input
                          id="company-phone-input"
                          type="tel"
                          required
                          placeholder="261 4XXXXXX"
                          value={companyData.institutionalPhone}
                          onChange={(e) => setCompanyData({ ...companyData, institutionalPhone: e.target.value })}
                          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 focus:border-[#E52421] text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Domicilio de la empresa */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      Domicilio de la Empresa *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          id="company-street-input"
                          type="text"
                          required
                          placeholder="Calle"
                          value={companyData.address.street}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              address: { ...companyData.address, street: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                        />
                      </div>
                      <div>
                        <input
                          id="company-number-input"
                          type="text"
                          required
                          placeholder="Número"
                          value={companyData.address.number}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              address: { ...companyData.address, number: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        id="company-cp-input"
                        type="text"
                        placeholder="Código Postal (ej. 5501)"
                        value={companyData.address.postalCode}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            address: { ...companyData.address, postalCode: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                      />
                      <input
                        id="company-city-input"
                        type="text"
                        placeholder="Parque Industrial / Localidad"
                        value={companyData.address.city}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            address: { ...companyData.address, city: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-[#E52421] text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-100 rounded-lg text-xs text-neutral-600 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Las cuentas de empresa habilitan precios de dotación mayorista y cotizador directo por volumen.</span>
                  </div>

                  <button
                    id="btn-enter-company"
                    type="submit"
                    className="w-full mt-4 py-3 px-5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    Ingresar con Cuenta Corporativa
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ADMIN ACCESS TAB */
            <div>
              <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-1">
                  <ShieldCheck className="w-5 h-5 text-slate-700" />
                  Panel de Control Pampero Gran Mendoza
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Acceso restringido para el propietario/administrador y empleados autorizados.
                </p>
              </div>

              {adminError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Usuario o Email (Admin / Empleado)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      id="admin-user-input"
                      type="text"
                      required
                      autoComplete="new-password"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-slate-800 text-sm font-medium"
                      placeholder="admin o email corporativo"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      id="admin-pass-input"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Contraseña autorizada"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-neutral-300 focus:border-slate-800 text-sm font-medium"
                    />
                  </div>
                </div>

                <button
                  id="btn-login-admin"
                  type="submit"
                  className="w-full mt-4 py-3 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Iniciar Sesión como Administrador
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
