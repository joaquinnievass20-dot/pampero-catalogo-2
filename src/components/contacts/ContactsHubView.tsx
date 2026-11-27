import React, { useEffect, useMemo, useState } from 'react';
import {
  ContactCategory,
  CRMContactRecord,
  CRMOrder,
  EmployeeAccount,
  LeadVisit,
  RegisteredUser,
  SupplierOrder,
  ThemeConfig,
  UserSession,
} from '../../types';
import {
  deleteCRMContact,
  saveCRMContact,
  subscribeToCRMContacts,
  subscribeToCRMOrders,
  subscribeToFirestoreEmployees,
  subscribeToFirestoreUsers,
  subscribeToLeadVisits,
  subscribeToSupplierOrders,
} from '../../services/firebase';
import { useConfiguredBranches } from '../../utils/useConfiguredBranches';
import { branchMatches } from '../../utils/rrhhBranches';
import { fixUtf8Encoding } from '../../utils/encodingUtils';
import { PamperoLogo } from '../PamperoLogo';
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Edit3,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';

interface ContactsHubViewProps {
  userSession: UserSession | null;
  theme?: ThemeConfig;
  onClose: () => void;
}

interface UnifiedContactRow {
  uid: string;
  source: 'custom' | 'colaborador' | 'cliente' | 'proveedor';
  editableRecord?: CRMContactRecord;
  category: ContactCategory;
  subCategory?: string;
  name: string;
  companyOrOrg?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  cuitOrDni?: string;
  branch?: string;
  address?: string;
  notes?: string;
}

const CATEGORY_META: Record<ContactCategory, { label: string; badgeClass: string; icon: any }> = {
  colaborador: { label: 'Colaboradores', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: Users },
  cliente: { label: 'Clientes / Empresas', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', icon: Building2 },
  proveedor: { label: 'Proveedores', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200', icon: Truck },
  cuenta_importante: { label: 'Cuentas Importantes', badgeClass: 'bg-purple-50 text-purple-900 border-purple-200', icon: Landmark },
};

const IMPORTANT_SUBCATEGORIES = [
  'ARCA (AFIP)',
  'ATM Mendoza',
  'Proveedor del Estado',
  'Banco / Entidad Financiera',
  'Servicio (Luz / Gas / Agua / Internet)',
  'Estudio Contable / Jurídico',
  'Municipalidad / Organismo',
  'Otro Organismo / Cuenta Clave',
];

export const ContactsHubView: React.FC<ContactsHubViewProps> = ({ userSession, theme, onClose }) => {
  const { branchNames: configuredBranchNames, resolveBranch: resolveConfiguredBranch } = useConfiguredBranches();

  const [customContacts, setCustomContacts] = useState<CRMContactRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [crmOrders, setCrmOrders] = useState<CRMOrder[]>([]);
  const [leadVisits, setLeadVisits] = useState<LeadVisit[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<'todos' | ContactCategory>('todos');
  const [branchFilter, setBranchFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CRMContactRecord | null>(null);

  // Modal Form fields
  const [formCategory, setFormCategory] = useState<ContactCategory>('cuenta_importante');
  const [formSubCategory, setFormSubCategory] = useState('ARCA (AFIP)');
  const [formName, setFormName] = useState('');
  const [formCompanyOrOrg, setFormCompanyOrOrg] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCuitOrDni, setFormCuitOrDni] = useState('');
  const [formBranch, setFormBranch] = useState('Todas');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const u1 = subscribeToCRMContacts(setCustomContacts);
    const u2 = subscribeToFirestoreEmployees(setEmployees);
    const u3 = subscribeToFirestoreUsers(setUsers);
    const u4 = subscribeToCRMOrders(setCrmOrders);
    const u5 = subscribeToLeadVisits(setLeadVisits);
    const u6 = subscribeToSupplierOrders(setSupplierOrders);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  const unifiedList = useMemo<UnifiedContactRow[]>(() => {
    const rows: UnifiedContactRow[] = [];
    const seenKeys = new Set<string>();

    // 1. Custom saved contacts (highest priority so edits/notes win)
    customContacts.forEach((c) => {
      const k = `${c.category}:${(c.email || c.name || '').toLowerCase().trim()}`;
      seenKeys.add(k);
      rows.push({
        uid: `custom-${c.id}`,
        source: 'custom',
        editableRecord: c,
        category: c.category,
        subCategory: c.subCategory,
        name: fixUtf8Encoding(c.name),
        companyOrOrg: c.companyOrOrg ? fixUtf8Encoding(c.companyOrOrg) : undefined,
        phone: c.phone,
        whatsapp: c.whatsapp,
        email: c.email,
        cuitOrDni: c.cuitOrDni,
        branch: c.branch ? resolveConfiguredBranch(c.branch, true) : undefined,
        address: c.address ? fixUtf8Encoding(c.address) : undefined,
        notes: c.notes ? fixUtf8Encoding(c.notes) : undefined,
      });
    });

    // 2. Colaboradores activos
    employees.forEach((emp) => {
      const email = String(emp.email || '').trim();
      const name = fixUtf8Encoding(emp.name || emp.sellerName || email.split('@')[0] || 'Colaborador');
      const k = `colaborador:${(email || name).toLowerCase()}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      rows.push({
        uid: `emp-${emp.id}`,
        source: 'colaborador',
        category: 'colaborador',
        subCategory: emp.sellerRole === 'encargado' ? 'Encargado General' : 'Colaborador Local',
        name,
        companyOrOrg: emp.branch ? resolveConfiguredBranch(emp.branch, true) : 'Pampero Gran Mendoza',
        phone: emp.phone,
        whatsapp: emp.phone,
        email,
        cuitOrDni: undefined,
        branch: emp.branch ? resolveConfiguredBranch(emp.branch, true) : 'Todas',
      });
    });

    // 3. Clientes registrados + Empresas de Visitas & Pedidos
    users
      .filter((u) => u.role === 'client' || (!u.role && u.type !== 'admin' && u.type !== 'empleado'))
      .forEach((u) => {
        const displayName = fixUtf8Encoding(u.clientData?.companyName || u.clientData?.fullName || u.name || u.email);
        const k = `cliente:${(u.email || displayName).toLowerCase().trim()}`;
        if (seenKeys.has(k)) return;
        seenKeys.add(k);
        rows.push({
          uid: `usr-${u.id}`,
          source: 'cliente',
          category: 'cliente',
          subCategory: u.clientType === 'empresa' ? 'Empresa' : 'Consumidor Final',
          name: displayName,
          companyOrOrg: u.clientData?.companyName ? fixUtf8Encoding(u.clientData.companyName) : undefined,
          phone: u.phone || u.clientData?.phone,
          whatsapp: u.phone || u.clientData?.phone,
          email: u.email,
          cuitOrDni: u.clientData?.cuit,
          address: u.clientData?.address ? fixUtf8Encoding(u.clientData.address) : undefined,
          branch: u.nearestBranch ? resolveConfiguredBranch(u.nearestBranch, true) : undefined,
        });
      });

    crmOrders.forEach((o) => {
      const nm = fixUtf8Encoding(o.clientName || '').trim();
      if (!nm) return;
      const k = `cliente:${(o.clientEmail || nm).toLowerCase()}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      rows.push({
        uid: `ord-${o.id}`,
        source: 'cliente',
        category: 'cliente',
        subCategory: o.clientType === 'empresa' ? 'Empresa CRM' : 'Cliente CRM',
        name: nm,
        companyOrOrg: o.clientType === 'empresa' ? nm : undefined,
        phone: o.clientPhone,
        whatsapp: o.clientPhone,
        email: o.clientEmail,
        address: o.companyLocation ? fixUtf8Encoding(o.companyLocation) : undefined,
        branch: o.branch ? resolveConfiguredBranch(o.branch, true) : undefined,
      });
    });

    leadVisits.forEach((v) => {
      const nm = fixUtf8Encoding(v.companyName || '').trim();
      if (!nm) return;
      const k = `cliente:${(v.email || nm).toLowerCase()}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      rows.push({
        uid: `vis-${v.id}`,
        source: 'cliente',
        category: 'cliente',
        subCategory: v.contactName ? `Contacto: ${fixUtf8Encoding(v.contactName)}` : 'Prospecto Visita',
        name: v.contactName ? `${nm} (${fixUtf8Encoding(v.contactName)})` : nm,
        companyOrOrg: nm,
        phone: v.phone,
        whatsapp: v.phone,
        email: v.email,
        address: v.companyLocation ? fixUtf8Encoding(v.companyLocation) : undefined,
        branch: v.branch ? resolveConfiguredBranch(v.branch, true) : undefined,
      });
    });

    // 4. Proveedores desde Pedidos a Proveedor
    supplierOrders.forEach((so) => {
      const sp = fixUtf8Encoding(so.supplierName || '').trim();
      if (!sp) return;
      const k = `proveedor:${sp.toLowerCase()}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      rows.push({
        uid: `sup-${sp.toLowerCase()}`,
        source: 'proveedor',
        category: 'proveedor',
        subCategory: 'Proveedor Textil / Indumentaria',
        name: sp,
        companyOrOrg: sp,
        branch: so.branchDestination ? resolveConfiguredBranch(so.branchDestination, true) : undefined,
        notes: so.responsibleStaff ? `Responsable interno: ${fixUtf8Encoding(so.responsibleStaff)}` : undefined,
      });
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [customContacts, employees, users, crmOrders, leadVisits, supplierOrders, resolveConfiguredBranch]);

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {
      todos: unifiedList.length,
      colaborador: 0,
      cliente: 0,
      proveedor: 0,
      cuenta_importante: 0,
    };
    unifiedList.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [unifiedList]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unifiedList.filter((r) => {
      if (categoryFilter !== 'todos' && r.category !== categoryFilter) return false;
      if (branchFilter !== 'todos') {
        if (!r.branch || (r.branch.toLowerCase() !== 'todas' && !branchMatches(r.branch, branchFilter))) {
          return false;
        }
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.companyOrOrg || '').toLowerCase().includes(q) ||
        (r.subCategory || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.cuitOrDni || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    });
  }, [unifiedList, categoryFilter, branchFilter, searchQuery]);

  const openNewModal = (defaultCat: ContactCategory = 'cuenta_importante') => {
    setEditingRecord(null);
    setFormCategory(defaultCat);
    setFormSubCategory(defaultCat === 'cuenta_importante' ? 'ARCA (AFIP)' : '');
    setFormName('');
    setFormCompanyOrOrg('');
    setFormPhone('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormCuitOrDni('');
    setFormBranch('Todas');
    setFormAddress('');
    setFormNotes('');
    setShowModal(true);
  };

  const openEditOrPromoteModal = (row: UnifiedContactRow) => {
    if (row.editableRecord) {
      const r = row.editableRecord;
      setEditingRecord(r);
      setFormCategory(r.category);
      setFormSubCategory(r.subCategory || '');
      setFormName(fixUtf8Encoding(r.name || ''));
      setFormCompanyOrOrg(fixUtf8Encoding(r.companyOrOrg || ''));
      setFormPhone(r.phone || '');
      setFormWhatsapp(r.whatsapp || '');
      setFormEmail(r.email || '');
      setFormCuitOrDni(r.cuitOrDni || '');
      setFormBranch(r.branch ? resolveConfiguredBranch(r.branch, true) : 'Todas');
      setFormAddress(fixUtf8Encoding(r.address || ''));
      setFormNotes(fixUtf8Encoding(r.notes || ''));
    } else {
      setEditingRecord(null);
      setFormCategory(row.category);
      setFormSubCategory(row.subCategory || '');
      setFormName(row.name || '');
      setFormCompanyOrOrg(row.companyOrOrg || '');
      setFormPhone(row.phone || '');
      setFormWhatsapp(row.whatsapp || '');
      setFormEmail(row.email || '');
      setFormCuitOrDni(row.cuitOrDni || '');
      setFormBranch(row.branch || 'Todas');
      setFormAddress(row.address || '');
      setFormNotes(row.notes || '');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSaving(true);
    const payload: CRMContactRecord = {
      id: editingRecord?.id || '',
      category: formCategory,
      subCategory: formSubCategory.trim() || undefined,
      name: formName.trim(),
      companyOrOrg: formCompanyOrOrg.trim() || undefined,
      phone: formPhone.trim() || undefined,
      whatsapp: formWhatsapp.trim() || undefined,
      email: formEmail.trim() || undefined,
      cuitOrDni: formCuitOrDni.trim() || undefined,
      branch: formBranch,
      address: formAddress.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdBy: editingRecord?.createdBy || userSession?.name || userSession?.email || 'Equipo Pampero',
      createdAt: editingRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveCRMContact(payload);
    setIsSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (rec: CRMContactRecord) => {
    if (!confirm(`¿Eliminar el contacto "${rec.name}" de la agenda?`)) return;
    await deleteCRMContact(rec.id);
  };

  const copyValue = (key: string, val?: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#18231C] flex flex-col animate-fadeIn">
      {/* Top Bar */}
      <header className="bg-[#18231C] text-[#FAF8F5] px-4 sm:px-8 py-4 border-b border-black/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <PamperoLogo
            customUrl={theme?.customLogoUrl || theme?.logoUrl}
            height={28}
            size="sm"
            onDarkBackground
            variant="light"
          />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-base sm:text-lg uppercase tracking-wider text-[#FDB813] truncate">
              Directorio de Contactos
            </h1>
            <p className="text-[11px] text-[#DCD4C9]/80 truncate">
              Colaboradores, Clientes, Proveedores y Cuentas Importantes (ARCA, ATM, Proveedores del Estado, Bancos)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openNewModal('cuenta_importante')}
            className="px-3.5 py-2 bg-[#FDB813] hover:bg-amber-400 text-[#18231C] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver al Hub</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Category Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('todos')}
            className={`px-3.5 py-2 rounded-xs border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              categoryFilter === 'todos'
                ? 'bg-[#18231C] text-[#FDB813] border-[#18231C]'
                : 'bg-white text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
            }`}
          >
            <span>Todos</span>
            <span className="font-mono tabular-nums text-[11px] opacity-80">({countsByCategory.todos})</span>
          </button>

          {(Object.keys(CATEGORY_META) as ContactCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-2 rounded-xs border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#18231C] text-[#FDB813] border-[#18231C]'
                    : 'bg-white text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">({countsByCategory[cat] || 0})</span>
              </button>
            );
          })}
        </div>

        {/* Search & Branch Filter */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#8C827A] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, organismo, ARCA, ATM, CUIT, mail o teléfono..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold text-[#18231C] outline-none cursor-pointer"
          >
            <option value="todos">Local: Todos</option>
            {configuredBranchNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <span className="text-[11px] font-bold uppercase text-[#6F6860] tabular-nums ml-auto">
            {filteredList.length} contactos
          </span>
        </div>

        {/* Contacts Table */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden shadow-2xs">
          {filteredList.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-[#6F6860]">
              <p className="text-sm font-semibold text-[#18231C]">No se encontraron contactos con este filtro.</p>
              <p className="text-xs">Podés agregar proveedores del Estado, cuentas de ARCA, ATM, bancos o clientes clave desde "Nuevo Contacto".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] uppercase tracking-wider text-[#6F6860]">
                  <tr>
                    <th className="p-3 font-bold">Nombre / Organismo</th>
                    <th className="p-3 font-bold">Categoría</th>
                    <th className="p-3 font-bold">Teléfono / WhatsApp</th>
                    <th className="p-3 font-bold">Email</th>
                    <th className="p-3 font-bold">CUIT / DNI</th>
                    <th className="p-3 font-bold">Local</th>
                    <th className="p-3 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE5DC]">
                  {filteredList.map((row) => {
                    const meta = CATEGORY_META[row.category];
                    const cleanPhone = (row.whatsapp || row.phone || '').replace(/\D/g, '');
                    return (
                      <tr key={row.uid} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#18231C]">{row.name}</div>
                          {(row.companyOrOrg && row.companyOrOrg !== row.name) && (
                            <div className="text-[11px] text-[#6F6860]">{row.companyOrOrg}</div>
                          )}
                          {row.address && (
                            <div className="text-[10px] text-[#8C827A] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              <span>{row.address}</span>
                            </div>
                          )}
                          {row.notes && (
                            <div className="text-[10px] text-[#4A453F] mt-0.5 italic">{row.notes}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-xs border text-[10px] font-bold ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                          {row.subCategory && (
                            <span className="block text-[10px] text-[#6F6860] mt-1 font-medium">
                              {row.subCategory}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono tabular-nums">
                          {row.phone || row.whatsapp ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-[#6F6860] shrink-0" />
                              <span>{row.whatsapp || row.phone}</span>
                              {cleanPhone.length >= 7 && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-1.5 py-0.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-800 rounded-xs text-[10px] font-sans font-bold inline-flex items-center gap-0.5"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="w-2.5 h-2.5" />
                                  <span>WA</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#A69E94]">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-[#6F6860] shrink-0" />
                              <span className="truncate max-w-[180px]">{row.email}</span>
                              <button
                                type="button"
                                onClick={() => copyValue(`em-${row.uid}`, row.email)}
                                className="p-1 hover:bg-[#ECE5DC] rounded-xs text-[#6F6860] cursor-pointer"
                                title="Copiar email"
                              >
                                {copiedId === `em-${row.uid}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#A69E94]">-</span>
                          )}
                        </td>
                        <td className="p-3 font-mono tabular-nums">
                          {row.cuitOrDni ? (
                            <div className="flex items-center gap-1">
                              <span>{row.cuitOrDni}</span>
                              <button
                                type="button"
                                onClick={() => copyValue(`id-${row.uid}`, row.cuitOrDni)}
                                className="p-1 hover:bg-[#ECE5DC] rounded-xs text-[#6F6860] cursor-pointer"
                                title="Copiar CUIT/DNI"
                              >
                                {copiedId === `id-${row.uid}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#A69E94]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-[11px] font-medium text-[#4A453F]">
                          {row.branch || 'General'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditOrPromoteModal(row)}
                              className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[11px] font-bold text-[#18231C] flex items-center gap-1 cursor-pointer"
                              title={row.editableRecord ? 'Editar contacto' : 'Guardar / completar ficha en agenda'}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{row.editableRecord ? 'Editar' : 'Completar'}</span>
                            </button>
                            {row.editableRecord && (
                              <button
                                type="button"
                                onClick={() => handleDelete(row.editableRecord!)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xs cursor-pointer"
                                title="Eliminar contacto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear / Editar Contacto */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-[#FDB813]" />
                <span>{editingRecord ? 'Editar Contacto' : 'Guardar Contacto en Agenda'}</span>
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Categoría *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const cat = e.target.value as ContactCategory;
                      setFormCategory(cat);
                      if (cat === 'cuenta_importante' && !formSubCategory) {
                        setFormSubCategory('ARCA (AFIP)');
                      }
                    }}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white font-bold outline-none"
                  >
                    <option value="cuenta_importante">Cuenta Importante (Estado, ARCA, ATM...)</option>
                    <option value="proveedor">Proveedor</option>
                    <option value="cliente">Cliente / Empresa</option>
                    <option value="colaborador">Colaborador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Subcategoría / Tipo</label>
                  <input
                    type="text"
                    list="contact-subcategories"
                    value={formSubCategory}
                    onChange={(e) => setFormSubCategory(e.target.value)}
                    placeholder="Ej: ARCA, ATM, Proveedor del Estado..."
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  />
                  <datalist id="contact-subcategories">
                    {IMPORTANT_SUBCATEGORIES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Nombre / Titular *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: ARCA Agencia Mendoza / Juan Pérez"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Empresa / Organismo</label>
                  <input
                    type="text"
                    value={formCompanyOrOrg}
                    onChange={(e) => setFormCompanyOrOrg(e.target.value)}
                    placeholder="Razón social o entidad"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="261..."
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="549261..."
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contacto@organismo.gob.ar"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">CUIT / DNI / N° Cuenta</label>
                  <input
                    type="text"
                    value={formCuitOrDni}
                    onChange={(e) => setFormCuitOrDni(e.target.value)}
                    placeholder="30-XXXXXXXX-X"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Local Vinculado</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  >
                    <option value="Todas">Todas las sucursales</option>
                    {configuredBranchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Dirección</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Domicilio o sede"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Notas / Datos Clave (CBU, Alias, Usuario Portal, Horarios)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Referencias útiles, n° de cliente, internos..."
                  className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#DCD4C9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase rounded-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Contacto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
