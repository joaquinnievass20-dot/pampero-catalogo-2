import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarHolidayItem,
  CalendarModuleConfig,
  CRMCalendarEvent,
  CRMCalendarEventType,
  CRMOrder,
  CRMTask,
  LeadVisit,
  Promotion,
  Seller,
  ThemeConfig,
  UserSession,
} from '../../types';
import {
  DEFAULT_ARGENTINA_MENDOZA_DATES,
  DEFAULT_CALENDAR_MODULE_CONFIG,
  getScopeBadgeMeta,
  resolveHolidayDateForYear,
} from '../../data/calendarDatesData';
import {
  deleteCRMCalendarEvent,
  saveCRMCalendarEvent,
  subscribeToCalendarConfig,
  subscribeToCRMCalendarEvents,
  subscribeToCRMTasks,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Globe,
  Lock,
  MapPin,
  Megaphone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  CheckSquare,
} from 'lucide-react';

interface CRMCalendarTabProps {
  userSession: UserSession | null;
  sellersList: Seller[];
  assignedBranch: string;
  assignedSellerName: string;
  activeStaffUser: string;
  isManager: boolean;
  crmScope?: 'all' | 'branch_only' | 'own_only';
  orders: CRMOrder[];
  visits: LeadVisit[];
  theme?: ThemeConfig;
}

type CalendarSourceKind = 'all' | 'task' | 'visit' | 'order' | 'custom' | 'holiday';

interface UnifiedCalendarEntry {
  uid: string;
  source: 'task' | 'visit' | 'order' | 'custom' | 'holiday';
  eventType: CRMCalendarEventType;
  date: string; // YYYY-MM-DD
  time?: string;
  title: string;
  subtitle?: string;
  branch?: string;
  responsible?: string;
  badgeText: string;
  colorHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  isCompleted?: boolean;
  isOverdue?: boolean;
  visibilityLabel?: string;
  rawCustomEvent?: CRMCalendarEvent;
  rawHoliday?: CalendarHolidayItem;
  linkedPromoTitle?: string;
  linkedPromoActive?: boolean;
  locationText?: string;
  locationUrl?: string;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const CUSTOM_TYPE_META: Record<
  CRMCalendarEventType,
  { label: string; colorHex: string; bgClass: string; textClass: string; borderClass: string }
> = {
  vencimiento: {
    label: 'Vencimiento',
    colorHex: '#DC2626',
    bgClass: 'bg-red-50',
    textClass: 'text-red-900',
    borderClass: 'border-red-300',
  },
  tarea: {
    label: 'Tarea',
    colorHex: '#D97706',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-300',
  },
  seguimiento: {
    label: 'Seguimiento',
    colorHex: '#2563EB',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-900',
    borderClass: 'border-blue-300',
  },
  visita: {
    label: 'Visita',
    colorHex: '#7C3AED',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-900',
    borderClass: 'border-purple-300',
  },
  reunion: {
    label: 'Reunión',
    colorHex: '#0D9488',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-900',
    borderClass: 'border-teal-300',
  },
  otro: {
    label: 'Recordatorio',
    colorHex: '#4B5563',
    bgClass: 'bg-neutral-100',
    textClass: 'text-neutral-900',
    borderClass: 'border-neutral-300',
  },
};

const toIsoDateOnly = (raw?: string): string | null => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeStr = (s?: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const CRMCalendarTab: React.FC<CRMCalendarTabProps> = ({
  userSession,
  sellersList,
  assignedBranch,
  assignedSellerName,
  activeStaffUser,
  isManager,
  crmScope = 'all',
  orders,
  visits,
  theme,
}) => {
  const st = theme?.siteTexts;
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [sourceFilter, setSourceFilter] = useState<CalendarSourceKind>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [customEvents, setCustomEvents] = useState<CRMCalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<CalendarHolidayItem[]>(DEFAULT_ARGENTINA_MENDOZA_DATES);
  const [calendarConfig, setCalendarConfig] = useState<CalendarModuleConfig>(DEFAULT_CALENDAR_MODULE_CONFIG);

  // New Event Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(todayStr);
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState<CRMCalendarEventType>('vencimiento');
  const [eventBranch, setEventBranch] = useState(assignedBranch || 'Maipú');
  const [visibilityType, setVisibilityType] = useState<'all' | 'branch' | 'custom'>('all');
  const [visibleToUsers, setVisibleToUsers] = useState<string[]>([]);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  useEffect(() => {
    const unsubTasks = subscribeToCRMTasks((fetched) => {
      setTasks(Array.isArray(fetched) ? fetched.map(sanitizeObjectEncoding) : []);
    });
    const unsubEvents = subscribeToCRMCalendarEvents((fetched) => {
      setCustomEvents(Array.isArray(fetched) ? fetched.map(sanitizeObjectEncoding) : []);
    });
    const unsubCalCfg = subscribeToCalendarConfig((cfgData) => {
      if (Array.isArray(cfgData.holidays) && cfgData.holidays.length > 0) {
        setHolidays(cfgData.holidays);
      }
      if (cfgData.config) {
        setCalendarConfig({ ...DEFAULT_CALENDAR_MODULE_CONFIG, ...cfgData.config });
      }
    });
    return () => {
      unsubTasks();
      unsubEvents();
      unsubCalCfg();
    };
  }, []);

  // Pool de usuarios/operadores para selector de visibilidad
  const teamMembers = useMemo(() => {
    const map = new Map<string, { name: string; email?: string; branch?: string }>();
    (sellersList || []).forEach((s) => {
      if (s?.name) {
        map.set(normalizeStr(s.name), {
          name: fixUtf8Encoding(s.name),
          email: (s as any).email,
          branch: s.branch,
        });
      }
    });
    try {
      const localEmps: any[] = JSON.parse(localStorage.getItem('pampero_employees') || '[]');
      localEmps.forEach((emp) => {
        const nm = emp.sellerName || emp.name || emp.email?.split('@')[0];
        if (nm) {
          const key = normalizeStr(nm);
          const existing = map.get(key);
          map.set(key, {
            name: fixUtf8Encoding(nm),
            email: emp.email || existing?.email,
            branch: emp.branch || existing?.branch,
          });
        }
      });
    } catch {}
    return Array.from(map.values());
  }, [sellersList]);

  const currentUserIdentifiers = useMemo(() => {
    const ids = new Set<string>();
    if (userSession?.email) ids.add(normalizeStr(userSession.email));
    if (activeStaffUser) ids.add(normalizeStr(activeStaffUser));
    if (assignedSellerName) ids.add(normalizeStr(assignedSellerName));
    if (userSession?.clientData?.fullName) ids.add(normalizeStr(userSession.clientData.fullName));
    return ids;
  }, [userSession, activeStaffUser, assignedSellerName]);

  const canSeeCustomEvent = (ev: CRMCalendarEvent): boolean => {
    const creatorName = normalizeStr(ev.createdBy);
    const creatorEmail = normalizeStr(ev.createdByEmail);
    if (
      (creatorName && currentUserIdentifiers.has(creatorName)) ||
      (creatorEmail && currentUserIdentifiers.has(creatorEmail))
    ) {
      return true;
    }

    if (ev.visibilityType === 'all') return true;

    if (ev.visibilityType === 'branch') {
      if (userSession?.role === 'admin') return true;
      return normalizeStr(ev.branch) === normalizeStr(assignedBranch);
    }

    if (ev.visibilityType === 'custom') {
      const allowedList = Array.isArray(ev.visibleToUsers) ? ev.visibleToUsers : [];
      return allowedList.some((u) => currentUserIdentifiers.has(normalizeStr(u)));
    }

    return true;
  };

  // Consolidar todos los eventos de Tareas, Visitas, Seguimiento y Eventos Propios
  const allEntries: UnifiedCalendarEntry[] = useMemo(() => {
    const list: UnifiedCalendarEntry[] = [];

    // 1. Tareas (vencimientos + activaciones futuras)
    tasks.forEach((task) => {
      // Respetar alcance por local si no es admin
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'branch_only' &&
        assignedBranch &&
        task.branch &&
        normalizeStr(task.branch) !== normalizeStr(assignedBranch)
      ) {
        return;
      }
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'own_only' &&
        assignedSellerName
      ) {
        const respList = Array.isArray(task.assignedToList) && task.assignedToList.length > 0
          ? task.assignedToList
          : [task.assignedTo];
        const matchesResp = respList.some((r) => normalizeStr(r) === normalizeStr(assignedSellerName));
        if (!matchesResp) return;
      }

      const respDisplay =
        Array.isArray(task.assignedToList) && task.assignedToList.length > 0
          ? task.assignedToList.join(', ')
          : task.assignedTo;

      const due = toIsoDateOnly(task.dueDate);
      const isDone = task.columnId === 'completado' || Number(task.progressPercent || 0) >= 100;

      if (due) {
        list.push({
          uid: `task-due-${task.id}-${due}`,
          source: 'task',
          eventType: 'tarea',
          date: due,
          time: task.dueTime,
          title: fixUtf8Encoding(task.title),
          subtitle: task.description
            ? fixUtf8Encoding(task.description)
            : `Avance: ${task.progressPercent || 0}%${task.tags?.length ? ` · ${task.tags.join(', ')}` : ''}`,
          branch: task.branch,
          responsible: fixUtf8Encoding(respDisplay),
          badgeText: isDone ? 'Tarea Completada' : `Vence Tarea (${task.importance.toUpperCase()})`,
          colorHex: '#DC2626',
          bgClass: 'bg-red-50',
          textClass: 'text-red-900',
          borderClass: 'border-red-300',
          isCompleted: isDone,
          isOverdue: !isDone && due < todayStr,
        });
      }

      const act = toIsoDateOnly(task.activationDate);
      if (act && act !== due && task.scheduleType === 'specific_date') {
        list.push({
          uid: `task-act-${task.id}-${act}`,
          source: 'task',
          eventType: 'tarea',
          date: act,
          title: `[Programada] ${fixUtf8Encoding(task.title)}`,
          subtitle: 'Activación programada de tarea',
          branch: task.branch,
          responsible: fixUtf8Encoding(respDisplay),
          badgeText: 'Activación Tarea',
          colorHex: '#DC2626',
          bgClass: 'bg-red-50',
          textClass: 'text-red-900',
          borderClass: 'border-red-300',
        });
      }
    });

    // 2. Visitas Comerciales (próximo paso / fecha visita)
    (visits || []).forEach((visit) => {
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'branch_only' &&
        assignedBranch &&
        visit.branch &&
        normalizeStr(visit.branch) !== normalizeStr(assignedBranch)
      ) {
        return;
      }
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'own_only' &&
        assignedSellerName &&
        normalizeStr(visit.seller) !== normalizeStr(assignedSellerName)
      ) {
        return;
      }

      const nextDate = toIsoDateOnly(visit.nextStepDate);
      const visitDate = toIsoDateOnly(visit.date);
      const targetDate = nextDate || visitDate;
      if (!targetDate) return;

      list.push({
        uid: `visit-${visit.id}-${targetDate}`,
        source: 'visit',
        eventType: 'visita',
        date: targetDate,
        title: `${fixUtf8Encoding(visit.companyName)}${visit.trackingCode ? ` (${visit.trackingCode})` : ''}`,
        subtitle: nextDate
          ? `Próximo paso: ${fixUtf8Encoding(visit.nextStep || visit.objective || 'Seguimiento comercial')}`
          : fixUtf8Encoding(visit.objective || visit.nextStep || 'Visita / Contacto comercial'),
        branch: visit.branch,
        responsible: fixUtf8Encoding(visit.seller || 'Sin asignar'),
        badgeText: nextDate ? 'Próx. Paso Visita' : 'Visita Comercial',
        colorHex: '#7C3AED',
        bgClass: 'bg-purple-50',
        textClass: 'text-purple-900',
        borderClass: 'border-purple-300',
        locationText: visit.companyLocation,
        locationUrl: visit.locationUrl,
      });
    });

    // 3. Seguimiento Empresas (pedidos activos)
    (orders || []).forEach((order) => {
      if (order.status === 'entregado' || order.status === 'cancelado') return;
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'branch_only' &&
        assignedBranch &&
        order.branch &&
        normalizeStr(order.branch) !== normalizeStr(assignedBranch)
      ) {
        return;
      }
      if (
        userSession?.role !== 'admin' &&
        crmScope === 'own_only' &&
        assignedSellerName &&
        normalizeStr(order.seller) !== normalizeStr(assignedSellerName)
      ) {
        return;
      }

      const orderDate = toIsoDateOnly((order as any).estimatedDeliveryDate || order.date);
      if (!orderDate) return;
      const daysOld = Math.floor((Date.now() - new Date(order.date).getTime()) / (1000 * 60 * 60 * 24));
      const isDelayed = daysOld > 7 && (order.status === 'cotizacion' || order.status === 'sena_50');

      list.push({
        uid: `order-${order.id}-${orderDate}`,
        source: 'order',
        eventType: 'seguimiento',
        date: orderDate,
        title: `${fixUtf8Encoding(order.clientName)} (${order.trackingCode || order.orderNumber || order.id.slice(-6)})`,
        subtitle: `${order.totalUnits || 0} prendas · Fase: ${fixUtf8Encoding(order.columnId || order.status)}`,
        branch: order.branch,
        responsible: fixUtf8Encoding(order.seller || 'Sin asignar'),
        badgeText: isDelayed ? 'Seguimiento Demorado' : 'Seguimiento Pedido',
        colorHex: '#2563EB',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-900',
        borderClass: isDelayed ? 'border-blue-500' : 'border-blue-300',
        isOverdue: isDelayed,
        locationText: order.companyLocation,
        locationUrl: order.locationUrl,
      });
    });

    // 4. Eventos personalizados con permisos por usuario/sucursal/público
    customEvents.forEach((ev) => {
      if (!canSeeCustomEvent(ev)) return;
      const dateIso = toIsoDateOnly(ev.date);
      if (!dateIso) return;
      const meta = CUSTOM_TYPE_META[ev.eventType] || CUSTOM_TYPE_META.otro;
      const visibilityLabel =
        ev.visibilityType === 'all'
          ? 'Todos'
          : ev.visibilityType === 'branch'
          ? `Solo ${ev.branch || 'sucursal'}`
          : `Privado (${ev.visibleToUsers?.length || 0} usuarios)`;

      list.push({
        uid: `custom-${ev.id}`,
        source: 'custom',
        eventType: ev.eventType,
        date: dateIso,
        time: ev.time,
        title: fixUtf8Encoding(ev.title),
        subtitle: ev.description ? fixUtf8Encoding(ev.description) : undefined,
        branch: ev.branch,
        responsible: fixUtf8Encoding(ev.createdBy),
        badgeText: ev.completed ? `${meta.label} · Hecho` : meta.label,
        colorHex: '#0D9488',
        bgClass: 'bg-teal-50',
        textClass: 'text-teal-900',
        borderClass: 'border-teal-300',
        isCompleted: Boolean(ev.completed),
        isOverdue: !ev.completed && dateIso < todayStr && ev.eventType === 'vencimiento',
        visibilityLabel,
        rawCustomEvent: ev,
      });
    });

    // 5. Feriados y Fechas Importantes (Argentina, Mendoza, Ciudad, Maipú, Luján de Cuyo y Comerciales)
    const viewedYear = currentMonthDate.getFullYear();
    const candidateYears = Array.from(new Set([viewedYear - 1, viewedYear, viewedYear + 1]));
    let promosCache: Promotion[] = [];
    try {
      const pRaw = localStorage.getItem('pampero_catalog_promotions');
      if (pRaw) {
        const parsedP = JSON.parse(pRaw);
        if (Array.isArray(parsedP)) promosCache = parsedP;
      }
    } catch {}

    holidays.forEach((h) => {
      if (!h.active) return;
      if (h.scope === 'argentina' && !calendarConfig.showArgentinaHolidays) return;
      if (h.scope === 'mendoza' && !calendarConfig.showMendozaHolidays) return;
      if ((h.scope === 'ciudad' || h.scope === 'maipu' || h.scope === 'lujan') && !calendarConfig.showLocalHolidays) return;
      if (h.scope === 'comercial' && !calendarConfig.showCommercialDates) return;

      const meta = getScopeBadgeMeta(h.scope);
      const linkedPromo = promosCache.find(
        (p) => p.id === h.linkedPromotionId || p.linkedHolidayId === h.id
      );

      candidateYears.forEach((yr) => {
        const resolvedDate = resolveHolidayDateForYear(h, yr);
        if (!resolvedDate) return;
        list.push({
          uid: `holiday-${h.id}-${resolvedDate}`,
          source: 'holiday',
          eventType: 'otro',
          date: resolvedDate,
          title: fixUtf8Encoding(h.title),
          subtitle: h.description ? fixUtf8Encoding(h.description) : undefined,
          branch:
            h.scope === 'ciudad'
              ? 'Ciudad'
              : h.scope === 'maipu'
              ? 'Maipú'
              : h.scope === 'lujan'
              ? 'Luján'
              : h.scope === 'mendoza'
              ? 'Mendoza'
              : 'Nacional',
          badgeText: meta.shortLabel,
          colorHex: '#D97706',
          bgClass: 'bg-amber-50',
          textClass: 'text-amber-900',
          borderClass: 'border-amber-300',
          rawHoliday: h,
          linkedPromoTitle: linkedPromo ? fixUtf8Encoding(linkedPromo.title) : undefined,
          linkedPromoActive: linkedPromo?.active,
        });
      });
    });

    return list;
  }, [
    tasks,
    visits,
    orders,
    customEvents,
    holidays,
    calendarConfig,
    currentMonthDate,
    userSession?.role,
    crmScope,
    assignedBranch,
    assignedSellerName,
    todayStr,
    currentUserIdentifiers,
  ]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allEntries.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !(item.subtitle || '').toLowerCase().includes(q) &&
        !(item.responsible || '').toLowerCase().includes(q) &&
        !(item.branch || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [allEntries, sourceFilter, searchQuery]);

  // Agrupar entradas por fecha YYYY-MM-DD
  const entriesByDate = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEntry[]>();
    filteredEntries.forEach((entry) => {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    });
    return map;
  }, [filteredEntries]);

  // Construir grilla mensual (lunes a domingo)
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Lunes = 0 ... Domingo = 6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDaysInMonth = lastDay.getDate();

    const cells: Array<{ dateStr: string; dayNum: number; inCurrentMonth: boolean }> = [];

    // Días previos del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayNum: d.getDate(),
        inCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= totalDaysInMonth; day++) {
      cells.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        inCurrentMonth: true,
      });
    }

    // Completar filas hasta múltiplo de 7
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, nextDay++);
      cells.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayNum: d.getDate(),
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [currentMonthDate]);

  const selectedDayEntries = useMemo(() => {
    return (entriesByDate.get(selectedDate) || []).slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [entriesByDate, selectedDate]);

  const canCreateCustomEvents =
    userSession?.role === 'admin' || isManager || calendarConfig.allowStaffCreateEvents !== false;

  const openNewEventModal = (prefillDate?: string) => {
    if (!canCreateCustomEvents) return;
    setEventTitle('');
    setEventDescription('');
    setEventDate(prefillDate || selectedDate || todayStr);
    setEventTime('');
    setEventType('vencimiento');
    setEventBranch(assignedBranch || 'Maipú');
    setVisibilityType(calendarConfig.defaultVisibilityType || 'all');
    setVisibleToUsers([]);
    setShowEventModal(true);
  };

  const toggleVisibleUser = (userIdentifier: string) => {
    setVisibleToUsers((prev) =>
      prev.includes(userIdentifier) ? prev.filter((u) => u !== userIdentifier) : [...prev, userIdentifier]
    );
  };

  const handleSaveCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;
    setIsSavingEvent(true);
    try {
      const creatorName = assignedSellerName || activeStaffUser || userSession?.email || 'Personal Pampero';
      const newEvent: CRMCalendarEvent = sanitizeObjectEncoding({
        id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        date: eventDate,
        time: eventTime.trim() || undefined,
        eventType,
        branch: eventBranch,
        visibilityType,
        visibleToUsers: visibilityType === 'custom' ? visibleToUsers : [],
        createdBy: creatorName,
        createdByEmail: userSession?.email || '',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await saveCRMCalendarEvent(newEvent);
      setSelectedDate(eventDate);
      setShowEventModal(false);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleToggleCustomEventDone = async (ev: CRMCalendarEvent) => {
    await saveCRMCalendarEvent({
      ...ev,
      completed: !ev.completed,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteCustomEvent = async (ev: CRMCalendarEvent) => {
    if (!confirm(`¿Eliminar el evento "${ev.title}" del calendario?`)) return;
    await deleteCRMCalendarEvent(ev.id);
  };

  const prevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#B9522F]" />
              {st?.crmCalendarTitle || 'Calendario de Gestión y Vencimientos'}
            </h3>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900 border border-amber-300">
              {allEntries.length} eventos visibles
            </span>
          </div>
          <p className="text-xs text-[#6F6860] mt-0.5">
            {st?.crmCalendarSubtitle ||
              'Visualizá en un solo lugar vencimientos de tareas, próximos pasos de visitas comerciales, seguimiento de empresas y recordatorios con permisos personalizados.'}
          </p>
        </div>

        {canCreateCustomEvents && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openNewEventModal(selectedDate)}
              className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{st?.crmNewEventBtnText || 'Nuevo Evento / Recordatorio'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-[#8C827A] mr-1" />
          {[
            {
              key: 'all' as const,
              label: 'Todos',
              count: allEntries.length,
              hex: '#18231C',
              activeClass: 'bg-[#18231C] text-white border-[#18231C]',
              idleClass: 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-neutral-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-black/10 text-[#18231C]',
            },
            {
              key: 'holiday' as const,
              label: 'Feriados & Comerciales',
              count: allEntries.filter((e) => e.source === 'holiday').length,
              hex: '#D97706',
              activeClass: 'bg-amber-600 text-white border-amber-700',
              idleClass: 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-amber-200/80 text-amber-950',
            },
            {
              key: 'task' as const,
              label: 'Tareas / Vencimientos',
              count: allEntries.filter((e) => e.source === 'task').length,
              hex: '#DC2626',
              activeClass: 'bg-red-600 text-white border-red-700',
              idleClass: 'bg-red-50 text-red-950 border-red-300 hover:bg-red-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-red-200/80 text-red-950',
            },
            {
              key: 'visit' as const,
              label: 'Visitas Comerciales',
              count: allEntries.filter((e) => e.source === 'visit').length,
              hex: '#7C3AED',
              activeClass: 'bg-purple-600 text-white border-purple-700',
              idleClass: 'bg-purple-50 text-purple-950 border-purple-300 hover:bg-purple-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-purple-200/80 text-purple-950',
            },
            {
              key: 'order' as const,
              label: 'Seguimiento Empresas',
              count: allEntries.filter((e) => e.source === 'order').length,
              hex: '#2563EB',
              activeClass: 'bg-blue-600 text-white border-blue-700',
              idleClass: 'bg-blue-50 text-blue-950 border-blue-300 hover:bg-blue-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-blue-200/80 text-blue-950',
            },
            {
              key: 'custom' as const,
              label: 'Mis Eventos / Privados',
              count: allEntries.filter((e) => e.source === 'custom').length,
              hex: '#0D9488',
              activeClass: 'bg-teal-600 text-white border-teal-700',
              idleClass: 'bg-teal-50 text-teal-950 border-teal-300 hover:bg-teal-100',
              badgeActive: 'bg-white/20 text-white',
              badgeIdle: 'bg-teal-200/80 text-teal-950',
            },
          ]
            .filter((pill) => pill.key === 'all' || pill.count > 0)
            .map((pill) => {
              const isSelected = sourceFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setSourceFilter(pill.key)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected ? pill.activeClass : pill.idleClass
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#FFFFFF' : pill.hex }}
                  />
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-xs text-[10px] font-mono tabular-nums ${
                      isSelected ? pill.badgeActive : pill.badgeIdle
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
        </div>

        <div className="relative min-w-[220px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar evento, empresa o responsable..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>
      </div>

      {/* Main Split: Calendar Month Grid + Selected Day Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1">
        {/* Left 2 Columns: Month Calendar */}
        <div className="xl:col-span-2 bg-white rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col overflow-hidden">
          {/* Month Controls */}
          <div className="p-3.5 border-b border-[#DCD4C9] flex items-center justify-between bg-[#FAF8F5]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="font-display font-bold text-base uppercase tracking-wider text-[#18231C] min-w-[170px] text-center">
                {MONTH_NAMES_ES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
              </h4>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] uppercase cursor-pointer"
            >
              Hoy
            </button>
          </div>

          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-[#DCD4C9] bg-[#ECE5DC]/40">
            {WEEKDAYS_ES.map((dayName) => (
              <div
                key={dayName}
                className="py-2 text-center text-[10px] font-black uppercase tracking-wider text-[#6F6860]"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr">
            {calendarDays.map((cell) => {
              const dayItems = entriesByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const hasOverdue = dayItems.some((d) => d.isOverdue);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[96px] p-1.5 border-b border-r border-[#DCD4C9]/70 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/90 ring-2 ring-inset ring-[#B9522F]'
                      : cell.inCurrentMonth
                      ? 'bg-white hover:bg-[#FAF8F5]'
                      : 'bg-neutral-50/70 text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-[#18231C] text-[#FDB813] font-black'
                          : isSelected
                          ? 'bg-[#18231C] text-white'
                          : cell.inCurrentMonth
                          ? 'text-[#18231C]'
                          : 'text-neutral-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {hasOverdue && (
                      <span title="Tiene vencimientos o demoras">
                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 w-full overflow-hidden">
                    {dayItems.slice(0, 3).map((ev) => (
                      <div
                        key={ev.uid}
                        className={`text-[9px] font-bold px-1 py-0.5 rounded-xs border truncate ${ev.bgClass} ${ev.textClass} ${ev.borderClass} ${
                          ev.isCompleted ? 'line-through opacity-65' : ''
                        }`}
                        title={`${ev.badgeText}: ${ev.title}`}
                      >
                        {ev.time ? `${ev.time} ` : ''}
                        {ev.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] font-black text-[#B9522F] pl-1">
                        +{dayItems.length - 3} más...
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Agenda del Día Seleccionado */}
        <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col overflow-hidden min-h-[480px]">
          <div className="p-4 border-b border-[#DCD4C9] bg-[#18231C] text-white flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#FDB813] font-bold block">
                Agenda del Día
              </span>
              <h4 className="font-bold text-sm uppercase tracking-wider mt-0.5">
                {selectedDate === todayStr ? `Hoy · ${selectedDate}` : selectedDate}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => openNewEventModal(selectedDate)}
              className="px-2.5 py-1.5 bg-[#FDB813] hover:bg-amber-400 text-[#18231C] text-[11px] font-black uppercase rounded-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>

          <div className="p-3.5 flex-1 overflow-y-auto space-y-2.5 bg-[#FAF8F5]">
            {selectedDayEntries.length === 0 ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-4 text-[#6F6860]">
                <CalendarIcon className="w-10 h-10 text-[#DCD4C9] mb-2" />
                <p className="text-xs font-bold text-[#18231C]">No hay vencimientos ni eventos registrados para esta fecha</p>
                <p className="text-[11px] mt-1">Podés crear un recordatorio o evento personalizado con permisos por usuario.</p>
                <button
                  type="button"
                  onClick={() => openNewEventModal(selectedDate)}
                  className="mt-3 px-3 py-1.5 bg-[#18231C] text-white text-xs font-bold rounded-xs uppercase cursor-pointer"
                >
                  + Crear evento este día
                </button>
              </div>
            ) : (
              selectedDayEntries.map((item) => {
                const isCustomOwnerOrAdmin =
                  item.source === 'custom' &&
                  item.rawCustomEvent &&
                  (userSession?.role === 'admin' ||
                    isManager ||
                    currentUserIdentifiers.has(normalizeStr(item.rawCustomEvent.createdBy)) ||
                    currentUserIdentifiers.has(normalizeStr(item.rawCustomEvent.createdByEmail)));

                return (
                  <div
                    key={item.uid}
                    className={`bg-white p-3 rounded-sm border shadow-2xs space-y-1.5 ${
                      item.isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-[#DCD4C9]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs border ${item.bgClass} ${item.textClass} ${item.borderClass}`}
                      >
                        {item.badgeText}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.time && (
                          <span className="text-[10px] font-bold text-[#18231C] flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-[#B9522F]" />
                            {item.time}
                          </span>
                        )}
                        {item.visibilityLabel && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-xs flex items-center gap-0.5 font-semibold"
                            title="Quiénes pueden ver este evento"
                          >
                            {item.rawCustomEvent?.visibilityType === 'all' ? (
                              <Globe className="w-2.5 h-2.5 text-emerald-700" />
                            ) : item.rawCustomEvent?.visibilityType === 'branch' ? (
                              <Building2 className="w-2.5 h-2.5 text-blue-700" />
                            ) : (
                              <Lock className="w-2.5 h-2.5 text-amber-700" />
                            )}
                            <span>{item.visibilityLabel}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <h5
                      className={`font-bold text-xs text-[#18231C] leading-snug ${
                        item.isCompleted ? 'line-through opacity-65' : ''
                      }`}
                    >
                      {item.title}
                    </h5>

                    {item.subtitle && (
                      <p className="text-[11px] text-[#6F6860] leading-snug">{item.subtitle}</p>
                    )}

                    {item.rawHoliday?.marketingIdea && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-xs text-[10px] text-amber-950 flex items-start gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-[#B9522F] shrink-0 mt-0.5" />
                        <span>
                          <strong>Idea Comercial / Publicidad:</strong>{' '}
                          {fixUtf8Encoding(item.rawHoliday.marketingIdea)}
                        </span>
                      </div>
                    )}

                    {item.linkedPromoTitle && (
                      <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-xs text-[10px] font-bold text-emerald-900 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>
                          Banner: {item.linkedPromoTitle} ({item.linkedPromoActive ? 'ACTIVO en Catálogo' : 'Pausado'})
                        </span>
                      </div>
                    )}

                    {(item.locationText || item.locationUrl) && (
                      <div className="text-[10px] bg-emerald-50 border border-emerald-200 rounded-xs px-2 py-1 flex items-center justify-between gap-2 text-emerald-950">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                          {fixUtf8Encoding(item.locationText || 'Ubicación cargada')}
                        </span>
                        {item.locationUrl && (
                          <a
                            href={item.locationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold underline shrink-0 text-emerald-800"
                          >
                            Ver Mapa
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 text-[10px] text-[#8C827A]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.responsible && (
                          <span className="flex items-center gap-1 font-semibold text-[#18231C]">
                            <User className="w-3 h-3 text-[#8C827A]" />
                            {item.responsible}
                          </span>
                        )}
                        {item.branch && (
                          <span className="px-1.5 py-0.2 bg-[#ECE5DC] text-[#18231C] rounded-xs font-bold">
                            {fixUtf8Encoding(item.branch)}
                          </span>
                        )}
                      </div>

                      {item.source === 'custom' && item.rawCustomEvent && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomEventDone(item.rawCustomEvent!)}
                            className={`px-2 py-0.5 rounded-xs border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              item.isCompleted
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-white text-[#18231C] border-[#DCD4C9] hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{item.isCompleted ? 'Hecho' : 'Completar'}</span>
                          </button>
                          {isCustomOwnerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomEvent(item.rawCustomEvent!)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                              title="Eliminar evento"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: Nuevo Evento / Recordatorio con Permisos de Visibilidad */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#FDB813]" />
                <h4 className="font-bold text-sm uppercase tracking-wider">
                  Nuevo Evento / Recordatorio en Calendario
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomEvent} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Título del Evento / Vencimiento *
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Ej: Vencimiento entrega uniformes Bodega Trivento / Control stock"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Tipo de Evento
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as CRMCalendarEventType)}
                    className="w-full px-2 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-semibold"
                  >
                    <option value="vencimiento">Vencimiento</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="visita">Visita Comercial</option>
                    <option value="tarea">Tarea</option>
                    <option value="reunion">Reunión</option>
                    <option value="otro">Otro Recordatorio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Sucursal / Local Asociado
                </label>
                <select
                  value={eventBranch}
                  onChange={(e) => setEventBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                >
                  <option value="Maipú">Maipú</option>
                  <option value="Ciudad">Ciudad</option>
                  <option value="Luján">Luján</option>
                  <option value="Todas">Todas las Sucursales</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Descripción / Detalles
                </label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={2}
                  placeholder="Detalles, contactos o acciones a recordar..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              {/* Visibilidad del Evento por Usuario */}
              <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
                <label className="block font-bold text-[#18231C] uppercase text-[10px] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#B9522F]" />
                  <span>¿Quiénes tienen permiso para ver este evento?</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibilityType('all')}
                    className={`p-2 rounded-xs border text-left transition-colors cursor-pointer ${
                      visibilityType === 'all'
                        ? 'bg-[#18231C] text-white border-[#18231C]'
                        : 'bg-white text-[#18231C] border-[#DCD4C9]'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Todo el equipo</span>
                    </div>
                    <span className="text-[9px] opacity-80 block mt-0.5">Visible para todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibilityType('branch')}
                    className={`p-2 rounded-xs border text-left transition-colors cursor-pointer ${
                      visibilityType === 'branch'
                        ? 'bg-[#18231C] text-white border-[#18231C]'
                        : 'bg-white text-[#18231C] border-[#DCD4C9]'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Solo Local</span>
                    </div>
                    <span className="text-[9px] opacity-80 block mt-0.5">Solo sucursal {eventBranch}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibilityType('custom')}
                    className={`p-2 rounded-xs border text-left transition-colors cursor-pointer ${
                      visibilityType === 'custom'
                        ? 'bg-[#18231C] text-white border-[#18231C]'
                        : 'bg-white text-[#18231C] border-[#DCD4C9]'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <Users className="w-3.5 h-3.5" />
                      <span>Usuarios Elegidos</span>
                    </div>
                    <span className="text-[9px] opacity-80 block mt-0.5">Solo personas tildadas</span>
                  </button>
                </div>

                {visibilityType === 'custom' && (
                  <div className="pt-2 border-t border-[#DCD4C9] space-y-1.5">
                    <span className="text-[10px] font-bold text-[#6F6860] block">
                      Seleccioná quiénes pueden ver este evento (vos siempre lo vas a ver como creador):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white border border-[#DCD4C9] rounded-xs">
                      {teamMembers.map((member) => {
                        const identifier = member.email || member.name;
                        const isChecked =
                          visibleToUsers.includes(member.name) ||
                          (member.email ? visibleToUsers.includes(member.email) : false);
                        return (
                          <label
                            key={identifier}
                            className={`flex items-center gap-2 p-1.5 rounded-xs border cursor-pointer text-[11px] ${
                              isChecked ? 'bg-amber-50 border-amber-300 font-bold text-[#18231C]' : 'border-transparent hover:bg-neutral-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                toggleVisibleUser(member.name);
                              }}
                              className="accent-[#18231C] w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="truncate flex-1">{member.name}</span>
                            {member.branch && (
                              <span className="text-[9px] text-[#8C827A] shrink-0">({member.branch})</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {visibleToUsers.length === 0 && (
                      <p className="text-[10px] text-amber-800 font-semibold">
                        Nota: Si no tildás a nadie más, el evento quedará como recordatorio privado solo para vos.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className="px-5 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{isSavingEvent ? 'Guardando...' : 'Guardar Evento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
