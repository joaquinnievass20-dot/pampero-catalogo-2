import React, { useState, useEffect, useMemo } from 'react';
import {
  BranchLocation,
  EmployeeAccount,
  RRHHCheckInRecord,
  RRHHCustomFieldDef,
  RRHHEmployeeRecord,
  RRHHModuleConfig,
  RRHHVacationEntry,
  UserSession,
} from '../../types';
import {
  DEFAULT_RRHH_CONFIG,
  deleteRRHHCheckIn,
  saveRRHHConfig,
  saveRRHHLegajo,
  subscribeToFirestoreEmployees,
  subscribeToRRHHCheckIns,
  subscribeToRRHHConfig,
  subscribeToRRHHLegajos,
} from '../../services/firebase';
import {
  getBranchColor,
  resolveDayScheduleEntry,
  RRHHScheduleCalendar,
} from '../rrhh/RRHHScheduleCalendar';
import {
  buildWeeklyScheduleFromBranch,
  findConfiguredBranch,
  getConfiguredBranchList,
  parseBranchOpeningHours,
  resolveConfiguredBranchName,
} from '../../utils/rrhhBranches';
import {
  Users,
  Clock,
  MapPin,
  Calendar,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Save,
  Building2,
  Phone,
  FileText,
  Palmtree,
  Sliders,
  Palette,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Wand2,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminRRHHTabProps {
  userSession?: UserSession | null;
  branches?: BranchLocation[];
  triggerSaveNotice?: () => void;
  embeddedInHub?: boolean;
}

const DEFAULT_WORK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ALL_WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function computeDaysBetween(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function slugifyFieldKey(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `campo_${Date.now()}`
  );
}

export const AdminRRHHTab: React.FC<AdminRRHHTabProps> = ({
  branches = [],
  triggerSaveNotice,
  embeddedInHub = false,
}) => {
  const [subTab, setSubTab] = useState<'legajos' | 'calendar' | 'vacations' | 'checkins' | 'settings'>('legajos');
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [legajos, setLegajos] = useState<RRHHEmployeeRecord[]>([]);
  const [checkIns, setCheckIns] = useState<RRHHCheckInRecord[]>([]);
  const [rrhhConfig, setRrhhConfig] = useState<RRHHModuleConfig>(DEFAULT_RRHH_CONFIG);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('Todas');
  const [dateFilter, setDateFilter] = useState('');
  const [checkInStatusFilter, setCheckInStatusFilter] = useState<'all' | 'on_time' | 'late' | 'wrong_branch'>('all');
  const [vacationStatusFilter, setVacationStatusFilter] = useState<'all' | 'aprobada' | 'pendiente' | 'finalizada'>('all');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit Legajo Modal
  const [editingLegajo, setEditingLegajo] = useState<RRHHEmployeeRecord | null>(null);
  const [legajoModalTab, setLegajoModalTab] = useState<'datos' | 'calendario'>('datos');

  // Calendar Tab state
  const [calendarViewMode, setCalendarViewMode] = useState<'team' | 'employee'>('team');
  const [calendarEmployeeId, setCalendarEmployeeId] = useState<string>('');
  const [teamRosterDate, setTeamRosterDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [teamMonthDate, setTeamMonthDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Add/Edit Vacation Modal
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null);
  const [vacError, setVacError] = useState<string | null>(null);
  const [vacForm, setVacForm] = useState<{
    legajoId: string;
    startDate: string;
    endDate: string;
    status: 'aprobada' | 'pendiente' | 'finalizada';
    notes: string;
  }>({
    legajoId: '',
    startDate: '',
    endDate: '',
    status: 'aprobada',
    notes: '',
  });

  // Delete confirmations (inline, no native dialogs)
  const [confirmDeleteCheckInId, setConfirmDeleteCheckInId] = useState<string | null>(null);
  const [confirmDeleteVacKey, setConfirmDeleteVacKey] = useState<string | null>(null);

  // Settings Tab - New / Edit Custom Field
  const [configDraft, setConfigDraft] = useState<RRHHModuleConfig>(DEFAULT_RRHH_CONFIG);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<RRHHCustomFieldDef['type']>('text');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldEmployeeEditable, setNewFieldEmployeeEditable] = useState(true);

  useEffect(() => {
    const unsubEmp = subscribeToFirestoreEmployees((list) => setEmployees(list));
    const unsubLeg = subscribeToRRHHLegajos((list) => setLegajos(list));
    const unsubChk = subscribeToRRHHCheckIns((list) => setCheckIns(list));
    const unsubCfg = subscribeToRRHHConfig((cfg) => {
      setRrhhConfig(cfg);
      setConfigDraft(cfg);
    });
    return () => {
      unsubEmp();
      unsubLeg();
      unsubChk();
      unsubCfg();
    };
  }, []);

  const configuredBranches = useMemo(() => getConfiguredBranchList(branches), [branches]);
  const branchChoices = useMemo(
    () => configuredBranches.map((b) => b.name),
    [configuredBranches]
  );

  const colorBranches = useMemo(() => [...branchChoices, 'Franco'], [branchChoices]);

  // Fusiona los empleados del sistema con los legajos RRHH guardados
  const mergedRoster: RRHHEmployeeRecord[] = useMemo(() => {
    const result: RRHHEmployeeRecord[] = [];
    const matchedLegajoIds = new Set<string>();

    employees.forEach((emp) => {
      const cleanEmail = (emp.email || '').toLowerCase().trim();
      const existing = legajos.find(
        (l) =>
          (l.employeeId && l.employeeId === emp.id) ||
          (cleanEmail && (l.email || '').toLowerCase().trim() === cleanEmail)
      );
      const rawBranch = existing?.assignedBranch || emp.branch || branchChoices[0] || 'Pampero Maipú';
      const resolvedBranch = resolveConfiguredBranchName(rawBranch, configuredBranches, true);
      const branchObj = findConfiguredBranch(resolvedBranch, configuredBranches);
      const parsedBranch = branchObj ? parseBranchOpeningHours(branchObj) : null;

      if (existing) {
        matchedLegajoIds.add(existing.id);
        result.push({
          ...existing,
          employeeId: existing.employeeId || emp.id,
          fullName: existing.fullName || emp.name,
          email: existing.email || emp.email,
          assignedBranch: resolvedBranch,
          scheduledStart: existing.scheduledStart || parsedBranch?.fullShift.start || '08:30',
          scheduledEnd: existing.scheduledEnd || parsedBranch?.fullShift.end || '17:30',
          workDays:
            Array.isArray(existing.workDays) && existing.workDays.length > 0
              ? existing.workDays
              : parsedBranch?.openDays || DEFAULT_WORK_DAYS,
          customFieldValues: existing.customFieldValues || {},
          weeklySchedule: existing.weeklySchedule || {},
          dateSchedules: existing.dateSchedules || {},
          vacations: Array.isArray(existing.vacations) ? existing.vacations : [],
        });
      } else {
        result.push({
          id: `legajo-${emp.id}`,
          employeeId: emp.id,
          fullName: emp.name,
          email: emp.email,
          assignedBranch: resolvedBranch,
          scheduledStart: parsedBranch?.fullShift.start || '08:30',
          scheduledEnd: parsedBranch?.fullShift.end || '17:30',
          workDays: parsedBranch?.openDays || DEFAULT_WORK_DAYS,
          position:
            emp.sellerRole === 'encargado'
              ? 'Encargado General'
              : emp.sellerRole === 'local'
                ? 'Encargado de Local'
                : 'Vendedor / Operador',
          customFieldValues: {},
          weeklySchedule: {},
          dateSchedules: {},
          vacations: [],
        });
      }
    });

    legajos.forEach((l) => {
      if (!matchedLegajoIds.has(l.id)) {
        const resolvedBranch = resolveConfiguredBranchName(
          l.assignedBranch,
          configuredBranches,
          true
        );
        result.push({
          ...l,
          assignedBranch: resolvedBranch,
          vacations: Array.isArray(l.vacations) ? l.vacations : [],
          customFieldValues: l.customFieldValues || {},
          weeklySchedule: l.weeklySchedule || {},
          dateSchedules: l.dateSchedules || {},
          workDays:
            Array.isArray(l.workDays) && l.workDays.length > 0 ? l.workDays : DEFAULT_WORK_DAYS,
        });
      }
    });

    return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees, legajos, configuredBranches, branchChoices]);

  useEffect(() => {
    if (mergedRoster.length > 0 && !mergedRoster.some((r) => r.id === calendarEmployeeId)) {
      setCalendarEmployeeId(mergedRoster[0].id);
    }
  }, [mergedRoster, calendarEmployeeId]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3200);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedRoster.filter((rec) => {
      const recBranch = resolveConfiguredBranchName(rec.assignedBranch, configuredBranches, true);
      const matchesBranch =
        branchFilter === 'Todas' || recBranch.toLowerCase() === branchFilter.toLowerCase();
      const matchesSearch =
        !q ||
        rec.fullName.toLowerCase().includes(q) ||
        rec.email.toLowerCase().includes(q) ||
        (rec.dniOrCuil || '').toLowerCase().includes(q) ||
        (rec.position || '').toLowerCase().includes(q);
      return matchesBranch && matchesSearch;
    });
  }, [mergedRoster, search, branchFilter, configuredBranches]);

  const allVacations = useMemo(() => {
    const rows: Array<{ legajo: RRHHEmployeeRecord; vacation: RRHHVacationEntry }> = [];
    mergedRoster.forEach((leg) => {
      (leg.vacations || []).forEach((vac) => {
        rows.push({ legajo: leg, vacation: vac });
      });
    });
    return rows
      .filter(({ legajo, vacation }) => {
        const q = search.trim().toLowerCase();
        const recBranch = resolveConfiguredBranchName(
          legajo.assignedBranch,
          configuredBranches,
          true
        );
        const matchesBranch =
          branchFilter === 'Todas' || recBranch.toLowerCase() === branchFilter.toLowerCase();
        const matchesStatus =
          vacationStatusFilter === 'all' || vacation.status === vacationStatusFilter;
        const matchesSearch =
          !q ||
          legajo.fullName.toLowerCase().includes(q) ||
          legajo.email.toLowerCase().includes(q);
        return matchesBranch && matchesStatus && matchesSearch;
      })
      .sort((a, b) => (b.vacation.startDate || '').localeCompare(a.vacation.startDate || ''));
  }, [mergedRoster, search, branchFilter, vacationStatusFilter, configuredBranches]);

  const filteredCheckIns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checkIns.filter((c) => {
      const cBranch = resolveConfiguredBranchName(c.branch, configuredBranches, true);
      const matchesBranch =
        branchFilter === 'Todas' ||
        cBranch.toLowerCase() === branchFilter.toLowerCase() ||
        (c.branch || '').toLowerCase() === branchFilter.toLowerCase();
      const matchesDate = !dateFilter || c.dateStr === dateFilter;
      const matchesStatus =
        checkInStatusFilter === 'all' || c.status === checkInStatusFilter;
      const matchesSearch =
        !q ||
        c.employeeName.toLowerCase().includes(q) ||
        c.employeeEmail.toLowerCase().includes(q) ||
        c.branch.toLowerCase().includes(q);
      return matchesBranch && matchesDate && matchesStatus && matchesSearch;
    });
  }, [checkIns, search, branchFilter, dateFilter, checkInStatusFilter, configuredBranches]);

  const handleSaveLegajo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLegajo || !editingLegajo.fullName.trim()) return;
    setSaving(true);
    try {
      await saveRRHHLegajo(editingLegajo);
      triggerSaveNotice?.();
      showToast(`Legajo y calendario actualizado para ${editingLegajo.fullName}`);
      setEditingLegajo(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarTabLegajoUpdate = async (updated: RRHHEmployeeRecord) => {
    setSaving(true);
    try {
      await saveRRHHLegajo(updated);
      triggerSaveNotice?.();
      showToast(`Turno guardado en el calendario de ${updated.fullName}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddVacation = (preselectedId?: string) => {
    setEditingVacationId(null);
    setVacError(null);
    setVacForm({
      legajoId: preselectedId || mergedRoster[0]?.id || '',
      startDate: todayStr,
      endDate: todayStr,
      status: 'aprobada',
      notes: '',
    });
    setVacationModalOpen(true);
  };

  const handleOpenEditVacation = (legajo: RRHHEmployeeRecord, vac: RRHHVacationEntry) => {
    setEditingVacationId(vac.id);
    setVacError(null);
    setVacForm({
      legajoId: legajo.id,
      startDate: vac.startDate,
      endDate: vac.endDate,
      status:
        vac.status === 'pendiente' || vac.status === 'finalizada' ? vac.status : 'aprobada',
      notes: vac.notes || '',
    });
    setVacationModalOpen(true);
  };

  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    setVacError(null);
    const target = mergedRoster.find((r) => r.id === vacForm.legajoId);
    if (!target || !vacForm.startDate || !vacForm.endDate) return;

    const daysCount = computeDaysBetween(vacForm.startDate, vacForm.endDate);
    if (daysCount <= 0) {
      setVacError('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
      return;
    }

    setSaving(true);
    try {
      const existingVacations = target.vacations || [];
      let nextVacations: RRHHVacationEntry[];
      if (editingVacationId) {
        nextVacations = existingVacations.map((v) =>
          v.id === editingVacationId
            ? {
                ...v,
                startDate: vacForm.startDate,
                endDate: vacForm.endDate,
                daysCount,
                status: vacForm.status,
                notes: vacForm.notes.trim() || undefined,
              }
            : v
        );
      } else {
        const newVac: RRHHVacationEntry = {
          id: `vac-${Date.now()}`,
          startDate: vacForm.startDate,
          endDate: vacForm.endDate,
          daysCount,
          status: vacForm.status,
          notes: vacForm.notes.trim() || undefined,
        };
        nextVacations = [newVac, ...existingVacations];
      }

      await saveRRHHLegajo({
        ...target,
        vacations: nextVacations,
      });
      triggerSaveNotice?.();
      showToast(
        editingVacationId
          ? `Vacaciones editadas para ${target.fullName}`
          : `Vacaciones registradas para ${target.fullName} (${daysCount} días)`
      );
      setVacationModalOpen(false);
      setEditingVacationId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVacation = async (legajo: RRHHEmployeeRecord, vacId: string) => {
    const updatedRecord: RRHHEmployeeRecord = {
      ...legajo,
      vacations: (legajo.vacations || []).filter((v) => v.id !== vacId),
    };
    await saveRRHHLegajo(updatedRecord);
    setConfirmDeleteVacKey(null);
    triggerSaveNotice?.();
    showToast(`Vacaciones actualizadas para ${legajo.fullName}`);
  };

  const handleDeleteCheckIn = async (chkId: string) => {
    await deleteRRHHCheckIn(chkId);
    setConfirmDeleteCheckInId(null);
    triggerSaveNotice?.();
    showToast('Registro de fichaje eliminado');
  };

  const handleToggleDay = (day: string) => {
    if (!editingLegajo) return;
    const current = editingLegajo.workDays || DEFAULT_WORK_DAYS;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setEditingLegajo({ ...editingLegajo, workDays: next });
  };

  // --- Config / Custom Fields Management ---
  const handlePersistConfig = async (nextConfig: RRHHModuleConfig, toastMsg: string) => {
    setSaving(true);
    setConfigDraft(nextConfig);
    setRrhhConfig(nextConfig);
    try {
      await saveRRHHConfig(nextConfig);
      triggerSaveNotice?.();
      showToast(toastMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    const baseKey = slugifyFieldKey(newFieldLabel.trim());
    const uniqueKey = configDraft.customFields.some((f) => f.key === baseKey)
      ? `${baseKey}_${Date.now().toString().slice(-4)}`
      : baseKey;
    const nextField: RRHHCustomFieldDef = {
      id: `fld-${Date.now()}`,
      key: uniqueKey,
      label: newFieldLabel.trim(),
      type: newFieldType,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options:
        newFieldType === 'select'
          ? newFieldOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      required: newFieldRequired,
      employeeEditable: newFieldEmployeeEditable,
      active: true,
      order: configDraft.customFields.length + 1,
    };
    const nextCfg: RRHHModuleConfig = {
      ...configDraft,
      customFields: [...configDraft.customFields, nextField],
    };
    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldOptions('');
    setNewFieldRequired(false);
    setNewFieldEmployeeEditable(true);
    await handlePersistConfig(nextCfg, `Campo "${nextField.label}" agregado a los legajos`);
  };

  const handleUpdateFieldProp = (
    fieldId: string,
    patch: Partial<RRHHCustomFieldDef>
  ) => {
    setConfigDraft((prev) => ({
      ...prev,
      customFields: prev.customFields.map((f) =>
        f.id === fieldId ? { ...f, ...patch } : f
      ),
    }));
  };

  const handleMoveField = (index: number, direction: -1 | 1) => {
    const list = [...configDraft.customFields];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    const reindexed = list.map((f, idx) => ({ ...f, order: idx + 1 }));
    setConfigDraft((prev) => ({ ...prev, customFields: reindexed }));
  };

  const handleDeleteField = (fieldId: string) => {
    setConfigDraft((prev) => ({
      ...prev,
      customFields: prev.customFields
        .filter((f) => f.id !== fieldId)
        .map((f, idx) => ({ ...f, order: idx + 1 })),
    }));
  };

  const todayCheckInsCount = checkIns.filter((c) => c.dateStr === todayStr).length;
  const activeVacationsCount = allVacations.filter(
    ({ vacation }) =>
      vacation.status !== 'finalizada' &&
      vacation.startDate <= todayStr &&
      vacation.endDate >= todayStr
  ).length;

  const activeFields = useMemo(
    () => rrhhConfig.customFields.filter((f) => f.active),
    [rrhhConfig.customFields]
  );

  const selectedCalendarLegajo = useMemo(
    () =>
      filteredRoster.find((r) => r.id === calendarEmployeeId) ||
      mergedRoster.find((r) => r.id === calendarEmployeeId) ||
      filteredRoster[0] ||
      mergedRoster[0] ||
      null,
    [filteredRoster, mergedRoster, calendarEmployeeId]
  );

  // Grilla mensual para "Vista Equipo (Mes)"
  const teamCalendarCells = useMemo(() => {
    const y = teamMonthDate.getFullYear();
    const m = teamMonthDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: Array<{ dateStr: string; dayNum: number; inCurrentMonth: boolean }> = [];
    const prevLast = new Date(y, m, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(y, m - 1, prevLast - i);
      cells.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`,
        dayNum: d.getDate(),
        inCurrentMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        inCurrentMonth: true,
      });
    }
    let nextD = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(y, m + 1, nextD++);
      cells.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`,
        dayNum: d.getDate(),
        inCurrentMonth: false,
      });
    }
    return cells;
  }, [teamMonthDate]);

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

  return (
    <div className={`${embeddedInHub ? 'space-y-5' : 'p-4 sm:p-6 space-y-6'} animate-fadeIn`}>
      {/* Header Summary Card */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#18231C] text-[#FDB813] rounded-xs shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              RRHH · Legajos, Calendario de Turnos y Fichajes
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Editá legajos, campos personalizados, colores por local, turnos mensuales en calendario, vacaciones y control de llegada con GPS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs">
            <span className="text-[#6F6860]">Personal: </span>
            <strong className="text-[#18231C] tabular-nums">{mergedRoster.length}</strong>
          </div>
          <div className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs">
            <span className="text-[#6F6860]">Fichajes hoy: </span>
            <strong className="text-emerald-700 tabular-nums">{todayCheckInsCount}</strong>
          </div>
          <div className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs">
            <span className="text-[#6F6860]">En vacaciones: </span>
            <strong className="text-amber-700 tabular-nums">{activeVacationsCount}</strong>
          </div>
          {feedback && (
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Tabs & Filter Bar */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
        <div className="px-4 pt-3 border-b border-[#DCD4C9] flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-[#FAF8F5]">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSubTab('legajos')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'legajos'
                  ? 'border-[#B9522F] text-[#18231C] bg-white'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Legajos ({mergedRoster.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('calendar')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'calendar'
                  ? 'border-[#B9522F] text-[#18231C] bg-white'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendario Turnos</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('vacations')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'vacations'
                  ? 'border-[#B9522F] text-[#18231C] bg-white'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <Palmtree className="w-3.5 h-3.5" />
              <span>Vacaciones ({allVacations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('checkins')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'checkins'
                  ? 'border-[#B9522F] text-[#18231C] bg-white'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Fichajes GPS ({checkIns.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('settings')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'settings'
                  ? 'border-[#B9522F] text-[#18231C] bg-white'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Campos & Colores</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2.5">
            {subTab === 'vacations' && (
              <button
                type="button"
                onClick={() => handleOpenAddVacation()}
                className="px-3 py-1.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cargar Vacaciones</span>
              </button>
            )}

            {subTab === 'legajos' && (
              <button
                type="button"
                onClick={() => {
                  const firstBranch = configuredBranches[0];
                  const parsed = firstBranch ? parseBranchOpeningHours(firstBranch) : null;
                  setLegajoModalTab('datos');
                  setEditingLegajo({
                    id: `legajo-custom-${Date.now()}`,
                    fullName: '',
                    email: '',
                    assignedBranch: firstBranch?.name || 'Pampero Maipú',
                    scheduledStart: parsed?.fullShift.start || '08:30',
                    scheduledEnd: parsed?.fullShift.end || '17:30',
                    workDays: parsed?.openDays || DEFAULT_WORK_DAYS,
                    customFieldValues: {},
                    weeklySchedule: {},
                    dateSchedules: {},
                    vacations: [],
                  });
                }}
                className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Legajo</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros Color-Coded (unificada en Legajos, Calendario, Vacaciones y Fichajes) */}
        {subTab !== 'settings' && (
          <div className="px-4 py-3 border-b border-[#DCD4C9] bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Color-coded Branch Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#8C827A] mr-1 shrink-0" />
              <button
                type="button"
                onClick={() => setBranchFilter('Todas')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  branchFilter === 'Todas'
                    ? 'bg-[#18231C] text-white border-[#18231C]'
                    : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-neutral-100'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    branchFilter === 'Todas' ? 'bg-[#FDB813]' : 'bg-[#18231C]'
                  }`}
                />
                <span>Todas las Sucursales</span>
              </button>

              {branchChoices.map((b) => {
                const active = branchFilter === b;
                const bColor = getBranchColor(b, rrhhConfig.branchColors, configuredBranches);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBranchFilter(b)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1.5"
                    style={
                      active
                        ? {
                            backgroundColor: bColor,
                            borderColor: bColor,
                            color: '#FFFFFF',
                          }
                        : {
                            backgroundColor: `${bColor}12`,
                            borderColor: `${bColor}45`,
                            color: '#18231C',
                          }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#FFFFFF' : bColor }}
                    />
                    <span>{b}</span>
                  </button>
                );
              })}

              {/* Status filters context-specific */}
              {subTab === 'checkins' && (
                <div className="flex items-center gap-1 pl-2 ml-1 border-l border-[#DCD4C9] flex-wrap">
                  {[
                    { key: 'all' as const, label: 'Todos', color: '#4A453F' },
                    { key: 'on_time' as const, label: 'En horario', color: '#059669' },
                    { key: 'late' as const, label: 'Tarde', color: '#DC2626' },
                    { key: 'wrong_branch' as const, label: 'Otro local', color: '#D97706' },
                  ].map((st) => {
                    const isSt = checkInStatusFilter === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setCheckInStatusFilter(st.key)}
                        className="px-2 py-1 text-[10px] font-bold rounded-xs border cursor-pointer transition-colors"
                        style={
                          isSt
                            ? { backgroundColor: st.color, borderColor: st.color, color: '#FFFFFF' }
                            : {
                                backgroundColor: `${st.color}10`,
                                borderColor: `${st.color}40`,
                                color: '#18231C',
                              }
                        }
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {subTab === 'vacations' && (
                <div className="flex items-center gap-1 pl-2 ml-1 border-l border-[#DCD4C9] flex-wrap">
                  {[
                    { key: 'all' as const, label: 'Todas', color: '#4A453F' },
                    { key: 'aprobada' as const, label: 'Aprobadas', color: '#059669' },
                    { key: 'pendiente' as const, label: 'Pendientes', color: '#D97706' },
                    { key: 'finalizada' as const, label: 'Finalizadas', color: '#6B7280' },
                  ].map((st) => {
                    const isSt = vacationStatusFilter === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setVacationStatusFilter(st.key)}
                        className="px-2 py-1 text-[10px] font-bold rounded-xs border cursor-pointer transition-colors"
                        style={
                          isSt
                            ? { backgroundColor: st.color, borderColor: st.color, color: '#FFFFFF' }
                            : {
                                backgroundColor: `${st.color}10`,
                                borderColor: `${st.color}40`,
                                color: '#18231C',
                              }
                        }
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search & Date inputs */}
            <div className="flex flex-wrap items-center gap-2">
              {subTab === 'checkins' && (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-mono"
                    title="Filtrar por fecha"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="p-1.5 text-[#6F6860] hover:text-[#18231C] border border-[#DCD4C9] rounded-xs cursor-pointer"
                      title="Quitar filtro de fecha"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-[#6F6860] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar colaborador, email o DNI..."
                  className="w-full sm:w-56 pl-8 pr-7 py-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-2 text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 1: LEGAJOS Y HORARIOS */}
        {subTab === 'legajos' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Colaborador / Puesto</th>
                  <th className="py-3 px-3">Campos Legajo</th>
                  <th className="py-3 px-3">Local Base</th>
                  <th className="py-3 px-3">Horario & Días</th>
                  <th className="py-3 px-3">Vacaciones</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4C9]">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F6860]">
                      No hay legajos que coincidan con el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((rec) => {
                    const activeVac = (rec.vacations || []).find(
                      (v) => v.status !== 'finalizada' && v.startDate <= todayStr && v.endDate >= todayStr
                    );
                    const nextVac = (rec.vacations || []).find(
                      (v) => v.status !== 'finalizada' && v.startDate > todayStr
                    );
                    const branchColor = getBranchColor(
                      rec.assignedBranch || branchChoices[0] || '',
                      rrhhConfig.branchColors,
                      configuredBranches
                    );
                    const filledCustomCount = activeFields.filter((f) => {
                      const v = rec.customFieldValues?.[f.key];
                      if (v && v.trim()) return true;
                      if (f.key === 'cuil_dni' && rec.dniOrCuil) return true;
                      if (f.key === 'telefono_personal' && rec.phone) return true;
                      if (f.key === 'contacto_emergencia' && rec.emergencyContact) return true;
                      return false;
                    }).length;

                    return (
                      <tr key={rec.id} className="hover:bg-[#FAF8F5]/70">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#18231C]">{rec.fullName}</div>
                          <div className="text-[11px] text-[#6F6860] font-mono">{rec.email}</div>
                          {rec.position && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[10px] font-semibold text-[#4A453F]">
                              {rec.position}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-[#18231C] font-bold tabular-nums">
                            {filledCustomCount}/{activeFields.length} completos
                          </div>
                          {(rec.dniOrCuil || rec.customFieldValues?.cuil_dni) && (
                            <div className="text-[11px] text-[#6F6860] font-mono">
                              DNI: {rec.customFieldValues?.cuil_dni || rec.dniOrCuil}
                            </div>
                          )}
                          {(rec.phone || rec.customFieldValues?.telefono_personal) && (
                            <div className="text-[11px] text-[#6F6860] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              <span className="font-mono">
                                {rec.customFieldValues?.telefono_personal || rec.phone}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs border font-bold text-[11px] bg-white"
                            style={{ borderColor: branchColor, color: branchColor }}
                          >
                            <span
                              className="w-2 h-2 rounded-xs inline-block"
                              style={{ backgroundColor: branchColor }}
                            />
                            <span>{rec.assignedBranch || branchChoices[0] || ''}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-[#18231C] tabular-nums flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#B9522F]" />
                            <span>
                              {rec.scheduledStart || '08:30'} - {rec.scheduledEnd || '17:30'}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#6F6860] mt-0.5">
                            {(rec.workDays || DEFAULT_WORK_DAYS).join(', ')}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {activeVac ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                              En curso hasta {activeVac.endDate}
                            </span>
                          ) : nextVac ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-semibold">
                              Próx: {nextVac.startDate} ({nextVac.daysCount}d)
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#6F6860]">
                              {(rec.vacations || []).length > 0
                                ? `${rec.vacations!.length} registradas`
                                : 'Sin registros'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLegajoModalTab('datos');
                                setEditingLegajo({ ...rec });
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] rounded-xs text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#B9522F]" />
                              <span>Editar Legajo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarEmployeeId(rec.id);
                                setSubTab('calendar');
                              }}
                              className="px-2 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] rounded-xs text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              title="Ver / pintar calendario de turnos"
                            >
                              <Calendar className="w-3.5 h-3.5 text-[#18231C]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAddVacation(rec.id)}
                              className="px-2 py-1.5 bg-white hover:bg-amber-50 border border-[#DCD4C9] text-[#18231C] rounded-xs text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              title="Cargar vacaciones"
                            >
                              <Palmtree className="w-3.5 h-3.5 text-amber-700" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 2: CALENDARIO DE TURNOS POR LOCAL */}
        {subTab === 'calendar' && (
          <div className="p-4 sm:p-5 space-y-5 bg-[#FAF8F5]/50">
            {/* View Mode Toggle + Employee Quick Picker */}
            <div className="bg-white p-3.5 rounded-xs border border-[#DCD4C9] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 border border-[#DCD4C9] rounded-xs w-fit">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('team')}
                  className={`px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 ${
                    calendarViewMode === 'team'
                      ? 'bg-[#18231C] text-[#FDB813]'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Vista Equipo (Mes)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('employee')}
                  className={`px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 ${
                    calendarViewMode === 'employee'
                      ? 'bg-[#18231C] text-[#FDB813]'
                      : 'text-[#6F6860] hover:text-[#18231C]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Editar por Colaborador</span>
                </button>
              </div>

              {calendarViewMode === 'employee' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6860]">
                    Colaborador:
                  </span>
                  <select
                    value={selectedCalendarLegajo?.id || ''}
                    onChange={(e) => setCalendarEmployeeId(e.target.value)}
                    className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] cursor-pointer outline-none"
                  >
                    {(filteredRoster.length > 0 ? filteredRoster : mergedRoster).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.assignedBranch || branchChoices[0] || ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {calendarViewMode === 'team' && (
                <div className="text-[11px] text-[#6F6860]">
                  Mostrando{' '}
                  <strong className="text-[#18231C]">
                    {(filteredRoster.length > 0 || search || branchFilter !== 'Todas'
                      ? filteredRoster
                      : mergedRoster
                    ).length}
                  </strong>{' '}
                  colaboradores · Hacé clic en un día para ver la cobertura por sucursal.
                </div>
              )}
            </div>

            {calendarViewMode === 'team' ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Left 2/3: Monthly Team Calendar */}
                <div className="xl:col-span-2 bg-white rounded-xs border border-[#DCD4C9] flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-[#DCD4C9] flex items-center justify-between bg-[#FAF8F5]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTeamMonthDate(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                          )
                        }
                        className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                        title="Mes anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <h4 className="font-display font-bold text-sm sm:text-base uppercase tracking-wider text-[#18231C] min-w-[165px] text-center">
                        {MONTH_NAMES_ES[teamMonthDate.getMonth()]} {teamMonthDate.getFullYear()}
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setTeamMonthDate(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                          )
                        }
                        className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                        title="Mes siguiente"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nowD = new Date();
                        setTeamMonthDate(new Date(nowD.getFullYear(), nowD.getMonth(), 1));
                        setTeamRosterDate(todayStr);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] uppercase cursor-pointer"
                    >
                      Hoy
                    </button>
                  </div>

                  <div className="grid grid-cols-7 border-b border-[#DCD4C9] bg-[#ECE5DC]/40">
                    {ALL_WEEK_DAYS.map((wd) => (
                      <div
                        key={wd}
                        className="py-2 text-center text-[10px] font-black uppercase tracking-wider text-[#6F6860]"
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {teamCalendarCells.map((cell) => {
                      const isToday = cell.dateStr === todayStr;
                      const isSelected = cell.dateStr === teamRosterDate;
                      const q = search.trim().toLowerCase();

                      const dayAssignments = mergedRoster
                        .map((rec) => ({
                          rec,
                          res: resolveDayScheduleEntry(rec, cell.dateStr, configuredBranches),
                        }))
                        .filter(({ rec, res }) => {
                          if (res.entry.isOffDay && res.source !== 'vacation') return false;
                          const matchesQ =
                            !q ||
                            rec.fullName.toLowerCase().includes(q) ||
                            rec.email.toLowerCase().includes(q);
                          if (!matchesQ) return false;
                          if (branchFilter !== 'Todas') {
                            return (
                              res.entry.branch.toLowerCase() === branchFilter.toLowerCase() ||
                              (res.source === 'vacation' &&
                                resolveConfiguredBranchName(
                                  rec.assignedBranch,
                                  configuredBranches,
                                  true
                                ).toLowerCase() === branchFilter.toLowerCase())
                            );
                          }
                          return true;
                        });

                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => {
                            setTeamRosterDate(cell.dateStr);
                            if (!cell.inCurrentMonth) {
                              const dt = new Date(`${cell.dateStr}T12:00:00`);
                              if (!isNaN(dt.getTime())) {
                                setTeamMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
                              }
                            }
                          }}
                          className={`min-h-[92px] p-1.5 border-b border-r border-[#DCD4C9]/70 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50/90 ring-2 ring-inset ring-[#B9522F]'
                              : cell.inCurrentMonth
                                ? 'bg-white hover:bg-[#FAF8F5]'
                                : 'bg-neutral-50/70 text-neutral-400 hover:bg-neutral-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span
                              className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${
                                isToday
                                  ? 'bg-[#B9522F] text-white font-black'
                                  : isSelected
                                    ? 'bg-[#18231C] text-white'
                                    : cell.inCurrentMonth
                                      ? 'text-[#18231C]'
                                      : 'text-neutral-400'
                              }`}
                            >
                              {cell.dayNum}
                            </span>
                            {dayAssignments.length > 0 && (
                              <span className="text-[9px] font-mono font-bold text-[#6F6860]">
                                {dayAssignments.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5 w-full overflow-hidden">
                            {dayAssignments.slice(0, 3).map(({ rec, res }) => {
                              const isVac = res.source === 'vacation';
                              const col = isVac
                                ? '#059669'
                                : getBranchColor(
                                    res.entry.branch,
                                    rrhhConfig.branchColors,
                                    configuredBranches
                                  );
                              return (
                                <div
                                  key={rec.id}
                                  className="text-[9px] font-bold px-1 py-0.5 rounded-xs border truncate flex items-center gap-1"
                                  style={{
                                    backgroundColor: `${col}15`,
                                    borderColor: `${col}45`,
                                    color: '#18231C',
                                  }}
                                  title={`${rec.fullName} · ${isVac ? 'Vacaciones' : `${res.entry.branch} (${res.entry.startTime}-${res.entry.endTime})`}`}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: col }}
                                  />
                                  <span className="truncate">
                                    {rec.fullName.split(' ')[0]}{' '}
                                    {isVac ? '(Vac)' : res.entry.startTime || ''}
                                  </span>
                                </div>
                              );
                            })}
                            {dayAssignments.length > 3 && (
                              <div className="text-[9px] font-black text-[#B9522F] pl-1">
                                +{dayAssignments.length - 3} más...
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right 1/3: Cobertura del Día por Sucursal */}
                <div className="bg-white rounded-xs border border-[#DCD4C9] flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-[#DCD4C9] bg-[#18231C] text-white flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-[#FDB813] font-bold block">
                        Cobertura del Día
                      </span>
                      <h4 className="font-bold text-sm uppercase tracking-wider mt-0.5">
                        {teamRosterDate === todayStr ? `Hoy · ${teamRosterDate}` : teamRosterDate}
                      </h4>
                    </div>
                    <input
                      type="date"
                      value={teamRosterDate}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setTeamRosterDate(e.target.value);
                        const dt = new Date(`${e.target.value}T12:00:00`);
                        if (!isNaN(dt.getTime())) {
                          setTeamMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
                        }
                      }}
                      className="px-2 py-1 bg-white/10 border border-white/20 text-white rounded-xs text-[11px] font-mono outline-none"
                    />
                  </div>

                  <div className="p-3.5 flex-1 overflow-y-auto space-y-3 bg-[#FAF8F5] text-xs">
                    {configuredBranches
                      .filter(
                        (b) => branchFilter === 'Todas' || b.name === branchFilter
                      )
                      .map((branchObj) => {
                        const bColor = getBranchColor(
                          branchObj.name,
                          rrhhConfig.branchColors,
                          configuredBranches
                        );
                        const staffInBranch = mergedRoster
                          .map((rec) => ({
                            rec,
                            res: resolveDayScheduleEntry(rec, teamRosterDate, configuredBranches),
                          }))
                          .filter(
                            ({ res }) =>
                              res.source !== 'vacation' &&
                              !res.entry.isOffDay &&
                              res.entry.branch.toLowerCase() === branchObj.name.toLowerCase()
                          );

                        return (
                          <div
                            key={branchObj.id || branchObj.name}
                            className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden"
                            style={{ borderTopWidth: '3px', borderTopColor: bColor }}
                          >
                            <div className="px-3 py-2 bg-[#FAF8F5] border-b border-[#ECE5DC] flex items-center justify-between gap-2">
                              <span
                                className="font-black text-xs uppercase flex items-center gap-1.5"
                                style={{ color: bColor }}
                              >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{branchObj.name}</span>
                              </span>
                              <span className="px-1.5 py-0.5 bg-white border border-[#DCD4C9] rounded-xs font-mono text-[10px] font-bold text-[#18231C]">
                                {staffInBranch.length} asignados
                              </span>
                            </div>
                            <div className="px-3 py-1.5 bg-white border-b border-[#ECE5DC] text-[10px] text-[#6F6860]">
                              <strong className="text-[#18231C]">Horario local: </strong>
                              {branchObj.openingHours || branchObj.hours || 'Según sucursal'}
                            </div>
                            <div className="divide-y divide-[#ECE5DC]">
                              {staffInBranch.length === 0 ? (
                                <div className="p-2.5 text-[11px] text-[#6F6860] italic">
                                  Sin personal asignado para esta fecha.
                                </div>
                              ) : (
                                staffInBranch.map(({ rec, res }) => (
                                  <div
                                    key={rec.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#FAF8F5]"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-[#18231C] truncate">
                                        {rec.fullName}
                                      </div>
                                      <div className="font-mono text-[10px] text-[#B9522F] font-semibold tabular-nums">
                                        {res.entry.startTime} - {res.entry.endTime} hs
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCalendarEmployeeId(rec.id);
                                        setCalendarViewMode('employee');
                                      }}
                                      className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#18231C] hover:text-[#FDB813] border border-[#DCD4C9] rounded-xs text-[10px] font-bold uppercase cursor-pointer transition-colors shrink-0"
                                    >
                                      Editar
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {/* Francos y Vacaciones del día */}
                    {(() => {
                      const offOrVac = mergedRoster
                        .map((rec) => ({
                          rec,
                          res: resolveDayScheduleEntry(rec, teamRosterDate, configuredBranches),
                        }))
                        .filter(({ res }) => res.source === 'vacation' || res.entry.isOffDay);

                      if (offOrVac.length === 0) return null;
                      return (
                        <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden">
                          <div className="px-3 py-2 bg-[#FAF8F5] border-b border-[#ECE5DC] font-black text-[11px] uppercase text-[#4A453F]">
                            Francos y Vacaciones ({offOrVac.length})
                          </div>
                          <div className="divide-y divide-[#ECE5DC]">
                            {offOrVac.map(({ rec, res }) => (
                              <div
                                key={rec.id}
                                className="px-3 py-2 flex items-center justify-between gap-2"
                              >
                                <span className="font-semibold text-[#18231C] truncate">
                                  {rec.fullName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                                      res.source === 'vacation'
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                        : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                                    }`}
                                  >
                                    {res.source === 'vacation' ? 'Vacaciones' : 'Franco'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCalendarEmployeeId(rec.id);
                                      setCalendarViewMode('employee');
                                    }}
                                    className="px-2 py-0.5 bg-white hover:bg-[#18231C] hover:text-[#FDB813] border border-[#DCD4C9] rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : selectedCalendarLegajo ? (
              <RRHHScheduleCalendar
                legajo={selectedCalendarLegajo}
                config={rrhhConfig}
                branches={configuredBranches}
                editable={true}
                externalBranchFilter={branchFilter}
                onUpdateLegajo={handleCalendarTabLegajoUpdate}
              />
            ) : (
              <div className="p-8 text-center text-xs text-[#6F6860] bg-white border border-[#DCD4C9] rounded-xs">
                No hay colaboradores que coincidan con el filtro actual.
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 3: VACACIONES */}
        {subTab === 'vacations' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-3">Local</th>
                  <th className="py-3 px-3">Desde / Hasta</th>
                  <th className="py-3 px-3 text-center">Días</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Observaciones</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4C9]">
                {allVacations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#6F6860]">
                      No hay períodos de vacaciones cargados todavía. Usá el botón "Cargar Vacaciones" para asignar fechas.
                    </td>
                  </tr>
                ) : (
                  allVacations.map(({ legajo, vacation }) => {
                    const vacKey = `${legajo.id}_${vacation.id}`;
                    const isConfirming = confirmDeleteVacKey === vacKey;
                    return (
                      <tr key={vacation.id} className="hover:bg-[#FAF8F5]/70">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#18231C]">{legajo.fullName}</div>
                          <div className="text-[11px] text-[#6F6860] font-mono">{legajo.email}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#18231C]">
                          {legajo.assignedBranch || branchChoices[0] || ''}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-[#18231C]">
                          {vacation.startDate} → {vacation.endDate}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                          {vacation.daysCount}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase border ${
                              vacation.status === 'aprobada'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : vacation.status === 'pendiente'
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                            }`}
                          >
                            {vacation.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6F6860] max-w-xs truncate">
                          {vacation.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteVacation(legajo, vacation.id)}
                                className="px-2 py-1 bg-red-600 text-white rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVacKey(null)}
                                className="px-2 py-1 bg-neutral-100 text-[#18231C] rounded-xs text-[10px] font-bold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditVacation(legajo, vacation)}
                                className="p-1.5 text-[#18231C] hover:bg-neutral-100 rounded-xs cursor-pointer"
                                title="Editar vacaciones"
                              >
                                <Edit3 className="w-4 h-4 text-[#B9522F]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVacKey(vacKey)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                                title="Eliminar vacaciones"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 4: FICHAJES CON GPS */}
        {subTab === 'checkins' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Fecha & Hora Exacta</th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3">Local Registrado</th>
                  <th className="py-3 px-3">Puntualidad</th>
                  <th className="py-3 px-3">Ubicación GPS Exacta</th>
                  <th className="py-3 px-4 text-right">Acciones / Mapa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4C9]">
                {filteredCheckIns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F6860]">
                      No hay fichajes de llegada registrados con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredCheckIns.map((chk) => {
                    const bColor = getBranchColor(
                      chk.branch,
                      rrhhConfig.branchColors,
                      configuredBranches
                    );
                    return (
                      <tr key={chk.id} className="hover:bg-[#FAF8F5]/70">
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <div className="font-bold text-[#18231C]">{chk.dateStr}</div>
                          <div className="text-[11px] text-[#B9522F] font-bold">{chk.timeStr} hs</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#18231C]">{chk.employeeName}</div>
                          <div className="text-[11px] text-[#6F6860] font-mono">{chk.employeeEmail}</div>
                          {chk.note && (
                            <div className="text-[10px] text-[#4A453F] mt-0.5 italic">"{chk.note}"</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-white border font-bold text-[#18231C]"
                            style={{ borderColor: bColor }}
                          >
                            <span
                              className="w-2 h-2 rounded-xs inline-block"
                              style={{ backgroundColor: bColor }}
                            />
                            <span>{chk.branch}</span>
                          </span>
                          {chk.expectedBranch &&
                            chk.expectedBranch !== 'Todas' &&
                            chk.expectedBranch !== chk.branch && (
                              <div className="text-[10px] text-amber-700 mt-0.5 font-semibold">
                                Asignado: {chk.expectedBranch}
                              </div>
                            )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                              chk.status === 'on_time'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : chk.status === 'late'
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : 'bg-amber-50 border-amber-300 text-amber-800'
                            }`}
                          >
                            {chk.status === 'on_time'
                              ? 'En horario'
                              : chk.status === 'late'
                                ? `Tarde (+${chk.lateMinutes || 0} min)`
                                : 'Otro local'}
                          </span>
                          {chk.expectedStart && (
                            <div className="text-[10px] text-[#6F6860] font-mono mt-0.5">
                              Ingreso: {chk.expectedStart} hs
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {chk.location ? (
                            <div>
                              <div className="text-[#18231C] font-semibold tabular-nums">
                                {chk.location.lat.toFixed(6)}, {chk.location.lng.toFixed(6)}
                              </div>
                              {typeof chk.location.accuracyMeters === 'number' && (
                                <div className="text-[10px] text-[#6F6860]">
                                  Precisión ±{Math.round(chk.location.accuracyMeters)}m
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-sans text-[11px]">
                              <AlertCircle className="w-3 h-3" />
                              <span>{chk.locationError || 'Sin GPS'}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {chk.location ? (
                              <a
                                href={
                                  chk.location.mapsUrl ||
                                  `https://www.google.com/maps?q=${chk.location.lat},${chk.location.lng}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-[11px] font-bold uppercase tracking-wider"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Mapa</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[#6F6860] px-2">—</span>
                            )}

                            {confirmDeleteCheckInId === chk.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCheckIn(chk.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded-xs text-[10px] font-bold uppercase cursor-pointer"
                                >
                                  Borrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCheckInId(null)}
                                  className="px-2 py-1 bg-neutral-100 text-[#18231C] rounded-xs text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCheckInId(chk.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-xs cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 5: CONFIGURAR CAMPOS DEL LEGAJO Y COLORES DE LOCALES */}
        {subTab === 'settings' && (
          <div className="p-4 sm:p-6 space-y-6 text-xs">
            {/* Branch Colors & General Policy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-[#DCD4C9] pb-2">
                  <Palette className="w-4 h-4 text-[#B9522F]" />
                  <h4 className="font-bold uppercase tracking-wider text-[#18231C]">
                    Colores por Local en Calendario de Turnos
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {colorBranches.map((bName) => {
                    const currentColor =
                      configDraft.branchColors?.[bName] ||
                      getBranchColor(bName, undefined, configuredBranches);
                    return (
                      <div
                        key={bName}
                        className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) =>
                              setConfigDraft((prev) => ({
                                ...prev,
                                branchColors: {
                                  ...prev.branchColors,
                                  [bName]: e.target.value,
                                },
                              }))
                            }
                            className="w-7 h-7 p-0.5 bg-white border border-[#DCD4C9] rounded-xs cursor-pointer shrink-0"
                          />
                          <span className="font-bold text-[#18231C] truncate">{bName}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#6F6860] uppercase">
                          {currentColor}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[#DCD4C9] pb-2">
                  <Sliders className="w-4 h-4 text-[#B9522F]" />
                  <h4 className="font-bold uppercase tracking-wider text-[#18231C]">
                    Reglas de Fichaje y Autogestión de Legajo
                  </h4>
                </div>

                <div>
                  <label className="block font-bold text-[#18231C] mb-1">
                    Tolerancia para llegada tarde (minutos)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={configDraft.lateToleranceMinutes}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        lateToleranceMinutes: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-32 px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs font-mono font-bold outline-none"
                  />
                  <span className="block text-[11px] text-[#6F6860] mt-1">
                    Si el colaborador registra su fichaje más allá de su hora de ingreso + esta tolerancia, se marca como "Tarde".
                  </span>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-white border border-[#DCD4C9] rounded-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configDraft.allowEmployeeSelfEditLegajo}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        allowEmployeeSelfEditLegajo: e.target.checked,
                      }))
                    }
                    className="mt-0.5 accent-[#B9522F]"
                  />
                  <div>
                    <span className="font-bold text-[#18231C] block">
                      Permitir que cada colaborador complete y edite sus datos en "Mi Legajo"
                    </span>
                    <span className="text-[11px] text-[#6F6860]">
                      Solo podrá editar los campos que marques abajo como "Editable por colaborador".
                    </span>
                  </div>
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      handlePersistConfig(configDraft, 'Configuración de RRHH guardada')
                    }
                    className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Colores y Reglas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Fields Builder */}
            <div className="border border-[#DCD4C9] rounded-xs overflow-hidden">
              <div className="px-4 py-3 bg-[#FAF8F5] border-b border-[#DCD4C9] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-[#18231C]">
                    Campos Configurables de "Mi Legajo" ({configDraft.customFields.length})
                  </h4>
                  <p className="text-[11px] text-[#6F6860]">
                    Agregá, editá, ocultá o definí qué campos puede completar el colaborador por su cuenta y cuáles son solo internos.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handlePersistConfig(configDraft, 'Estructura de campos del legajo guardada')
                  }
                  className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Campos</span>
                </button>
              </div>

              {/* Add Field Form */}
              <form
                onSubmit={handleAddCustomField}
                className="p-4 bg-[#FAF8F5]/60 border-b border-[#DCD4C9] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end"
              >
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-[#18231C] mb-1">
                    Nombre del Campo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="Ej: CBU / Alias, Grupo Sanguíneo, Talle Calzado"
                    className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#18231C] mb-1">
                    Tipo de Dato
                  </label>
                  <select
                    value={newFieldType}
                    onChange={(e) =>
                      setNewFieldType(e.target.value as RRHHCustomFieldDef['type'])
                    }
                    className="w-full px-2.5 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="text">Texto corto</option>
                    <option value="tel">Teléfono</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                    <option value="select">Desplegable (opciones)</option>
                    <option value="textarea">Texto largo / Notas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#18231C] mb-1">
                    {newFieldType === 'select' ? 'Opciones (con coma)' : 'Ejemplo / Placeholder'}
                  </label>
                  <input
                    type="text"
                    value={newFieldType === 'select' ? newFieldOptions : newFieldPlaceholder}
                    onChange={(e) =>
                      newFieldType === 'select'
                        ? setNewFieldOptions(e.target.value)
                        : setNewFieldPlaceholder(e.target.value)
                    }
                    placeholder={
                      newFieldType === 'select' ? 'Ej: A+, O+, B-' : 'Texto de ayuda...'
                    }
                    className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5 pb-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-[#18231C]">
                    <input
                      type="checkbox"
                      checked={newFieldEmployeeEditable}
                      onChange={(e) => setNewFieldEmployeeEditable(e.target.checked)}
                      className="accent-[#B9522F]"
                    />
                    <span>Editable por colaborador</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-[#18231C]">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                      className="accent-[#B9522F]"
                    />
                    <span>Obligatorio</span>
                  </label>
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full py-2 px-3 bg-[#18231C] hover:bg-black text-[#FDB813] font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Campo</span>
                  </button>
                </div>
              </form>

              {/* Existing Fields List */}
              <div className="divide-y divide-[#DCD4C9]">
                {configDraft.customFields.map((fld, idx) => (
                  <div
                    key={fld.id}
                    className={`p-3 flex flex-wrap items-center justify-between gap-3 ${
                      fld.active ? 'bg-white' : 'bg-neutral-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveField(idx, -1)}
                          className="p-0.5 text-[#6F6860] hover:text-[#18231C] disabled:opacity-30 cursor-pointer"
                          title="Subir"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === configDraft.customFields.length - 1}
                          onClick={() => handleMoveField(idx, 1)}
                          className="p-0.5 text-[#6F6860] hover:text-[#18231C] disabled:opacity-30 cursor-pointer"
                          title="Bajar"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={fld.label}
                          onChange={(e) =>
                            handleUpdateFieldProp(fld.id, { label: e.target.value })
                          }
                          className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs font-bold text-[#18231C] outline-none"
                        />
                        <select
                          value={fld.type}
                          onChange={(e) =>
                            handleUpdateFieldProp(fld.id, {
                              type: e.target.value as RRHHCustomFieldDef['type'],
                            })
                          }
                          className="px-2 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs font-semibold outline-none cursor-pointer"
                        >
                          <option value="text">Texto</option>
                          <option value="tel">Teléfono</option>
                          <option value="number">Número</option>
                          <option value="date">Fecha</option>
                          <option value="select">Desplegable</option>
                          <option value="textarea">Texto largo</option>
                        </select>
                        <input
                          type="text"
                          value={
                            fld.type === 'select'
                              ? (fld.options || []).join(', ')
                              : fld.placeholder || ''
                          }
                          onChange={(e) =>
                            fld.type === 'select'
                              ? handleUpdateFieldProp(fld.id, {
                                  options: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              : handleUpdateFieldProp(fld.id, {
                                  placeholder: e.target.value,
                                })
                          }
                          placeholder={
                            fld.type === 'select'
                              ? 'Opciones separadas por coma'
                              : 'Placeholder...'
                          }
                          className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateFieldProp(fld.id, {
                            employeeEditable: !fld.employeeEditable,
                          })
                        }
                        className={`px-2.5 py-1 rounded-xs border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          fld.employeeEditable
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-neutral-100 border-[#DCD4C9] text-[#6F6860]'
                        }`}
                        title="Define si el colaborador puede completar/editar este campo desde Mi Legajo"
                      >
                        {fld.employeeEditable ? (
                          <Unlock className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        <span>
                          {fld.employeeEditable ? 'Editable colaborador' : 'Solo Admin RRHH'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateFieldProp(fld.id, { active: !fld.active })
                        }
                        className={`px-2.5 py-1 rounded-xs border text-[11px] font-bold cursor-pointer ${
                          fld.active
                            ? 'bg-[#18231C] border-[#18231C] text-[#FDB813]'
                            : 'bg-white border-[#DCD4C9] text-[#6F6860]'
                        }`}
                      >
                        {fld.active ? 'Visible' : 'Oculto'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteField(fld.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                        title="Eliminar campo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Editar Legajo y Calendario */}
      {editingLegajo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white border border-[#DCD4C9] rounded-xs max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#18231C] px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-sm uppercase tracking-wider text-[#FDB813]">
                  Legajo · {editingLegajo.fullName || 'Nuevo Legajo'}
                </h4>
                <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xs text-[11px]">
                  <button
                    type="button"
                    onClick={() => setLegajoModalTab('datos')}
                    className={`px-2.5 py-1 rounded-xs font-bold cursor-pointer ${
                      legajoModalTab === 'datos'
                        ? 'bg-[#FDB813] text-[#18231C]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Datos y Campos
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegajoModalTab('calendario')}
                    className={`px-2.5 py-1 rounded-xs font-bold cursor-pointer ${
                      legajoModalTab === 'calendario'
                        ? 'bg-[#FDB813] text-[#18231C]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Calendario Locales/Horarios
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLegajo(null)}
                className="text-neutral-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLegajo} className="p-5 overflow-y-auto space-y-4 text-xs">
              {legajoModalTab === 'datos' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingLegajo.fullName}
                        onChange={(e) =>
                          setEditingLegajo({ ...editingLegajo, fullName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Email del Colaborador *
                      </label>
                      <input
                        type="email"
                        required
                        value={editingLegajo.email}
                        onChange={(e) =>
                          setEditingLegajo({ ...editingLegajo, email: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Puesto / Cargo
                      </label>
                      <input
                        type="text"
                        value={editingLegajo.position || ''}
                        onChange={(e) =>
                          setEditingLegajo({ ...editingLegajo, position: e.target.value })
                        }
                        placeholder="Ej: Vendedor de Salón"
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                        Fecha de Ingreso
                      </label>
                      <input
                        type="date"
                        value={editingLegajo.hireDate || ''}
                        onChange={(e) =>
                          setEditingLegajo({ ...editingLegajo, hireDate: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Dynamic Custom Fields configured from Panel de Control */}
                  {activeFields.length > 0 && (
                    <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                      <span className="font-bold uppercase tracking-wider text-[#18231C] block">
                        Campos del Legajo (Configurables en Panel de Control)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeFields.map((fld) => {
                          const currentVal =
                            editingLegajo.customFieldValues?.[fld.key] ??
                            (fld.key === 'cuil_dni'
                              ? editingLegajo.dniOrCuil || ''
                              : fld.key === 'telefono_personal'
                                ? editingLegajo.phone || ''
                                : fld.key === 'contacto_emergencia'
                                  ? editingLegajo.emergencyContact || ''
                                  : '');
                          const handleFieldChange = (val: string) => {
                            setEditingLegajo((prev) => {
                              if (!prev) return prev;
                              const nextCustom = {
                                ...(prev.customFieldValues || {}),
                                [fld.key]: val,
                              };
                              return {
                                ...prev,
                                dniOrCuil: fld.key === 'cuil_dni' ? val : prev.dniOrCuil,
                                phone: fld.key === 'telefono_personal' ? val : prev.phone,
                                emergencyContact:
                                  fld.key === 'contacto_emergencia' ? val : prev.emergencyContact,
                                customFieldValues: nextCustom,
                              };
                            });
                          };

                          return (
                            <div
                              key={fld.id}
                              className={fld.type === 'textarea' ? 'sm:col-span-2' : ''}
                            >
                              <label className="block font-semibold text-[#18231C] mb-1">
                                {fld.label}
                                {fld.required && <span className="text-[#B9522F]"> *</span>}
                              </label>
                              {fld.type === 'select' ? (
                                <select
                                  value={currentVal}
                                  onChange={(e) => handleFieldChange(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none cursor-pointer"
                                >
                                  <option value="">Seleccionar...</option>
                                  {(fld.options || []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : fld.type === 'textarea' ? (
                                <textarea
                                  rows={2}
                                  value={currentVal}
                                  onChange={(e) => handleFieldChange(e.target.value)}
                                  placeholder={fld.placeholder || ''}
                                  className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none"
                                />
                              ) : (
                                <input
                                  type={fld.type}
                                  value={currentVal}
                                  onChange={(e) => handleFieldChange(e.target.value)}
                                  placeholder={fld.placeholder || ''}
                                  className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Local y Horario Base */}
                  {(() => {
                    const selectedBranchObj = findConfiguredBranch(
                      editingLegajo.assignedBranch,
                      configuredBranches
                    );
                    const parsedBranchHours = selectedBranchObj
                      ? parseBranchOpeningHours(selectedBranchObj)
                      : null;

                    return (
                      <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[#18231C]">
                            Sucursal Asignada y Horario Habitual
                          </span>
                          {selectedBranchObj && (
                            <button
                              type="button"
                              onClick={() => {
                                const built = buildWeeklyScheduleFromBranch(selectedBranchObj, 'full');
                                setEditingLegajo({
                                  ...editingLegajo,
                                  assignedBranch: selectedBranchObj.name,
                                  scheduledStart: built.scheduledStart,
                                  scheduledEnd: built.scheduledEnd,
                                  workDays: built.workDays,
                                  weeklySchedule: built.weeklySchedule,
                                });
                              }}
                              className="px-2.5 py-1 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                            >
                              <Wand2 className="w-3 h-3" />
                              <span>Cargar horarios de {selectedBranchObj.name}</span>
                            </button>
                          )}
                        </div>

                        {parsedBranchHours && (
                          <div className="p-2 bg-white border border-[#DCD4C9] rounded-xs text-[11px] text-[#4A453F]">
                            <strong className="text-[#18231C]">Horario configurado en Sucursales: </strong>
                            <span>{parsedBranchHours.rawText}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold text-[#4A453F] mb-1">
                              Sucursal Asignada *
                            </label>
                            <select
                              value={editingLegajo.assignedBranch || branchChoices[0] || ''}
                              onChange={(e) => {
                                const nextBranchName = e.target.value;
                                const bObj = findConfiguredBranch(nextBranchName, configuredBranches);
                                const parsed = bObj ? parseBranchOpeningHours(bObj) : null;
                                setEditingLegajo({
                                  ...editingLegajo,
                                  assignedBranch: nextBranchName,
                                  ...(parsed
                                    ? {
                                        scheduledStart: parsed.fullShift.start,
                                        scheduledEnd: parsed.fullShift.end,
                                        workDays: parsed.openDays,
                                      }
                                    : {}),
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none font-bold cursor-pointer"
                            >
                              {branchChoices.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                              <option value="Todas">Todas (Encargado / Rotativo)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold text-[#4A453F] mb-1">
                              Hora de Ingreso
                            </label>
                            <input
                              type="time"
                              value={editingLegajo.scheduledStart || '08:30'}
                              onChange={(e) =>
                                setEditingLegajo({ ...editingLegajo, scheduledStart: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-[#4A453F] mb-1">
                              Hora de Salida
                            </label>
                            <input
                              type="time"
                              value={editingLegajo.scheduledEnd || '17:30'}
                              onChange={(e) =>
                                setEditingLegajo({ ...editingLegajo, scheduledEnd: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs outline-none font-mono tabular-nums"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-[#4A453F] mb-1.5">
                            Días Laborales Habituales
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_WEEK_DAYS.map((day) => {
                              const active = (editingLegajo.workDays || DEFAULT_WORK_DAYS).includes(
                                day
                              );
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => handleToggleDay(day)}
                                  className={`px-2.5 py-1 rounded-xs border text-[11px] font-bold cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-[#18231C] border-[#18231C] text-[#FDB813]'
                                      : 'bg-white border-[#DCD4C9] text-[#6F6860] hover:bg-neutral-100'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                      Notas Internas del Legajo (Solo RRHH)
                    </label>
                    <input
                      type="text"
                      value={editingLegajo.notes || ''}
                      onChange={(e) =>
                        setEditingLegajo({ ...editingLegajo, notes: e.target.value })
                      }
                      placeholder="Observaciones administrativas internas..."
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                    />
                  </div>
                </>
              ) : (
                <RRHHScheduleCalendar
                  legajo={editingLegajo}
                  config={rrhhConfig}
                  branches={configuredBranches}
                  editable={true}
                  compact={true}
                  onUpdateLegajo={(updated) => setEditingLegajo(updated)}
                />
              )}

              <div className="pt-3 border-t border-[#DCD4C9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLegajo(null)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Legajo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cargar / Editar Vacaciones */}
      {vacationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white border border-[#DCD4C9] rounded-xs max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#18231C] px-5 py-3.5 flex items-center justify-between text-white">
              <h4 className="font-bold text-sm uppercase tracking-wider text-[#FDB813]">
                {editingVacationId ? 'Editar Vacaciones' : 'Registrar Vacaciones'}
              </h4>
              <button
                type="button"
                onClick={() => setVacationModalOpen(false)}
                className="text-neutral-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVacation} className="p-5 space-y-4 text-xs">
              {vacError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-xs text-red-800 font-semibold">
                  {vacError}
                </div>
              )}

              <div>
                <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Colaborador *
                </label>
                <select
                  required
                  disabled={Boolean(editingVacationId)}
                  value={vacForm.legajoId}
                  onChange={(e) => setVacForm({ ...vacForm, legajoId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-semibold disabled:opacity-75"
                >
                  {mergedRoster.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName} ({r.assignedBranch || branchChoices[0] || ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={vacForm.startDate}
                    onChange={(e) => setVacForm({ ...vacForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                    Fecha Fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={vacForm.endDate}
                    onChange={(e) => setVacForm({ ...vacForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between">
                <span className="font-semibold text-[#4A453F]">Días corridos calculados:</span>
                <span className="font-mono font-black text-sm text-[#18231C] tabular-nums">
                  {computeDaysBetween(vacForm.startDate, vacForm.endDate)} días
                </span>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Estado
                </label>
                <select
                  value={vacForm.status}
                  onChange={(e) =>
                    setVacForm({
                      ...vacForm,
                      status: e.target.value as 'aprobada' | 'pendiente' | 'finalizada',
                    })
                  }
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none font-semibold"
                >
                  <option value="aprobada">Aprobada</option>
                  <option value="pendiente">Pendiente de Confirmación</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[#18231C] mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={vacForm.notes}
                  onChange={(e) => setVacForm({ ...vacForm, notes: e.target.value })}
                  placeholder="Ej: Vacaciones anuales 2026"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#DCD4C9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVacationModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : editingVacationId ? 'Guardar Cambios' : 'Guardar Vacaciones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
