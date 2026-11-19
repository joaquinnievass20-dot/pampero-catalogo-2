import React, { useMemo, useState } from 'react';
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  Paintbrush,
  Palmtree,
  RotateCcw,
  Wand2,
} from 'lucide-react';

export const WEEKDAY_KEYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
export const WEEKDAY_MON_FIRST = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
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

interface RRHHScheduleCalendarProps {
  legajo: RRHHEmployeeRecord;
  config: RRHHModuleConfig;
  branches?: BranchLocation[];
  editable?: boolean;
  onUpdateLegajo?: (updated: RRHHEmployeeRecord) => void | Promise<void>;
  compact?: boolean;
}

export const RRHHScheduleCalendar: React.FC<RRHHScheduleCalendarProps> = ({
  legajo,
  config,
  branches = [],
  editable = false,
  onUpdateLegajo,
  compact = false,
}) => {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`
  );

  const configuredBranches = useMemo(() => getConfiguredBranchList(branches), [branches]);
  const branchNames = useMemo(
    () => configuredBranches.map((b) => b.name),
    [configuredBranches]
  );

  const initialBrushBranch = useMemo(() => {
    const resolved = resolveConfiguredBranchName(legajo.assignedBranch, configuredBranches, false);
    return branchNames.includes(resolved) ? resolved : branchNames[0] || 'Pampero Maipú';
  }, [legajo.assignedBranch, configuredBranches, branchNames]);

  // Brush state when editable
  const [brushMode, setBrushMode] = useState<'paint' | 'clear'>('paint');
  const [brushBranch, setBrushBranch] = useState<string>(initialBrushBranch);
  const [brushStart, setBrushStart] = useState<string>(legajo.scheduledStart || '08:30');
  const [brushEnd, setBrushEnd] = useState<string>(legajo.scheduledEnd || '17:30');

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const selectedBrushBranchObj = useMemo(
    () => findConfiguredBranch(brushBranch, configuredBranches),
    [brushBranch, configuredBranches]
  );
  const selectedBrushParsed = useMemo(
    () => (selectedBrushBranchObj ? parseBranchOpeningHours(selectedBrushBranchObj) : null),
    [selectedBrushBranchObj]
  );

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      resolved?: ReturnType<typeof resolveDayScheduleEntry>;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(
        2,
        '0'
      )}`;
      cells.push({
        dateStr,
        dayNum: d,
        resolved: resolveDayScheduleEntry(legajo, dateStr, configuredBranches),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null });
    }
    return cells;
  }, [year, month, legajo, configuredBranches]);

  const monthStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalMinutes = 0;
    calendarCells.forEach((cell) => {
      if (!cell.resolved) return;
      const b = cell.resolved.entry.branch || 'Franco';
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
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }, [calendarCells]);

  // Solo las sucursales cargadas en Sucursales + Franco (+ 'Todas' únicamente si hay días asignados como 'Todas')
  const legendBranches = useMemo(() => {
    const items = [...branchNames];
    if ((monthStats.counts['Todas'] || 0) > 0 && !items.includes('Todas')) {
      items.push('Todas');
    }
    items.push('Franco');
    return items;
  }, [branchNames, monthStats.counts]);

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

  const handleDayClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    if (!editable || !onUpdateLegajo) return;

    const currentOverrides = { ...(legajo.dateSchedules || {}) };
    if (brushMode === 'clear') {
      delete currentOverrides[dateStr];
    } else {
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
    }

    onUpdateLegajo({
      ...legajo,
      dateSchedules: currentOverrides,
    });
  };

  const handleWeekdayClick = (dayKey: string) => {
    if (!editable || !onUpdateLegajo) return;
    const currentWeekly = { ...(legajo.weeklySchedule || {}) };
    if (brushMode === 'clear') {
      delete currentWeekly[dayKey];
    } else {
      currentWeekly[dayKey] =
        brushBranch === 'Franco'
          ? { branch: 'Franco', isOffDay: true }
          : {
              branch: brushBranch,
              startTime: brushStart || '08:30',
              endTime: brushEnd || '17:30',
              isOffDay: false,
            };
    }

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

  return (
    <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
      {/* Header Month Controls */}
      <div className="px-4 py-3 bg-[#FAF8F5] border-b border-[#DCD4C9] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#B9522F]" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
            Calendario de Turnos y Locales · {MONTH_NAMES[month]} {year}
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[#18231C] cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleGoToday}
            className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[11px] font-bold uppercase text-[#18231C] cursor-pointer"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[#18231C] cursor-pointer"
            title="Mes siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editable Brush & Branch Schedule Sync Bar */}
      {editable && (
        <div className="p-3.5 bg-[#FAF8F5]/70 border-b border-[#DCD4C9] space-y-3 text-xs">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B9522F] mr-1 self-center">
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Asignar al hacer clic:</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-0.5">
                Sucursal / Estado
              </label>
              <select
                value={brushBranch}
                onChange={(e) => {
                  const nextB = e.target.value;
                  setBrushBranch(nextB);
                  setBrushMode('paint');
                  const bObj = findConfiguredBranch(nextB, configuredBranches);
                  if (bObj) {
                    const parsed = parseBranchOpeningHours(bObj);
                    setBrushStart(parsed.fullShift.start);
                    setBrushEnd(parsed.fullShift.end);
                  }
                }}
                className="px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] cursor-pointer outline-none"
              >
                {branchNames.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="Franco">Franco / Descanso</option>
              </select>
            </div>

            {brushBranch !== 'Franco' && brushMode === 'paint' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-0.5">
                    Ingreso
                  </label>
                  <input
                    type="time"
                    value={brushStart}
                    onChange={(e) => setBrushStart(e.target.value)}
                    className="px-2 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-0.5">
                    Salida
                  </label>
                  <input
                    type="time"
                    value={brushEnd}
                    onChange={(e) => setBrushEnd(e.target.value)}
                    className="px-2 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono tabular-nums outline-none"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setBrushMode((m) => (m === 'paint' ? 'clear' : 'paint'))}
              className={`px-2.5 py-1.5 rounded-xs border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                brushMode === 'clear'
                  ? 'bg-[#18231C] border-[#18231C] text-[#FDB813]'
                  : 'bg-white border-[#DCD4C9] text-[#4A453F] hover:bg-neutral-100'
              }`}
              title="Restablecer día al horario semanal base"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{brushMode === 'clear' ? 'Modo: Limpiar día' : 'Limpiar día'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetMonthOverrides}
              className="px-2.5 py-1.5 rounded-xs border border-[#DCD4C9] bg-white hover:bg-neutral-100 text-[11px] font-semibold text-[#6F6860] flex items-center gap-1 cursor-pointer"
              title="Quitar cambios manuales de este mes"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar mes</span>
            </button>
          </div>

          {/* Branch Opening Hours Reference + Quick Presets */}
          {selectedBrushBranchObj && selectedBrushParsed && brushBranch !== 'Franco' && (
            <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-[#4A453F]">
                <strong className="text-[#18231C]">{selectedBrushBranchObj.name} · Horario a cubrir: </strong>
                <span>{selectedBrushParsed.rawText}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedBrushParsed.morningShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrushMode('paint');
                      setBrushStart(selectedBrushParsed.morningShift!.start);
                      setBrushEnd(selectedBrushParsed.morningShift!.end);
                    }}
                    className="px-2 py-1 bg-[#FAF8F5] hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                  >
                    Mañana {selectedBrushParsed.morningShift.start}-{selectedBrushParsed.morningShift.end}
                  </button>
                )}
                {selectedBrushParsed.afternoonShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrushMode('paint');
                      setBrushStart(selectedBrushParsed.afternoonShift!.start);
                      setBrushEnd(selectedBrushParsed.afternoonShift!.end);
                    }}
                    className="px-2 py-1 bg-[#FAF8F5] hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                  >
                    Tarde {selectedBrushParsed.afternoonShift.start}-{selectedBrushParsed.afternoonShift.end}
                  </button>
                )}
                {selectedBrushParsed.saturdayShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrushMode('paint');
                      setBrushStart(selectedBrushParsed.saturdayShift!.start);
                      setBrushEnd(selectedBrushParsed.saturdayShift!.end);
                    }}
                    className="px-2 py-1 bg-[#FAF8F5] hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-[10px] font-mono font-bold text-[#18231C] cursor-pointer"
                  >
                    Sáb {selectedBrushParsed.saturdayShift.start}-{selectedBrushParsed.saturdayShift.end}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleApplyBranchScheduleToWeek('full')}
                  className="px-2.5 py-1 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  title="Rellena Lunes a Sábado según los horarios cargados en esa sucursal"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Aplicar días/horarios de {selectedBrushBranchObj.name}</span>
                </button>
              </div>
            </div>
          )}

          {/* Weekly Default Pattern Strip */}
          <div className="pt-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] mb-1.5">
              Plantilla Semanal Habitual (clic en un día para asignarle la sucursal y horario arriba elegido):
            </div>
            <div className="grid grid-cols-7 gap-1.5">
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

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => handleWeekdayClick(dayKey)}
                    className="p-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-left cursor-pointer transition-colors"
                    style={{ borderTopWidth: '3px', borderTopColor: color }}
                    title={`Clic para asignar ${
                      brushMode === 'clear' ? 'valor base' : brushBranch
                    } a todos los ${dayKey}`}
                  >
                    <div className="text-[10px] font-black text-[#18231C] uppercase">{dayKey}</div>
                    <div className="text-[10px] font-bold truncate" style={{ color }}>
                      {isOff ? 'Franco' : resolvedBranch}
                    </div>
                    {!isOff && (
                      <div className="text-[9px] font-mono text-[#6F6860] tabular-nums truncate">
                        {resolvedStart}-{resolvedEnd}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Color Legend & Month Totals */}
      <div className="px-4 py-2.5 bg-white border-b border-[#DCD4C9] flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          {legendBranches.map((b) => {
            const color = getBranchColor(b, config.branchColors, configuredBranches);
            const count = monthStats.counts[b] || 0;
            return (
              <span key={b} className="inline-flex items-center gap-1.5 font-semibold text-[#18231C]">
                <span
                  className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{b}</span>
                <span className="font-mono text-[#6F6860] tabular-nums">({count}d)</span>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
            <Palmtree className="w-3 h-3 text-emerald-600" />
            <span>Vacaciones</span>
            <span className="font-mono text-[#6F6860] tabular-nums">
              ({monthStats.counts['Vacaciones'] || 0}d)
            </span>
          </span>
        </div>
        <div className="font-mono font-bold text-[#18231C] tabular-nums">
          Total mes: {monthStats.totalHours} hs
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-3 bg-[#FAF8F5]/40">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_MON_FIRST.map((wd) => (
            <div
              key={wd}
              className="text-center text-[10px] font-black uppercase tracking-wider text-[#6F6860] py-1"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.dateStr || !cell.resolved) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={`${
                    compact ? 'min-h-[52px]' : 'min-h-[68px]'
                  } rounded-xs bg-neutral-100/50 border border-transparent`}
                />
              );
            }

            const { entry, source } = cell.resolved;
            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selectedDateStr;
            const isVacation = source === 'vacation';
            const isOff = entry.isOffDay || entry.branch === 'Franco';
            const color = isVacation
              ? '#059669'
              : getBranchColor(entry.branch, config.branchColors, configuredBranches);

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => handleDayClick(cell.dateStr!)}
                className={`${
                  compact ? 'min-h-[54px] p-1' : 'min-h-[70px] p-1.5'
                } rounded-xs border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#18231C] ring-1 ring-[#18231C] bg-white'
                    : isToday
                      ? 'border-[#B9522F] bg-white'
                      : 'border-[#DCD4C9] bg-white hover:border-[#18231C]/50'
                }`}
                style={{
                  borderTopWidth: '3px',
                  borderTopColor: color,
                  backgroundColor: isVacation
                    ? '#ECFDF5'
                    : isOff
                      ? '#F9FAFB'
                      : `${color}10`,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${
                      isToday ? 'text-[#B9522F]' : 'text-[#18231C]'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {source === 'override' && (
                    <span
                      className="text-[8px] font-black uppercase px-1 rounded-xs bg-[#18231C] text-[#FDB813]"
                      title="Turno modificado manualmente"
                    >
                      Esp
                    </span>
                  )}
                  {isVacation && <Palmtree className="w-3 h-3 text-emerald-700" />}
                </div>

                <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                  <div
                    className="text-[10px] font-extrabold truncate leading-tight"
                    style={{ color }}
                  >
                    {isVacation ? 'Vacaciones' : entry.branch}
                  </div>
                  {!isVacation && !isOff && entry.startTime && (
                    <div className="text-[9px] font-mono text-[#4A453F] tabular-nums truncate leading-tight">
                      {entry.startTime}-{entry.endTime || ''}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector */}
      <div className="px-4 py-2.5 bg-white border-t border-[#DCD4C9] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#B9522F]" />
          <span className="font-mono font-bold text-[#18231C]">{selectedDateStr}</span>
          <span className="text-[#6F6860]">·</span>
          {selectedDayResolved.source === 'vacation' ? (
            <span className="font-bold text-emerald-800">
              Vacaciones
              {selectedDayResolved.vacationNote
                ? ` (${selectedDayResolved.vacationNote})`
                : ''}
            </span>
          ) : selectedDayResolved.entry.isOffDay ? (
            <span className="font-bold text-neutral-600">Día Franco / Descanso</span>
          ) : (
            <span className="font-bold text-[#18231C] flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block"
                style={{
                  backgroundColor: getBranchColor(
                    selectedDayResolved.entry.branch,
                    config.branchColors,
                    configuredBranches
                  ),
                }}
              />
              <span>{selectedDayResolved.entry.branch}</span>
              <span className="font-mono text-[#B9522F] tabular-nums">
                ({selectedDayResolved.entry.startTime} - {selectedDayResolved.entry.endTime} hs)
              </span>
            </span>
          )}
        </div>
        {editable && (
          <span className="text-[10px] text-[#6F6860]">
            Hacé clic en cualquier día del calendario para pintar su sucursal y horario.
          </span>
        )}
      </div>
    </div>
  );
};
