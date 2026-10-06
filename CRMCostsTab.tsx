import React, { useState, useEffect, useMemo } from 'react';
import { CRMExpense, ExpenseType, ExpenseCategory, CostCategoryConfig } from '../../types';
import { 
  saveCRMExpense, 
  deleteCRMExpense, 
  subscribeToCRMExpenses,
  subscribeToCostCategories,
  DEFAULT_COST_CATEGORIES,
  fetchFirestoreStoreConfig,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { 
  DollarSign, 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Calendar, 
  Check, 
  X, 
  AlertCircle,
  Receipt,
  Search,
  Lock,
  Send
} from 'lucide-react';

interface CRMCostsTabProps {
  accentColor?: string;
  userRole?: 'admin' | 'employee' | string;
  defaultBranch?: string;
}

export const CRMCostsTab: React.FC<CRMCostsTabProps> = ({ 
  accentColor = '#FDB813',
  userRole = 'admin',
  defaultBranch = 'Maipú'
}) => {
  const isAdmin = userRole === 'admin';

  // Dynamic Branches from Firestore / config
  const [dynamicBranches, setDynamicBranches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((b: any) => b.name || b.branchName).filter(Boolean);
          if (names.length > 0) return Array.from(new Set(names));
        }
      }
    } catch {}
    return ['Maipú', 'Ciudad', 'Luján'];
  });

  // Dynamic Cost Categories from Firestore
  const [costCategories, setCostCategories] = useState<CostCategoryConfig[]>(DEFAULT_COST_CATEGORIES);

  // State for expenses (Admin only)
  const [expenses, setExpenses] = useState<CRMExpense[]>([]);
  const [isLoading, setIsLoading] = useState(isAdmin);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filters (Admin only)
  const [selectedBranch, setSelectedBranch] = useState<string>('todas');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('todos');
  const [searchDetail, setSearchDetail] = useState('');

  // Form state (Used by both Admin and Employee)
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBranch, setFormBranch] = useState<string>(defaultBranch || 'Maipú');
  const [formType, setFormType] = useState<ExpenseType>('Fijo');
  const [formCategory, setFormCategory] = useState<string>('Alquiler');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDetail, setFormDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load dynamic branches from Firestore store config
  useEffect(() => {
    fetchFirestoreStoreConfig().then((cfg) => {
      if (cfg && Array.isArray(cfg.branches) && cfg.branches.length > 0) {
        const names = Array.from(new Set(cfg.branches.map((b) => b.name).filter(Boolean)));
        if (names.length > 0) {
          setDynamicBranches(names);
          if (!names.includes(formBranch) && names.length > 0) {
            setFormBranch(names[0]);
          }
        }
      }
    }).catch(console.warn);
  }, []);

  // Subscribe to dynamic cost categories from Firestore
  useEffect(() => {
    const unsub = subscribeToCostCategories((remoteCats) => {
      if (Array.isArray(remoteCats) && remoteCats.length > 0) {
        setCostCategories(remoteCats.map(sanitizeObjectEncoding));
      }
    });
    return () => unsub();
  }, []);

  // 1. RBAC Subscription: Admin subscribes to crm_expenses via onSnapshot; Employees are write-only
  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      setSyncError(null);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToCRMExpenses(
      (remoteExpenses) => {
        setExpenses(remoteExpenses.map(sanitizeObjectEncoding));
        setIsLoading(false);
        setSyncError(null);

        // Also incorporate any branch name present in expenses
        const expenseBranches = remoteExpenses.map((e) => e.branch).filter(Boolean);
        if (expenseBranches.length > 0) {
          setDynamicBranches((prev) => Array.from(new Set([...prev, ...expenseBranches])));
        }
      },
      (err) => {
        console.warn('[CRMCostsTab] Modo local activo para gastos:', err?.message || err);
        setSyncError(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Compute available Month/Year options from data (Admin only)
  const monthYearOptions = useMemo(() => {
    if (!isAdmin) return [];
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
  }, [expenses, isAdmin]);

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

  // Filtered Expenses for Admin KPI and list
  const filteredExpenses = useMemo(() => {
    if (!isAdmin) return [];
    return expenses.filter((item) => {
      const expBranchNorm = (item.branch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const selBranchNorm = selectedBranch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchBranch = selectedBranch === 'todas' || expBranchNorm === selBranchNorm || expBranchNorm.includes(selBranchNorm) || selBranchNorm.includes(expBranchNorm);
      const matchMonth = selectedMonthYear === 'todos' || (item.date && item.date.startsWith(selectedMonthYear));
      const matchSearch = !searchDetail.trim() || 
        (item.detail || '').toLowerCase().includes(searchDetail.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchDetail.toLowerCase());
      return matchBranch && matchMonth && matchSearch;
    });
  }, [expenses, selectedBranch, selectedMonthYear, searchDetail, isAdmin]);

  // Dashboard KPI Calculations (Admin only)
  const metrics = useMemo(() => {
    if (!isAdmin) {
      return {
        totalGeneral: 0,
        totalMaipu: 0,
        totalCiudad: 0,
        totalLujan: 0,
        branchTotals: {},
        totalFijos: 0,
        totalVariables: 0,
        percentFijos: 0,
        percentVariables: 0,
      };
    }

    let totalGeneral = 0;
    let totalMaipu = 0;
    let totalCiudad = 0;
    let totalLujan = 0;
    let totalFijos = 0;
    let totalVariables = 0;

    const branchTotals: Record<string, number> = {};
    dynamicBranches.forEach((b) => { branchTotals[b] = 0; });

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalGeneral += amt;

      const br = (exp.branch || '').toLowerCase();
      const brNorm = br.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matched = dynamicBranches.find(
        (b) => {
          const bNorm = b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return bNorm === brNorm || brNorm.includes(bNorm) || bNorm.includes(brNorm);
        }
      );
      if (matched) {
        branchTotals[matched] = (branchTotals[matched] || 0) + amt;
      }

      if (brNorm.includes('maip')) totalMaipu += amt;
      else if (brNorm.includes('ciudad')) totalCiudad += amt;
      else if (brNorm.includes('luj')) totalLujan += amt;

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
      branchTotals,
      totalFijos,
      totalVariables,
      percentFijos,
      percentVariables,
    };
  }, [filteredExpenses, dynamicBranches, isAdmin]);

  const handleCategoryChange = (newCat: string) => {
    setFormCategory(newCat);
    const matched = costCategories.find((c) => c.name.toLowerCase() === newCat.toLowerCase());
    if (matched) {
      setFormType(matched.defaultType);
    } else {
      const structural = ['Alquiler', 'Sueldos base', 'Impuestos/Servicios', 'Sueldos', 'Impuestos', 'Servicios'];
      if (structural.some((s) => newCat.toLowerCase().includes(s.toLowerCase()))) {
        setFormType('Fijo');
      } else {
        setFormType('Variable');
      }
    }
  };

  // Form submit: Save in Firestore (AddDoc / SetDoc)
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
      const expenseData: CRMExpense = sanitizeObjectEncoding({
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
      });

      // Optimistic local update for admin only (employees are write-only)
      if (isAdmin) {
        setExpenses((prev) => [expenseData, ...prev.filter((x) => x.id !== expenseData.id)]);
      }

      // Write-only push to crm_expenses via Firestore SDK (setDoc)
      const res = await saveCRMExpense(expenseData);
      if (res && res.error && !res.success) {
        throw new Error(res.error);
      }

      // Clean form state strictly
      setFormDetail('');
      setFormAmount('');
      setFormDate(new Date().toISOString().split('T')[0]);

      if (isEditingId) {
        setIsEditingId(null);
        setFeedbackNotice({ type: 'success', message: '¡Gasto actualizado con éxito en Firestore!' });
      } else {
        setFeedbackNotice({ type: 'success', message: '¡Gasto registrado con éxito!' });
      }

      setTimeout(() => setFeedbackNotice(null), 3500);
    } catch (err: any) {
      console.error('[CRMCostsTab] Error al guardar gasto:', err);
      setFeedbackNotice({ type: 'error', message: `Error al guardar: ${err?.message || 'Error de conexión con Firestore'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: CRMExpense) => {
    if (!isAdmin) return;
    setIsEditingId(item.id);
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormBranch(item.branch || 'Maipú');
    setFormType(item.type || 'Fijo');
    setFormCategory(item.category as ExpenseCategory || 'Alquiler');
    setFormAmount(String(item.amount || ''));
    setFormDetail(item.detail || '');
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditingId(null);
    setFormDetail('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
  };

  // Delete with strict error handling: force local update to unblock UI
  const handleDelete = async (id: string, detail: string) => {
    if (!isAdmin) return;
    if (!confirm(`¿Eliminar el registro de gasto "${detail}"?`)) return;

    // Strict requirement: Force immediate React state update to unblock UI
    setExpenses((prev) => prev.filter((item) => item.id !== id));

    try {
      const res = await deleteCRMExpense(id);
      if (res && res.error && !res.success) {
        throw new Error(res.error);
      }
      setFeedbackNotice({ type: 'success', message: 'Gasto eliminado exitosamente de Firestore.' });
      setTimeout(() => setFeedbackNotice(null), 3000);
    } catch (err: any) {
      console.error('[CRMCostsTab] Error eliminando gasto en Firestore:', err);
      // En caso de fallo al eliminar, forzar la actualización del estado local de React para destrabar la interfaz
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      setFeedbackNotice({ type: 'error', message: 'No se pudo eliminar en Firestore pero se actualizó la vista local para destrabar la interfaz.' });
      setTimeout(() => setFeedbackNotice(null), 3500);
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
                  {isAdmin ? 'Control de Costos · Gestión Financiera' : 'Carga de Costos y Gastos · Gran Mendoza'}
                </h3>
                <span className={`px-2 py-0.5 rounded-xs text-[10px] font-black uppercase tracking-wider border ${
                  isAdmin 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}>
                  {isAdmin ? 'Dashboard Administrador' : 'Empleado · Carga Directa (Write-Only)'}
                </span>
              </div>
              <p className="text-xs text-[#6F6860] mt-0.5">
                {isAdmin 
                  ? 'Seguimiento integral en tiempo real de costos fijos y variables por sucursal en Gran Mendoza (Maipú, Ciudad, Luján).'
                  : 'Formulario de registro de comprobantes y gastos de sucursal. Los datos se envían a la base central.'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Selectors: Mes/Año y Sucursal (Admin only) */}
        {isAdmin && (
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
                {dynamicBranches.map((b) => (
                  <option key={b} value={b}>{fixUtf8Encoding(b)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {syncError && isAdmin && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* DASHBOARD: Visual KPI Cards (Admin only) */}
      {isAdmin && (
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
                {selectedBranch === 'todas' ? 'Todas las sucursales' : `Sucursal ${fixUtf8Encoding(selectedBranch)}`}
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
      )}

      {/* FORMULARIO DE CARGA ÁGIL (Visible para Empleados y Administradores) */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#B9522F]" />
            <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[#18231C]">
              {isEditingId ? 'Editar Registro de Gasto' : (isAdmin ? 'Registrar Nuevo Costo / Gasto' : 'Cargar Comprobante / Gasto')}
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
                {dynamicBranches.map((b) => (
                  <option key={b} value={b}>{fixUtf8Encoding(b)}</option>
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
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C] focus:border-[#B9522F]"
              >
                {costCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {fixUtf8Encoding(cat.name)} ({cat.defaultType})
                  </option>
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
                placeholder="Ej: Pago alquiler Maipú mes en curso, factura Ecogas, flete mercadería..."
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
                {isAdmin ? <Plus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>
                  {isEditingId 
                    ? 'Actualizar Gasto' 
                    : (isAdmin ? 'Guardar Gasto en Firestore' : 'Registrar Gasto')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* TABLA HISTÓRICA DE GASTOS (Admin only) */}
      {isAdmin && (
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

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] font-bold uppercase text-[10px] text-[#6F6860]">
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
              <tbody className="divide-y divide-[#ECE5DC]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400">
                      No se encontraron registros de gastos para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-medium text-neutral-600 whitespace-nowrap">
                        {exp.date}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#18231C] whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded-xs bg-neutral-100 border border-neutral-200">
                          {fixUtf8Encoding(exp.branch)}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-black uppercase ${
                          exp.type === 'Fijo' 
                            ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {exp.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-neutral-800 whitespace-nowrap">
                        {fixUtf8Encoding(exp.category)}
                      </td>
                      <td className="py-2 px-3 text-neutral-700 max-w-xs truncate" title={exp.detail}>
                        {fixUtf8Encoding(exp.detail)}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-[#18231C] whitespace-nowrap">
                        ${Number(exp.amount || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(exp)}
                            className="p-1 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-xs transition-colors cursor-pointer"
                            title="Editar gasto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id, exp.detail)}
                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
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
      )}
    </div>
  );
};
