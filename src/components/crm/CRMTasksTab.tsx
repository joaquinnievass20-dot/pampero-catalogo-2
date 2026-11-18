import React, { useState, useEffect, useMemo } from 'react';
import {
  CRMTask,
  CRMTaskAdvanceLog,
  CRMTaskImportance,
  Seller,
  ThemeConfig,
  UserSession,
} from '../../types';
import {
  DEFAULT_TASK_COLUMNS,
  KanbanColumnConfig,
  deleteCRMTask,
  recordAuditLog,
  saveCRMTask,
  subscribeToCRMTasks,
  subscribeToKanbanColumns,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { formatDateTime } from '../../utils/dateUtils';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  Filter,
  Flag,
  Lock,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';

interface CRMTasksTabProps {
  userSession: UserSession | null;
  sellersList: Seller[];
  assignedBranch: string;
  assignedSellerName: string;
  activeStaffUser: string;
  isManager: boolean;
  crmScope: 'all' | 'branch_only' | 'own_only';
  theme?: ThemeConfig;
}

const IMPORTANCE_META: Record<
  CRMTaskImportance,
  {
    weight: number;
    label: string;
    shortLabel: string;
    badgeClass: string;
    borderLeftColor: string;
    dotColor: string;
  }
> = {
  urgente: {
    weight: 4,
    label: 'Urgente (Máxima · Arriba)',
    shortLabel: 'Urgente',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    borderLeftColor: '#DC2626',
    dotColor: '#DC2626',
  },
  alta: {
    weight: 3,
    label: 'Alta',
    shortLabel: 'Alta',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    borderLeftColor: '#EA580C',
    dotColor: '#EA580C',
  },
  media: {
    weight: 2,
    label: 'Media',
    shortLabel: 'Media',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    borderLeftColor: '#D97706',
    dotColor: '#D97706',
  },
  baja: {
    weight: 1,
    label: 'Baja (Mínima · Abajo)',
    shortLabel: 'Baja',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    borderLeftColor: '#64748B',
    dotColor: '#64748B',
  },
};

function getDeadlineStatus(dueDate?: string, dueTime?: string, isCompleted?: boolean) {
  if (!dueDate) {
    return { kind: 'none' as const, label: 'Sin plazo límite', badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
  }
  const timePart = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '23:59';
  const target = new Date(`${dueDate}T${timePart}:00`);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dueDayStart = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.round((dueDayStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  const formattedDate = `${dueDate.split('-').reverse().join('/')}${dueTime ? ` ${dueTime}` : ''}`;

  if (isCompleted) {
    return {
      kind: 'completed' as const,
      label: `Plazo: ${formattedDate}`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  if (target.getTime() < Date.now() || diffDays < 0) {
    return {
      kind: 'overdue' as const,
      label: diffDays < 0 ? `Vencida (${Math.abs(diffDays)}d) · ${formattedDate}` : `Vencida · ${formattedDate}`,
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
    };
  }
  if (diffDays === 0) {
    return {
      kind: 'today' as const,
      label: `Vence hoy · ${formattedDate}`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }
  if (diffDays <= 2) {
    return {
      kind: 'soon' as const,
      label: `En ${diffDays}d · ${formattedDate}`,
      badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    };
  }
  return {
    kind: 'ok' as const,
    label: formattedDate,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
}

function sortTasksByImportance(list: CRMTask[]): CRMTask[] {
  return [...list].sort((a, b) => {
    const wa = IMPORTANCE_META[a.importance]?.weight ?? 2;
    const wb = IMPORTANCE_META[b.importance]?.weight ?? 2;
    if (wb !== wa) return wb - wa;

    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export const CRMTasksTab: React.FC<CRMTasksTabProps> = ({
  userSession,
  sellersList,
  assignedBranch,
  assignedSellerName,
  activeStaffUser,
  isManager,
  crmScope,
  theme,
}) => {
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_kanban_tasks_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(sanitizeObjectEncoding);
        }
      }
    } catch {}
    return DEFAULT_TASK_COLUMNS.map(sanitizeObjectEncoding);
  });

  const [tasks, setTasks] = useState<CRMTask[]>([]);

  useEffect(() => {
    const unsubCols = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        setColumns(data.tasks.map(sanitizeObjectEncoding));
      }
    });
    const unsubTasks = subscribeToCRMTasks((fetched) => {
      setTasks(fetched.map(sanitizeObjectEncoding));
    });
    return () => {
      unsubCols();
      unsubTasks();
    };
  }, []);

  // Pool de usuarios/responsables del sistema para asignar tareas
  const teamMembers = useMemo(() => {
    const names = new Set<string>();
    sellersList.forEach((s) => {
      if (s.name) names.add(fixUtf8Encoding(s.name));
    });
    try {
      const empRaw = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
      if (Array.isArray(empRaw)) {
        empRaw.forEach((e: any) => {
          const n = e.sellerName || e.name;
          if (n) names.add(fixUtf8Encoding(n));
        });
      }
    } catch {}
    if (activeStaffUser) names.add(fixUtf8Encoding(activeStaffUser));
    if (assignedSellerName) names.add(fixUtf8Encoding(assignedSellerName));
    tasks.forEach((t) => {
      if (t.assignedTo) names.add(fixUtf8Encoding(t.assignedTo));
    });
    return Array.from(names).filter(Boolean);
  }, [sellersList, activeStaffUser, assignedSellerName, tasks]);

  const currentUserLabel = useMemo(() => {
    return (assignedSellerName || activeStaffUser || 'Personal Pampero').trim();
  }, [assignedSellerName, activeStaffUser]);

  // Filtros
  const [assigneeFilter, setAssigneeFilter] = useState('todos');
  const [branchFilter, setBranchFilter] = useState(() => {
    if (userSession?.role !== 'admin' && assignedBranch && assignedBranch !== 'Todas') {
      return assignedBranch.toLowerCase();
    }
    return 'todos';
  });
  const [importanceFilter, setImportanceFilter] = useState<'todas' | CRMTaskImportance>('todas');
  const [onlyOverdueOrUrgent, setOnlyOverdueOrUrgent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drag & Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Modal crear / editar tarea + avances
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CRMTask | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [importance, setImportance] = useState<CRMTaskImportance>('media');
  const [assignedTo, setAssignedTo] = useState(currentUserLabel);
  const [branch, setBranch] = useState(assignedBranch && assignedBranch !== 'Todas' ? assignedBranch : 'Maipú');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [requiredAdvance, setRequiredAdvance] = useState('');
  const [targetProgressPercent, setTargetProgressPercent] = useState(100);
  const [progressPercent, setProgressPercent] = useState(0);
  const [newAdvanceNote, setNewAdvanceNote] = useState('');
  const [advanceLogs, setAdvanceLogs] = useState<CRMTaskAdvanceLog[]>([]);

  const lastColId = columns[columns.length - 1]?.id || 'completada';

  const getEffectiveColumnId = (t: CRMTask): string => {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    return columns[0]?.id || 'pendiente';
  };

  // Visibilidad por rol:
  // - Admin: todas las tareas de todos los locales
  // - Encargado del local (isManager): todas las tareas de su local (para ver avances y estados del equipo)
  // - Usuario / vendedor: tareas asignadas a él o creadas por él (y tareas de su local si crmScope === 'all')
  const roleScopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (userSession?.role === 'admin') return true;

      const taskBranch = (t.branch || '').toLowerCase();
      const myBranch = (assignedBranch || '').toLowerCase();

      if (isManager) {
        if (!myBranch || myBranch === 'todas' || taskBranch === 'todas') return true;
        return taskBranch === myBranch;
      }

      if (crmScope === 'all') return true;

      const myEmail = (userSession?.email || '').toLowerCase();
      const myName = currentUserLabel.toLowerCase();
      const isMine =
        (t.assignedTo || '').toLowerCase().includes(myName) ||
        myName.includes((t.assignedTo || '').toLowerCase()) ||
        (t.createdBy || '').toLowerCase().includes(myName) ||
        (myEmail &&
          ((t.assignedToEmail || '').toLowerCase() === myEmail ||
            (t.createdByEmail || '').toLowerCase() === myEmail));

      if (crmScope === 'own_only') return isMine;

      // branch_only regular user: ve sus tareas y las de su sucursal
      if (!myBranch || myBranch === 'todas' || taskBranch === 'todas') return true;
      return taskBranch === myBranch || isMine;
    });
  }, [tasks, userSession?.role, userSession?.email, isManager, assignedBranch, crmScope, currentUserLabel]);

  // Resumen por usuario para Encargado del Local / Admin
  const managerOverview = useMemo(() => {
    const total = roleScopedTasks.length;
    const completed = roleScopedTasks.filter((t) => getEffectiveColumnId(t) === lastColId).length;
    const avgProgress =
      total > 0
        ? Math.round(roleScopedTasks.reduce((acc, t) => acc + (Number(t.progressPercent) || 0), 0) / total)
        : 0;
    const overdueCount = roleScopedTasks.filter((t) => {
      const isComp = getEffectiveColumnId(t) === lastColId;
      return getDeadlineStatus(t.dueDate, t.dueTime, isComp).kind === 'overdue';
    }).length;
    const urgentCount = roleScopedTasks.filter(
      (t) => t.importance === 'urgente' && getEffectiveColumnId(t) !== lastColId
    ).length;

    const byUserMap = new Map<
      string,
      { name: string; total: number; completed: number; avgProgress: number; overdue: number }
    >();
    roleScopedTasks.forEach((t) => {
      const who = fixUtf8Encoding(t.assignedTo || 'Sin asignar');
      const prev = byUserMap.get(who) || { name: who, total: 0, completed: 0, avgProgress: 0, overdue: 0 };
      const isComp = getEffectiveColumnId(t) === lastColId;
      const isOv = getDeadlineStatus(t.dueDate, t.dueTime, isComp).kind === 'overdue';
      const nextTotal = prev.total + 1;
      const sumPct = prev.avgProgress * prev.total + (Number(t.progressPercent) || 0);
      byUserMap.set(who, {
        name: who,
        total: nextTotal,
        completed: prev.completed + (isComp ? 1 : 0),
        avgProgress: Math.round(sumPct / nextTotal),
        overdue: prev.overdue + (isOv ? 1 : 0),
      });
    });

    return {
      total,
      completed,
      avgProgress,
      overdueCount,
      urgentCount,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [roleScopedTasks, lastColId, columns]);

  // Filtros UI aplicados sobre roleScopedTasks
  const filteredTasks = useMemo(() => {
    return roleScopedTasks.filter((t) => {
      const matchesAssignee =
        assigneeFilter === 'todos' ||
        (t.assignedTo || '').toLowerCase() === assigneeFilter.toLowerCase();
      const matchesBranch =
        branchFilter === 'todos' ||
        (t.branch || '').toLowerCase().includes(branchFilter.toLowerCase());
      const matchesImportance =
        importanceFilter === 'todas' || t.importance === importanceFilter;

      const isComp = getEffectiveColumnId(t) === lastColId;
      const dl = getDeadlineStatus(t.dueDate, t.dueTime, isComp);
      if (onlyOverdueOrUrgent && dl.kind !== 'overdue' && t.importance !== 'urgente') {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.assignedTo || '').toLowerCase().includes(q) ||
        (t.requiredAdvance || '').toLowerCase().includes(q);

      return matchesAssignee && matchesBranch && matchesImportance && matchesQuery;
    });
  }, [
    roleScopedTasks,
    assigneeFilter,
    branchFilter,
    importanceFilter,
    onlyOverdueOrUrgent,
    searchQuery,
    lastColId,
    columns,
  ]);

  const openNewModal = (defaultColId?: string) => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setColumnId(defaultColId || columns[0]?.id || 'pendiente');
    setImportance('media');
    setAssignedTo(currentUserLabel);
    setBranch(assignedBranch && assignedBranch !== 'Todas' ? assignedBranch : 'Maipú');
    setDueDate('');
    setDueTime('');
    setRequiredAdvance('');
    setTargetProgressPercent(100);
    setProgressPercent(0);
    setNewAdvanceNote('');
    setAdvanceLogs([]);
    setShowModal(true);
  };

  const openEditModal = (task: CRMTask) => {
    setEditingTask(task);
    setTitle(fixUtf8Encoding(task.title || ''));
    setDescription(fixUtf8Encoding(task.description || ''));
    setColumnId(getEffectiveColumnId(task));
    setImportance(task.importance || 'media');
    setAssignedTo(fixUtf8Encoding(task.assignedTo || currentUserLabel));
    setBranch(fixUtf8Encoding(task.branch || assignedBranch || 'Maipú'));
    setDueDate(task.dueDate || '');
    setDueTime(task.dueTime || '');
    setRequiredAdvance(fixUtf8Encoding(task.requiredAdvance || ''));
    setTargetProgressPercent(task.targetProgressPercent ?? 100);
    setProgressPercent(Number(task.progressPercent) || 0);
    setNewAdvanceNote('');
    setAdvanceLogs(Array.isArray(task.advanceLogs) ? task.advanceLogs : []);
    setShowModal(true);
  };

  const handleAddAdvanceLogInline = () => {
    const cleanNote = newAdvanceNote.trim();
    if (!cleanNote) return;
    const entry: CRMTaskAdvanceLog = sanitizeObjectEncoding({
      id: `adv-${Date.now()}`,
      author: currentUserLabel,
      authorRole: userSession?.role === 'admin' ? 'admin' : isManager ? 'local' : 'vendedor',
      note: cleanNote,
      progressPercent,
      createdAt: new Date().toISOString(),
    });
    setAdvanceLogs((prev) => [entry, ...prev]);
    setNewAdvanceNote('');
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const chosenCol = columnId || columns[0]?.id || 'pendiente';
    const finalProgress = chosenCol === lastColId && progressPercent === 0 ? 100 : progressPercent;

    // Si dejó texto en "Nuevo avance", agregarlo automáticamente al guardar
    let nextLogs = [...advanceLogs];
    if (newAdvanceNote.trim()) {
      nextLogs = [
        sanitizeObjectEncoding({
          id: `adv-${Date.now()}`,
          author: currentUserLabel,
          authorRole: userSession?.role === 'admin' ? 'admin' : isManager ? 'local' : 'vendedor',
          note: newAdvanceNote.trim(),
          progressPercent: finalProgress,
          createdAt: new Date().toISOString(),
        }),
        ...nextLogs,
      ];
    }

    // Si es una tarea existente y NO es encargado/admin, preservar el tiempo límite y metas fijadas por el encargado
    const effectiveDueDate = !editingTask || isManager ? (dueDate || undefined) : editingTask.dueDate;
    const effectiveDueTime = !editingTask || isManager ? (dueTime || undefined) : editingTask.dueTime;
    const effectiveRequiredAdvance =
      !editingTask || isManager ? (requiredAdvance.trim() || undefined) : editingTask.requiredAdvance;
    const effectiveTargetPct =
      !editingTask || isManager
        ? Math.max(1, Math.min(100, Number(targetProgressPercent) || 100))
        : (editingTask.targetProgressPercent ?? 100);

    const taskPayload: CRMTask = sanitizeObjectEncoding({
      id: editingTask ? editingTask.id : `TSK-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      description: description.trim() || undefined,
      columnId: chosenCol,
      importance,
      assignedTo: assignedTo.trim() || currentUserLabel,
      createdBy: editingTask ? editingTask.createdBy : currentUserLabel,
      createdByEmail: editingTask ? editingTask.createdByEmail : userSession?.email,
      branch: branch || 'Maipú',
      dueDate: effectiveDueDate,
      dueTime: effectiveDueTime,
      requiredAdvance: effectiveRequiredAdvance,
      targetProgressPercent: effectiveTargetPct,
      progressPercent: Math.max(0, Math.min(100, Number(finalProgress) || 0)),
      advanceLogs: nextLogs,
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setTasks((prev) => [taskPayload, ...prev.filter((t) => t.id !== taskPayload.id)]);
    setShowModal(false);

    try {
      await saveCRMTask(taskPayload);
      recordAuditLog({
        module: 'CRM / Tareas',
        action: editingTask ? 'Actualizar Tarea' : 'Crear Tarea',
        details: `Tarea "${taskPayload.title}" (${IMPORTANCE_META[taskPayload.importance].shortLabel}, ${taskPayload.progressPercent}%) en "${chosenCol}"`,
        userEmail: userSession?.email,
        userName: currentUserLabel,
        userRole: userSession?.role || 'employee',
      }).catch(() => {});
    } catch (err) {
      console.error('Error guardando tarea:', err);
    }
  };

  const handleMoveTask = async (task: CRMTask, targetColId: string) => {
    const nextProgress =
      targetColId === lastColId && task.progressPercent < 100 ? 100 : task.progressPercent;
    const updated: CRMTask = sanitizeObjectEncoding({
      ...task,
      columnId: targetColId,
      progressPercent: nextProgress,
      updatedAt: new Date().toISOString(),
    });

    setTasks((prev) => [updated, ...prev.filter((t) => t.id !== updated.id)]);
    try {
      await saveCRMTask(updated);
      recordAuditLog({
        module: 'CRM / Tareas',
        action: 'Mover Tarea',
        details: `Tarea "${updated.title}" movida a "${targetColId}" (${updated.progressPercent}%)`,
        userEmail: userSession?.email,
        userName: currentUserLabel,
        userRole: userSession?.role || 'employee',
      }).catch(() => {});
    } catch (err) {
      console.error('Error moviendo tarea:', err);
    }
  };

  const handleDeleteTask = async (task: CRMTask) => {
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await deleteCRMTask(task.id);
      recordAuditLog({
        module: 'CRM / Tareas',
        action: 'Eliminar Tarea',
        details: `Tarea "${task.title}" eliminada del tablero.`,
        userEmail: userSession?.email,
        userName: currentUserLabel,
        userRole: userSession?.role || 'employee',
      }).catch(() => {});
    } catch (err) {
      console.error('Error eliminando tarea:', err);
    }
  };

  const handleDropOnColumn = async (targetColId: string) => {
    if (!draggedTaskId) return;
    const t = tasks.find((item) => item.id === draggedTaskId);
    if (t && getEffectiveColumnId(t) !== targetColId) {
      await handleMoveTask(t, targetColId);
    }
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const canModifyDeadlineAndGoal = !editingTask || isManager;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner — mismo diseño que Kanban 1 y 2 */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#B9522F]" />
              Tablero Kanban · Tareas del Equipo
            </h3>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900 border border-amber-300">
              {isManager ? 'Vista Encargado / Dirección' : 'Vista Usuario'}
            </span>
          </div>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Registrá tareas por prioridad e importancia (las más importantes se ubican arriba automáticamente), con tiempos límites y registro de avances por usuario.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => openNewModal()}
            className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Tarea</span>
          </button>
        </div>
      </div>

      {/* Panel de Avances y Estados para el Encargado del Local / Admin */}
      {isManager && (
        <div className="bg-white p-3.5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#18231C] text-[#FDB813] rounded-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                  Supervisión del Encargado · Avances y Estados del Local
                </h4>
                <p className="text-[11px] text-[#6F6860]">
                  Podés editar tiempos límites y definir qué se necesita de avance en cualquier tarjeta. Hacé clic en un usuario para filtrar sus tareas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] font-bold text-[#18231C]">
                Total: {managerOverview.total}
              </span>
              <span className="px-2.5 py-1 rounded-xs bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                Completadas: {managerOverview.completed}
              </span>
              <span className="px-2.5 py-1 rounded-xs bg-blue-50 border border-blue-200 font-bold text-blue-900 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Avance Promedio: {managerOverview.avgProgress}%
              </span>
              {managerOverview.urgentCount > 0 && (
                <span className="px-2.5 py-1 rounded-xs bg-red-50 border border-red-200 font-bold text-red-800">
                  Urgentes activas: {managerOverview.urgentCount}
                </span>
              )}
              {managerOverview.overdueCount > 0 && (
                <span className="px-2.5 py-1 rounded-xs bg-red-600 text-white font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Vencidas: {managerOverview.overdueCount}
                </span>
              )}
            </div>
          </div>

          {managerOverview.byUser.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#ECE5DC]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] flex items-center gap-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-[#B9522F]" />
                Por Usuario:
              </span>
              <button
                type="button"
                onClick={() => setAssigneeFilter('todos')}
                className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border shrink-0 cursor-pointer transition-colors ${
                  assigneeFilter === 'todos'
                    ? 'bg-[#18231C] text-white border-[#18231C]'
                    : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                }`}
              >
                Todos ({managerOverview.total})
              </button>
              {managerOverview.byUser.map((u) => {
                const isSelected = assigneeFilter.toLowerCase() === u.name.toLowerCase();
                return (
                  <button
                    key={u.name}
                    type="button"
                    onClick={() => setAssigneeFilter(isSelected ? 'todos' : u.name)}
                    className={`px-2.5 py-1 rounded-xs text-[11px] border shrink-0 cursor-pointer transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#18231C] text-white border-[#18231C]'
                        : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:border-[#B9522F]'
                    }`}
                  >
                    <span className="font-bold">{u.name}</span>
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-[#FDB813]' : 'text-[#6F6860]'}`}>
                      {u.completed}/{u.total} · {u.avgProgress}%
                    </span>
                    {u.overdue > 0 && (
                      <span className="px-1 py-0.2 rounded-xs bg-red-600 text-white text-[9px] font-black">
                        {u.overdue} venc.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters Bar — mismo diseño que Kanban 1 y 2 */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <Filter className="w-4 h-4 text-[#8C827A]" />

        <div className="flex items-center gap-1.5">
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C] cursor-pointer"
          >
            <option value="todos">Responsable: Todos</option>
            {teamMembers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={branchFilter}
            disabled={userSession?.role !== 'admin' && Boolean(assignedBranch) && assignedBranch !== 'Todas'}
            onChange={(e) => setBranchFilter(e.target.value)}
            className={`text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium text-[#18231C] ${
              userSession?.role !== 'admin' && assignedBranch && assignedBranch !== 'Todas'
                ? 'bg-neutral-100 cursor-not-allowed opacity-80'
                : 'bg-white cursor-pointer'
            }`}
          >
            {userSession?.role === 'admin' && <option value="todos">Local: Todos</option>}
            <option value="maipú">Local Maipú</option>
            <option value="ciudad">Local Ciudad</option>
            <option value="luján">Local Luján</option>
            <option value="todas">Todos los locales</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={importanceFilter}
            onChange={(e) => setImportanceFilter(e.target.value as any)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C] cursor-pointer"
          >
            <option value="todas">Importancia: Todas</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">⚪ Baja</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setOnlyOverdueOrUrgent((prev) => !prev)}
          className={`px-2.5 py-1.5 text-xs font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1 ${
            onlyOverdueOrUrgent
              ? 'bg-red-100 border-red-300 text-red-800'
              : 'bg-white border-[#DCD4C9] text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>Urgentes / Vencidas</span>
        </button>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tarea, avance requerido o usuario..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>

        <div className="ml-auto text-[10px] font-bold text-[#8C827A] uppercase">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
        </div>
      </div>

      {/* Kanban Board with Dynamic Columns (ordenado verticalmente por nivel de importancia) */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div
          className="grid gap-4 min-w-[1000px]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` }}
        >
          {columns.map((col, colIdx) => {
            const rawColTasks = filteredTasks.filter((t) => getEffectiveColumnId(t) === col.id);
            const colTasks = sortTasksByImportance(rawColTasks);
            const isDragTarget = dragOverCol === col.id;
            const isFinalColumn = colIdx === columns.length - 1;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDropOnColumn(col.id)}
                className={`bg-[#FAF8F5] rounded-xs border-2 flex flex-col h-full min-h-[520px] transition-all ${
                  isDragTarget ? 'border-[#B9522F] bg-amber-50/50 shadow-md' : 'border-[#DCD4C9]'
                }`}
              >
                {/* Column Header — idéntico a Kanban 1 y 2 */}
                <div
                  className="p-3 border-b border-[#DCD4C9] bg-white rounded-t-xs"
                  style={{ borderTop: `4px solid ${col.color}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                      {fixUtf8Encoding(col.label)}
                    </h4>
                    <span
                      style={{ backgroundColor: `${col.color}22`, color: col.color }}
                      className="w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center border border-current"
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {col.description && (
                    <p className="text-[10px] text-[#6F6860] leading-tight">
                      {fixUtf8Encoding(col.description)}
                    </p>
                  )}
                </div>

                {/* Cards Container */}
                <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[#DCD4C9] rounded-xs flex flex-col items-center justify-center text-center p-3 text-neutral-400">
                      <p className="text-[11px] font-medium">Sin tareas en esta etapa</p>
                      <button
                        type="button"
                        onClick={() => openNewModal(col.id)}
                        className="mt-1 text-[10px] text-[#B9522F] hover:underline font-bold cursor-pointer"
                      >
                        + Agregar acá
                      </button>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const imp = IMPORTANCE_META[task.importance] || IMPORTANCE_META.media;
                      const dl = getDeadlineStatus(task.dueDate, task.dueTime, isFinalColumn);
                      const pct = Math.max(0, Math.min(100, Number(task.progressPercent) || 0));
                      const targetPct = Math.max(1, Math.min(100, Number(task.targetProgressPercent) || 100));
                      const metTarget = pct >= targetPct;
                      const lastAdvance =
                        Array.isArray(task.advanceLogs) && task.advanceLogs.length > 0
                          ? task.advanceLogs[0]
                          : null;
                      const nextCol = colIdx < columns.length - 1 ? columns[colIdx + 1] : null;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onClick={() => openEditModal(task)}
                          style={{
                            backgroundColor: theme?.crmCardBgColor || '#FFFFFF',
                            borderColor:
                              dl.kind === 'overdue'
                                ? '#FCA5A5'
                                : theme?.crmCardBorderColor || '#DCD4C9',
                            borderLeftWidth: '4px',
                            borderLeftColor: imp.borderLeftColor,
                            color: theme?.crmCardTextColor || '#18231C',
                          }}
                          className="rounded-xs p-3 border hover:border-[#18231C] shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing group space-y-2 select-none"
                        >
                          {/* Top Row: Importancia + Sucursal */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs border inline-flex items-center gap-1 ${imp.badgeClass}`}
                            >
                              <Flag className="w-2.5 h-2.5" />
                              <span>{imp.shortLabel}</span>
                            </span>

                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-xs bg-[#ECE5DC] text-[#18231C] shrink-0">
                              {fixUtf8Encoding(task.branch || 'Maipú')}
                            </span>
                          </div>

                          {/* Task Title & Description */}
                          <div>
                            <h5 className="font-bold text-xs text-[#18231C] leading-snug">
                              {fixUtf8Encoding(task.title)}
                            </h5>
                            {task.description && (
                              <p className="text-[11px] text-[#6F6860] mt-0.5 line-clamp-2 leading-snug">
                                {fixUtf8Encoding(task.description)}
                              </p>
                            )}
                          </div>

                          {/* Qué se necesita de avance (Meta del Encargado) */}
                          {task.requiredAdvance && (
                            <div className="text-[10px] bg-amber-50/90 text-amber-950 px-2 py-1.5 rounded-xs border border-amber-200 space-y-0.5">
                              <span className="font-black uppercase tracking-wider flex items-center gap-1 text-[9px] text-amber-800">
                                <Target className="w-3 h-3 text-[#B9522F]" />
                                Avance requerido (Meta {targetPct}%):
                              </span>
                              <p className="leading-snug">{fixUtf8Encoding(task.requiredAdvance)}</p>
                            </div>
                          )}

                          {/* Barra de Progreso / Avance */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-[#6F6860]">Avance actual</span>
                              <span
                                className={`font-black font-mono ${
                                  metTarget || isFinalColumn ? 'text-emerald-700' : 'text-[#18231C]'
                                }`}
                              >
                                {pct}%{task.targetProgressPercent && task.targetProgressPercent < 100 ? ` / ${targetPct}% req.` : ''}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  metTarget || isFinalColumn ? 'bg-emerald-600' : 'bg-[#B9522F]'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Tiempo Límite */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-xs border inline-flex items-center gap-1 ${dl.badgeClass}`}
                            >
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{dl.label}</span>
                            </span>
                          </div>

                          {/* Último avance registrado */}
                          {lastAdvance && (
                            <div className="text-[10px] bg-[#FAF8F5] text-[#4A453F] px-2 py-1 rounded-xs border border-[#ECE5DC] leading-snug">
                              <span className="font-bold text-[#18231C]">
                                {fixUtf8Encoding(lastAdvance.author)}:
                              </span>{' '}
                              {fixUtf8Encoding(lastAdvance.note)}
                            </div>
                          )}

                          {/* Footer: Responsable + Acciones */}
                          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <User className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="text-[10px] font-bold text-[#18231C] truncate">
                                {fixUtf8Encoding(task.assignedTo || 'Sin asignar')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(task);
                                }}
                                className="p-1 hover:bg-neutral-100 rounded-xs text-neutral-600 hover:text-black cursor-pointer"
                                title={isManager ? 'Ver avances / Editar plazo y meta' : 'Registrar avance / Editar'}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>

                              {(isManager ||
                                (task.createdBy || '').toLowerCase() === currentUserLabel.toLowerCase()) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task);
                                  }}
                                  className="p-1 hover:bg-red-50 rounded-xs text-neutral-400 hover:text-red-600 cursor-pointer"
                                  title="Eliminar tarea"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}

                              {nextCol ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveTask(task, nextCol.id);
                                  }}
                                  className="px-2 py-1 bg-[#18231C] hover:bg-[#B9522F] text-white rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                  title={`Avanzar a ${fixUtf8Encoding(nextCol.label)}`}
                                >
                                  <span>{fixUtf8Encoding(nextCol.label.replace(/^\d+\.\s*/, '').split('/')[0].split(' ')[0])}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Lista</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Registrar / Editar Tarea + Control de Tiempos Límites y Avances */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#FDB813]" />
                  <span>{editingTask ? 'Detalle, Avances y Control de Tarea' : 'Registrar Nueva Tarea'}</span>
                </h4>
                {editingTask && (
                  <p className="text-[11px] text-[#DCD4C9]/80 mt-0.5">
                    Creada por <strong>{fixUtf8Encoding(editingTask.createdBy)}</strong> · {formatDateTime(editingTask.createdAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Título & Descripción */}
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[11px] mb-1">
                  Título de la Tarea *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Armar pedido especial de camisas Grafa, Controlar stock Maipú..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F] font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Detalle / Descripción</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instrucciones o contexto adicional de la tarea..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F] resize-none"
                />
              </div>

              {/* Nivel de Importancia (ordena arriba o abajo en la columna) */}
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[11px] mb-1.5 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-[#B9522F]" />
                  <span>Nivel de Importancia (define la posición arriba/abajo en el tablero) *</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['urgente', 'alta', 'media', 'baja'] as CRMTaskImportance[]).map((lvl) => {
                    const meta = IMPORTANCE_META[lvl];
                    const active = importance === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setImportance(lvl)}
                        className={`px-2.5 py-2 rounded-xs border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          active
                            ? 'bg-[#18231C] text-white border-[#18231C] shadow-xs'
                            : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.dotColor }}
                        />
                        <span>{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Etapa, Responsable, Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Etapa / Columna</label>
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold text-[#18231C]"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {fixUtf8Encoding(c.label)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Usuario Responsable</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-semibold"
                  >
                    {!teamMembers.includes(assignedTo) && assignedTo && (
                      <option value={assignedTo}>{assignedTo}</option>
                    )}
                    {teamMembers.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Local / Sucursal</label>
                  <select
                    value={branch}
                    disabled={!isManager && Boolean(assignedBranch) && assignedBranch !== 'Todas'}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none disabled:bg-neutral-100"
                  >
                    <option value="Maipú">Maipú</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Luján">Luján</option>
                    <option value="Todas">Todas</option>
                  </select>
                </div>
              </div>

              {/* Control del Encargado: Tiempo Límite y Qué se necesita de avance */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Tiempo Límite y Avance Requerido</span>
                  </span>
                  {canModifyDeadlineAndGoal ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {isManager ? 'Editable por Encargado / Admin' : 'Plazo inicial al crear'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-neutral-200 text-neutral-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Solo editable por Encargado del Local
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Fecha Límite
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      disabled={!canModifyDeadlineAndGoal}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none disabled:bg-neutral-100 disabled:text-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Hora Límite (opcional)
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      disabled={!canModifyDeadlineAndGoal}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none disabled:bg-neutral-100 disabled:text-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      % Avance Requerido
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={targetProgressPercent}
                      disabled={!canModifyDeadlineAndGoal}
                      onChange={(e) => setTargetProgressPercent(Number(e.target.value) || 100)}
                      className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold disabled:bg-neutral-100 disabled:text-neutral-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Qué se necesita de avance / Entregable esperado
                  </label>
                  <input
                    type="text"
                    value={requiredAdvance}
                    disabled={!canModifyDeadlineAndGoal}
                    onChange={(e) => setRequiredAdvance(e.target.value)}
                    placeholder="Ej: Confirmar stock con depósito, subir foto de muestra y aprobar talle..."
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F] disabled:bg-neutral-100 disabled:text-neutral-600"
                  />
                </div>
              </div>

              {/* Progreso Actual & Registro de Avances */}
              <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Avance Actual de la Tarea</span>
                  </label>
                  <span className="font-mono font-black text-sm text-[#B9522F]">{progressPercent}%</span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value))}
                  className="w-full accent-[#B9522F] cursor-pointer"
                />

                {/* Registrar nuevo avance */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold text-neutral-700">
                    Registrar Nuevo Avance / Novedad
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAdvanceNote}
                      onChange={(e) => setNewAdvanceNote(e.target.value)}
                      placeholder="Escribí qué avanzaste o qué falta..."
                      className="flex-1 px-3 py-1.5 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                    />
                    <button
                      type="button"
                      onClick={handleAddAdvanceLogInline}
                      className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold rounded-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-[#FDB813]" />
                      <span>Agregar Avance</span>
                    </button>
                  </div>
                </div>

                {/* Historial de Avances */}
                {advanceLogs.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#ECE5DC] max-h-36 overflow-y-auto">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                      Historial de Avances ({advanceLogs.length})
                    </span>
                    {advanceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#18231C]">
                              {fixUtf8Encoding(log.author)}
                            </span>
                            {log.authorRole === 'local' && (
                              <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-900 rounded-xs font-bold">
                                Encargado
                              </span>
                            )}
                            {log.authorRole === 'admin' && (
                              <span className="text-[9px] px-1 py-0.2 bg-purple-100 text-purple-900 rounded-xs font-bold">
                                Admin
                              </span>
                            )}
                            <span className="text-[10px] text-[#8C827A] font-mono">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-700">{fixUtf8Encoding(log.note)}</p>
                        </div>
                        <span className="text-[10px] font-black font-mono px-1.5 py-0.5 bg-white border border-[#DCD4C9] rounded-xs text-emerald-700 shrink-0">
                          {log.progressPercent}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#DCD4C9]">
                {editingTask &&
                (isManager ||
                  (editingTask.createdBy || '').toLowerCase() === currentUserLabel.toLowerCase()) ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteTask(editingTask);
                      setShowModal(false);
                    }}
                    className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                  >
                    Eliminar Tarea
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-2 text-neutral-600 hover:text-black font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer shadow-xs"
                  >
                    {editingTask ? 'Guardar Cambios' : 'Registrar Tarea'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
