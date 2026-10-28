import React, { useState, useEffect, useMemo } from 'react';
import { 
  CRMExpense, 
  ExpenseType, 
  ExpenseCategory, 
  CostCategoryConfig,
  CRMSale,
  CRMOrder 
} from '../../types';
import { 
  saveCRMExpense, 
  deleteCRMExpense, 
  subscribeToCRMExpenses,
  subscribeToCostCategories,
  DEFAULT_COST_CATEGORIES,
  fetchFirestoreStoreConfig,
  fetchFirestoreBranches,
  subscribeToFirestoreBranches,
  subscribeToCRMSales,
  saveCRMSale,
  deleteCRMSale,
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
  Send,
  TrendingUp,
  TrendingDown,
  PieChart,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Scale,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { CRMSalesModal } from './CRMSalesModal';

interface CRMCostsTabProps {
  accentColor?: string;
  userRole?: 'admin' | 'employee' | string;
  defaultBranch?: string;
  orders?: CRMOrder[];
}

export const CRMCostsTab: React.FC<CRMCostsTabProps> = ({ 
  accentColor = '#FDB813',
  userRole = 'admin',
  defaultBranch = 'Maipú',
  orders = []
}) => {
  const isAdmin = userRole === 'admin';

  // Dynamic Branches from Firestore collection ('branches') and config
  const [dynamicBranches, setDynamicBranches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_catalog_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((b: any) => b.name || b.branchName || b.zone).filter(Boolean);
          if (names.length > 0) return Array.from(new Set(names));
        }
      }
    } catch {}
    return ['Pampero Maipú', 'Pampero Ciudad de Mendoza', 'Pampero Luján de Cuyo', 'Maipú', 'Ciudad', 'Luján'];
  });

  // Dynamic Cost Categories from Firestore
  const [costCategories, setCostCategories] = useState<CostCategoryConfig[]>(DEFAULT_COST_CATEGORIES);

  // State for expenses (Admin only)
  const [expenses, setExpenses] = useState<CRMExpense[]>([]);
  const [isLoading, setIsLoading] = useState(isAdmin);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sales state (Cierres de Ventas Diarias desde Excel crm_sales)
  const [sales, setSales] = useState<CRMSale[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_crm_sales');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  const handleSaveSale = async (sale: Partial<CRMSale>): Promise<boolean> => {
    try {
      const res = await saveCRMSale(sale);
      if (res.success) {
        setSales((prev) => {
          const cleanAmt = Number(sale.amount ?? sale.totalDaily ?? 0) || 0;
          const updatedItem: CRMSale = {
            id: res.id,
            date: sale.date || new Date().toISOString().split('T')[0],
            branch: sale.branch || 'Maipú',
            period: sale.period || 'Diario',
            amount: cleanAmt,
            totalDaily: cleanAmt,
            detail: sale.detail || '',
            registeredBy: 'Admin / Operador',
            updatedAt: new Date().toISOString(),
          };
          const map = new Map<string, CRMSale>();
          prev.forEach((s) => map.set(s.id, s));
          map.set(res.id, updatedItem);
          const list = Array.from(map.values());
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          return list;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[CRMCostsTab] Error al guardar venta:', err);
      return false;
    }
  };

  const handleDeleteSale = async (id: string): Promise<boolean> => {
    try {
      const ok = await deleteCRMSale(id);
      if (ok) {
        setSales((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[CRMCostsTab] Error al eliminar venta:', err);
      return false;
    }
  };

  // Orders source (prop or local storage fallback)
  const allOrdersList = useMemo(() => {
    if (Array.isArray(orders) && orders.length > 0) return orders;
    try {
      const saved = localStorage.getItem('pampero_crm_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }, [orders]);

  // Filters (Admin only)
  const [selectedBranch, setSelectedBranch] = useState<string>('todas');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('todos');
  const [searchDetail, setSearchDetail] = useState('');

  // Form state (Used by both Admin and Employee)
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBranch, setFormBranch] = useState<string>(() => {
    return defaultBranch || 'Pampero Maipú';
  });
  const [formType, setFormType] = useState<ExpenseType>('Fijo');
  const [formCategory, setFormCategory] = useState<string>('Alquiler y expensas');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDetail, setFormDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Load dynamic branches from Firestore 'branches' collection & store_config in real time
  useEffect(() => {
    const unsub = subscribeToFirestoreBranches((remoteBranches) => {
      if (Array.isArray(remoteBranches) && remoteBranches.length > 0) {
        const rawNames = remoteBranches.map((b) => b.name || (b as any).branchName || b.zone).filter(Boolean);
        const uniqueNames = Array.from(new Set(rawNames));
        if (uniqueNames.length > 0) {
          setDynamicBranches(uniqueNames);
          setFormBranch((current) => {
            if (uniqueNames.includes(current)) return current;
            const maipu = uniqueNames.find((n) => n.toLowerCase().includes('maipú') || n.toLowerCase().includes('maipu'));
            return maipu || uniqueNames[0];
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Subscribe to dynamic cost categories from Firestore
  useEffect(() => {
    const unsub = subscribeToCostCategories((remoteCats) => {
      if (Array.isArray(remoteCats) && remoteCats.length > 0) {
        const sanitized = remoteCats.map(sanitizeObjectEncoding);
        setCostCategories(sanitized);
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

  // 2. RBAC Subscription: Admin subscribes to crm_sales in real-time via onSnapshot
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeToCRMSales(
      (remoteSales) => {
        setSales(remoteSales);
        const salesBranches = remoteSales.map((s) => s.branch).filter(Boolean);
        if (salesBranches.length > 0) {
          setDynamicBranches((prev) => Array.from(new Set([...prev, ...salesBranches])));
        }
      },
      (err) => {
        console.warn('[CRMCostsTab] Modo local activo para crm_sales:', err?.message || err);
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  // Compute available Month/Year options from both expenses and sales (Admin only)
  const monthYearOptions = useMemo(() => {
    if (!isAdmin) return [];
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.substring(0, 7)); // YYYY-MM
      }
    });
    sales.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.substring(0, 7)); // YYYY-MM
      }
    });
    // Add current month if not present
    const currentYM = new Date().toISOString().substring(0, 7);
    set.add(currentYM);
    return Array.from(set).sort().reverse();
  }, [expenses, sales, isAdmin]);

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

  // Filtered Sales (crm_sales) for Admin KPI and El Cruce Financiero
  const filteredSales = useMemo(() => {
    if (!isAdmin) return [];
    return sales.filter((item) => {
      const saleBranchNorm = (item.branch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const selBranchNorm = selectedBranch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchBranch = selectedBranch === 'todas' || saleBranchNorm === selBranchNorm || saleBranchNorm.includes(selBranchNorm) || selBranchNorm.includes(saleBranchNorm);
      const matchMonth = selectedMonthYear === 'todos' || (item.date && item.date.startsWith(selectedMonthYear));
      return matchBranch && matchMonth;
    });
  }, [sales, selectedBranch, selectedMonthYear, isAdmin]);

  // Filtered Orders for Bloque 1 (Ingresos por Ventas de respaldo)
  const filteredOrders = useMemo(() => {
    return allOrdersList.filter((ord) => {
      const ordBranchNorm = (ord.branch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const selBranchNorm = selectedBranch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchBranch = selectedBranch === 'todas' || ordBranchNorm === selBranchNorm || ordBranchNorm.includes(selBranchNorm) || selBranchNorm.includes(ordBranchNorm);
      const matchMonth = selectedMonthYear === 'todos' || (ord.date && ord.date.startsWith(selectedMonthYear));
      return matchBranch && matchMonth;
    });
  }, [allOrdersList, selectedBranch, selectedMonthYear]);

  // EL CRUCE FINANCIERO: Ventas (crm_sales) MENOS Gastos (crm_expenses)
  const cruceFinanciero = useMemo(() => {
    if (!isAdmin) {
      return {
        ingresosTotales: 0,
        totalVentasReales: 0,
        hasRealSales: false,
        ventasDiasCount: 0,
        costosTotales: 0,
        totalFijos: 0,
        totalVariables: 0,
        rentabilidadNeta: 0,
        margenRentabilidadPct: 0,
        esPositiva: true,
      };
    }

    // 1. Sumatoria de todos los ingresos (Suma de las ventas cargadas desde el Modal crm_sales)
    const totalVentasReales = filteredSales.reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);
    const ventasDiasCount = filteredSales.length;
    const hasRealSales = ventasDiasCount > 0;

    // Ingresos Totales: Suma directa de las ventas cargadas para los filtros aplicados
    const ingresosTotales = totalVentasReales;

    // 2. Sumatoria de todos los gastos (Suma de la tabla de costos principal crm_expenses)
    let totalFijos = 0;
    let totalVariables = 0;
    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      if (exp.type === 'Fijo') {
        totalFijos += amt;
      } else {
        totalVariables += amt;
      }
    });

    const costosTotales = totalFijos + totalVariables;

    // 3. Rentabilidad Neta = Ingresos Totales MENOS Costos Totales
    const rentabilidadNeta = ingresosTotales - costosTotales;
    const margenRentabilidadPct = ingresosTotales > 0 
      ? Math.round((rentabilidadNeta / ingresosTotales) * 100) 
      : (costosTotales > 0 ? -100 : 0);
    const esPositiva = rentabilidadNeta >= 0;

    return {
      ingresosTotales,
      totalVentasReales,
      hasRealSales,
      ventasDiasCount,
      costosTotales,
      totalFijos,
      totalVariables,
      rentabilidadNeta,
      margenRentabilidadPct,
      esPositiva,
    };
  }, [filteredSales, filteredExpenses, filteredOrders, sales, expenses, allOrdersList, isAdmin]);

  // Dashboard KPI Calculations: Estado de Resultados Online / ERP (Admin only)
  const financialERP = useMemo(() => {
    if (!isAdmin) {
      return {
        salesRevenue: 0,
        ordersCount: 0,
        unitsCount: 0,
        averageTicket: 0,
        totalVariables: 0,
        percentVariables: 0,
        costoCompra: 0,
        embalajePrenda: 0,
        comisiones: 0,
        fletesLogistica: 0,
        otrosVariables: 0,
        totalFijos: 0,
        percentFijos: 0,
        alquileres: 0,
        serviciosBasicos: 0,
        sueldos: 0,
        segurosImpuestos: 0,
        otrosFijos: 0,
        totalCostos: 0,
        margenContribucion: 0,
        margenContribucionPct: 0,
        utilidadNeta: 0,
        margenNetoPct: 0,
        puntoEquilibrio: 0,
        puntoEquilibrioCumplidoPct: 0,
        estadoRentabilidad: 'Equilibrio' as 'Superávit' | 'Equilibrio' | 'Déficit',
      };
    }

    // Bloque 1: Ingresos por ventas enlazados al cruce de crm_sales
    const salesRevenue = cruceFinanciero.ingresosTotales;
    const totalOrdersUnits = filteredOrders.reduce((acc, o) => acc + (Number(o.totalUnits) || 0), 0);
    const ordersCount = cruceFinanciero.hasRealSales 
      ? cruceFinanciero.ventasDiasCount 
      : (filteredOrders.length > 0 ? filteredOrders.length : 8);
    const unitsCount = totalOrdersUnits > 0 ? totalOrdersUnits : (cruceFinanciero.hasRealSales ? cruceFinanciero.ventasDiasCount * 14 : 460);
    const averageTicket = ordersCount > 0 ? Math.round(salesRevenue / ordersCount) : 0;

    // Bloques 2 y 3: Desglose de Gastos
    let costoCompra = 0;
    let embalajePrenda = 0;
    let comisiones = 0;
    let fletesLogistica = 0;
    let otrosVariables = 0;

    let alquileres = 0;
    let serviciosBasicos = 0;
    let sueldos = 0;
    let segurosImpuestos = 0;
    let otrosFijos = 0;

    let totalVariables = 0;
    let totalFijos = 0;

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const catLower = (exp.category || '').toLowerCase();
      const detLower = (exp.detail || '').toLowerCase();

      if (exp.type === 'Variable') {
        totalVariables += amt;
        if (catLower.includes('compra') || detLower.includes('compra') || catLower.includes('mercader') || detLower.includes('tela')) {
          costoCompra += amt;
        } else if (catLower.includes('embalaje') || detLower.includes('embalaje') || catLower.includes('insumo')) {
          embalajePrenda += amt;
        } else if (catLower.includes('comisi') || detLower.includes('comisi')) {
          comisiones += amt;
        } else if (catLower.includes('flete') || detLower.includes('flete') || catLower.includes('envío') || catLower.includes('logíst')) {
          fletesLogistica += amt;
        } else {
          otrosVariables += amt;
        }
      } else {
        totalFijos += amt;
        if (catLower.includes('alquiler') || detLower.includes('alquiler')) {
          alquileres += amt;
        } else if (catLower.includes('servicio') || detLower.includes('luz') || detLower.includes('gas') || detLower.includes('agua') || detLower.includes('internet')) {
          serviciosBasicos += amt;
        } else if (catLower.includes('sueldo') || detLower.includes('sueldo') || detLower.includes('salario')) {
          sueldos += amt;
        } else if (catLower.includes('seguro') || detLower.includes('seguro') || catLower.includes('impuesto') || detLower.includes('afip') || detLower.includes('atm')) {
          segurosImpuestos += amt;
        } else {
          otrosFijos += amt;
        }
      }
    });

    // Provide default initial demo proportions only if no real data exists across the system
    const hasAnyRealData = sales.length > 0 || expenses.length > 0 || allOrdersList.length > 0;
    if (!hasAnyRealData && totalVariables === 0 && totalFijos === 0) {
      costoCompra = 3850000;
      embalajePrenda = 420000;
      comisiones = 590000;
      fletesLogistica = 280000;
      totalVariables = costoCompra + embalajePrenda + comisiones + fletesLogistica;

      alquileres = 1250000;
      serviciosBasicos = 380000;
      sueldos = 2400000;
      segurosImpuestos = 310000;
      totalFijos = alquileres + serviciosBasicos + sueldos + segurosImpuestos;
    }

    const totalCostos = totalVariables + totalFijos;
    const percentVariables = salesRevenue > 0 ? Math.round((totalVariables / salesRevenue) * 100) : 0;
    const percentFijos = salesRevenue > 0 ? Math.round((totalFijos / salesRevenue) * 100) : 0;

    // Bloque 4: Resultados y Punto de Equilibrio
    const margenContribucion = salesRevenue - totalVariables;
    const margenContribucionPct = salesRevenue > 0 ? Math.round((margenContribucion / salesRevenue) * 100) : 0;
    const utilidadNeta = margenContribucion - totalFijos;
    const margenNetoPct = salesRevenue > 0 ? Math.round((utilidadNeta / salesRevenue) * 100) : 0;

    const ratioCV = salesRevenue > 0 ? (totalVariables / salesRevenue) : 0.45;
    const puntoEquilibrio = ratioCV < 0.98 ? Math.round(totalFijos / Math.max(0.05, 1 - ratioCV)) : totalFijos + totalVariables;
    const puntoEquilibrioCumplidoPct = puntoEquilibrio > 0 ? Math.round((salesRevenue / puntoEquilibrio) * 100) : 100;

    let estadoRentabilidad: 'Superávit' | 'Equilibrio' | 'Déficit' = 'Equilibrio';
    if (utilidadNeta > 50000) estadoRentabilidad = 'Superávit';
    else if (utilidadNeta < -50000) estadoRentabilidad = 'Déficit';

    return {
      salesRevenue,
      ordersCount,
      unitsCount,
      averageTicket,
      totalVariables,
      percentVariables,
      costoCompra,
      embalajePrenda,
      comisiones,
      fletesLogistica,
      otrosVariables,
      totalFijos,
      percentFijos,
      alquileres,
      serviciosBasicos,
      sueldos,
      segurosImpuestos,
      otrosFijos,
      totalCostos,
      margenContribucion,
      margenContribucionPct,
      utilidadNeta,
      margenNetoPct,
      puntoEquilibrio,
      puntoEquilibrioCumplidoPct,
      estadoRentabilidad,
    };
  }, [filteredOrders, filteredExpenses, isAdmin]);

  const handleCategoryChange = (newCat: string) => {
    setFormCategory(newCat);
    const matched = costCategories.find((c) => c.name.toLowerCase() === newCat.toLowerCase());
    if (matched) {
      setFormType(matched.defaultType);
    } else {
      const fixedKeywords = ['alquiler', 'servicio', 'sueldo', 'seguro', 'honorario', 'expensa', 'luz', 'gas', 'agua', 'internet'];
      if (fixedKeywords.some((k) => newCat.toLowerCase().includes(k))) {
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

        {/* Filter Selectors: Mes/Año, Sucursal y Cargar Ventas */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
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
            </>
          )}

          {/* Botón Principal: Cargar Ventas */}
          <button
            type="button"
            id="btn-open-sales-modal"
            onClick={() => setIsSalesModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-black uppercase tracking-wider rounded-xs transition-colors cursor-pointer border border-[#18231C] shadow-2xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cargar Ventas</span>
          </button>
        </div>
      </div>

      {syncError && isAdmin && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* SECCIÓN SUPERIOR: TARJETAS KPI DE CRUCE FINANCIERO (Ventas Excel crm_sales vs. Gastos crm_expenses) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
          {/* Tarjeta KPI 1: Ingresos Totales */}
          <div className="bg-white p-4 rounded-xs border-2 border-emerald-600/40 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-xs">
                  {cruceFinanciero.hasRealSales ? 'Ventas Reales (crm_sales)' : 'Ventas Estimadas'}
                </span>
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block mt-1">
                Ingresos Totales
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#18231C] tracking-tight mt-1">
                ${cruceFinanciero.ingresosTotales.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
              <span>{cruceFinanciero.hasRealSales ? `${cruceFinanciero.ventasDiasCount} cierres importados` : 'Ventas de pedidos activos'}</span>
              <span className="font-semibold text-neutral-700">
                {selectedBranch === 'todas' ? 'Todos los locales' : fixUtf8Encoding(selectedBranch)}
              </span>
            </div>
          </div>

          {/* Tarjeta KPI 2: Costos Totales */}
          <div className="bg-white p-4 rounded-xs border-2 border-neutral-300 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-xs">
                  Gastos del Período
                </span>
                <div className="p-1.5 bg-neutral-100 text-[#18231C] rounded-xs">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block mt-1">
                Costos Totales
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#18231C] tracking-tight mt-1">
                ${cruceFinanciero.costosTotales.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
              <span>Fijos: <strong className="text-blue-900">${cruceFinanciero.totalFijos.toLocaleString('es-AR')}</strong></span>
              <span>Variables: <strong className="text-amber-900">${cruceFinanciero.totalVariables.toLocaleString('es-AR')}</strong></span>
            </div>
          </div>

          {/* Tarjeta KPI 3: Rentabilidad Neta (Lógica de colores estricta) */}
          <div className={`p-4 rounded-xs border-2 shadow-2xs flex flex-col justify-between bg-white ${
            cruceFinanciero.esPositiva ? 'border-emerald-600' : 'border-red-600'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-xs border ${
                  cruceFinanciero.esPositiva
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-red-50 text-red-900 border-red-300'
                }`}>
                  {cruceFinanciero.esPositiva ? 'Ganancia / Superávit' : 'Pérdida / Déficit'}
                </span>
                <div className={`p-1.5 rounded-xs ${
                  cruceFinanciero.esPositiva ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {cruceFinanciero.esPositiva ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block mt-1">
                Rentabilidad Neta (Cruce)
              </span>
              {/* Lógica de colores estricta: Verde si ganancia (+), Rojo si pérdida (-) */}
              <p className={`text-2xl sm:text-3xl font-black tracking-tight mt-1 ${
                cruceFinanciero.esPositiva ? 'text-emerald-600' : 'text-red-600'
              }`}>
                ${cruceFinanciero.rentabilidadNeta.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                Margen Neto: <strong className={cruceFinanciero.esPositiva ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{cruceFinanciero.margenRentabilidadPct}%</strong>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                Ingresos - Gastos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD: Estado de Resultados Online / ERP en 4 Bloques (Admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
          {/* BLOQUE 1: Ingresos por Ventas */}
          <div className="bg-white p-4 rounded-xs border-2 border-[#18231C] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-xs">
                  Bloque 1 · Facturación
                </span>
                <div className="p-1.5 bg-neutral-100 rounded-xs text-[#18231C]">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block mt-1">
                Ingresos por Ventas
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#18231C] tracking-tight mt-1">
                ${financialERP.salesRevenue.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="space-y-1.5 text-xs pt-3 mt-3 border-t border-neutral-100">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Pedidos registrados:</span>
                <span className="font-bold text-[#18231C]">{financialERP.ordersCount}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>Prendas / unidades:</span>
                <span className="font-bold text-[#18231C]">{financialERP.unitsCount} u.</span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>Ticket promedio:</span>
                <span className="font-black text-[#18231C]">
                  ${financialERP.averageTicket.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: Costos Variables */}
          <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xs">
                  Bloque 2 · Variables
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900">
                  {financialERP.percentVariables}% de ventas
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-950 block mt-1">
                Costos Variables
              </span>
              <p className="text-2xl font-black text-amber-950 tracking-tight mt-1">
                ${financialERP.totalVariables.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="space-y-1 text-xs pt-2.5 mt-2.5 border-t border-neutral-100">
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Costo de compra:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.costoCompra.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Embalaje por prenda:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.embalajePrenda.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Comisiones por ventas:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.comisiones.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, financialERP.percentVariables)}%` }}
                />
              </div>
            </div>
          </div>

          {/* BLOQUE 3: Costos Fijos */}
          <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-xs">
                  Bloque 3 · Estructurales
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-blue-100 text-blue-800">
                  {financialERP.percentFijos}% de ventas
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mt-1">
                Costos Fijos
              </span>
              <p className="text-2xl font-black text-blue-950 tracking-tight mt-1">
                ${financialERP.totalFijos.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="space-y-1 text-xs pt-2.5 mt-2.5 border-t border-neutral-100">
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Alquiler y expensas:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.alquileres.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Servicios Básicos:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.serviciosBasicos.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Sueldos y cargas:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.sueldos.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span className="truncate">Seguros y honorarios:</span>
                <span className="font-bold text-[#18231C] shrink-0">
                  ${financialERP.segurosImpuestos.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, financialERP.percentFijos)}%` }}
                />
              </div>
            </div>
          </div>

          {/* BLOQUE 4: Resultados y Punto de Equilibrio */}
          <div className="bg-white p-4 rounded-xs border-2 border-[#B9522F] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#B9522F] bg-[#B9522F]/10 border border-[#B9522F]/30 px-2 py-0.5 rounded-xs">
                  Bloque 4 · Balance
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-xs border ${
                  financialERP.estadoRentabilidad === 'Superávit'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : financialERP.estadoRentabilidad === 'Déficit'
                    ? 'bg-red-100 text-red-900 border-red-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {financialERP.estadoRentabilidad}
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] block mt-1">
                Utilidad Neta Calculada
              </span>
              <p className={`text-2xl font-black tracking-tight mt-1 ${
                financialERP.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                ${financialERP.utilidadNeta.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="space-y-1 text-xs pt-2.5 mt-2.5 border-t border-neutral-100">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Margen Contribución:</span>
                <span className="font-bold text-[#18231C]">
                  ${financialERP.margenContribucion.toLocaleString('es-AR')} ({financialERP.margenContribucionPct}%)
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>Punto de Equilibrio:</span>
                <span className="font-bold text-[#18231C]">
                  ${financialERP.puntoEquilibrio.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>Margen Neto Total:</span>
                <span className={`font-black ${financialERP.margenNetoPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {financialERP.margenNetoPct}%
                </span>
              </div>
            </div>
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

      {/* Modal Emergente de Carga de Ventas & Registro de Ingresos */}
      <CRMSalesModal
        isOpen={isSalesModalOpen}
        onClose={() => setIsSalesModalOpen(false)}
        sales={sales}
        accentColor={accentColor}
        branches={dynamicBranches}
        onSaveSale={handleSaveSale}
        onDeleteSale={handleDeleteSale}
      />
    </div>
  );
};
