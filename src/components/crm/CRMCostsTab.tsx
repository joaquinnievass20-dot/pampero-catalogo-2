import React, { useState, useEffect, useMemo } from 'react';
import { CRMExpense, ExpenseType, ExpenseCategory } from '../../types';
import { 
  saveCRMExpense, 
  deleteCRMExpense, 
  subscribeToCRMExpenses 
} from '../../services/firebase';
import { 
  DollarSign, 
  TrendingDown, 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Filter, 
  Calendar, 
  Check, 
  X, 
  AlertCircle,
  PieChart,
  ArrowUpRight,
  Receipt,
  Layers,
  Search
} from 'lucide-react';

interface CRMCostsTabProps {
  accentColor?: string;
}

export const BRANCH_OPTIONS = ['Maipú', 'Ciudad', 'Luján'];

export const CATEGORY_OPTIONS: ExpenseCategory[] = [
  'Alquiler',
  'Sueldos',
  'Impuestos',
  'Servicios (Luz/Gas/Agua/Internet)',
  'Mercadería e Insumos',
  'Logística y Envíos',
  'Marketing y Publicidad',
  'Mantenimiento',
  'Otros Gastos',
];

export const CRMCostsTab: React.FC<CRMCostsTabProps> = ({ accentColor = '#FDB813' }) => {
  // State for expenses - Loaded EXCLUSIVELY from Cloud Firestore via Firebase SDK
  const [expenses, setExpenses] = useState<CRMExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('todas');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('todos');
  const [searchDetail, setSearchDetail] = useState('');

  // Form state
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBranch, setFormBranch] = useState<string>('Maipú');
  const [formType, setFormType] = useState<ExpenseType>('Fijo');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Alquiler');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDetail, setFormDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Subscribe to Firebase Firestore collection 'crm_expenses' in real-time
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToCRMExpenses(
      (remoteExpenses) => {
        setExpenses(remoteExpenses);
        setIsLoading(false);
        setSyncError(null);
      },
      (err) => {
        console.error('[CRMCostsTab] Error en suscripción a crm_expenses:', err);
        setSyncError('No se pudo sincronizar en tiempo real con Firestore.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute available Month/Year options from data
  const monthYearOptions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.substring(0, 7)); // YYYY-MM
      }
    });
    // Add current month if not present
    const currentYM = new Date().toISOString().substring(0, 7);
    set.add(currentYM);
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const formatMonthYearLabel = (ym: string) => {
    if (ym === 'todos') return 'Todos los Meses';
    const [year, month] = ym.split('-');
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${months[mIdx] || month} ${year}`;
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchBranch = selectedBranch === 'todas' || item.branch.toLowerCase() === selectedBranch.toLowerCase();
      const matchMonth = selectedMonthYear === 'todos' || (item.date && item.date.startsWith(selectedMonthYear));
      const matchSearch = !searchDetail.trim() || 
        (item.detail || '').toLowerCase().includes(searchDetail.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchDetail.toLowerCase());
      return matchBranch && matchMonth && matchSearch;
    });
  }, [expenses, selectedBranch, selectedMonthYear, searchDetail]);

  // Dashboard KPI Calculations
  const metrics = useMemo(() => {
    let totalGeneral = 0;
    let totalMaipu = 0;
    let totalCiudad = 0;
    let totalLujan = 0;
    let totalFijos = 0;
    let totalVariables = 0;

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalGeneral += amt;

      const br = (exp.branch || '').toLowerCase();
      if (br.includes('maip')) totalMaipu += amt;
      else if (br.includes('ciudad')) totalCiudad += amt;
      else if (br.includes('luj')) totalLujan += amt;

      if (exp.type === 'Fijo') {
        totalFijos += amt;
      } else {
        totalVariables += amt;
      }
    });

    const percentFijos = totalGeneral > 0 ? Math.round((totalFijos / totalGeneral) * 100) : 0;
    const percentVariables = totalGeneral > 0 ? Math.round((totalVariables / totalGeneral) * 100) : 0;

    return {
      totalGeneral,
      totalMaipu,
      totalCiudad,
      totalLujan,
      totalFijos,
      totalVariables,
      percentFijos,
      percentVariables,
    };
  }, [filteredExpenses]);

  // Form submit: Save or update in Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedbackNotice({ type: 'error', message: 'Ingresá un monto numérico válido mayor a 0.' });
      return;
    }
    if (!formDetail.trim()) {
      setFeedbackNotice({ type: 'error', message: 'Ingresá un detalle o descripción del gasto.' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackNotice(null);

    try {
      const expenseData: CRMExpense = {
        id: isEditingId || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: formDate,
        branch: formBranch,
        type: formType,
        category: formCategory,
        amount: numAmount,
        detail: formDetail.trim(),
        updatedAt: new Date().toISOString(),
        createdAt: isEditingId 
          ? (expenses.find((x) => x.id === isEditingId)?.createdAt || new Date().toISOString())
          : new Date().toISOString(),
      };

      // Strict Firebase Firestore write
      await saveCRMExpense(expenseData);

      // Reset form
      if (isEditingId) {
        setIsEditingId(null);
        setFeedbackNotice({ type: 'success', message: '¡Gasto actualizado con éxito en Cloud Firestore!' });
      } else {
        setFormDetail('');
        setFormAmount('');
        setFeedbackNotice({ type: 'success', message: '¡Gasto registrado con éxito en Cloud Firestore!' });
      }

      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: any) {
      console.error('[CRMCostsTab] Error al guardar gasto:', err);
      setFeedbackNotice({ type: 'error', message: `Error al guardar: ${err.message || 'Error de conexión'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: CRMExpense) => {
    setIsEditingId(item.id);
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormBranch(item.branch || 'Maipú');
    setFormType(item.type || 'Fijo');
    setFormCategory(item.category as ExpenseCategory || 'Alquiler');
    setFormAmount(String(item.amount || ''));
    setFormDetail(item.detail || '');
    // Scroll to form on small screens
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditingId(null);
    setFormDetail('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
  };

  // Delete with try/catch and immediate visual update
  const handleDelete = async (id: string, detail: string) => {
    if (!confirm(`¿Eliminar el registro de gasto "${detail}"?`)) return;

    // Immediate optimistic local update
    const previousExpenses = [...expenses];
    setExpenses((prev) => prev.filter((item) => item.id !== id));

    try {
      // Cloud Firestore delete
      await deleteCRMExpense(id);
      setFeedbackNotice({ type: 'success', message: 'Gasto eliminado exitosamente de Firestore.' });
      setTimeout(() => setFeedbackNotice(null), 3000);
    } catch (err: any) {
      console.error('[CRMCostsTab] Error eliminando gasto:', err);
      // Revert if error
      setExpenses(previousExpenses);
      alert(`No se pudo eliminar el gasto: ${err.message || 'Error de Firestore'}`);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-5 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#18231C] text-white rounded-xs">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                  Control de Costos · Gestión Financiera
                </h3>
                <span className="px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Firestore crm_expenses
                </span>
              </div>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Seguimiento integral de costos fijos y variables por sucursal en Gran Mendoza (Maipú, Ciudad, Luján).
              </p>
            </div>
          </div>
        </div>

        {/* Filter Selectors: Mes/Año y Sucursal */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#DCD4C9] px-2.5 py-1.5 rounded-xs text-xs">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="bg-transparent font-bold text-[#18231C] outline-none cursor-pointer"
            >
              <option value="todos">Todos los Meses</option>
              {monthYearOptions.map((ym) => (
                <option key={ym} value={ym}>{formatMonthYearLabel(ym)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#DCD4C9] px-2.5 py-1.5 rounded-xs text-xs">
            <Building2 className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent font-bold text-[#18231C] outline-none cursor-pointer"
            >
              <option value="todas">Todas las Sucursales</option>
              {BRANCH_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* DASHBOARD: Visual KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total General */}
        <div className="bg-white p-4 rounded-xs border-2 border-[#18231C] shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
              Costo Total Período
            </span>
            <div className="p-1.5 bg-neutral-100 rounded-xs text-[#18231C]">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#18231C] tracking-tight">
            ${metrics.totalGeneral.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-2 pt-2 border-t border-neutral-100">
            <span>{filteredExpenses.length} registros cargados</span>
            <span className="font-semibold text-neutral-700">
              {selectedBranch === 'todas' ? 'Todas las sucursales' : `Sucursal ${selectedBranch}`}
            </span>
          </div>
        </div>

        {/* Card 2: Costo Total por Sucursales (Maipú, Ciudad, Luján) */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
              Costos por Sucursal
            </span>
            <Building2 className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-neutral-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Maipú:
              </span>
              <span className="font-black text-[#18231C]">
                ${metrics.totalMaipu.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Ciudad:
              </span>
              <span className="font-black text-[#18231C]">
                ${metrics.totalCiudad.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Luján:
              </span>
              <span className="font-black text-[#18231C]">
                ${metrics.totalLujan.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Costos Fijos */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
              Costos Fijos
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-blue-100 text-blue-800">
              {metrics.percentFijos}% del total
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-950 mt-1">
            ${metrics.totalFijos.toLocaleString('es-AR')}
          </p>
          <div className="w-full bg-neutral-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.percentFijos)}%` }}
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-2">
            Alquileres, sueldos base, servicios fijos e impuestos reglamentarios.
          </p>
        </div>

        {/* Card 4: Costos Variables */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Costos Variables
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900">
              {metrics.percentVariables}% del total
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
            ${metrics.totalVariables.toLocaleString('es-AR')}
          </p>
          <div className="w-full bg-neutral-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.percentVariables)}%` }}
            />
          </div>
          <p className="text-[10px] text-neutral-500 mt-2">
            Mercadería puntual, logística de envíos, publicidad y mantenimiento.
          </p>
        </div>
      </div>

      {/* FORMULARIO DE CARGA ÁGIL */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#B9522F]" />
            <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[#18231C]">
              {isEditingId ? 'Editar Registro de Gasto' : 'Registrar Nuevo Costo / Gasto'}
            </h4>
          </div>
          {isEditingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-neutral-500 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Cancelar Edición
            </button>
          )}
        </div>

        {feedbackNotice && (
          <div className={`p-3 rounded-xs text-xs font-semibold flex items-center gap-2 ${
            feedbackNotice.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}>
            {feedbackNotice.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedbackNotice.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Fecha */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium focus:border-[#B9522F]"
              />
            </div>

            {/* Sucursal */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Sucursal *</label>
              <select
                value={formBranch}
                onChange={(e) => setFormBranch(e.target.value)}
                className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold text-[#18231C] focus:border-[#B9522F]"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Tipo: Fijo vs. Variable */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Tipo de Costo *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ExpenseType)}
                className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold text-[#18231C] focus:border-[#B9522F]"
              >
                <option value="Fijo">Costo Fijo</option>
                <option value="Variable">Costo Variable</option>
              </select>
            </div>

            {/* Categoría */}
            <div className="lg:col-span-2">
              <label className="block font-bold text-neutral-700 mb-1">Categoría *</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C] focus:border-[#B9522F]"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Monto ($ ARS) *</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 font-bold text-neutral-500">$</span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full pl-6 pr-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-black text-[#18231C] focus:border-[#B9522F]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block font-bold text-neutral-700 mb-1">Detalle / Concepto del Gasto *</label>
              <input
                type="text"
                required
                placeholder="Ej: Pago de alquiler local Maipú mes en curso, factura gas Ecogas, flete mercadería desde depósito..."
                value={formDetail}
                onChange={(e) => setFormDetail(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none focus:border-[#B9522F] text-xs"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {isEditingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-1/2 sm:w-auto px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold uppercase rounded-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] disabled:opacity-50 text-white font-bold uppercase tracking-wider rounded-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isEditingId ? 'Actualizar en Firestore' : 'Guardar Gasto en Firestore'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* TABLA DINÁMICA DE GASTOS */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden flex flex-col">
        {/* Table header with search */}
        <div className="p-3.5 border-b border-[#DCD4C9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              Listado de Gastos Registrados ({filteredExpenses.length})
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por detalle o categoría..."
              value={searchDetail}
              onChange={(e) => setSearchDetail(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
            />
          </div>
        </div>

        {/* Table container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#18231C] text-white uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Sucursal</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Detalle / Concepto</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500 font-medium">
                    Cargando gastos desde Cloud Firestore...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-neutral-700" />
                    <p className="font-bold text-neutral-700 text-sm">No hay gastos registrados para este filtro.</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Podés ingresar un nuevo registro usando el formulario superior.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-neutral-700 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#18231C] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-xs bg-neutral-100 border border-neutral-300">
                        {item.branch}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-xs font-bold text-[10px] uppercase tracking-wider ${
                        item.type === 'Fijo'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-800 whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700 max-w-xs truncate" title={item.detail}>
                      {item.detail}
                    </td>
                    <td className="py-2.5 px-3 font-black text-right text-[#18231C] whitespace-nowrap text-sm">
                      ${Number(item.amount || 0).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1 rounded-xs hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
                          title="Editar gasto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.detail)}
                          className="p-1 rounded-xs hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
