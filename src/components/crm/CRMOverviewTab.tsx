import React, { useMemo, useState } from 'react';
import {
  CRMOrder,
  CRMOrderShortageItem,
  CRMTask,
  LeadVisit,
  SupplierOrder,
} from '../../types';
import { KanbanColumnConfig } from '../../services/firebase';
import { useConfiguredBranches } from '../../utils/useConfiguredBranches';
import { branchMatches } from '../../utils/rrhhBranches';
import { fixUtf8Encoding } from '../../utils/encodingUtils';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  Filter,
  LayoutDashboard,
  PackageX,
  Truck,
  Users,
} from 'lucide-react';

interface CRMOverviewTabProps {
  orders: CRMOrder[];
  visits: LeadVisit[];
  tasks: CRMTask[];
  shortages: CRMOrderShortageItem[];
  supplierOrders: SupplierOrder[];
  visitColumns: KanbanColumnConfig[];
  companyColumns: KanbanColumnConfig[];
  taskColumns: KanbanColumnConfig[];
  crmScope: 'all' | 'branch_only' | 'own_only';
  assignedBranch: string;
  assignedSellerName: string;
  allowedCrmTabs: string[];
  staleQuoteDays?: number;
  onNavigateTab: (tab: 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers') => void;
  onSelectOrder?: (order: CRMOrder) => void;
}

const MONTH_LABELS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parseDateMonthKey(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const slash = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
}

function formatMonthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_LABELS_ES[idx] || m} ${y}`;
}

export const CRMOverviewTab: React.FC<CRMOverviewTabProps> = ({
  orders,
  visits,
  tasks,
  shortages,
  supplierOrders,
  visitColumns,
  companyColumns,
  taskColumns,
  crmScope,
  assignedBranch,
  assignedSellerName,
  allowedCrmTabs,
  staleQuoteDays = 7,
  onNavigateTab,
  onSelectOrder,
}) => {
  const { branchNames: configuredBranchNames, resolveBranch: resolveConfiguredBranch } = useConfiguredBranches();

  const [branchFilter, setBranchFilter] = useState<string>(() => {
    if (crmScope !== 'all' && assignedBranch && assignedBranch.toLowerCase() !== 'todas') {
      return resolveConfiguredBranch(assignedBranch, false);
    }
    return 'todos';
  });

  const [monthFilter, setMonthFilter] = useState<string>('todos');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => {
      const m = parseDateMonthKey(v.date || v.createdAt);
      if (m) set.add(m);
    });
    orders.forEach((o) => {
      const m = parseDateMonthKey(o.date || o.createdAt);
      if (m) set.add(m);
    });
    tasks.forEach((t) => {
      const m = parseDateMonthKey(t.dueDate || t.createdAt);
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [visits, orders, tasks]);

  const matchesDateRange = (raw?: string): boolean => {
    if (monthFilter === 'todos' && !fromDate && !toDate) return true;
    const mk = parseDateMonthKey(raw);
    if (monthFilter !== 'todos' && mk !== monthFilter) return false;
    const isoDay = raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
    if (fromDate && isoDay && isoDay < fromDate) return false;
    if (toDate && isoDay && isoDay > toDate) return false;
    if ((fromDate || toDate) && !isoDay) return false;
    return true;
  };

  const normKey = (v?: string) =>
    String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const resolveVisitCol = (v: LeadVisit): string => {
    const raw = String(v.columnId || v.step || v.kanbanStep || v.status || '').trim();
    const n = normKey(raw);
    const match = visitColumns.find((c) => c.id === raw || normKey(c.id) === n || normKey(c.label) === n);
    if (match) return match.id;
    if (n === 'programada') return visitColumns[0]?.id || 'primer_contacto';
    if (n === 'realizada') return visitColumns[1]?.id || 'reunion';
    if (n === 'presupuesto_enviado') return visitColumns[2]?.id || 'previo_cotizacion';
    if (n === 'cerrada') return visitColumns[visitColumns.length - 1]?.id || 'convertida';
    return visitColumns[0]?.id || 'primer_contacto';
  };

  const resolveOrderCol = (o: CRMOrder): string => {
    const raw = String(o.columnId || o.status || '').trim();
    const n = normKey(raw);
    if (n === 'cancelado') return 'cancelado';
    const match = companyColumns.find((c) => c.id === raw || normKey(c.id) === n || normKey(c.label) === n);
    return match ? match.id : companyColumns[0]?.id || 'cotizacion';
  };

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (crmScope === 'branch_only' && assignedBranch && !branchMatches(v.branch, assignedBranch)) return false;
      if (crmScope === 'own_only' && assignedSellerName && (v.seller || '').toLowerCase() !== assignedSellerName.toLowerCase()) return false;
      if (branchFilter !== 'todos' && !branchMatches(v.branch, branchFilter)) return false;
      if (!matchesDateRange(v.date || v.createdAt)) return false;
      return true;
    });
  }, [visits, crmScope, assignedBranch, assignedSellerName, branchFilter, monthFilter, fromDate, toDate]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (crmScope === 'branch_only' && assignedBranch && !branchMatches(o.branch, assignedBranch)) return false;
      if (crmScope === 'own_only' && assignedSellerName && (o.seller || '').toLowerCase() !== assignedSellerName.toLowerCase()) return false;
      if (branchFilter !== 'todos' && !branchMatches(o.branch, branchFilter)) return false;
      if (!matchesDateRange(o.date || o.createdAt)) return false;
      return true;
    });
  }, [orders, crmScope, assignedBranch, assignedSellerName, branchFilter, monthFilter, fromDate, toDate]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (crmScope === 'branch_only' && assignedBranch) {
        const tb = (t.branch || '').toLowerCase();
        const isTargetBranch = Array.isArray(t.targetBranches) && t.targetBranches.some((b) => branchMatches(b, assignedBranch));
        if (tb !== 'todas' && !branchMatches(t.branch, assignedBranch) && !isTargetBranch) return false;
      }
      if (branchFilter !== 'todos') {
        const tb = (t.branch || '').toLowerCase();
        const isTargetBranch = Array.isArray(t.targetBranches) && t.targetBranches.some((b) => branchMatches(b, branchFilter));
        if (tb !== 'todas' && !branchMatches(t.branch, branchFilter) && !isTargetBranch) return false;
      }
      if (!matchesDateRange(t.dueDate || t.createdAt)) return false;
      return true;
    });
  }, [tasks, crmScope, assignedBranch, branchFilter, monthFilter, fromDate, toDate]);

  const lastTaskColId = taskColumns[taskColumns.length - 1]?.id || 'completada';

  // Stage summaries
  const visitsByStage = useMemo(() => {
    return visitColumns.map((col) => {
      const items = filteredVisits.filter((v) => resolveVisitCol(v) === col.id);
      return { col, count: items.length };
    });
  }, [visitColumns, filteredVisits]);

  const ordersByStage = useMemo(() => {
    return companyColumns.map((col) => {
      const items = filteredOrders.filter((o) => resolveOrderCol(o) === col.id);
      const amount = items.reduce((acc, o) => acc + (Number(o.totalInvoiced) > 0 ? Number(o.totalInvoiced) : Number(o.totalEstimated) || 0), 0);
      return { col, count: items.length, amount };
    });
  }, [companyColumns, filteredOrders]);

  // Collaborator task summary
  const tasksByCollaborator = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; overdue: number; sumPct: number }>();
    const todayStr = new Date().toISOString().split('T')[0];

    filteredTasks.forEach((t) => {
      const people = Array.from(
        new Set([t.assignedTo, ...(Array.isArray(t.assignedToList) ? t.assignedToList : [])].map((x) => fixUtf8Encoding(String(x || '').trim())).filter(Boolean))
      );
      if (people.length === 0) people.push('Sin asignar');
      const isDone = (t.columnId || '') === lastTaskColId || Number(t.progressPercent) >= 100;
      const isOv = !isDone && Boolean(t.dueDate) && String(t.dueDate) < todayStr;
      people.forEach((p) => {
        const cur = map.get(p) || { name: p, total: 0, completed: 0, overdue: 0, sumPct: 0 };
        cur.total += 1;
        if (isDone) cur.completed += 1;
        if (isOv) cur.overdue += 1;
        cur.sumPct += Math.max(0, Math.min(100, Number(t.progressPercent) || 0));
        map.set(p, cur);
      });
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgPct: item.total > 0 ? Math.round(item.sumPct / item.total) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, lastTaskColId]);

  // Branch task summary
  const tasksByBranch = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return configuredBranchNames.map((bName) => {
      let total = 0;
      let completed = 0;
      let overdue = 0;
      let sumPct = 0;

      filteredTasks.forEach((t) => {
        const hasSharedEntry = t.multiBranchMode === 'shared' && t.branchProgress && t.branchProgress[bName];
        const applies =
          branchMatches(t.branch, bName) ||
          (t.branch || '').toLowerCase() === 'todas' ||
          (Array.isArray(t.targetBranches) && t.targetBranches.some((tb) => branchMatches(tb, bName)));
        if (!applies) return;

        total += 1;
        const branchPct = hasSharedEntry ? Number(t.branchProgress![bName].progressPercent) || 0 : Number(t.progressPercent) || 0;
        const isDone = hasSharedEntry
          ? Boolean(t.branchProgress![bName].completed) || branchPct >= 100
          : (t.columnId || '') === lastTaskColId || branchPct >= 100;
        const isOv = !isDone && Boolean(t.dueDate) && String(t.dueDate) < todayStr;

        if (isDone) completed += 1;
        if (isOv) overdue += 1;
        sumPct += Math.max(0, Math.min(100, branchPct));
      });

      const branchOrders = filteredOrders.filter((o) => branchMatches(o.branch, bName));
      const branchVisits = filteredVisits.filter((v) => branchMatches(v.branch, bName));

      return {
        branch: bName,
        tasksTotal: total,
        tasksCompleted: completed,
        tasksOverdue: overdue,
        avgPct: total > 0 ? Math.round(sumPct / total) : 0,
        ordersCount: branchOrders.length,
        visitsCount: branchVisits.length,
      };
    });
  }, [configuredBranchNames, filteredTasks, filteredOrders, filteredVisits, lastTaskColId]);

  // Blockers, delayed orders & shortages
  const blockedOrders = useMemo(
    () => filteredOrders.filter((o) => Boolean(o.blockReason?.trim()) && resolveOrderCol(o) !== 'cancelado'),
    [filteredOrders, companyColumns]
  );

  const delayedOrders = useMemo(() => {
    return filteredOrders
      .filter((o) => {
        const colNorm = normKey(resolveOrderCol(o));
        if (colNorm !== 'cotizacion' && colNorm !== 'sena_50') return false;
        const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
        return daysOld >= staleQuoteDays;
      })
      .map((o) => ({
        order: o,
        daysOld: Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysOld - a.daysOld);
  }, [filteredOrders, staleQuoteDays, companyColumns]);

  const activeShortages = useMemo(() => {
    const fromCollection = shortages.filter((s) => {
      if (s.status === 'recibido') return false;
      if (branchFilter !== 'todos' && s.branch && !branchMatches(s.branch, branchFilter)) return false;
      return true;
    });
    if (fromCollection.length > 0) return fromCollection;

    const derived: CRMOrderShortageItem[] = [];
    filteredOrders.forEach((o) => {
      (o.shortages || []).forEach((s) => {
        if (s.status !== 'recibido') derived.push(s);
      });
    });
    return derived;
  }, [shortages, filteredOrders, branchFilter]);

  const pendingSupplierOrders = useMemo(() => {
    return supplierOrders.filter((so) => {
      if (so.status === 'recibido_completo') return false;
      if (branchFilter !== 'todos' && !branchMatches(so.branchDestination, branchFilter)) return false;
      return true;
    });
  }, [supplierOrders, branchFilter]);

  // Monthly breakdown (visits vs orders vs tasks created) across unfiltered branch scope
  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { month: string; visits: number; orders: number; ordersAmount: number; tasks: number }>();
    const addKey = (m: string) => {
      if (!map.has(m)) map.set(m, { month: m, visits: 0, orders: 0, ordersAmount: 0, tasks: 0 });
      return map.get(m)!;
    };

    visits.forEach((v) => {
      if (branchFilter !== 'todos' && !branchMatches(v.branch, branchFilter)) return;
      const m = parseDateMonthKey(v.date || v.createdAt);
      if (!m) return;
      addKey(m).visits += 1;
    });
    orders.forEach((o) => {
      if (branchFilter !== 'todos' && !branchMatches(o.branch, branchFilter)) return;
      const m = parseDateMonthKey(o.date || o.createdAt);
      if (!m) return;
      const entry = addKey(m);
      entry.orders += 1;
      entry.ordersAmount += Number(o.totalInvoiced) > 0 ? Number(o.totalInvoiced) : Number(o.totalEstimated) || 0;
    });
    tasks.forEach((t) => {
      if (branchFilter !== 'todos') {
        const tb = (t.branch || '').toLowerCase();
        if (tb !== 'todas' && !branchMatches(t.branch, branchFilter)) return;
      }
      const m = parseDateMonthKey(t.dueDate || t.createdAt);
      if (!m) return;
      addKey(m).tasks += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 8);
  }, [visits, orders, tasks, branchFilter]);

  const totalOrdersAmount = useMemo(
    () =>
      filteredOrders.reduce(
        (acc, o) => acc + (Number(o.totalInvoiced) > 0 ? Number(o.totalInvoiced) : Number(o.totalEstimated) || 0),
        0
      ),
    [filteredOrders]
  );

  const avgTasksProgress = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    return Math.round(
      filteredTasks.reduce((acc, t) => acc + (Number(t.progressPercent) || 0), 0) / filteredTasks.length
    );
  }, [filteredTasks]);

  const canJump = (tab: string) => allowedCrmTabs.includes(tab);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header + Quick Navigation + Filters */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg uppercase tracking-wider text-[#18231C]">
              Tablero General de Gestión
            </h2>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Resumen consolidado de visitas comerciales, seguimiento de pedidos, tareas por colaborador y local, bloqueos, demoras y faltantes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canJump('visits') && (
              <button
                type="button"
                onClick={() => onNavigateTab('visits')}
                className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Visitas</span>
                <ArrowRight className="w-3 h-3 text-[#6F6860]" />
              </button>
            )}
            {canJump('board') && (
              <button
                type="button"
                onClick={() => onNavigateTab('board')}
                className="px-3 py-1.5 bg-[#18231C] hover:bg-black border border-[#18231C] rounded-xs text-xs font-bold text-[#FDB813] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Seguimiento</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {canJump('tasks') && (
              <button
                type="button"
                onClick={() => onNavigateTab('tasks')}
                className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Tareas</span>
              </button>
            )}
            {canJump('calendar') && (
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendario</span>
              </button>
            )}
            {canJump('suppliers') && (
              <button
                type="button"
                onClick={() => onNavigateTab('suppliers')}
                className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Proveedores</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="pt-3 border-t border-[#ECE5DC] flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#6F6860] font-bold uppercase text-[10px]">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros:</span>
          </div>

          <select
            value={branchFilter}
            disabled={crmScope !== 'all'}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white font-semibold text-[#18231C] outline-none disabled:bg-neutral-100 cursor-pointer"
          >
            {crmScope === 'all' && <option value="todos">Local: Todos</option>}
            {configuredBranchNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white font-semibold text-[#18231C] outline-none cursor-pointer"
          >
            <option value="todos">Mes: Todos (Histórico)</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthLabel(ym)}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-[#6F6860]">Desde:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-[#6F6860]">Hasta:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
            />
          </div>

          {(monthFilter !== 'todos' || fromDate || toDate || (crmScope === 'all' && branchFilter !== 'todos')) && (
            <button
              type="button"
              onClick={() => {
                if (crmScope === 'all') setBranchFilter('todos');
                setMonthFilter('todos');
                setFromDate('');
                setToDate('');
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-[#B9522F] hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">Visitas Comerciales</span>
          <div className="text-2xl font-mono font-bold text-[#18231C] tabular-nums">{filteredVisits.length}</div>
          <span className="text-[11px] text-[#6F6860] block">En período / filtro</span>
        </div>

        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">Pedidos Empresas</span>
          <div className="text-2xl font-mono font-bold text-[#18231C] tabular-nums">{filteredOrders.length}</div>
          <span className="text-[11px] font-mono font-semibold text-emerald-700 tabular-nums block">
            $ {totalOrdersAmount.toLocaleString('es-AR')}
          </span>
        </div>

        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">Tareas Activas</span>
          <div className="text-2xl font-mono font-bold text-[#18231C] tabular-nums">{filteredTasks.length}</div>
          <span className="text-[11px] text-[#6F6860] tabular-nums block">Avance promedio: {avgTasksProgress}%</span>
        </div>

        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">Bloqueos y Demoras</span>
          <div className="text-2xl font-mono font-bold text-rose-700 tabular-nums">
            {blockedOrders.length + delayedOrders.length}
          </div>
          <span className="text-[11px] text-[#6F6860] tabular-nums block">
            {blockedOrders.length} bloq. · {delayedOrders.length} dem.
          </span>
        </div>

        <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-1 col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">Faltantes Pendientes</span>
          <div className="text-2xl font-mono font-bold text-[#B9522F] tabular-nums">{activeShortages.length}</div>
          <span className="text-[11px] text-[#6F6860] tabular-nums block">
            {pendingSupplierOrders.length} órd. proveedor en curso
          </span>
        </div>
      </div>

      {/* Funnels: Visitas Comerciales & Seguimiento de Pedidos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Visitas Comerciales */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#18231C]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Etapas · Visitas Comerciales ({filteredVisits.length})
              </h3>
            </div>
            {canJump('visits') && (
              <button
                type="button"
                onClick={() => onNavigateTab('visits')}
                className="text-[11px] font-bold text-[#B9522F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Abrir tablero</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {visitsByStage.map(({ col, count }) => {
              const pct = filteredVisits.length > 0 ? Math.round((count / filteredVisits.length) * 100) : 0;
              return (
                <div key={col.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#18231C] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span>{fixUtf8Encoding(col.label)}</span>
                    </span>
                    <span className="font-mono font-bold text-[#18231C] tabular-nums">
                      {count} <span className="text-[10px] text-[#6F6860]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: col.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seguimiento de Pedidos */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-[#18231C]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Etapas · Seguimiento de Pedidos ({filteredOrders.length})
              </h3>
            </div>
            {canJump('board') && (
              <button
                type="button"
                onClick={() => onNavigateTab('board')}
                className="text-[11px] font-bold text-[#B9522F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Abrir tablero</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {ordersByStage.map(({ col, count, amount }) => {
              const pct = filteredOrders.length > 0 ? Math.round((count / filteredOrders.length) * 100) : 0;
              return (
                <div key={col.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-[#18231C] flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="truncate">{fixUtf8Encoding(col.label)}</span>
                    </span>
                    <span className="font-mono font-bold text-[#18231C] tabular-nums shrink-0">
                      {count} · $ {amount.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: col.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tasks per Collaborator & per Store Branch */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Por Colaborador */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#18231C]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Desempeño por Colaborador (Tareas)
              </h3>
            </div>
            {canJump('tasks') && (
              <button
                type="button"
                onClick={() => onNavigateTab('tasks')}
                className="text-[11px] font-bold text-[#B9522F] hover:underline cursor-pointer"
              >
                Ver Tareas →
              </button>
            )}
          </div>

          {tasksByCollaborator.length === 0 ? (
            <p className="text-xs text-[#6F6860] py-4 text-center">Sin tareas registradas en el período seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#DCD4C9] text-[10px] uppercase text-[#6F6860]">
                    <th className="py-2 pr-2 font-bold">Colaborador</th>
                    <th className="py-2 px-2 font-bold text-right">Asignadas</th>
                    <th className="py-2 px-2 font-bold text-right">Completas</th>
                    <th className="py-2 px-2 font-bold text-right">Vencidas</th>
                    <th className="py-2 pl-2 font-bold text-right">Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE5DC]">
                  {tasksByCollaborator.map((c) => (
                    <tr key={c.name} className="hover:bg-[#FAF8F5]">
                      <td className="py-2 pr-2 font-semibold text-[#18231C]">{c.name}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{c.total}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700 font-bold tabular-nums">{c.completed}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        <span className={c.overdue > 0 ? 'text-rose-700 font-bold' : 'text-[#6F6860]'}>{c.overdue}</span>
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-bold tabular-nums">{c.avgPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Por Local */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#18231C]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Resumen Operativo por Local
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#DCD4C9] text-[10px] uppercase text-[#6F6860]">
                  <th className="py-2 pr-2 font-bold">Local</th>
                  <th className="py-2 px-2 font-bold text-right">Visitas</th>
                  <th className="py-2 px-2 font-bold text-right">Pedidos</th>
                  <th className="py-2 px-2 font-bold text-right">Tareas</th>
                  <th className="py-2 pl-2 font-bold text-right">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE5DC]">
                {tasksByBranch.map((b) => (
                  <tr key={b.branch} className="hover:bg-[#FAF8F5]">
                    <td className="py-2 pr-2 font-semibold text-[#18231C]">{b.branch}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{b.visitsCount}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{b.ordersCount}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {b.tasksCompleted}/{b.tasksTotal}
                      {b.tasksOverdue > 0 && <span className="text-rose-700 font-bold ml-1">({b.tasksOverdue} venc.)</span>}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono font-bold tabular-nums">{b.avgPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Blockers, Delays & Shortages + Monthly History */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Mayores Bloqueos & Demoras */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Mayores Bloqueos, Demoras y Faltantes
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Bloqueos & Demoras */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                Pedidos bloqueados o demorados ({blockedOrders.length + delayedOrders.length})
              </span>
              {blockedOrders.length === 0 && delayedOrders.length === 0 ? (
                <div className="p-3 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs text-[#6F6860] text-[11px]">
                  No hay pedidos bloqueados ni demorados en este filtro.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {blockedOrders.map((o) => (
                    <button
                      key={`blk-${o.id}`}
                      type="button"
                      onClick={() => (onSelectOrder ? onSelectOrder(o) : onNavigateTab('board'))}
                      className="w-full text-left p-2.5 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 rounded-xs space-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#18231C] truncate">{fixUtf8Encoding(o.clientName)}</span>
                        <span className="text-[10px] font-bold uppercase text-rose-700 shrink-0">Bloqueado</span>
                      </div>
                      <p className="text-[11px] text-rose-800 line-clamp-1">{fixUtf8Encoding(o.blockReason || '')}</p>
                      <span className="text-[10px] text-[#6F6860] block">
                        {fixUtf8Encoding(o.branch)} · {fixUtf8Encoding(o.seller || 'Sin asignar')}
                      </span>
                    </button>
                  ))}
                  {delayedOrders.map(({ order, daysOld }) => (
                    <button
                      key={`del-${order.id}`}
                      type="button"
                      onClick={() => (onSelectOrder ? onSelectOrder(order) : onNavigateTab('board'))}
                      className="w-full text-left p-2.5 bg-amber-50/60 hover:bg-amber-50 border border-amber-200 rounded-xs space-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#18231C] truncate">{fixUtf8Encoding(order.clientName)}</span>
                        <span className="text-[10px] font-mono font-bold text-amber-800 shrink-0 tabular-nums">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {daysOld}d demora
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6F6860] block">
                        {fixUtf8Encoding(order.branch)} · $ {(order.totalEstimated || 0).toLocaleString('es-AR')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Faltantes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#6F6860]">
                  Productos faltantes pendientes ({activeShortages.length})
                </span>
                {canJump('suppliers') && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('suppliers')}
                    className="text-[10px] font-bold text-[#B9522F] hover:underline cursor-pointer"
                  >
                    Ir a Proveedores →
                  </button>
                )}
              </div>
              {activeShortages.length === 0 ? (
                <div className="p-3 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs text-[#6F6860] text-[11px]">
                  Sin faltantes pendientes de recepción.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {activeShortages.map((s) => (
                    <div key={s.id} className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#18231C] truncate flex items-center gap-1">
                          <PackageX className="w-3 h-3 text-[#B9522F] shrink-0" />
                          <span className="truncate">{fixUtf8Encoding(s.productName)}</span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-[#18231C] shrink-0 tabular-nums">
                          {s.quantity} u.
                        </span>
                      </div>
                      <div className="text-[10px] text-[#6F6860] flex items-center justify-between gap-2">
                        <span className="truncate">
                          {fixUtf8Encoding(s.clientName || 'Sin empresa')} · Talle {s.size || 'U'}
                        </span>
                        <span className={`font-bold uppercase shrink-0 ${s.status === 'pedido' ? 'text-blue-700' : 'text-amber-700'}`}>
                          {s.status === 'pedido' ? 'Pedido a prov.' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Histórico Mensual */}
        <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-[#ECE5DC] pb-2.5">
            <Calendar className="w-4 h-4 text-[#18231C]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              Totales por Mes
            </h3>
          </div>

          {monthlyBreakdown.length === 0 ? (
            <p className="text-xs text-[#6F6860] py-4 text-center">Sin registros fechados todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#DCD4C9] text-[10px] uppercase text-[#6F6860]">
                    <th className="py-2 pr-2 font-bold">Mes</th>
                    <th className="py-2 px-1.5 font-bold text-right">Visitas</th>
                    <th className="py-2 px-1.5 font-bold text-right">Pedidos</th>
                    <th className="py-2 pl-1.5 font-bold text-right">Tareas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE5DC]">
                  {monthlyBreakdown.map((m) => (
                    <tr
                      key={m.month}
                      onClick={() => setMonthFilter(monthFilter === m.month ? 'todos' : m.month)}
                      className={`cursor-pointer transition-colors ${
                        monthFilter === m.month ? 'bg-amber-50' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <td className="py-2 pr-2 font-semibold text-[#18231C]">{formatMonthLabel(m.month)}</td>
                      <td className="py-2 px-1.5 text-right font-mono tabular-nums">{m.visits}</td>
                      <td className="py-2 px-1.5 text-right font-mono tabular-nums">{m.orders}</td>
                      <td className="py-2 pl-1.5 text-right font-mono tabular-nums">{m.tasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
