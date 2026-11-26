import { BranchLocation, RRHHEmployeeRecord, RRHHScheduleEntry } from '../types';

export const DEFAULT_UNIFIED_BRANCH_NAMES = [
  'Pampero Ciudad de Mendoza',
  'Pampero Luján de Cuyo',
  'Pampero Maipú',
] as const;

const FALLBACK_BRANCHES: BranchLocation[] = [
  {
    id: 'mza-ciudad',
    name: 'Pampero Ciudad de Mendoza',
    address: 'San Martín 477',
    zone: 'Ciudad de Mendoza',
    phone: '261 527-6713',
    openingHours: 'Lunes a Viernes 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30',
  },
  {
    id: 'mza-lujan',
    name: 'Pampero Luján de Cuyo',
    address: 'Patricios 384',
    zone: 'Luján de Cuyo',
    phone: '261 527-6713',
    openingHours: 'Lunes a Viernes 08:30 a 12:30 y 16:30 a 20:30, Sábados 09:00 a 13:00',
  },
  {
    id: 'mza-maipu',
    name: 'Pampero Maipú',
    address: 'Pescara 250',
    zone: 'Maipú',
    phone: '261 527-6713',
    openingHours: 'Lunes a Viernes 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30',
  },
];

function stripAccents(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function normalizeBranchKey(raw?: string): string {
  return stripAccents(raw || '')
    .replace(/pampero/g, '')
    .replace(/\bde\s+mendoza\b/g, '')
    .replace(/\bde\s+cuyo\b/g, '')
    .replace(/\bgran\s+mendoza\b/g, '')
    .replace(/\bsucursal\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function branchMatches(recordBranch?: string, targetBranch?: string): boolean {
  const target = (targetBranch || '').trim();
  if (!target || ['todas', 'todos', 'all'].includes(target.toLowerCase())) return true;
  const a = normalizeBranchKey(recordBranch);
  const b = normalizeBranchKey(target);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function normalizeKnownCase(rawName: string): string {
  const key = normalizeBranchKey(rawName);
  if (key === 'maipu') return 'Pampero Maipú';
  if (key === 'ciudad' || key === 'mendoza' || key === 'capital') return 'Pampero Ciudad de Mendoza';
  if (key === 'lujan') return 'Pampero Luján de Cuyo';
  return rawName.trim();
}

export function getConfiguredBranchList(branches?: BranchLocation[]): BranchLocation[] {
  const source = Array.isArray(branches) && branches.length > 0 ? branches : FALLBACK_BRANCHES;
  const seen = new Set<string>();
  const unique: BranchLocation[] = [];

  source.forEach((b) => {
    const rawName = (b.name || (b as any).branchName || b.zone || '').trim();
    if (!rawName) return;
    const cleanName = normalizeKnownCase(rawName);
    const key = normalizeBranchKey(cleanName) || stripAccents(cleanName);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ ...b, name: cleanName });
  });

  return unique.length > 0 ? unique : FALLBACK_BRANCHES;
}

export function getConfiguredBranchNames(branches?: BranchLocation[]): string[] {
  return getConfiguredBranchList(branches).map((b) => b.name);
}

/**
 * Mapea nombres heredados ('Maipú', 'Ciudad', 'Luján', 'PAMPERO MAIPU') al nombre exacto cargado en Sucursales
 * sin duplicar sucursales en listas ni leyendas.
 */
export function resolveConfiguredBranchName(
  rawName: string | undefined,
  branches?: BranchLocation[],
  allowTodas = true
): string {
  const list = getConfiguredBranchList(branches);
  const trimmed = (rawName || '').trim();
  if (!trimmed) return list[0]?.name || 'Pampero Maipú';

  const norm = stripAccents(trimmed);
  if (norm === 'franco' || norm === 'vacaciones') return trimmed;
  if (norm === 'todas' || norm === 'todos') {
    return allowTodas ? 'Todas' : list[0]?.name || 'Pampero Maipú';
  }

  // 1. Coincidencia exacta ignorando mayúsculas/acentos
  const exact = list.find((b) => stripAccents(b.name) === norm);
  if (exact) return exact.name;

  // 2. Coincidencia por clave normalizada de sucursal
  const rawKey = normalizeBranchKey(trimmed);
  if (rawKey) {
    const byKey = list.find((b) => {
      const bKey = normalizeBranchKey(b.name) || normalizeBranchKey(b.zone || b.city);
      return bKey === rawKey || bKey.includes(rawKey) || rawKey.includes(bKey);
    });
    if (byKey) return byKey.name;
  }

  // 3. Coincidencia por palabra clave o inclusión (ej: "Maipú" -> "Pampero Maipú")
  const tokens = norm
    .replace(/^pampero\s+/i, '')
    .split(/\s+/)
    .filter((t) => t.length >= 4);

  const partial = list.find((b) => {
    const bNorm = stripAccents(b.name);
    const zNorm = stripAccents(b.zone || b.city || '');
    if (bNorm.includes(norm) || norm.includes(bNorm)) return true;
    return tokens.some((tok) => bNorm.includes(tok) || zNorm.includes(tok));
  });

  if (partial) return partial.name;
  return trimmed;
}

export function findConfiguredBranch(
  branchName: string | undefined,
  branches?: BranchLocation[]
): BranchLocation | undefined {
  const list = getConfiguredBranchList(branches);
  const resolved = resolveConfiguredBranchName(branchName, list, true);
  return list.find((b) => stripAccents(b.name) === stripAccents(resolved));
}

export interface ParsedBranchSchedule {
  rawText: string;
  openDays: string[]; // ej: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  morningShift?: { start: string; end: string };
  afternoonShift?: { start: string; end: string };
  fullShift: { start: string; end: string };
  saturdayShift?: { start: string; end: string };
  sundayShift?: { start: string; end: string };
}

function padHHMM(h: string, m: string): string {
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
}

function extractTimeRanges(text: string): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];
  const regex = /(\d{1,2})[:.](\d{2})\s*(?:a|hasta|-|–)\s*(\d{1,2})[:.](\d{2})/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    ranges.push({
      start: padHHMM(match[1], match[2]),
      end: padHHMM(match[3], match[4]),
    });
  }
  return ranges;
}

export function parseBranchOpeningHours(branch?: BranchLocation): ParsedBranchSchedule {
  const rawText =
    branch?.openingHours?.trim() ||
    branch?.hours?.trim() ||
    'Lunes a Viernes de 08:30 a 13:00 y 16:30 a 20:30, Sábados 09:00 a 13:30';

  const norm = stripAccents(rawText);
  const openDays: string[] = [];

  if (norm.includes('lunes a sabado')) {
    openDays.push('Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb');
  } else if (norm.includes('lunes a domingo')) {
    openDays.push('Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom');
  } else {
    if (norm.includes('lunes') || norm.includes('lun')) openDays.push('Lun', 'Mar', 'Mié', 'Jue', 'Vie');
    if (norm.includes('sabado') || norm.includes('sab')) {
      if (!openDays.includes('Sáb')) openDays.push('Sáb');
    }
    if (norm.includes('domingo') && !norm.includes('cerrado')) {
      if (!openDays.includes('Dom')) openDays.push('Dom');
    }
  }
  if (openDays.length === 0) {
    openDays.push('Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb');
  }

  // Separar parte de semana vs sábado
  const satSplit = rawText.split(/s[aá]bados?/i);
  const weekdayPart = satSplit[0] || rawText;
  const satPart = satSplit[1] || '';

  const weekdayRanges = extractTimeRanges(weekdayPart);
  const satRanges = extractTimeRanges(satPart);

  let morningShift: { start: string; end: string } | undefined;
  let afternoonShift: { start: string; end: string } | undefined;
  let fullShift = { start: '08:30', end: '20:30' };

  if (weekdayRanges.length >= 2) {
    morningShift = weekdayRanges[0];
    afternoonShift = weekdayRanges[1];
    fullShift = {
      start: weekdayRanges[0].start,
      end: weekdayRanges[weekdayRanges.length - 1].end,
    };
  } else if (weekdayRanges.length === 1) {
    morningShift = weekdayRanges[0];
    fullShift = weekdayRanges[0];
  }

  const saturdayShift =
    satRanges.length > 0
      ? { start: satRanges[0].start, end: satRanges[satRanges.length - 1].end }
      : openDays.includes('Sáb')
        ? { start: '09:00', end: '13:30' }
        : undefined;

  return {
    rawText,
    openDays,
    morningShift,
    afternoonShift,
    fullShift,
    saturdayShift,
  };
}

export function buildWeeklyScheduleFromBranch(
  branch: BranchLocation,
  mode: 'full' | 'morning' | 'afternoon' = 'full'
): {
  weeklySchedule: Record<string, RRHHScheduleEntry>;
  workDays: string[];
  scheduledStart: string;
  scheduledEnd: string;
} {
  const parsed = parseBranchOpeningHours(branch);
  const weekdayShift =
    mode === 'morning' && parsed.morningShift
      ? parsed.morningShift
      : mode === 'afternoon' && parsed.afternoonShift
        ? parsed.afternoonShift
        : parsed.fullShift;

  const weeklySchedule: Record<string, RRHHScheduleEntry> = {};
  const allDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  allDays.forEach((d) => {
    if (!parsed.openDays.includes(d)) {
      weeklySchedule[d] = { branch: 'Franco', isOffDay: true };
    } else if (d === 'Sáb' && parsed.saturdayShift) {
      weeklySchedule[d] = {
        branch: branch.name,
        startTime: parsed.saturdayShift.start,
        endTime: parsed.saturdayShift.end,
        isOffDay: false,
      };
    } else {
      weeklySchedule[d] = {
        branch: branch.name,
        startTime: weekdayShift.start,
        endTime: weekdayShift.end,
        isOffDay: false,
      };
    }
  });

  return {
    weeklySchedule,
    workDays: parsed.openDays,
    scheduledStart: weekdayShift.start,
    scheduledEnd: weekdayShift.end,
  };
}

export function normalizeLegajoBranch(
  legajo: RRHHEmployeeRecord,
  branches?: BranchLocation[]
): RRHHEmployeeRecord {
  const resolvedBase = resolveConfiguredBranchName(legajo.assignedBranch, branches, true);
  return {
    ...legajo,
    assignedBranch: resolvedBase,
  };
}
