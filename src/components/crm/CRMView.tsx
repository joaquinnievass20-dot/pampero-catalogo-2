import React, { useState, useEffect } from 'react';
import { 
  UserSession, 
  ThemeConfig, 
  CRMOrder, 
  CRMOrderStatus, 
  LeadVisit, 
  SupplierOrder, 
  SizingCampaign, 
  EmployeeSizeEntry,
  Seller,
  EmployeeAccount,
  ObservationHistoryEntry,
  Product,
  CRMOrderShortageItem,
  CategoryHierarchyItem,
  InternalChatThread,
  CRMTask
} from '../../types';
import { 
  subscribeToCRMOrders, 
  saveCRMOrder, 
  deleteCRMOrder,
  subscribeToLeadVisits,
  saveLeadVisit,
  subscribeToSupplierOrders,
  saveSupplierOrder,
  subscribeToSizingCampaigns,
  saveSizingCampaign,
  subscribeToEmployeeSizeEntries,
  saveEmployeeSizeEntry,
  subscribeToKanbanColumns,
  DEFAULT_COMPANY_COLUMNS,
  DEFAULT_VISIT_COLUMNS,
  DEFAULT_TASK_COLUMNS,
  KanbanColumnConfig,
  getNextCorrelativeOrderNumber,
  getNextStructuredTrackingCode,
  ensureOrdersHaveStructuredTrackingCodes,
  isValidStructuredTrackingCode,
  upsertObservationReminderCalendarEvent,
  recordAuditLog,
  subscribeToReadNotifications,
  saveReadNotifications,
  saveCRMOrderShortage,
  deleteCRMOrderShortage,
  subscribeToCRMTasks,
  subscribeToCRMOrderShortages,
  getChatParticipantKey,
} from '../../services/firebase';
import { isColorDark } from '../../context/ThemeContext';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { formatDateTime } from '../../utils/dateUtils';
import { 
  LayoutDashboard, 
  Filter, 
  Plus, 
  Search, 
  X, 
  Save, 
  ChevronDown, 
  AlertTriangle, 
  Clock, 
  Building2, 
  User, 
  Bell, 
  Truck, 
  Shirt, 
  CheckCircle2, 
  MessageCircle, 
  Calendar,
  Layers,
  Phone,
  ArrowRight,
  ShieldCheck,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  MapPin,
  ExternalLink,
  Eye,
  Edit3,
  MessageSquarePlus,
  PackageX,
  Menu,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt
} from 'lucide-react';
import { exportOrdersToExcel, importOrdersFromExcel } from '../../utils/kanbanExcelUtils';
import { normalizeCRMOrder, normalizeLeadVisit, normalizeSupplierOrder } from '../../utils/crmNormalizers';
import { PamperoLogo } from '../PamperoLogo';
import { CRMNotificationsModal, CRMNotificationItem } from './CRMNotificationsModal';
import { CRMOverviewTab } from './CRMOverviewTab';
import { CRMVisitsTab } from './CRMVisitsTab';
import { CRMTasksTab } from './CRMTasksTab';
import { CRMCalendarTab } from './CRMCalendarTab';
import { CRMSupplierOrdersTab } from './CRMSupplierOrdersTab';
import { CRMObservationsModal } from './CRMObservationsModal';
import { CRMOrderShortagesModal } from './CRMOrderShortagesModal';
import { useConfiguredBranches } from '../../utils/useConfiguredBranches';
import { branchMatches } from '../../utils/rrhhBranches';

interface CRMTabErrorBoundaryProps {
  tabKey: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface CRMTabErrorBoundaryState {
  hasError: boolean;
  errorMsg: string;
}

class CRMTabErrorBoundary extends React.Component<
  CRMTabErrorBoundaryProps,
  CRMTabErrorBoundaryState
> {
  declare props: CRMTabErrorBoundaryProps;
  declare state: CRMTabErrorBoundaryState;
  declare setState: (
    next: Partial<CRMTabErrorBoundaryState> | ((prev: CRMTabErrorBoundaryState) => Partial<CRMTabErrorBoundaryState>)
  ) => void;

  constructor(props: CRMTabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any): CRMTabErrorBoundaryState {
    return { hasError: true, errorMsg: error?.message || String(error) || 'Error inesperado en la pestaña.' };
  }

  componentDidUpdate(prevProps: { tabKey: string }) {
    if (prevProps.tabKey !== this.props.tabKey && this.state.hasError) {
      this.setState({ hasError: false, errorMsg: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white border-2 border-red-300 rounded-xs shadow-sm text-center space-y-3 max-w-xl mx-auto my-8">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="font-bold text-sm uppercase text-[#18231C]">
            Se detectó un problema al mostrar esta sección
          </h3>
          <p className="text-xs text-[#6F6860] break-words">{this.state.errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, errorMsg: '' });
              if (this.props.onRetry) this.props.onRetry();
            }}
            className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer"
          >
            Reintentar cargar pestaña
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface DynamicBoardColumn {
  id: string;
  label: string;
  color: string;
  bgColor: string;
}

export interface BoardFieldConfig {
  showOrderNumber: boolean;
  showSeller: boolean;
  showBranch: boolean;
  showEstimatedUnits: boolean;
  showEstimatedAmount: boolean;
  showObservations: boolean;
  showDeliveryDate: boolean;
  showEmbroideryNotes: boolean;
}

interface CRMViewProps {
  userSession: UserSession | null;
  onClose: () => void;
  theme: ThemeConfig;
  products?: Product[];
  categories?: CategoryHierarchyItem[];
  unreadChatThreads?: InternalChatThread[];
  onOpenChat?: (threadId?: string) => void;
  onOpenAuth?: () => void;
}

const STATUS_COLUMNS: { id: CRMOrderStatus; label: string; color: string; bgColor: string }[] = [
  { id: 'cotizacion', label: 'Cotización Recibida', color: '#FDB813', bgColor: '#FFF8E1' },
  { id: 'sena_50', label: 'Aprobado / Seña 50%', color: '#F97316', bgColor: '#FFF7ED' },
  { id: 'produccion', label: 'En Bordados / Taller', color: '#8B5CF6', bgColor: '#F5F3FF' },
  { id: 'listo', label: 'Listo para Retirar', color: '#10B981', bgColor: '#ECFDF5' },
  { id: 'entregado', label: 'Entregado / Cerrado', color: '#3B82F6', bgColor: '#EFF6FF' },
];

export const CRMView: React.FC<CRMViewProps> = ({
  userSession,
  onClose,
  theme,
  products,
  categories,
  unreadChatThreads = [],
  onOpenChat,
  onOpenAuth,
}) => {
  const [orders, setOrders] = useState<CRMOrder[]>([]);
  const [visits, setVisits] = useState<LeadVisit[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [allShortages, setAllShortages] = useState<CRMOrderShortageItem[]>([]);
  const [sizingCampaigns, setSizingCampaigns] = useState<SizingCampaign[]>([]);
  const [employeeSizes, setEmployeeSizes] = useState<EmployeeSizeEntry[]>([]);

  // Dynamic Kanban Columns for Visitas, Seguimiento Empresas & Tareas
  const [visitColumns, setVisitColumns] = useState<KanbanColumnConfig[]>(DEFAULT_VISIT_COLUMNS);
  const [taskColumns, setTaskColumns] = useState<KanbanColumnConfig[]>(DEFAULT_TASK_COLUMNS);
  const [companyColumns, setCompanyColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_kanban_company_cols');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_COMPANY_COLUMNS;
  });

  useEffect(() => {
    const unsub = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.visits) && data.visits.length > 0) {
        setVisitColumns(data.visits);
      }
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanyColumns(data.companies);
      }
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        setTaskColumns(data.tasks);
      }
    });
    return () => unsub();
  }, []);

  // RBAC Access Control: Check if logged in staff has CRM permissions
  const currentEmployee: EmployeeAccount | null = React.useMemo(() => {
    if (userSession?.role !== 'employee') return null;
    try {
      const saved = localStorage.getItem('pampero_employees');
      if (saved) {
        const list = JSON.parse(saved);
        return list.find((e: any) => 
          e.email?.toLowerCase() === userSession.email?.toLowerCase() || e.id === userSession.id
        ) || null;
      }
    } catch {}
    return null;
  }, [userSession?.id, userSession?.email, userSession?.role]);

  const isStaff = userSession?.role === 'admin' || userSession?.role === 'employee';
  const hasCrmPermission = userSession?.role === 'admin' || (currentEmployee?.allowedTabs ? currentEmployee.allowedTabs.includes('crm') : true);
  const canAccess = Boolean(isStaff && hasCrmPermission);

  const { branchNames: configuredBranchNames, resolveBranch: resolveConfiguredBranch } = useConfiguredBranches();

  const rawAssignedBranch = String((userSession as any)?.branch || currentEmployee?.branch || '').trim();
  const isAllBranchesUser =
    !rawAssignedBranch ||
    ['todas', 'todos', 'all', 'administracion central', 'administración central', 'gran mendoza'].includes(
      rawAssignedBranch
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    );
  const assignedBranch = isAllBranchesUser ? '' : resolveConfiguredBranch(rawAssignedBranch, false);
  const effectiveSellerRole = (userSession as any)?.sellerRole || currentEmployee?.sellerRole;

  // CRM Visibility Scope: 'admin' o empleado con rol 'encargado' o crmScope === 'all' ven tablero completo
  const crmScope: 'all' | 'branch_only' | 'own_only' =
    userSession?.role === 'admin' ||
    effectiveSellerRole === 'encargado' ||
    (userSession as any)?.crmScope === 'all' ||
    currentEmployee?.crmScope === 'all' ||
    isAllBranchesUser
      ? 'all'
      : ((userSession as any)?.crmScope || currentEmployee?.crmScope || 'branch_only');

  const assignedSellerName =
    (userSession as any)?.sellerName || currentEmployee?.sellerName || userSession?.clientData?.fullName || '';

  // Dynamic sellers list from localStorage / store
  const sellersList: Seller[] = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('pampero_sellers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 'sel-1', name: 'Itatí', branch: 'Pampero Maipú', active: true },
      { id: 'sel-2', name: 'Guada', branch: 'Pampero Ciudad de Mendoza', active: true },
      { id: 'sel-3', name: 'Carolina', branch: 'Pampero Luján de Cuyo', active: true },
    ];
  }, []);

  // Detectar si el usuario activo es Administrador, Encargado General o Encargado del Local
  const isManager = React.useMemo(() => {
    if (userSession?.role === 'admin') return true;
    if (effectiveSellerRole === 'local' || effectiveSellerRole === 'encargado') return true;

    const emailLow = (userSession?.email || '').toLowerCase();
    const nameLow = (assignedSellerName || '').toLowerCase();
    const matchedSeller: any = sellersList.find(
      (s: any) =>
        (emailLow && s.email?.toLowerCase() === emailLow) ||
        (nameLow && s.name?.toLowerCase() === nameLow)
    );
    if (matchedSeller?.role === 'local' || matchedSeller?.role === 'encargado' || matchedSeller?.role === 'admin') return true;

    try {
      const regUsers: any[] = JSON.parse(localStorage.getItem('pampero_registered_users') || '[]');
      const regMatch = regUsers.find(
        (u) => emailLow && (u.email || '').toLowerCase() === emailLow
      );
      if (regMatch?.sellerRole === 'local' || regMatch?.sellerRole === 'encargado' || regMatch?.role === 'admin') return true;
    } catch {}

    return false;
  }, [userSession, effectiveSellerRole, assignedSellerName, sellersList]);

  const activeStaffUser = userSession?.clientData?.fullName || (userSession?.role === 'admin' ? 'Administrador General' : userSession?.email?.split('@')[0] || 'Personal Pampero');

  // Allowed CRM tabs based on Admin or Employee Permissions
  const crmTabsStr = currentEmployee?.crmTabs?.join(',') || '';
  const crmTasksConfigured = Boolean(currentEmployee?.crmTasksConfigured);
  const crmCalendarConfigured = Boolean(currentEmployee?.crmCalendarConfigured);
  const allowedCrmTabs: ('overview' | 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers')[] = React.useMemo(() => {
    if (userSession?.role === 'admin') return ['overview', 'visits', 'board', 'tasks', 'calendar', 'suppliers'];
    if (currentEmployee?.crmTabs && Array.isArray(currentEmployee.crmTabs) && currentEmployee.crmTabs.length > 0) {
      const nextTabs: string[] = currentEmployee.crmTabs.filter((t) => t !== 'costs');
      if (!crmTasksConfigured && !nextTabs.includes('tasks')) {
        nextTabs.push('tasks');
      }
      if (!crmCalendarConfigured && !nextTabs.includes('calendar')) {
        nextTabs.push('calendar');
      }
      const withOverview = nextTabs.includes('overview') ? nextTabs : ['overview', ...nextTabs];
      return withOverview as ('overview' | 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers')[];
    }
    return ['overview', 'visits', 'board', 'tasks', 'calendar', 'suppliers'];
  }, [userSession?.role, crmTabsStr, crmTasksConfigured, crmCalendarConfigured]);

  const canControlTasks = Boolean(
    userSession?.role === 'admin' ||
    isManager ||
    userSession?.canControlTasks ||
    currentEmployee?.canControlTasks
  );

  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers'>('overview');
  const [colSortDir, setColSortDir] = useState<Record<string, 'desc' | 'asc'>>({});
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const boardBodyScrollRef = React.useRef<HTMLDivElement>(null);
  const boardTopScrollRef = React.useRef<HTMLDivElement>(null);
  const isSyncingBoardScrollRef = React.useRef(false);
  const [boardScrollContentWidth, setBoardScrollContentWidth] = useState(1400);

  useEffect(() => {
    if (activeTab !== 'board') return;
    const bodyEl = boardBodyScrollRef.current;
    if (!bodyEl) return;
    const syncWidth = () => {
      setBoardScrollContentWidth(Math.max(bodyEl.scrollWidth, 1100));
    };
    syncWidth();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncWidth) : null;
    ro?.observe(bodyEl);
    window.addEventListener('resize', syncWidth);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncWidth);
    };
  }, [activeTab, companyColumns.length, isDesktopSidebarCollapsed]);

  useEffect(() => {
    if (allowedCrmTabs.length > 0 && !allowedCrmTabs.includes(activeTab)) {
      setActiveTab(allowedCrmTabs[0]);
    }
  }, [allowedCrmTabs, activeTab]);

  const [sellerFilter, setSellerFilter] = useState(() => {
    if (crmScope === 'own_only' && assignedSellerName) return assignedSellerName.toLowerCase();
    return 'todos';
  });

  // Promote visit that passes "Previo a cotización" directly into "Seguimiento empresas"
  const handlePromoteVisitToCompanyOrder = async (visit: LeadVisit) => {
    try {
      const firstColId = companyColumns[0]?.id || 'cotizacion';
      const { number: orderNum } = await getNextCorrelativeOrderNumber();
      const visitRegDate = visit.createdAt ? new Date(visit.createdAt) : new Date();
      const trackingCode = isValidStructuredTrackingCode(visit.trackingCode)
        ? visit.trackingCode!
        : await getNextStructuredTrackingCode(
            'empresa',
            visit.branch || 'Maipú',
            !Number.isNaN(visitRegDate.getTime()) ? visitRegDate : new Date()
          );

      if (!isValidStructuredTrackingCode(visit.trackingCode)) {
        const updatedVisit = sanitizeObjectEncoding({ ...visit, trackingCode });
        setVisits((prev) => [updatedVisit, ...prev.filter((v) => v.id !== visit.id)]);
        saveLeadVisit(updatedVisit).catch(() => {});
      }

      const orderId = `PED-${orderNum}`;
      const newOrder: CRMOrder = sanitizeObjectEncoding({
        id: orderId,
        date: new Date().toISOString(),
        quoteId: trackingCode,
        orderNumber: trackingCode,
        trackingCode,
        originVisitId: visit.id,
        clientName: visit.companyName,
        clientType: 'empresa',
        clientPhone: visit.phone || '',
        clientEmail: visit.email || '',
        companyLocation: visit.companyLocation || undefined,
        locationUrl: visit.locationUrl || undefined,
        status: firstColId as CRMOrderStatus,
        columnId: firstColId,
        seller: visit.seller || 'Sin asignar',
        branch: visit.branch || 'Maipú',
        totalUnits: visit.estimatedUnits || 1,
        totalEstimated: 0,
        observations: `[Avanzado desde Visitas Comerciales] Contacto: ${visit.contactName || '-'} · Tel: ${visit.phone || '-'} · Ubicación: ${visit.companyLocation || '-'} · Objetivo: ${visit.objective || '-'} · Notas: ${visit.notes || '-'}`,
        observationDate: visit.observationDate,
        reminderDate: visit.reminderDate,
        reminderTime: visit.reminderTime,
        reminderNote: visit.reminderNote,
        observationHistory: visit.observationHistory,
        updatedAt: new Date().toISOString(),
      });

      // Immediate local state update
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      await saveCRMOrder(newOrder);
      setActiveTab('board');
    } catch (err) {
      console.error('Error promoviendo visita a orden:', err);
    }
  };
  const [branchFilter, setBranchFilter] = useState(() => {
    if (crmScope !== 'all' && assignedBranch) return assignedBranch;
    return 'todos';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDelayedOnly, setFilterDelayedOnly] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<CRMOrder | null>(null);
  const [showObsModal, setShowObsModal] = useState(false);
  const [showShortagesModal, setShowShortagesModal] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<CRMOrder | null>(null);
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputOrdersRef = React.useRef<HTMLInputElement>(null);

  const catalogProducts = React.useMemo<Product[]>(() => {
    if (Array.isArray(products) && products.length > 0) return products;
    try {
      const raw = localStorage.getItem('pampero_catalog_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [products]);

  const knownSuppliers = React.useMemo<string[]>(() => {
    const set = new Set<string>(['Macata', 'Pampero Central', 'Calzado Confort']);
    supplierOrders.forEach((so) => {
      if (so.supplierName) set.add(so.supplierName);
    });
    orders.forEach((o) => {
      if (Array.isArray(o.shortages)) {
        o.shortages.forEach((s) => {
          if (s.supplier) set.add(s.supplier);
        });
      }
    });
    return Array.from(set);
  }, [supplierOrders, orders]);

  const notifUserKey = (userSession?.email || userSession?.id || 'admin').toLowerCase().trim();
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubReads = subscribeToReadNotifications(notifUserKey, (ids) => {
      setReadNotifIds(ids);
    });
    return () => unsubReads();
  }, [notifUserKey]);

  const handleExportOrders = () => {
    exportOrdersToExcel(filteredOrders.length > 0 ? filteredOrders : orders);
  };

  const handleImportOrders = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExcelProcessing(true);
    try {
      const res = await importOrdersFromExcel(file, orders);
      setOrders(res.orders);
      setExcelNotice(`¡Excel sincronizado con éxito! Se actualizaron ${res.updatedCount} pedidos y se crearon ${res.newCount} en Cloud Firestore.`);
      setTimeout(() => setExcelNotice(null), 6000);
    } catch (err: any) {
      alert(`Error al importar Excel: ${err?.message || err}`);
    } finally {
      setIsExcelProcessing(false);
      if (fileInputOrdersRef.current) fileInputOrdersRef.current.value = '';
    }
  };

  const accent = theme?.accentColor || '#FDB813';

  // Real-time Firestore Subscriptions with clean encoding, normalization and equality guards
  useEffect(() => {
    const unsubOrders = subscribeToCRMOrders((fetched) => {
      const normalized = fetched.map((o, idx) => normalizeCRMOrder(o, idx));
      setOrders((prev) => {
        if (prev.length === normalized.length) {
          const hasDiff = normalized.some((o, i) => !prev[i] || prev[i].id !== o.id || prev[i].status !== o.status || prev[i].updatedAt !== o.updatedAt);
          if (!hasDiff) return prev;
        }
        return normalized;
      });
    });
    const unsubVisits = subscribeToLeadVisits((fetched) => {
      const normalized = fetched.map((v, idx) => normalizeLeadVisit(v, idx));
      setVisits((prev) => {
        if (prev.length === normalized.length) {
          const hasDiff = normalized.some((v, i) => !prev[i] || prev[i].id !== v.id || prev[i].status !== v.status || prev[i].updatedAt !== v.updatedAt || prev[i].phone !== v.phone);
          if (!hasDiff) return prev;
        }
        return normalized;
      });
    });
    const unsubSuppliers = subscribeToSupplierOrders((fetched) =>
      setSupplierOrders(fetched.map((o, idx) => normalizeSupplierOrder(o, idx)))
    );
    const unsubTasks = subscribeToCRMTasks((fetched) => setTasks(fetched.map(sanitizeObjectEncoding)));
    const unsubShortages = subscribeToCRMOrderShortages((fetched) => setAllShortages(fetched.map(sanitizeObjectEncoding)));
    const unsubCampaigns = subscribeToSizingCampaigns((fetched) => setSizingCampaigns(fetched.map(sanitizeObjectEncoding)));
    const unsubSizes = subscribeToEmployeeSizeEntries('all', (fetched) => setEmployeeSizes(fetched.map(sanitizeObjectEncoding)));

    return () => {
      unsubOrders();
      unsubVisits();
      unsubSuppliers();
      unsubTasks();
      unsubShortages();
      unsubCampaigns();
      unsubSizes();
    };
  }, []);

  // Asignar automáticamente código estructurado a fichas de Seguimiento Empresas sin código (ej. COT-VIS-*)
  // manteniendo intactos los códigos históricos (#1..#8)
  const backfilledOrderIdsRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const isLegacyNumber = (num?: string) => /^#\d{1,4}$/.test(String(num || '').trim());
    const missing = orders.filter(
      (o) =>
        o &&
        o.id &&
        !isValidStructuredTrackingCode(o.trackingCode) &&
        !isLegacyNumber(o.orderNumber) &&
        !backfilledOrderIdsRef.current.has(o.id)
    );
    if (missing.length === 0) return;
    missing.forEach((o) => backfilledOrderIdsRef.current.add(o.id));

    let cancelled = false;
    ensureOrdersHaveStructuredTrackingCodes(orders, visits)
      .then((enriched) => {
        if (cancelled) return;
        setOrders(enriched);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [orders, visits]);

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: CRMOrderStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const currentOrderCol = (order as any).columnId || order.status;
      if (currentOrderCol !== newStatus) {
        const updated = sanitizeObjectEncoding({ 
          ...order, 
          status: newStatus, 
          columnId: newStatus, 
          updatedAt: new Date().toISOString() 
        });
        setOrders((prev) => [updated, ...prev.filter((o) => o.id !== orderId)]);
        try {
          await saveCRMOrder(updated);
          recordAuditLog({
            module: 'CRM / Kanban',
            action: 'Mover Tarjeta',
            details: `Pedido #${order.orderNumber || order.id} (${order.clientName || 'Cliente'}) movido a etapa "${newStatus}"`,
            metadata: { orderId: order.id, previousStatus: currentOrderCol, newStatus }
          });
        } catch (err) {
          console.error('Error al actualizar estado en Drag & Drop:', err);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // Scoped Orders & Visits for Notifications matching active user RBAC
  const notifSettings = React.useMemo(() => {
    const defaults = {
      staleQuoteDays: 7,
      notifyNewQuotes: true,
      notifyStaleOrders: true,
      notifyBlockedOrders: true,
      notifyPendingVisits: true,
      notifyMissingOrderAmounts: true,
    };
    try {
      const saved = localStorage.getItem('pampero_notification_settings');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  }, []);

  const normalizeColKey = (val?: string): string =>
    (val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const resolveOrderColumnId = React.useCallback(
    (ord: CRMOrder): string => {
      const raw = String((ord as any).columnId || ord.status || '').trim();
      const normRaw = normalizeColKey(raw);
      if (normRaw === 'cancelado') return 'cancelado';
      const matched = companyColumns.find(
        (c) => c.id === raw || normalizeColKey(c.id) === normRaw || normalizeColKey(c.label) === normRaw
      );
      return matched ? matched.id : (companyColumns[0]?.id || 'cotizacion');
    },
    [companyColumns]
  );

  const approvedStartIndex = React.useMemo(() => {
    const idx = companyColumns.findIndex((c) => {
      const idN = normalizeColKey(c.id);
      const lbN = normalizeColKey(c.label);
      return idN.includes('sena') || idN.includes('aprob') || lbN.includes('sena') || lbN.includes('aprob');
    });
    return idx >= 0 ? idx : Math.min(1, Math.max(0, companyColumns.length - 1));
  }, [companyColumns]);

  const scopedOrdersForNotif = React.useMemo(() => {
    return orders.filter((o) => {
      if (assignedBranch && effectiveSellerRole !== 'encargado' && !branchMatches(o.branch, assignedBranch)) {
        return false;
      }
      if (crmScope === 'own_only' && assignedSellerName) {
        return (o.seller || '').toLowerCase() === assignedSellerName.toLowerCase();
      }
      return true;
    });
  }, [orders, crmScope, assignedBranch, effectiveSellerRole, assignedSellerName]);

  const scopedVisitsForNotif = React.useMemo(() => {
    return visits.filter((v) => {
      if (assignedBranch && effectiveSellerRole !== 'encargado' && !branchMatches(v.branch, assignedBranch)) {
        return false;
      }
      if (crmScope === 'own_only' && assignedSellerName) {
        return (v.seller || '').toLowerCase() === assignedSellerName.toLowerCase();
      }
      return true;
    });
  }, [visits, crmScope, assignedBranch, effectiveSellerRole, assignedSellerName]);

  const delayedOrdersCount = React.useMemo(() => {
    if (!notifSettings.notifyStaleOrders) return 0;
    return scopedOrdersForNotif.filter((o) => {
      const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
      const colNorm = normalizeColKey(resolveOrderColumnId(o));
      return daysOld >= notifSettings.staleQuoteDays && (colNorm === 'cotizacion' || colNorm === 'sena_50');
    }).length;
  }, [scopedOrdersForNotif, notifSettings, resolveOrderColumnId]);

  const blockedOrdersCount = React.useMemo(() => {
    if (!notifSettings.notifyBlockedOrders) return 0;
    return scopedOrdersForNotif.filter((o) => Boolean(o.blockReason)).length;
  }, [scopedOrdersForNotif, notifSettings]);

  const crmNotifications: CRMNotificationItem[] = React.useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const items: CRMNotificationItem[] = [];

    // 1. Recordatorios de observaciones (Seguimiento Empresas)
    scopedOrdersForNotif
      .filter((o) => Boolean(o.reminderDate) && (o.reminderDate || '') <= todayIso && o.status !== 'entregado' && o.status !== 'cancelado')
      .forEach((o) => {
        const code = o.trackingCode || o.orderNumber || `#${o.id.slice(-6)}`;
        items.push({
          id: `rem-ord-${o.id}-${o.reminderDate}`,
          category: 'reminder',
          title: `${fixUtf8Encoding(o.clientName)} (${code})`,
          subtitle: fixUtf8Encoding(o.reminderNote || o.observations || 'Recordatorio de seguimiento programado'),
          meta: `Aviso: ${o.reminderDate}${o.reminderTime ? ` ${o.reminderTime}hs` : ''} · ${o.seller || 'Sin asignar'}`,
          badgeText: 'Recordatorio',
          badgeClass: 'bg-amber-50 border-amber-300 text-amber-900',
          order: o,
        });
      });

    // 2. Recordatorios de observaciones (Visitas Comerciales)
    scopedVisitsForNotif
      .filter((v) => Boolean(v.reminderDate) && (v.reminderDate || '') <= todayIso && v.status !== 'cerrada' && v.status !== 'cancelada')
      .forEach((v) => {
        items.push({
          id: `rem-vis-${v.id}-${v.reminderDate}`,
          category: 'reminder',
          title: `${fixUtf8Encoding(v.companyName)}${v.trackingCode ? ` (${v.trackingCode})` : ''}`,
          subtitle: fixUtf8Encoding(v.reminderNote || v.notes || 'Recordatorio de visita comercial'),
          meta: `Aviso: ${v.reminderDate}${v.reminderTime ? ` ${v.reminderTime}hs` : ''} · ${v.seller || 'Sin asignar'}`,
          badgeText: 'Recordatorio Visita',
          badgeClass: 'bg-purple-50 border-purple-300 text-purple-900',
          visit: v,
          whatsappPhone: v.phone,
          whatsappText: v.phone ? `Hola ${v.contactName || ''}, te escribimos de Pampero Mendoza.` : undefined,
        });
      });

    // 3. Pedidos Bloqueados
    if (notifSettings.notifyBlockedOrders) {
      scopedOrdersForNotif
        .filter((o) => Boolean(o.blockReason))
        .forEach((o) => {
          const code = o.trackingCode || o.orderNumber || `#${o.id.slice(-6)}`;
          items.push({
            id: `blocked-${o.id}-${String(o.blockReason).slice(0, 24)}`,
            category: 'blocked',
            title: `${fixUtf8Encoding(o.clientName)} (${code})`,
            subtitle: `Motivo de bloqueo: ${fixUtf8Encoding(String(o.blockReason))}`,
            meta: `Vendedor: ${o.seller || 'Sin asignar'} · Sucursal: ${o.branch || 'Mendoza'}`,
            badgeText: 'Bloqueado',
            badgeClass: 'bg-red-50 border-red-300 text-red-800',
            order: o,
          });
        });
    }

    // 4. Pedidos Demorados
    if (notifSettings.notifyStaleOrders) {
      scopedOrdersForNotif
        .filter((o) => {
          const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
          return daysOld >= notifSettings.staleQuoteDays && (o.status === 'cotizacion' || o.status === 'sena_50');
        })
        .forEach((o) => {
          const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
          const code = o.trackingCode || o.orderNumber || `#${o.id.slice(-6)}`;
          items.push({
            id: `delayed-${o.id}`,
            category: 'delayed',
            title: `${fixUtf8Encoding(o.clientName)} (${code})`,
            subtitle: `Lleva ${daysOld} días sin avanzar de "${o.status === 'cotizacion' ? 'Cotización' : 'Seña 50%'}"`,
            meta: `${o.totalUnits || 0} prendas · Vendedor: ${o.seller || 'Sin asignar'}`,
            badgeText: `${daysOld}d demora`,
            badgeClass: 'bg-amber-50 border-amber-300 text-amber-800',
            order: o,
            whatsappPhone: o.clientPhone,
            whatsappText: `Hola ${o.clientName}, te escribimos de Pampero Gran Mendoza por la cotización ${code}. ¿Pudiste revisarla?`,
          });
        });
    }

    // 5. Visitas pendientes de seguimiento
    if (notifSettings.notifyPendingVisits) {
      scopedVisitsForNotif
        .filter((v) => v.status === 'programada' || v.status === 'presupuesto_enviado')
        .forEach((v) => {
          items.push({
            id: `visit-pending-${v.id}-${v.status}`,
            category: 'visit',
            title: `${fixUtf8Encoding(v.companyName)} (${fixUtf8Encoding(v.contactName || 'Contacto')})`,
            subtitle: fixUtf8Encoding(v.objective || v.nextStep || 'Seguimiento comercial pendiente'),
            meta: `Vendedor: ${v.seller || 'Sin asignar'} · Próx. paso: ${fixUtf8Encoding(v.nextStep || '-')}`,
            badgeText: v.status === 'presupuesto_enviado' ? 'Presupuesto enviado' : 'Visita programada',
            badgeClass: 'bg-blue-50 border-blue-200 text-blue-800',
            visit: v,
            whatsappPhone: v.phone,
            whatsappText: v.phone ? `Hola ${v.contactName || ''}, te escribimos de Pampero Mendoza.` : undefined,
          });
        });
    }

    // 6. Mensajes sin leer en Chat Interno
    const myParticipantKey = getChatParticipantKey(userSession);
    if (Array.isArray(unreadChatThreads) && unreadChatThreads.length > 0 && myParticipantKey) {
      unreadChatThreads.forEach((thread) => {
        const unread = thread.unreadBy?.[myParticipantKey] || 0;
        if (unread <= 0) return;
        const otherKey = (thread.participantIds || []).find((id) => id !== myParticipantKey) || myParticipantKey;
        const otherMeta = thread.participantMeta?.[otherKey];
        const senderLabel = otherMeta?.name || thread.lastSenderName || 'Contacto';
        const roleLabel =
          otherMeta?.role === 'admin'
            ? 'Administrador'
            : otherMeta?.role === 'employee'
              ? 'Colaborador'
              : 'Cliente';
        items.unshift({
          id: `chat-unread-${thread.id}-${thread.lastMessageAt || unread}`,
          category: 'chat',
          title: `Mensaje de ${senderLabel}`,
          subtitle: thread.lastMessageText || 'Nuevo mensaje en el chat interno.',
          meta: `${roleLabel} · ${unread} mensaje${unread === 1 ? '' : 's'} sin leer`,
          badgeText: `Chat (${unread})`,
          badgeClass: 'bg-blue-50 border-blue-300 text-blue-900',
          chatThreadId: thread.id,
        });
      });
    }

    // 7. Pedidos aprobados (desde Seña 50% inclusive en adelante) sin monto cargado ($ 0)
    // Solo se notifica a la sucursal encargada del pedido (o administración general sin sucursal fija)
    if (notifSettings.notifyMissingOrderAmounts !== false) {
      scopedOrdersForNotif.forEach((o) => {
        const colId = resolveOrderColumnId(o);
        if (colId === 'cancelado') return;
        const stageIdx = companyColumns.findIndex((c) => c.id === colId);
        if (stageIdx < approvedStartIndex) return;
        if (Number(o.totalEstimated) > 0) return;

        const stageLabel = fixUtf8Encoding(companyColumns[stageIdx]?.label || colId);
        const code = o.trackingCode || o.orderNumber || `#${o.id.slice(-6)}`;
        items.unshift({
          id: `missing-amt-${o.id}-${colId}`,
          category: 'missing_amount',
          title: `${fixUtf8Encoding(o.clientName)} (${code})`,
          subtitle: `Pedido en "${stageLabel}" con presupuesto aceptado sin monto cargado ($ 0). Cargá el importe para actualizar el Pipeline.`,
          meta: `Sucursal: ${fixUtf8Encoding(resolveConfiguredBranch(o.branch, false))} · Vendedor: ${o.seller || 'Sin asignar'}`,
          badgeText: 'Cargar Monto',
          badgeClass: 'bg-emerald-50 border-emerald-400 text-emerald-900',
          order: o,
        });
      });
    }

    // 8. Nuevas cotizaciones recibidas (en la campanita, solo para la sucursal encargada del pedido)
    if (notifSettings.notifyNewQuotes) {
      scopedOrdersForNotif
        .filter((o) => normalizeColKey(resolveOrderColumnId(o)) === 'cotizacion')
        .forEach((o) => {
          const code = o.trackingCode || o.orderNumber || `#${o.id.slice(-6)}`;
          items.push({
            id: `new-quote-${o.id}`,
            category: 'new_quote',
            title: `${fixUtf8Encoding(o.clientName)} (${code})`,
            subtitle: 'Nueva solicitud en Cotización esperando presupuesto oficial y asignación.',
            meta: `Sucursal: ${fixUtf8Encoding(resolveConfiguredBranch(o.branch, false))} · Vendedor: ${o.seller || 'Sin asignar'}`,
            badgeText: 'Nueva Cotización',
            badgeClass: 'bg-amber-50 border-amber-300 text-amber-900',
            order: o,
          });
        });
    }

    return items;
  }, [scopedOrdersForNotif, scopedVisitsForNotif, notifSettings, unreadChatThreads, userSession, companyColumns, approvedStartIndex, resolveOrderColumnId, resolveConfiguredBranch]);

  const readNotifSet = React.useMemo(() => new Set(readNotifIds), [readNotifIds]);
  const unreadNotificationsCount = React.useMemo(
    () => crmNotifications.filter((n) => !readNotifSet.has(n.id)).length,
    [crmNotifications, readNotifSet]
  );

  const handleMarkNotifAsRead = async (id: string) => {
    const next = Array.from(new Set([...readNotifIds, id]));
    setReadNotifIds(next);
    await saveReadNotifications(notifUserKey, next);
  };

  const handleMarkAllNotifsAsRead = async () => {
    const next = Array.from(new Set([...readNotifIds, ...crmNotifications.map((n) => n.id)]));
    setReadNotifIds(next);
    await saveReadNotifications(notifUserKey, next);
  };

  const totalAlertsCount = unreadNotificationsCount;

  // Filtered orders with strict multi-role and local permissions enforcement
  const filteredOrders = orders.filter((o) => {
    // 1. RBAC Branch & Seller Scope Enforcements
    if (crmScope === 'branch_only' && assignedBranch) {
      if (!branchMatches(o.branch, assignedBranch)) {
        return false;
      }
    } else if (crmScope === 'own_only' && assignedSellerName) {
      if ((o.seller || '').toLowerCase() !== assignedSellerName.toLowerCase()) {
        return false;
      }
    }

    // 2. Interactive UI Filters
    const matchesSeller = sellerFilter === 'todos' || (o.seller || '').toLowerCase().includes(sellerFilter.toLowerCase());
    const matchesBranch = branchFilter === 'todos' || branchMatches(o.branch, branchFilter);
    const matchesSearch =
      !searchQuery ||
      (o.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.trackingCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.companyLocation || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
    const colNorm = normalizeColKey(resolveOrderColumnId(o));
    const isDelayed = daysOld > 7 && (colNorm === 'cotizacion' || colNorm === 'sena_50');

    if (filterDelayedOnly && !isDelayed && !o.blockReason) return false;

    return matchesSeller && matchesBranch && matchesSearch;
  });

  // Lista combinada de vendedores para filtros & selects (incluye nombres libres de Excel)
  const allOrderSellerNames = React.useMemo(() => {
    const map = new Map<string, string>();
    sellersList.forEach((s) => {
      if (s?.name) map.set(s.name.toLowerCase(), fixUtf8Encoding(s.name));
    });
    orders.forEach((o) => {
      const nm = String(o.seller || '').trim();
      if (nm && nm.toLowerCase() !== 'sin asignar') {
        map.set(nm.toLowerCase(), fixUtf8Encoding(nm));
      }
    });
    return Array.from(map.values());
  }, [sellersList, orders]);

  // Create manual order with guaranteed columnId, structured tracking code, and immediate local React update
  const handleCreateManualOrder = async (formData: any) => {
    try {
      const firstColId = companyColumns[0]?.id || 'cotizacion';
      const { number: orderNum } = await getNextCorrelativeOrderNumber();
      const targetBranch = resolveConfiguredBranch(formData.branch || assignedBranch || '', false);
      const targetClientType = formData.clientType || 'empresa';
      const trackingCode = await getNextStructuredTrackingCode(targetClientType, targetBranch);
      const orderId = `PED-${orderNum}`;
      const newOrder: CRMOrder = sanitizeObjectEncoding({
        id: orderId,
        date: new Date().toISOString(),
        quoteId: trackingCode,
        orderNumber: trackingCode,
        trackingCode,
        clientName: formData.clientName,
        clientType: targetClientType,
        companyLocation: formData.companyLocation?.trim() || undefined,
        locationUrl: formData.locationUrl?.trim() || undefined,
        status: (formData.status || firstColId) as CRMOrderStatus,
        columnId: formData.columnId || formData.status || firstColId,
        seller: String(formData.seller || assignedSellerName || 'Sin asignar').trim(),
        branch: targetBranch,
        totalUnits: Number(formData.totalUnits) || 0,
        totalEstimated: Number(formData.totalEstimated) || 0,
        observations: formData.observations || '',
        observationDate: formData.observations?.trim() || formData.reminderDate ? (formData.observationDate || new Date().toISOString().split('T')[0]) : undefined,
        reminderDate: formData.reminderDate || undefined,
        reminderTime: formData.reminderTime || undefined,
        reminderNote: formData.reminderNote || undefined,
        observationHistory:
          formData.observations?.trim() || formData.reminderDate
            ? [
                {
                  id: `obs-${Date.now()}`,
                  observationDate: formData.observationDate || new Date().toISOString().split('T')[0],
                  text: formData.observations?.trim() || formData.reminderNote || 'Recordatorio programado',
                  reminderDate: formData.reminderDate || undefined,
                  reminderTime: formData.reminderTime || undefined,
                  author: String(formData.seller || assignedSellerName || activeStaffUser).trim(),
                  createdAt: new Date().toISOString(),
                },
              ]
            : undefined,
        updatedAt: new Date().toISOString(),
      });

      // Immediate local React state update so card appears instantly
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);

      await saveCRMOrder(newOrder);
      if (newOrder.reminderDate) {
        await upsertObservationReminderCalendarEvent('order', {
          sourceId: newOrder.id,
          title: `${newOrder.clientName} (${newOrder.trackingCode || newOrder.orderNumber})`,
          reminderDate: newOrder.reminderDate,
          reminderTime: newOrder.reminderTime,
          reminderNote: newOrder.reminderNote || newOrder.observations,
          branch: newOrder.branch,
          seller: newOrder.seller,
          createdBy: activeStaffUser,
          createdByEmail: userSession?.email,
        });
      }
      recordAuditLog({
        module: 'CRM / Kanban',
        action: 'Crear Pedido',
        details: `Nuevo pedido ${newOrder.trackingCode || newOrder.orderNumber || newOrder.id} (${newOrder.clientName}) creado en etapa "${newOrder.status}"`,
        metadata: { orderId: newOrder.id }
      });
      setShowNewOrderModal(false);
    } catch (err) {
      console.error('Error al registrar pedido manual:', err);
      setShowNewOrderModal(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#FAF8F5]">
        <div className="max-w-md w-full bg-white border border-[#DCD4C9] rounded-xs shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-[#18231C] text-[#FDB813] flex items-center justify-center mx-auto shadow-sm">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#6F6860] block">
              PORTAL INTERNO EXCLUSIVO
            </span>
            <h2 className="font-display text-2xl font-bold text-[#18231C] uppercase tracking-wider mt-1">
              Gestión Pampero · CRM
            </h2>
            <p className="text-xs text-[#6F6860] mt-1.5 leading-relaxed">
              El Tablero de Gestión y los datos de pedidos, clientes y visitas son estrictamente confidenciales. Debés iniciar sesión con una cuenta de administrador o personal autorizado para acceder.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenAuth) onOpenAuth();
              }}
              className="w-full py-3 px-4 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Iniciar Sesión de Personal Pampero</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              ← Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const crmNavItems: Array<{
    key: 'overview' | 'visits' | 'board' | 'tasks' | 'calendar' | 'suppliers';
    label: string;
    category: string;
    icon: any;
  }> = [
    {
      key: 'overview',
      label: (theme?.siteTexts as any)?.crmTabOverviewText || 'Tablero General',
      category: 'Resumen General',
      icon: LayoutDashboard,
    },
    {
      key: 'visits',
      label: theme?.siteTexts?.crmTabVisitsText || '1. Visitas Comerciales',
      category: 'Embudo Comercial',
      icon: Building2,
    },
    {
      key: 'board',
      label: theme?.siteTexts?.crmTabBoardText || '2. Seguimiento Empresas',
      category: 'Embudo Comercial',
      icon: LayoutDashboard,
    },
    {
      key: 'tasks',
      label: theme?.siteTexts?.crmTabTasksText || '3. Tareas',
      category: 'Operación & Agenda',
      icon: CheckSquare,
    },
    {
      key: 'calendar',
      label: theme?.siteTexts?.crmTabCalendarText || '4. Calendario',
      category: 'Operación & Agenda',
      icon: Calendar,
    },
    {
      key: 'suppliers',
      label: theme?.siteTexts?.crmTabSuppliersText || '5. Pedidos Proveedor',
      category: 'Operación & Agenda',
      icon: Truck,
    },
  ];
  const visibleCrmNavItems = crmNavItems.filter((tab) => allowedCrmTabs.includes(tab.key));
  const activeCrmMeta = visibleCrmNavItems.find((t) => t.key === activeTab) || visibleCrmNavItems[0] || crmNavItems[0];
  const ActiveCrmIcon = activeCrmMeta.icon;
  const crmNavGroups = ['Resumen General', 'Embudo Comercial', 'Operación & Agenda']
    .map((groupName) => ({
      title: groupName,
      items: visibleCrmNavItems.filter((t) => t.category === groupName),
    }))
    .filter((g) => g.items.length > 0);

  const getOrderShortagesList = (ord: CRMOrder): CRMOrderShortageItem[] => {
    const map = new Map<string, CRMOrderShortageItem>();
    (Array.isArray(ord.shortages) ? ord.shortages : []).forEach((s) => map.set(s.id, s));
    allShortages
      .filter((s) => s.orderId === ord.id)
      .forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  };

  const isOrderApprovedOrLater = (ord: CRMOrder): boolean => {
    const colId = resolveOrderColumnId(ord);
    if (colId === 'cancelado') return false;
    const idx = companyColumns.findIndex((c) => c.id === colId);
    return idx >= approvedStartIndex;
  };

  const isOrderInPrepStage = (ord: CRMOrder): boolean => {
    const colNorm = normalizeColKey(resolveOrderColumnId(ord));
    const colLabelNorm = normalizeColKey(companyColumns.find((c) => c.id === resolveOrderColumnId(ord))?.label);
    return (
      colNorm.includes('produccion') ||
      colNorm.includes('bordad') ||
      colNorm.includes('taller') ||
      colNorm.includes('prepar') ||
      colLabelNorm.includes('bordad') ||
      colLabelNorm.includes('taller') ||
      colLabelNorm.includes('prepar')
    );
  };

  const getOrderMoneyInfo = (ord: CRMOrder) => {
    const isApproved = isOrderApprovedOrLater(ord);
    const hasInvoicedNum = (Number(ord.totalInvoiced) || 0) > 0;
    const hasInvoice = Boolean(ord.invoicePdfUrl || hasInvoicedNum || (ord.billingStatus && ord.billingStatus !== 'sin_facturar'));
    const displayAmount = hasInvoice && hasInvoicedNum ? Number(ord.totalInvoiced) : (ord.totalEstimated || 0);
    const amountLabel = hasInvoice ? 'Monto Facturado' : isApproved ? 'Monto Cotizado' : 'Monto Estimado';
    const shortTag = hasInvoice ? 'Facturado' : isApproved ? 'Cotizado' : 'Est.';
    const billingLabel =
      ord.billingStatus === 'facturado_total'
        ? 'Facturado Total'
        : ord.billingStatus === 'facturado_parcial'
          ? 'Facturado Parcial'
          : hasInvoice
            ? 'Factura Cargada'
            : null;
    return { isApproved, hasInvoice, displayAmount, amountLabel, shortTag, billingLabel };
  };

  const st = theme?.siteTexts;
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
                {st?.crmTitle || 'Gestión Pampero'}
              </h2>
              <span
                style={{ color: sidebarText }}
                className="text-[10px] opacity-80 block whitespace-normal leading-tight mt-0.5"
              >
                Gran Mendoza · Comercial
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

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {crmNavGroups.map((grp) => (
            <div key={grp.title} className="space-y-1.5">
              <span
                style={{ color: sidebarMutedText }}
                className="px-3 text-[10px] font-black uppercase tracking-[0.18em] block"
              >
                {grp.title}
              </span>
              <div className="space-y-0.5">
                {grp.items.map((tab) => {
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
                      {isSelected && (
                        <span
                          style={{ backgroundColor: sidebarAccent }}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Bottom Operator & Hub Return */}
        <div className={`p-3 border-t ${sidebarBorderClass} space-y-2.5 bg-black/15`}>
          <div className={`px-2.5 py-2 rounded-xs bg-white/5 border ${sidebarBorderClass} space-y-0.5`}>
            <span
              style={{ color: sidebarMutedText }}
              className="text-[9px] font-bold uppercase tracking-wider block"
            >
              Usuario Conectado
            </span>
            <div>
              <span
                style={{ color: isSidebarDark ? '#FFFFFF' : '#18231C' }}
                className="text-xs font-bold truncate block"
              >
                {activeStaffUser}
              </span>
              <span style={{ color: sidebarText }} className="text-[10px] opacity-80 block truncate">
                {userSession?.role === 'admin'
                  ? 'Administrador · Todos los Locales'
                  : effectiveSellerRole === 'encargado'
                    ? 'Encargado · Todos los Locales'
                    : assignedBranch || 'Gran Mendoza'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: sidebarActiveBg, color: isSidebarDark ? '#FAF8F5' : '#18231C' }}
            className="w-full py-2 px-3 hover:opacity-90 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{st?.crmBackBtnText || 'Volver al Hub'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FAF8F5]">
        {/* Top White Workspace Header */}
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
                <span>{st?.crmTitle || 'Gestión Pampero'}</span>
                <ChevronRight className="w-3 h-3 text-[#A69E94]" />
                <span className="text-[#18231C]">{activeCrmMeta.category}</span>
              </div>
              <h1 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2 mt-0.5 leading-none truncate">
                <ActiveCrmIcon className="w-5 h-5 text-[#18231C] shrink-0" />
                <span className="truncate">{activeCrmMeta.label}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
            {onOpenChat && (
              <button
                type="button"
                onClick={() => onOpenChat()}
                className="relative px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Chat Interno"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#18231C]" />
                <span className="hidden sm:inline">{st?.chatNavBtnText || 'Chat'}</span>
                {unreadChatThreads.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-xs text-[10px] font-mono font-black tabular-nums leading-none">
                    {unreadChatThreads.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Notificaciones del Equipo"
            >
              <Bell className="w-3.5 h-3.5 text-[#18231C]" />
              <span className="hidden sm:inline">{st?.crmNotifBtnText || 'Notificaciones'}</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-xs text-[10px] font-mono font-black tabular-nums leading-none">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {activeTab === 'board' && (
              <button
                type="button"
                onClick={() => setShowNewOrderModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231C] hover:bg-black text-[#FDB813] rounded-xs text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{st?.crmNewOrderBtnText || 'Nueva Empresa / Pedido'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xs border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{st?.crmBackBtnText || 'Volver al Hub'}</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <div className="flex-1 overflow-y-scroll min-w-0">
          <div className="w-full max-w-[1700px] mx-auto p-4 sm:p-6 min-h-full flex flex-col">
        {/* === OVERVIEW: TABLERO GENERAL === */}
        {activeTab === 'overview' && (
          <CRMOverviewTab
            orders={orders}
            visits={visits}
            tasks={tasks}
            shortages={allShortages}
            supplierOrders={supplierOrders}
            visitColumns={visitColumns}
            companyColumns={companyColumns}
            taskColumns={taskColumns}
            crmScope={crmScope}
            assignedBranch={assignedBranch}
            assignedSellerName={assignedSellerName}
            allowedCrmTabs={allowedCrmTabs}
            staleQuoteDays={notifSettings.staleQuoteDays}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSelectOrder={(ord) => setViewingOrder(ord)}
          />
        )}

        {/* === TAB 1: KANBAN BOARD === */}
        {activeTab === 'board' && (
          <div className="flex flex-col h-full space-y-4">

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-xs">
              <Filter className="w-4 h-4 text-[#8C827A]" />

              <div className="flex items-center gap-1.5">
                <select
                  value={sellerFilter}
                  disabled={crmScope === 'own_only'}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className={`text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium text-[#18231C] ${
                    crmScope === 'own_only' ? 'bg-neutral-100 cursor-not-allowed opacity-80' : 'bg-white cursor-pointer'
                  }`}
                  title={crmScope === 'own_only' ? 'Restringido a tus pedidos asignados' : 'Filtrar por vendedor'}
                >
                  {crmScope !== 'own_only' && <option value="todos">Vendedor: Todos</option>}
                  {allOrderSellerNames.map((name) => (
                    <option key={name} value={name.toLowerCase()}>
                      {name}
                    </option>
                  ))}
                </select>
                {crmScope === 'own_only' && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-xs border border-amber-300">
                    Solo mis pedidos
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={branchFilter}
                  disabled={crmScope === 'branch_only' || crmScope === 'own_only'}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className={`text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium text-[#18231C] ${
                    crmScope !== 'all' ? 'bg-neutral-100 cursor-not-allowed opacity-80' : 'bg-white cursor-pointer'
                  }`}
                  title={crmScope !== 'all' ? `Restringido a sucursal ${assignedBranch}` : 'Filtrar por sucursal'}
                >
                  {crmScope === 'all' && <option value="todos">Sucursal: Todas</option>}
                  {configuredBranchNames.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {crmScope === 'branch_only' && (
                  <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded-xs border border-blue-300">
                    Sucursal: {assignedBranch}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFilterDelayedOnly((prev) => !prev)}
                className={`px-2.5 py-1 text-xs font-bold rounded-xs border transition-colors cursor-pointer flex items-center gap-1 ${
                  filterDelayedOnly
                    ? 'bg-red-100 border-red-300 text-red-800'
                    : 'bg-white border-[#DCD4C9] text-[#6F6860] hover:text-[#18231C]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Solo Demorados ({delayedOrdersCount})</span>
              </button>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Buscar empresa, código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium"
                />
              </div>

              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xs border text-xs font-bold cursor-pointer select-none transition-colors ${
                  compactView
                    ? 'bg-[#18231C] text-white border-[#18231C]'
                    : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                }`}
                title="Achicar tarjetas para ver solo los nombres de las empresas"
              >
                <input
                  type="checkbox"
                  checked={compactView}
                  onChange={(e) => setCompactView(e.target.checked)}
                  className="accent-[#FDB813] w-3.5 h-3.5 cursor-pointer"
                />
                <span>Solo nombres de empresas</span>
              </label>

              {/* Excel Bulk Export & Import Tools */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputOrdersRef}
                  onChange={handleImportOrders}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleExportOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold transition-colors cursor-pointer"
                  title="Descargar todas las tarjetas actuales en archivo Excel"
                >
                  <Download className="w-3.5 h-3.5 text-[#18231C]" />
                  <span>Descargar Excel</span>
                </button>
                <button
                  type="button"
                  disabled={isExcelProcessing}
                  onClick={() => fileInputOrdersRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  title="Subir archivo Excel para actualizar estados y datos de las tarjetas masivamente en Firestore"
                >
                  <Upload className="w-3.5 h-3.5 text-[#18231C]" />
                  <span>{isExcelProcessing ? 'Procesando...' : 'Subir Excel'}</span>
                </button>
              </div>

              <div className="ml-auto text-[10px] font-bold text-[#8C827A] uppercase tabular-nums">
                {filteredOrders.length} pedidos mostrados
              </div>
            </div>

            {/* Excel Notification Banner */}
            {excelNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs flex items-center justify-between gap-2 text-xs text-emerald-950 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{excelNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExcelNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Top Horizontal Scrollbar Controls for Kanban */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs px-3 py-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    boardBodyScrollRef.current?.scrollBy({ left: -340, behavior: 'smooth' })
                  }
                  className="p-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] cursor-pointer shrink-0 transition-colors"
                  title="Desplazar tablero hacia la izquierda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={boardTopScrollRef}
                  onScroll={() => {
                    if (isSyncingBoardScrollRef.current) return;
                    if (boardBodyScrollRef.current && boardTopScrollRef.current) {
                      isSyncingBoardScrollRef.current = true;
                      boardBodyScrollRef.current.scrollLeft = boardTopScrollRef.current.scrollLeft;
                      requestAnimationFrame(() => {
                        isSyncingBoardScrollRef.current = false;
                      });
                    }
                  }}
                  className="overflow-x-auto overflow-y-hidden h-3 bg-[#FAF8F5] rounded-xs border border-[#ECE5DC] flex-1"
                  title="Barra de desplazamiento horizontal del tablero"
                >
                  <div style={{ width: `${boardScrollContentWidth}px`, height: '1px' }} />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    boardBodyScrollRef.current?.scrollBy({ left: 340, behavior: 'smooth' })
                  }
                  className="p-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] cursor-pointer shrink-0 transition-colors"
                  title="Desplazar tablero hacia la derecha"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Kanban Board Columns */}
            <div
              ref={boardBodyScrollRef}
              onScroll={() => {
                if (isSyncingBoardScrollRef.current) return;
                if (boardTopScrollRef.current && boardBodyScrollRef.current) {
                  isSyncingBoardScrollRef.current = true;
                  boardTopScrollRef.current.scrollLeft = boardBodyScrollRef.current.scrollLeft;
                  requestAnimationFrame(() => {
                    isSyncingBoardScrollRef.current = false;
                  });
                }
              }}
              className="flex-1 overflow-x-auto pb-4"
            >
              <div 
                className="grid gap-4 min-w-[1100px]"
                style={{ gridTemplateColumns: `repeat(${companyColumns.length}, minmax(260px, 1fr))` }}
              >
                {companyColumns.map((col) => {
                  const sortDir = colSortDir[col.id] || 'desc';
                  const columnOrders = filteredOrders
                    .filter((o) => resolveOrderColumnId(o) === col.id)
                    .sort((a, b) => {
                      const ta = new Date(a.date || a.createdAt || 0).getTime() || 0;
                      const tb = new Date(b.date || b.createdAt || 0).getTime() || 0;
                      return sortDir === 'desc' ? tb - ta : ta - tb;
                    });
                  const isDragOver = dragOverColumn === col.id;
                  return (
                    <div
                      key={col.id}
                      data-board-col-id={col.id}
                      className={`rounded-sm border flex flex-col min-h-[520px] transition-colors ${
                        isDragOver
                          ? 'border-[#18231C] bg-[#18231C]/5'
                          : 'border-[#DCD4C9] bg-[#ECE5DC]/35'
                      }`}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.id as CRMOrderStatus)}
                    >
                      {/* Clean Column Header */}
                      <div className="px-3.5 py-2.5 border-b border-[#DCD4C9] rounded-t-sm font-bold text-xs uppercase tracking-wider text-[#18231C] flex justify-between items-center gap-1.5 bg-white">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: col.color }}
                          />
                          <span className="truncate">{fixUtf8Encoding(col.label)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setColSortDir((prev) => ({
                                ...prev,
                                [col.id]: sortDir === 'desc' ? 'asc' : 'desc',
                              }))
                            }
                            className="p-1 rounded-xs bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#6F6860] hover:text-[#18231C] cursor-pointer transition-colors"
                            title={
                              sortDir === 'desc'
                                ? 'Ordenado: Más nuevo primero (clic para cambiar a más viejo primero)'
                                : 'Ordenado: Más viejo primero (clic para cambiar a más nuevo primero)'
                            }
                          >
                            {sortDir === 'desc' ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUp className="w-3 h-3" />
                            )}
                          </button>
                          <span className="px-2 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] text-[11px] font-mono font-bold tabular-nums shrink-0">
                            {columnOrders.length}
                          </span>
                        </div>
                      </div>

                      {/* Cards */}
                      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[300px]">
                        {columnOrders.map((order) => {
                          const daysOld = Math.floor(
                            (Date.now() - new Date(order.date).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const isDelayed =
                            daysOld > 7 && (order.status === 'cotizacion' || order.status === 'sena_50');

                          if (compactView) {
                            return (
                              <div
                                key={order.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, order.id)}
                                onClick={() => setViewingOrder(order)}
                                className={`bg-white rounded-sm px-3 py-2 border hover:border-[#18231C] shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                                  isDelayed ? 'border-rose-300' : 'border-[#DCD4C9]'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-xs text-[#18231C] block truncate uppercase">
                                    {fixUtf8Encoding(order.clientName)}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#6F6860] block truncate">
                                    {order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingOrder(order);
                                  }}
                                  className="p-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] rounded-xs text-[#18231C] border border-[#DCD4C9] cursor-pointer shrink-0"
                                  title="Ver ficha completa"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          }

                          const orderShortages = getOrderShortagesList(order);
                          const pendingShortagesCount = orderShortages.filter((s) => s.status !== 'recibido').length;
                          const allShortagesArrived = orderShortages.length > 0 && pendingShortagesCount === 0;
                          const inPrepStage = isOrderInPrepStage(order);
                          const effectivePrepTags = Array.from(
                            new Set([
                              ...(Array.isArray(order.prepTags) ? order.prepTags : []),
                              ...(pendingShortagesCount > 0 ? ['esperando_pedido'] : []),
                            ])
                          );
                          const moneyInfo = getOrderMoneyInfo(order);

                          const hasCalmDetails = Boolean(
                            order.companyLocation ||
                            order.locationUrl ||
                            order.blockReason ||
                            order.observations ||
                            order.reminderDate ||
                            orderShortages.length > 0 ||
                            moneyInfo.billingLabel
                          );

                          return (
                            <div
                              key={order.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, order.id)}
                              onClick={() => setViewingOrder(order)}
                              className={`p-3 rounded-sm border bg-white shadow-2xs cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none space-y-2 ${
                                isDelayed
                                  ? 'border-rose-300 bg-rose-50/15 hover:border-rose-500'
                                  : 'border-[#DCD4C9] hover:border-[#18231C]'
                              }`}
                            >
                              {/* Line 1: Tracking Code + Quiet Status Flags */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {order.clientType === 'empresa' ? (
                                    <Building2 className="w-3 h-3 text-[#6F6860] shrink-0" />
                                  ) : (
                                    <User className="w-3 h-3 text-[#6F6860] shrink-0" />
                                  )}
                                  <span
                                    className={`text-[10px] font-mono font-bold truncate ${
                                      isValidStructuredTrackingCode(order.trackingCode)
                                        ? 'px-1.5 py-0.5 rounded-xs bg-[#18231C] text-[#FDB813]'
                                        : 'text-[#6F6860]'
                                    }`}
                                    title={order.trackingCode ? `Código: ${order.trackingCode}` : undefined}
                                  >
                                    {order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] font-semibold shrink-0">
                                  {order.quotePdfUrl && (
                                    <span className="text-[#4A453F]" title="Cotización oficial en PDF adjunta">
                                      PDF
                                    </span>
                                  )}
                                  {order.invoicePdfUrl && (
                                    <span className="text-emerald-800 font-bold" title="Factura adjunta">
                                      FAC
                                    </span>
                                  )}
                                  {order.clientApprovalStatus === 'aprobada' && (
                                    <span className="text-emerald-700 font-bold">✓ Aprobada</span>
                                  )}
                                  {order.clientApprovalStatus === 'rechazada' && (
                                    <span className="text-rose-700 font-bold">✕ Rechazada</span>
                                  )}
                                  {isDelayed && (
                                    <span className="text-rose-700 font-bold tabular-nums">
                                      {daysOld}d demorado
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Line 2: Client Title + Single Summary Row */}
                              <div>
                                <h4 className="font-bold text-sm text-[#18231C] leading-snug">
                                  {fixUtf8Encoding(order.clientName)}
                                </h4>
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#6F6860]">
                                  <span className="truncate">
                                    <strong className="text-[#18231C] font-semibold tabular-nums">
                                      {order.totalUnits} u.
                                    </strong>
                                    {' · '}
                                    {fixUtf8Encoding(order.seller || 'Sin asignar')}
                                    {order.branch ? ` · ${fixUtf8Encoding(order.branch)}` : ''}
                                  </span>
                                  <span className="font-mono font-bold text-[#18231C] tabular-nums shrink-0" title={moneyInfo.amountLabel}>
                                    <span className="text-[9px] font-sans uppercase text-[#6F6860] mr-1">
                                      {moneyInfo.shortTag}
                                    </span>
                                    $ {moneyInfo.displayAmount.toLocaleString('es-AR')}
                                  </span>
                                </div>

                                {/* Prep tags in En Bordados / Taller / Preparación */}
                                {(inPrepStage || effectivePrepTags.length > 0) && effectivePrepTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {effectivePrepTags.includes('en_taller') && (
                                      <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase bg-indigo-50 border border-indigo-200 text-indigo-900">
                                        En taller
                                      </span>
                                    )}
                                    {effectivePrepTags.includes('en_bordados') && (
                                      <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase bg-purple-50 border border-purple-200 text-purple-900">
                                        En bordados
                                      </span>
                                    )}
                                    {effectivePrepTags.includes('esperando_pedido') && (
                                      <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold uppercase bg-amber-50 border border-amber-300 text-amber-950">
                                        Esperando pedido
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Line 3: Single Quiet Neutral Details Block */}
                              {hasCalmDetails && (
                                <div className="bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs px-2.5 py-2 space-y-1 text-[11px] text-[#4A453F]">
                                  {moneyInfo.billingLabel && (
                                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold text-emerald-800">
                                      <span className="flex items-center gap-1">
                                        <Receipt className="w-3 h-3 shrink-0" />
                                        <span>{moneyInfo.billingLabel}</span>
                                      </span>
                                      {order.invoicePdfUrl && <span>PDF adjunto</span>}
                                    </div>
                                  )}

                                  {allShortagesArrived && (
                                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10px]">
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                      <span>Mercadería faltante recibida ({orderShortages.length})</span>
                                    </div>
                                  )}

                                  {pendingShortagesCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[10px]">
                                      <PackageX className="w-3 h-3 shrink-0 text-amber-700" />
                                      <span>{pendingShortagesCount} faltante(s) pendiente(s) de arribo</span>
                                    </div>
                                  )}

                                  {(order.companyLocation || order.locationUrl) && (
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="truncate flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-[#6F6860] shrink-0" />
                                        <span className="truncate">{fixUtf8Encoding(order.companyLocation || 'Ubicación cargada')}</span>
                                      </span>
                                      {order.locationUrl && (
                                        <a
                                          href={order.locationUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[#18231C] hover:underline font-bold shrink-0 flex items-center gap-0.5 text-[10px]"
                                        >
                                          <span>Mapa</span>
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {order.blockReason && (
                                    <div className="flex items-start gap-1.5 text-rose-700 font-semibold">
                                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                      <span className="line-clamp-2">
                                        Bloqueado: {fixUtf8Encoding(order.blockReason)}
                                      </span>
                                    </div>
                                  )}

                                  {order.observations && !order.blockReason && (
                                    <div className="flex items-start gap-1.5 text-[#4A453F]">
                                      <MessageSquare className="w-3 h-3 text-[#6F6860] shrink-0 mt-0.5" />
                                      <span className="line-clamp-2 leading-snug">
                                        {order.observationDate ? `${order.observationDate} · ` : ''}
                                        {fixUtf8Encoding(order.observations)}
                                      </span>
                                    </div>
                                  )}

                                  {order.reminderDate && (
                                    <div className="flex items-center gap-1.5 text-[#18231C] font-semibold">
                                      <Bell className="w-3 h-3 text-[#6F6860] shrink-0" />
                                      <span className="truncate tabular-nums">
                                        Recordatorio: {order.reminderDate}{order.reminderTime ? ` ${order.reminderTime}hs` : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Line 4: Unified Calm Button Bar */}
                              <div className="pt-2 border-t border-[#ECE5DC] flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingOrder(order);
                                    }}
                                    className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-colors shrink-0"
                                    title="Ver ficha completa"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Ficha</span>
                                  </button>
                                  <a
                                    href={`https://wa.me/?text=${encodeURIComponent(`Hola ${order.clientName}, te escribimos de Pampero Gran Mendoza para actualizarte sobre tu pedido ${order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`} (Estado: ${col.label}). ${moneyInfo.amountLabel}: $${moneyInfo.displayAmount.toLocaleString('es-AR')}. ¿Tenés alguna consulta?`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0"
                                    title="Avisar al cliente por WhatsApp"
                                  >
                                    <MessageCircle className="w-3 h-3 text-[#18231C]" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>

                                {(() => {
                                  const currentOrderCol = resolveOrderColumnId(order);
                                  const currentIndex = companyColumns.findIndex((c) => c.id === currentOrderCol);
                                  const nextCol = currentIndex >= 0 && currentIndex < companyColumns.length - 1 ? companyColumns[currentIndex + 1] : null;
                                  if (!nextCol) return null;
                                  const rawFirst = fixUtf8Encoding(nextCol.label.split('/')[0].replace(/^En\s+/i, '').trim().split(' ')[0]);
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = sanitizeObjectEncoding({ ...order, status: nextCol.id as CRMOrderStatus, columnId: nextCol.id, updatedAt: new Date().toISOString() });
                                        setOrders((prev) => [updated, ...prev.filter((o) => o.id !== order.id)]);
                                        saveCRMOrder(updated).catch(console.error);
                                        recordAuditLog({
                                          module: 'CRM / Kanban',
                                          action: 'Avanzar Fase',
                                          details: `Pedido ${order.trackingCode || order.orderNumber || order.id} (${order.clientName || 'Cliente'}) avanzado a etapa "${nextCol.label}"`,
                                          metadata: { orderId: order.id, toStatus: nextCol.id }
                                        });
                                      }}
                                      className="px-2.5 py-1 bg-[#18231C] hover:bg-black text-white rounded-xs text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 transition-colors cursor-pointer shrink-0 max-w-full ml-auto"
                                      title={`Avanzar a ${fixUtf8Encoding(nextCol.label)}`}
                                    >
                                      <span className="truncate">{rawFirst}</span>
                                      <ArrowRight className="w-2.5 h-2.5 shrink-0 text-[#FDB813]" />
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}

                        {columnOrders.length === 0 && (
                          <div
                            className={`p-6 text-center text-[11px] text-[#8C827A] border border-dashed rounded-sm ${
                              isDragOver ? 'border-[#18231C] bg-[#18231C]/5' : 'border-[#DCD4C9]'
                            }`}
                          >
                            {isDragOver ? 'Soltar aquí' : 'Sin pedidos en esta fase'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* === TAB 1: VISITAS COMERCIALES (KANBAN) === */}
        {activeTab === 'visits' && (
          <CRMTabErrorBoundary
            tabKey="visits"
            onRetry={() => {
              try {
                const raw = JSON.parse(localStorage.getItem('pampero_lead_visits') || '[]');
                if (Array.isArray(raw)) {
                  setVisits(raw.map((v, idx) => normalizeLeadVisit(v, idx)));
                }
              } catch {
                setVisits([]);
              }
            }}
          >
            <CRMVisitsTab
              visits={visits}
              accentColor={accent}
              crmScope={crmScope}
              assignedBranch={assignedBranch}
              assignedSellerName={assignedSellerName}
              onPromoteToCompanies={handlePromoteVisitToCompanyOrder}
              onVisitsUpdated={setVisits}
              theme={theme}
            />
          </CRMTabErrorBoundary>
        )}

        {/* === TAB 3: TAREAS DEL EQUIPO (KANBAN) === */}
        {activeTab === 'tasks' && (
          <CRMTasksTab
            userSession={userSession}
            sellersList={sellersList}
            assignedBranch={assignedBranch}
            assignedSellerName={assignedSellerName}
            activeStaffUser={activeStaffUser}
            isManager={isManager}
            canControlTasks={canControlTasks}
            crmScope={crmScope}
            theme={theme}
          />
        )}

        {/* === TAB 4: CALENDARIO DE GESTIÓN === */}
        {activeTab === 'calendar' && (
          <CRMCalendarTab
            userSession={userSession}
            sellersList={sellersList}
            assignedBranch={assignedBranch}
            assignedSellerName={assignedSellerName}
            activeStaffUser={activeStaffUser}
            isManager={isManager}
            crmScope={crmScope}
            orders={orders}
            visits={visits}
            theme={theme}
          />
        )}

        {/* === TAB 5: PEDIDOS A PROVEEDOR === */}
        {activeTab === 'suppliers' && (
          <CRMSupplierOrdersTab
            orders={supplierOrders}
            crmOrders={orders}
            accentColor={accent}
            theme={theme}
            onUpdateCrmOrder={(updated) =>
              setOrders((prev) => [updated, ...prev.filter((o) => o.id !== updated.id)])
            }
          />
        )}
          </div>
        </div>
      </div>

      {/* Notifications Popover / Panel */}
      <CRMNotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        notifications={crmNotifications}
        readIds={readNotifIds}
        onMarkAsRead={handleMarkNotifAsRead}
        onMarkAllAsRead={handleMarkAllNotifsAsRead}
        onSelectOrder={(ord) => {
          const isMissingAmt = (Number(ord.totalEstimated) || 0) <= 0;
          if (isMissingAmt) {
            setSelectedOrderForDetail(ord);
          } else {
            setViewingOrder(ord);
          }
        }}
        onGoToVisits={() => setActiveTab('visits')}
        onOpenChat={onOpenChat}
        theme={theme}
      />

      {/* Read-Only Order Ficha Modal (with internal Editar Ficha button) */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-xs bg-[#FDB813] text-[#18231C]">
                    {viewingOrder.trackingCode || viewingOrder.orderNumber || `#${viewingOrder.id.slice(-6)}`}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-[#DCD4C9]">
                    {fixUtf8Encoding(viewingOrder.branch || 'Maipú')}
                  </span>
                </div>
                <h4 className="font-bold text-base uppercase tracking-wider truncate mt-1">
                  {fixUtf8Encoding(viewingOrder.clientName)}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-[#8C827A]">Código de Seguimiento</span>
                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-xs bg-[#18231C] text-[#FDB813]">
                  {viewingOrder.trackingCode || viewingOrder.orderNumber || `#${viewingOrder.id.slice(-6)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-[#FAF8F5] p-3 rounded-xs border border-[#DCD4C9]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Etapa / Estado</span>
                  <span className="font-bold text-[#18231C]">
                    {fixUtf8Encoding(
                      companyColumns.find((c) => c.id === ((viewingOrder as any).columnId || viewingOrder.status))?.label ||
                        viewingOrder.status
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Vendedor Asignado</span>
                  <span className="font-bold text-[#18231C]">{fixUtf8Encoding(viewingOrder.seller || 'Sin asignar')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Prendas</span>
                  <span className="font-bold text-[#18231C]">{viewingOrder.totalUnits || 0} unidades</span>
                </div>
                <div>
                  {(() => {
                    const mi = getOrderMoneyInfo(viewingOrder);
                    return (
                      <>
                        <span className="text-[10px] font-bold uppercase text-[#8C827A] block">{mi.amountLabel}</span>
                        <span className="font-bold text-emerald-700">$ {mi.displayAmount.toLocaleString('es-AR')}</span>
                        {mi.billingLabel && (
                          <span className="block text-[10px] font-bold text-emerald-800 mt-0.5">{mi.billingLabel}</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {(() => {
                const viewShortages = getOrderShortagesList(viewingOrder);
                const pendingCount = viewShortages.filter((s) => s.status !== 'recibido').length;
                const viewPrepTags = Array.from(
                  new Set([
                    ...(Array.isArray(viewingOrder.prepTags) ? viewingOrder.prepTags : []),
                    ...(pendingCount > 0 ? ['esperando_pedido'] : []),
                  ])
                );
                return (
                  <>
                    {viewPrepTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {viewPrepTags.includes('en_taller') && (
                          <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase bg-indigo-50 border border-indigo-200 text-indigo-900">
                            En taller
                          </span>
                        )}
                        {viewPrepTags.includes('en_bordados') && (
                          <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase bg-purple-50 border border-purple-200 text-purple-900">
                            En bordados
                          </span>
                        )}
                        {viewPrepTags.includes('esperando_pedido') && (
                          <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase bg-amber-50 border border-amber-300 text-amber-950">
                            Esperando pedido
                          </span>
                        )}
                      </div>
                    )}
                    {viewShortages.length > 0 && (
                      <div className={`p-2.5 rounded-xs border text-[11px] space-y-1 ${pendingCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
                        <div className="font-bold uppercase text-[10px] flex items-center justify-between">
                          <span>{pendingCount === 0 ? '✓ Faltantes recibidos en sucursal' : `Faltantes (${pendingCount} pendiente/s)`}</span>
                          <span>Total: {viewShortages.length}</span>
                        </div>
                        {viewShortages.slice(0, 4).map((sh) => (
                          <div key={sh.id} className="flex items-center justify-between text-[10px]">
                            <span className="truncate">{sh.quantity}x {sh.productName} ({sh.size}/{sh.color})</span>
                            <span className={`font-bold uppercase ${sh.status === 'recibido' ? 'text-emerald-700' : 'text-amber-800'}`}>
                              {sh.status === 'recibido' ? 'Recibido' : sh.status === 'pedido' ? 'Pedido' : 'Pendiente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {(viewingOrder.companyLocation || viewingOrder.locationUrl) && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xs space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-blue-900 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-700" />
                    <span>Ubicación de la Empresa (Entrega / Logística)</span>
                  </span>
                  <p className="text-xs font-semibold text-blue-950">
                    {fixUtf8Encoding(viewingOrder.companyLocation || 'Ubicación registrada')}
                  </p>
                  {viewingOrder.locationUrl && (
                    <a
                      href={viewingOrder.locationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xs text-[11px] font-bold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir Ubicación en Google Maps</span>
                    </a>
                  )}
                </div>
              )}

              {viewingOrder.blockReason && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xs text-red-900 font-semibold">
                  ⚠ Bloqueado: {fixUtf8Encoding(viewingOrder.blockReason)}
                </div>
              )}

              {(viewingOrder.observations || viewingOrder.reminderDate || (viewingOrder.observationHistory && viewingOrder.observationHistory.length > 0)) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#8C827A]">
                      Observaciones {viewingOrder.observationDate ? `(${viewingOrder.observationDate})` : ''}
                    </span>
                    {viewingOrder.reminderDate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-xs flex items-center gap-1">
                        <Bell className="w-3 h-3 text-[#B9522F]" />
                        Recordatorio: {viewingOrder.reminderDate} {viewingOrder.reminderTime || ''}
                      </span>
                    )}
                  </div>
                  {viewingOrder.observations && (
                    <p className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[#18231C] whitespace-pre-wrap">
                      {fixUtf8Encoding(viewingOrder.observations)}
                    </p>
                  )}
                  {Array.isArray(viewingOrder.observationHistory) && viewingOrder.observationHistory.length > 1 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto pt-1">
                      <span className="text-[9px] font-bold uppercase text-[#8C827A] block">Historial de observaciones:</span>
                      {viewingOrder.observationHistory.map((h) => (
                        <div key={h.id} className="text-[10px] p-1.5 bg-white border border-[#ECE5DC] rounded-xs">
                          <span className="font-bold text-[#18231C]">{h.observationDate} · {fixUtf8Encoding(h.author)}:</span>{' '}
                          <span className="text-[#4A453F]">{fixUtf8Encoding(h.text)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {viewingOrder.quotePdfUrl && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xs flex items-center justify-between">
                  <span className="font-bold text-purple-950 truncate">Cotización: {viewingOrder.quotePdfName || 'Cotizacion_Oficial.pdf'}</span>
                  <a
                    href={viewingOrder.quotePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={viewingOrder.quotePdfName || 'Cotizacion_Oficial.pdf'}
                    className="px-2.5 py-1 bg-white border border-purple-300 rounded-xs font-bold text-purple-900 shrink-0"
                  >
                    Ver PDF
                  </a>
                </div>
              )}

              {viewingOrder.invoicePdfUrl && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xs flex items-center justify-between">
                  <span className="font-bold text-emerald-950 truncate">Factura: {viewingOrder.invoicePdfName || 'Factura.pdf'}</span>
                  <a
                    href={viewingOrder.invoicePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={viewingOrder.invoicePdfName || 'Factura.pdf'}
                    className="px-2.5 py-1 bg-white border border-emerald-300 rounded-xs font-bold text-emerald-900 shrink-0"
                  >
                    Ver Factura
                  </a>
                </div>
              )}

              {Array.isArray(viewingOrder.items) && viewingOrder.items.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block mb-1">
                    Artículos ({viewingOrder.items.length})
                  </span>
                  <div className="bg-[#FAF8F5] p-2.5 rounded-xs border border-[#DCD4C9] space-y-1 max-h-32 overflow-y-auto">
                    {viewingOrder.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] border-b border-neutral-200/60 pb-0.5 last:border-none">
                        <span>{it.quantity}x {it.product?.name || it.name || 'Artículo'} ({it.selectedSize || it.size || 'U'})</span>
                        <span className="font-semibold">${(it.unitPrice || it.product?.price || 0) * it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowObsModal(true)}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-[#18231C]" />
                  <span className="tabular-nums">
                    {st?.crmObservationsBtnText || 'Observaciones'} ({Array.isArray(viewingOrder.observationHistory) ? viewingOrder.observationHistory.length : viewingOrder.observations ? 1 : 0})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowShortagesModal(true)}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <PackageX className="w-3.5 h-3.5 text-[#18231C]" />
                  <span className="tabular-nums">
                    {st?.crmShortagesBtnText || 'Faltantes'} ({getOrderShortagesList(viewingOrder).filter((s) => s.status !== 'recibido').length})
                  </span>
                </button>

                <a
                  href={`https://wa.me/${viewingOrder.clientPhone ? String(viewingOrder.clientPhone).replace(/\D/g, '') : ''}?text=${encodeURIComponent(`Hola ${viewingOrder.clientName}, te escribimos de Pampero Gran Mendoza por tu pedido ${viewingOrder.trackingCode || viewingOrder.orderNumber || `#${viewingOrder.id.slice(-6)}`}. ${getOrderMoneyInfo(viewingOrder).amountLabel}: $${getOrderMoneyInfo(viewingOrder).displayAmount.toLocaleString('es-AR')}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#18231C]" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const target = viewingOrder;
                    setViewingOrder(null);
                    setSelectedOrderForDetail(target);
                  }}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#18231C]" />
                  <span>Editar Ficha</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal Observaciones para Seguimiento Empresas */}
      {viewingOrder && (
        <CRMObservationsModal
          isOpen={showObsModal}
          onClose={() => setShowObsModal(false)}
          entityTitle={viewingOrder.clientName}
          trackingCode={viewingOrder.trackingCode || viewingOrder.orderNumber}
          branch={viewingOrder.branch}
          currentObservation={viewingOrder.observations}
          currentObservationDate={viewingOrder.observationDate}
          currentReminderDate={viewingOrder.reminderDate}
          currentReminderTime={viewingOrder.reminderTime}
          currentReminderNote={viewingOrder.reminderNote}
          history={viewingOrder.observationHistory}
          activeStaffUser={activeStaffUser}
          onSaveObservation={async (payload) => {
            const updated = sanitizeObjectEncoding({
              ...viewingOrder,
              observations: payload.observations,
              observationDate: payload.observationDate,
              reminderDate: payload.reminderDate,
              reminderTime: payload.reminderTime,
              reminderNote: payload.reminderNote,
              observationHistory: payload.observationHistory,
              updatedAt: new Date().toISOString(),
            });
            setViewingOrder(updated);
            setOrders((prev) => [updated, ...prev.filter((o) => o.id !== updated.id)]);
            await saveCRMOrder(updated);
            if (payload.reminderDate) {
              await upsertObservationReminderCalendarEvent('order', {
                sourceId: updated.id,
                title: `${updated.clientName} (${updated.trackingCode || updated.orderNumber || updated.id})`,
                reminderDate: payload.reminderDate,
                reminderTime: payload.reminderTime,
                reminderNote: payload.reminderNote || payload.observations,
                branch: updated.branch,
                seller: updated.seller,
                createdBy: activeStaffUser,
                createdByEmail: userSession?.email,
              });
            }
          }}
        />
      )}

      {/* Sub-modal Tabla de Faltantes para Seguimiento Empresas */}
      {viewingOrder && (
        <CRMOrderShortagesModal
          isOpen={showShortagesModal}
          onClose={() => setShowShortagesModal(false)}
          order={viewingOrder}
          products={catalogProducts}
          categories={categories}
          knownSuppliers={knownSuppliers}
          activeStaffUser={activeStaffUser}
          theme={theme}
          onUpdateShortages={async (ord, nextShortages, removedIds) => {
            const updated: CRMOrder = sanitizeObjectEncoding({
              ...ord,
              shortages: nextShortages,
              updatedAt: new Date().toISOString(),
            });
            setViewingOrder(updated);
            setOrders((prev) => [updated, ...prev.filter((o) => o.id !== updated.id)]);
            await saveCRMOrder(updated);
            await Promise.all(nextShortages.map((s) => saveCRMOrderShortage(s)));
            if (Array.isArray(removedIds) && removedIds.length > 0) {
              await Promise.all(removedIds.map((rid) => deleteCRMOrderShortage(rid)));
            }
          }}
        />
      )}

      {/* Detail & Edit Order Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          theme={theme}
          activeStaffUser={activeStaffUser}
          sellersList={sellersList}
          companyColumns={companyColumns}
          branchOptions={configuredBranchNames}
          resolveBranch={(val) => resolveConfiguredBranch(val, true)}
          onSave={async (updated) => {
            const cleanUpdated = sanitizeObjectEncoding(updated);
            setOrders((prev) => [cleanUpdated, ...prev.filter((o) => o.id !== cleanUpdated.id)]);
            try {
              await saveCRMOrder(cleanUpdated);
              await upsertObservationReminderCalendarEvent('order', {
                sourceId: cleanUpdated.id,
                title: `${cleanUpdated.clientName} (${cleanUpdated.trackingCode || cleanUpdated.orderNumber || cleanUpdated.id})`,
                reminderDate: cleanUpdated.reminderDate || '',
                reminderTime: cleanUpdated.reminderTime,
                reminderNote: cleanUpdated.reminderNote || cleanUpdated.observations,
                branch: cleanUpdated.branch,
                seller: cleanUpdated.seller,
                createdBy: activeStaffUser,
                createdByEmail: userSession?.email,
              });
              recordAuditLog({
                userEmail: userSession?.email || 'operador@pampero.com.ar',
                userName: activeStaffUser,
                userRole: userSession?.role || 'employee',
                module: 'CRM',
                action: 'Editar',
                details: `Modificó pedido ${cleanUpdated.orderNumber || cleanUpdated.id} (${cleanUpdated.clientName}) - Fase: ${cleanUpdated.status}, Sucursal: ${cleanUpdated.branch}, Asesor: ${cleanUpdated.seller}${cleanUpdated.quotePdfUrl ? ' [PDF cargado]' : ''}`,
              });
            } catch (err) {
              console.error('Error al guardar orden:', err);
            }
            setSelectedOrderForDetail(null);
          }}
          onDelete={async (id) => {
            const ord = orders.find((o) => o.id === id);
            setOrders((prev) => prev.filter((o) => o.id !== id));
            try {
              await deleteCRMOrder(id);
              recordAuditLog({
                userEmail: userSession?.email || 'operador@pampero.com.ar',
                userName: activeStaffUser,
                userRole: userSession?.role || 'employee',
                module: 'CRM',
                action: 'Eliminar',
                details: `Eliminó pedido ${ord?.orderNumber || id} (${ord?.clientName || 'Cliente'}) del CRM`,
              });
            } catch (err) {
              console.error('Error al eliminar orden:', err);
            }
            setSelectedOrderForDetail(null);
          }}
        />
      )}

      {/* Modal: New Manual Order */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSave={handleCreateManualOrder}
          accent={accent}
          branchOptions={configuredBranchNames}
        />
      )}
    </div>
  );
};

/* ============================================ */
/*  MODAL: Detalle y Estado del Pedido          */
/* ============================================ */
const OrderDetailModal: React.FC<{
  order: CRMOrder;
  onClose: () => void;
  onSave: (order: CRMOrder) => void;
  onDelete: (id: string) => void;
  theme?: ThemeConfig;
  activeStaffUser?: string;
  sellersList?: Seller[];
  companyColumns: KanbanColumnConfig[];
  branchOptions: string[];
  resolveBranch: (val?: string) => string;
}> = ({ order, onClose, onSave, onDelete, theme, activeStaffUser = 'Personal Pampero', sellersList = [], companyColumns, branchOptions, resolveBranch }) => {
  const resolveCol = (raw?: string): string => {
    const val = String(raw || '').trim();
    const norm = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm === 'cancelado') return 'cancelado';
    const match = companyColumns.find(
      (c) =>
        c.id === val ||
        c.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === norm ||
        c.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === norm
    );
    return match ? match.id : (companyColumns[0]?.id || 'cotizacion');
  };
  const [clientName, setClientName] = useState(order.clientName || '');
  const [clientType, setClientType] = useState<'empresa' | 'consumidor_final'>(order.clientType || 'empresa');
  const [clientPhone, setClientPhone] = useState(order.clientPhone || '');
  const [clientEmail, setClientEmail] = useState(order.clientEmail || '');
  const [totalUnits, setTotalUnits] = useState(String(order.totalUnits || ''));
  const [orderDateInput, setOrderDateInput] = useState(() => {
    const raw = String(order.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return new Date().toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<string>(() => resolveCol((order as any).columnId || order.status));
  const [seller, setSeller] = useState(order.seller || 'Sin asignar');
  const [branch, setBranch] = useState(() => resolveBranch(order.branch) || branchOptions[0] || 'Pampero Ciudad de Mendoza');
  const [companyLocation, setCompanyLocation] = useState(order.companyLocation || '');
  const [locationUrl, setLocationUrl] = useState(order.locationUrl || '');
  const [totalEstimated, setTotalEstimated] = useState(String(order.totalEstimated || ''));
  const [totalInvoiced, setTotalInvoiced] = useState(String(order.totalInvoiced || ''));
  const [billingStatus, setBillingStatus] = useState<'sin_facturar' | 'facturado_parcial' | 'facturado_total'>(
    order.billingStatus || 'sin_facturar'
  );
  const [prepTags, setPrepTags] = useState<('en_taller' | 'en_bordados' | 'esperando_pedido')[]>(
    Array.isArray(order.prepTags) ? order.prepTags : []
  );
  const [blockReason, setBlockReason] = useState(order.blockReason || '');
  const [observations, setObservations] = useState(order.observations || '');
  const [observationDate, setObservationDate] = useState(order.observationDate || new Date().toISOString().split('T')[0]);
  const [reminderDate, setReminderDate] = useState(order.reminderDate || '');
  const [reminderTime, setReminderTime] = useState(order.reminderTime || '');
  const [reminderNote, setReminderNote] = useState(order.reminderNote || '');
  const [generateReminder, setGenerateReminder] = useState(Boolean(order.reminderDate));
  const [quotePdfUrl, setQuotePdfUrl] = useState<string | undefined>(order.quotePdfUrl);
  const [quotePdfName, setQuotePdfName] = useState<string | undefined>(order.quotePdfName);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | undefined>(order.invoicePdfUrl);
  const [invoicePdfName, setInvoicePdfName] = useState<string | undefined>(order.invoicePdfName);
  const [clientApprovalStatus, setClientApprovalStatus] = useState<'pendiente' | 'aprobada' | 'rechazada'>(order.clientApprovalStatus || 'pendiente');
  const [clientRejectionReason, setClientRejectionReason] = useState<string>(order.clientRejectionReason || '');

  const stageIndex = companyColumns.findIndex((c) => c.id === status);
  const approvedIdx = (() => {
    const idx = companyColumns.findIndex((c) => {
      const k = (c.id + ' ' + c.label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return k.includes('sena') || k.includes('aprob');
    });
    return idx >= 0 ? idx : 1;
  })();
  const isApprovedOrLater = status !== 'cancelado' && stageIndex >= approvedIdx;

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor seleccioná un archivo en formato PDF.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      alert('El archivo PDF no debe superar los 12MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setQuotePdfUrl(reader.result as string);
      setQuotePdfName(file.name);
      setClientApprovalStatus('pendiente');
    };
    reader.readAsDataURL(file);
  };

  const handleInvoicePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor seleccioná un archivo en formato PDF.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      alert('El archivo PDF no debe superar los 12MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInvoicePdfUrl(reader.result as string);
      setInvoicePdfName(file.name);
      if (billingStatus === 'sin_facturar') {
        setBillingStatus('facturado_total');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const activeReminderDate = generateReminder && reminderDate.trim() ? reminderDate.trim() : undefined;
    const activeReminderTime = generateReminder && reminderTime.trim() ? reminderTime.trim() : undefined;
    const cleanObs = observations.trim();
    const activeReminderNote =
      generateReminder && (reminderNote.trim() || cleanObs) ? (reminderNote.trim() || cleanObs) : undefined;

    const prevHistory: ObservationHistoryEntry[] = Array.isArray(order.observationHistory)
      ? order.observationHistory
      : [];
    const obsChanged = cleanObs && cleanObs !== (order.observations || '').trim();
    const remChanged = activeReminderDate && activeReminderDate !== (order.reminderDate || '');
    const nextHistory: ObservationHistoryEntry[] =
      obsChanged || remChanged
        ? [
            {
              id: `obs-${Date.now()}`,
              observationDate: observationDate || new Date().toISOString().split('T')[0],
              text: cleanObs || activeReminderNote || 'Recordatorio programado',
              reminderDate: activeReminderDate,
              reminderTime: activeReminderTime,
              author: activeStaffUser || seller.trim() || 'Equipo Pampero',
              createdAt: new Date().toISOString(),
            },
            ...prevHistory,
          ]
        : prevHistory;

    const nextDateIso = orderDateInput ? `${orderDateInput}T12:00:00.000Z` : order.date;

    onSave({
      ...order,
      clientName: clientName.trim() || order.clientName,
      clientType,
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      totalUnits: totalUnits.trim() === '' ? (order.totalUnits || 0) : Math.max(0, Number(totalUnits) || 0),
      date: nextDateIso,
      status: status as CRMOrderStatus,
      columnId: status,
      seller: seller.trim() || 'Sin asignar',
      branch,
      companyLocation: companyLocation.trim() || undefined,
      locationUrl: locationUrl.trim() || undefined,
      totalEstimated: totalEstimated.trim() === '' ? (order.totalEstimated || 0) : Math.max(0, Number(totalEstimated) || 0),
      totalInvoiced: totalInvoiced.trim() === '' ? (order.totalInvoiced || undefined) : Math.max(0, Number(totalInvoiced) || 0),
      billingStatus,
      prepTags,
      blockReason: blockReason.trim() || undefined,
      observations: cleanObs || undefined,
      observationDate: cleanObs || activeReminderDate ? (observationDate || new Date().toISOString().split('T')[0]) : undefined,
      reminderDate: activeReminderDate,
      reminderTime: activeReminderTime,
      reminderNote: activeReminderNote,
      observationHistory: nextHistory.length > 0 ? nextHistory : undefined,
      quotePdfUrl,
      quotePdfName,
      quotePdfUploadedAt: quotePdfUrl ? (order.quotePdfUploadedAt || new Date().toISOString()) : undefined,
      quotePdfUploadedBy: quotePdfUrl ? (order.quotePdfUploadedBy || activeStaffUser) : undefined,
      invoicePdfUrl,
      invoicePdfName,
      invoicePdfUploadedAt: invoicePdfUrl ? (order.invoicePdfUploadedAt || new Date().toISOString()) : undefined,
      invoicePdfUploadedBy: invoicePdfUrl ? (order.invoicePdfUploadedBy || activeStaffUser) : undefined,
      clientApprovalStatus,
      clientRejectionReason: clientRejectionReason.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleContactWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola ${clientName || order.clientName}, nos comunicamos de Pampero Mendoza respecto a la cotización / pedido ${order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`}. ¿Cómo podemos ayudarte?`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div 
        style={{
          backgroundColor: theme?.crmCardBgColor || '#FFFFFF',
          borderColor: theme?.crmCardBorderColor || '#DCD4C9',
          color: theme?.crmCardTextColor || '#18231C'
        }}
        className="rounded-xs border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div 
          style={{ backgroundColor: theme?.crmCardHeaderBg || '#18231C' }}
          className="px-6 py-4 flex items-center justify-between text-white"
        >
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="font-mono text-[#FDB813]">{order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`}</span>
              <span>·</span>
              <span className="truncate max-w-[200px]">{clientName || order.clientName}</span>
            </h3>
            <p className="text-[11px] text-[#DCD4C9]/80 font-mono mt-0.5">
              Registrado el {formatDateTime(order.date)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Datos principales editables del Pedido */}
          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Empresa / Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold text-[#18231C]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Tipo</label>
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none font-semibold"
                >
                  <option value="empresa">Empresa</option>
                  <option value="consumidor_final">Consumidor Final</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Teléfono</label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="261..."
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Prendas</label>
                  <input
                    type="number"
                    min={0}
                    value={totalUnits}
                    onChange={(e) => setTotalUnits(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Fecha</label>
                  <input
                    type="date"
                    value={orderDateInput}
                    onChange={(e) => setOrderDateInput(e.target.value)}
                    className="w-full px-1.5 py-1.5 text-[11px] border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Fase / Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold text-[#18231C]"
              >
                {companyColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {fixUtf8Encoding(col.label)}
                  </option>
                ))}
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                {isApprovedOrLater ? 'Monto Cotizado $' : 'Monto Estimado $'}
              </label>
              <input
                type="number"
                value={totalEstimated}
                onChange={(e) => setTotalEstimated(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold text-emerald-700"
              />
            </div>
          </div>

          {/* Etiquetas de Preparación / Taller / Bordados */}
          <div className="p-2.5 bg-purple-50/60 border border-purple-200 rounded-xs space-y-1.5">
            <span className="block text-[10px] text-purple-950 uppercase font-bold">
              Etiquetas de Preparación (Taller / Bordado / Proveedor)
            </span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'en_taller', label: 'En taller' },
                  { key: 'en_bordados', label: 'En bordados' },
                  { key: 'esperando_pedido', label: 'Esperando pedido' },
                ] as const
              ).map((tag) => {
                const active = prepTags.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() =>
                      setPrepTags((prev) =>
                        active ? prev.filter((t) => t !== tag.key) : [...prev, tag.key]
                      )
                    }
                    className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#18231C] text-[#FDB813] border-[#18231C]'
                        : 'bg-white text-[#18231C] border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asesor (texto libre con sugerencias) y Sucursal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold">
                  Asesor Comercial (Libre / Editable)
                </label>
                {activeStaffUser && (
                  <button
                    type="button"
                    onClick={() => setSeller(activeStaffUser)}
                    className="text-[9px] text-[#B9522F] hover:underline font-bold cursor-pointer"
                  >
                    Asignarme
                  </button>
                )}
              </div>
              <input
                type="text"
                list="order-detail-sellers-datalist"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder="Nombre del vendedor"
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white text-[#18231C] font-semibold outline-none focus:border-[#FDB813]"
              />
              <datalist id="order-detail-sellers-datalist">
                {activeStaffUser && <option value={activeStaffUser} />}
                {sellersList.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
                <option value="Itatí" />
                <option value="Guada" />
                <option value="Carolina" />
                <option value="Gustavo" />
                <option value="Sin asignar" />
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Sucursal Asignada (Editable)
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white text-[#18231C] font-semibold outline-none focus:border-[#FDB813]"
              >
                {branchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="Todas">Todas las sucursales</option>
              </select>
            </div>
          </div>

          {/* Ubicación de la empresa para entregas / cadetería */}
          <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] text-blue-950 uppercase font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-700" />
                <span>Ubicación de la Empresa (Entrega / Logística)</span>
              </label>
              {locationUrl && (
                <a
                  href={locationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Abrir Mapa</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                placeholder="Dirección o referencia"
                className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xs bg-white outline-none focus:border-blue-500"
              />
              <input
                type="url"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder="Link Google Maps (opcional)"
                className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xs bg-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Subir PDF de Cotización Oficial desde Google Sheets */}
          <div className="pt-3 border-t border-[#ECE5DC] space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#B9522F]" />
                <span>Cotización Oficial en PDF</span>
              </label>
              {quotePdfUrl && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> PDF Cargado
                </span>
              )}
            </div>

            {quotePdfUrl ? (
              <div className="p-3 bg-neutral-50 rounded-xs border border-[#DCD4C9] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-bold text-[#18231C] truncate font-mono">
                      {quotePdfName || 'Cotizacion_Oficial.pdf'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={quotePdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={quotePdfName || 'Cotizacion_Oficial.pdf'}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-[#DCD4C9] text-xs font-bold text-[#18231C] rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-[#B9522F]" />
                      <span>Ver / Descargar</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setQuotePdfUrl(undefined);
                        setQuotePdfName(undefined);
                        setClientApprovalStatus('pendiente');
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                      title="Quitar archivo PDF"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Estado de Aprobación por el Cliente */}
                <div className="pt-2 border-t border-neutral-200 text-xs">
                  {clientApprovalStatus === 'aprobada' ? (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xs text-emerald-900 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">✓ Cotización Aceptada y Confirmada por el Cliente</span>
                        {order.clientApprovalDate && (
                          <span className="text-[10px] text-emerald-700 block">
                            Fecha: {formatDateTime(order.clientApprovalDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : clientApprovalStatus === 'rechazada' ? (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xs text-red-950 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>Cotización Rechazada por el Cliente</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClientApprovalStatus('pendiente');
                            setClientRejectionReason('');
                          }}
                          className="text-[10px] font-bold text-[#18231C] underline hover:text-[#B9522F] cursor-pointer"
                        >
                          Reiniciar ciclo
                        </button>
                      </div>
                      {clientRejectionReason && (
                        <p className="text-[11px] text-red-800 italic bg-white/60 p-2 rounded-xs border border-red-100">
                          "{clientRejectionReason}"
                        </p>
                      )}
                      <p className="text-[10px] text-red-700">
                        Cargá un nuevo PDF corregido desde tus planillas para reiniciar el proceso de aprobación.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[#6F6860] text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Esperando respuesta / confirmación del cliente en su panel.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label
                  className="w-full py-2.5 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border-2 border-dashed border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#B9522F]" />
                  <span>Subir PDF de Cotización (desde planilla de Google)</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handlePdfFileChange}
                  />
                </label>
                <p className="text-[10px] text-[#8C827A] mt-1 text-center">
                  Cargá el archivo PDF generado desde tus planillas de Google para que el cliente pueda revisarlo y confirmar el pedido.
                </p>
              </div>
            )}
          </div>

          {/* Facturación: Monto Facturado, Estado y PDF de Factura */}
          <div className="pt-3 border-t border-[#ECE5DC] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                <span>Facturación y Comprobante PDF</span>
              </label>
              {invoicePdfUrl && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Factura Cargada
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Estado de Facturación
                </label>
                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold text-[#18231C]"
                >
                  <option value="sin_facturar">Sin facturar</option>
                  <option value="facturado_parcial">Facturado parcial</option>
                  <option value="facturado_total">Facturado el total</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Monto Facturado $ (opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={totalInvoiced}
                  onChange={(e) => setTotalInvoiced(e.target.value)}
                  placeholder="Si difiere del cotizado"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold text-emerald-700"
                />
              </div>
            </div>

            {invoicePdfUrl ? (
              <div className="p-2.5 bg-emerald-50/70 rounded-xs border border-emerald-200 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-950 truncate font-mono">
                  {invoicePdfName || 'Factura.pdf'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={invoicePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={invoicePdfName || 'Factura.pdf'}
                    className="px-2 py-1 bg-white border border-emerald-300 rounded-xs text-[11px] font-bold text-emerald-900"
                  >
                    Descargar
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoicePdfUrl(undefined);
                      setInvoicePdfName(undefined);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                    title="Quitar factura PDF"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="w-full py-2 px-3 bg-[#FAF8F5] hover:bg-[#ECE5DC] border-2 border-dashed border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-emerald-700" />
                <span>Subir PDF de Factura</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleInvoicePdfChange}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-[10px] text-red-700 uppercase font-bold mb-1">
              Motivo de Bloqueo (si está trabado)
            </label>
            <input
              type="text"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ej: Falta entrega de seña, demora tela Grafa..."
              className="w-full px-2.5 py-1.5 text-xs border border-red-300 rounded-xs bg-red-50/50 outline-none"
            />
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold">
                Notas y Observaciones
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-[#6F6860]">Fecha Obs.:</span>
                <input
                  type="date"
                  value={observationDate}
                  onChange={(e) => setObservationDate(e.target.value)}
                  className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none focus:border-[#B9522F]"
                />
              </div>
            </div>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Observaciones de entrega, bordados especiales..."
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none"
            />

            <div className="pt-2 border-t border-[#DCD4C9]/80 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-[#18231C] text-[11px]">
                <input
                  type="checkbox"
                  checked={generateReminder}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setGenerateReminder(checked);
                    if (checked && !reminderDate) {
                      setReminderDate(new Date().toISOString().split('T')[0]);
                    }
                  }}
                  className="accent-[#B9522F] w-3.5 h-3.5 cursor-pointer"
                />
                <Bell className="w-3.5 h-3.5 text-[#B9522F]" />
                <span>Generar notificación y evento recordatorio en Calendario</span>
              </label>

              {generateReminder && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Fecha Recordatorio *
                    </label>
                    <input
                      type="date"
                      required={generateReminder}
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Hora (opcional)
                    </label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                      Texto de Aviso
                    </label>
                    <input
                      type="text"
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      placeholder="Ej: Confirmar seña o entrega"
                      className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items breakdown if present */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="pt-2 border-t border-[#ECE5DC]">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1.5">
                Artículos Cotizados ({order.items.length})
              </label>
              <div className="bg-[#FAF8F5] p-2.5 rounded-xs border border-[#ECE5DC] space-y-1 text-xs max-h-36 overflow-y-auto">
                {order.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-neutral-200/60 last:border-none">
                    <span>
                      {it.quantity}x {it.product?.name || it.name || 'Artículo'} (Talle: {it.selectedSize || it.size || 'U'})
                    </span>
                    <span className="font-semibold">${(it.unitPrice || it.product?.price || 0) * it.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#DCD4C9] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Eliminar este pedido del CRM?')) onDelete(order.id);
              }}
              className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
            >
              Eliminar Pedido
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleContactWhatsApp}
                className="px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-xs flex items-center gap-1 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs hover:bg-black cursor-pointer shadow-xs"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================ */
/*  MODAL: Crear Pedido Manual                  */
/* ============================================ */
const NewOrderModal: React.FC<{
  onClose: () => void;
  onSave: (data: any) => void;
  accent: string;
  branchOptions: string[];
}> = ({ onClose, onSave, branchOptions }) => {
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'empresa' | 'consumidor_final'>('empresa');
  const [seller, setSeller] = useState('Itatí');
  const [branch, setBranch] = useState(branchOptions[0] || 'Pampero Maipú');
  const [companyLocation, setCompanyLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [totalUnits, setTotalUnits] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('');
  const [observations, setObservations] = useState('');
  const [observationDate, setObservationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [generateReminder, setGenerateReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    onSave({
      clientName,
      clientType,
      seller,
      branch,
      companyLocation,
      locationUrl,
      totalUnits,
      totalEstimated,
      observations,
      observationDate,
      reminderDate: generateReminder && reminderDate ? reminderDate : undefined,
      reminderTime: generateReminder && reminderTime ? reminderTime : undefined,
      reminderNote: generateReminder && (reminderNote || observations) ? (reminderNote || observations) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold text-sm uppercase tracking-wider">Nueva Empresa / Pedido</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
              Empresa / Cliente *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Razón Social o Cliente"
              className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Tipo</label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              >
                <option value="empresa">Empresa</option>
                <option value="consumidor_final">Consumidor Final</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Vendedor Asignado
              </label>
              <input
                type="text"
                list="new-order-sellers-datalist"
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder="Nombre del vendedor"
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              />
              <datalist id="new-order-sellers-datalist">
                <option value="Itatí" />
                <option value="Guada" />
                <option value="Carolina" />
                <option value="Gustavo" />
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF8F5] p-2.5 rounded-xs border border-[#DCD4C9]">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Ubicación / Dirección (opcional)
              </label>
              <input
                type="text"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                placeholder="Ej: Parque Industrial Las Heras"
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Link Google Maps (opcional)
              </label>
              <input
                type="url"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Sucursal
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              >
                {branchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Prendas
              </label>
              <input
                type="number"
                value={totalUnits}
                onChange={(e) => setTotalUnits(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Monto $
              </label>
              <input
                type="number"
                value={totalEstimated}
                onChange={(e) => setTotalEstimated(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold">
                Observaciones
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-[#6F6860]">Fecha Obs.:</span>
                <input
                  type="date"
                  value={observationDate}
                  onChange={(e) => setObservationDate(e.target.value)}
                  className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                />
              </div>
            </div>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Notas del pedido o detalles de bordado..."
              className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none resize-none"
            />
            <label className="flex items-center gap-2 cursor-pointer font-bold text-[#18231C] text-[11px] pt-1">
              <input
                type="checkbox"
                checked={generateReminder}
                onChange={(e) => {
                  setGenerateReminder(e.target.checked);
                  if (e.target.checked && !reminderDate) {
                    setReminderDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className="accent-[#B9522F] w-3.5 h-3.5 cursor-pointer"
              />
              <Bell className="w-3.5 h-3.5 text-[#B9522F]" />
              <span>Generar notificación y evento recordatorio en Calendario</span>
            </label>
            {generateReminder && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <input
                  type="date"
                  required={generateReminder}
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                />
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                />
                <input
                  type="text"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="Nota del recordatorio..."
                  className="px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCD4C9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Crear Pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
