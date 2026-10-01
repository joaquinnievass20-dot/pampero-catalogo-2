import React, { useState, useEffect } from 'react';
import { EmployeeAccount } from '../../types';
import {
  subscribeToFirestoreEmployees,
  saveFirestoreEmployee,
  deleteFirestoreEmployee,
  seedInitialFirestoreEmployeesIfEmpty,
} from '../../services/firebase';
import { 
  UserCheck, 
  UserPlus, 
  ShieldAlert, 
  Check, 
  Trash2, 
  Edit3, 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  Sparkles,
  Search,
  Building2
} from 'lucide-react';

interface AdminEmployeesTabProps {
  triggerSaveNotice: () => void;
}

export const AVAILABLE_TABS_FOR_EMPLOYEE = [
  { id: 'crm', label: 'Tablero de Gestión / CRM (Pedidos y Empresas)' },
  { id: 'products', label: 'Productos (Crear / Editar / Eliminar)' },
  { id: 'mass_images', label: 'Carga Masiva y Edición de Fotos' },
  { id: 'prices', label: 'Precios & Planillas Excel' },
  { id: 'variants', label: 'Colores y Talles por Artículo' },
  { id: 'promos', label: 'Promociones & Banners' },
  { id: 'coupons', label: 'Cupones de Descuento' },
  { id: 'quotes', label: 'Cotizaciones Recibidas' },
  { id: 'branches', label: 'Sucursales' },
  { id: 'theme', label: 'Diseño, Colores & Logo' },
  { id: 'analytics', label: 'Métricas & Búsquedas' },
  { id: 'users', label: 'Cuentas Registradas' },
];

export const INITIAL_EMPLOYEES: EmployeeAccount[] = [
  {
    id: 'emp-1',
    name: 'Ventas Pampero Maipú',
    email: 'ventas@pamperomaipu.com.ar',
    password: 'ventas_pampero',
    role: 'employee',
    branch: 'Maipú',
    sellerName: 'Ventas Maipú',
    crmScope: 'branch_only',
    allowedTabs: ['products', 'variants', 'prices', 'mass_images', 'promos', 'quotes', 'crm'],
    createdAt: '2025-01-10',
    active: true,
  },
  {
    id: 'emp-2',
    name: 'Operador Ciudad Mendoza',
    email: 'ventas.ciudad@pampero.com.ar',
    password: 'pampero_ciudad',
    role: 'employee',
    branch: 'Ciudad',
    sellerName: 'Ventas Ciudad',
    crmScope: 'branch_only',
    allowedTabs: ['products', 'variants', 'prices', 'quotes', 'crm'],
    createdAt: '2025-02-15',
    active: true,
  },
  {
    id: 'emp-3',
    name: 'Operador Luján de Cuyo',
    email: 'ventas.lujan@pampero.com.ar',
    password: 'pampero_lujan',
    role: 'employee',
    branch: 'Luján',
    sellerName: 'Ventas Luján',
    crmScope: 'branch_only',
    allowedTabs: ['products', 'variants', 'prices', 'quotes', 'crm'],
    createdAt: '2025-03-01',
    active: true,
  },
];

export const AdminEmployeesTab: React.FC<AdminEmployeesTabProps> = ({ triggerSaveNotice }) => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_EMPLOYEES;
  });

  // Subscribe to Cloud Firestore collection 'empleados'
  useEffect(() => {
    seedInitialFirestoreEmployeesIfEmpty(INITIAL_EMPLOYEES).catch((err) => {
      console.warn('[FIREBASE] Error sembrando operadores iniciales:', err);
    });

    const unsubscribe = subscribeToFirestoreEmployees((remote) => {
      if (Array.isArray(remote) && remote.length > 0) {
        setEmployees(remote);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branch, setBranch] = useState('Maipú');
  const [sellerName, setSellerName] = useState('');
  const [crmScope, setCrmScope] = useState<'all' | 'branch_only' | 'own_only'>('branch_only');
  const [allowedTabs, setAllowedTabs] = useState<string[]>([
    'products',
    'variants',
    'prices',
    'mass_images',
    'quotes',
    'crm'
  ]);

  const handleToggleTab = (tabId: string) => {
    setAllowedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
  };

  const handleSelectAllTabs = () => {
    setAllowedTabs(AVAILABLE_TABS_FOR_EMPLOYEE.map((t) => t.id));
  };

  const handleDeselectAllTabs = () => {
    setAllowedTabs([]);
  };

  const handleOpenCreate = () => {
    setIsEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setBranch('Maipú');
    setSellerName('');
    setCrmScope('branch_only');
    setAllowedTabs(['products', 'variants', 'prices', 'mass_images', 'quotes', 'crm']);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (emp: EmployeeAccount) => {
    setIsEditing(emp.id);
    setName(emp.name);
    setEmail(emp.email);
    setPassword(emp.password || '');
    setBranch(emp.branch || 'Maipú');
    setSellerName(emp.sellerName || '');
    setCrmScope(emp.crmScope || 'branch_only');
    setAllowedTabs(emp.allowedTabs || []);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (isEditing) {
      const existing = employees.find((emp) => emp.id === isEditing);
      const updated: EmployeeAccount = {
        ...existing,
        id: isEditing,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || existing?.password || 'pampero123',
        role: 'employee',
        branch,
        sellerName: sellerName.trim() || name.trim(),
        crmScope,
        allowedTabs,
        createdAt: existing?.createdAt || new Date().toISOString().split('T')[0],
        active: existing ? existing.active : true,
      };
      await saveFirestoreEmployee(updated);
    } else {
      const newEmp: EmployeeAccount = {
        id: `emp-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || 'pampero123',
        role: 'employee',
        branch,
        sellerName: sellerName.trim() || name.trim(),
        crmScope,
        allowedTabs,
        createdAt: new Date().toISOString().split('T')[0],
        active: true,
      };
      await saveFirestoreEmployee(newEmp);
    }

    triggerSaveNotice();
    setShowCreateModal(false);
  };

  const handleToggleActive = async (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      await saveFirestoreEmployee({ ...emp, active: !emp.active });
      triggerSaveNotice();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseás dar de baja la cuenta de este operador?')) {
      await deleteFirestoreEmployee(id);
      triggerSaveNotice();
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
            <Building2 className="w-6 h-6 text-[#FDB813]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Operadores y Locales
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Firestore SDK
              </span>
            </div>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Administración de operadores y empleados, asignación de locales/sucursales y configuración de permisos en tiempo real.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Operador
        </button>
      </div>

      {/* Search & List */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
            />
          </div>
          <span className="text-xs font-bold text-[#6F6860] uppercase">
            {filtered.length} {filtered.length === 1 ? 'Empleado activo' : 'Empleados activos'}
          </span>
        </div>

        {/* Table of employees */}
        <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
              <tr>
                <th className="p-3">Empleado</th>
                <th className="p-3">Email de Acceso</th>
                <th className="p-3">Permisos Habilitados</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#6F6860]">
                    No se encontraron empleados registrados.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#FAF8F5]">
                    <td className="p-3 font-bold text-[#18231C] flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#18231C] text-white flex items-center justify-center font-bold text-xs">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-[#6F6860] font-normal">
                          Alta: {emp.createdAt}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[#6F6860]">
                      <div>{emp.email}</div>
                      <div className="flex items-center gap-1 mt-1 font-sans">
                        <span className="px-1.5 py-0.2 rounded-xs bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                          {emp.branch || 'Maipú'}
                        </span>
                        {emp.crmScope === 'own_only' ? (
                          <span className="px-1.5 py-0.2 rounded-xs bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                            Solo sus pedidos
                          </span>
                        ) : emp.crmScope === 'branch_only' ? (
                          <span className="px-1.5 py-0.2 rounded-xs bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                            Solo su local
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-xs bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold">
                            Todas las empresas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {emp.allowedTabs?.map((t) => {
                          const tabDef = AVAILABLE_TABS_FOR_EMPLOYEE.find((x) => x.id === t);
                          return (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[10px] font-semibold text-[#18231C]"
                            >
                              {tabDef ? tabDef.label.split(' ')[0] : t}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(emp.id)}
                        className={`px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase cursor-pointer ${
                          emp.active
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                        }`}
                      >
                        {emp.active ? 'Activo' : 'Suspendido'}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1 text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                          title="Editar permisos"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(emp.id)}
                          className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                          title="Dar de baja"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal create / edit */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <h4 className="font-display text-base uppercase tracking-wider font-bold">
                {isEditing ? 'Editar Empleado y Permisos' : 'Crear Cuenta de Empleado'}
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Nombre Completo del Empleado *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Pedro Gómez - Ventas Maipú"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Correo Electrónico de Ingreso *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="empleado@pamperomaipu.com.ar"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  {isEditing ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña de Acceso *'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required={!isEditing}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ej. pampero2026 o clave propia"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Sucursal / Local Asignado *
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none cursor-pointer"
                  >
                    <option value="Maipú">Maipú</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Luján">Luján de Cuyo</option>
                    <option value="Todas">Todas (Supervisor / Gerente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Identificador de Vendedor (opcional)
                  </label>
                  <input
                    type="text"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="Ej. Itatí / Guada / Carolina"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Alcance de Privacidad en Gestión / CRM *
                </label>
                <select
                  value={crmScope}
                  onChange={(e) => setCrmScope(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none cursor-pointer font-medium"
                >
                  <option value="branch_only">
                    Solo su Local y sus vendedores (Recomendado para locales)
                  </option>
                  <option value="own_only">
                    Solo sus propios clientes y cotizaciones asignadas (Vendedor individual)
                  </option>
                  <option value="all">
                    Ver todas las empresas y sucursales (Dirección / Supervisor)
                  </option>
                </select>
                <span className="text-[11px] text-[#6F6860] block mt-1">
                  Garantiza que una sucursal no acceda a los pedidos ni clientes privados de las demás sucursales.
                </span>
              </div>

              {/* Granular permissions checklist */}
              <div className="border-t border-[#DCD4C9] pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C]">
                    Permisos de Acceso al Panel
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      className="text-[#B9522F] hover:underline cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllTabs}
                      className="text-[#6F6860] hover:underline cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#6F6860]">
                  Elegí exactamente qué secciones del panel podrá ver y editar este usuario.
                </p>

                <div className="space-y-1.5 pt-1">
                  {AVAILABLE_TABS_FOR_EMPLOYEE.map((tab) => {
                    const isChecked = allowedTabs.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        className={`flex items-center gap-2.5 p-2 rounded-xs border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#FAF8F5] border-[#B9522F]/40'
                            : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTab(tab.id)}
                          className="rounded-xs accent-[#B9522F]"
                        />
                        <span className="text-xs text-[#18231C] font-semibold">{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Guardar Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
