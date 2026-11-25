import React, { useMemo, useState } from 'react';
import {
  CRMExpense,
  CRMSale,
  ExpenseInvoiceRecord,
  FinancialCheckRecord,
  PettyCashMovement,
} from '../../types';
import { PieChart as PieChartIcon, BarChart3, TrendingUp } from 'lucide-react';
import { fixUtf8Encoding } from '../../utils/encodingUtils';

interface CostsChartsSectionProps {
  sales: CRMSale[];
  expenses: CRMExpense[];
  invoices: ExpenseInvoiceRecord[];
  checks: FinancialCheckRecord[];
  pettyCash: PettyCashMovement[];
  branchOptions: string[];
  selectedMonth: string; // YYYY-MM or ''
  selectedBranch: string; // 'todas' or branch name
}

const SLICE_COLORS = [
  '#18231C',
  '#B9522F',
  '#2563EB',
  '#D97706',
  '#059669',
  '#7C3AED',
  '#64748B',
];

const formatARS = (val: number): string =>
  `$ ${Math.round(Number(val) || 0).toLocaleString('es-AR')}`;

const formatCompactARS = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
};

const normalizeBranch = (raw: string): string =>
  (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/pampero/g, '')
    .replace(/\bde\s+mendoza\b/g, '')
    .replace(/\bde\s+cuyo\b/g, '')
    .replace(/\bgran\s+mendoza\b/g, '')
    .replace(/\bsucursal\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const branchMatches = (recordBranch: string | undefined, targetBranch: string): boolean => {
  if (targetBranch === 'todas') return true;
  const a = normalizeBranch(recordBranch || '');
  const b = normalizeBranch(targetBranch);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const CostsChartsSection: React.FC<CostsChartsSectionProps> = ({
  sales,
  expenses,
  invoices,
  checks,
  pettyCash,
  branchOptions,
  selectedMonth,
  selectedBranch,
}) => {
  const [pieMode, setPieMode] = useState<'category' | 'type'>('category');
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [rightBarMode, setRightBarMode] = useState<'branches' | 'cashflow30'>('branches');

  const todayIso = new Date().toISOString().split('T')[0];

  // --- 1. PIE / DONUT DATA ---
  const pieData = useMemo(() => {
    const matchMonth = (d?: string) => !selectedMonth || (d || '').startsWith(selectedMonth);
    const filteredExp = expenses.filter((e) => matchMonth(e.date) && branchMatches(e.branch, selectedBranch));

    // Also include unpaid or paid invoices in the selected period that aren't already synced as CRMExpense
    const linkedIds = new Set(invoices.map((i) => i.linkedExpenseId).filter(Boolean));
    const additionalInvoices = invoices.filter(
      (i) =>
        i.status !== 'anulada' &&
        !i.linkedExpenseId &&
        matchMonth(i.paidDate || i.issueDate) &&
        branchMatches(i.branch, selectedBranch)
    );

    const map = new Map<string, number>();

    if (pieMode === 'type') {
      let fixed = 0;
      let variable = 0;
      filteredExp.forEach((e) => {
        const amt = Number(e.amount) || 0;
        if (e.type === 'Fijo') fixed += amt;
        else variable += amt;
      });
      additionalInvoices.forEach((inv) => {
        const amt = Number(inv.amount) || 0;
        if (inv.costType === 'Fijo') fixed += amt;
        else variable += amt;
      });
      if (fixed > 0) map.set('Costos Fijos', fixed);
      if (variable > 0) map.set('Costos Variables', variable);
    } else {
      filteredExp.forEach((e) => {
        if (linkedIds.has(e.id) || e.category) {
          const cat = fixUtf8Encoding(e.category || 'Otros Gastos');
          map.set(cat, (map.get(cat) || 0) + (Number(e.amount) || 0));
        }
      });
      additionalInvoices.forEach((inv) => {
        const cat = fixUtf8Encoding(inv.category || 'Facturas sin vincular');
        map.set(cat, (map.get(cat) || 0) + (Number(inv.amount) || 0));
      });
    }

    const sorted = Array.from(map.entries())
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);

    // Group tail categories beyond top 6 into "Otros"
    const consolidated: Array<{ label: string; value: number; color: string }> = [];
    let otherSum = 0;
    sorted.forEach(([label, val], idx) => {
      if (idx < 6) {
        consolidated.push({
          label,
          value: val,
          color: SLICE_COLORS[idx % SLICE_COLORS.length],
        });
      } else {
        otherSum += val;
      }
    });
    if (otherSum > 0) {
      consolidated.push({
        label: 'Otros rubros',
        value: otherSum,
        color: SLICE_COLORS[6],
      });
    }

    const total = consolidated.reduce((acc, s) => acc + s.value, 0);
    let currentAngle = -90;
    const slices = consolidated.map((item) => {
      const pct = total > 0 ? (item.value / total) * 100 : 0;
      const sweep = (pct / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      currentAngle = endAngle;
      return {
        ...item,
        pct: Math.round(pct * 10) / 10,
        startAngle,
        endAngle,
      };
    });

    return { total, slices };
  }, [expenses, invoices, selectedMonth, selectedBranch, pieMode]);

  // Helper to build SVG Donut Arc path
  const describeArc = (cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) => {
    const safeEnd = endDeg - startDeg >= 359.99 ? startDeg + 359.99 : endDeg;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + rOuter * Math.cos(toRad(startDeg));
    const y1 = cy + rOuter * Math.sin(toRad(startDeg));
    const x2 = cx + rOuter * Math.cos(toRad(safeEnd));
    const y2 = cy + rOuter * Math.sin(toRad(safeEnd));
    const x3 = cx + rInner * Math.cos(toRad(safeEnd));
    const y3 = cy + rInner * Math.sin(toRad(safeEnd));
    const x4 = cx + rInner * Math.cos(toRad(startDeg));
    const y4 = cy + rInner * Math.sin(toRad(startDeg));
    const largeArc = safeEnd - startDeg > 180 ? 1 : 0;
    return [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
  };

  // --- 2. MONTHLY BAR CHART (LAST 6 MONTHS) ---
  const monthlySeries = useMemo(() => {
    const baseDate = selectedMonth ? new Date(`${selectedMonth}-01T12:00:00`) : new Date();
    const months: Array<{ ym: string; label: string; sales: number; costs: number; net: number }> = [];

    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - offset, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;

      const mSales = sales
        .filter((s) => (s.date || '').startsWith(ym) && branchMatches(s.branch, selectedBranch))
        .reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);

      const mCosts = expenses
        .filter((e) => (e.date || '').startsWith(ym) && branchMatches(e.branch, selectedBranch))
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      months.push({
        ym,
        label,
        sales: mSales,
        costs: mCosts,
        net: mSales - mCosts,
      });
    }

    const maxValue = Math.max(1000, ...months.flatMap((m) => [m.sales, m.costs]));
    return { months, maxValue };
  }, [sales, expenses, selectedMonth, selectedBranch]);

  // --- 3. BRANCH COMPARISON & 30-DAY CASHFLOW BARS ---
  const branchBars = useMemo(() => {
    const matchMonth = (d?: string) => !selectedMonth || (d || '').startsWith(selectedMonth);
    const rows = branchOptions.map((bName) => {
      const bSales = sales
        .filter((s) => matchMonth(s.date) && branchMatches(s.branch, bName))
        .reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);
      const bCosts = expenses
        .filter((e) => matchMonth(e.date) && branchMatches(e.branch, bName))
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const bPc = pettyCash
        .filter((m) => branchMatches(m.branch, bName))
        .reduce((acc, m) => acc + (m.movementType === 'ingreso' ? Number(m.amount) || 0 : -(Number(m.amount) || 0)), 0);
      return { branch: bName, sales: bSales, costs: bCosts, pettyCash: Math.max(0, bPc) };
    });
    const maxValue = Math.max(1000, ...rows.flatMap((r) => [r.sales, r.costs, r.pettyCash]));
    return { rows, maxValue };
  }, [sales, expenses, pettyCash, branchOptions, selectedMonth]);

  const cashflow30Buckets = useMemo(() => {
    const now = new Date(`${todayIso}T00:00:00`);
    const dayDiff = (targetIso: string) => {
      const t = new Date(`${targetIso}T00:00:00`);
      return Math.round((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    const buckets = [
      { key: 'overdue', label: 'Vencido', inflows: 0, outflows: 0 },
      { key: 'd1_7', label: '0–7 días', inflows: 0, outflows: 0 },
      { key: 'd8_15', label: '8–15 días', inflows: 0, outflows: 0 },
      { key: 'd16_30', label: '16–30 días', inflows: 0, outflows: 0 },
    ];

    const addToBucket = (days: number, type: 'inflows' | 'outflows', amt: number) => {
      if (days < 0) buckets[0][type] += amt;
      else if (days <= 7) buckets[1][type] += amt;
      else if (days <= 15) buckets[2][type] += amt;
      else if (days <= 30) buckets[3][type] += amt;
    };

    checks
      .filter((c) => branchMatches(c.branch, selectedBranch))
      .forEach((c) => {
        if (!c.dueDate) return;
        const diff = dayDiff(c.dueDate);
        if (diff > 30) return;
        const amt = Number(c.amount) || 0;
        if (c.direction === 'recibido' && (c.status === 'en_cartera' || c.status === 'depositado')) {
          addToBucket(diff, 'inflows', amt);
        } else if (c.direction === 'emitido' && c.status === 'pendiente_debito') {
          addToBucket(diff, 'outflows', amt);
        }
      });

    invoices
      .filter((i) => i.status === 'pendiente' && branchMatches(i.branch, selectedBranch))
      .forEach((i) => {
        if (!i.dueDate) return;
        const diff = dayDiff(i.dueDate);
        if (diff > 30) return;
        addToBucket(diff, 'outflows', Number(i.amount) || 0);
      });

    const maxValue = Math.max(1000, ...buckets.flatMap((b) => [b.inflows, b.outflows]));
    return { buckets, maxValue };
  }, [checks, invoices, selectedBranch, todayIso]);

  const activeSlice = hoveredSliceIdx !== null ? pieData.slices[hoveredSliceIdx] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. GRÁFICO DE TORTA / DONUT: DISTRIBUCIÓN DE GASTOS */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-[#18231C]" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                Distribución de Costos
              </h4>
              <span className="text-[10px] text-[#6F6860] block">
                {selectedMonth ? `Período ${selectedMonth}` : 'Acumulado histórico'}
              </span>
            </div>
          </div>

          <div className="flex items-center bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => {
                setPieMode('category');
                setHoveredSliceIdx(null);
              }}
              className={`px-2 py-1 rounded-xs cursor-pointer transition-colors ${
                pieMode === 'category' ? 'bg-[#18231C] text-white' : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              Rubros
            </button>
            <button
              type="button"
              onClick={() => {
                setPieMode('type');
                setHoveredSliceIdx(null);
              }}
              className={`px-2 py-1 rounded-xs cursor-pointer transition-colors ${
                pieMode === 'type' ? 'bg-[#18231C] text-white' : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              Fijo/Var
            </button>
          </div>
        </div>

        {pieData.total === 0 ? (
          <div className="py-10 text-center text-xs text-[#6F6860]">
            Sin gastos ni facturas registradas para graficar en este filtro.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
            <div className="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 180 180" className="w-full h-full">
                {pieData.slices.map((slice, idx) => {
                  const isHovered = hoveredSliceIdx === idx;
                  return (
                    <path
                      key={slice.label}
                      d={describeArc(
                        90,
                        90,
                        isHovered ? 82 : 76,
                        46,
                        slice.startAngle,
                        slice.endAngle
                      )}
                      fill={slice.color}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredSliceIdx(idx)}
                      onMouseLeave={() => setHoveredSliceIdx(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#6F6860] truncate max-w-[82px]">
                  {activeSlice ? activeSlice.label : 'Total Costos'}
                </span>
                <span className="text-xs font-bold font-mono tabular-nums text-[#18231C]">
                  {formatCompactARS(activeSlice ? activeSlice.value : pieData.total)}
                </span>
                {activeSlice && (
                  <span className="text-[10px] font-mono font-bold text-[#B9522F]">
                    {activeSlice.pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 w-full space-y-1.5 min-w-0">
              {pieData.slices.map((slice, idx) => (
                <div
                  key={slice.label}
                  onMouseEnter={() => setHoveredSliceIdx(idx)}
                  onMouseLeave={() => setHoveredSliceIdx(null)}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded-xs text-[11px] cursor-pointer transition-colors ${
                    hoveredSliceIdx === idx ? 'bg-[#FAF8F5]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate font-semibold text-[#18231C]">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                    <span className="text-[#6F6860]">{slice.pct}%</span>
                    <span className="font-bold text-[#18231C]">{formatCompactARS(slice.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. GRÁFICO DE BARRAS: VENTAS VS COSTOS (ÚLTIMOS 6 MESES) */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#18231C]" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                Evolución Mensual (6 Meses)
              </h4>
              <span className="text-[10px] text-[#6F6860] block">
                Comparativa Ingresos vs Costos Totales
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-[#18231C]">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#059669] inline-block" /> Ventas
            </span>
            <span className="flex items-center gap-1 text-[#18231C]">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#B9522F] inline-block" /> Costos
            </span>
          </div>
        </div>

        <div className="relative pt-2">
          {/* Hover Summary Line */}
          <div className="h-5 mb-2 flex items-center justify-between text-[11px] font-mono tabular-nums bg-[#FAF8F5] border border-[#ECE5DC] px-2.5 rounded-xs">
            {hoveredMonthIdx !== null ? (
              <>
                <span className="font-bold text-[#18231C]">
                  {monthlySeries.months[hoveredMonthIdx].label}
                </span>
                <span className="text-emerald-700 font-bold">
                  V: {formatARS(monthlySeries.months[hoveredMonthIdx].sales)}
                </span>
                <span className="text-[#B9522F] font-bold">
                  C: {formatARS(monthlySeries.months[hoveredMonthIdx].costs)}
                </span>
              </>
            ) : (
              <span className="text-[#6F6860] font-sans text-[10px]">
                Pasá el cursor sobre cada mes para ver el detalle exacto.
              </span>
            )}
          </div>

          {/* Paired Bar Chart */}
          <div className="h-40 flex items-end justify-between gap-2 border-b border-[#DCD4C9] pb-1 pt-3 px-1 relative">
            {/* Horizontal grid lines */}
            <div className="absolute inset-x-0 top-3 bottom-1 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-t border-dashed border-[#ECE5DC] w-full" />
              ))}
            </div>

            {monthlySeries.months.map((m, idx) => {
              const sHeight = Math.round((m.sales / monthlySeries.maxValue) * 100);
              const cHeight = Math.round((m.costs / monthlySeries.maxValue) * 100);
              return (
                <div
                  key={m.ym}
                  onMouseEnter={() => setHoveredMonthIdx(idx)}
                  onMouseLeave={() => setHoveredMonthIdx(null)}
                  className={`flex-1 h-full flex flex-col items-center justify-end gap-1 z-10 cursor-pointer rounded-xs px-0.5 transition-colors ${
                    hoveredMonthIdx === idx ? 'bg-[#FAF8F5]/90' : ''
                  }`}
                >
                  <div className="w-full flex-1 flex items-end justify-center gap-1">
                    <div
                      className="w-3 sm:w-3.5 bg-[#059669] rounded-t-xs transition-all duration-300"
                      style={{ height: `${m.sales > 0 ? Math.max(4, sHeight) : 2}%`, opacity: m.sales > 0 ? 1 : 0.25 }}
                      title={`Ventas ${m.label}: ${formatARS(m.sales)}`}
                    />
                    <div
                      className="w-3 sm:w-3.5 bg-[#B9522F] rounded-t-xs transition-all duration-300"
                      style={{ height: `${m.costs > 0 ? Math.max(4, cHeight) : 2}%`, opacity: m.costs > 0 ? 1 : 0.25 }}
                      title={`Costos ${m.label}: ${formatARS(m.costs)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
            {monthlySeries.months.map((m) => (
              <span
                key={m.ym}
                className="flex-1 text-center text-[10px] font-mono font-bold text-[#6F6860]"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO DE BARRAS: POR SUCURSAL O PROYECCIÓN VENCIMIENTOS 30D */}
      <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#18231C]" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                {rightBarMode === 'branches' ? 'Comparativa por Local' : 'Flujo Próximos 30 Días'}
              </h4>
              <span className="text-[10px] text-[#6F6860] block">
                {rightBarMode === 'branches'
                  ? 'Ventas, Costos y Caja Chica'
                  : 'Cheques a cobrar vs Facturas y Emitidos'}
              </span>
            </div>
          </div>

          <div className="flex items-center bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setRightBarMode('branches')}
              className={`px-2 py-1 rounded-xs cursor-pointer transition-colors ${
                rightBarMode === 'branches' ? 'bg-[#18231C] text-white' : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              Locales
            </button>
            <button
              type="button"
              onClick={() => setRightBarMode('cashflow30')}
              className={`px-2 py-1 rounded-xs cursor-pointer transition-colors ${
                rightBarMode === 'cashflow30' ? 'bg-[#18231C] text-white' : 'text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              Agenda 30d
            </button>
          </div>
        </div>

        {rightBarMode === 'branches' ? (
          <div className="space-y-3">
            {branchBars.rows.map((row) => (
              <div key={row.branch} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#18231C]">{row.branch}</span>
                  <span className="font-mono tabular-nums text-[10px] text-[#6F6860]">
                    Caja: <strong className="text-[#18231C]">{formatCompactARS(row.pettyCash)}</strong>
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[10px] font-semibold text-[#6F6860]">Ventas</span>
                    <div className="flex-1 h-2.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#059669] transition-all duration-300"
                        style={{
                          width: `${row.sales > 0 ? Math.max(3, (row.sales / branchBars.maxValue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono tabular-nums text-[10px] font-bold text-emerald-700">
                      {formatCompactARS(row.sales)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[10px] font-semibold text-[#6F6860]">Costos</span>
                    <div className="flex-1 h-2.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#B9522F] transition-all duration-300"
                        style={{
                          width: `${row.costs > 0 ? Math.max(3, (row.costs / branchBars.maxValue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono tabular-nums text-[10px] font-bold text-[#B9522F]">
                      {formatCompactARS(row.costs)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-end gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-[#18231C]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#059669] inline-block" /> Por Cobrar
              </span>
              <span className="flex items-center gap-1 text-[#18231C]">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" /> Por Pagar (Facturas + Cheques)
              </span>
            </div>

            {cashflow30Buckets.buckets.map((b) => (
              <div key={b.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-bold ${b.key === 'overdue' && b.outflows > 0 ? 'text-rose-700' : 'text-[#18231C]'}`}>
                    {b.label}
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-[#6F6860]">
                    Neto: <strong className={b.inflows - b.outflows >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {formatCompactARS(b.inflows - b.outflows)}
                    </strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-2.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#059669]"
                        style={{
                          width: `${b.inflows > 0 ? Math.max(4, (b.inflows / cashflow30Buckets.maxValue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[10px] font-bold text-emerald-700 w-12 text-right">
                      {formatCompactARS(b.inflows)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-2.5 bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-rose-600"
                        style={{
                          width: `${b.outflows > 0 ? Math.max(4, (b.outflows / cashflow30Buckets.maxValue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[10px] font-bold text-rose-700 w-12 text-right">
                      {formatCompactARS(b.outflows)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
