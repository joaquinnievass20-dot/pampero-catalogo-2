import React, { useState, useEffect } from 'react';
import { EmployeeAccount } from '../../types';
import { 
  saveFirestoreEmployee, 
  subscribeToFirestoreEmployees,
  seedInitialFirestoreEmployeesIfEmpty 
} from '../../services/firebase';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  Check, 
  X, 
  AlertCircle,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2
} from 'lucide-react';

interface AdminPermissionsTabProps {
  triggerSaveNotice?: () => void;
}

export type CRMTabPermissionKey = 'visits' | 'board' | 'suppliers' | 'costs';

export const CRM_TAB_DEFINITIONS: { key: CRMTabPermissionKey; label: string; description: string; badge: string }[] = [
  { 
    key: 'visits', 
    label: '1. Visitas comerciales', 
    description: 'Prospección de clientes y visitas en terreno',
    badge: 'Kanban Visitas'
  },
  { 
    key: 'board', 
    label: '2. Seguimiento empresas', 
    description: 'Cotizaciones, seña 50%, taller y entregas',
    badge: 'Kanban Empresas'
  },
  { 
    key: 'suppliers', 
    label: 'Pedidos proveedor', 
    description: 'Control de reposición y compras mayoristas',
    badge: 'Proveedores'
  },
  { 
    key: 'costs', 
    label: 'Control de costos', 
    description: 'Registro de gastos fijos y variables por sucursal',
    badge: 'Finanzas'
  },
];

const INITIAL_FALLBACK_EMPLOYEES: EmployeeAccount[] = [
  {
    id: 'emp-1',
    name: 'Itatí',
    email: 'itati@pamperomaipu.com.ar',
    role: 'employee',
    branch: 'Maipú',
    sellerName: 'Itatí',
    allowedTabs: ['crm', 'products', 'variants', 'prices', 'quotes'],
    crmTabs: ['visits', 'board', 'suppliers'],
    crmScope: 'branch_only',
    createdAt: '2026-01-10',
    active: true,
  },
  {
    id: 'emp-2',
    name: 'Guada',
    email: 'guada@pampero.com.ar',
    role: 'employee',
    branch: 'Ciudad',
    sellerName: 'Guada',
    allowedTabs: ['crm', 'products', 'variants', 'prices', 'quotes'],
    crmTabs: ['visits', 'board', 'suppliers'],
    crmScope: 'branch_only',
    createdAt: '2026-01-12',
    active: true,
  },
  {
    id: 'emp-3',
    name: 'Carolina',
    email: 'carolina@pampero.com.ar',
    role: 'employee',
    branch: 'Luján',
    sellerName: 'Carolina',
    allowedTabs: ['crm', 'products', 'variants', 'prices', 'quotes'],
    crmTabs: ['visits', 'board', 'suppliers', 'costs'],
    crmScope: 'branch_only',
    createdAt: '2026-01-15',
    active: true,
  },
];

export const AdminPermissionsTab: React.FC<AdminPermissionsTabProps> = ({ triggerSaveNotice }) => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_FALLBACK_EMPLOYEES;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    seedInitialFirestoreEmployeesIfEmpty(INITIAL_FALLBACK_EMPLOYEES).catch(() => {});
    const unsub = subscribeToFirestoreEmployees((remote) => {
      if (Array.isArray(remote) && remote.length > 0) {
        setEmployees(remote);
        localStorage.setItem('pampero_employees', JSON.stringify(remote));
      }
    });
    return () => unsub();
  }, []);

  const handleToggleTab = async (empId: string, tabKey: CRMTabPermissionKey) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const currentTabs = target.crmTabs || ['visits', 'board', 'suppliers'];
    const hasTab = currentTabs.includes(tabKey);
    const updatedTabs: CRMTabPermissionKey[] = hasTab
      ? currentTabs.filter((t) => t !== tabKey)
      : [...currentTabs, tabKey];

    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: updatedTabs,
      allowedTabs: updatedTabs.length > 0
        ? Array.from(new Set([...(target.allowedTabs || []), 'crm']))
        : (target.allowedTabs || []).filter((t) => t !== 'crm'),
    };

    // Optimistic local update
    const nextList = employees.map((e) => (e.id === empId ? updatedEmp : e));
    setEmployees(nextList);
    localStorage.setItem('pampero_employees', JSON.stringify(nextList));

    setSavingId(empId);
    try {
      await saveFirestoreEmployee(updatedEmp);
      if (triggerSaveNotice) triggerSaveNotice();
      setSuccessMsg(`Permisos actualizados para ${updatedEmp.name}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('[PERMISOS] Error guardando en Firestore:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleGrantAll = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const allTabs: CRMTabPermissionKey[] = ['visits', 'board', 'suppliers', 'costs'];
    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: allTabs,
      allowedTabs: Array.from(new Set([...(target.allowedTabs || []), 'crm'])),
    };

    const nextList = employees.map((e) => (e.id === empId ? updatedEmp : e));
    setEmployees(nextList);
    localStorage.setItem('pampero_employees', JSON.stringify(nextList));

    setSavingId(empId);
    try {
      await saveFirestoreEmployee(updatedEmp);
      if (triggerSaveNotice) triggerSaveNotice();
      setSuccessMsg(`Se otorgó acceso total al CRM para ${updatedEmp.name}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('[PERMISOS] Error guardando en Firestore:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleRevokeAll = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: [],
      allowedTabs: (target.allowedTabs || []).filter((t) => t !== 'crm'),
    };

    const nextList = employees.map((e) => (e.id === empId ? updatedEmp : e));
    setEmployees(nextList);
    localStorage.setItem('pampero_employees', JSON.stringify(nextList));

    setSavingId(empId);
    try {
      await saveFirestoreEmployee(updatedEmp);
      if (triggerSaveNotice) triggerSaveNotice();
      setSuccessMsg(`Se revocaron todos los accesos al CRM para ${updatedEmp.name}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('[PERMISOS] Error guardando en Firestore:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#18231C] text-[#FDB813] rounded-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Permisos del CRM · Control de Acceso por Empleado
              </h3>
              <p className="text-xs text-[#6F6860]">
                Tildá qué pestañas de Gestión puede visualizar y operar cada vendedor o encargado de sucursal.
              </p>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Colaborador / Sucursal</th>
                {CRM_TAB_DEFINITIONS.map((tab) => (
                  <th key={tab.key} className="py-3.5 px-4 text-center">
                    <div>{tab.label}</div>
                    <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                      {tab.badge}
                    </span>
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {employees.map((emp) => {
                const assignedTabs = emp.crmTabs || ['visits', 'board', 'suppliers'];
                const isSaving = savingId === emp.id;

                return (
                  <tr key={emp.id} className="hover:bg-neutral-50/60 transition-colors">
                    {/* User Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-[#18231C] text-[#FDB813] font-bold text-xs grid place-items-center uppercase">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-[#18231C] text-xs flex items-center gap-1.5">
                            <span>{emp.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-neutral-100 border border-[#DCD4C9] text-neutral-700 font-semibold">
                              {emp.branch || 'Todas'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6F6860] font-mono">
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Checkboxes for 4 CRM Tabs */}
                    {CRM_TAB_DEFINITIONS.map((tab) => {
                      const isGranted = assignedTabs.includes(tab.key);
                      return (
                        <td key={tab.key} className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleToggleTab(emp.id, tab.key)}
                            className={`p-2 rounded-xs border transition-all cursor-pointer inline-flex items-center justify-center ${
                              isGranted
                                ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs hover:bg-emerald-700'
                                : 'bg-neutral-100 border-[#DCD4C9] text-neutral-400 hover:bg-neutral-200'
                            }`}
                            title={isGranted ? `Habilitado: ${tab.label}` : `Deshabilitado: ${tab.label}`}
                          >
                            {isGranted ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Quick bulk actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleGrantAll(emp.id)}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-400 text-emerald-800 rounded-xs text-[10px] font-bold uppercase transition-colors cursor-pointer"
                          title="Habilitar las 4 pestañas del CRM"
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleRevokeAll(emp.id)}
                          className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded-xs text-[10px] font-bold uppercase transition-colors cursor-pointer"
                          title="Revocar acceso al CRM"
                        >
                          Ninguna
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#DCD4C9] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F6860]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-emerald-600 rounded-xs inline-block" />
              <span>Pestaña Habilitada</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-neutral-200 rounded-xs inline-block" />
              <span>Acceso Restringido</span>
            </span>
          </div>
          <div className="text-[11px] font-bold text-[#18231C]">
            * Los cambios se sincronizan en vivo en Cloud Firestore y aplican al instante al iniciar sesión.
          </div>
        </div>
      </div>
    </div>
  );
};
