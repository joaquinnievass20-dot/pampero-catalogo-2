import React, { useState, useEffect } from 'react';
import { NotificationSettings } from '../../types';
import { Bell, Save, Check, Clock, AlertTriangle, ShieldCheck, Mail, MessageSquare } from 'lucide-react';

interface AdminNotificationsTabProps {
  triggerSaveNotice: () => void;
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({ triggerSaveNotice }) => {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('pampero_notification_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      staleQuoteDays: 7,
      notifyNewQuotes: true,
      notifyStaleOrders: true,
      notifyBlockedOrders: true,
      notifyPendingVisits: true,
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('pampero_notification_settings', JSON.stringify(settings));
    } catch {}
    setSavedSuccess(true);
    triggerSaveNotice();
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="border-b border-[#DCD4C9] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Configuración de Notificaciones & Alertas Comerciales
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Definí las reglas automáticas que disparan alertas en la campanita de notificaciones del personal y en el tablero de gestión.
          </p>
        </div>

        {savedSuccess && (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xs text-xs font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Guardado Correctamente
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Rule 1: Días de estancamiento */}
        <div className="p-5 bg-white border border-[#DCD4C9] rounded-xs shadow-2xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xs bg-amber-50 text-amber-700 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                Umbral de Días para Cotizaciones Estancadas
              </h4>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Si un pedido de cotización o una seña pendiente permanece más de este tiempo sin avanzar de columna, el sistema marcará la tarjeta en rojo y enviará una notificación urgente al personal.
              </p>

              <div className="mt-3 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.staleQuoteDays}
                  onChange={(e) => setSettings({ ...settings, staleQuoteDays: Math.max(1, Number(e.target.value) || 7) })}
                  className="w-24 px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-sm font-bold text-[#18231C] focus:border-[#FDB813] outline-none"
                />
                <span className="text-xs font-semibold text-[#18231C]">días corridos sin actualización</span>
                <span className="text-[11px] text-[#8C827A]">(Recomendado: 5 a 7 días)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rule 2: Tipos de alertas activas */}
        <div className="p-5 bg-white border border-[#DCD4C9] rounded-xs shadow-2xs space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] border-b border-[#DCD4C9] pb-2">
            Disparadores de Alertas en la Campanita
          </h4>

          <div className="space-y-3">
            {/* Toggle 1: Nuevas Cotizaciones */}
            <label className="flex items-start gap-3 p-3 rounded-xs border border-[#ECE5DC] hover:border-[#DCD4C9] cursor-pointer transition-colors bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={settings.notifyNewQuotes}
                onChange={(e) => setSettings({ ...settings, notifyNewQuotes: e.target.checked })}
                className="mt-0.5 rounded text-[#18231C] focus:ring-[#FDB813]"
              />
              <div>
                <span className="text-xs font-bold text-[#18231C] block">
                  Notificar Nuevas Cotizaciones Recibidas
                </span>
                <span className="text-[11px] text-[#6F6860] block mt-0.5">
                  Genera una notificación en cuanto un cliente o empresa envía un pedido desde el catálogo o web.
                </span>
              </div>
            </label>

            {/* Toggle 2: Pedidos Estancados */}
            <label className="flex items-start gap-3 p-3 rounded-xs border border-[#ECE5DC] hover:border-[#DCD4C9] cursor-pointer transition-colors bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={settings.notifyStaleOrders}
                onChange={(e) => setSettings({ ...settings, notifyStaleOrders: e.target.checked })}
                className="mt-0.5 rounded text-[#18231C] focus:ring-[#FDB813]"
              />
              <div>
                <span className="text-xs font-bold text-[#18231C] block">
                  Notificar Pedidos Estancados (&gt; {settings.staleQuoteDays} días)
                </span>
                <span className="text-[11px] text-[#6F6860] block mt-0.5">
                  Alerta con botón directo de WhatsApp para reactivar al cliente o consultarle si revisó el presupuesto.
                </span>
              </div>
            </label>

            {/* Toggle 3: Pedidos Bloqueados */}
            <label className="flex items-start gap-3 p-3 rounded-xs border border-[#ECE5DC] hover:border-[#DCD4C9] cursor-pointer transition-colors bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={settings.notifyBlockedOrders}
                onChange={(e) => setSettings({ ...settings, notifyBlockedOrders: e.target.checked })}
                className="mt-0.5 rounded text-[#18231C] focus:ring-[#FDB813]"
              />
              <div>
                <span className="text-xs font-bold text-[#18231C] block flex items-center gap-1.5 text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  Notificar Pedidos Bloqueados con Motivo
                </span>
                <span className="text-[11px] text-[#6F6860] block mt-0.5">
                  Muestra pedidos que tienen motivo de bloqueo especificado (ej: falta de stock en fábrica, seña no acreditada).
                </span>
              </div>
            </label>

            {/* Toggle 4: Visitas Comerciales */}
            <label className="flex items-start gap-3 p-3 rounded-xs border border-[#ECE5DC] hover:border-[#DCD4C9] cursor-pointer transition-colors bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={settings.notifyPendingVisits}
                onChange={(e) => setSettings({ ...settings, notifyPendingVisits: e.target.checked })}
                className="mt-0.5 rounded text-[#18231C] focus:ring-[#FDB813]"
              />
              <div>
                <span className="text-xs font-bold text-[#18231C] block">
                  Notificar Visitas Comerciales Pendientes de Seguimiento
                </span>
                <span className="text-[11px] text-[#6F6860] block mt-0.5">
                  Avisa al vendedor responsable sobre reuniones o visitas a empresas presupuestadas que no se han cerrado.
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span>Guardar Configuración de Notificaciones</span>
          </button>
        </div>
      </form>
    </div>
  );
};
