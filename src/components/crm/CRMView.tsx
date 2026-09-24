import React, { useState } from 'react';
import { UserSession, ThemeConfig, CRMOrder, CRMOrderStatus } from '../../types';
import { LayoutDashboard, Users, Truck, PackageSearch, Filter, Plus } from 'lucide-react';

interface CRMViewProps {
  userSession: UserSession | null;
  onClose: () => void;
  theme: ThemeConfig;
}

export const CRMView: React.FC<CRMViewProps> = ({ userSession, onClose, theme }) => {
  const [activeTab, setActiveTab] = useState<'board' | 'visits' | 'suppliers'>('board');
  const accent = theme?.accentColor || '#FDB813';

  // Basic permission check
  const canAccess = userSession?.role === 'admin' || userSession?.role === 'employee';

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-bold mb-4">Acceso Denegado</h2>
        <p className="mb-4">No tienes permisos para ver el sistema de gestin.</p>
        <button onClick={onClose} className="px-4 py-2 bg-[#18231C] text-white rounded">Volver</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#FAF8F5] overflow-hidden">
      {/* Top Bar Navigation */}
      <div className="bg-white border-b border-[#DCD4C9] px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-6">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-[#B9522F]" />
            Gestin Pampero
          </h2>
          
          <div className="hidden md:flex bg-[#ECE5DC] rounded-xs p-1">
            <button 
              onClick={() => setActiveTab('board')}
              className={`px-4 py-1.5 text-xs font-bold uppercase rounded-xs transition-colors ${activeTab === 'board' ? 'bg-white shadow-xs text-[#18231C]' : 'text-[#6F6860] hover:text-[#18231C]'}`}
            >
              Pedidos y Cotizaciones
            </button>
            <button 
              onClick={() => setActiveTab('visits')}
              className={`px-4 py-1.5 text-xs font-bold uppercase rounded-xs transition-colors ${activeTab === 'visits' ? 'bg-white shadow-xs text-[#18231C]' : 'text-[#6F6860] hover:text-[#18231C]'}`}
            >
              Visitas (CRM)
            </button>
            <button 
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-1.5 text-xs font-bold uppercase rounded-xs transition-colors ${activeTab === 'suppliers' ? 'bg-white shadow-xs text-[#18231C]' : 'text-[#6F6860] hover:text-[#18231C]'}`}
            >
              Pedidos a Proveedor
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231C] text-white rounded-xs text-xs font-bold hover:bg-black transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Pedido Manual
          </button>
          <button onClick={onClose} className="text-[#6F6860] hover:text-[#18231C] text-xs font-bold underline">
            Volver al Catlogo
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'board' && (
          <div className="h-full flex flex-col">
            {/* Board Filters */}
            <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-xs border border-[#DCD4C9]">
              <Filter className="w-4 h-4 text-[#8C827A]" />
              <select className="text-xs border-none outline-none bg-transparent font-medium text-[#18231C]">
                <option value="todos">Vendedor: Todos</option>
                <option value="itati">Itat</option>
                <option value="guada">Guada</option>
                <option value="carolina">Carolina</option>
              </select>
              <div className="w-px h-4 bg-[#DCD4C9]"></div>
              <select className="text-xs border-none outline-none bg-transparent font-medium text-[#18231C]">
                <option value="todos">Sucursal: Todas</option>
                <option value="ciudad">Ciudad</option>
                <option value="maipu">Maip</option>
                <option value="lujan">Lujn</option>
              </select>
            </div>

            {/* Kanban Board Columns Placeholder */}
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
              {['Cotizacin', 'Sea 50%', 'En Produccin', 'Listo para Retirar'].map(col => (
                <div key={col} className="w-80 shrink-0 bg-[#ECE5DC]/50 rounded-md border border-[#DCD4C9]/50 flex flex-col">
                  <div className="p-3 border-b border-[#DCD4C9] bg-[#ECE5DC] rounded-t-md font-bold text-xs uppercase text-[#18231C] flex justify-between">
                    {col}
                    <span className="bg-white px-2 py-0.5 rounded-full text-[10px]">0</span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto">
                    <div className="p-4 text-center text-[10px] text-[#8C827A] border-2 border-dashed border-[#DCD4C9] rounded-xs">
                      Arrastrar tarjetas aqu (En construccin)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
