import React, { useState, useEffect, useMemo } from 'react';
import {
  SupplierOrder,
  SupplierOrderStatus,
  CRMOrder,
  CRMOrderShortageItem,
  ShortageStatus,
  ThemeConfig,
} from '../../types';
import {
  saveSupplierOrder,
  deleteSupplierOrder,
  subscribeToCRMOrderShortages,
  saveCRMOrderShortage,
  saveCRMOrder,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { useConfiguredBranches } from '../../utils/useConfiguredBranches';
import {
  Plus,
  Search,
  Filter,
  Truck,
  Trash2,
  Edit3,
  X,
  Save,
  Download,
  Upload,
  PackageX,
  CheckCircle2,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import { exportSupplierOrdersToExcel, importSupplierOrdersFromExcel } from '../../utils/kanbanExcelUtils';

interface CRMSupplierOrdersTabProps {
  orders: SupplierOrder[];
  crmOrders?: CRMOrder[];
  accentColor: string;
  onUpdateCrmOrder?: (order: CRMOrder) => void;
  theme?: ThemeConfig;
}

const SUPPLIER_STATUS_LABELS: Record<SupplierOrderStatus, { label: string; bg: string; text: string }> = {
  borrador: { label: 'Borrador', bg: 'bg-neutral-100', text: 'text-neutral-700' },
  enviado: { label: 'Pedido Enviado', bg: 'bg-blue-100', text: 'text-blue-800' },
  en_fabricacion: { label: 'En Fabricación', bg: 'bg-purple-100', text: 'text-purple-800' },
  despachado: { label: 'En Tránsito / Despachado', bg: 'bg-amber-100', text: 'text-amber-800' },
  recibido_completo: { label: 'Recibido Completo', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  recibido_incompleto: { label: 'Recibido Incompleto', bg: 'bg-rose-100', text: 'text-rose-800' },
};

const SHORTAGE_STATUS_META: Record<ShortageStatus, { label: string; badgeClass: string }> = {
  pendiente: { label: 'Pendiente', badgeClass: 'bg-amber-50 border-amber-300 text-amber-900' },
  pedido: { label: 'Pedido', badgeClass: 'bg-blue-50 border-blue-300 text-blue-900' },
  recibido: { label: 'Recibido', badgeClass: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
};

export const CRMSupplierOrdersTab: React.FC<CRMSupplierOrdersTabProps> = ({
  orders,
  crmOrders = [],
  onUpdateCrmOrder,
  theme,
}) => {
  const st = theme?.siteTexts;
  const { branchNames: configuredBranchNames, resolveBranch: resolveConfiguredBranch } = useConfiguredBranches();
  const [subTab, setSubTab] = useState<'shortages' | 'orders'>('shortages');
  const [supplierFilter, setSupplierFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [shortageStatusFilter, setShortageStatusFilter] = useState<'all' | ShortageStatus>('pendiente');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  const [linkedShortageIds, setLinkedShortageIds] = useState<string[]>([]);
  const [receivedShortageIds, setReceivedShortageIds] = useState<string[]>([]);

  // Standalone shortages collection subscription
  const [collectionShortages, setCollectionShortages] = useState<CRMOrderShortageItem[]>([]);

  useEffect(() => {
    const unsub = subscribeToCRMOrderShortages((list) => {
      setCollectionShortages(list);
    });
    return () => unsub();
  }, []);

  // Merge shortages from crmOrders + crm_order_shortages collection cleanly
  const allShortages = useMemo(() => {
    const map = new Map<string, CRMOrderShortageItem>();
    collectionShortages.forEach((s) => {
      if (s && s.id) map.set(s.id, s);
    });
    crmOrders.forEach((ord) => {
      if (Array.isArray(ord.shortages)) {
        ord.shortages.forEach((s) => {
          if (s && s.id) {
            const existing = map.get(s.id);
            map.set(s.id, {
              ...existing,
              ...s,
              orderId: s.orderId || ord.id,
              orderNumber: s.orderNumber || ord.orderNumber || ord.trackingCode,
              trackingCode: s.trackingCode || ord.trackingCode || ord.orderNumber,
              clientName: s.clientName || ord.clientName,
              branch: s.branch || ord.branch,
            });
          }
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [collectionShortages, crmOrders]);

  const pendingShortagesCount = useMemo(
    () => allShortages.filter((s) => s.status === 'pendiente').length,
    [allShortages]
  );

  // Switch default subTab smoothly if user opens when there are 0 shortages and orders exist
  useEffect(() => {
    if (allShortages.length === 0 && orders.length > 0 && subTab === 'shortages') {
      // keep shortages accessible; don't force switch if user clicked
    }
  }, [allShortages.length, orders.length, subTab]);

  // Form states for Supplier Order modal
  const [orderNumber, setOrderNumber] = useState('');
  const [supplierName, setSupplierName] = useState('Macata');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState('');
  const [actualArrivalDate, setActualArrivalDate] = useState('');
  const [status, setStatus] = useState<SupplierOrderStatus>('enviado');
  const [itemsCount, setItemsCount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [itemsDescription, setItemsDescription] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [branchDestination, setBranchDestination] = useState(() => configuredBranchNames[0] || 'Pampero Ciudad de Mendoza');
  const [responsibleStaff, setResponsibleStaff] = useState('Itatí');
  const [notes, setNotes] = useState('');
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputSupplierRef = React.useRef<HTMLInputElement>(null);

  const knownSuppliers = useMemo(() => {
    const set = new Set<string>(['Macata', 'Pampero Central', 'Calzado Confort', 'Otro']);
    orders.forEach((o) => {
      if (o.supplierName) set.add(o.supplierName);
    });
    allShortages.forEach((s) => {
      if (s.supplier) set.add(s.supplier);
    });
    return Array.from(set);
  }, [orders, allShortages]);

  const handleExportOrders = () => {
    exportSupplierOrdersToExcel(filteredOrders.length > 0 ? filteredOrders : orders);
  };

  const handleImportOrders = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExcelProcessing(true);
    try {
      const res = await importSupplierOrdersFromExcel(file, orders);
      setExcelNotice(
        `¡Pedidos a proveedor sincronizados! ${res.updatedCount} actualizados, ${res.newCount} nuevos en Firestore.`
      );
      setTimeout(() => setExcelNotice(null), 6000);
    } catch (err: any) {
      alert(`Error al importar Excel de proveedores: ${err?.message || err}`);
    } finally {
      setIsExcelProcessing(false);
      if (fileInputSupplierRef.current) fileInputSupplierRef.current.value = '';
    }
  };

  const openNewModal = (prefill?: {
    supplierName?: string;
    itemsCount?: number;
    itemsDescription?: string;
    branchDestination?: string;
    shortageIds?: string[];
  }) => {
    setEditingOrder(null);
    setOrderNumber(`OC-${Date.now().toString().slice(-5)}`);
    setSupplierName(prefill?.supplierName || 'Macata');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setEstimatedArrivalDate('');
    setActualArrivalDate('');
    setStatus('enviado');
    setItemsCount(prefill?.itemsCount ? String(prefill.itemsCount) : '');
    setTotalAmount('');
    setItemsDescription(prefill?.itemsDescription || '');
    setTrackingNumber('');
    setBranchDestination(resolveConfiguredBranch(prefill?.branchDestination, false));
    setResponsibleStaff('Itatí');
    setNotes(
      prefill?.shortageIds?.length
        ? `Generado automáticamente desde ${prefill.shortageIds.length} faltantes de pedidos.`
        : ''
    );
    setLinkedShortageIds(prefill?.shortageIds || []);
    setShowModal(true);
  };

  const openEditModal = (o: SupplierOrder) => {
    setEditingOrder(o);
    const matchedShortages = allShortages.filter((s) => s.supplierOrderId === o.id);
    setLinkedShortageIds(matchedShortages.map((s) => s.id));
    setReceivedShortageIds(matchedShortages.filter((s) => s.status === 'recibido').map((s) => s.id));
    setOrderNumber(o.orderNumber);
    setSupplierName(o.supplierName);
    setOrderDate(o.orderDate);
    setEstimatedArrivalDate(o.estimatedArrivalDate || '');
    setActualArrivalDate(o.actualArrivalDate || '');
    setStatus(o.status);
    setItemsCount(String(o.itemsCount || ''));
    setTotalAmount(String(o.totalAmount || ''));
    setItemsDescription(o.itemsDescription || '');
    setTrackingNumber(o.trackingNumber || '');
    setBranchDestination(resolveConfiguredBranch(o.branchDestination, false));
    setResponsibleStaff(o.responsibleStaff);
    setNotes(o.notes || '');
    setShowModal(true);
  };

  const handleUpdateShortageStatus = async (item: CRMOrderShortageItem, nextStatus: ShortageStatus) => {
    const updatedItem: CRMOrderShortageItem = { ...item, status: nextStatus };
    setCollectionShortages((prev) =>
      prev.some((s) => s.id === item.id)
        ? prev.map((s) => (s.id === item.id ? updatedItem : s))
        : [updatedItem, ...prev]
    );
    await saveCRMOrderShortage(updatedItem);

    // Sync back to parent CRMOrder if loaded
    const parentOrder = crmOrders.find((o) => o.id === item.orderId);
    if (parentOrder && Array.isArray(parentOrder.shortages)) {
      const nextOrd: CRMOrder = sanitizeObjectEncoding({
        ...parentOrder,
        shortages: parentOrder.shortages.map((s) => (s.id === item.id ? updatedItem : s)),
        updatedAt: new Date().toISOString(),
      });
      if (onUpdateCrmOrder) onUpdateCrmOrder(nextOrd);
      saveCRMOrder(nextOrd).catch(() => {});
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    const isReceivedStatus = status === 'recibido_completo' || status === 'recibido_incompleto';
    const resolvedActualArrival =
      actualArrivalDate || (isReceivedStatus ? new Date().toISOString().split('T')[0] : undefined);

    const data: SupplierOrder = {
      id: editingOrder ? editingOrder.id : `SUP-${Date.now().toString().slice(-6)}`,
      orderNumber: orderNumber.trim(),
      supplierName: supplierName.trim() || 'Macata',
      orderDate,
      estimatedArrivalDate: estimatedArrivalDate || orderDate,
      actualArrivalDate: resolvedActualArrival,
      status,
      itemsCount: Number(itemsCount) || 0,
      totalAmount: Number(totalAmount) || 0,
      itemsDescription: itemsDescription.trim(),
      trackingNumber: trackingNumber.trim() || undefined,
      branchDestination,
      responsibleStaff,
      notes: notes.trim(),
      createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSupplierOrder(data);

    // Sync shortages both on creation and when updating status (e.g. recibido_completo / recibido_incompleto)
    const idSet = new Set<string>(linkedShortageIds);
    allShortages.forEach((s) => {
      if (s.supplierOrderId === data.id) idSet.add(s.id);
    });

    if (idSet.size > 0) {
      const receivedSet = new Set<string>(receivedShortageIds);
      const affectedItems = allShortages.filter((s) => idSet.has(s.id));

      const nextStatusForShortage = (s: CRMOrderShortageItem): ShortageStatus => {
        if (status === 'recibido_completo') return 'recibido';
        if (status === 'recibido_incompleto') {
          return receivedSet.has(s.id) ? 'recibido' : 'pedido';
        }
        return 'pedido';
      };

      const updatedMap = new Map<string, CRMOrderShortageItem>();
      for (const item of affectedItems) {
        const updatedItem: CRMOrderShortageItem = {
          ...item,
          status: nextStatusForShortage(item),
          supplierOrderId: data.id,
        };
        updatedMap.set(item.id, updatedItem);
        await saveCRMOrderShortage(updatedItem);
      }

      setCollectionShortages((prev) =>
        prev.map((s) => updatedMap.get(s.id) || s)
      );

      const ordersToUpdate = crmOrders.filter(
        (ord) =>
          Array.isArray(ord.shortages) &&
          ord.shortages.some((s) => idSet.has(s.id) || s.supplierOrderId === data.id)
      );
      for (const ord of ordersToUpdate) {
        const nextOrd: CRMOrder = sanitizeObjectEncoding({
          ...ord,
          shortages: (ord.shortages || []).map((s) => {
            if (!idSet.has(s.id) && s.supplierOrderId !== data.id) return s;
            return {
              ...s,
              status: nextStatusForShortage(s),
              supplierOrderId: data.id,
            };
          }),
          updatedAt: new Date().toISOString(),
        });
        if (onUpdateCrmOrder) onUpdateCrmOrder(nextOrd);
        await saveCRMOrder(nextOrd);
      }

      if (status === 'recibido_completo' || status === 'recibido_incompleto') {
        const recCount = Array.from(updatedMap.values()).filter((x) => x.status === 'recibido').length;
        setExcelNotice(
          `Orden ${data.orderNumber} actualizada (${SUPPLIER_STATUS_LABELS[status].label}). ${recCount} de ${affectedItems.length} faltantes marcados como "Recibido" en las fichas de empresas.`
        );
      } else {
        setExcelNotice(
          `Orden ${data.orderNumber} guardada y ${affectedItems.length} faltantes vinculados como "Pedido".`
        );
      }
      setTimeout(() => setExcelNotice(null), 6000);
    }

    setLinkedShortageIds([]);
    setReceivedShortageIds([]);
    setShowModal(false);
    setSubTab('orders');
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar registro de pedido a proveedor?')) {
      deleteSupplierOrder(id);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchSupplier =
      supplierFilter === 'todos' ||
      String(o.supplierName ?? '').toLowerCase() === supplierFilter.toLowerCase();
    const matchStatus = statusFilter === 'todos' || o.status === statusFilter;
    const matchSearch =
      !q ||
      String(o.orderNumber ?? '').toLowerCase().includes(q) ||
      String(o.supplierName ?? '').toLowerCase().includes(q) ||
      String(o.itemsDescription ?? '').toLowerCase().includes(q);
    return matchSupplier && matchStatus && matchSearch;
  });

  // Filtered & Grouped Shortages by Proveedor
  const groupedShortagesBySupplier = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = allShortages.filter((s) => {
      const matchSup =
        supplierFilter === 'todos' ||
        (s.supplier || '').toLowerCase() === supplierFilter.toLowerCase();
      const matchStatus =
        shortageStatusFilter === 'all' || s.status === shortageStatusFilter;
      const matchSearch =
        !q ||
        (s.productCode || '').toLowerCase().includes(q) ||
        (s.productName || '').toLowerCase().includes(q) ||
        (s.clientName || '').toLowerCase().includes(q) ||
        (s.trackingCode || '').toLowerCase().includes(q) ||
        (s.supplier || '').toLowerCase().includes(q) ||
        (s.color || '').toLowerCase().includes(q);
      return matchSup && matchStatus && matchSearch;
    });

    const groups = new Map<string, CRMOrderShortageItem[]>();
    filtered.forEach((item) => {
      const supKey = fixUtf8Encoding((item.supplier || 'Sin Proveedor').trim()) || 'Sin Proveedor';
      const arr = groups.get(supKey) || [];
      arr.push(item);
      groups.set(supKey, arr);
    });

    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [allShortages, supplierFilter, shortageStatusFilter, searchQuery]);

  const handleGenerateOrderFromGroup = (supplier: string, items: CRMOrderShortageItem[]) => {
    const targetItems = items.filter((i) => i.status === 'pendiente');
    const source = targetItems.length > 0 ? targetItems : items;
    const totalUnits = source.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const descriptionLines = source
      .map(
        (it) =>
          `${it.quantity}x [${it.productCode || '-'}] ${it.productName} (Talle ${it.size}, ${it.color}) — Ped: ${
            it.trackingCode || it.clientName
          }`
      )
      .join(' | ');
    const firstBranch = source.find((i) => i.branch)?.branch || 'Ciudad';

    openNewModal({
      supplierName: supplier,
      itemsCount: totalUnits,
      itemsDescription: descriptionLines,
      branchDestination: firstBranch,
      shortageIds: source.map((i) => i.id),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#18231C]" />
            {st?.crmSuppliersTitle || 'Pedidos a Proveedor & Faltantes de Stock'}
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            {st?.crmSuppliersSubtitle ||
              'Faltantes cargados en las fichas de pedidos agrupados automáticamente por proveedor + control de órdenes de compra.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <input
            type="file"
            ref={fileInputSupplierRef}
            onChange={handleImportOrders}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportOrders}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Descargar pedidos a proveedores en Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel</span>
          </button>
          <button
            type="button"
            disabled={isExcelProcessing}
            onClick={() => fileInputSupplierRef.current?.click()}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Subir archivo Excel para actualizar compras a proveedores"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isExcelProcessing ? 'Procesando...' : 'Subir Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => openNewModal()}
            className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Orden a Proveedor
          </button>
        </div>
      </div>

      {/* Sub-navigation between Faltantes Agrupados and Órdenes de Compra */}
      <div className="flex items-center gap-2 border-b border-[#DCD4C9]">
        <button
          type="button"
          onClick={() => setSubTab('shortages')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            subTab === 'shortages'
              ? 'border-[#18231C] text-[#18231C] bg-white'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <PackageX className="w-4 h-4" />
          <span>Faltantes Agrupados por Proveedor</span>
          <span
            className={`px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold tabular-nums ${
              pendingShortagesCount > 0
                ? 'bg-[#18231C] text-[#FDB813]'
                : 'bg-[#ECE5DC] text-[#6F6860]'
            }`}
          >
            {pendingShortagesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('orders')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            subTab === 'orders'
              ? 'border-[#18231C] text-[#18231C] bg-white'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Órdenes de Compra Emitidas</span>
          <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold tabular-nums bg-[#ECE5DC] text-[#18231C]">
            {orders.length}
          </span>
        </button>
      </div>

      {/* Notification Banner */}
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

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[#8C827A]" />

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
        >
          <option value="todos">Proveedor: Todos</option>
          {knownSuppliers.map((sup) => (
            <option key={sup} value={sup}>
              {sup}
            </option>
          ))}
        </select>

        {subTab === 'shortages' ? (
          <select
            value={shortageStatusFilter}
            onChange={(e) => setShortageStatusFilter(e.target.value as any)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
          >
            <option value="pendiente">Estado: Pendientes de Pedir</option>
            <option value="pedido">Estado: Ya Pedidos</option>
            <option value="recibido">Estado: Recibidos</option>
            <option value="all">Estado: Todos</option>
          </select>
        ) : (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
          >
            <option value="todos">Estado: Todos</option>
            <option value="enviado">Enviado</option>
            <option value="en_fabricacion">En Fabricación</option>
            <option value="despachado">Despachado</option>
            <option value="recibido_completo">Recibido Completo</option>
            <option value="recibido_incompleto">Recibido Incompleto</option>
          </select>
        )}

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              subTab === 'shortages'
                ? 'Buscar código, artículo, cliente, proveedor...'
                : 'Buscar por orden, descripción...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
          />
        </div>

        <div className="ml-auto text-[11px] font-bold text-[#8C827A] uppercase tabular-nums">
          {subTab === 'shortages'
            ? `${groupedShortagesBySupplier.reduce((acc, [, arr]) => acc + arr.length, 0)} faltantes`
            : `${filteredOrders.length} órdenes`}
        </div>
      </div>

      {/* VIEW 1: FALTANTES AGRUPADOS POR PROVEEDOR */}
      {subTab === 'shortages' && (
        <div className="space-y-4">
          {groupedShortagesBySupplier.length === 0 ? (
            <div className="bg-white rounded-xs border border-[#DCD4C9] p-10 text-center space-y-2">
              <PackageX className="w-8 h-8 text-[#8C827A] mx-auto" />
              <p className="text-sm font-bold text-[#18231C]">
                No hay faltantes para mostrar con el filtro seleccionado
              </p>
              <p className="text-xs text-[#6F6860] max-w-md mx-auto">
                Cuando cargues artículos faltantes desde la ficha de cualquier pedido en "Seguimiento Empresas", aparecerán acá agrupados por proveedor.
              </p>
            </div>
          ) : (
            groupedShortagesBySupplier.map(([supplier, items]) => {
              const totalUnits = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
              const pendingInGroup = items.filter((it) => it.status === 'pendiente').length;
              return (
                <div
                  key={supplier}
                  className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden"
                >
                  {/* Group Header */}
                  <div className="bg-[#FAF8F5] px-4 py-3 border-b border-[#DCD4C9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 bg-[#18231C] text-[#FDB813] font-bold text-xs uppercase tracking-wider rounded-xs">
                        {supplier}
                      </span>
                      <span className="text-xs font-bold text-[#18231C] tabular-nums">
                        {items.length} ítem{items.length === 1 ? '' : 's'} · {totalUnits} unidad{totalUnits === 1 ? '' : 'es'}
                      </span>
                      {pendingInGroup > 0 && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs bg-amber-50 border border-amber-300 text-amber-900 tabular-nums">
                          {pendingInGroup} pendiente{pendingInGroup === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateOrderFromGroup(supplier, items)}
                      className="px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-[#FDB813]" />
                      <span>Armar Orden de Compra ({supplier})</span>
                    </button>
                  </div>

                  {/* Table of Shortages for this Supplier */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white border-b border-[#ECE5DC] text-[#6F6860] uppercase font-bold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Código</th>
                          <th className="py-2.5 px-3">Artículo</th>
                          <th className="py-2.5 px-3">Talle</th>
                          <th className="py-2.5 px-3">Color</th>
                          <th className="py-2.5 px-3 text-center">Cant.</th>
                          <th className="py-2.5 px-3">Pedido / Cliente</th>
                          <th className="py-2.5 px-3">Sucursal</th>
                          <th className="py-2.5 px-3 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE5DC]">
                        {items.map((item) => {
                          const meta = SHORTAGE_STATUS_META[item.status] || SHORTAGE_STATUS_META.pendiente;
                          return (
                            <tr key={item.id} className="hover:bg-[#FAF8F5]/60">
                              <td className="py-2.5 px-3 font-mono font-bold text-[#18231C] whitespace-nowrap">
                                {item.productCode || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[#18231C]">
                                {fixUtf8Encoding(item.productName)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[#18231C] whitespace-nowrap">
                                {fixUtf8Encoding(item.size)}
                              </td>
                              <td className="py-2.5 px-3 text-[#4A453F] whitespace-nowrap">
                                {fixUtf8Encoding(item.color)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black tabular-nums text-[#18231C]">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-[#18231C]">
                                  {fixUtf8Encoding(item.clientName)}
                                </div>
                                {(item.trackingCode || item.orderNumber) && (
                                  <span className="text-[10px] font-mono text-[#6F6860]">
                                    {item.trackingCode || item.orderNumber}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[#4A453F] whitespace-nowrap">
                                {fixUtf8Encoding(item.branch || 'Maipú')}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleUpdateShortageStatus(item, e.target.value as ShortageStatus)
                                  }
                                  className={`px-2 py-1 rounded-xs border text-[10px] font-bold uppercase cursor-pointer outline-none ${meta.badgeClass}`}
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="pedido">Pedido</option>
                                  <option value="recibido">Recibido</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: SUPPLIER ORDERS TABLE */}
      {subTab === 'orders' && (
        <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
                <tr>
                  <th className="p-3">Orden / Proveedor</th>
                  <th className="p-3">Detalle de Mercadería</th>
                  <th className="p-3">Fecha Pedido / Entrega Est.</th>
                  <th className="p-3">Destino / Resp.</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4C9]">
                {filteredOrders.map((o) => {
                  const badge = SUPPLIER_STATUS_LABELS[o.status] || SUPPLIER_STATUS_LABELS.enviado;
                  return (
                    <tr key={o.id} className="hover:bg-[#FAF8F5]">
                      <td className="p-3">
                        <div className="font-bold text-[#18231C] font-mono">{o.orderNumber}</div>
                        <span className="text-[10px] font-bold text-[#18231C] uppercase bg-[#FAF8F5] px-1.5 py-0.5 rounded-xs border border-[#DCD4C9]">
                          {o.supplierName}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-[#18231C] max-w-xs truncate" title={o.itemsDescription}>
                          {o.itemsDescription || 'Artículos de reposición'}
                        </div>
                        <div className="text-[10px] text-[#6F6860] mt-0.5 tabular-nums">
                          {o.itemsCount} unidades
                          {o.trackingNumber && ` · Guía: ${o.trackingNumber}`}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-[#18231C] font-mono">{o.orderDate}</div>
                        <div className="text-[10px] text-blue-900 font-medium font-mono">
                          Llegada: {o.estimatedArrivalDate || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-[#18231C]">{o.branchDestination}</div>
                        <div className="text-[10px] text-[#6F6860]">Resp: {o.responsibleStaff}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono tabular-nums text-[#18231C]">
                        ${(o.totalAmount || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(o)}
                            className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-neutral-100 rounded-xs cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(o.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-[#6F6860]">
                      No hay órdenes de compra registradas. Hacé clic en "Nueva Orden a Proveedor" o armá una desde la pestaña de Faltantes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New / Edit Supplier Order */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {editingOrder ? 'Editar Orden a Proveedor' : 'Nueva Orden a Proveedor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                    Nº Orden / Referencia *
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Proveedor *</label>
                  <input
                    type="text"
                    list="supplier-modal-names"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium"
                  />
                  <datalist id="supplier-modal-names">
                    {knownSuppliers.map((sup) => (
                      <option key={sup} value={sup} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">
                  Descripción de Mercadería Solicitada
                </label>
                <textarea
                  value={itemsDescription}
                  onChange={(e) => setItemsDescription(e.target.value)}
                  rows={3}
                  placeholder="Ej: 100 Bombachas Olivera (curva 38 al 54), 50 pares Botín Tronador..."
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Prendas Total</label>
                  <input
                    type="number"
                    value={itemsCount}
                    onChange={(e) => setItemsCount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Monto $ Costo</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="enviado">Enviado</option>
                    <option value="en_fabricacion">En Fabricación</option>
                    <option value="despachado">Despachado</option>
                    <option value="recibido_completo">Recibido Completo</option>
                    <option value="recibido_incompleto">Recibido Incompleto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Fecha de Pedido</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Llegada Estimada</label>
                  <input
                    type="date"
                    value={estimatedArrivalDate}
                    onChange={(e) => setEstimatedArrivalDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Sucursal Destino</label>
                  <select
                    value={branchDestination}
                    onChange={(e) => setBranchDestination(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
                  >
                    {configuredBranchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Responsable</label>
                  <select
                    value={responsibleStaff}
                    onChange={(e) => setResponsibleStaff(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white"
                  >
                    <option value="Itatí">Itatí</option>
                    <option value="Guada">Guada</option>
                    <option value="Carolina">Carolina</option>
                    <option value="Gustavo">Gustavo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Nº Guía / Seguimiento</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Ej: OCA-9821..."
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
              </div>

              {linkedShortageIds.length > 0 && (
                <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-[#18231C]">
                      Faltantes de Empresas Vinculados ({linkedShortageIds.length})
                    </span>
                    {status === 'recibido_completo' && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        Se marcarán todos como Recibido al guardar
                      </span>
                    )}
                    {status === 'recibido_incompleto' && (
                      <span className="text-[10px] font-bold text-amber-800">
                        Marcá cuáles llegaron
                      </span>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {allShortages
                      .filter((s) => linkedShortageIds.includes(s.id))
                      .map((s) => {
                        const checked = status === 'recibido_completo' || receivedShortageIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center justify-between gap-2 text-[11px] bg-white px-2 py-1 border border-[#ECE5DC] rounded-xs cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {status === 'recibido_incompleto' && (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setReceivedShortageIds((prev) =>
                                      e.target.checked
                                        ? [...prev, s.id]
                                        : prev.filter((id) => id !== s.id)
                                    )
                                  }
                                  className="accent-emerald-600 cursor-pointer"
                                />
                              )}
                              <span className="truncate font-semibold text-[#18231C]">
                                {fixUtf8Encoding(s.productName)} ({s.size}) · {fixUtf8Encoding(s.clientName)}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-[#6F6860] shrink-0">
                              {s.quantity} u.
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Notas Internas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre pago, transporte expreso..."
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
