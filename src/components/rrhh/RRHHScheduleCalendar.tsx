import React, { useEffect, useMemo, useState } from 'react';
import {
  BranchLocation,
  RRHHEmployeeRecord,
  RRHHModuleConfig,
  RRHHScheduleEntry,
} from '../../types';
import {
  buildWeeklyScheduleFromBranch,
  findConfiguredBranch,
  getConfiguredBranchList,
  parseBranchOpeningHours,
  resolveConfiguredBranchName,
} from '../../utils/rrhhBranches';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  Filter,
  Paintbrush,
  Palmtree,
  RotateCcw,
  Check,
  Wand2,
} from 'lucide-react';

export const WEEKDAY_KEYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
export const WEEKDAY_MON_FIRST = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const WEEKDAY_FULL_ES: Record<string, string> = {
  Dom: 'Domingo',
  Lun: 'Lunes',
  Mar: 'Martes',
  Mié: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sáb: 'Sábado',
};

const MONTH_NAMES = [
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

const DEFAULT_FALLBACK_COLORS: Record<string, string> = {
  Maipú: '#10B981',
  Ciudad: '#2563EB',
  Luján: '#D97706',
  Todas: '#7C3AED',
  Franco: '#6B7280',
};

const PALETTE_CYCLE = ['#10B981', '#2563EB', '#D97706', '#0D9488', '#DB2777', '#7C3AED'];

export function getBranchColor(
  branch: string,
  branchColors?: Record<string, string>,
  branches?: BranchLocation[]
): string {
  if (!branch) return '#6B7280';
  const norm = branch
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (norm === 'vacaciones') return '#059669';

  if (branchColors) {
    if (branchColors[branch]) return branchColors[branch];
    const matchedKey = Object.keys(branchColors).find(
      (k) =>
        k
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim() === norm
    );
    if (matchedKey) return branchColors[matchedKey];
  }

  if (norm.includes('maip')) return branchColors?.['Maipú'] || DEFAULT_FALLBACK_COLORS.Maipú;
  if (norm.includes('ciudad') || norm.includes('mendoza'))
    return branchColors?.['Ciudad'] || DEFAULT_FALLBACK_COLORS.Ciudad;
  if (norm.includes('luj')) return branchColors?.['Luján'] || DEFAULT_FALLBACK_COLORS.Luján;
  if (norm === 'todas') return branchColors?.['Todas'] || DEFAULT_FALLBACK_COLORS.Todas;
  if (norm === 'franco') return branchColors?.['Franco'] || DEFAULT_FALLBACK_COLORS.Franco;

  if (branches && branches.length > 0) {
    const idx = branches.findIndex(
      (b) =>
        b.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim() === norm
    );
    if (idx >= 0) return PALETTE_CYCLE[idx % PALETTE_CYCLE.length];
  }

  return '#B9522F';
}

export function resolveDayScheduleEntry(
  legajo: RRHHEmployeeRecord | undefined | null,
  dateStr: string,
  branches?: BranchLocation[]
): {
  entry: RRHHScheduleEntry;
  source: 'vacation' | 'override' | 'weekly' | 'default';
  vacationNote?: string;
} {
  const configuredBranches = getConfiguredBranchList(branches);
  const rawBaseBranch = legajo?.assignedBranch || configuredBranches[0]?.name || 'Pampero Maipú';
  const resolvedBaseBranch = resolveConfiguredBranchName(rawBaseBranch, configuredBranches, true);

  const branchObj = findConfiguredBranch(resolvedBaseBranch, configuredBranches);
  const branchParsed = branchObj ? parseBranchOpeningHours(branchObj) : null;

  const defaultStart = legajo?.scheduledStart || branchParsed?.fullShift.start || '08:30';
  const defaultEnd = legajo?.scheduledEnd || branchParsed?.fullShift.end || '17:30';
  const workDays =
    legajo?.workDays && legajo.workDays.length > 0
      ? legajo.workDays
      : branchParsed?.openDays || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // 1. Vacaciones activas
  const activeVac = (legajo?.vacations || []).find(
    (v) =>
      v.status !== 'finalizada' &&
      v.status !== 'cancelada' &&
      v.startDate <= dateStr &&
      v.endDate >= dateStr
  );
  if (activeVac) {
    return {
      entry: {
        date: dateStr,
        branch: 'Vacaciones',
        isOffDay: true,
        note: activeVac.notes,
      },
      source: 'vacation',
      vacationNote: activeVac.notes,
    };
  }

  // 2. Excepción puntual por fecha
  const dateOverride = legajo?.dateSchedules?.[dateStr];
  if (dateOverride) {
    const resolvedB = resolveConfiguredBranchName(dateOverride.branch, configuredBranches, true);
    return {
      entry: {
        ...dateOverride,
        branch: resolvedB,
        date: dateStr,
        isOffDay: dateOverride.isOffDay || resolvedB === 'Franco',
      },
      source: 'override',
    };
  }

  // 3. Plantilla por día de semana
  const dt = new Date(`${dateStr}T12:00:00`);
  const dayKey = isNaN(dt.getTime()) ? 'Lun' : WEEKDAY_KEYS[dt.getDay()];
  const weeklyEntry = legajo?.weeklySchedule?.[dayKey];
  if (weeklyEntry) {
    const resolvedB = resolveConfiguredBranchName(weeklyEntry.branch, configuredBranches, true);
    return {
      entry: {
        ...weeklyEntry,
        branch: resolvedB,
        date: dateStr,
        isOffDay: weeklyEntry.isOffDay || resolvedB === 'Franco',
      },
      source: 'weekly',
    };
  }

  // 4. Fallback a días laborales + horarios de la sucursal configurada
  if (workDays.includes(dayKey)) {
    const isSat = dayKey === 'Sáb' && branchParsed?.saturdayShift && !legajo?.weeklySchedule;
    return {
      entry: {
        date: dateStr,
        branch: resolvedBaseBranch,
        startTime: isSat ? branchParsed!.saturdayShift!.start : defaultStart,
        endTime: isSat ? branchParsed!.saturdayShift!.end : defaultEnd,
        isOffDay: false,
      },
      source: 'default',
    };
  }

  return {
    entry: {
      date: dateStr,
      branch: 'Franco',
      isOffDay: true,
    },
    source: 'default',
  };
}

function calcShiftMinutes(start?: string, end?: string): number {
  if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

function formatReadableDateEs(dateStr: string): string {
  const dt = new Date(`${dateStr}T12:00:00`);
  if (isNaN(dt.getTime())) return dateStr;
  const wd = WEEKDAY_FULL_ES[WEEKDAY_KEYS[dt.getDay()]] || '';
  const dayNum = dt.getDate();
  const monthName = MONTH_NAMES[dt.getMonth()] || '';
  return `${wd} ${dayNum} de ${monthName} ${dt.getFullYear()}`;
}

interface RRHHScheduleCalendarProps {
  legajo: RRHHEmployeeRecord;
  config: RRHHModuleConfig;
  branches?: BranchLocation[];
  editable?: boolean;
  onUpdateLegajo?: (updated: RRHHEmployeeRecord) => void | Promise<void>;
  compact?: boolean;
  externalBranchFilter?: string; // 'Todas' or exact branch name
}

export const RRHHScheduleCalendar: React.FC<RRHHScheduleCalendarProps> = ({
  legajo,
  config,
  branches = [],
  editable = false,
  onUpdateLegajo,
  compact = false,
  externalBranchFilter,
}) => {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Filter pill inside calendar ('all' | branchName | 'Franco' | 'Vacaciones')
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (!externalBranchFilter || externalBranchFilter === 'Todas') {
      setCategoryFilter('all');
    } else {
      setCategoryFilter(externalBranchFilter);
    }
  }, [externalBranchFilter]);

  const configuredBranches = useMemo(() => getConfiguredBranchList(branches), [branches]);
  const branchNames = useMemo(
    () => configuredBranches.map((b) => b.name),
    [configuredBranches]
  );

  const initialBrushBranch = useMemo(() => {
    const resolved = resolveConfiguredBranchName(legajo.assignedBranch, configuredBranches, false);
    return branchNames.includes(resolved) ? resolved : branchNames[0] || 'Pampero Maipú';
  }, [legajo.assignedBranch, configuredBranches, branchNames]);

  // Editor state in right side panel when editable=true
  const [quickPaintOnClick, setQuickPaintOnClick] = useState<boolean>(false);
  const [brushBranch, setBrushBranch] = useState<string>(initialBrushBranch);
  const [brushStart, setBrushStart] = useState<string>(legajo.scheduledStart || '08:30');
  const [brushEnd, setBrushEnd] = useState<string>(legajo.scheduledEnd || '17:30');

  useEffect(() => {
    const resolved = resolveConfiguredBranchName(legajo.assignedBranch, configuredBranches, false);
    setBrushBranch(branchNames.includes(resolved) ? resolved : branchNames[0] || 'Pampero Maipú');
    setBrushStart(legajo.scheduledStart || '08:30');
    setBrushEnd(legajo.scheduledEnd || '17:30');
  }, [legajo.id, legajo.assignedBranch, legajo.scheduledStart, legajo.scheduledEnd, configuredBranches, branchNames]);

  const selectedBrushBranchObj = useMemo(
    () => findConfiguredBranch(brushBranch, configuredBranches),
    [brushBranch, configuredBranches]
  );
  const selectedBrushParsed = useMemo(
    () => (selectedBrushBranchObj ? parseBranchOpeningHours(selectedBrushBranchObj) : null),
    [selectedBrushBranchObj]
  );

  // Grilla completa (incluyendo días relleno mes anterior/siguiente para mantener formato mensual limpio)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      inCurrentMonth: boolean;
      resolved: ReturnType<typeof resolveDayScheduleEntry>;
    }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        inCurrentMonth: false,
        resolved: resolveDayScheduleEntry(legajo, dateStr, configuredBranches),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(
        2,
        '0'
      )}`;
      cells.push({
        dateStr,
        dayNum: d,
        inCurrentMonth: true,
        resolved: resolveDayScheduleEntry(legajo, dateStr, configuredBranches),
      });
    }

    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, nextDay++);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        inCurrentMonth: false,
        resolved: resolveDayScheduleEntry(legajo, dateStr, configuredBranches),
      });
    }

    return cells;
  }, [year, month, legajo, configuredBranches]);

  const monthStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalDaysInMonth = 0;
    let totalMinutes = 0;
    calendarCells.forEach((cell) => {
      if (!cell.inCurrentMonth) return;
      totalDaysInMonth += 1;
      const b = cell.resolved.source === 'vacation' ? 'Vacaciones' : cell.resolved.entry.branch || 'Franco';
      counts[b] = (counts[b] || 0) + 1;
      if (!cell.resolved.entry.isOffDay && cell.resolved.source !== 'vacation') {
        totalMinutes += calcShiftMinutes(
          cell.resolved.entry.startTime,
          cell.resolved.entry.endTime
        );
      }
    });
    return {
      counts,
      totalDaysInMonth,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }, [calendarCells]);

  // Filtros color-coded: Todos + Sucursales configuradas + Franco + Vacaciones
  const filterItems = useMemo(() => {
    const items: Array<{ key: string; label: string; count: number; color: string }> = [
      {
        key: 'all',
        label: 'Todos',
        count: monthStats.totalDaysInMonth,
        color: '#18231C',
      },
    ];
    branchNames.forEach((b) => {
      items.push({
        key: b,
        label: b,
        count: monthStats.counts[b] || 0,
        color: getBranchColor(b, config.branchColors, configuredBranches),
      });
    });
    if ((monthStats.counts['Todas'] || 0) > 0 && !branchNames.includes('Todas')) {
      items.push({
        key: 'Todas',
        label: 'Rotativo / Todas',
        count: monthStats.counts['Todas'] || 0,
        color: getBranchColor('Todas', config.branchColors, configuredBranches),
      });
    }
    items.push({
      key: 'Franco',
      label: 'Franco',
      count: monthStats.counts['Franco'] || 0,
      color: getBranchColor('Franco', config.branchColors, configuredBranches),
    });
    items.push({
      key: 'Vacaciones',
      label: 'Vacaciones',
      count: monthStats.counts['Vacaciones'] || 0,
      color: '#059669',
    });
    return items.filter((item) => item.key === 'all' || item.count > 0);
  }, [monthStats, branchNames, config.branchColors, configuredBranches]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDateStr(todayStr);
  };

  const applyShiftToDate = (dateStr: string) => {
    if (!editable || !onUpdateLegajo) return;
    const currentOverrides = { ...(legajo.dateSchedules || {}) };
    currentOverrides[dateStr] =
      brushBranch === 'Franco'
        ? { date: dateStr, branch: 'Franco', isOffDay: true }
        : {
            date: dateStr,
            branch: brushBranch,
            startTime: brushStart || '08:30',
            endTime: brushEnd || '17:30',
            isOffDay: false,
          };
    onUpdateLegajo({
      ...legajo,
      dateSchedules: currentOverrides,
    });
  };

  const clearOverrideForDate = (dateStr: string) => {
    if (!editable || !onUpdateLegajo) return;
    const currentOverrides = { ...(legajo.dateSchedules || {}) };
    delete currentOverrides[dateStr];
    onUpdateLegajo({
      ...legajo,
      dateSchedules: currentOverrides,
    });
  };

  const handleDayClick = (dateStr: string, inCurrentMonth: boolean) => {
    setSelectedDateStr(dateStr);
    if (!inCurrentMonth) {
      const dt = new Date(`${dateStr}T12:00:00`);
      if (!isNaN(dt.getTime())) {
        setYear(dt.getFullYear());
        setMonth(dt.getMonth());
      }
    }
    if (editable && quickPaintOnClick) {
      applyShiftToDate(dateStr);
    }
  };

  const applyShiftToWeekday = (dayKey: string) => {
    if (!editable || !onUpdateLegajo) return;
    const currentWeekly = { ...(legajo.weeklySchedule || {}) };
    currentWeekly[dayKey] =
      brushBranch === 'Franco'
        ? { branch: 'Franco', isOffDay: true }
        : {
            branch: brushBranch,
            startTime: brushStart || '08:30',
            endTime: brushEnd || '17:30',
            isOffDay: false,
          };

    const nextWorkDays = WEEKDAY_MON_FIRST.filter((d) => {
      const w = currentWeekly[d];
      if (w) return !w.isOffDay && w.branch !== 'Franco';
      return (legajo.workDays || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']).includes(d);
    });

    onUpdateLegajo({
      ...legajo,
      weeklySchedule: currentWeekly,
      workDays: nextWorkDays,
    });
  };

  const handleApplyBranchScheduleToWeek = (mode: 'full' | 'morning' | 'afternoon') => {
    if (!editable || !onUpdateLegajo || !selectedBrushBranchObj) return;
    const built = buildWeeklyScheduleFromBranch(selectedBrushBranchObj, mode);
    onUpdateLegajo({
      ...legajo,
      assignedBranch: selectedBrushBranchObj.name,
      scheduledStart: built.scheduledStart,
      scheduledEnd: built.scheduledEnd,
      workDays: built.workDays,
      weeklySchedule: built.weeklySchedule,
    });
    setBrushStart(built.scheduledStart);
    setBrushEnd(built.scheduledEnd);
  };

  const handleResetMonthOverrides = () => {
    if (!editable || !onUpdateLegajo) return;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const nextOverrides: Record<string, RRHHScheduleEntry> = {};
    Object.entries<RRHHScheduleEntry>(legajo.dateSchedules || {}).forEach(([k, v]) => {
      if (!k.startsWith(prefix) && v) nextOverrides[k] = v;
    });
    onUpdateLegajo({
      ...legajo,
      dateSchedules: nextOverrides,
    });
  };

  const selectedDayResolved = useMemo(
    () => resolveDayScheduleEntry(legajo, selectedDateStr, configuredBranches),
    [legajo, selectedDateStr, configuredBranches]
  );

  const selectedDayWeekdayKey = useMemo(() => {
    const dt = new Date(`${selectedDateStr}T12:00:00`);
    return isNaN(dt.getTime()) ? 'Lun' : WEEKDAY_KEYS[dt.getDay()];
  }, [selectedDateStr]);

  const selectedDayBranchObj = useMemo(() => {
    if (selectedDayResolved.entry.isOffDay || selectedDayResolved.source === 'vacation') {
      return undefined;
    }
    return findConfiguredBranch(selectedDayResolved.entry.branch, configuredBranches);
  }, [selectedDayResolved, configuredBranches]);

  return (
    <div className="space-y-3">
      {/* Color-Coded Filter Bar (CRM-style) */}
      <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[#8C827A] mr-1 shrink-0" />
          {filterItems.map((item) => {
            const isSelected = categoryFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategoryFilter(item.key)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1.5"
                style={
                  isSelected
                    ? {
                        backgroundColor: item.color,
                        borderColor: item.color,
                        color: '#FFFFFF',
                      }
                    : {
                        backgroundColor: `${item.color}12`,
                        borderColor: `${item.color}45`,
                        color: '#18231C',
                      }
                }
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : item.color }}
                />
                <span>{item.label}</span>
                <span
                  className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono tabular-nums"
                  style={
                    isSelected
                      ? { backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }
                      : { backgroundColor: 'rgba(0,0,0,0.07)', color: '#18231C' }
                  }
                >
                  {item.count}d
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-2.5 py-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[11px] font-mono font-bold text-[#18231C] tabular-nums">
          Total mes: {monthStats.totalHours} hs
        </div>
      </div>

      {/* Main Split: Left 2/3 Monthly Grid + Right 1/3 Agenda/Editor Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Monthly Calendar Grid */}
        <div className="xl:col-span-2 bg-white rounded-xs border border-[#DCD4C9] flex flex-col overflow-hidden">
          {/* Month Controls */}
          <div className="p-3.5 border-b border-[#DCD4C9] flex items-center justify-between bg-[#FAF8F5]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="font-display font-bold text-sm sm:text-base uppercase tracking-wider text-[#18231C] min-w-[165px] text-center">
                {MONTH_NAMES[month]} {year}
              </h4>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 bg-white border border-[#DCD4C9] rounded-xs hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {editable && (
                <button
                  type="button"
                  onClick={() => setQuickPaintOnClick((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xs border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    quickPaintOnClick
                      ? 'bg-[#18231C] border-[#18231C] text-[#FDB813]'
                      : 'bg-white border-[#DCD4C9] text-[#18231C] hover:bg-[#ECE5DC]'
                  }`}
                  title="Al activarlo, cada clic sobre un día del calendario asigna el local y horario elegido en el panel derecho"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>{quickPaintOnClick ? 'Pintando al hacer clic' : 'Modo Pincel'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleGoToday}
                className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] uppercase cursor-pointer"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-[#DCD4C9] bg-[#ECE5DC]/40">
            {WEEKDAY_MON_FIRST.map((dayName) => (
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
            {calendarCells.map((cell) => {
              const { entry, source } = cell.resolved;
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDateStr;
              const isVacation = source === 'vacation';
              const isOff = entry.isOffDay || entry.branch === 'Franco';
              const effectiveBranch = isVacation ? 'Vacaciones' : entry.branch || 'Franco';
              const color = isVacation
                ? '#059669'
                : getBranchColor(effectiveBranch, config.branchColors, configuredBranches);

              const matchesFilter =
                categoryFilter === 'all' ||
                effectiveBranch.toLowerCase() === categoryFilter.toLowerCase();

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleDayClick(cell.dateStr, cell.inCurrentMonth)}
                  className={`${
                    compact ? 'min-h-[68px]' : 'min-h-[86px]'
                  } p-1.5 border-b border-r border-[#DCD4C9]/70 text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/90 ring-2 ring-inset ring-[#B9522F]'
                      : cell.inCurrentMonth
                        ? 'bg-white hover:bg-[#FAF8F5]'
                        : 'bg-neutral-50/70 text-neutral-400 hover:bg-neutral-100'
                  } ${!matchesFilter ? 'opacity-30' : ''}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${
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

                    <div className="flex items-center gap-1">
                      {source === 'override' && (
                        <span
                          className="text-[8px] font-black uppercase px-1 py-0.2 rounded-xs bg-[#18231C] text-[#FDB813]"
                          title="Turno modificado manualmente para esta fecha"
                        >
                          Esp
                        </span>
                      )}
                      {isVacation && <Palmtree className="w-3 h-3 text-emerald-700" />}
                    </div>
                  </div>

                  <div className="space-y-1 w-full overflow-hidden">
                    <div
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs border truncate flex items-center gap-1"
                      style={{
                        backgroundColor: isVacation
                          ? '#ECFDF5'
                          : isOff
                            ? '#F3F4F6'
                            : `${color}15`,
                        borderColor: isVacation
                          ? '#A7F3D0'
                          : isOff
                            ? '#D1D5DB'
                            : `${color}55`,
                        color: isVacation ? '#065F46' : isOff ? '#4B5563' : color,
                      }}
                      title={effectiveBranch}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{effectiveBranch}</span>
                    </div>

                    {!isVacation && !isOff && entry.startTime && (
                      <div className="text-[10px] font-mono font-semibold text-[#4A453F] tabular-nums truncate pl-0.5">
                        {entry.startTime} - {entry.endTime || ''}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Day Detail & Editor (CRM Agenda style) */}
        <div className="bg-white rounded-xs border border-[#DCD4C9] flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#DCD4C9] bg-[#18231C] text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-[#FDB813] font-bold block">
                Detalle del Día
              </span>
              <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider mt-0.5 truncate">
                {selectedDateStr === todayStr
                  ? `Hoy · ${formatReadableDateEs(selectedDateStr)}`
                  : formatReadableDateEs(selectedDateStr)}
              </h4>
            </div>
            <CalendarIcon className="w-4 h-4 text-[#FDB813] shrink-0" />
          </div>

          <div className="p-3.5 flex-1 bg-[#FAF8F5] space-y-3.5 overflow-y-auto text-xs">
            {/* Day Summary Card */}
            {(() => {
              const isVac = selectedDayResolved.source === 'vacation';
              const isOff = selectedDayResolved.entry.isOffDay;
              const label = isVac ? 'Vacaciones' : selectedDayResolved.entry.branch;
              const col = isVac
                ? '#059669'
                : getBranchColor(label, config.branchColors, configuredBranches);
              const sourceLabel =
                selectedDayResolved.source === 'vacation'
                  ? 'Período de vacaciones'
                  : selectedDayResolved.source === 'override'
                    ? 'Asignación puntual del día'
                    : selectedDayResolved.source === 'weekly'
                      ? 'Por plantilla semanal'
                      : 'Por sucursal base';

              return (
                <div
                  className="bg-white p-3 rounded-sm border border-[#DCD4C9] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860]">
                      {sourceLabel}
                    </span>
                    {editable && selectedDayResolved.source === 'override' && (
                      <button
                        type="button"
                        onClick={() => clearOverrideForDate(selectedDateStr)}
                        className="text-[10px] font-bold text-[#B9522F] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Quitar cambio</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm flex items-center gap-1.5" style={{ color: col }}>
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                        style={{ backgroundColor: col }}
                      />
                      <span>{label}</span>
                    </span>
                    {!isVac && !isOff && (
                      <span className="font-mono font-bold text-xs text-[#18231C] bg-[#FAF8F5] px-2 py-0.5 border border-[#DCD4C9] rounded-xs tabular-nums">
                        {selectedDayResolved.entry.startTime} - {selectedDayResolved.entry.endTime} hs
                      </span>
                    )}
                  </div>

                  {selectedDayResolved.vacationNote && (
                    <p className="text-[11px] text-emerald-800">{selectedDayResolved.vacationNote}</p>
                  )}

                  {selectedDayBranchObj && (
                    <div className="pt-1.5 border-t border-[#ECE5DC] text-[11px] text-[#6F6860]">
                      <span className="font-bold text-[#18231C]">Horario de apertura del local: </span>
                      <span>
                        {selectedDayBranchObj.openingHours || selectedDayBranchObj.hours || 'Sin especificar'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Edit Controls when in Panel de Control */}
            {editable && (
              <div className="bg-white p-3.5 rounded-xs border border-[#DCD4C9] space-y-3">
                <div className="flex items-center justify-between border-b border-[#ECE5DC] pb-2">
                  <span className="font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Asignar Turno / Sucursal</span>
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">
                    Sucursal / Estado
                  </label>
                  <select
                    value={brushBranch}
                    onChange={(e) => {
                      const nextB = e.target.value;
                      setBrushBranch(nextB);
                      const bObj = findConfiguredBranch(nextB, configuredBranches);
                      if (bObj) {
                        const parsed = parseBranchOpeningHours(bObj);
                        setBrushStart(parsed.fullShift.start);
                        setBrushEnd(parsed.fullShift.end);
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] cursor-pointer outline-none"
                  >
                    {branchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="Franco">Franco / Descanso</option>
                  </select>
                </div>

                {brushBranch !== 'Franco' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">
                          Ingreso
                        </label>
                        <input
                          type="time"
                          value={brushStart}
                          onChange={(e) => setBrushStart(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono tabular-nums outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">
                          Salida
                        </label>
                        <input
                          type="time"
                          value={brushEnd}
                          onChange={(e) => setBrushEnd(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono tabular-nums outline-none"
                        />
                      </div>
                    </div>

                    {selectedBrushBranchObj && selectedBrushParsed && (
                      <div className="p-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1.5">
                        <div className="text-[10px] text-[#6F6860]">
                          <strong className="text-[#18231C]">Franjas de {selectedBrushBranchObj.name}:</strong>{' '}
                          {selectedBrushParsed.rawText}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {selectedBrushParsed.morningShift && (
                            <button
                              type="button"
                              onClick={() => {
                                setBrushStart(selectedBrushParsed.morningShift!.start);
                                setBrushEnd(selectedBrushParsed.morningShift!.end);
                              }}
                              className="px-2 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                            >
                              Mañana {selectedBrushParsed.morningShift.start}-{selectedBrushParsed.morningShift.end}
                            </button>
                          )}
                          {selectedBrushParsed.afternoonShift && (
                            <button
                              type="button"
                              onClick={() => {
                                setBrushStart(selectedBrushParsed.afternoonShift!.start);
                                setBrushEnd(selectedBrushParsed.afternoonShift!.end);
                              }}
                              className="px-2 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                            >
                              Tarde {selectedBrushParsed.afternoonShift.start}-{selectedBrushParsed.afternoonShift.end}
                            </button>
                          )}
                          {selectedBrushParsed.saturdayShift && (
                            <button
                              type="button"
                              onClick={() => {
                                setBrushStart(selectedBrushParsed.saturdayShift!.start);
                                setBrushEnd(selectedBrushParsed.saturdayShift!.end);
                              }}
                              className="px-2 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                            >
                              Sáb {selectedBrushParsed.saturdayShift.start}-{selectedBrushParsed.saturdayShift.end}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => applyShiftToDate(selectedDateStr)}
                    className="w-full py-2 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-[#18231C]" />
                    <span>Aplicar solo al {selectedDateStr}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShiftToWeekday(selectedDayWeekdayKey)}
                    className="w-full py-2 px-3 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Aplicar a todos los {WEEKDAY_FULL_ES[selectedDayWeekdayKey] || selectedDayWeekdayKey}</span>
                  </button>
                  {selectedBrushBranchObj && brushBranch !== 'Franco' && (
                    <button
                      type="button"
                      onClick={() => handleApplyBranchScheduleToWeek('full')}
                      className="w-full py-1.5 px-3 bg-[#FAF8F5] hover:bg-neutral-100 border border-[#DCD4C9] text-[#18231C] rounded-xs text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3 text-[#B9522F]" />
                      <span>Usar semana tipo de {selectedBrushBranchObj.name}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetMonthOverrides}
                    className="w-full py-1.5 px-3 bg-white hover:bg-red-50 border border-[#DCD4C9] text-[#6F6860] hover:text-red-700 rounded-xs text-[10px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpiar cambios puntuales de {MONTH_NAMES[month]}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Compact Weekly Template Overview */}
            <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860]">
                {editable
                  ? 'Semana habitual (clic en un día para asignarle el local elegido)'
                  : 'Tu semana habitual'}
              </div>
              <div className="space-y-1">
                {WEEKDAY_MON_FIRST.map((dayKey) => {
                  const weeklyEntry = legajo.weeklySchedule?.[dayKey];
                  const defaultBranch = resolveConfiguredBranchName(
                    legajo.assignedBranch,
                    configuredBranches,
                    true
                  );
                  const isDefaultWork = (
                    legajo.workDays || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                  ).includes(dayKey);
                  const resolvedBranch = weeklyEntry
                    ? resolveConfiguredBranchName(weeklyEntry.branch, configuredBranches, true)
                    : isDefaultWork
                      ? defaultBranch
                      : 'Franco';
                  const resolvedStart = weeklyEntry?.startTime || legajo.scheduledStart || '08:30';
                  const resolvedEnd = weeklyEntry?.endTime || legajo.scheduledEnd || '17:30';
                  const isOff = resolvedBranch === 'Franco' || weeklyEntry?.isOffDay;
                  const color = getBranchColor(resolvedBranch, config.branchColors, configuredBranches);

                  const RowTag = editable ? 'button' : 'div';
                  return (
                    <RowTag
                      key={dayKey}
                      {...(editable
                        ? {
                            type: 'button' as const,
                            onClick: () => applyShiftToWeekday(dayKey),
                            title: `Clic para asignar ${brushBranch} a todos los ${WEEKDAY_FULL_ES[dayKey]}`,
                          }
                        : {})}
                      className={`w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between gap-2 text-[11px] ${
                        editable ? 'hover:bg-white cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-black text-[#18231C] uppercase w-7 shrink-0">
                          {dayKey}
                        </span>
                        <span className="font-bold truncate" style={{ color }}>
                          {isOff ? 'Franco' : resolvedBranch}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#4A453F] tabular-nums shrink-0">
                        {isOff ? '—' : `${resolvedStart}-${resolvedEnd}`}
                      </span>
                    </RowTag>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
