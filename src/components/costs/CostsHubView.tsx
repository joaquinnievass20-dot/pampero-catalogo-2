import React, { useState, useEffect, useMemo } from 'react';
import {
  UserSession,
  ThemeConfig,
  BranchLocation,
  CRMExpense,
  CRMSale,
  CRMOrder,
  CostCategoryConfig,
  FinancialCheckRecord,
  FinancialCheckDirection,
  FinancialCheckMode,
  FinancialCheckStatus,
  PettyCashMovement,
  PettyCashMovementType,
  ExpenseInvoiceRecord,
  ExpenseInvoiceStatus,
  ExpenseInvoiceType,
  ExpenseType,
} from '../../types';
import {
  subscribeToCRMExpenses,
  saveCRMExpense,
  subscribeToCRMSales,
  subscribeToCRMOrders,
  subscribeToCostCategories,
  DEFAULT_COST_CATEGORIES,
  subscribeToFinancialChecks,
  saveFinancialCheck,
  deleteFinancialCheck,
  subscribeToPettyCashMovements,
  savePettyCashMovement,
  deletePettyCashMovement,
  subscribeToExpenseInvoices,
  saveExpenseInvoice,
  deleteExpenseInvoice,
  upsertInvoiceDueCalendarEvent,
  subscribeToFirestoreBranches,
  subscribeToReadNotifications,
  saveReadNotifications,
  subscribeToKanbanColumns,
  DEFAULT_COMPANY_COLUMNS,
  KanbanColumnConfig,
} from '../../services/firebase';
import { CRMCostsTab } from '../crm/CRMCostsTab';
import { PamperoLogo } from '../PamperoLogo';
import { isColorDark } from '../../context/ThemeContext';
import { CostsChartsSection } from './CostsChartsSection';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import {
  branchMatches,
  getConfiguredBranchNames,
  resolveConfiguredBranchName,
} from '../../utils/rrhhBranches';
import { resolveEmployeeRecord } from '../../utils/permissions';
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  Store,
  FileText,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Calendar,
  Landmark,
  Bell,
  AlertTriangle,
  Paperclip,
  Eye,
  CreditCard,
  Upload,
  Menu,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface CostsHubViewProps {
  userSession: UserSession;
  theme?: ThemeConfig;
  branches?: BranchLocation[];
  onClose: () => void;
}

type CostsSubTab = 'dashboard' | 'costs' | 'invoices' | 'checks' | 'petty_cash';

const CHECK_STATUS_LABELS: Record<FinancialCheckStatus, string> = {
  en_cartera: 'En cartera',
  depositado: 'Depositado',
  cobrado: 'Cobrado',
  pendiente_debito: 'Pendiente débito',
  debitado: 'Debitado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
};

const CHECK_MODE_LABELS: Record<FinancialCheckMode, string> = {
  comun: 'Común',
  diferido: 'Diferido',
  echeq: 'E-Cheq',
};

const INVOICE_TYPES: ExpenseInvoiceType[] = [
  'Factura A',
  'Factura B',
  'Factura C',
  'Servicio / Impuesto',
  'Recibo / Ticket',
  'Nota de Débito',
];

const PAYMENT_METHODS = ['Transferencia', 'Efectivo', 'Cheque', 'Caja Chica', 'Tarjeta'];

const PETTY_CASH_CATEGORIES = [
  'Reposición de Caja',
  'Cadetería / Fletes',
  'Insumos de Salón',
  'Limpieza y Mantenimiento',
  'Viáticos / Movilidad',
  'Librería / Embalaje',
  'Pago de Factura / Servicio',
  'Otros Gastos Menores',
];

const normalizeBranchKey = (raw: string): string => {
  return (raw || '')
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
};

const formatARS = (value: number): string =>
  `$ ${Math.round(Number(value) || 0).toLocaleString('es-AR')}`;

const getDaysDiffFromToday = (targetIso: string, todayIso: string): number => {
  if (!targetIso) return 999;
  const t = new Date(`${targetIso}T00:00:00`).getTime();
  const n = new Date(`${todayIso}T00:00:00`).getTime();
  if (isNaN(t) || isNaN(n)) return 999;
  return Math.round((t - n) / (1000 * 60 * 60 * 24));
};

export const CostsHubView: React.FC<CostsHubViewProps> = ({
  userSession,
  theme,
  branches: propBranches,
  onClose,
}) => {
  const st = theme?.siteTexts;
  const accent = theme?.accentColor || '#FDB813';
  const [activeTab, setActiveTab] = useState<CostsSubTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const [expenses, setExpenses] = useState<CRMExpense[]>([]);
  const [sales, setSales] = useState<CRMSale[]>([]);
  const [orders, setOrders] = useState<CRMOrder[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategoryConfig[]>(DEFAULT_COST_CATEGORIES);
  const [checks, setChecks] = useState<FinancialCheckRecord[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashMovement[]>([]);
  const [invoices, setInvoices] = useState<ExpenseInvoiceRecord[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<BranchLocation[]>(propBranches || []);
  const [companyColumns, setCompanyColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_kanban_company_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_COMPANY_COLUMNS;
  });

  // Notifications state
  const notifUserKey = `fin_${(userSession?.email || userSession?.id || 'admin').toLowerCase().trim()}`;
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Dashboard Filters
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [dashMonth, setDashMonth] = useState<string>(currentMonthStr);
  const [dashBranch, setDashBranch] = useState<string>('todas');
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>('activos');

  const todayIso = new Date().toISOString().split('T')[0];

  // --- INVOICES STATE ---
  const [invStatusFilter, setInvStatusFilter] = useState<
    'all' | 'pendiente' | 'vencidas' | 'por_vencer' | 'pagada' | 'anulada'
  >('all');
  const [invCostTypeFilter, setInvCostTypeFilter] = useState<'all' | ExpenseType>('all');
  const [invBranchFilter, setInvBranchFilter] = useState<string>('todas');
  const [invSearch, setInvSearch] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ExpenseInvoiceRecord | null>(null);
  const [confirmDeleteInvId, setConfirmDeleteInvId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<ExpenseInvoiceRecord | null>(null);
  const [payInvoiceTarget, setPayInvoiceTarget] = useState<ExpenseInvoiceRecord | null>(null);

  // Invoice Form State
  const [invType, setInvType] = useState<string>('Factura A');
  const [invNumber, setInvNumber] = useState('');
  const [invSupplier, setInvSupplier] = useState('');
  const [invCuit, setInvCuit] = useState('');
  const [invCategory, setInvCategory] = useState(DEFAULT_COST_CATEGORIES[0]?.name || 'Alquiler y expensas');
  const [invCostType, setInvCostType] = useState<ExpenseType>('Fijo');
  const [invBranch, setInvBranch] = useState('Pampero Maipú');
  const [invIssueDate, setInvIssueDate] = useState(todayIso);
  const [invDueDate, setInvDueDate] = useState(todayIso);
  const [invAmount, setInvAmount] = useState('');
  const [invStatus, setInvStatus] = useState<ExpenseInvoiceStatus>('pendiente');
  const [invNotifyDays, setInvNotifyDays] = useState('5');
  const [invPaymentMethod, setInvPaymentMethod] = useState('Transferencia');
  const [invPaidDate, setInvPaidDate] = useState(todayIso);
  const [invAttachmentUrl, setInvAttachmentUrl] = useState('');
  const [invAttachmentName, setInvAttachmentName] = useState('');
  const [invSyncExpense, setInvSyncExpense] = useState(true);
  const [invSyncCalendar, setInvSyncCalendar] = useState(true);
  const [invNotes, setInvNotes] = useState('');
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  // Pay Invoice Modal State
  const [payDate, setPayDate] = useState(todayIso);
  const [payMethod, setPayMethod] = useState('Transferencia');
  const [payDeductPettyCash, setPayDeductPettyCash] = useState(false);
  const [payRegisterExpense, setPayRegisterExpense] = useState(true);
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);

  // Checks State
  const [checkDirectionFilter, setCheckDirectionFilter] = useState<'all' | FinancialCheckDirection>('all');
  const [checkStatusFilter, setCheckStatusFilter] = useState<string>('all');
  const [checkBranchFilter, setCheckBranchFilter] = useState<string>('todas');
  const [checkSearch, setCheckSearch] = useState<string>('');
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<FinancialCheckRecord | null>(null);
  const [confirmDeleteCheckId, setConfirmDeleteCheckId] = useState<string | null>(null);

  // Check Form State
  const [chkDirection, setChkDirection] = useState<FinancialCheckDirection>('recibido');
  const [chkMode, setChkMode] = useState<FinancialCheckMode>('diferido');
  const [chkNumber, setChkNumber] = useState('');
  const [chkBank, setChkBank] = useState('');
  const [chkIssueDate, setChkIssueDate] = useState(todayIso);
  const [chkDueDate, setChkDueDate] = useState(todayIso);
  const [chkPartyName, setChkPartyName] = useState('');
  const [chkCuit, setChkCuit] = useState('');
  const [chkBranch, setChkBranch] = useState('Pampero Maipú');
  const [chkAmount, setChkAmount] = useState('');
  const [chkStatus, setChkStatus] = useState<FinancialCheckStatus>('en_cartera');
  const [chkNotes, setChkNotes] = useState('');
  const [isSavingCheck, setIsSavingCheck] = useState(false);

  // Petty Cash State
  const [pcBranchFilter, setPcBranchFilter] = useState<string>('todas');
  const [pcTypeFilter, setPcTypeFilter] = useState<'all' | PettyCashMovementType>('all');
  const [pcSearch, setPcSearch] = useState('');
  const [showPcModal, setShowPcModal] = useState(false);
  const [editingPc, setEditingPc] = useState<PettyCashMovement | null>(null);
  const [confirmDeletePcId, setConfirmDeletePcId] = useState<string | null>(null);

  // Petty Cash Form State
  const [pcBranch, setPcBranch] = useState('Pampero Maipú');
  const [pcDate, setPcDate] = useState(todayIso);
  const [pcType, setPcType] = useState<PettyCashMovementType>('egreso');
  const [pcCategory, setPcCategory] = useState(PETTY_CASH_CATEGORIES[1]);
  const [pcConcept, setPcConcept] = useState('');
  const [pcAmount, setPcAmount] = useState('');
  const [pcReceipt, setPcReceipt] = useState('');
  const [pcResponsible, setPcResponsible] = useState(
    userSession.clientData?.fullName || userSession.email?.split('@')[0] || 'Operador'
  );
  const [pcNotes, setPcNotes] = useState('');
  const [isSavingPc, setIsSavingPc] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  useEffect(() => {
    const unsubExp = subscribeToCRMExpenses(setExpenses);
    const unsubSales = subscribeToCRMSales(setSales);
    const unsubOrders = subscribeToCRMOrders(setOrders);
    const unsubCats = subscribeToCostCategories((cats) => {
      if (Array.isArray(cats) && cats.length > 0) {
        setCostCategories(cats.map(sanitizeObjectEncoding));
      }
    });
    const unsubChecks = subscribeToFinancialChecks(setChecks);
    const unsubPc = subscribeToPettyCashMovements(setPettyCash);
    const unsubInv = subscribeToExpenseInvoices(setInvoices);
    const unsubBranches = subscribeToFirestoreBranches((list) => {
      if (Array.isArray(list) && list.length > 0) setRemoteBranches(list);
    });
    const unsubKanban = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanyColumns(data.companies);
      }
    });
    const unsubReads = subscribeToReadNotifications(notifUserKey, setReadNotifIds);
    return () => {
      unsubExp();
      unsubSales();
      unsubOrders();
      unsubCats();
      unsubChecks();
      unsubPc();
      unsubInv();
      unsubBranches();
      unsubKanban();
      unsubReads();
    };
  }, [notifUserKey]);

  const branchOptions = useMemo(() => {
    const source = (remoteBranches && remoteBranches.length > 0 ? remoteBranches : propBranches) || [];
    return getConfiguredBranchNames(source);
  }, [remoteBranches, propBranches]);

  const branchMatches = (recordBranch: string | undefined, targetBranch: string): boolean => {
    if (targetBranch === 'todas') return true;
    const a = normalizeBranchKey(recordBranch || '');
    const b = normalizeBranchKey(targetBranch);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  };

  const activeOperatorName =
    userSession.clientData?.fullName ||
    (userSession.role === 'admin' ? 'Administrador General' : userSession.email?.split('@')[0] || 'Encargado');

  // --- LIVE FINANCIAL NOTIFICATIONS (Facturas + Cheques + Pedidos sin Monto) ---
  interface FinancialAlertItem {
    id: string;
    kind:
      | 'invoice_overdue'
      | 'invoice_soon'
      | 'check_overdue'
      | 'check_soon'
      | 'check_rejected'
      | 'missing_order_amount';
    severity: 'high' | 'medium';
    title: string;
    detail: string;
    date: string;
    amount: number;
    targetTab: CostsSubTab;
    invoiceRef?: ExpenseInvoiceRecord;
  }

  const normalizeColKey = (val?: string): string =>
    (val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const resolveOrderColumnId = (ord: CRMOrder): string => {
    const raw = String((ord as any).columnId || ord.status || '').trim();
    const normRaw = normalizeColKey(raw);
    if (normRaw === 'cancelado') return 'cancelado';
    const matched = companyColumns.find(
      (c) => c.id === raw || normalizeColKey(c.id) === normRaw || normalizeColKey(c.label) === normRaw
    );
    return matched ? matched.id : (companyColumns[0]?.id || 'cotizacion');
  };

  const approvedStartIndex = useMemo(() => {
    const idx = companyColumns.findIndex((c) => {
      const idN = normalizeColKey(c.id);
      const lbN = normalizeColKey(c.label);
      return idN.includes('sena') || idN.includes('aprob') || lbN.includes('sena') || lbN.includes('aprob');
    });
    return idx >= 0 ? idx : Math.min(1, Math.max(0, companyColumns.length - 1));
  }, [companyColumns]);

  const userAssignedBranch = useMemo(() => {
    const emp = resolveEmployeeRecord(userSession);
    const raw = String((userSession as any)?.branch || emp?.branch || '').trim();
    if (!raw) return '';
    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const roleKind = (userSession as any)?.sellerRole || emp?.sellerRole;
    if (
      ['todas', 'todos', 'all', 'administracion central', 'gran mendoza'].includes(norm) ||
      roleKind === 'encargado'
    ) {
      return '';
    }
    return resolveConfiguredBranchName(raw, remoteBranches, false);
  }, [userSession, remoteBranches]);

  const financialAlerts = useMemo<FinancialAlertItem[]>(() => {
    const list: FinancialAlertItem[] = [];

    // Pedidos desde Aprobado / SEÑA 50% inclusive en adelante sin monto cargado
    // Solo se notifica a la sucursal encargada del pedido (o administración general sin sucursal fija)
    orders.forEach((ord) => {
      if (userAssignedBranch && !branchMatches(ord.branch, userAssignedBranch)) return;
      const colId = resolveOrderColumnId(ord);
      if (colId === 'cancelado') return;
      const stageIdx = companyColumns.findIndex((c) => c.id === colId);
      if (stageIdx < approvedStartIndex) return;
      if ((Number(ord.totalEstimated) || 0) > 0) return;
      const stageLabel = fixUtf8Encoding(companyColumns[stageIdx]?.label || colId);
      const code = ord.trackingCode || ord.orderNumber || `#${ord.id.slice(-6)}`;
      list.push({
        id: `ord_no_amt_${ord.id}_${colId}`,
        kind: 'missing_order_amount',
        severity: stageIdx > approvedStartIndex ? 'high' : 'medium',
        title: `Cargar monto de pedido: ${fixUtf8Encoding(ord.clientName)} (${code})`,
        detail: `Etapa: ${stageLabel} · Sucursal: ${fixUtf8Encoding(resolveConfiguredBranchName(ord.branch, remoteBranches, false))} · Asesor: ${ord.seller || 'Sin asignar'}`,
        date: (ord.date || todayIso).slice(0, 10),
        amount: 0,
        targetTab: 'dashboard',
      });
    });

    invoices.forEach((inv) => {
      if (inv.status !== 'pendiente' || !inv.dueDate) return;
      const days = getDaysDiffFromToday(inv.dueDate, todayIso);
      const warnWindow = typeof inv.notifyDaysBefore === 'number' ? inv.notifyDaysBefore : 5;

      if (days < 0) {
        list.push({
          id: `inv_over_${inv.id}_${inv.dueDate}`,
          kind: 'invoice_overdue',
          severity: 'high',
          title: `Factura vencida hace ${Math.abs(days)} día(s): ${fixUtf8Encoding(inv.supplierOrEntity)}`,
          detail: `${inv.invoiceType} #${inv.invoiceNumber} · ${fixUtf8Encoding(inv.branch)} · Venció ${inv.dueDate}`,
          date: inv.dueDate,
          amount: Number(inv.amount) || 0,
          targetTab: 'invoices',
          invoiceRef: inv,
        });
      } else if (days <= warnWindow) {
        list.push({
          id: `inv_soon_${inv.id}_${inv.dueDate}`,
          kind: 'invoice_soon',
          severity: days <= 2 ? 'high' : 'medium',
          title:
            days === 0
              ? `Vence HOY: ${fixUtf8Encoding(inv.supplierOrEntity)}`
              : `Vence en ${days} día(s): ${fixUtf8Encoding(inv.supplierOrEntity)}`,
          detail: `${inv.invoiceType} #${inv.invoiceNumber} · ${fixUtf8Encoding(inv.branch)} · Vto ${inv.dueDate}`,
          date: inv.dueDate,
          amount: Number(inv.amount) || 0,
          targetTab: 'invoices',
          invoiceRef: inv,
        });
      }
    });

    checks.forEach((chk) => {
      if (chk.status === 'rechazado') {
        list.push({
          id: `chk_rej_${chk.id}`,
          kind: 'check_rejected',
          severity: 'high',
          title: `Cheque rechazado #${chk.checkNumber} (${fixUtf8Encoding(chk.bank)})`,
          detail: `${fixUtf8Encoding(chk.partyName)} · ${fixUtf8Encoding(chk.branch)}`,
          date: chk.dueDate,
          amount: Number(chk.amount) || 0,
          targetTab: 'checks',
        });
        return;
      }

      const isActive =
        chk.status === 'en_cartera' || chk.status === 'depositado' || chk.status === 'pendiente_debito';
      if (!isActive || !chk.dueDate) return;

      const days = getDaysDiffFromToday(chk.dueDate, todayIso);
      if (days < 0) {
        list.push({
          id: `chk_over_${chk.id}_${chk.dueDate}`,
          kind: 'check_overdue',
          severity: 'high',
          title: `Cheque ${chk.direction === 'emitido' ? 'emitido' : 'recibido'} vencido #${chk.checkNumber}`,
          detail: `${fixUtf8Encoding(chk.partyName)} · ${fixUtf8Encoding(chk.bank)} · Venció ${chk.dueDate}`,
          date: chk.dueDate,
          amount: Number(chk.amount) || 0,
          targetTab: 'checks',
        });
      } else if (days <= 5) {
        list.push({
          id: `chk_soon_${chk.id}_${chk.dueDate}`,
          kind: 'check_soon',
          severity: days <= 1 ? 'high' : 'medium',
          title:
            days === 0
              ? `Cheque #${chk.checkNumber} vence HOY`
              : `Cheque #${chk.checkNumber} vence en ${days} día(s)`,
          detail: `${chk.direction === 'emitido' ? 'Débito' : 'Cobro'} · ${fixUtf8Encoding(chk.partyName)} (${fixUtf8Encoding(chk.bank)})`,
          date: chk.dueDate,
          amount: Number(chk.amount) || 0,
          targetTab: 'checks',
        });
      }
    });

    return list.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return (a.date || '').localeCompare(b.date || '');
    });
  }, [orders, companyColumns, approvedStartIndex, remoteBranches, invoices, checks, todayIso]);

  const unreadAlertsCount = useMemo(
    () => financialAlerts.filter((a) => !readNotifIds.includes(a.id)).length,
    [financialAlerts, readNotifIds]
  );

  const markAlertAsRead = async (id: string) => {
    if (readNotifIds.includes(id)) return;
    const next = [...readNotifIds, id];
    setReadNotifIds(next);
    await saveReadNotifications(notifUserKey, next);
  };

  const markAllAlertsRead = async () => {
    const next = Array.from(new Set([...readNotifIds, ...financialAlerts.map((a) => a.id)]));
    setReadNotifIds(next);
    await saveReadNotifications(notifUserKey, next);
  };

  // --- DASHBOARD METRICS ---
  const dashboardStats = useMemo(() => {
    const matchMonth = (dateStr?: string) => !dashMonth || (dateStr || '').startsWith(dashMonth);

    const periodSales = sales.filter((s) => matchMonth(s.date) && branchMatches(s.branch, dashBranch));
    const periodExpenses = expenses.filter((e) => matchMonth(e.date) && branchMatches(e.branch, dashBranch));

    const totalSales = periodSales.reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);
    const fixedCosts = periodExpenses
      .filter((e) => e.type === 'Fijo')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const variableCosts = periodExpenses
      .filter((e) => e.type !== 'Fijo')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalCosts = fixedCosts + variableCosts;
    const operatingResult = totalSales - totalCosts;
    const marginPct = totalSales > 0 ? Math.round((operatingResult / totalSales) * 1000) / 10 : 0;

    // Petty Cash cumulative balance across configured branches
    const filteredPc = pettyCash.filter((m) => branchMatches(m.branch, dashBranch));
    const totalPettyCashBalance = filteredPc.reduce(
      (acc, m) => acc + (m.movementType === 'ingreso' ? Number(m.amount) || 0 : -(Number(m.amount) || 0)),
      0
    );

    // Checks Liquidity
    const filteredChecks = checks.filter((c) => branchMatches(c.branch, dashBranch));
    const receivedActiveChecks = filteredChecks
      .filter((c) => c.direction === 'recibido' && (c.status === 'en_cartera' || c.status === 'depositado'))
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const receivedCashedChecks = filteredChecks
      .filter((c) => c.direction === 'recibido' && c.status === 'cobrado')
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const issuedPendingChecks = filteredChecks
      .filter((c) => c.direction === 'emitido' && c.status === 'pendiente_debito')
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const rejectedChecksCount = filteredChecks.filter((c) => c.status === 'rechazado').length;

    // Unpaid Invoices Commitments
    const filteredInvoices = invoices.filter((i) => branchMatches(i.branch, dashBranch));
    const pendingInvoices = filteredInvoices.filter((i) => i.status === 'pendiente');
    const pendingInvoicesTotal = pendingInvoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const overdueInvoicesCount = pendingInvoices.filter((i) => (i.dueDate || '') < todayIso).length;
    const overdueInvoicesTotal = pendingInvoices
      .filter((i) => (i.dueDate || '') < todayIso)
      .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

    const netLiquidity =
      totalPettyCashBalance + receivedActiveChecks - issuedPendingChecks - pendingInvoicesTotal + operatingResult;

    // Pipeline CRM (desglose por pasos de Seguimiento de Pedidos)
    const branchFilteredOrders = orders.filter(
      (o) => resolveOrderColumnId(o) !== 'cancelado' && branchMatches(o.branch, dashBranch)
    );

    const pipelineStages = companyColumns.map((col, idx) => {
      const stageOrders = branchFilteredOrders.filter((o) => resolveOrderColumnId(o) === col.id);
      const totalAmount = stageOrders.reduce((acc, o) => acc + (Number(o.totalEstimated) || 0), 0);
      const missingAmountCount = stageOrders.filter((o) => !(Number(o.totalEstimated) > 0)).length;
      const isClosedCol =
        normalizeColKey(col.id) === 'entregado' ||
        normalizeColKey(col.label).includes('entregado') ||
        normalizeColKey(col.label).includes('cerrado');
      return {
        id: col.id,
        label: fixUtf8Encoding(col.label),
        color: col.color || '#18231C',
        count: stageOrders.length,
        totalAmount,
        missingAmountCount,
        isClosedCol,
        isApprovedOrLater: idx >= approvedStartIndex,
      };
    });

    const activeOrders = branchFilteredOrders.filter((o) => {
      const colId = resolveOrderColumnId(o);
      const stg = pipelineStages.find((s) => s.id === colId);
      return !stg?.isClosedCol;
    });
    const pipelineTotal = activeOrders.reduce((acc, o) => acc + (Number(o.totalEstimated) || 0), 0);

    // Branch breakdown
    const branchBreakdown = branchOptions.map((bName) => {
      const bPc = pettyCash
        .filter((m) => branchMatches(m.branch, bName))
        .reduce((acc, m) => acc + (m.movementType === 'ingreso' ? Number(m.amount) || 0 : -(Number(m.amount) || 0)), 0);
      const bSales = sales
        .filter((s) => matchMonth(s.date) && branchMatches(s.branch, bName))
        .reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);
      const bCosts = expenses
        .filter((e) => matchMonth(e.date) && branchMatches(e.branch, bName))
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const bInvoicesDue = invoices
        .filter((i) => i.status === 'pendiente' && branchMatches(i.branch, bName))
        .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
      const bChecksIn = checks
        .filter((c) => c.direction === 'recibido' && (c.status === 'en_cartera' || c.status === 'depositado') && branchMatches(c.branch, bName))
        .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      const bChecksOut = checks
        .filter((c) => c.direction === 'emitido' && c.status === 'pendiente_debito' && branchMatches(c.branch, bName))
        .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      return {
        branch: bName,
        pettyCashBalance: bPc,
        sales: bSales,
        costs: bCosts,
        netResult: bSales - bCosts,
        pendingInvoices: bInvoicesDue,
        checksNet: bChecksIn - bChecksOut,
      };
    });

    // Combined upcoming maturities (15 days + overdue) for invoices & checks
    const in15Days = new Date();
    in15Days.setDate(in15Days.getDate() + 15);
    const in15Iso = in15Days.toISOString().split('T')[0];

    const upcomingMaturities: Array<{
      id: string;
      kind: 'invoice' | 'check';
      dueDate: string;
      label: string;
      number: string;
      entity: string;
      branch: string;
      statusLabel: string;
      amount: number;
      isInflow: boolean;
    }> = [];

    filteredInvoices
      .filter((i) => i.status === 'pendiente' && (i.dueDate || '') <= in15Iso)
      .forEach((i) => {
        upcomingMaturities.push({
          id: `mat_inv_${i.id}`,
          kind: 'invoice',
          dueDate: i.dueDate,
          label: `Factura (${i.invoiceType})`,
          number: i.invoiceNumber,
          entity: i.supplierOrEntity,
          branch: i.branch,
          statusLabel: 'Pendiente pago',
          amount: Number(i.amount) || 0,
          isInflow: false,
        });
      });

    filteredChecks
      .filter(
        (c) =>
          (c.status === 'en_cartera' || c.status === 'depositado' || c.status === 'pendiente_debito') &&
          (c.dueDate || '') <= in15Iso
      )
      .forEach((c) => {
        upcomingMaturities.push({
          id: `mat_chk_${c.id}`,
          kind: 'check',
          dueDate: c.dueDate,
          label: c.direction === 'recibido' ? 'Cheque Recibido' : 'Cheque Emitido',
          number: c.checkNumber,
          entity: `${c.partyName} · ${c.bank}`,
          branch: c.branch,
          statusLabel: CHECK_STATUS_LABELS[c.status],
          amount: Number(c.amount) || 0,
          isInflow: c.direction === 'recibido',
        });
      });

    upcomingMaturities.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    return {
      totalSales,
      fixedCosts,
      variableCosts,
      totalCosts,
      operatingResult,
      marginPct,
      totalPettyCashBalance,
      receivedActiveChecks,
      receivedCashedChecks,
      issuedPendingChecks,
      rejectedChecksCount,
      pendingInvoicesCount: pendingInvoices.length,
      pendingInvoicesTotal,
      overdueInvoicesCount,
      overdueInvoicesTotal,
      netLiquidity,
      activeOrdersCount: activeOrders.length,
      pipelineTotal,
      pipelineStages,
      allOrdersCount: branchFilteredOrders.length,
      allOrdersTotal: branchFilteredOrders.reduce((acc, o) => acc + (Number(o.totalEstimated) || 0), 0),
      branchBreakdown,
      upcomingMaturities,
    };
  }, [sales, expenses, orders, checks, pettyCash, invoices, dashMonth, dashBranch, branchOptions, companyColumns, approvedStartIndex, todayIso]);

  // --- INVOICE HANDLERS ---
  const openNewInvoiceModal = () => {
    setEditingInvoice(null);
    setInvType('Factura A');
    setInvNumber('');
    setInvSupplier('');
    setInvCuit('');
    const firstCat = costCategories[0]?.name || 'Alquiler y expensas';
    setInvCategory(firstCat);
    setInvCostType(costCategories[0]?.defaultType || 'Fijo');
    setInvBranch(branchOptions[0] || 'Pampero Maipú');
    setInvIssueDate(todayIso);
    setInvDueDate(todayIso);
    setInvAmount('');
    setInvStatus('pendiente');
    setInvNotifyDays('5');
    setInvPaymentMethod('Transferencia');
    setInvPaidDate(todayIso);
    setInvAttachmentUrl('');
    setInvAttachmentName('');
    setInvSyncExpense(true);
    setInvSyncCalendar(true);
    setInvNotes('');
    setShowInvoiceModal(true);
  };

  const openEditInvoiceModal = (inv: ExpenseInvoiceRecord) => {
    setEditingInvoice(inv);
    setInvType(inv.invoiceType || 'Factura A');
    setInvNumber(inv.invoiceNumber || '');
    setInvSupplier(inv.supplierOrEntity || '');
    setInvCuit(inv.cuit || '');
    setInvCategory(inv.category || costCategories[0]?.name || 'Otros Gastos');
    setInvCostType(inv.costType || 'Fijo');
    setInvBranch(resolveConfiguredBranchName(inv.branch, remoteBranches, false) || branchOptions[0] || 'Pampero Maipú');
    setInvIssueDate(inv.issueDate || todayIso);
    setInvDueDate(inv.dueDate || todayIso);
    setInvAmount(String(inv.amount || ''));
    setInvStatus(inv.status || 'pendiente');
    setInvNotifyDays(String(typeof inv.notifyDaysBefore === 'number' ? inv.notifyDaysBefore : 5));
    setInvPaymentMethod(inv.paymentMethod || 'Transferencia');
    setInvPaidDate(inv.paidDate || todayIso);
    setInvAttachmentUrl(inv.attachmentUrl || '');
    setInvAttachmentName(inv.attachmentName || '');
    setInvSyncExpense(Boolean(inv.linkedExpenseId));
    setInvSyncCalendar(inv.syncToCalendar !== false);
    setInvNotes(inv.notes || '');
    setShowInvoiceModal(true);
  };

  const handleInvoiceCategoryChange = (catName: string) => {
    setInvCategory(catName);
    const matched = costCategories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    if (matched) {
      setInvCostType(matched.defaultType);
    }
  };

  const handleInvoiceAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 850 * 1024) {
      showToast('El archivo adjunto no debe superar 850 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInvAttachmentUrl(reader.result);
        setInvAttachmentName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invNumber.trim() || !invSupplier.trim() || !(Number(invAmount) > 0)) return;
    setIsSavingInvoice(true);
    try {
      const invId = editingInvoice?.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const parsedAmount = Math.max(0, Number(invAmount) || 0);
      let linkedExpenseId = editingInvoice?.linkedExpenseId;

      if (invSyncExpense && invStatus !== 'anulada') {
        const expId = linkedExpenseId || `exp-inv-${invId}`;
        const expRecord: CRMExpense = sanitizeObjectEncoding({
          id: expId,
          date: invStatus === 'pagada' ? (invPaidDate || todayIso) : (invIssueDate || todayIso),
          branch: invBranch,
          type: invCostType,
          category: invCategory,
          amount: parsedAmount,
          detail: `${invType} #${invNumber.trim()} · ${invSupplier.trim()}`,
          registeredBy: activeOperatorName,
          createdAt: editingInvoice?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await saveCRMExpense(expRecord);
        linkedExpenseId = expId;
      }

      const record: ExpenseInvoiceRecord = sanitizeObjectEncoding({
        id: invId,
        invoiceType: invType,
        invoiceNumber: invNumber.trim(),
        supplierOrEntity: invSupplier.trim(),
        cuit: invCuit.trim() || undefined,
        category: invCategory,
        costType: invCostType,
        branch: invBranch,
        issueDate: invIssueDate || todayIso,
        dueDate: invDueDate || invIssueDate || todayIso,
        amount: parsedAmount,
        status: invStatus,
        notifyDaysBefore: Math.max(0, Number(invNotifyDays) || 0),
        paidDate: invStatus === 'pagada' ? (invPaidDate || todayIso) : undefined,
        paymentMethod: invStatus === 'pagada' ? invPaymentMethod : undefined,
        linkedExpenseId,
        syncToCalendar: invSyncCalendar,
        attachmentUrl: invAttachmentUrl || undefined,
        attachmentName: invAttachmentName || undefined,
        notes: invNotes.trim() || undefined,
        registeredBy: activeOperatorName,
        createdAt: editingInvoice?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setInvoices((prev) => [record, ...prev.filter((x) => x.id !== record.id)]);
      await saveExpenseInvoice(record);
      await upsertInvoiceDueCalendarEvent(record, activeOperatorName, userSession.email);
      setShowInvoiceModal(false);
      showToast(editingInvoice ? 'Factura actualizada correctamente' : 'Factura y vencimiento registrados');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const openPayInvoiceModal = (inv: ExpenseInvoiceRecord) => {
    setPayInvoiceTarget(inv);
    setPayDate(todayIso);
    setPayMethod(inv.paymentMethod || 'Transferencia');
    setPayDeductPettyCash(false);
    setPayRegisterExpense(!inv.linkedExpenseId);
  };

  const handleConfirmPayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoiceTarget) return;
    setIsPayingInvoice(true);
    try {
      let linkedExpenseId = payInvoiceTarget.linkedExpenseId;

      if (payRegisterExpense && !linkedExpenseId) {
        const expId = `exp-inv-${payInvoiceTarget.id}`;
        const expRecord: CRMExpense = sanitizeObjectEncoding({
          id: expId,
          date: payDate || todayIso,
          branch: payInvoiceTarget.branch,
          type: payInvoiceTarget.costType,
          category: payInvoiceTarget.category,
          amount: Number(payInvoiceTarget.amount) || 0,
          detail: `${payInvoiceTarget.invoiceType} #${payInvoiceTarget.invoiceNumber} · ${payInvoiceTarget.supplierOrEntity}`,
          registeredBy: activeOperatorName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await saveCRMExpense(expRecord);
        linkedExpenseId = expId;
      }

      if (payDeductPettyCash) {
        const pcMovement: PettyCashMovement = sanitizeObjectEncoding({
          id: `pc-inv-${payInvoiceTarget.id}-${Date.now()}`,
          branch: payInvoiceTarget.branch,
          date: payDate || todayIso,
          movementType: 'egreso',
          category: 'Pago de Factura / Servicio',
          concept: `Pago ${payInvoiceTarget.invoiceType} #${payInvoiceTarget.invoiceNumber} (${payInvoiceTarget.supplierOrEntity})`,
          amount: Number(payInvoiceTarget.amount) || 0,
          receiptNumber: payInvoiceTarget.invoiceNumber,
          responsible: activeOperatorName,
          notes: `Pago registrado desde Facturas y Vencimientos`,
          registeredBy: activeOperatorName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setPettyCash((prev) => [pcMovement, ...prev]);
        await savePettyCashMovement(pcMovement);
      }

      const updated: ExpenseInvoiceRecord = {
        ...payInvoiceTarget,
        status: 'pagada',
        paidDate: payDate || todayIso,
        paymentMethod: payMethod,
        linkedExpenseId,
        updatedAt: new Date().toISOString(),
      };
      setInvoices((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      await saveExpenseInvoice(updated);
      await upsertInvoiceDueCalendarEvent(updated, activeOperatorName, userSession.email);
      setPayInvoiceTarget(null);
      showToast(`Factura #${updated.invoiceNumber} marcada como Pagada`);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    setConfirmDeleteInvId(null);
    await deleteExpenseInvoice(id);
    showToast('Factura eliminada');
  };

  const invoiceSummary = useMemo(() => {
    let pendingTotal = 0;
    let pendingCount = 0;
    let overdueTotal = 0;
    let overdueCount = 0;
    let soonTotal = 0;
    let soonCount = 0;
    let paidMonthTotal = 0;
    let paidMonthCount = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.amount) || 0;
      if (inv.status === 'pendiente') {
        pendingTotal += amt;
        pendingCount += 1;
        const days = getDaysDiffFromToday(inv.dueDate, todayIso);
        if (days < 0) {
          overdueTotal += amt;
          overdueCount += 1;
        } else if (days <= 7) {
          soonTotal += amt;
          soonCount += 1;
        }
      } else if (inv.status === 'pagada' && (inv.paidDate || inv.issueDate || '').startsWith(currentMonthStr)) {
        paidMonthTotal += amt;
        paidMonthCount += 1;
      }
    });

    return {
      pendingTotal,
      pendingCount,
      overdueTotal,
      overdueCount,
      soonTotal,
      soonCount,
      paidMonthTotal,
      paidMonthCount,
    };
  }, [invoices, todayIso, currentMonthStr]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invCostTypeFilter !== 'all' && inv.costType !== invCostTypeFilter) return false;
      if (!branchMatches(inv.branch, invBranchFilter)) return false;

      if (invStatusFilter === 'pendiente' && inv.status !== 'pendiente') return false;
      if (invStatusFilter === 'pagada' && inv.status !== 'pagada') return false;
      if (invStatusFilter === 'anulada' && inv.status !== 'anulada') return false;
      if (invStatusFilter === 'vencidas') {
        if (inv.status !== 'pendiente' || getDaysDiffFromToday(inv.dueDate, todayIso) >= 0) return false;
      }
      if (invStatusFilter === 'por_vencer') {
        const d = getDaysDiffFromToday(inv.dueDate, todayIso);
        if (inv.status !== 'pendiente' || d < 0 || d > 7) return false;
      }

      if (invSearch.trim()) {
        const q = invSearch.toLowerCase();
        const hit =
          (inv.supplierOrEntity || '').toLowerCase().includes(q) ||
          (inv.invoiceNumber || '').toLowerCase().includes(q) ||
          (inv.cuit || '').toLowerCase().includes(q) ||
          (inv.category || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [invoices, invStatusFilter, invCostTypeFilter, invBranchFilter, invSearch, todayIso]);

  // --- CHECKS HANDLERS ---
  const openNewCheckModal = (defaultDir: FinancialCheckDirection = 'recibido') => {
    setEditingCheck(null);
    setChkDirection(defaultDir);
    setChkMode('diferido');
    setChkNumber('');
    setChkBank('');
    setChkIssueDate(todayIso);
    setChkDueDate(todayIso);
    setChkPartyName('');
    setChkCuit('');
    setChkBranch(branchOptions[0] || 'Pampero Maipú');
    setChkAmount('');
    setChkStatus(defaultDir === 'emitido' ? 'pendiente_debito' : 'en_cartera');
    setChkNotes('');
    setShowCheckModal(true);
  };

  const openEditCheckModal = (c: FinancialCheckRecord) => {
    setEditingCheck(c);
    setChkDirection(c.direction);
    setChkMode(c.checkMode);
    setChkNumber(c.checkNumber);
    setChkBank(c.bank);
    setChkIssueDate(c.issueDate);
    setChkDueDate(c.dueDate);
    setChkPartyName(c.partyName);
    setChkCuit(c.cuitOrDni || '');
    setChkBranch(resolveConfiguredBranchName(c.branch, remoteBranches, false) || branchOptions[0] || 'Pampero Maipú');
    setChkAmount(String(c.amount || ''));
    setChkStatus(c.status);
    setChkNotes(c.notes || '');
    setShowCheckModal(true);
  };

  const handleSaveCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkNumber.trim() || !chkBank.trim() || !chkPartyName.trim()) return;
    setIsSavingCheck(true);
    try {
      const record: FinancialCheckRecord = sanitizeObjectEncoding({
        id: editingCheck?.id || `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: chkDirection,
        checkMode: chkMode,
        checkNumber: chkNumber.trim(),
        bank: chkBank.trim(),
        issueDate: chkIssueDate || todayIso,
        dueDate: chkDueDate || chkIssueDate || todayIso,
        partyName: chkPartyName.trim(),
        cuitOrDni: chkCuit.trim() || undefined,
        branch: resolveConfiguredBranchName(chkBranch, remoteBranches, false) || branchOptions[0] || 'Pampero Maipú',
        amount: Math.max(0, Number(chkAmount) || 0),
        status: chkStatus,
        notes: chkNotes.trim() || undefined,
        registeredBy: activeOperatorName,
        createdAt: editingCheck?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setChecks((prev) => [record, ...prev.filter((c) => c.id !== record.id)]);
      await saveFinancialCheck(record);
      setShowCheckModal(false);
      showToast(editingCheck ? 'Cheque actualizado correctamente' : 'Cheque registrado en cartera');
    } finally {
      setIsSavingCheck(false);
    }
  };

  const handleQuickCheckStatus = async (c: FinancialCheckRecord, nextStatus: FinancialCheckStatus) => {
    const updated: FinancialCheckRecord = {
      ...c,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    setChecks((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
    await saveFinancialCheck(updated);
    showToast(`Cheque #${c.checkNumber} marcado como "${CHECK_STATUS_LABELS[nextStatus]}"`);
  };

  const handleDeleteCheck = async (id: string) => {
    setChecks((prev) => prev.filter((c) => c.id !== id));
    setConfirmDeleteCheckId(null);
    await deleteFinancialCheck(id);
    showToast('Cheque eliminado');
  };

  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      if (checkDirectionFilter !== 'all' && c.direction !== checkDirectionFilter) return false;
      if (checkStatusFilter !== 'all' && c.status !== checkStatusFilter) return false;
      if (!branchMatches(c.branch, checkBranchFilter)) return false;
      if (checkSearch.trim()) {
        const q = checkSearch.toLowerCase();
        const hit =
          (c.checkNumber || '').toLowerCase().includes(q) ||
          (c.bank || '').toLowerCase().includes(q) ||
          (c.partyName || '').toLowerCase().includes(q) ||
          (c.cuitOrDni || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [checks, checkDirectionFilter, checkStatusFilter, checkBranchFilter, checkSearch]);

  // --- PETTY CASH HANDLERS ---
  const openNewPcModal = (defaultType: PettyCashMovementType, branchOverride?: string) => {
    setEditingPc(null);
    setPcBranch(
      resolveConfiguredBranchName(
        branchOverride || (pcBranchFilter !== 'todas' ? pcBranchFilter : branchOptions[0]),
        remoteBranches,
        false
      ) || branchOptions[0] || 'Pampero Maipú'
    );
    setPcDate(todayIso);
    setPcType(defaultType);
    setPcCategory(defaultType === 'ingreso' ? 'Reposición de Caja' : PETTY_CASH_CATEGORIES[1]);
    setPcConcept('');
    setPcAmount('');
    setPcReceipt('');
    setPcResponsible(activeOperatorName);
    setPcNotes('');
    setShowPcModal(true);
  };

  const openEditPcModal = (m: PettyCashMovement) => {
    setEditingPc(m);
    setPcBranch(resolveConfiguredBranchName(m.branch, remoteBranches, false) || branchOptions[0] || 'Pampero Maipú');
    setPcDate(m.date);
    setPcType(m.movementType);
    setPcCategory(m.category);
    setPcConcept(m.concept);
    setPcAmount(String(m.amount || ''));
    setPcReceipt(m.receiptNumber || '');
    setPcResponsible(m.responsible || activeOperatorName);
    setPcNotes(m.notes || '');
    setShowPcModal(true);
  };

  const handleSavePc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcConcept.trim() || !(Number(pcAmount) > 0)) return;
    setIsSavingPc(true);
    try {
      const record: PettyCashMovement = sanitizeObjectEncoding({
        id: editingPc?.id || `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        branch: pcBranch,
        date: pcDate || todayIso,
        movementType: pcType,
        category: pcCategory,
        concept: pcConcept.trim(),
        amount: Math.max(0, Number(pcAmount) || 0),
        receiptNumber: pcReceipt.trim() || undefined,
        responsible: pcResponsible.trim() || activeOperatorName,
        notes: pcNotes.trim() || undefined,
        registeredBy: activeOperatorName,
        createdAt: editingPc?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setPettyCash((prev) => [record, ...prev.filter((m) => m.id !== record.id)]);
      await savePettyCashMovement(record);
      setShowPcModal(false);
      showToast(editingPc ? 'Movimiento de caja actualizado' : 'Movimiento de caja chica registrado');
    } finally {
      setIsSavingPc(false);
    }
  };

  const handleDeletePc = async (id: string) => {
    setPettyCash((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeletePcId(null);
    await deletePettyCashMovement(id);
    showToast('Movimiento eliminado de caja chica');
  };

  const branchPettyCashSummaries = useMemo(() => {
    return branchOptions.map((bName) => {
      const rows = pettyCash.filter((m) => branchMatches(m.branch, bName));
      const ingresos = rows
        .filter((m) => m.movementType === 'ingreso')
        .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
      const egresos = rows
        .filter((m) => m.movementType === 'egreso')
        .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
      return {
        branch: bName,
        ingresos,
        egresos,
        balance: ingresos - egresos,
        count: rows.length,
        lastDate: rows[0]?.date || '-',
      };
    });
  }, [pettyCash, branchOptions]);

  const filteredPettyCash = useMemo(() => {
    return pettyCash.filter((m) => {
      if (!branchMatches(m.branch, pcBranchFilter)) return false;
      if (pcTypeFilter !== 'all' && m.movementType !== pcTypeFilter) return false;
      if (pcSearch.trim()) {
        const q = pcSearch.toLowerCase();
        const hit =
          (m.concept || '').toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q) ||
          (m.responsible || '').toLowerCase().includes(q) ||
          (m.receiptNumber || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [pettyCash, pcBranchFilter, pcTypeFilter, pcSearch]);

  const defaultBranch = userSession.branch && userSession.branch !== 'Todas'
    ? userSession.branch
    : branchOptions[0] || 'Maipú';

  const costsNavCategories: Array<{
    title: string;
    tabs: Array<{ key: CostsSubTab; label: string; icon: any; badge: number }>;
  }> = [
    {
      title: 'Situación & Control',
      tabs: [
        { key: 'dashboard', label: st?.costsTabDashboardText || '1. Dashboard & Liquidez', icon: LayoutDashboard, badge: 0 },
        { key: 'costs', label: st?.costsTabCostsText || '2. Costos y Ventas', icon: Receipt, badge: 0 },
      ],
    },
    {
      title: 'Comprobantes & Caja',
      tabs: [
        {
          key: 'invoices',
          label: st?.costsTabInvoicesText || '3. Facturas y Vencimientos',
          icon: FileText,
          badge: invoiceSummary.overdueCount + invoiceSummary.soonCount,
        },
        { key: 'checks', label: st?.costsTabChecksText || '4. Cheques Emitidos y Recibidos', icon: FileSpreadsheet, badge: 0 },
        { key: 'petty_cash', label: st?.costsTabPettyCashText || '5. Caja Chica por Local', icon: Store, badge: 0 },
      ],
    },
  ];

  const activeTabMeta = (() => {
    for (const cat of costsNavCategories) {
      const found = cat.tabs.find((t) => t.key === activeTab);
      if (found) return { category: cat.title, ...found };
    }
    return {
      category: 'Situación & Control',
      key: 'dashboard' as CostsSubTab,
      label: st?.costsTabDashboardText || '1. Dashboard & Liquidez',
      icon: LayoutDashboard,
      badge: 0,
    };
  })();
  const ActiveTabIcon = activeTabMeta.icon;

  const sidebarBg = theme?.sidebarBgColor || theme?.primaryColor || '#18231C';
  const isSidebarDark = isColorDark(sidebarBg);
  const sidebarText = theme?.sidebarTextColor || (isSidebarDark ? '#DCD4C9' : '#18231C');
  const sidebarActiveBg = theme?.sidebarActiveBgColor || (isSidebarDark ? '#2B3B30' : '#ECE5DC');
  const sidebarAccent = theme?.sidebarAccentColor || theme?.accentColor || '#FDB813';
  const sidebarMutedText = isSidebarDark ? '#A69E94' : '#6F6860';
  const sidebarBorderClass = isSidebarDark ? 'border-white/10' : 'border-black/10';

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#FAF8F5] text-[#18231C] w-screen h-screen overflow-hidden animate-fadeIn font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-2xs"
        />
      )}

      {/* SIDEBAR NAVIGATION (Unified & Collapsible) */}
      <aside
        style={{ backgroundColor: sidebarBg, color: isSidebarDark ? '#FFFFFF' : '#18231C' }}
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-full transition-all duration-200 ease-in-out shrink-0 ${
          isMobileSidebarOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full md:translate-x-0'
        } ${
          isDesktopSidebarCollapsed
            ? 'md:w-0 md:overflow-hidden md:border-r-0'
            : 'md:w-72 border-r border-black/30'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className={`p-3.5 border-b ${sidebarBorderClass} flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <PamperoLogo
              customUrl={theme?.customLogoUrl || theme?.logoUrl}
              height={theme?.logoHeight ? Math.min(theme.logoHeight, 34) : 30}
              size="sm"
              onDarkBackground={isSidebarDark}
              variant={isSidebarDark ? 'light' : 'dark'}
              navBgColor={sidebarBg}
            />
            <div className="min-w-0 flex-1">
              <h2
                style={{ color: sidebarAccent }}
                className="font-display font-bold text-[13px] uppercase tracking-wide whitespace-normal leading-tight"
              >
                {st?.costsTitle || 'Costos & Finanzas'}
              </h2>
              <span
                style={{ color: sidebarText }}
                className="text-[10px] opacity-80 block whitespace-normal leading-tight mt-0.5"
              >
                {st?.costsSubtitle || 'Gran Mendoza · Tesorería'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDesktopSidebarCollapsed(true)}
            style={{ color: sidebarText }}
            className="hidden md:inline-flex p-1.5 hover:bg-black/15 rounded-xs cursor-pointer shrink-0 transition-colors"
            title="Ocultar barra lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{ color: sidebarText }}
            className="md:hidden p-1.5 hover:bg-black/15 rounded-xs cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {costsNavCategories.map((cat) => (
            <div key={cat.title} className="space-y-1.5">
              <span
                style={{ color: sidebarMutedText }}
                className="px-3 text-[10px] font-black uppercase tracking-[0.18em] block"
              >
                {cat.title}
              </span>
              <div className="space-y-0.5">
                {cat.tabs.map((tab) => {
                  const isSelected = activeTab === tab.key;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.key);
                        setIsMobileSidebarOpen(false);
                      }}
                      style={
                        isSelected
                          ? { backgroundColor: sidebarActiveBg, color: sidebarAccent }
                          : { color: sidebarText }
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xs text-xs font-bold transition-all cursor-pointer group text-left ${
                        isSelected ? 'shadow-xs' : 'hover:bg-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TabIcon
                          style={{ color: isSelected ? sidebarAccent : sidebarMutedText }}
                          className="w-4 h-4 shrink-0 transition-colors"
                        />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {tab.badge > 0 && (
                          <span className="px-1.5 py-0.5 rounded-xs bg-rose-600 text-white text-[10px] font-mono font-bold tabular-nums leading-none">
                            {tab.badge}
                          </span>
                        )}
                        {isSelected && (
                          <span
                            style={{ backgroundColor: sidebarAccent }}
                            className="w-1.5 h-1.5 rounded-full"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Bottom Operator & Return */}
        <div className={`p-3 border-t ${sidebarBorderClass} space-y-2.5 bg-black/15`}>
          <div className={`px-2.5 py-2 rounded-xs bg-white/5 border ${sidebarBorderClass}`}>
            <span
              style={{ color: sidebarMutedText }}
              className="text-[9px] font-bold uppercase tracking-wider block"
            >
              Acceso Autorizado
            </span>
            <span
              style={{ color: isSidebarDark ? '#FFFFFF' : '#18231C' }}
              className="text-xs font-bold truncate block mt-0.5"
            >
              {activeOperatorName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: sidebarActiveBg, color: isSidebarDark ? '#FAF8F5' : '#18231C' }}
            className="w-full py-2 px-3 hover:opacity-90 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{st?.costsBackBtnText || 'Volver al Hub'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA (Locked 100% Width Across All 5 Tabs) */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FAF8F5]">
        {/* Top White Workspace Bar */}
        <header className="bg-white border-b border-[#DCD4C9] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 text-[#18231C] hover:bg-[#FAF8F5] rounded-xs cursor-pointer"
              title="Abrir menú lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            {isDesktopSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopSidebarCollapsed(false)}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold cursor-pointer transition-colors shrink-0"
                title="Mostrar barra lateral"
              >
                <PanelLeftOpen className="w-4 h-4" />
                <span>Menú</span>
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[#6F6860] uppercase font-bold tracking-wider">
                <span>{st?.costsTitle || 'Costos & Finanzas'}</span>
                <ChevronRight className="w-3 h-3 text-[#A69E94]" />
                <span className="text-[#18231C]">{activeTabMeta.category}</span>
              </div>
              <h1 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2 mt-0.5 leading-none truncate">
                <ActiveTabIcon className="w-5 h-5 text-[#18231C] shrink-0" />
                <span className="truncate">{activeTabMeta.label}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {feedbackMsg && (
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xs text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{feedbackMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowNotifModal(true)}
              className="relative px-3 py-1.5 rounded-xs border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Alertas de vencimientos de facturas y cheques"
            >
              <Bell className="w-3.5 h-3.5 text-[#18231C]" />
              <span className="hidden sm:inline">Vencimientos</span>
              {unreadAlertsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-xs bg-rose-600 text-white text-[10px] font-mono font-bold tabular-nums leading-none">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] border border-[#DCD4C9] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{st?.costsBackBtnText || 'Volver al Hub'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Viewport with Permanent Vertical Scrollbar Gutter so Tabs 1-5 Never Shift */}
        <div className="flex-1 overflow-y-scroll min-w-0">
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        {/* === SUB-TAB 1: DASHBOARD & LIQUIDEZ === */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Filters */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                  {st?.costsDashTitle || 'Tablero Ejecutivo de Situación y Liquidez'}
                </h3>
                <p className="text-[11px] text-[#6F6860] mt-0.5">
                  {st?.costsDashSubtitle ||
                    'Consolidado en vivo de caja chica, cartera de cheques, facturas a pagar, ventas y gráficos financieros.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-[#6F6860]">Período:</span>
                  <input
                    type="month"
                    value={dashMonth}
                    onChange={(e) => setDashMonth(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                  {dashMonth && (
                    <button
                      type="button"
                      onClick={() => setDashMonth('')}
                      className="px-2 py-1.5 text-[11px] font-bold border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] rounded-xs cursor-pointer"
                    >
                      Ver Todo
                    </button>
                  )}
                </div>

                <select
                  value={dashBranch}
                  onChange={(e) => setDashBranch(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold text-[#18231C] outline-none cursor-pointer"
                >
                  <option value="todas">Sucursal: Todas</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Primary Liquidity KPI Strip (uniform 4-col grid matching all other tabs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#18231C] text-white border border-[#18231C] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DCD4C9] block">
                  Liquidez Neta Proyectada
                </span>
                <div className="text-xl font-bold font-mono tabular-nums" style={{ color: accent }}>
                  {formatARS(dashboardStats.netLiquidity)}
                </div>
                <p className="text-[11px] text-[#DCD4C9]/85 leading-snug">
                  Cajas + Cheques a cobrar − Emitidos − Facturas impagas + Resultado
                </p>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                  Saldo Cajas Chicas (Locales)
                </span>
                <div className="text-xl font-bold font-mono tabular-nums text-[#18231C]">
                  {formatARS(dashboardStats.totalPettyCashBalance)}
                </div>
                <p className="text-[11px] text-[#6F6860]">
                  Efectivo acumulado en {branchOptions.length} sucursal(es)
                </p>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                  Cartera de Cheques (Neto)
                </span>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                  {formatARS(dashboardStats.receivedActiveChecks - dashboardStats.issuedPendingChecks)}
                </div>
                <p className="text-[11px] text-[#6F6860] tabular-nums">
                  A cobrar: {formatARS(dashboardStats.receivedActiveChecks)} · Emitidos: {formatARS(dashboardStats.issuedPendingChecks)}
                </p>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                  Facturas Pendientes de Pago
                </span>
                <div className={`text-xl font-bold font-mono tabular-nums ${dashboardStats.overdueInvoicesCount > 0 ? 'text-rose-700' : 'text-[#18231C]'}`}>
                  {formatARS(dashboardStats.pendingInvoicesTotal)}
                </div>
                <p className="text-[11px] text-[#6F6860] tabular-nums">
                  {dashboardStats.overdueInvoicesCount > 0
                    ? `${dashboardStats.overdueInvoicesCount} vencida(s) (${formatARS(dashboardStats.overdueInvoicesTotal)})`
                    : `${dashboardStats.pendingInvoicesCount} comprobante(s) por vencer`}
                </p>
              </div>
            </div>

            {/* Interactive Donut & Bar Charts */}
            <CostsChartsSection
              sales={sales}
              expenses={expenses}
              invoices={invoices}
              checks={checks}
              pettyCash={pettyCash}
              branchOptions={branchOptions}
              selectedMonth={dashMonth}
              selectedBranch={dashBranch}
            />

            {/* How the business is performing: Operating summary & CRM Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#ECE5DC] pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                      Resultado Operativo y Desempeño por Local
                    </h4>
                    <span className="text-[11px] text-[#6F6860]">
                      {dashMonth ? `Período seleccionado: ${dashMonth}` : 'Acumulado histórico'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('costs')}
                    className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-[11px] font-bold uppercase rounded-xs cursor-pointer transition-colors"
                  >
                    Cargar Costos / Ventas
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                    <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Ingresos Ventas</span>
                    <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
                      {formatARS(dashboardStats.totalSales)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                    <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Costos Fijos</span>
                    <span className="text-base font-bold font-mono tabular-nums text-[#18231C]">
                      {formatARS(dashboardStats.fixedCosts)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                    <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Costos Variables</span>
                    <span className="text-base font-bold font-mono tabular-nums text-[#18231C]">
                      {formatARS(dashboardStats.variableCosts)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                    <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Resultado / Margen</span>
                    <span
                      className={`text-base font-bold font-mono tabular-nums ${
                        dashboardStats.operatingResult >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatARS(dashboardStats.operatingResult)} ({dashboardStats.marginPct}%)
                    </span>
                  </div>
                </div>

                {/* Branch Performance Table */}
                <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] font-bold uppercase text-[#18231C]">
                      <tr>
                        <th className="py-2.5 px-3">Sucursal / Local</th>
                        <th className="py-2.5 px-3 text-right">Caja Chica</th>
                        <th className="py-2.5 px-3 text-right">Ventas</th>
                        <th className="py-2.5 px-3 text-right">Costos</th>
                        <th className="py-2.5 px-3 text-right">Facturas Pend.</th>
                        <th className="py-2.5 px-3 text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECE5DC]">
                      {dashboardStats.branchBreakdown.map((row) => (
                        <tr key={row.branch} className="hover:bg-[#FAF8F5]/60">
                          <td className="py-2.5 px-3 font-bold text-[#18231C]">{row.branch}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#18231C]">
                            {formatARS(row.pettyCashBalance)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                            {formatARS(row.sales)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">
                            {formatARS(row.costs)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4A453F]">
                            {formatARS(row.pendingInvoices)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                              row.netResult >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatARS(row.netResult)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pipeline & Quick Financial Actions */}
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 border-b border-[#ECE5DC] pb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                      Pipeline Comercial Activo (CRM)
                    </h4>
                    <select
                      value={pipelineStageFilter}
                      onChange={(e) => setPipelineStageFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold text-[#18231C] bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none cursor-pointer focus:border-[#B9522F]"
                      aria-label="Filtrar pipeline por etapa de seguimiento de pedidos"
                    >
                      <option value="activos">
                        Todas las etapas activas ({dashboardStats.activeOrdersCount})
                      </option>
                      {dashboardStats.pipelineStages.map((stg) => (
                        <option key={stg.id} value={stg.id}>
                          {stg.label} ({stg.count})
                        </option>
                      ))}
                      <option value="todas">
                        Todas las etapas incl. Entregado ({dashboardStats.allOrdersCount})
                      </option>
                    </select>
                  </div>

                  {(() => {
                    const selectedStage =
                      pipelineStageFilter !== 'activos' && pipelineStageFilter !== 'todas'
                        ? dashboardStats.pipelineStages.find((s) => s.id === pipelineStageFilter)
                        : null;
                    const displayAmount = selectedStage
                      ? selectedStage.totalAmount
                      : pipelineStageFilter === 'todas'
                        ? dashboardStats.allOrdersTotal
                        : dashboardStats.pipelineTotal;
                    const displayCount = selectedStage
                      ? selectedStage.count
                      : pipelineStageFilter === 'todas'
                        ? dashboardStats.allOrdersCount
                        : dashboardStats.activeOrdersCount;
                    const displayMissing = selectedStage
                      ? selectedStage.missingAmountCount
                      : dashboardStats.pipelineStages
                          .filter((s) => (pipelineStageFilter === 'todas' || !s.isClosedCol) && s.isApprovedOrLater)
                          .reduce((acc, s) => acc + s.missingAmountCount, 0);

                    return (
                      <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                          {selectedStage
                            ? selectedStage.label
                            : pipelineStageFilter === 'todas'
                              ? 'Total Seguimiento de Pedidos'
                              : 'Pedidos en Cotización / Taller / Listos'}
                        </span>
                        <div className="text-xl font-bold font-mono tabular-nums text-[#18231C]">
                          {formatARS(displayAmount)}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#6F6860] tabular-nums">
                          <span>
                            {displayCount} operación(es) {selectedStage ? 'en esta etapa' : 'en curso'}
                          </span>
                          {displayMissing > 0 && (
                            <span className="text-amber-700 font-semibold">
                              {displayMissing} sin monto ($ 0)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Desglose resumido por cada paso de Seguimiento de Pedidos */}
                  <div className="space-y-1">
                    {dashboardStats.pipelineStages.map((stg) => {
                      const isSelected = pipelineStageFilter === stg.id;
                      return (
                        <button
                          key={stg.id}
                          type="button"
                          onClick={() =>
                            setPipelineStageFilter((prev) => (prev === stg.id ? 'activos' : stg.id))
                          }
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xs text-[11px] border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#18231C] text-white border-[#18231C]'
                              : 'bg-white hover:bg-[#FAF8F5] text-[#18231C] border-[#ECE5DC]'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: stg.color }}
                            />
                            <span className="truncate font-semibold">{stg.label}</span>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isSelected ? 'text-white/75' : 'text-[#6F6860]'
                              }`}
                            >
                              ({stg.count})
                            </span>
                          </span>
                          <span className="font-mono font-bold tabular-nums shrink-0">
                            {formatARS(stg.totalAmount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                    Accesos Rápidos de Tesorería
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('invoices');
                      openNewInvoiceModal();
                    }}
                    className="w-full py-2 px-3 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>Cargar Factura / Vencimiento</span>
                    <FileText className="w-3.5 h-3.5" style={{ color: accent }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('checks');
                      openNewCheckModal('recibido');
                    }}
                    className="w-full py-2 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>Registrar Cheque Recibido</span>
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('checks');
                      openNewCheckModal('emitido');
                    }}
                    className="w-full py-2 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>Registrar Cheque Emitido</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('petty_cash');
                      openNewPcModal('egreso');
                    }}
                    className="w-full py-2 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>Movimiento de Caja Chica</span>
                    <Store className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Combined Upcoming Maturities: Invoices + Checks */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#18231C]" />
                  <span>Agenda de Vencimientos Próximos (Facturas y Cheques a 15 días + Vencidos)</span>
                </h4>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('invoices')}
                    className="text-[#18231C] hover:underline cursor-pointer"
                  >
                    Ver Facturas →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('checks')}
                    className="text-[#18231C] hover:underline cursor-pointer"
                  >
                    Ver Cheques →
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] font-bold uppercase text-[#18231C]">
                    <tr>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3">Instrumento</th>
                      <th className="py-2.5 px-3">N° Comprobante</th>
                      <th className="py-2.5 px-3">Proveedor / Cliente</th>
                      <th className="py-2.5 px-3">Sucursal</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE5DC]">
                    {dashboardStats.upcomingMaturities.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#6F6860]">
                          Sin facturas ni cheques pendientes con vencimiento en los próximos 15 días.
                        </td>
                      </tr>
                    ) : (
                      dashboardStats.upcomingMaturities.map((item) => {
                        const isOverdue = (item.dueDate || '') < todayIso;
                        return (
                          <tr key={item.id} className="hover:bg-[#FAF8F5]/70">
                            <td className={`py-2.5 px-3 font-mono font-bold tabular-nums whitespace-nowrap ${isOverdue ? 'text-rose-700' : 'text-[#18231C]'}`}>
                              {item.dueDate}
                              {isOverdue && (
                                <span className="ml-1.5 text-[10px] uppercase font-sans font-bold text-rose-700">
                                  (Vencido)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                              <span className={item.isInflow ? 'text-emerald-700' : 'text-rose-700'}>
                                {item.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#18231C] whitespace-nowrap">
                              {item.number}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#18231C]">
                              {fixUtf8Encoding(item.entity)}
                            </td>
                            <td className="py-2.5 px-3 text-[#6F6860] whitespace-nowrap">
                              {fixUtf8Encoding(item.branch)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#18231C] whitespace-nowrap">
                              {item.statusLabel}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#18231C] whitespace-nowrap">
                              {formatARS(item.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === SUB-TAB 2: COSTOS Y VENTAS === */}
        {activeTab === 'costs' && (
          <CRMCostsTab
            accentColor={accent}
            userRole="admin"
            defaultBranch={defaultBranch}
            orders={orders}
            embeddedInCostsHub={true}
          />
        )}

        {/* === SUB-TAB 3: FACTURAS Y VENCIMIENTOS === */}
        {activeTab === 'invoices' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Summary KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                  Total Pendiente de Pago
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-[#18231C] block">
                  {formatARS(invoiceSummary.pendingTotal)}
                </span>
                <span className="text-[11px] text-[#6F6860] block tabular-nums">
                  {invoiceSummary.pendingCount} factura(s) impaga(s)
                </span>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                  Facturas Vencidas (Alerta)
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-rose-700 block">
                  {formatARS(invoiceSummary.overdueTotal)}
                </span>
                <span className="text-[11px] text-rose-700 font-semibold block tabular-nums">
                  {invoiceSummary.overdueCount} comprobante(s) fuera de término
                </span>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                  Próximas a Vencer (≤ 7 días)
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-amber-700 block">
                  {formatARS(invoiceSummary.soonTotal)}
                </span>
                <span className="text-[11px] text-[#6F6860] block tabular-nums">
                  {invoiceSummary.soonCount} vencimiento(s) inminente(s)
                </span>
              </div>

              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">
                  Pagadas en el Mes Actual
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-emerald-700 block">
                  {formatARS(invoiceSummary.paidMonthTotal)}
                </span>
                <span className="text-[11px] text-[#6F6860] block tabular-nums">
                  {invoiceSummary.paidMonthCount} comprobante(s) abonado(s)
                </span>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex-wrap">
                  {(
                    [
                      { key: 'all', label: 'Todas' },
                      { key: 'pendiente', label: 'Pendientes' },
                      { key: 'vencidas', label: 'Vencidas' },
                      { key: 'por_vencer', label: 'Por Vencer (7d)' },
                      { key: 'pagada', label: 'Pagadas' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setInvStatusFilter(opt.key)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                        invStatusFilter === opt.key
                          ? 'bg-[#18231C] text-white'
                          : 'text-[#6F6860] hover:text-[#18231C]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <select
                  value={invCostTypeFilter}
                  onChange={(e) => setInvCostTypeFilter(e.target.value as 'all' | ExpenseType)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                >
                  <option value="all">Costo: Fijo y Variable</option>
                  <option value="Fijo">Solo Costo Fijo</option>
                  <option value="Variable">Solo Costo Variable</option>
                </select>

                <select
                  value={invBranchFilter}
                  onChange={(e) => setInvBranchFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                >
                  <option value="todas">Sucursal: Todas</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="Administración Central">Administración Central</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Proveedor, N° factura, rubro..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none w-52"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={openNewInvoiceModal}
                className="px-3.5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: accent }} />
                <span>Cargar Factura</span>
              </button>
            </div>

            {/* Invoices Table */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] font-bold uppercase tracking-wider text-[#18231C]">
                    <tr>
                      <th className="py-3 px-3">Comprobante</th>
                      <th className="py-3 px-3">Proveedor / Ente</th>
                      <th className="py-3 px-3">Rubro y Tipo</th>
                      <th className="py-3 px-3">Sucursal</th>
                      <th className="py-3 px-3">Emisión / Vto.</th>
                      <th className="py-3 px-3 text-right">Monto</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE5DC]">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[#6F6860]">
                          No hay facturas de costos o gastos registradas con este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const days = getDaysDiffFromToday(inv.dueDate, todayIso);
                        const isOverdue = inv.status === 'pendiente' && days < 0;
                        const warnWindow = typeof inv.notifyDaysBefore === 'number' ? inv.notifyDaysBefore : 5;
                        const isDueSoon = inv.status === 'pendiente' && days >= 0 && days <= warnWindow;

                        return (
                          <tr key={inv.id} className="hover:bg-[#FAF8F5]/70">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-[#18231C]">{fixUtf8Encoding(inv.invoiceType)}</div>
                              <div className="font-mono text-[11px] text-[#6F6860]">N° {inv.invoiceNumber}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#18231C]">{fixUtf8Encoding(inv.supplierOrEntity)}</div>
                              {inv.cuit && <div className="text-[10px] font-mono text-[#6F6860]">CUIT: {inv.cuit}</div>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-[#18231C]">{fixUtf8Encoding(inv.category)}</div>
                              <div className="text-[10px] font-bold uppercase text-[#6F6860]">
                                Costo {inv.costType}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[#4A453F] whitespace-nowrap">
                              {fixUtf8Encoding(inv.branch)}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] whitespace-nowrap">
                              <div className="text-[#6F6860]">Em: {inv.issueDate}</div>
                              <div className={`font-bold ${isOverdue ? 'text-rose-700' : isDueSoon ? 'text-amber-700' : 'text-[#18231C]'}`}>
                                Vto: {inv.dueDate}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#18231C] whitespace-nowrap">
                              {formatARS(inv.amount)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {inv.status === 'pagada' ? (
                                <div>
                                  <span className="font-bold text-emerald-700">Pagada</span>
                                  <div className="text-[10px] text-[#6F6860]">
                                    {inv.paidDate} · {inv.paymentMethod || 'Transferencia'}
                                  </div>
                                </div>
                              ) : inv.status === 'anulada' ? (
                                <span className="font-bold text-[#6F6860]">Anulada</span>
                              ) : isOverdue ? (
                                <span className="font-bold text-rose-700">
                                  Vencida ({Math.abs(days)}d)
                                </span>
                              ) : isDueSoon ? (
                                <span className="font-bold text-amber-700">
                                  {days === 0 ? 'Vence HOY' : `Por vencer (${days}d)`}
                                </span>
                              ) : (
                                <span className="font-semibold text-[#18231C]">
                                  Pendiente ({days}d)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {confirmDeleteInvId === inv.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInvoice(inv.id)}
                                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-xs cursor-pointer"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteInvId(null)}
                                    className="px-2 py-1 bg-white border border-[#DCD4C9] text-[10px] font-bold rounded-xs cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  {inv.status === 'pendiente' && (
                                    <button
                                      type="button"
                                      onClick={() => openPayInvoiceModal(inv)}
                                      className="px-2 py-1 bg-[#18231C] hover:bg-black text-white text-[10px] font-bold uppercase rounded-xs cursor-pointer mr-1"
                                      title="Registrar pago de factura"
                                    >
                                      Pagar
                                    </button>
                                  )}
                                  {inv.attachmentUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewInvoice(inv)}
                                      className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-[#ECE5DC] rounded-xs cursor-pointer"
                                      title="Ver comprobante adjunto"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditInvoiceModal(inv)}
                                    className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-[#ECE5DC] rounded-xs cursor-pointer"
                                    title="Editar factura"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteInvId(inv.id)}
                                    className="p-1.5 text-[#6F6860] hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                                    title="Eliminar factura"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          </div>
        )}

        {/* === SUB-TAB 4: CHEQUES EMITIDOS Y RECIBIDOS === */}
        {activeTab === 'checks' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Recibidos en Cartera / Depositados</span>
                <span className="text-xl font-bold font-mono tabular-nums text-emerald-700 block">
                  {formatARS(
                    checks
                      .filter((c) => c.direction === 'recibido' && (c.status === 'en_cartera' || c.status === 'depositado'))
                      .reduce((a, c) => a + (Number(c.amount) || 0), 0)
                  )}
                </span>
              </div>
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Emitidos Pendientes de Débito</span>
                <span className="text-xl font-bold font-mono tabular-nums text-rose-700 block">
                  {formatARS(
                    checks
                      .filter((c) => c.direction === 'emitido' && c.status === 'pendiente_debito')
                      .reduce((a, c) => a + (Number(c.amount) || 0), 0)
                  )}
                </span>
              </div>
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Cheques Cobrados (Histórico)</span>
                <span className="text-xl font-bold font-mono tabular-nums text-[#18231C] block">
                  {formatARS(
                    checks
                      .filter((c) => c.direction === 'recibido' && c.status === 'cobrado')
                      .reduce((a, c) => a + (Number(c.amount) || 0), 0)
                  )}
                </span>
              </div>
              <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#6F6860] block">Cheques Debitados (Histórico)</span>
                <span className="text-xl font-bold font-mono tabular-nums text-[#18231C] block">
                  {formatARS(
                    checks
                      .filter((c) => c.direction === 'emitido' && c.status === 'debitado')
                      .reduce((a, c) => a + (Number(c.amount) || 0), 0)
                  )}
                </span>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                  {(
                    [
                      { key: 'all', label: 'Todos' },
                      { key: 'recibido', label: 'Recibidos' },
                      { key: 'emitido', label: 'Emitidos' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCheckDirectionFilter(opt.key)}
                      className={`px-3 py-1 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                        checkDirectionFilter === opt.key
                          ? 'bg-[#18231C] text-white'
                          : 'text-[#6F6860] hover:text-[#18231C]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <select
                  value={checkStatusFilter}
                  onChange={(e) => setCheckStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                >
                  <option value="all">Estado: Todos</option>
                  {Object.entries(CHECK_STATUS_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>

                <select
                  value={checkBranchFilter}
                  onChange={(e) => setCheckBranchFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                >
                  <option value="todas">Sucursal: Todas</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="Administración Central">Administración Central</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={checkSearch}
                    onChange={(e) => setCheckSearch(e.target.value)}
                    placeholder="Buscar N°, banco, empresa..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none w-52"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewCheckModal('recibido')}
                  className="px-3.5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: accent }} />
                  <span>Cargar Cheque</span>
                </button>
              </div>
            </div>

            {/* Checks Ledger Table */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] font-bold uppercase tracking-wider text-[#18231C]">
                    <tr>
                      <th className="py-3 px-3">Dirección / Mod.</th>
                      <th className="py-3 px-3">N° Cheque</th>
                      <th className="py-3 px-3">Banco</th>
                      <th className="py-3 px-3">Emisión / Vto.</th>
                      <th className="py-3 px-3">Librador / Beneficiario</th>
                      <th className="py-3 px-3">Sucursal</th>
                      <th className="py-3 px-3 text-right">Monto</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE5DC]">
                    {filteredChecks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-[#6F6860]">
                          No hay cheques registrados que coincidan con el filtro actual.
                        </td>
                      </tr>
                    ) : (
                      filteredChecks.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FAF8F5]/70">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`font-bold ${c.direction === 'recibido' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {c.direction === 'recibido' ? 'Recibido' : 'Emitido'}
                            </span>
                            <span className="text-[#6F6860]"> · {CHECK_MODE_LABELS[c.checkMode] || c.checkMode}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#18231C] whitespace-nowrap">
                            {c.checkNumber}
                          </td>
                          <td className="py-2.5 px-3 text-[#18231C] font-medium whitespace-nowrap">
                            {fixUtf8Encoding(c.bank)}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] whitespace-nowrap">
                            <div className="text-[#6F6860]">Em: {c.issueDate}</div>
                            <div className="font-bold text-[#18231C]">Vto: {c.dueDate}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#18231C]">{fixUtf8Encoding(c.partyName)}</div>
                            {c.cuitOrDni && (
                              <div className="text-[10px] font-mono text-[#6F6860]">CUIT/DNI: {c.cuitOrDni}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#4A453F] whitespace-nowrap">
                            {fixUtf8Encoding(c.branch)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#18231C] whitespace-nowrap">
                            {formatARS(c.amount)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <select
                              value={c.status}
                              onChange={(e) => handleQuickCheckStatus(c, e.target.value as FinancialCheckStatus)}
                              className="px-2 py-1 text-[11px] font-bold border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] text-[#18231C] outline-none cursor-pointer"
                            >
                              {Object.entries(CHECK_STATUS_LABELS).map(([k, lbl]) => (
                                <option key={k} value={k}>
                                  {lbl}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {confirmDeleteCheckId === c.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCheck(c.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-xs cursor-pointer"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCheckId(null)}
                                  className="px-2 py-1 bg-white border border-[#DCD4C9] text-[10px] font-bold rounded-xs cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditCheckModal(c)}
                                  className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-[#ECE5DC] rounded-xs cursor-pointer"
                                  title="Editar cheque"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCheckId(c.id)}
                                  className="p-1.5 text-[#6F6860] hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                                  title="Eliminar cheque"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === SUB-TAB 5: CAJA CHICA POR LOCAL === */}
        {activeTab === 'petty_cash' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Branch Petty Cash Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {branchPettyCashSummaries.map((bSum) => {
                const isSelected = pcBranchFilter !== 'todas' && branchMatches(bSum.branch, pcBranchFilter);
                return (
                  <div
                    key={bSum.branch}
                    className={`bg-white border rounded-xs p-4 space-y-3 transition-colors ${
                      isSelected ? 'border-[#18231C]' : 'border-[#DCD4C9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPcBranchFilter(isSelected ? 'todas' : bSum.branch)}
                        className="text-left cursor-pointer"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] block">
                          Caja Chica Local
                        </span>
                        <h4 className="text-sm font-bold uppercase text-[#18231C]">
                          {bSum.branch}
                        </h4>
                      </button>
                      <span
                        className={`text-xl font-bold font-mono tabular-nums ${
                          bSum.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatARS(bSum.balance)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6F6860] border-t border-[#ECE5DC] pt-2 tabular-nums">
                      <span>Ingresos: <strong className="text-[#18231C] font-mono">{formatARS(bSum.ingresos)}</strong></span>
                      <span>Egresos: <strong className="text-[#18231C] font-mono">{formatARS(bSum.egresos)}</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openNewPcModal('ingreso', bSum.branch)}
                        className="px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-[11px] font-bold uppercase rounded-xs cursor-pointer transition-colors"
                      >
                        + Reposición
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewPcModal('egreso', bSum.branch)}
                        className="px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-[11px] font-bold uppercase rounded-xs cursor-pointer transition-colors"
                      >
                        - Gasto Local
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={pcBranchFilter}
                  onChange={(e) => setPcBranchFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                >
                  <option value="todas">Sucursal: Todas</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs">
                  {(
                    [
                      { key: 'all', label: 'Todos' },
                      { key: 'ingreso', label: 'Ingresos / Reposiciones' },
                      { key: 'egreso', label: 'Egresos / Gastos' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPcTypeFilter(opt.key)}
                      className={`px-3 py-1 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                        pcTypeFilter === opt.key
                          ? 'bg-[#18231C] text-white'
                          : 'text-[#6F6860] hover:text-[#18231C]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={pcSearch}
                    onChange={(e) => setPcSearch(e.target.value)}
                    placeholder="Concepto, comprobante, responsable..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none w-56"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewPcModal('ingreso')}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer transition-colors whitespace-nowrap"
                >
                  + Ingreso / Reposición
                </button>
                <button
                  type="button"
                  onClick={() => openNewPcModal('egreso')}
                  className="px-3.5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs cursor-pointer transition-colors whitespace-nowrap"
                >
                  - Registrar Gasto
                </button>
              </div>
            </div>

            {/* Petty Cash Movements Table */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] font-bold uppercase tracking-wider text-[#18231C]">
                    <tr>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Local</th>
                      <th className="py-3 px-3">Tipo</th>
                      <th className="py-3 px-3">Rubro</th>
                      <th className="py-3 px-3">Concepto</th>
                      <th className="py-3 px-3">Comprobante</th>
                      <th className="py-3 px-3">Responsable</th>
                      <th className="py-3 px-3 text-right">Monto</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE5DC]">
                    {filteredPettyCash.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-[#6F6860]">
                          No hay movimientos de caja chica cargados para este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredPettyCash.map((m) => (
                        <tr key={m.id} className="hover:bg-[#FAF8F5]/70">
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[#18231C] whitespace-nowrap">
                            {m.date}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#18231C] whitespace-nowrap">
                            {fixUtf8Encoding(m.branch)}
                          </td>
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {m.movementType === 'ingreso' ? (
                              <span className="text-emerald-700">Ingreso / Reposición</span>
                            ) : (
                              <span className="text-rose-700">Egreso / Gasto</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#4A453F]">{fixUtf8Encoding(m.category)}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#18231C]">{fixUtf8Encoding(m.concept)}</td>
                          <td className="py-2.5 px-3 font-mono text-[#6F6860]">{m.receiptNumber || '-'}</td>
                          <td className="py-2.5 px-3 text-[#4A453F]">{fixUtf8Encoding(m.responsible)}</td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                              m.movementType === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {m.movementType === 'ingreso' ? '+' : '-'} {formatARS(m.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {confirmDeletePcId === m.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePc(m.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-xs cursor-pointer"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePcId(null)}
                                  className="px-2 py-1 bg-white border border-[#DCD4C9] text-[10px] font-bold rounded-xs cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditPcModal(m)}
                                  className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-[#ECE5DC] rounded-xs cursor-pointer"
                                  title="Editar movimiento"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePcId(m.id)}
                                  className="p-1.5 text-[#6F6860] hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                                  title="Eliminar movimiento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Modal Alertas y Notificaciones de Vencimiento */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FDB813]" />
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider">
                    Centro de Alertas y Vencimientos Financieros
                  </h4>
                  <span className="text-[11px] text-[#DCD4C9] block">
                    Facturas vencidas o por vencer, cheques y pedidos aprobados sin monto
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifModal(false)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-[#FAF8F5] border-b border-[#DCD4C9] flex items-center justify-between text-xs">
              <span className="font-bold text-[#18231C]">
                {financialAlerts.length} alerta(s) activa(s) · {unreadAlertsCount} sin leer
              </span>
              {unreadAlertsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAlertsRead}
                  className="text-[11px] font-bold text-[#18231C] hover:underline cursor-pointer"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5">
              {financialAlerts.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#6F6860] space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-[#18231C]">Todo al día</p>
                  <p>No hay facturas ni cheques vencidos o por vencer en los próximos días.</p>
                </div>
              ) : (
                financialAlerts.map((alert) => {
                  const isRead = readNotifIds.includes(alert.id);
                  return (
                    <div
                      key={alert.id}
                      className={`p-3 border rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isRead
                          ? 'bg-white border-[#ECE5DC] opacity-75'
                          : alert.severity === 'high'
                            ? 'bg-rose-50/70 border-rose-300'
                            : 'bg-amber-50/70 border-amber-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            alert.severity === 'high' ? 'text-rose-700' : 'text-amber-700'
                          }`}
                        />
                        <div>
                          <div className="text-xs font-bold text-[#18231C]">{alert.title}</div>
                          <div className="text-[11px] text-[#4A453F] mt-0.5">{alert.detail}</div>
                          <div className="text-xs font-mono font-bold tabular-nums text-[#18231C] mt-1">
                            {alert.kind === 'missing_order_amount'
                              ? 'Monto pendiente de carga ($ 0)'
                              : `Monto: ${formatARS(alert.amount)}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {alert.invoiceRef && (
                          <button
                            type="button"
                            onClick={() => {
                              markAlertAsRead(alert.id);
                              setShowNotifModal(false);
                              setActiveTab('invoices');
                              openPayInvoiceModal(alert.invoiceRef!);
                            }}
                            className="px-2.5 py-1.5 bg-[#18231C] hover:bg-black text-white text-[10px] font-bold uppercase rounded-xs cursor-pointer"
                          >
                            Pagar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            markAlertAsRead(alert.id);
                            setActiveTab(alert.targetTab);
                            setShowNotifModal(false);
                          }}
                          className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] text-[10px] font-bold uppercase rounded-xs cursor-pointer"
                        >
                          {alert.kind === 'missing_order_amount' ? 'Ver en Pipeline' : 'Ir al listado'}
                        </button>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => markAlertAsRead(alert.id)}
                            className="px-2 py-1.5 text-[10px] font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                          >
                            Leída
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cargar / Editar Factura de Costos o Gastos */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FDB813]" />
                <h4 className="font-bold text-sm uppercase tracking-wider">
                  {editingInvoice
                    ? `Editar ${editingInvoice.invoiceType} #${editingInvoice.invoiceNumber}`
                    : 'Cargar Factura / Comprobante con Vencimiento'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Tipo Comprobante *</label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] font-bold outline-none cursor-pointer"
                  >
                    {INVOICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">N° Factura / Referencia *</label>
                  <input
                    type="text"
                    required
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value)}
                    placeholder="Ej: 0003-00451289"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Monto Total (ARS) *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono tabular-nums outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Proveedor / Ente Emisor *</label>
                  <input
                    type="text"
                    required
                    value={invSupplier}
                    onChange={(e) => setInvSupplier(e.target.value)}
                    placeholder="Ej: Edemsa, Ecogas, AFIP, Textil Macata, Propietario..."
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">CUIT (opcional)</label>
                  <input
                    type="text"
                    value={invCuit}
                    onChange={(e) => setInvCuit(e.target.value)}
                    placeholder="30-00000000-0"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Rubro / Categoría *</label>
                  <select
                    value={invCategory}
                    onChange={(e) => handleInvoiceCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {costCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {fixUtf8Encoding(cat.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Tipo de Costo *</label>
                  <select
                    value={invCostType}
                    onChange={(e) => setInvCostType(e.target.value as ExpenseType)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-bold outline-none cursor-pointer"
                  >
                    <option value="Fijo">Costo Fijo</option>
                    <option value="Variable">Costo Variable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Sucursal / Imputación *</label>
                  <select
                    value={invBranch}
                    onChange={(e) => setInvBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="Administración Central">Administración Central</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha de Emisión *</label>
                  <input
                    type="date"
                    required
                    value={invIssueDate}
                    onChange={(e) => setInvIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha de Vencimiento *</label>
                  <input
                    type="date"
                    required
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Notificar días antes</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={invNotifyDays}
                    onChange={(e) => setInvNotifyDays(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono tabular-nums outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Estado *</label>
                  <select
                    value={invStatus}
                    onChange={(e) => setInvStatus(e.target.value as ExpenseInvoiceStatus)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-bold outline-none cursor-pointer"
                  >
                    <option value="pendiente">Pendiente de pago</option>
                    <option value="pagada">Pagada</option>
                    <option value="anulada">Anulada</option>
                  </select>
                </div>

                {invStatus === 'pagada' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha de Pago</label>
                      <input
                        type="date"
                        value={invPaidDate}
                        onChange={(e) => setInvPaidDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Medio de Pago</label>
                      <select
                        value={invPaymentMethod}
                        onChange={(e) => setInvPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Attachment upload */}
              <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-4 h-4 text-[#6F6860]" />
                  <div>
                    <div className="font-bold text-[#18231C]">
                      {invAttachmentName ? `Adjunto: ${invAttachmentName}` : 'Adjuntar factura (PDF o imagen, máx 850 KB)'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invAttachmentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvAttachmentUrl('');
                        setInvAttachmentName('');
                      }}
                      className="px-2 py-1 text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                  <label className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-[11px] font-bold uppercase rounded-xs cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{invAttachmentUrl ? 'Cambiar archivo' : 'Subir archivo'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleInvoiceAttachmentChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Automation toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invSyncExpense}
                    onChange={(e) => setInvSyncExpense(e.target.checked)}
                    className="accent-[#18231C]"
                  />
                  <span className="text-[11px] font-semibold text-[#18231C]">
                    Sincronizar gasto en Costos y Ventas
                  </span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invSyncCalendar}
                    onChange={(e) => setInvSyncCalendar(e.target.checked)}
                    className="accent-[#18231C]"
                  />
                  <span className="text-[11px] font-semibold text-[#18231C]">
                    Agendar vencimiento en Calendario CRM
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  placeholder="CBU de pago, número de cliente de servicio, detalle de ítems..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none focus:border-[#18231C]"
                />
              </div>

              <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingInvoice}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  {isSavingInvoice ? 'Guardando...' : editingInvoice ? 'Guardar Cambios' : 'Registrar Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago de Factura */}
      {payInvoiceTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#FDB813]" />
                <h4 className="font-bold text-sm uppercase tracking-wider">
                  Registrar Pago de Factura
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPayInvoiceTarget(null)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayInvoice} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1">
                <div className="font-bold text-[#18231C]">
                  {fixUtf8Encoding(payInvoiceTarget.supplierOrEntity)} · {payInvoiceTarget.invoiceType} #{payInvoiceTarget.invoiceNumber}
                </div>
                <div className="text-[11px] text-[#6F6860]">
                  Sucursal: {fixUtf8Encoding(payInvoiceTarget.branch)} · Vto: {payInvoiceTarget.dueDate}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-[#18231C] pt-1">
                  Importe: {formatARS(payInvoiceTarget.amount)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha de Pago *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Medio de Pago *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPayMethod(next);
                      if (next === 'Caja Chica') setPayDeductPettyCash(true);
                    }}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={payDeductPettyCash}
                  onChange={(e) => setPayDeductPettyCash(e.target.checked)}
                  className="accent-[#18231C]"
                />
                <span className="text-[11px] font-semibold text-[#18231C]">
                  Descontar automáticamente de Caja Chica ({fixUtf8Encoding(payInvoiceTarget.branch)})
                </span>
              </label>

              {!payInvoiceTarget.linkedExpenseId && (
                <label className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payRegisterExpense}
                    onChange={(e) => setPayRegisterExpense(e.target.checked)}
                    className="accent-[#18231C]"
                  />
                  <span className="text-[11px] font-semibold text-[#18231C]">
                    Impactar también como gasto en Costos y Ventas
                  </span>
                </label>
              )}

              <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayInvoiceTarget(null)}
                  className="px-4 py-2 border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPayingInvoice}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  {isPayingInvoice ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Previsualizar Adjunto de Factura */}
      {previewInvoice && previewInvoice.attachmentUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-3.5 flex items-center justify-between text-white">
              <div className="text-xs font-bold uppercase tracking-wider truncate">
                {previewInvoice.invoiceType} #{previewInvoice.invoiceNumber} · {previewInvoice.supplierOrEntity}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewInvoice.attachmentUrl}
                  download={previewInvoice.attachmentName || `factura-${previewInvoice.invoiceNumber}`}
                  className="px-2.5 py-1 bg-[#FDB813] text-[#18231C] text-[10px] font-bold uppercase rounded-xs"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="text-white/70 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#FAF8F5] flex-1 overflow-auto flex items-center justify-center">
              {previewInvoice.attachmentUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewInvoice.attachmentUrl}
                  title="Comprobante PDF"
                  className="w-full h-[70vh] border border-[#DCD4C9] bg-white"
                />
              ) : (
                <img
                  src={previewInvoice.attachmentUrl}
                  alt={previewInvoice.attachmentName || 'Comprobante'}
                  className="max-w-full max-h-[70vh] object-contain border border-[#DCD4C9]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Cheque */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#FDB813]" />
                <h4 className="font-bold text-sm uppercase tracking-wider">
                  {editingCheck ? `Editar Cheque #${editingCheck.checkNumber}` : 'Registrar Cheque Emitido / Recibido'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckModal(false)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCheck} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Tipo *</label>
                  <select
                    value={chkDirection}
                    onChange={(e) => {
                      const next = e.target.value as FinancialCheckDirection;
                      setChkDirection(next);
                      if (!editingCheck) {
                        setChkStatus(next === 'emitido' ? 'pendiente_debito' : 'en_cartera');
                      }
                    }}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] font-bold outline-none cursor-pointer"
                  >
                    <option value="recibido">Cheque Recibido (Cliente)</option>
                    <option value="emitido">Cheque Emitido (Pago propio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Modalidad *</label>
                  <select
                    value={chkMode}
                    onChange={(e) => setChkMode(e.target.value as FinancialCheckMode)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] font-semibold outline-none cursor-pointer"
                  >
                    <option value="comun">Común</option>
                    <option value="diferido">Pago Diferido</option>
                    <option value="echeq">E-Cheq</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">N° Cheque *</label>
                  <input
                    type="text"
                    required
                    value={chkNumber}
                    onChange={(e) => setChkNumber(e.target.value)}
                    placeholder="Ej: 45890123"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Banco *</label>
                  <input
                    type="text"
                    required
                    value={chkBank}
                    onChange={(e) => setChkBank(e.target.value)}
                    placeholder="Ej: Banco Galicia / Nación"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Monto (ARS) *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={chkAmount}
                    onChange={(e) => setChkAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono tabular-nums outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha Emisión *</label>
                  <input
                    type="date"
                    required
                    value={chkIssueDate}
                    onChange={(e) => setChkIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha Vencimiento / Cobro *</label>
                  <input
                    type="date"
                    required
                    value={chkDueDate}
                    onChange={(e) => setChkDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">
                    {chkDirection === 'recibido' ? 'Librador / Empresa Cliente *' : 'Beneficiario / Proveedor *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={chkPartyName}
                    onChange={(e) => setChkPartyName(e.target.value)}
                    placeholder="Razón social o nombre completo"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">CUIT / DNI (opcional)</label>
                  <input
                    type="text"
                    value={chkCuit}
                    onChange={(e) => setChkCuit(e.target.value)}
                    placeholder="30-00000000-0"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Sucursal / Caja *</label>
                  <select
                    value={chkBranch}
                    onChange={(e) => setChkBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="Administración Central">Administración Central</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Estado Actual *</label>
                  <select
                    value={chkStatus}
                    onChange={(e) => setChkStatus(e.target.value as FinancialCheckStatus)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {Object.entries(CHECK_STATUS_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={chkNotes}
                  onChange={(e) => setChkNotes(e.target.value)}
                  placeholder="Pedido vinculado, orden de compra, cuenta de depósito..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none focus:border-[#18231C]"
                />
              </div>

              <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckModal(false)}
                  className="px-4 py-2 border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCheck}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  {isSavingCheck ? 'Guardando...' : editingCheck ? 'Guardar Cambios' : 'Registrar Cheque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento Caja Chica */}
      {showPcModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#FDB813]" />
                <h4 className="font-bold text-sm uppercase tracking-wider">
                  {editingPc ? 'Editar Movimiento de Caja Chica' : 'Nuevo Movimiento de Caja Chica'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPcModal(false)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePc} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Local / Sucursal *</label>
                  <select
                    value={pcBranch}
                    onChange={(e) => setPcBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] font-bold outline-none cursor-pointer"
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Tipo *</label>
                  <select
                    value={pcType}
                    onChange={(e) => setPcType(e.target.value as PettyCashMovementType)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] font-bold outline-none cursor-pointer"
                  >
                    <option value="egreso">Egreso / Gasto de Caja</option>
                    <option value="ingreso">Ingreso / Reposición de Fondo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={pcDate}
                    onChange={(e) => setPcDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Monto (ARS) *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={pcAmount}
                    onChange={(e) => setPcAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono tabular-nums outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Rubro *</label>
                  <select
                    value={pcCategory}
                    onChange={(e) => setPcCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none cursor-pointer"
                  >
                    {PETTY_CASH_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">N° Comprobante (opcional)</label>
                  <input
                    type="text"
                    value={pcReceipt}
                    onChange={(e) => setPcReceipt(e.target.value)}
                    placeholder="Ej: FC-00124"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Concepto / Detalle *</label>
                <input
                  type="text"
                  required
                  value={pcConcept}
                  onChange={(e) => setPcConcept(e.target.value)}
                  placeholder="Ej: Compra de café y vasos para salón / Reposición semanal"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Responsable *</label>
                <input
                  type="text"
                  required
                  value={pcResponsible}
                  onChange={(e) => setPcResponsible(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#6F6860] mb-1">Notas adicionales</label>
                <textarea
                  rows={2}
                  value={pcNotes}
                  onChange={(e) => setPcNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none focus:border-[#18231C]"
                />
              </div>

              <div className="pt-3 border-t border-[#DCD4C9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPcModal(false)}
                  className="px-4 py-2 border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPc}
                  className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xs cursor-pointer"
                >
                  {isSavingPc ? 'Guardando...' : editingPc ? 'Guardar Cambios' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
