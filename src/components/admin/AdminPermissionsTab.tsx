import React, { useState, useEffect, useMemo } from 'react';
import { EmployeeAccount } from '../../types';
import {
  saveFirestoreEmployee,
  subscribeToFirestoreEmployees,
} from '../../services/firebase';
import {
  ADMIN_PANEL_TAB_DEFINITIONS,
  ADMIN_PANEL_TAB_KEYS,
} from '../../utils/permissions';
import {
  ShieldCheck,
  Check,
  X,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Users,
  Clock,
} from 'lucide-react';

interface AdminPermissionsTabProps {
  triggerSaveNotice?: () => void;
}

export type CRMTabPermissionKey = 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers' | 'costs';

export const CRM_TAB_DEFINITIONS: { key: CRMTabPermissionKey; label: string; description: string; badge: string }[] = [
  {
    key: 'visits',
    label: '1. Visitas comerciales',
    description: 'Prospección de clientes y visitas en terreno',
    badge: 'Kanban Visitas',
  },
  {
    key: 'board',
    label: '2. Seguimiento empresas',
    description: 'Cotizaciones, seña 50%, taller y entregas',
    badge: 'Kanban Empresas',
  },
  {
    key: 'tasks',
    label: '3. Tareas',
    description: 'Tareas operativas, importancia, tiempos límites y avances',
    badge: 'Kanban Tareas',
  },
  {
    key: 'calendar',
    label: '4. Calendario',
    description: 'Agenda compartida de vencimientos, tareas y eventos',
    badge: 'Calendario',
  },
  {
    key: 'suppliers',
    label: 'Pedidos proveedor',
    description: 'Control de reposición y compras mayoristas',
    badge: 'Proveedores',
  },
  {
    key: 'costs',
    label: 'Control de costos',
    description: 'Registro de gastos fijos y variables por sucursal',
    badge: 'Finanzas',
  },
];

export const AdminPermissionsTab: React.FC<AdminPermissionsTabProps> = ({ triggerSaveNotice }) => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedPanelEmpId, setExpandedPanelEmpId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToFirestoreEmployees((remote) => {
      if (Array.isArray(remote)) {
        setEmployees(remote);
        try {
          localStorage.setItem('pampero_employees', JSON.stringify(remote));
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  const panelTabsByCategory = useMemo(() => {
    const groups: Array<{ category: string; tabs: typeof ADMIN_PANEL_TAB_DEFINITIONS }> = [];
    ADMIN_PANEL_TAB_DEFINITIONS.forEach((tab) => {
      const existing = groups.find((g) => g.category === tab.category);
      if (existing) existing.tabs.push(tab);
      else groups.push({ category: tab.category, tabs: [tab] });
    });
    return groups;
  }, []);

  const getResolvedTabs = (target: EmployeeAccount): CRMTabPermissionKey[] => {
    if (!target.crmTabs) return ['visits', 'board', 'tasks', 'calendar', 'suppliers'];
    const list = [...target.crmTabs] as CRMTabPermissionKey[];
    if (list.length > 0 && !target.crmTasksConfigured && !list.includes('tasks')) {
      list.push('tasks');
    }
    if (list.length > 0 && !target.crmCalendarConfigured && !list.includes('calendar')) {
      list.push('calendar');
    }
    return list;
  };

  const getResolvedPanelTabs = (target: EmployeeAccount): string[] => {
    if (!target.panelTabsConfigured) return [];
    return (target.allowedTabs || []).filter((t) => ADMIN_PANEL_TAB_KEYS.has(t));
  };

  const getResolvedRRHHAccess = (target: EmployeeAccount): boolean => {
    const tabs = target.allowedTabs || [];
    return Boolean(
      tabs.includes('rrhh') ||
        target.canManageRRHH ||
        (target.panelTabsConfigured && tabs.includes('rrhh_admin'))
    );
  };

  const persistEmployeeUpdate = async (empId: string, updatedEmp: EmployeeAccount, msg: string) => {
    const nextList = employees.map((e) => (e.id === empId ? updatedEmp : e));
    setEmployees(nextList);
    try {
      localStorage.setItem('pampero_employees', JSON.stringify(nextList));
    } catch {}

    setSavingId(empId);
    try {
      await saveFirestoreEmployee(updatedEmp);
      if (triggerSaveNotice) triggerSaveNotice();
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 2600);
    } catch (err) {
      console.error('[PERMISOS] Error guardando en Firestore:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleTab = async (empId: string, tabKey: CRMTabPermissionKey) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const currentTabs = getResolvedTabs(target);
    const hasTab = currentTabs.includes(tabKey);
    const updatedTabs: CRMTabPermissionKey[] = hasTab
      ? currentTabs.filter((t) => t !== tabKey)
      : [...currentTabs, tabKey];

    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: updatedTabs,
      crmTasksConfigured: true,
      crmCalendarConfigured: true,
      allowedTabs:
        updatedTabs.length > 0
          ? Array.from(new Set([...(target.allowedTabs || []), 'crm']))
          : (target.allowedTabs || []).filter((t) => t !== 'crm'),
    };

    await persistEmployeeUpdate(empId, updatedEmp, `Permisos CRM actualizados para ${updatedEmp.name}`);
  };

  const handleToggleTaskControl = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const nextCanControl = !Boolean(
      target.canControlTasks || target.sellerRole === 'local' || target.sellerRole === 'encargado'
    );
    const updatedEmp: EmployeeAccount = {
      ...target,
      canControlTasks: nextCanControl,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      nextCanControl
        ? `${updatedEmp.name} ahora puede controlar tareas y subir fotos de respaldo`
        : `Permiso de controlador removido para ${updatedEmp.name}`
    );
  };

  const handleToggleRRHH = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const currentlyHas = getResolvedRRHHAccess(target);
    const nextHas = !currentlyHas;
    const baseAllowed = target.allowedTabs || [];
    const nextAllowed = nextHas
      ? Array.from(new Set([...baseAllowed, 'rrhh']))
      : baseAllowed.filter((t) => t !== 'rrhh');

    const updatedEmp: EmployeeAccount = {
      ...target,
      rrhhConfigured: true,
      canManageRRHH: nextHas ? target.canManageRRHH : false,
      allowedTabs: nextAllowed,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      nextHas ? `Acceso a RRHH habilitado para ${updatedEmp.name}` : `Acceso a RRHH deshabilitado para ${updatedEmp.name}`
    );
  };

  const handleToggleManageRRHH = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const nextManage = !Boolean(target.canManageRRHH);
    const baseAllowed = target.allowedTabs || [];
    const nextAllowed = nextManage
      ? Array.from(new Set([...baseAllowed, 'rrhh']))
      : baseAllowed;

    const updatedEmp: EmployeeAccount = {
      ...target,
      rrhhConfigured: true,
      canManageRRHH: nextManage,
      allowedTabs: nextAllowed,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      nextManage
        ? `${updatedEmp.name} ahora puede gestionar legajos, horarios y vacaciones de RRHH`
        : `Gestión RRHH removida para ${updatedEmp.name}`
    );
  };

  const handleTogglePanelTab = async (empId: string, panelTabKey: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const currentPanelTabs = getResolvedPanelTabs(target);
    const exists = currentPanelTabs.includes(panelTabKey);
    const nextPanelTabs = exists
      ? currentPanelTabs.filter((k) => k !== panelTabKey)
      : [...currentPanelTabs, panelTabKey];

    const nonPanelTabs = (target.allowedTabs || []).filter((k) => !ADMIN_PANEL_TAB_KEYS.has(k));
    const nextAllowedTabs = Array.from(new Set([...nonPanelTabs, ...nextPanelTabs]));

    const updatedEmp: EmployeeAccount = {
      ...target,
      panelTabsConfigured: true,
      allowedTabs: nextAllowedTabs,
      canManageRRHH: nextPanelTabs.includes('rrhh_admin') ? true : target.canManageRRHH,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      `Ventanas de Panel de Control actualizadas para ${updatedEmp.name}`
    );
  };

  const handleSetAllPanelTabs = async (empId: string, grant: boolean) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const nonPanelTabs = (target.allowedTabs || []).filter((k) => !ADMIN_PANEL_TAB_KEYS.has(k));
    const nextPanelTabs = grant ? ADMIN_PANEL_TAB_DEFINITIONS.map((t) => t.key) : [];
    const nextAllowedTabs = Array.from(new Set([...nonPanelTabs, ...nextPanelTabs]));

    const updatedEmp: EmployeeAccount = {
      ...target,
      panelTabsConfigured: true,
      allowedTabs: nextAllowedTabs,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      grant
        ? `Todas las ventanas del Panel habilitadas para ${updatedEmp.name}`
        : `Acceso al Panel de Control removido para ${updatedEmp.name}`
    );
  };

  const handleChangeEmployeeRole = async (
    empId: string,
    nextSellerRole: 'vendedor' | 'local' | 'encargado'
  ) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const nextScope: 'all' | 'branch_only' = nextSellerRole === 'encargado' ? 'all' : 'branch_only';
    const nextBranch =
      nextSellerRole === 'encargado'
        ? 'Todas'
        : target.branch && target.branch !== 'Todas'
          ? target.branch
          : 'Maipú';
    const nextCanControl =
      nextSellerRole === 'encargado' || nextSellerRole === 'local'
        ? true
        : Boolean(target.canControlTasks);

    const updatedEmp: EmployeeAccount = {
      ...target,
      role: 'employee',
      sellerRole: nextSellerRole,
      crmScope: nextScope,
      branch: nextBranch,
      canControlTasks: nextCanControl,
    };

    await persistEmployeeUpdate(
      empId,
      updatedEmp,
      nextSellerRole === 'encargado'
        ? `${updatedEmp.name} ahora es Encargado General (Rol Empleado · Ve todos los locales)`
        : nextSellerRole === 'local'
          ? `${updatedEmp.name} asignado como Encargado de Local (${nextBranch})`
          : `${updatedEmp.name} asignado como Vendedor (${nextBranch})`
    );
  };

  const handleGrantAll = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const allTabs: CRMTabPermissionKey[] = ['visits', 'board', 'tasks', 'calendar', 'suppliers', 'costs'];
    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: allTabs,
      crmTasksConfigured: true,
      crmCalendarConfigured: true,
      rrhhConfigured: true,
      allowedTabs: Array.from(new Set([...(target.allowedTabs || []), 'crm', 'rrhh'])),
    };

    await persistEmployeeUpdate(empId, updatedEmp, `Se otorgó acceso completo al CRM y RRHH para ${updatedEmp.name}`);
  };

  const handleRevokeAll = async (empId: string) => {
    const target = employees.find((e) => e.id === empId);
    if (!target) return;

    const updatedEmp: EmployeeAccount = {
      ...target,
      crmTabs: [],
      crmTasksConfigured: true,
      crmCalendarConfigured: true,
      panelTabsConfigured: true,
      rrhhConfigured: true,
      canManageRRHH: false,
      canControlTasks: false,
      allowedTabs: [],
    };

    await persistEmployeeUpdate(empId, updatedEmp, `Se revocaron todos los accesos para ${updatedEmp.name}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#18231C] text-[#FDB813] rounded-xs shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Permisos & Roles · CRM, RRHH y Panel de Control
            </h3>
            <p className="text-xs text-[#6F6860]">
              Definí qué módulos ve cada empleado en el Hub (RRHH y Panel de Control solo aparecen si los autorizás acá) y elegí exactamente qué ventanas puede abrir.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Colaborador / Sucursal</th>
                <th className="py-3.5 px-3">Rol / Alcance</th>
                {CRM_TAB_DEFINITIONS.map((tab) => (
                  <th key={tab.key} className="py-3.5 px-2.5 text-center">
                    <div>{tab.label}</div>
                    <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                      {tab.badge}
                    </span>
                  </th>
                ))}
                <th className="py-3.5 px-2.5 text-center">
                  <div className="text-[#B9522F]">Control Tareas</div>
                  <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                    fotos/control
                  </span>
                </th>
                <th className="py-3.5 px-2.5 text-center">
                  <div className="text-[#18231C]">Módulo RRHH</div>
                  <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                    fichaje/legajo
                  </span>
                </th>
                <th className="py-3.5 px-2.5 text-center">
                  <div className="text-[#18231C]">Gestión RRHH</div>
                  <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                    horarios/vac.
                  </span>
                </th>
                <th className="py-3.5 px-3 text-center">
                  <div className="text-[#18231C]">Panel de Control</div>
                  <span className="text-[9px] font-normal text-[#6F6860] lowercase">
                    ventanas permitidas
                  </span>
                </th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {employees.map((emp) => {
                const assignedTabs = getResolvedTabs(emp);
                const resolvedPanelTabs = getResolvedPanelTabs(emp);
                const hasRRHH = getResolvedRRHHAccess(emp);
                const managesRRHH = Boolean(emp.canManageRRHH || resolvedPanelTabs.includes('rrhh_admin'));
                const isPanelExpanded = expandedPanelEmpId === emp.id;

                const resolvedSellerRole: 'vendedor' | 'local' | 'encargado' =
                  emp.sellerRole === 'encargado'
                    ? 'encargado'
                    : emp.sellerRole === 'local'
                      ? 'local'
                      : 'vendedor';
                const isController = Boolean(
                  emp.canControlTasks || resolvedSellerRole === 'local' || resolvedSellerRole === 'encargado'
                );
                const isSaving = savingId === emp.id;

                return (
                  <React.Fragment key={emp.id}>
                    <tr className="hover:bg-neutral-50/60 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-[#18231C] text-[#FDB813] font-bold text-xs grid place-items-center uppercase shrink-0">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#18231C] text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{emp.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-xs border font-semibold ${
                                  resolvedSellerRole === 'encargado'
                                    ? 'bg-purple-50 border-purple-300 text-purple-900'
                                    : 'bg-neutral-100 border-[#DCD4C9] text-neutral-700'
                                }`}
                              >
                                {resolvedSellerRole === 'encargado' ? 'Todos los locales' : emp.branch || 'Todas'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6F6860] font-mono">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Rol / Alcance Selector */}
                      <td className="py-3.5 px-3">
                        <select
                          value={resolvedSellerRole}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleChangeEmployeeRole(
                              emp.id,
                              e.target.value as 'vendedor' | 'local' | 'encargado'
                            )
                          }
                          className={`px-2 py-1.5 rounded-xs border text-[11px] font-bold outline-none cursor-pointer ${
                            resolvedSellerRole === 'encargado'
                              ? 'bg-purple-50 border-purple-300 text-purple-900'
                              : resolvedSellerRole === 'local'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-white border-[#DCD4C9] text-[#18231C]'
                          }`}
                        >
                          <option value="vendedor">Vendedor (Su Local)</option>
                          <option value="local">Encargado de Local</option>
                          <option value="encargado">Encargado (Todos Locales)</option>
                        </select>
                      </td>

                      {/* Checkboxes for CRM Tabs */}
                      {CRM_TAB_DEFINITIONS.map((tab) => {
                        const isGranted = assignedTabs.includes(tab.key);
                        return (
                          <td key={tab.key} className="py-3.5 px-2.5 text-center">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleToggleTab(emp.id, tab.key)}
                              className={`p-2 rounded-xs border transition-colors cursor-pointer inline-flex items-center justify-center ${
                                isGranted
                                  ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                                  : 'bg-neutral-100 border-[#DCD4C9] text-neutral-400 hover:bg-neutral-200'
                              }`}
                              title={isGranted ? `Habilitado: ${tab.label}` : `Deshabilitado: ${tab.label}`}
                            >
                              {isGranted ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                        );
                      })}

                      {/* Task Controller Toggle */}
                      <td className="py-3.5 px-2.5 text-center">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleTaskControl(emp.id)}
                          className={`p-2 rounded-xs border transition-colors cursor-pointer inline-flex items-center justify-center ${
                            isController
                              ? 'bg-[#B9522F] border-[#9E3E1E] text-white hover:bg-[#9E3E1E]'
                              : 'bg-neutral-100 border-[#DCD4C9] text-neutral-400 hover:bg-neutral-200'
                          }`}
                          title={
                            isController
                              ? 'Puede controlar tareas y subir fotos de respaldo'
                              : 'Sin permiso de controlador'
                          }
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </td>

                      {/* RRHH Access Toggle */}
                      <td className="py-3.5 px-2.5 text-center">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleRRHH(emp.id)}
                          className={`p-2 rounded-xs border transition-colors cursor-pointer inline-flex items-center justify-center ${
                            hasRRHH
                              ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                              : 'bg-neutral-100 border-[#DCD4C9] text-neutral-400 hover:bg-neutral-200'
                          }`}
                          title={hasRRHH ? 'Módulo RRHH habilitado (Fichaje y Legajo)' : 'Sin acceso a RRHH'}
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      </td>

                      {/* RRHH Manager Toggle */}
                      <td className="py-3.5 px-2.5 text-center">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleManageRRHH(emp.id)}
                          className={`p-2 rounded-xs border transition-colors cursor-pointer inline-flex items-center justify-center ${
                            managesRRHH
                              ? 'bg-[#18231C] border-[#18231C] text-[#FDB813] hover:bg-black'
                              : 'bg-neutral-100 border-[#DCD4C9] text-neutral-400 hover:bg-neutral-200'
                          }`}
                          title={
                            managesRRHH
                              ? 'Puede gestionar legajos, horarios y vacaciones del equipo'
                              : 'Solo ficha su propia llegada'
                          }
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Panel de Control Dropdown Checklist Trigger */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedPanelEmpId(isPanelExpanded ? null : emp.id)}
                          className={`px-2.5 py-1.5 rounded-xs border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                            resolvedPanelTabs.length > 0
                              ? 'bg-[#18231C] border-[#18231C] text-[#FDB813] hover:bg-black'
                              : 'bg-[#FAF8F5] border-[#DCD4C9] text-[#6F6860] hover:bg-neutral-100'
                          }`}
                          title="Elegir ventanas del Panel de Control"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span className="tabular-nums">
                            {resolvedPanelTabs.length > 0
                              ? `Panel (${resolvedPanelTabs.length})`
                              : 'Sin Panel'}
                          </span>
                          {isPanelExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Quick bulk actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleGrantAll(emp.id)}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-400 text-emerald-800 rounded-xs text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            title="Habilitar todas las pestañas del CRM y RRHH"
                          >
                            CRM+RRHH
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleRevokeAll(emp.id)}
                            className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded-xs text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            title="Revocar todos los accesos"
                          >
                            Ninguna
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Checklist Dropdown for Panel de Control Windows */}
                    {isPanelExpanded && (
                      <tr className="bg-[#FAF8F5]">
                        <td colSpan={13} className="p-4 border-b border-[#DCD4C9]">
                          <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCD4C9]">
                              <div>
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                                  <Sliders className="w-4 h-4 text-[#B9522F]" />
                                  <span>
                                    Ventanas del Panel de Control habilitadas para {emp.name}
                                  </span>
                                </h4>
                                <p className="text-[11px] text-[#6F6860] mt-0.5">
                                  Si no hay ninguna ventana tildada, "Panel de Control" no aparecerá en su menú Hub.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleSetAllPanelTabs(emp.id, true)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                                >
                                  Marcar Todas
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleSetAllPanelTabs(emp.id, false)}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                                >
                                  Desmarcar Todas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPanelEmpId(null)}
                                  className="px-2.5 py-1 bg-[#18231C] text-white rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                                >
                                  Cerrar
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {panelTabsByCategory.map((group) => (
                                <div
                                  key={group.category}
                                  className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2"
                                >
                                  <span className="text-[10px] font-black uppercase tracking-wider text-[#B9522F] block">
                                    {group.category}
                                  </span>
                                  <div className="space-y-1.5">
                                    {group.tabs.map((tab) => {
                                      const checked = resolvedPanelTabs.includes(tab.key);
                                      return (
                                        <label
                                          key={tab.key}
                                          className={`flex items-start gap-2 p-2 rounded-xs border cursor-pointer transition-colors ${
                                            checked
                                              ? 'bg-white border-[#18231C]'
                                              : 'bg-white/60 border-[#DCD4C9] hover:bg-white'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            disabled={isSaving}
                                            checked={checked}
                                            onChange={() => handleTogglePanelTab(emp.id, tab.key)}
                                            className="mt-0.5 accent-[#B9522F] cursor-pointer"
                                          />
                                          <div className="min-w-0">
                                            <span className="text-xs font-bold text-[#18231C] block leading-tight">
                                              {tab.label}
                                            </span>
                                            <span className="text-[10px] text-[#6F6860] block leading-tight mt-0.5">
                                              {tab.description}
                                            </span>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#DCD4C9] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F6860]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-emerald-600 rounded-xs inline-block" />
              <span>Habilitado (CRM / RRHH)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-[#B9522F] rounded-xs inline-block" />
              <span>Controlador de Tareas</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-[#18231C] rounded-xs inline-block" />
              <span>Gestión RRHH / Ventanas Panel</span>
            </span>
          </div>
          <div className="text-[11px] font-bold text-[#18231C]">
            * Los cambios se sincronizan en vivo en Cloud Firestore y aplican al instante.
          </div>
        </div>
      </div>
    </div>
  );
};

