import React from 'react';
import { CRMOrder, LeadVisit } from '../../types';
import { X, AlertTriangle, Clock, MessageCircle, Building2, User, CheckCircle2 } from 'lucide-react';

interface CRMNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: CRMOrder[];
  visits: LeadVisit[];
  onSelectOrder?: (order: CRMOrder) => void;
}

export const CRMNotificationsModal: React.FC<CRMNotificationsModalProps> = ({
  isOpen,
  onClose,
  orders,
  visits,
  onSelectOrder,
}) => {
  if (!isOpen) return null;

  // Read configurable notification settings from Admin Panel
  let settings = {
    staleQuoteDays: 7,
    notifyNewQuotes: true,
    notifyStaleOrders: true,
    notifyBlockedOrders: true,
    notifyPendingVisits: true,
  };
  try {
    const saved = localStorage.getItem('pampero_notification_settings');
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
  } catch {}

  // 1. Identify delayed orders based on configured staleQuoteDays
  const delayedOrders = settings.notifyStaleOrders
    ? orders.filter((o) => {
        const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
        return daysOld >= settings.staleQuoteDays && (o.status === 'cotizacion' || o.status === 'sena_50');
      })
    : [];

  // 2. Identify blocked orders
  const blockedOrders = settings.notifyBlockedOrders
    ? orders.filter((o) => Boolean(o.blockReason))
    : [];

  // 3. Identify visits requiring follow-up
  const pendingVisits = settings.notifyPendingVisits
    ? visits.filter((v) => v.status === 'programada' || v.status === 'presupuesto_enviado')
    : [];

  // 4. Identify recent new quotes (< 2 days)
  const newQuotes = settings.notifyNewQuotes
    ? orders.filter((o) => {
        const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
        return daysOld <= 2 && o.status === 'cotizacion';
      })
    : [];

  const totalAlerts = delayedOrders.length + blockedOrders.length + pendingVisits.length;

  const handleWhatsAppFollowUp = (clientName: string, id: string) => {
    const text = encodeURIComponent(
      `Hola ${clientName}, te escribimos de Pampero Gran Mendoza por la cotización #${id.slice(-6)}. ¿Pudiste revisarla o te gustaría que coordinemos una muestra de talles?`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider">Centro de Notificaciones & Alertas</h3>
              <p className="text-[11px] text-[#DCD4C9]/70">
                {totalAlerts} alertas requieren atención del equipo comercial
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section A: Pedidos Bloqueados */}
          {blockedOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Pedidos con Bloqueo ({blockedOrders.length})
              </h4>
              <div className="space-y-2">
                {blockedOrders.map((o) => (
                  <div key={o.id} className="p-3 bg-red-50/70 border border-red-200 rounded-xs flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#18231C]">
                        {o.clientType === 'empresa' ? <Building2 className="w-3.5 h-3.5 text-amber-600" /> : <User className="w-3.5 h-3.5 text-emerald-600" />}
                        <span>{o.clientName}</span>
                        <span className="text-[10px] text-[#6F6860] font-mono">#{o.id.slice(-6)}</span>
                      </div>
                      <p className="text-[11px] text-red-800 font-medium mt-1">
                        Motivo: {o.blockReason}
                      </p>
                      <p className="text-[10px] text-[#6F6860] mt-0.5">
                        Vendedor: {o.seller || 'Sin asignar'} · Sucursal: {o.branch || 'Mendoza'}
                      </p>
                    </div>
                    {onSelectOrder && (
                      <button
                        onClick={() => {
                          onSelectOrder(o);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-red-300 text-red-800 text-[10px] font-bold rounded-xs cursor-pointer shrink-0"
                      >
                        Ver Ficha
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: Pedidos Demorados */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-2.5">
              <Clock className="w-3.5 h-3.5" />
              Cotizaciones Demoradas (&gt; 7 días sin avanzar) ({delayedOrders.length})
            </h4>
            {delayedOrders.length === 0 ? (
              <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-center text-xs text-[#6F6860]">
                No hay cotizaciones demoradas. ¡El flujo está al día!
              </div>
            ) : (
              <div className="space-y-2">
                {delayedOrders.map((o) => {
                  const daysOld = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={o.id} className="p-3 bg-white border border-amber-300 rounded-xs flex items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-[#18231C]">
                          <span>{o.clientName}</span>
                          <span className="text-[10px] text-[#6F6860] font-mono">#{o.id.slice(-6)}</span>
                          <span className="text-[9px] bg-red-100 text-red-800 font-extrabold px-1.5 py-0.2 rounded-xs">
                            {daysOld} días
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6F6860] mt-0.5">
                          {o.totalUnits} prendas · ${o.totalEstimated.toLocaleString('es-AR')} · Vendedor: {o.seller || 'Sin asignar'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleWhatsAppFollowUp(o.clientName, o.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#25D366] hover:bg-[#20ba59] text-white text-[10px] font-bold rounded-xs cursor-pointer shadow-xs"
                        title="Enviar mensaje de seguimiento por WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        Reactivar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section C: Visitas Pendientes */}
          {pendingVisits.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Seguimiento de Visitas Comerciales ({pendingVisits.length})
              </h4>
              <div className="space-y-2">
                {pendingVisits.map((v) => (
                  <div key={v.id} className="p-3 bg-blue-50/50 border border-blue-200 rounded-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-xs text-[#18231C]">
                        {v.companyName} ({v.contactName})
                      </div>
                      <p className="text-[11px] text-blue-950 mt-0.5 font-medium">
                        Objetivo: {v.objective}
                      </p>
                      <p className="text-[10px] text-[#6F6860]">
                        Vendedor: {v.seller} · Próximo paso: {v.nextStep}
                      </p>
                    </div>
                    {v.phone && (
                      <a
                        href={`https://wa.me/${v.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(v.contactName)},%20te%20escribimos%20de%20Pampero%20Mendoza.`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 text-[10px] font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Contactar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#FAF8F5] px-6 py-3 border-t border-[#DCD4C9] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs hover:bg-black cursor-pointer"
          >
            Cerrar Alertas
          </button>
        </div>
      </div>
    </div>
  );
};
