import React, { useState, useEffect } from 'react';
import { EmployeeAccount } from '../../types';
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
  Search
} from 'lucide-react';

interface AdminEmployeesTabProps {
  triggerSaveNotice: () => void;
}

export const AVAILABLE_TABS_FOR_EMPLOYEE = [
  { id: 'products', label: 'Productos (Crear / Editar / Eliminar)' },
  { id: 'variants', label: 'Colores y Talles por Artículo' },
  { id: 'prices', label: 'Precios & Planillas Excel' },
  { id: 'mass_images', label: 'Carga Masiva de Fotos' },
  { id: 'promos', label: 'Promociones & Banners' },
  { id: 'coupons', label: 'Cupones de Descuento' },
  { id: 'quotes', label: 'Cotizaciones Recibidas' },
  { id: 'branches', label: 'Sucursales' },
  { id: 'theme', label: 'Diseño, Colores & Logo' },
  { id: 'analytics', label: 'Métricas & Búsquedas' },
  { id: 'users', label: 'Cuentas Registradas' },
];

export const AdminEmployeesTab: React.FC<AdminEmployeesTabProps> = ({ triggerSaveNotice }) => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'emp-1',
        name: 'Ventas Pampero Maipú',
        email: 'ventas@pamperomaipu.com.ar',
        password: 'ventas_pampero',
        role: 'employee',
        allowedTabs: ['products', 'variants', 'prices', 'mass_images', 'promos', 'quotes'],
        createdAt: '2025-01-10',
        active: true,
      },
    ];
  });

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allowedTabs, setAllowedTabs] = useState<string[]>([
    'products',
    'variants',
    'prices',
    'mass_images',
    'quotes',
  ]);

  const saveToStorage = (list: EmployeeAccount[]) => {
    setEmployees(list);
    try {
      localStorage.setItem('pampero_employees', JSON.stringify(list));
    } catch {}
    triggerSaveNotice();
  };

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
    setAllowedTabs(['products', 'variants', 'prices', 'mass_images', 'quotes']);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (emp: EmployeeAccount) => {
    setIsEditing(emp.id);
    setName(emp.name);
    setEmail(emp.email);
    setPassword(emp.password || '');
    setAllowedTabs(emp.allowedTabs || []);
    setShowCreateModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (isEditing) {
      const updated = employees.map((emp) => {
        if (emp.id === isEditing) {
          return {
            ...emp,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: password.trim() || emp.password,
            allowedTabs,
          };
        }
        return emp;
      });
      saveToStorage(updated);
    } else {
      const newEmp: EmployeeAccount = {
        id: `emp-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || 'pampero123',
        role: 'employee',
        allowedTabs,
        createdAt: new Date().toISOString().split('T')[0],
        active: true,
      };
      saveToStorage([...employees, newEmp]);
    }

    setShowCreateModal(false);
  };

  const handleToggleActive = (id: string) => {
    const updated = employees.map((e) => (e.id === id ? { ...e, active: !e.active } : e));
    saveToStorage(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Seguro que deseás dar de baja la cuenta de este empleado?')) {
      const updated = employees.filter((e) => e.id !== id);
      saveToStorage(updated);
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
            <UserCheck className="w-6 h-6 text-[#B9522F]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Gestión de Empleados & Permisos Granulares
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Creá accesos individuales para el personal con permisos específicos por módulo (ej. solo precios, solo fotos, o solo cotizaciones).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Empleado
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
                    <td className="p-3 font-mono text-[#6F6860]">{emp.email}</td>
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
