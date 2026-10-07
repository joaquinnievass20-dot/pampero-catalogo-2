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
  EmployeeAccount
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
  KanbanColumnConfig
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
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
  Sparkles, 
  CheckCircle2, 
  MessageCircle, 
  Calendar,
  Layers,
  Phone,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { exportOrdersToExcel, importOrdersFromExcel } from '../../utils/kanbanExcelUtils';
import { CRMNotificationsModal } from './CRMNotificationsModal';
import { CRMVisitsTab } from './CRMVisitsTab';
import { CRMSupplierOrdersTab } from './CRMSupplierOrdersTab';
import { CRMCostsTab } from './CRMCostsTab';

interface CRMViewProps {
  userSession: UserSession | null;
  onClose: () => void;
  theme: ThemeConfig;
  onSetSession?: (session: UserSession) => void;
  onOpenAuth?: () => void;
}

const STATUS_COLUMNS: { id: CRMOrderStatus; label: string; color: string; bgColor: string }[] = [
  { id: 'cotizacion', label: 'Cotización Recibida', color: '#FDB813', bgColor: '#FFF8E1' },
  { id: 'sena_50', label: 'Aprobado / Seña 50%', color: '#F97316', bgColor: '#FFF7ED' },
  { id: 'produccion', label: 'En Bordados / Taller', color: '#8B5CF6', bgColor: '#F5F3FF' },
  { id: 'listo', label: 'Listo para Retirar', color: '#10B981', bgColor: '#ECFDF5' },
  { id: 'entregado', label: 'Entregado / Cerrado', color: '#3B82F6', bgColor: '#EFF6FF' },
];

export const CRMView: React.FC<CRMViewProps> = ({ userSession, onClose, theme, onSetSession, onOpenAuth }) => {
  const [orders, setOrders] = useState<CRMOrder[]>([]);
  const [visits, setVisits] = useState<LeadVisit[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [sizingCampaigns, setSizingCampaigns] = useState<SizingCampaign[]>([]);
  const [employeeSizes, setEmployeeSizes] = useState<EmployeeSizeEntry[]>([]);

  // Dynamic Kanban Columns for Seguimiento Empresas
  const [companyColumns, setCompanyColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_kanban_company_cols');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_COMPANY_COLUMNS;
  });

  useEffect(() => {
    const unsub = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanyColumns(data.companies);
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

  // CRM Visibility Scope
  const crmScope: 'all' | 'branch_only' | 'own_only' = userSession?.role === 'admin'
    ? 'all'
    : (currentEmployee?.crmScope || 'branch_only');

  const assignedBranch = currentEmployee?.branch || 'Maipú';
  const assignedSellerName = currentEmployee?.sellerName || userSession?.clientData?.fullName || '';

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
      { id: 'sel-1', name: 'Itatí', branch: 'Maipú', active: true },
      { id: 'sel-2', name: 'Guada', branch: 'Ciudad', active: true },
      { id: 'sel-3', name: 'Carolina', branch: 'Luján', active: true },
    ];
  }, []);

  const activeStaffUser = userSession?.clientData?.fullName || (userSession?.role === 'admin' ? 'Administrador General' : userSession?.email?.split('@')[0] || 'Personal Pampero');

  // Allowed CRM tabs based on Admin or Employee Permissions
  const crmTabsStr = currentEmployee?.crmTabs?.join(',') || '';
  const allowedCrmTabs: ('visits' | 'board' | 'suppliers' | 'costs')[] = React.useMemo(() => {
    if (userSession?.role === 'admin') return ['visits', 'board', 'suppliers', 'costs'];
    if (currentEmployee?.crmTabs && Array.isArray(currentEmployee.crmTabs) && currentEmployee.crmTabs.length > 0) {
      return currentEmployee.crmTabs as ('visits' | 'board' | 'suppliers' | 'costs')[];
    }
    return ['visits', 'board', 'suppliers'];
  }, [userSession?.role, crmTabsStr]);

  const [activeTab, setActiveTab] = useState<'visits' | 'board' | 'suppliers' | 'costs'>('visits');

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
      const orderId = `COT-VIS-${Date.now().toString().slice(-6)}`;
      const newOrder: CRMOrder = sanitizeObjectEncoding({
        id: orderId,
        date: new Date().toISOString(),
        quoteId: orderId,
        orderNumber: `#${orderId.slice(-6)}`,
        clientName: visit.companyName,
        clientType: 'empresa',
        status: firstColId as CRMOrderStatus,
        columnId: firstColId,
        seller: visit.seller || 'Itatí',
        branch: visit.branch || 'Maipú',
        totalUnits: visit.estimatedUnits || 1,
        totalEstimated: 0,
        observations: `[Avanzado desde Visitas Comerciales] Contacto: ${visit.contactName || '-'} · Tel: ${visit.phone || '-'} · Objetivo: ${visit.objective || '-'} · Notas: ${visit.notes || '-'}`,
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
    if (crmScope !== 'all' && assignedBranch) return assignedBranch.toLowerCase();
    return 'todos';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDelayedOnly, setFilterDelayedOnly] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<CRMOrder | null>(null);
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputOrdersRef = React.useRef<HTMLInputElement>(null);

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

  // Real-time Firestore Subscriptions with clean encoding
  useEffect(() => {
    const unsubOrders = subscribeToCRMOrders((fetched) => setOrders(fetched.map(sanitizeObjectEncoding)));
    const unsubVisits = subscribeToLeadVisits((fetched) => setVisits(fetched.map(sanitizeObjectEncoding)));
    const unsubSuppliers = subscribeToSupplierOrders((fetched) => setSupplierOrders(fetched.map(sanitizeObjectEncoding)));
    const unsubCampaigns = subscribeToSizingCampaigns((fetched) => setSizingCampaigns(fetched.map(sanitizeObjectEncoding)));
    const unsubSizes = subscribeToEmployeeSizeEntries('all', (fetched) => setEmployeeSizes(fetched.map(sanitizeObjectEncoding)));

    return () => {
      unsubOrders();
      unsubVisits();
      unsubSuppliers();
      unsubCampaigns();
      unsubSizes();
    };
  }, []);

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
    if (order && order.status !== newStatus) {
      const updated = sanitizeObjectEncoding({ 
        ...order, 
        status: newStatus, 
        columnId: newStatus, 
        updatedAt: new Date().toISOString() 
      });
      setOrders((prev) => [updated, ...prev.filter((o) => o.id !== orderId)]);
      try {
        await saveCRMOrder(updated);
      } catch (err) {
        console.error('Error al actualizar estado en Drag & Drop:', err);
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

  // Delayed orders calculation (> 7 days)
  const delayedOrdersCount = orders.filter((o) => {
    const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysOld > 7 && (o.status === 'cotizacion' || o.status === 'sena_50');
  }).length;

  const blockedOrdersCount = orders.filter((o) => Boolean(o.blockReason)).length;
  const totalAlertsCount = delayedOrdersCount + blockedOrdersCount;

  // Filtered orders with strict multi-role and local permissions enforcement
  const filteredOrders = orders.filter((o) => {
    // 1. RBAC Branch & Seller Scope Enforcements
    if (crmScope === 'branch_only' && assignedBranch) {
      if ((o.branch || '').toLowerCase() !== assignedBranch.toLowerCase()) {
        return false;
      }
    } else if (crmScope === 'own_only' && assignedSellerName) {
      if ((o.seller || '').toLowerCase() !== assignedSellerName.toLowerCase()) {
        return false;
      }
    }

    // 2. Interactive UI Filters
    const matchesSeller = sellerFilter === 'todos' || (o.seller || '').toLowerCase().includes(sellerFilter.toLowerCase());
    const matchesBranch = branchFilter === 'todos' || (o.branch || '').toLowerCase().includes(branchFilter.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      (o.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
    const isDelayed = daysOld > 7 && (o.status === 'cotizacion' || o.status === 'sena_50');

    if (filterDelayedOnly && !isDelayed && !o.blockReason) return false;

    return matchesSeller && matchesBranch && matchesSearch;
  });

  // Create manual order with guaranteed columnId and immediate local React update
  const handleCreateManualOrder = async (formData: any) => {
    try {
      const firstColId = companyColumns[0]?.id || 'cotizacion';
      const orderId = `PED-${Date.now().toString().slice(-6)}`;
      const newOrder: CRMOrder = sanitizeObjectEncoding({
        id: orderId,
        date: new Date().toISOString(),
        quoteId: orderId,
        orderNumber: `#${orderId.slice(-6)}`,
        clientName: formData.clientName,
        clientType: formData.clientType || 'empresa',
        status: (formData.status || firstColId) as CRMOrderStatus,
        columnId: formData.columnId || formData.status || firstColId,
        seller: formData.seller || assignedSellerName || 'Sin Asignar',
        branch: formData.branch || assignedBranch || 'Ciudad',
        totalUnits: Number(formData.totalUnits) || 0,
        totalEstimated: Number(formData.totalEstimated) || 0,
        observations: formData.observations || '',
        updatedAt: new Date().toISOString(),
      });

      // Immediate local React state update so card appears instantly
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);

      await saveCRMOrder(newOrder);
      setShowNewOrderModal(false);
    } catch (err) {
      console.error('Error al registrar pedido manual:', err);
      setShowNewOrderModal(false);
    }
  };

  // Safe operator simulator switcher for Admin only
  const handleSwitchStaffRole = (newRole: 'admin' | 'employee', operatorName: string) => {
    if (!onSetSession) return;
    if (newRole === 'admin') {
      const adminSession: UserSession = {
        id: 'admin-1',
        email: 'admin@pamperogm.com.ar',
        role: 'admin',
        clientData: {
          fullName: 'Administrador General',
          companyName: 'Pampero Gran Mendoza',
          cuitDni: '30-71234567-8',
          phone: '261-5276713',
          address: 'Av. San Martín 1234',
          city: 'Mendoza',
          province: 'Mendoza',
          clientType: 'empresa',
          isTaxExempt: false,
        }
      };
      localStorage.setItem('pampero_session', JSON.stringify(adminSession));
      onSetSession(adminSession);
    } else {
      const seller = sellersList.find((s) => operatorName.toLowerCase().includes(s.name.toLowerCase())) || sellersList[0];
      const empSession: UserSession = {
        id: `emp-${seller?.id || 'demo'}`,
        email: `${seller?.name.toLowerCase() || 'empleado'}@pamperogm.com.ar`,
        role: 'employee',
        clientData: {
          fullName: `${seller?.name || 'Empleado'} (${seller?.branch || 'Mendoza'})`,
          companyName: 'Pampero Gran Mendoza',
          cuitDni: '20-11223344-5',
          phone: '261-5550000',
          address: `Sucursal ${seller?.branch || 'Mendoza'}`,
          city: 'Mendoza',
          province: 'Mendoza',
          clientType: 'consumidor_final',
          isTaxExempt: false,
        }
      };
      (empSession as any).branch = seller?.branch || 'Maipú';
      (empSession as any).sellerName = seller?.name || 'Itatí';
      localStorage.setItem('pampero_session', JSON.stringify(empSession));
      onSetSession(empSession);
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
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#B9522F] block">
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-[#FAF8F5]">
      {/* Top Bar Navigation */}
      <div className="bg-white border-b border-[#DCD4C9] w-full shrink-0 shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <h2 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#B9522F]" />
            Gestión Pampero
          </h2>

          <div className="flex bg-[#ECE5DC] rounded-xs p-1 flex-wrap gap-0.5">
            {[
              { key: 'visits' as const, label: '1. Visitas Comerciales', icon: Building2 },
              { key: 'board' as const, label: '2. Seguimiento Empresas', icon: LayoutDashboard },
              { key: 'suppliers' as const, label: 'Pedidos Proveedor', icon: Truck },
              { key: 'costs' as const, label: 'Control de Costos', icon: DollarSign },
            ]
              .filter((tab) => allowedCrmTabs.includes(tab.key))
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === tab.key
                        ? 'bg-white shadow-xs text-[#18231C]'
                        : 'text-[#6F6860] hover:text-[#18231C]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
          {/* Active staff switcher / identity badge */}
          {userSession?.role === 'admin' && onSetSession ? (
            <div className="flex items-center gap-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] px-2.5 py-1 rounded-xs">
              <span className="text-[10px] text-[#8C827A] uppercase font-bold">Operador:</span>
              <select
                value={activeStaffUser}
                onChange={(e) => {
                  const name = e.target.value;
                  const role = name.includes('Admin') ? 'admin' : 'employee';
                  handleSwitchStaffRole(role, name);
                }}
                className="font-bold text-[#18231C] bg-transparent outline-none cursor-pointer text-xs"
                title="Simular vista de operador (Exclusivo Administrador)"
              >
                <option value="Administrador General">Administrador General (Todo)</option>
                {sellersList.map((s) => (
                  <option key={s.id} value={`${s.name} (${s.branch})`}>
                    {s.name} ({s.branch})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] px-2.5 py-1 rounded-xs">
              <span className="text-[10px] text-[#8C827A] uppercase font-bold">Operador:</span>
              <span className="font-bold text-[#18231C] text-xs">
                {activeStaffUser}
              </span>
              {assignedBranch && (
                <span className="text-[10px] bg-blue-50 text-blue-900 border border-blue-200 px-1 py-0.2 rounded-xs font-semibold">
                  {assignedBranch}
                </span>
              )}
            </div>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="relative p-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] rounded-xs text-[#18231C] transition-colors cursor-pointer"
            title="Centro de Alertas & Notificaciones"
          >
            <Bell className="w-4 h-4 text-[#18231C]" />
            {totalAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {totalAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231C] text-white rounded-xs text-xs font-bold hover:bg-black transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Pedido</span>
          </button>

          <button
            onClick={onClose}
            className="text-[#6F6860] hover:text-[#18231C] text-xs font-bold underline cursor-pointer"
          >
            Volver al menú principal
          </button>
        </div>
      </div>

      </div>
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 h-full flex flex-col">
        {/* === TAB 1: KANBAN BOARD === */}
        {activeTab === 'board' && (
          <div className="flex flex-col h-full space-y-4">
            {/* Phase 3: High-visibility Urgent Alerts Banner */}
            {(delayedOrdersCount > 0 || blockedOrdersCount > 0) && (
              <div className="bg-red-50 border-l-4 border-red-600 p-3.5 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-950 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-red-600 text-white rounded-xs animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-red-900">
                      Atención Requerida · Pedidos con Alerta ({totalAlertsCount})
                    </h5>
                    <p className="text-[11px] text-red-800">
                      Hay <strong>{delayedOrdersCount} pedidos demorados</strong> (&gt;7 días en cotización/seña) y <strong>{blockedOrdersCount} bloqueados</strong> que requieren resolución hoy.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterDelayedOnly(!filterDelayedOnly)}
                    className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-xs text-xs font-bold uppercase transition-colors cursor-pointer"
                  >
                    {filterDelayedOnly ? 'Mostrar Todos' : 'Filtrar Solo Alertas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotificationsModal(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xs text-xs font-bold uppercase transition-colors cursor-pointer shadow-2xs"
                  >
                    Ver Alertas ({totalAlertsCount})
                  </button>
                </div>
              </div>
            )}

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
                  {sellersList.map((s) => (
                    <option key={s.id} value={s.name.toLowerCase()}>
                      {s.name} ({s.branch})
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
                  <option value="maipú">Sucursal Maipú</option>
                  <option value="ciudad">Sucursal Ciudad</option>
                  <option value="luján">Sucursal Luján</option>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  title="Descargar todas las tarjetas actuales en archivo Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Excel</span>
                </button>
                <button
                  type="button"
                  disabled={isExcelProcessing}
                  onClick={() => fileInputOrdersRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Subir archivo Excel para actualizar estados y datos de las tarjetas masivamente en Firestore"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isExcelProcessing ? 'Procesando...' : 'Subir Excel'}</span>
                </button>
              </div>

              <div className="ml-auto text-[10px] font-bold text-[#8C827A] uppercase">
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
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Kanban Board Columns */}
            <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
              {companyColumns.map((col) => {
                const columnOrders = filteredOrders.filter((o) => {
                  const oCol = (o as any).columnId || o.status;
                  if (oCol === col.id) return true;
                  if (o.status === col.id) return true;
                  if (col.id === companyColumns[0]?.id && !companyColumns.some((c) => c.id === o.status || c.id === (o as any).columnId)) return true;
                  return false;
                });
                const isDragOver = dragOverColumn === col.id;
                return (
                  <div
                    key={col.id}
                    className={`w-72 sm:w-80 shrink-0 rounded-xs border flex flex-col transition-colors ${
                      isDragOver
                        ? 'border-[#B9522F] bg-[#B9522F]/5'
                        : 'border-[#DCD4C9]/60 bg-[#ECE5DC]/30'
                    }`}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    {/* Column Header */}
                    <div
                      className="p-3 border-b border-[#DCD4C9] rounded-t-xs font-bold text-xs uppercase text-[#18231C] flex justify-between items-center bg-white"
                      style={{
                        borderLeftColor: col.color,
                        borderLeftWidth: '4px',
                        borderTop: `2px solid ${col.color}40`,
                      }}
                    >
                      <span>{fixUtf8Encoding(col.label)}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black"
                        style={{ backgroundColor: col.color + '22', color: col.color }}
                      >
                        {columnOrders.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[300px]">
                      {columnOrders.map((order) => {
                        const daysOld = Math.floor(
                          (Date.now() - new Date(order.date).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const isDelayed =
                          daysOld > 7 && (order.status === 'cotizacion' || order.status === 'sena_50');

                        return (
                          <div
                            key={order.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, order.id)}
                            onClick={() => setSelectedOrderForDetail(order)}
                            className={`bg-white p-3 rounded-xs border shadow-xs cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${
                              isDelayed
                                ? 'border-red-300 border-l-4 border-l-red-500 bg-red-50/20'
                                : 'border-[#DCD4C9] hover:border-[#B9522F]'
                            }`}
                          >
                            {/* Card Top */}
                            <div className="flex justify-between items-start mb-1.5">
                              <div className="flex items-center gap-1">
                                {order.clientType === 'empresa' ? (
                                  <Building2 className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <User className="w-3 h-3 text-emerald-600" />
                                )}
                                <span className="text-[11px] text-[#18231C] font-black font-mono">
                                  {order.orderNumber || `#${order.id.slice(-6)}`}
                                </span>
                              </div>
                              {isDelayed && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-xs uppercase flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {daysOld}d demorado
                                </span>
                              )}
                            </div>

                            {/* Client Name */}
                            <h4 className="font-bold text-sm text-[#18231C] leading-tight">
                              {fixUtf8Encoding(order.clientName)}
                            </h4>
                            <p className="text-[11px] text-[#6F6860] mt-0.5">
                              {order.totalUnits} prendas
                            </p>

                            {/* Block Reason */}
                            {order.blockReason && (
                              <div className="mt-2 text-[10px] bg-red-50 text-red-700 p-1.5 rounded-xs font-medium border border-red-200">
                                ⚠ Bloqueado: {fixUtf8Encoding(order.blockReason)}
                              </div>
                            )}

                            {/* Observations */}
                            {order.observations && !order.blockReason && (
                              <div className="mt-2 text-[10px] bg-amber-50 text-amber-800 p-1.5 rounded-xs">
                                {fixUtf8Encoding(order.observations.slice(0, 80))}
                                {order.observations.length > 80 ? '...' : ''}
                              </div>
                            )}

                            {/* Card Footer */}
                            <div className="mt-2.5 flex justify-between items-center border-t border-[#ECE5DC] pt-2">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-[#8C827A]" />
                                <span className="text-[10px] font-bold text-[#8C827A]">
                                  {fixUtf8Encoding(order.seller || 'Sin asignar')}
                                </span>
                                {order.branch && (
                                  <span className="text-[9px] px-1 py-0.2 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[#6F6860]">
                                    {fixUtf8Encoding(order.branch)}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-emerald-700 text-sm">
                                $ {(order.totalEstimated || 0).toLocaleString('es-AR')}
                              </span>
                            </div>

                            {/* Card Action Shortcuts */}
                            <div className="mt-2 pt-1.5 border-t border-dashed border-[#ECE5DC] flex items-center justify-between gap-1">
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Hola ${order.clientName}, te escribimos de Pampero Gran Mendoza para actualizarte sobre tu pedido ${order.orderNumber || `#${order.id.slice(-6)}`} (Estado: ${col.label}). Total: $${(order.totalEstimated || 0).toLocaleString('es-AR')}. ¿Tenés alguna consulta?`)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xs text-[10px] font-bold flex items-center gap-1 transition-colors"
                                title="Avisar al cliente por WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>

                              {(() => {
                                const currentIndex = companyColumns.findIndex((c) => c.id === order.status);
                                const nextCol = currentIndex >= 0 && currentIndex < companyColumns.length - 1 ? companyColumns[currentIndex + 1] : null;
                                if (!nextCol) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = sanitizeObjectEncoding({ ...order, status: nextCol.id, columnId: nextCol.id, updatedAt: new Date().toISOString() });
                                      setOrders((prev) => [updated, ...prev.filter((o) => o.id !== order.id)]);
                                      saveCRMOrder(updated).catch(console.error);
                                    }}
                                    className="px-2 py-1 bg-[#18231C] hover:bg-[#B9522F] text-white rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                    title={`Avanzar a ${fixUtf8Encoding(nextCol.label)}`}
                                  >
                                    <span>{fixUtf8Encoding(nextCol.label.split('/')[0].split(' ')[0])}</span>
                                    <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}

                      {columnOrders.length === 0 && (
                        <div
                          className={`p-6 text-center text-[11px] text-[#8C827A] border-2 border-dashed rounded-xs ${
                            isDragOver ? 'border-[#B9522F] bg-[#B9522F]/5' : 'border-[#DCD4C9]'
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
        )}

        {/* === TAB 1: VISITAS COMERCIALES (KANBAN) === */}
        {activeTab === 'visits' && (
          <CRMVisitsTab
            visits={visits}
            accentColor={accent}
            onPromoteToCompanies={handlePromoteVisitToCompanyOrder}
          />
        )}

        {/* === TAB 3: PEDIDOS A PROVEEDOR === */}
        {activeTab === 'suppliers' && (
          <CRMSupplierOrdersTab orders={supplierOrders} accentColor={accent} />
        )}

        {/* === TAB 4: CONTROL DE COSTOS === */}
        {activeTab === 'costs' && (
          <CRMCostsTab 
            accentColor={accent} 
            userRole={userSession?.role || 'admin'} 
            defaultBranch={assignedBranch}
          />
        )}
      </div>

      {/* Notifications Drawer Modal */}
      <CRMNotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        orders={orders}
        visits={visits}
        onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
      />

      {/* Detail & Edit Order Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          onSave={async (updated) => {
            const cleanUpdated = sanitizeObjectEncoding(updated);
            setOrders((prev) => [cleanUpdated, ...prev.filter((o) => o.id !== cleanUpdated.id)]);
            try {
              await saveCRMOrder(cleanUpdated);
            } catch (err) {
              console.error('Error al guardar orden:', err);
            }
            setSelectedOrderForDetail(null);
          }}
          onDelete={async (id) => {
            setOrders((prev) => prev.filter((o) => o.id !== id));
            try {
              await deleteCRMOrder(id);
            } catch (err) {
              console.error('Error al eliminar orden:', err);
            }
            setSelectedOrderForDetail(null);
          }}
        />
      )}
      </div>
      {/* Modal: New Manual Order */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSave={handleCreateManualOrder}
          accent={accent}
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
}> = ({ order, onClose, onSave, onDelete }) => {
  const [status, setStatus] = useState<CRMOrderStatus>(order.status);
  const [seller, setSeller] = useState(order.seller || 'Sin asignar');
  const [branch, setBranch] = useState(order.branch || 'Ciudad');
  const [totalEstimated, setTotalEstimated] = useState(String(order.totalEstimated || ''));
  const [blockReason, setBlockReason] = useState(order.blockReason || '');
  const [observations, setObservations] = useState(order.observations || '');

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...order,
      status,
      seller,
      branch,
      totalEstimated: Number(totalEstimated) || order.totalEstimated,
      blockReason: blockReason.trim() || undefined,
      observations: observations.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleContactWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola ${order.clientName}, nos comunicamos de Pampero Mendoza respecto a la cotización / pedido #${order.id.slice(-6)}. ¿Cómo podemos ayudarte?`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider">
              Pedido #{order.id.slice(-6)} · {order.clientName}
            </h3>
            <p className="text-[11px] text-[#DCD4C9]/70">
              Fecha: {new Date(order.date).toLocaleDateString('es-AR')}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Fase / Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold"
              >
                <option value="cotizacion">Cotización Recibida</option>
                <option value="sena_50">Aprobado / Seña 50%</option>
                <option value="produccion">En Bordados / Taller</option>
                <option value="listo">Listo para Retirar</option>
                <option value="entregado">Entregado / Cerrado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Monto $ Total
              </label>
              <input
                type="number"
                value={totalEstimated}
                onChange={(e) => setTotalEstimated(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Vendedora
              </label>
              <select
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white"
              >
                <option value="Itatí">Itatí</option>
                <option value="Guada">Guada</option>
                <option value="Carolina">Carolina</option>
                <option value="Gustavo">Gustavo</option>
                <option value="Sin asignar">Sin asignar</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                Sucursal
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white"
              >
                <option value="Ciudad">Ciudad</option>
                <option value="Maipú">Maipú</option>
                <option value="Luján">Luján</option>
              </select>
            </div>
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

          <div>
            <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
              Notas y Observaciones
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Observaciones de entrega, bordados especiales..."
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
            />
          </div>

          {/* Items breakdown if present */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="pt-2 border-t border-[#ECE5DC]">
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1.5">
                Artículos Cotizados ({order.items.length})
              </label>
              <div className="bg-[#FAF8F5] p-2.5 rounded-xs border border-[#ECE5DC] space-y-1 text-xs">
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
}> = ({ onClose, onSave }) => {
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'empresa' | 'consumidor_final'>('empresa');
  const [seller, setSeller] = useState('Itatí');
  const [branch, setBranch] = useState('Ciudad');
  const [totalUnits, setTotalUnits] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('');
  const [observations, setObservations] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    onSave({ clientName, clientType, seller, branch, totalUnits, totalEstimated, observations });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold text-sm uppercase tracking-wider">Nuevo Pedido Manual</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                Vendedora
              </label>
              <select
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
              >
                <option value="Itatí">Itatí</option>
                <option value="Guada">Guada</option>
                <option value="Carolina">Carolina</option>
                <option value="Gustavo">Gustavo</option>
              </select>
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
                <option value="Ciudad">Ciudad</option>
                <option value="Maipú">Maipú</option>
                <option value="Luján">Luján</option>
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

          <div>
            <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
              Observaciones
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Notas del pedido o detalles de bordado..."
              className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
            />
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


