import React, { useState, useEffect, useMemo } from 'react';
import {
  CRMTask,
  CRMTaskAdvanceLog,
  CRMTaskComment,
  CRMTaskEvidencePhoto,
  CRMTaskImportance,
  CRMTaskScheduleType,
  CRMTaskTag,
  CRMTaskTemplate,
  Seller,
  ThemeConfig,
  UserSession,
} from '../../types';
import {
  DEFAULT_TASK_COLUMNS,
  DEFAULT_TASK_TAGS,
  DEFAULT_TASK_TEMPLATES,
  KanbanColumnConfig,
  deleteCRMTask,
  recordAuditLog,
  saveCRMTask,
  subscribeToCRMTaskConfig,
  subscribeToCRMTasks,
  subscribeToKanbanColumns,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { formatDateTime } from '../../utils/dateUtils';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  Camera,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  Filter,
  Flag,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
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
  canControlTasks?: boolean;
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

const MONTHS_ES = [
  { num: 1, short: 'Ene', full: 'Enero' },
  { num: 2, short: 'Feb', full: 'Febrero' },
  { num: 3, short: 'Mar', full: 'Marzo' },
  { num: 4, short: 'Abr', full: 'Abril' },
  { num: 5, short: 'May', full: 'Mayo' },
  { num: 6, short: 'Jun', full: 'Junio' },
  { num: 7, short: 'Jul', full: 'Julio' },
  { num: 8, short: 'Ago', full: 'Agosto' },
  { num: 9, short: 'Sep', full: 'Septiembre' },
  { num: 10, short: 'Oct', full: 'Octubre' },
  { num: 11, short: 'Nov', full: 'Noviembre' },
  { num: 12, short: 'Dic', full: 'Diciembre' },
];

export function isTaskActiveForDate(task: CRMTask, refDate: Date = new Date()): boolean {
  const sType = task.scheduleType || 'immediate';
  if (sType === 'immediate') return true;
  const todayStr = refDate.toISOString().split('T')[0];
  const currentMonth = refDate.getMonth() + 1;

  if (sType === 'specific_date') {
    if (!task.activationDate) return true;
    return task.activationDate <= todayStr;
  }
  if (sType === 'periodic') {
    if (!task.activationDate) return true;
    return task.activationDate <= todayStr;
  }
  if (sType === 'monthly') {
    const months = Array.isArray(task.activationMonths) ? task.activationMonths : [];
    if (months.length === 0) return true;
    return months.includes(currentMonth);
  }
  return true;
}

function getScheduleSummary(task: CRMTask): string | null {
  const sType = task.scheduleType || 'immediate';
  if (sType === 'immediate') return null;
  if (sType === 'specific_date') {
    return task.activationDate
      ? `Activa el ${task.activationDate.split('-').reverse().join('/')}`
      : 'Fecha programada';
  }
  if (sType === 'periodic') {
    const days = task.recurrenceDays || 7;
    return task.activationDate
      ? `Cada ${days}d (desde ${task.activationDate.split('-').reverse().join('/')})`
      : `Periódica (c/${days}d)`;
  }
  if (sType === 'monthly') {
    const ms = (task.activationMonths || [])
      .map((m) => MONTHS_ES.find((x) => x.num === m)?.short)
      .filter(Boolean)
      .join(', ');
    return ms ? `Meses: ${ms}` : 'Mensual';
  }
  return null;
}

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

async function compressImageToDataUrl(file: File, maxDim = 960, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

export const CRMTasksTab: React.FC<CRMTasksTabProps> = ({
  userSession,
  sellersList,
  assignedBranch,
  assignedSellerName,
  activeStaffUser,
  isManager,
  canControlTasks: canControlProp,
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
  const [taskTags, setTaskTags] = useState<CRMTaskTag[]>(DEFAULT_TASK_TAGS);
  const [taskTemplates, setTaskTemplates] = useState<CRMTaskTemplate[]>(DEFAULT_TASK_TEMPLATES);

  const hasControlPermission = Boolean(
    userSession?.role === 'admin' ||
      isManager ||
      canControlProp ||
      userSession?.canControlTasks
  );

  useEffect(() => {
    const unsubCols = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        setColumns(data.tasks.map(sanitizeObjectEncoding));
      }
    });
    const unsubTasks = subscribeToCRMTasks((fetched) => {
      setTasks(fetched.map(sanitizeObjectEncoding));
    });
    const unsubCfg = subscribeToCRMTaskConfig((cfg) => {
      if (Array.isArray(cfg.tags) && cfg.tags.length > 0) setTaskTags(cfg.tags);
      if (Array.isArray(cfg.templates)) setTaskTemplates(cfg.templates);
    });
    return () => {
      unsubCols();
      unsubTasks();
      unsubCfg();
    };
  }, []);

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
      (t.assignedToList || []).forEach((r) => {
        if (r) names.add(fixUtf8Encoding(r));
      });
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
  const [tagFilter, setTagFilter] = useState<string>('todas');
  const [scheduleViewFilter, setScheduleViewFilter] = useState<'active' | 'scheduled' | 'all'>('active');
  const [onlyOverdueOrUrgent, setOnlyOverdueOrUrgent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Drag & Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Modal crear / editar tarea + ver ficha solo lectura + avances + comentarios + evidencias + programación
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CRMTask | null>(null);
  const [viewingTask, setViewingTask] = useState<CRMTask | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Form states
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [importance, setImportance] = useState<CRMTaskImportance>('media');
  const [assignedToList, setAssignedToList] = useState<string[]>([currentUserLabel]);
  const [customAssigneeInput, setCustomAssigneeInput] = useState('');
  const [branch, setBranch] = useState(assignedBranch && assignedBranch !== 'Todas' ? assignedBranch : 'Maipú');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [requiredAdvance, setRequiredAdvance] = useState('');
  const [targetProgressPercent, setTargetProgressPercent] = useState(100);
  const [progressPercent, setProgressPercent] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Programación / Activación
  const [scheduleType, setScheduleType] = useState<CRMTaskScheduleType>('immediate');
  const [activationDate, setActivationDate] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState(7);
  const [activationMonths, setActivationMonths] = useState<number[]>([]);

  // Avances, Comentarios Inmutables & Fotos de Respaldo
  const [newAdvanceNote, setNewAdvanceNote] = useState('');
  const [advanceLogs, setAdvanceLogs] = useState<CRMTaskAdvanceLog[]>([]);
  const [comments, setComments] = useState<CRMTaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<CRMTaskEvidencePhoto[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const lastColId = columns[columns.length - 1]?.id || 'completada';

  const getEffectiveColumnId = (t: CRMTask): string => {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    return columns[0]?.id || 'pendiente';
  };

  // Visibilidad por rol + soporte multi-responsable
  const roleScopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (userSession?.role === 'admin') return true;

      const taskBranch = (t.branch || '').toLowerCase();
      const myBranch = (assignedBranch || '').toLowerCase();

      if (isManager || hasControlPermission) {
        if (!myBranch || myBranch === 'todas' || taskBranch === 'todas') return true;
        return taskBranch === myBranch;
      }

      if (crmScope === 'all') return true;

      const myEmail = (userSession?.email || '').toLowerCase();
      const myName = currentUserLabel.toLowerCase();
      const taskAssignees = [
        t.assignedTo || '',
        ...(Array.isArray(t.assignedToList) ? t.assignedToList : []),
      ]
        .join(' ')
        .toLowerCase();

      const isMine =
        taskAssignees.includes(myName) ||
        (t.createdBy || '').toLowerCase().includes(myName) ||
        (myEmail &&
          ((t.assignedToEmail || '').toLowerCase() === myEmail ||
            (t.createdByEmail || '').toLowerCase() === myEmail));

      if (crmScope === 'own_only') return isMine;

      if (!myBranch || myBranch === 'todas' || taskBranch === 'todas') return true;
      return taskBranch === myBranch || isMine;
    });
  }, [tasks, userSession?.role, userSession?.email, isManager, hasControlPermission, assignedBranch, crmScope, currentUserLabel]);

  const scheduledFutureCount = useMemo(
    () => roleScopedTasks.filter((t) => !isTaskActiveForDate(t)).length,
    [roleScopedTasks]
  );

  // Resumen por usuario para Encargado del Local / Controlador / Admin
  const managerOverview = useMemo(() => {
    const activeScoped = roleScopedTasks.filter((t) => isTaskActiveForDate(t));
    const total = activeScoped.length;
    const completed = activeScoped.filter((t) => getEffectiveColumnId(t) === lastColId).length;
    const avgProgress =
      total > 0
        ? Math.round(activeScoped.reduce((acc, t) => acc + (Number(t.progressPercent) || 0), 0) / total)
        : 0;
    const overdueCount = activeScoped.filter((t) => {
      const isComp = getEffectiveColumnId(t) === lastColId;
      return getDeadlineStatus(t.dueDate, t.dueTime, isComp).kind === 'overdue';
    }).length;
    const urgentCount = activeScoped.filter(
      (t) => t.importance === 'urgente' && getEffectiveColumnId(t) !== lastColId
    ).length;

    const byUserMap = new Map<
      string,
      { name: string; total: number; completed: number; avgProgress: number; overdue: number }
    >();
    activeScoped.forEach((t) => {
      const whoList =
        Array.isArray(t.assignedToList) && t.assignedToList.length > 0
          ? t.assignedToList
          : [t.assignedTo || 'Sin asignar'];
      whoList.forEach((rawWho) => {
        const who = fixUtf8Encoding(rawWho || 'Sin asignar');
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
      const activeNow = isTaskActiveForDate(t);
      if (scheduleViewFilter === 'active' && !activeNow) return false;
      if (scheduleViewFilter === 'scheduled' && activeNow) return false;

      const assignees = [
        t.assignedTo || '',
        ...(Array.isArray(t.assignedToList) ? t.assignedToList : []),
      ].map((x) => x.toLowerCase());

      const matchesAssignee =
        assigneeFilter === 'todos' || assignees.some((a) => a === assigneeFilter.toLowerCase());
      const matchesBranch =
        branchFilter === 'todos' ||
        (t.branch || '').toLowerCase().includes(branchFilter.toLowerCase());
      const matchesImportance =
        importanceFilter === 'todas' || t.importance === importanceFilter;
      const matchesTag =
        tagFilter === 'todas' ||
        (Array.isArray(t.tags) && t.tags.some((tg) => tg.toLowerCase() === tagFilter.toLowerCase()));

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
        assignees.join(' ').includes(q) ||
        (t.requiredAdvance || '').toLowerCase().includes(q) ||
        (t.tags || []).join(' ').toLowerCase().includes(q);

      return matchesAssignee && matchesBranch && matchesImportance && matchesTag && matchesQuery;
    });
  }, [
    roleScopedTasks,
    scheduleViewFilter,
    assigneeFilter,
    branchFilter,
    importanceFilter,
    tagFilter,
    onlyOverdueOrUrgent,
    searchQuery,
    lastColId,
    columns,
  ]);

  const applyTemplateToForm = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = taskTemplates.find((x) => x.id === tplId);
    if (!tpl) return;
    setTitle(fixUtf8Encoding(tpl.title));
    setDescription(fixUtf8Encoding(tpl.description || ''));
    setImportance(tpl.defaultImportance || 'media');
    setSelectedTags(Array.isArray(tpl.defaultTags) ? tpl.defaultTags : []);
    if (tpl.defaultRequiredAdvance) setRequiredAdvance(fixUtf8Encoding(tpl.defaultRequiredAdvance));
    if (tpl.defaultTargetProgressPercent) setTargetProgressPercent(tpl.defaultTargetProgressPercent);
    if (tpl.defaultBranch && (userSession?.role === 'admin' || !assignedBranch || assignedBranch === 'Todas')) {
      setBranch(tpl.defaultBranch);
    }
  };

  const openNewModal = (defaultColId?: string) => {
    setEditingTask(null);
    setSelectedTemplateId('');
    setTitle('');
    setDescription('');
    setColumnId(defaultColId || columns[0]?.id || 'pendiente');
    setImportance('media');
    setAssignedToList([currentUserLabel]);
    setCustomAssigneeInput('');
    setBranch(assignedBranch && assignedBranch !== 'Todas' ? assignedBranch : 'Maipú');
    setDueDate('');
    setDueTime('');
    setRequiredAdvance('');
    setTargetProgressPercent(100);
    setProgressPercent(0);
    setSelectedTags([]);
    setScheduleType('immediate');
    setActivationDate('');
    setRecurrenceDays(7);
    setActivationMonths([]);
    setNewAdvanceNote('');
    setAdvanceLogs([]);
    setComments([]);
    setNewCommentText('');
    setEvidencePhotos([]);
    setShowModal(true);
  };

  const openEditModal = (task: CRMTask) => {
    setEditingTask(task);
    setSelectedTemplateId(task.templateId || '');
    setTitle(fixUtf8Encoding(task.title || ''));
    setDescription(fixUtf8Encoding(task.description || ''));
    setColumnId(getEffectiveColumnId(task));
    setImportance(task.importance || 'media');
    const initialList = Array.from(
      new Set(
        [
          ...(Array.isArray(task.assignedToList) ? task.assignedToList : []),
          task.assignedTo,
        ]
          .map((x) => fixUtf8Encoding(String(x || '').trim()))
          .filter(Boolean)
      )
    );
    setAssignedToList(initialList.length > 0 ? initialList : [currentUserLabel]);
    setCustomAssigneeInput('');
    setBranch(fixUtf8Encoding(task.branch || assignedBranch || 'Maipú'));
    setDueDate(task.dueDate || '');
    setDueTime(task.dueTime || '');
    setRequiredAdvance(fixUtf8Encoding(task.requiredAdvance || ''));
    setTargetProgressPercent(task.targetProgressPercent ?? 100);
    setProgressPercent(Number(task.progressPercent) || 0);
    setSelectedTags(Array.isArray(task.tags) ? task.tags : []);
    setScheduleType(task.scheduleType || 'immediate');
    setActivationDate(task.activationDate || '');
    setRecurrenceDays(task.recurrenceDays || 7);
    setActivationMonths(Array.isArray(task.activationMonths) ? task.activationMonths : []);
    setNewAdvanceNote('');
    setAdvanceLogs(Array.isArray(task.advanceLogs) ? task.advanceLogs : []);
    setComments(Array.isArray(task.comments) ? task.comments : []);
    setNewCommentText('');
    setEvidencePhotos(Array.isArray(task.evidencePhotos) ? task.evidencePhotos : []);
    setShowModal(true);
  };

  const toggleResponsible = (person: string) => {
    const clean = person.trim();
    if (!clean) return;
    setAssignedToList((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === clean.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev; // mantener al menos 1 responsable
        return prev.filter((p) => p.toLowerCase() !== clean.toLowerCase());
      }
      return [...prev, clean];
    });
  };

  const handleAddCustomResponsible = () => {
    const clean = customAssigneeInput.trim();
    if (!clean) return;
    setAssignedToList((prev) =>
      prev.some((p) => p.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, clean]
    );
    setCustomAssigneeInput('');
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

  // Historial INMUTABLE de comentarios (solo agregar, nunca borrar)
  const handleAddImmutableComment = async () => {
    const cleanText = newCommentText.trim();
    if (!cleanText) return;
    const commentEntry: CRMTaskComment = sanitizeObjectEncoding({
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      author: currentUserLabel,
      authorEmail: userSession?.email,
      authorRole: userSession?.role === 'admin' ? 'admin' : isManager ? 'local' : 'vendedor',
      text: cleanText,
      createdAt: new Date().toISOString(),
    });
    const nextComments = [...comments, commentEntry];
    setComments(nextComments);
    setNewCommentText('');

    // Si estamos editando una tarea existente, persistir el comentario al instante aunque no presione Guardar Cambios
    if (editingTask) {
      const existingGuaranteed = Array.isArray(editingTask.comments) ? editingTask.comments : [];
      const mergedMap = new Map<string, CRMTaskComment>();
      [...existingGuaranteed, ...nextComments].forEach((c) => mergedMap.set(c.id, c));
      const mergedComments = Array.from(mergedMap.values());
      const updatedTask: CRMTask = {
        ...editingTask,
        comments: mergedComments,
        updatedAt: new Date().toISOString(),
      };
      setEditingTask(updatedTask);
      setTasks((prev) => [updatedTask, ...prev.filter((t) => t.id !== updatedTask.id)]);
      await saveCRMTask(updatedTask).catch(() => {});
    }
  };

  // Subir fotos de respaldo (solo usuarios con permiso Controlador / Encargado / Admin)
  const handleUploadEvidencePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !hasControlPermission) return;
    setIsUploadingPhoto(true);
    try {
      const added: CRMTaskEvidencePhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const compressedUrl = await compressImageToDataUrl(f, 960, 0.72);
        added.push({
          id: `ev-${Date.now()}-${i}`,
          url: compressedUrl,
          caption: f.name,
          uploadedBy: currentUserLabel,
          uploadedByEmail: userSession?.email,
          createdAt: new Date().toISOString(),
        });
      }
      setEvidencePhotos((prev) => [...prev, ...added]);
    } catch (err) {
      console.error('Error subiendo foto de respaldo:', err);
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const chosenCol = columnId || columns[0]?.id || 'pendiente';
    const finalProgress = chosenCol === lastColId && progressPercent === 0 ? 100 : progressPercent;

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

    // Preservar siempre los comentarios inmutables previos + nuevo comentario si escribió sin apretar botón
    const baseImmutable = Array.isArray(editingTask?.comments) ? editingTask.comments : [];
    const commentMap = new Map<string, CRMTaskComment>();
    [...baseImmutable, ...comments].forEach((c) => commentMap.set(c.id, c));
    if (newCommentText.trim()) {
      const inlineCmt: CRMTaskComment = sanitizeObjectEncoding({
        id: `cmt-${Date.now()}`,
        author: currentUserLabel,
        authorEmail: userSession?.email,
        authorRole: userSession?.role === 'admin' ? 'admin' : isManager ? 'local' : 'vendedor',
        text: newCommentText.trim(),
        createdAt: new Date().toISOString(),
      });
      commentMap.set(inlineCmt.id, inlineCmt);
    }
    const finalComments = Array.from(commentMap.values());

    const canEditDeadlines = !editingTask || hasControlPermission;
    const effectiveDueDate = canEditDeadlines ? (dueDate || undefined) : editingTask?.dueDate;
    const effectiveDueTime = canEditDeadlines ? (dueTime || undefined) : editingTask?.dueTime;
    const effectiveRequiredAdvance = canEditDeadlines
      ? (requiredAdvance.trim() || undefined)
      : editingTask?.requiredAdvance;
    const effectiveTargetPct = canEditDeadlines
      ? Math.max(1, Math.min(100, Number(targetProgressPercent) || 100))
      : (editingTask?.targetProgressPercent ?? 100);

    const finalAssignees = assignedToList.length > 0 ? assignedToList : [currentUserLabel];

    const draftTask: CRMTask = sanitizeObjectEncoding({
      id: editingTask ? editingTask.id : `TSK-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      description: description.trim() || undefined,
      columnId: chosenCol,
      importance,
      assignedTo: finalAssignees[0],
      assignedToList: finalAssignees,
      createdBy: editingTask ? editingTask.createdBy : currentUserLabel,
      createdByEmail: editingTask ? editingTask.createdByEmail : userSession?.email,
      branch: branch || 'Maipú',
      dueDate: effectiveDueDate,
      dueTime: effectiveDueTime,
      requiredAdvance: effectiveRequiredAdvance,
      targetProgressPercent: effectiveTargetPct,
      progressPercent: Math.max(0, Math.min(100, Number(finalProgress) || 0)),
      tags: selectedTags,
      templateId: selectedTemplateId || undefined,
      advanceLogs: nextLogs,
      comments: finalComments,
      evidencePhotos: hasControlPermission ? evidencePhotos : (editingTask?.evidencePhotos || evidencePhotos),
      scheduleType,
      activationDate: scheduleType === 'specific_date' || scheduleType === 'periodic' ? (activationDate || undefined) : undefined,
      recurrenceDays: scheduleType === 'periodic' ? Math.max(1, Number(recurrenceDays) || 7) : undefined,
      activationMonths: scheduleType === 'monthly' ? activationMonths : [],
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    draftTask.isActivated = isTaskActiveForDate(draftTask);

    setTasks((prev) => [draftTask, ...prev.filter((t) => t.id !== draftTask.id)]);
    setShowModal(false);

    try {
      await saveCRMTask(draftTask);
      recordAuditLog({
        module: 'CRM / Tareas',
        action: editingTask ? 'Actualizar Tarea' : 'Crear Tarea',
        details: `Tarea "${draftTask.title}" (${IMPORTANCE_META[draftTask.importance].shortLabel}, ${draftTask.progressPercent}%) en "${chosenCol}"`,
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

  const canModifyDeadlineAndGoal = !editingTask || hasControlPermission;

  const getTagColor = (tagName: string) => {
    return taskTags.find((x) => x.name.toLowerCase() === tagName.toLowerCase())?.color || '#475569';
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#B9522F]" />
              Tareas del Equipo
            </h3>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900 border border-amber-300">
              {hasControlPermission ? 'Controlador / Encargado' : 'Vista Usuario'}
            </span>
          </div>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Usá tareas preestablecidas o creá nuevas, asigná etiquetas y varios responsables, programá activaciones por fecha o mes, y respaldá con historial permanente y fotos.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => openNewModal()}
            className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Panel de Control y Supervisión */}
      {hasControlPermission && (
        <div className="bg-white p-3.5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#18231C] text-[#FDB813] rounded-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                  Panel de Control de Tareas · Avances y Respaldo Fotográfico
                </h4>
                <p className="text-[11px] text-[#6F6860]">
                  Tenés permiso para ajustar plazos, definir metas de avance y adjuntar fotos de respaldo al verificar tareas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] font-bold text-[#18231C]">
                Activas: {managerOverview.total}
              </span>
              <span className="px-2.5 py-1 rounded-xs bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                Completadas: {managerOverview.completed}
              </span>
              <span className="px-2.5 py-1 rounded-xs bg-blue-50 border border-blue-200 font-bold text-blue-900 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Avance: {managerOverview.avgProgress}%
              </span>
              {scheduledFutureCount > 0 && (
                <button
                  type="button"
                  onClick={() => setScheduleViewFilter(scheduleViewFilter === 'scheduled' ? 'active' : 'scheduled')}
                  className="px-2.5 py-1 rounded-xs bg-indigo-50 border border-indigo-200 font-bold text-indigo-800 flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  Programadas: {scheduledFutureCount}
                </button>
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
                Por Responsable:
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

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <Filter className="w-4 h-4 text-[#8C827A]" />

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

        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C] cursor-pointer"
        >
          <option value="todas">Etiqueta: Todas</option>
          {taskTags.map((tg) => (
            <option key={tg.id} value={tg.name}>
              {tg.name}
            </option>
          ))}
        </select>

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

        <select
          value={importanceFilter}
          onChange={(e) => setImportanceFilter(e.target.value as any)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C] cursor-pointer"
        >
          <option value="todas">Importancia: Todas</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <select
          value={scheduleViewFilter}
          onChange={(e) => setScheduleViewFilter(e.target.value as any)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-bold bg-[#FAF8F5] text-[#18231C] cursor-pointer"
        >
          <option value="active">Activas ahora</option>
          <option value="scheduled">Programadas / Futuras ({scheduledFutureCount})</option>
          <option value="all">Ver Todas</option>
        </select>

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

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tarea, etiqueta o responsable..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>

        <div className="ml-auto text-[10px] font-bold text-[#8C827A] uppercase">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
        </div>
      </div>

      {/* Kanban Board */}
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
                      const assignees = Array.from(
                        new Set(
                          [
                            ...(Array.isArray(task.assignedToList) ? task.assignedToList : []),
                            task.assignedTo,
                          ]
                            .map((x) => fixUtf8Encoding(String(x || '').trim()))
                            .filter(Boolean)
                        )
                      );
                      const scheduleLabel = getScheduleSummary(task);
                      const commentCount = Array.isArray(task.comments) ? task.comments.length : 0;
                      const photoCount = Array.isArray(task.evidencePhotos) ? task.evidencePhotos.length : 0;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onClick={() => setViewingTask(task)}
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
                          {/* Top Row */}
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

                          {/* Etiquetas (Tags) */}
                          {Array.isArray(task.tags) && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tg) => (
                                <span
                                  key={tg}
                                  style={{ backgroundColor: getTagColor(tg) }}
                                  className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-xs"
                                >
                                  {fixUtf8Encoding(tg)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Title & Desc */}
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

                          {/* Programación */}
                          {scheduleLabel && (
                            <div className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                              <Repeat className="w-3 h-3 shrink-0" />
                              <span>{scheduleLabel}</span>
                            </div>
                          )}

                          {/* Meta de avance */}
                          {task.requiredAdvance && (
                            <div className="text-[10px] bg-amber-50/90 text-amber-950 px-2 py-1.5 rounded-xs border border-amber-200 space-y-0.5">
                              <span className="font-black uppercase tracking-wider flex items-center gap-1 text-[9px] text-amber-800">
                                <Target className="w-3 h-3 text-[#B9522F]" />
                                Avance requerido (Meta {targetPct}%):
                              </span>
                              <p className="leading-snug">{fixUtf8Encoding(task.requiredAdvance)}</p>
                            </div>
                          )}

                          {/* Progreso */}
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

                          {/* Plazo + Badges Comentarios / Fotos */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-xs border inline-flex items-center gap-1 ${dl.badgeClass}`}
                            >
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{dl.label}</span>
                            </span>
                            {commentCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                                <MessageSquare className="w-2.5 h-2.5" />
                                {commentCount}
                              </span>
                            )}
                            {photoCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <Camera className="w-2.5 h-2.5" />
                                {photoCount}
                              </span>
                            )}
                          </div>

                          {lastAdvance && (
                            <div className="text-[10px] bg-[#FAF8F5] text-[#4A453F] px-2 py-1 rounded-xs border border-[#ECE5DC] leading-snug">
                              <span className="font-bold text-[#18231C]">
                                {fixUtf8Encoding(lastAdvance.author)}:
                              </span>{' '}
                              {fixUtf8Encoding(lastAdvance.note)}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <Users className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="text-[10px] font-bold text-[#18231C] truncate">
                                {assignees.join(', ') || 'Sin asignar'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingTask(task);
                                }}
                                className="px-1.5 py-1 hover:bg-amber-50 rounded-xs text-[#18231C] border border-transparent hover:border-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                title="Ver ficha completa de la tarea"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ficha</span>
                              </button>

                              {(hasControlPermission ||
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

      {/* Modal: Registrar / Editar Tarea */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#FDB813]" />
                  <span>{editingTask ? 'Detalle, Comentarios, Control y Fotos' : 'Registrar Nueva Tarea'}</span>
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
              {/* Desplegable de Tareas Preestablecidas */}
              {taskTemplates.length > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xs space-y-1.5">
                  <label className="block font-black text-[#18231C] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Tarea Preestablecida (opcional — carga estructura base)</span>
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplateToForm(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xs bg-white font-semibold text-xs text-[#18231C] outline-none"
                  >
                    <option value="">-- Seleccionar tarea preestablecida o crear desde cero --</option>
                    {taskTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {fixUtf8Encoding(tpl.title)} ({IMPORTANCE_META[tpl.defaultImportance]?.shortLabel || 'Media'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {/* Etiquetas (Tags) */}
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[11px] mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#B9522F]" />
                  <span>Etiquetas (para clasificar y filtrar en el tablero)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tg) => {
                    const active = selectedTags.some((x) => x.toLowerCase() === tg.name.toLowerCase());
                    return (
                      <button
                        key={tg.id}
                        type="button"
                        onClick={() =>
                          setSelectedTags((prev) =>
                            active
                              ? prev.filter((x) => x.toLowerCase() !== tg.name.toLowerCase())
                              : [...prev, tg.name]
                          )
                        }
                        style={active ? { backgroundColor: tg.color, borderColor: tg.color } : undefined}
                        className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border cursor-pointer transition-all ${
                          active ? 'text-white shadow-xs' : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:border-[#18231C]'
                        }`}
                      >
                        {fixUtf8Encoding(tg.name)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Importancia */}
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[11px] mb-1.5 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-[#B9522F]" />
                  <span>Nivel de Importancia *</span>
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

              {/* Etapa & Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block font-bold text-neutral-700 mb-1">Local / Sucursal</label>
                  <select
                    value={branch}
                    disabled={!hasControlPermission && Boolean(assignedBranch) && assignedBranch !== 'Todas'}
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

              {/* Múltiples Responsables (cualquier responsable puede sumar otros responsables) */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Responsables Asignados ({assignedToList.length})</span>
                  </label>
                  <span className="text-[10px] text-[#6F6860]">
                    Los responsables pueden sumar más integrantes a esta tarea
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.map((person) => {
                    const active = assignedToList.some((x) => x.toLowerCase() === person.toLowerCase());
                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => toggleResponsible(person)}
                        className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#18231C] text-white border-[#18231C]'
                            : 'bg-white text-[#18231C] border-[#DCD4C9] hover:border-[#B9522F]'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {person}
                      </button>
                    );
                  })}
                  {assignedToList
                    .filter((p) => !teamMembers.some((m) => m.toLowerCase() === p.toLowerCase()))
                    .map((customPerson) => (
                      <button
                        key={customPerson}
                        type="button"
                        onClick={() => toggleResponsible(customPerson)}
                        className="px-2.5 py-1 rounded-xs text-[11px] font-bold bg-[#18231C] text-white border border-[#18231C] cursor-pointer"
                      >
                        ✓ {customPerson}
                      </button>
                    ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customAssigneeInput}
                    onChange={(e) => setCustomAssigneeInput(e.target.value)}
                    placeholder="Agregar otro responsable por nombre..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomResponsible}
                    className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white text-[11px] font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#FDB813]" />
                    <span>Sumar Responsable</span>
                  </button>
                </div>
              </div>

              {/* Programación por Fecha, Período o Mes */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Programación y Activación</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'immediate', label: 'Activar Ahora' },
                    { id: 'specific_date', label: 'Fecha Específica' },
                    { id: 'periodic', label: 'Período (c/ X días)' },
                    { id: 'monthly', label: 'Mes(es) del Año' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScheduleType(opt.id as CRMTaskScheduleType)}
                      className={`px-2 py-1.5 rounded-xs text-[11px] font-bold border cursor-pointer ${
                        scheduleType === opt.id
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white text-indigo-950 border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {scheduleType === 'specific_date' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">Fecha de Activación</label>
                      <input
                        type="date"
                        value={activationDate}
                        onChange={(e) => setActivationDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xs outline-none"
                      />
                    </div>
                  </div>
                )}

                {scheduleType === 'periodic' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">A partir del día</label>
                      <input
                        type="date"
                        value={activationDate}
                        onChange={(e) => setActivationDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">Repetir cada (días)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={recurrenceDays}
                        onChange={(e) => setRecurrenceDays(Number(e.target.value) || 7)}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xs outline-none font-bold"
                      />
                    </div>
                  </div>
                )}

                {scheduleType === 'monthly' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-bold text-indigo-950">
                      Meses en que se activa automáticamente:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {MONTHS_ES.map((m) => {
                        const active = activationMonths.includes(m.num);
                        return (
                          <button
                            key={m.num}
                            type="button"
                            onClick={() =>
                              setActivationMonths((prev) =>
                                active ? prev.filter((x) => x !== m.num) : [...prev, m.num].sort((a, b) => a - b)
                              )
                            }
                            className={`px-2 py-1 rounded-xs text-[11px] font-bold border cursor-pointer ${
                              active
                                ? 'bg-indigo-700 text-white border-indigo-700'
                                : 'bg-white text-indigo-950 border-indigo-200'
                            }`}
                          >
                            {m.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Control del Encargado / Controlador: Tiempo Límite y Meta */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Tiempo Límite y Avance Requerido</span>
                  </span>
                  {canModifyDeadlineAndGoal ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {hasControlPermission ? 'Editable por Controlador / Encargado' : 'Plazo inicial'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-neutral-200 text-neutral-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Solo editable por Controlador / Encargado
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">Fecha Límite / Vencimiento</label>
                    <input
                      type="date"
                      value={dueDate}
                      disabled={!canModifyDeadlineAndGoal}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none disabled:bg-neutral-100 disabled:text-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">Hora Límite</label>
                    <input
                      type="time"
                      value={dueTime}
                      disabled={!canModifyDeadlineAndGoal}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white outline-none disabled:bg-neutral-100 disabled:text-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">% Avance Requerido</label>
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
                    placeholder="Ej: Confirmar stock con depósito, adjuntar foto de muestra..."
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

                {advanceLogs.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#ECE5DC] max-h-32 overflow-y-auto">
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
                            <span className="font-bold text-[#18231C]">{fixUtf8Encoding(log.author)}</span>
                            <span className="text-[10px] text-[#8C827A] font-mono">{formatDateTime(log.createdAt)}</span>
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

              {/* Historial INMUTABLE de Comentarios (nunca se pueden borrar) */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Historial Permanente de Comentarios ({comments.length})</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-neutral-200 text-neutral-700 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Registro inmutable (no se borra)
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Dejar un comentario u observación permanente..."
                    className="flex-1 px-3 py-1.5 bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                  <button
                    type="button"
                    onClick={handleAddImmutableComment}
                    className="px-3 py-1.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold rounded-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Comentar</span>
                  </button>
                </div>

                {comments.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                    {comments.map((cmt) => (
                      <div key={cmt.id} className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#18231C] text-[11px]">{fixUtf8Encoding(cmt.author)}</span>
                          <span className="text-[10px] text-[#8C827A] font-mono">{formatDateTime(cmt.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-neutral-800 whitespace-pre-wrap">{fixUtf8Encoding(cmt.text)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Respaldo Fotográfico del Controlador */}
              <div className="p-3.5 bg-white border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Fotos de Respaldo / Control ({evidencePhotos.length})</span>
                  </span>

                  {hasControlPermission ? (
                    <label className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white text-[11px] font-bold rounded-xs cursor-pointer inline-flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#FDB813]" />
                      <span>{isUploadingPhoto ? 'Procesando...' : 'Subir Foto de Respaldo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingPhoto}
                        onChange={handleUploadEvidencePhotos}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <span className="text-[10px] text-[#6F6860] flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Solo usuarios con permiso Controlador pueden subir fotos
                    </span>
                  )}
                </div>

                {evidencePhotos.length === 0 ? (
                  <p className="text-[11px] text-[#6F6860] italic">
                    Aún no se cargaron fotos de respaldo para esta tarea.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {evidencePhotos.map((ph) => (
                      <div
                        key={ph.id}
                        className="border border-[#DCD4C9] rounded-xs overflow-hidden bg-[#FAF8F5] flex flex-col"
                      >
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(ph.url)}
                          className="h-24 w-full overflow-hidden bg-neutral-100 cursor-pointer relative group"
                        >
                          <img src={ph.url} alt={ph.caption || 'Respaldo'} className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                            <ImageIcon className="w-4 h-4 mr-1" /> Ampliar
                          </span>
                        </button>
                        <div className="p-1.5 text-[10px] text-[#6F6860] truncate">
                          <span className="font-bold text-[#18231C] block truncate">{ph.uploadedBy}</span>
                          <span>{formatDateTime(ph.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#DCD4C9]">
                {editingTask &&
                (hasControlPermission ||
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

      {/* Modal Ver Ficha Completa (Solo Lectura con botón Editar Ficha adentro) */}
      {viewingTask && (() => {
        const imp = IMPORTANCE_META[viewingTask.importance] || IMPORTANCE_META.media;
        const effectiveColId = getEffectiveColumnId(viewingTask);
        const colInfo = columns.find((c) => c.id === effectiveColId);
        const isFinal = columns.length > 0 && effectiveColId === columns[columns.length - 1].id;
        const dl = getDeadlineStatus(viewingTask.dueDate, viewingTask.dueTime, isFinal);
        const pct = Math.max(0, Math.min(100, Number(viewingTask.progressPercent) || 0));
        const targetPct = Math.max(1, Math.min(100, Number(viewingTask.targetProgressPercent) || 100));
        const assignees = Array.from(
          new Set(
            [
              ...(Array.isArray(viewingTask.assignedToList) ? viewingTask.assignedToList : []),
              viewingTask.assignedTo,
            ]
              .map((x) => fixUtf8Encoding(String(x || '').trim()))
              .filter(Boolean)
          )
        );
        const scheduleLabel = getScheduleSummary(viewingTask);
        const taskComments = Array.isArray(viewingTask.comments) ? viewingTask.comments : [];
        const taskAdvances = Array.isArray(viewingTask.advanceLogs) ? viewingTask.advanceLogs : [];
        const taskPhotos = Array.isArray(viewingTask.evidencePhotos) ? viewingTask.evidencePhotos : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-xs border ${imp.badgeClass}`}>
                      {imp.shortLabel}
                    </span>
                    {colInfo && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs bg-white/15 text-[#FDB813]">
                        {fixUtf8Encoding(colInfo.label)}
                      </span>
                    )}
                    <span className="text-[10px] uppercase font-bold text-[#DCD4C9]">
                      {fixUtf8Encoding(viewingTask.branch || 'Maipú')}
                    </span>
                  </div>
                  <h4 className="font-bold text-base tracking-wide mt-1">
                    {fixUtf8Encoding(viewingTask.title)}
                  </h4>
                  <p className="text-[11px] text-[#DCD4C9]/80 mt-0.5">
                    Creada por <strong>{fixUtf8Encoding(viewingTask.createdBy)}</strong> · {formatDateTime(viewingTask.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTask(null)}
                  className="text-white/70 hover:text-white cursor-pointer p-1 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs overflow-y-auto">
                {/* Etiquetas */}
                {Array.isArray(viewingTask.tags) && viewingTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingTask.tags.map((tg) => (
                      <span
                        key={tg}
                        style={{ backgroundColor: getTagColor(tg) }}
                        className="text-[10px] font-bold text-white px-2 py-0.5 rounded-xs"
                      >
                        {fixUtf8Encoding(tg)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Descripción */}
                {viewingTask.description && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] block mb-1">
                      Detalle / Descripción
                    </span>
                    <p className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[#18231C] whitespace-pre-wrap">
                      {fixUtf8Encoding(viewingTask.description)}
                    </p>
                  </div>
                )}

                {/* Meta & Plazo & Programación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF8F5] p-3 rounded-xs border border-[#DCD4C9]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Responsables</span>
                    <span className="font-bold text-[#18231C]">
                      {assignees.join(', ') || 'Sin asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Fecha / Hora Límite</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-xs border mt-0.5 ${dl.badgeClass}`}>
                      <Calendar className="w-3 h-3" />
                      {dl.label}
                    </span>
                  </div>
                  {scheduleLabel && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Programación</span>
                      <span className="text-[11px] font-bold text-indigo-800 inline-flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {scheduleLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progreso & Avance requerido */}
                <div className="p-3 bg-white border border-[#DCD4C9] rounded-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#18231C]">
                      Avance Actual
                    </span>
                    <span className="font-mono font-black text-xs text-[#18231C]">
                      {pct}% / {targetPct}% requerido
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${pct >= targetPct || isFinal ? 'bg-emerald-600' : 'bg-[#B9522F]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {viewingTask.requiredAdvance && (
                    <p className="text-[11px] text-amber-950 bg-amber-50 border border-amber-200 p-2 rounded-xs">
                      <strong>Avance requerido:</strong> {fixUtf8Encoding(viewingTask.requiredAdvance)}
                    </p>
                  )}
                </div>

                {/* Avances registrados */}
                {taskAdvances.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] block">
                      Historial de Avances ({taskAdvances.length})
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {taskAdvances.map((adv) => (
                        <div key={adv.id} className="p-2 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs text-[11px]">
                          <div className="flex justify-between font-bold text-[#18231C]">
                            <span>{fixUtf8Encoding(adv.author)} ({adv.progressPercent}%)</span>
                            <span className="text-[10px] text-[#8C827A]">{formatDateTime(adv.createdAt)}</span>
                          </div>
                          <p className="text-[#4A453F] mt-0.5">{fixUtf8Encoding(adv.note)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comentarios inmutables */}
                {taskComments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Comentarios ({taskComments.length})
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {taskComments.map((cmt) => (
                        <div key={cmt.id} className="p-2 bg-slate-50 border border-slate-200 rounded-xs text-[11px]">
                          <div className="flex justify-between font-bold text-[#18231C]">
                            <span>{fixUtf8Encoding(cmt.author)}</span>
                            <span className="text-[10px] text-[#8C827A]">{formatDateTime(cmt.createdAt)}</span>
                          </div>
                          <p className="text-[#4A453F] mt-0.5">{fixUtf8Encoding(cmt.text)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fotos de respaldo */}
                {taskPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#8C827A] flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      Fotos de Respaldo ({taskPhotos.length})
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {taskPhotos.map((ph) => (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() => setLightboxPhoto(ph.url)}
                          className="h-20 border border-[#DCD4C9] rounded-xs overflow-hidden cursor-pointer hover:opacity-90"
                        >
                          <img src={ph.url} alt={ph.caption || 'Respaldo'} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingTask;
                    setViewingTask(null);
                    openEditModal(target);
                  }}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FDB813]" />
                  <span>Editar Ficha / Gestionar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTask(null)}
                  className="px-3 py-2 border border-[#DCD4C9] bg-white hover:bg-neutral-100 text-xs font-bold rounded-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox para ampliar fotos de respaldo */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-3 -right-3 bg-white text-black rounded-full p-1.5 shadow-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightboxPhoto} alt="Foto de respaldo ampliada" className="max-h-[85vh] rounded-xs shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};
