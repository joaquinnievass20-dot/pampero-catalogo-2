import React, { useState } from 'react';
import { SupplierOrder, SupplierOrderStatus } from '../../types';
import { saveSupplierOrder, deleteSupplierOrder } from '../../services/firebase';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Truck, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  X, 
  Save 
} from 'lucide-react';

interface CRMSupplierOrdersTabProps {
  orders: SupplierOrder[];
  accentColor: string;
}

const SUPPLIER_STATUS_LABELS: Record<SupplierOrderStatus, { label: string; bg: string; text: string }> = {
  borrador: { label: 'Borrador', bg: 'bg-neutral-100', text: 'text-neutral-700' },
  enviado: { label: 'Pedido Enviado', bg: 'bg-blue-100', text: 'text-blue-800' },
  en_fabricacion: { label: 'En Fabricación', bg: 'bg-purple-100', text: 'text-purple-800' },
  despachado: { label: 'En Tránsito / Despachado', bg: 'bg-amber-100', text: 'text-amber-800' },
  recibido_completo: { label: 'Recibido Completo', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  recibido_incompleto: { label: 'Recibido Incompleto', bg: 'bg-rose-100', text: 'text-rose-800' },
};

export const CRMSupplierOrdersTab: React.FC<CRMSupplierOrdersTabProps> = ({ orders, accentColor }) => {
  const [supplierFilter, setSupplierFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);

  // Form states
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
  const [branchDestination, setBranchDestination] = useState('Ciudad');
  const [responsibleStaff, setResponsibleStaff] = useState('Itatí');
  const [notes, setNotes] = useState('');

  const openNewModal = () => {
    setEditingOrder(null);
    setOrderNumber(`OC-${Date.now().toString().slice(-5)}`);
    setSupplierName('Macata');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setEstimatedArrivalDate('');
    setActualArrivalDate('');
    setStatus('enviado');
    setItemsCount('');
    setTotalAmount('');
    setItemsDescription('');
    setTrackingNumber('');
    setBranchDestination('Ciudad');
    setResponsibleStaff('Itatí');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (o: SupplierOrder) => {
    setEditingOrder(o);
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
    setBranchDestination(o.branchDestination);
    setResponsibleStaff(o.responsibleStaff);
    setNotes(o.notes || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    const data: SupplierOrder = {
      id: editingOrder ? editingOrder.id : `SUP-${Date.now().toString().slice(-6)}`,
      orderNumber: orderNumber.trim(),
      supplierName,
      orderDate,
      estimatedArrivalDate: estimatedArrivalDate || orderDate,
      actualArrivalDate: actualArrivalDate || undefined,
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

    saveSupplierOrder(data);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar registro de pedido a proveedor?')) {
      deleteSupplierOrder(id);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchSupplier = supplierFilter === 'todos' || o.supplierName.toLowerCase() === supplierFilter.toLowerCase();
    const matchStatus = statusFilter === 'todos' || o.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.itemsDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSupplier && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#B9522F]" />
            Pedidos a Proveedor (Macata & Fábrica)
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Control de órdenes de compra, tiempos de entrega de partidas y recepción de mercadería.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Orden a Proveedor
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[#8C827A]" />

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
        >
          <option value="todos">Proveedor: Todos</option>
          <option value="macata">Macata</option>
          <option value="pampero central">Pampero Central</option>
          <option value="calzado confort">Calzado Confort</option>
          <option value="otro">Otro</option>
        </select>

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

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por orden, descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
          />
        </div>

        <div className="ml-auto text-[11px] font-bold text-[#8C827A] uppercase">
          {filteredOrders.length} órdenes
        </div>
      </div>

      {/* Orders Table */}
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
                      <span className="text-[10px] font-bold text-[#B9522F] uppercase bg-amber-50 px-1.5 py-0.5 rounded-xs border border-amber-200">
                        {o.supplierName}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[#18231C] max-w-xs truncate">
                        {o.itemsDescription || 'Artículos de reposición'}
                      </div>
                      <div className="text-[10px] text-[#6F6860] mt-0.5">
                        {o.itemsCount} unidades
                        {o.trackingNumber && ` · Guía: ${o.trackingNumber}`}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-[#18231C]">{o.orderDate}</div>
                      <div className="text-[10px] text-blue-900 font-medium">
                        Llegada: {o.estimatedArrivalDate || '-'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[#18231C]">{o.branchDestination}</div>
                      <div className="text-[10px] text-[#6F6860]">Resp: {o.responsibleStaff}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-[#18231C]">
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
                    No hay órdenes de compra registradas. Hacé clic en "Nueva Orden a Proveedor" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Nº Orden / Referencia *</label>
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
                  <select value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium">
                    <option value="Macata">Macata</option>
                    <option value="Pampero Central">Pampero Central</option>
                    <option value="Calzado Confort">Calzado Confort</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Descripción de Mercadería Solicitada</label>
                <textarea
                  value={itemsDescription}
                  onChange={(e) => setItemsDescription(e.target.value)}
                  rows={2}
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
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Monto $ Costo</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium">
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
                    className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Llegada Estimada</label>
                  <input
                    type="date"
                    value={estimatedArrivalDate}
                    onChange={(e) => setEstimatedArrivalDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Sucursal Destino</label>
                  <select value={branchDestination} onChange={(e) => setBranchDestination(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white">
                    <option value="Ciudad">Ciudad</option>
                    <option value="Maipú">Maipú</option>
                    <option value="Luján">Luján</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Responsable</label>
                  <select value={responsibleStaff} onChange={(e) => setResponsibleStaff(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white">
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
