import React, { useState, useEffect } from 'react';
import { UserSession, ThemeConfig, CRMOrder, CRMOrderStatus } from '../../types';
import { subscribeToCRMOrders, saveCRMOrder } from '../../services/firebase';
import { LayoutDashboard, Filter, Plus, Search, X, Save, ChevronDown, AlertTriangle, Clock, Building2, User } from 'lucide-react';

interface CRMViewProps {
  userSession: UserSession | null;
  onClose: () => void;
  theme: ThemeConfig;
}

const STATUS_COLUMNS: { id: CRMOrderStatus; label: string; color: string; bgColor: string }[] = [
  { id: 'cotizacion', label: 'Cotización Recibida', color: '#FDB813', bgColor: '#FFF8E1' },
  { id: 'sena_50', label: 'Aprobado / Seña 50%', color: '#F97316', bgColor: '#FFF7ED' },
  { id: 'produccion', label: 'En Bordados / Producción', color: '#8B5CF6', bgColor: '#F5F3FF' },
  { id: 'listo', label: 'Listo para Retirar', color: '#10B981', bgColor: '#ECFDF5' },
];

export const CRMView: React.FC<CRMViewProps> = ({ userSession, onClose, theme }) => {
  const [orders, setOrders] = useState<CRMOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'visits' | 'suppliers'>('board');
  const [sellerFilter, setSellerFilter] = useState('todos');
  const [branchFilter, setBranchFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const accent = theme?.accentColor || '#FDB813';

  // Basic permission check
  const canAccess = userSession?.role === 'admin' || userSession?.role === 'employee';

  // Subscribe to real-time CRM orders from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToCRMOrders((fetchedOrders) => {
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, []);

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: CRMOrderStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;
    const order = orders.find(o => o.id === orderId);
    if (order && order.status !== newStatus) {
      saveCRMOrder({ ...order, status: newStatus, updatedAt: new Date().toISOString() });
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

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchesSeller = sellerFilter === 'todos' || (o.seller || '').toLowerCase().includes(sellerFilter);
    const matchesBranch = branchFilter === 'todos' || (o.branch || '').toLowerCase().includes(branchFilter);
    const matchesSearch = !searchQuery || 
      (o.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeller && matchesBranch && matchesSearch;
  });

  // New Manual Order handler
  const handleCreateManualOrder = (formData: any) => {
    const newOrder: CRMOrder = {
      id: `MAN-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      clientName: formData.clientName,
      clientType: formData.clientType || 'empresa',
      status: 'cotizacion',
      seller: formData.seller || 'Sin Asignar',
      branch: formData.branch || 'Sin Asignar',
      totalUnits: Number(formData.totalUnits) || 0,
      totalEstimated: Number(formData.totalEstimated) || 0,
      observations: formData.observations || '',
      updatedAt: new Date().toISOString(),
    };
    saveCRMOrder(newOrder);
    setShowNewOrderModal(false);
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-bold mb-4 text-[#18231C]">Acceso Denegado</h2>
        <p className="mb-4 text-[#6F6860]">No tenés permisos para ver el sistema de gestión.</p>
        <button onClick={onClose} className="px-4 py-2 bg-[#18231C] text-white rounded-xs font-bold text-xs uppercase cursor-pointer">Volver al Catálogo</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#FAF8F5] overflow-hidden">
      {/* Top Bar Navigation */}
      <div className="bg-white border-b border-[#DCD4C9] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 shadow-xs gap-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <h2 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-[#B9522F]" />
            Gestión Pampero
          </h2>
          
          <div className="hidden md:flex bg-[#ECE5DC] rounded-xs p-1">
            {[
              { key: 'board', label: 'Pedidos y Cotizaciones' },
              { key: 'visits', label: 'Visitas (CRM)' },
              { key: 'suppliers', label: 'Pedidos a Proveedor' },
            ].map(tab => (
              <button 
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer ${
                  activeTab === tab.key 
                    ? 'bg-white shadow-xs text-[#18231C]' 
                    : 'text-[#6F6860] hover:text-[#18231C]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231C] text-white rounded-xs text-xs font-bold hover:bg-black transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Pedido Manual
          </button>
          <button onClick={onClose} className="text-[#6F6860] hover:text-[#18231C] text-xs font-bold underline cursor-pointer">
            Volver al Catálogo
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        
        {/* === TAB 1: KANBAN BOARD === */}
        {activeTab === 'board' && (
          <div className="h-full flex flex-col">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-5 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-xs">
              <Filter className="w-4 h-4 text-[#8C827A]" />
              <select 
                value={sellerFilter} 
                onChange={e => setSellerFilter(e.target.value)}
                className="text-xs border border-[#DCD4C9] rounded-xs px-2 py-1.5 outline-none bg-white font-medium text-[#18231C] cursor-pointer"
              >
                <option value="todos">Vendedor: Todos</option>
                <option value="itati">Itatí</option>
                <option value="guada">Guada</option>
                <option value="carolina">Carolina</option>
                <option value="gustavo">Gustavo</option>
              </select>
              <div className="w-px h-4 bg-[#DCD4C9]"></div>
              <select 
                value={branchFilter} 
                onChange={e => setBranchFilter(e.target.value)}
                className="text-xs border border-[#DCD4C9] rounded-xs px-2 py-1.5 outline-none bg-white font-medium text-[#18231C] cursor-pointer"
              >
                <option value="todos">Sucursal: Todas</option>
                <option value="ciudad">Ciudad</option>
                <option value="maipu">Maipú</option>
                <option value="lujan">Luján</option>
              </select>
              <div className="w-px h-4 bg-[#DCD4C9]"></div>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium"
                />
              </div>
              <div className="ml-auto text-[10px] font-bold text-[#8C827A] uppercase">
                {filteredOrders.length} pedidos
              </div>
            </div>

            {/* Kanban Board Columns */}
            <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
              {STATUS_COLUMNS.map(col => {
                const columnOrders = filteredOrders.filter(o => o.status === col.id);
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
                      className="p-3 border-b border-[#DCD4C9] rounded-t-xs font-bold text-xs uppercase text-[#18231C] flex justify-between items-center"
                      style={{ backgroundColor: col.bgColor, borderLeftColor: col.color, borderLeftWidth: '3px' }}
                    >
                      <span>{col.label}</span>
                      <span 
                        className="px-2 py-0.5 rounded-full text-[10px] font-black"
                        style={{ backgroundColor: col.color + '20', color: col.color }}
                      >
                        {columnOrders.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
                      {columnOrders.map(order => {
                        const daysOld = Math.floor((Date.now() - new Date(order.date).getTime()) / (1000 * 60 * 60 * 24));
                        const isDelayed = daysOld > 7 && (order.status === 'cotizacion' || order.status === 'sena_50');
                        return (
                          <div 
                            key={order.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, order.id)}
                            className={`bg-white p-3 rounded-xs border shadow-xs cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${
                              isDelayed ? 'border-red-300 border-l-4 border-l-red-500' : 'border-[#DCD4C9] hover:border-[#B9522F]'
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
                                <span className="text-[10px] text-[#8C827A] font-mono">#{order.id.slice(-6)}</span>
                              </div>
                              {isDelayed && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-xs uppercase flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {daysOld}d
                                </span>
                              )}
                            </div>

                            {/* Client Name */}
                            <h4 className="font-bold text-sm text-[#18231C] leading-tight">{order.clientName}</h4>
                            <p className="text-[11px] text-[#6F6860] mt-0.5">{order.totalUnits} prendas</p>

                            {/* Block Reason */}
                            {order.blockReason && (
                              <div className="mt-2 text-[10px] bg-red-50 text-red-700 p-1.5 rounded-xs font-medium border border-red-100">
                                ⚠ {order.blockReason}
                              </div>
                            )}

                            {/* Observations */}
                            {order.observations && !order.blockReason && (
                              <div className="mt-2 text-[10px] bg-amber-50 text-amber-800 p-1.5 rounded-xs">
                                {order.observations.slice(0, 80)}{order.observations.length > 80 ? '...' : ''}
                              </div>
                            )}

                            {/* Card Footer */}
                            <div className="mt-2.5 flex justify-between items-center border-t border-[#ECE5DC] pt-2">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#8C827A]" />
                                <span className="text-[10px] font-bold text-[#8C827A]">{order.seller || 'Sin asignar'}</span>
                              </div>
                              <span className="font-bold text-emerald-700 text-sm">
                                $ {(order.totalEstimated || 0).toLocaleString('es-AR')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {columnOrders.length === 0 && (
                        <div className={`p-6 text-center text-[11px] text-[#8C827A] border-2 border-dashed rounded-xs ${
                          isDragOver ? 'border-[#B9522F] bg-[#B9522F]/5' : 'border-[#DCD4C9]'
                        }`}>
                          {isDragOver ? 'Soltar aquí' : 'Sin pedidos'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === TAB 2: VISITAS (CRM) === */}
        {activeTab === 'visits' && (
          <div className="bg-white p-8 rounded-xs border border-[#DCD4C9] text-center">
            <h3 className="font-bold text-lg text-[#18231C] uppercase tracking-wider mb-2">Visitas Comerciales</h3>
            <p className="text-sm text-[#6F6860]">
              Acá vas a poder ver el seguimiento de visitas de Itatí, Guada y Carolina con filtros por vendedor, estado y próximo paso.
            </p>
            <p className="text-xs text-[#8C827A] mt-3">En construcción — Fase 2</p>
          </div>
        )}

        {/* === TAB 3: PEDIDOS A PROVEEDOR === */}
        {activeTab === 'suppliers' && (
          <div className="bg-white p-8 rounded-xs border border-[#DCD4C9] text-center">
            <h3 className="font-bold text-lg text-[#18231C] uppercase tracking-wider mb-2">Pedidos a Proveedor</h3>
            <p className="text-sm text-[#6F6860]">
              Acá vas a poder hacer el seguimiento de tus pedidos a Macata y otros proveedores, con tiempos de entrega y estados.
            </p>
            <p className="text-xs text-[#8C827A] mt-3">En construcción — Fase 2</p>
          </div>
        )}
      </div>

      {/* === MODAL: Nuevo Pedido Manual === */}
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
/*  MODAL: Crear Pedido Manual                  */
/* ============================================ */
const NewOrderModal: React.FC<{ onClose: () => void; onSave: (data: any) => void; accent: string }> = ({ onClose, onSave, accent }) => {
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'empresa' | 'consumidor_final'>('empresa');
  const [seller, setSeller] = useState('');
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
        {/* Header */}
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Nuevo Pedido Manual</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Client Name */}
          <div>
            <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Empresa / Cliente *</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Ej: PIZZOLON, VALMEN JCB..."
              className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none focus:border-[#B9522F]"
              required
            />
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Tipo</label>
              <select value={clientType} onChange={e => setClientType(e.target.value as any)} className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none">
                <option value="empresa">Empresa</option>
                <option value="consumidor_final">Consumidor Final</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Vendedor</label>
              <select value={seller} onChange={e => setSeller(e.target.value)} className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none">
                <option value="">Sin asignar</option>
                <option value="Itatí">Itatí</option>
                <option value="Guada">Guada</option>
                <option value="Carolina">Carolina</option>
                <option value="Gustavo">Gustavo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Sucursal</label>
              <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none">
                <option value="Ciudad">Ciudad</option>
                <option value="Maipú">Maipú</option>
                <option value="Luján">Luján</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Prendas</label>
              <input type="number" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Monto $</label>
              <input type="number" value={totalEstimated} onChange={e => setTotalEstimated(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Observaciones</label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
              placeholder="Notas adicionales del pedido..."
              className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DCD4C9]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer">
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
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
