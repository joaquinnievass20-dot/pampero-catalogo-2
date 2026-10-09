import React, { useState, useEffect, useMemo } from 'react';
import { CRMOrder, CRMOrderStatus, ThemeConfig, UserSession } from '../../types';
import { subscribeToCRMOrders } from '../../services/firebase';
import { sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { 
  Package, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Shirt, 
  Building2, 
  MessageCircle, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Phone,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface ClientOrderStatusViewProps {
  userSession: UserSession | null;
  theme: ThemeConfig;
  onBackToHome: () => void;
  onOpenCatalog?: () => void;
}

interface StepDefinition {
  id: CRMOrderStatus;
  stepNumber: number;
  label: string;
  shortDesc: string;
  detailDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const ORDER_STEPS: StepDefinition[] = [
  {
    id: 'cotizacion',
    stepNumber: 1,
    label: 'Cotización Registrada',
    shortDesc: 'Revisión y verificación',
    detailDesc: 'Tu solicitud de prendas y cantidades fue ingresada en nuestro sistema. El equipo comercial verificó stock y confección.',
    icon: Clock,
    color: '#FDB813',
  },
  {
    id: 'sena_50',
    stepNumber: 2,
    label: 'Aprobado · Seña 50%',
    shortDesc: 'Partida reservada',
    detailDesc: 'Seña inicial confirmada. La partida de indumentaria fue apartada en depósito para corte y preparación de matrices.',
    icon: CheckCircle2,
    color: '#F97316',
  },
  {
    id: 'produccion',
    stepNumber: 3,
    label: 'En Bordados / Taller',
    shortDesc: 'Confección y personalización',
    detailDesc: 'Tus prendas están en taller oficial Pampero: proceso de bordados computarizados, apliques reflectivos y control textil.',
    icon: Shirt,
    color: '#8B5CF6',
  },
  {
    id: 'listo',
    stepNumber: 4,
    label: 'Listo para Retiro / Despacho',
    shortDesc: 'Preparado en sucursal',
    detailDesc: '¡Pedido terminado! Las prendas completaron el control de calidad final y están empaquetadas listas en sucursal para entrega o envío.',
    icon: Package,
    color: '#10B981',
  },
  {
    id: 'entregado',
    stepNumber: 5,
    label: 'Entregado / Finalizado',
    shortDesc: 'Recibido con conformidad',
    detailDesc: 'Tu dotación fue entregada con éxito. ¡Gracias por confiar en indumentaria oficial Pampero!',
    icon: Truck,
    color: '#3B82F6',
  },
];

export const ClientOrderStatusView: React.FC<ClientOrderStatusViewProps> = ({
  userSession,
  theme,
  onBackToHome,
  onOpenCatalog,
}) => {
  const [allOrders, setAllOrders] = useState<CRMOrder[]>([]);
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CRMOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const accent = theme?.accentColor || '#FDB813';

  // 1. Subscribe in Real-Time to Cloud Firestore 'crm_orders'
  useEffect(() => {
    const unsub = subscribeToCRMOrders((fetched) => {
      const sanitized = fetched.map(sanitizeObjectEncoding);
      setAllOrders(sanitized);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Identify the client's registered name / email / company
  const clientCompany = (userSession?.clientData?.companyName || '').trim().toLowerCase();
  const clientName = (userSession?.clientData?.fullName || '').trim().toLowerCase();
  const clientEmail = (userSession?.email || '').trim().toLowerCase();

  // 3. Filter orders matching this client automatically
  const clientOrders = useMemo(() => {
    if (!userSession) return [];
    return allOrders.filter((o) => {
      const oName = (o.clientName || '').toLowerCase().trim();
      const oEmail = (o.clientEmail || '').toLowerCase().trim();
      const matchCompany = clientCompany && oName.includes(clientCompany);
      const matchClient = clientName && oName.includes(clientName);
      const matchEmail = clientEmail && oEmail === clientEmail;
      return matchCompany || matchClient || matchEmail;
    });
  }, [allOrders, clientCompany, clientName, clientEmail, userSession]);

  // 4. If search query is entered, search across all orders by orderNumber or client name
  const searchedOrders = useMemo(() => {
    const q = searchOrderNumber.trim().toLowerCase();
    if (!q) return clientOrders;
    return allOrders.filter((o) => {
      const num = (o.orderNumber || o.id || '').toLowerCase();
      const name = (o.clientName || '').toLowerCase();
      return num.includes(q) || name.includes(q);
    });
  }, [allOrders, searchOrderNumber, clientOrders]);

  // Set active selected order default
  const activeOrder = selectedOrder || searchedOrders[0] || null;

  // Determine which step index the active order is currently on (0 to 4)
  const getCurrentStepIndex = (status?: CRMOrderStatus): number => {
    if (!status) return 0;
    const index = ORDER_STEPS.findIndex((s) => s.id === status);
    return index >= 0 ? index : 0;
  };

  const currentStepIdx = getCurrentStepIndex(activeOrder?.status);

  return (
    <div className="w-full min-h-screen bg-[#FAF8F5] text-[#18231C] font-sans pb-16">
      {/* Top Header Navigation */}
      <div className="bg-[#18231C] text-white border-b border-black py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 hover:bg-white/10 rounded-xs text-[#FAF8F5] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Inicio</span>
            </button>
            <span className="text-neutral-500 hidden sm:inline">|</span>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#FDB813]" />
              <span className="font-display font-bold uppercase tracking-wider text-sm sm:text-base">
                Seguimiento en Vivo · Estado de mi Pedido
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Sincronización en Vivo
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Intro & Search Card */}
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#B9522F] block">
                PORTAL DE TRANSPARENCIA Y ENTREGAS PAMPERO
              </span>
              <h1 className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-wider text-[#18231C] mt-0.5">
                Rastreo y Fase de tu Pedido
              </h1>
              <p className="text-xs text-[#6F6860] mt-1 max-w-2xl leading-relaxed">
                Consultá en tiempo real en qué etapa de confección, bordados o despacho se encuentra tu pedido corporativo directamente conectado con nuestro taller y depósitos.
              </p>
            </div>

            {/* Direct Order Number Search Input */}
            <div className="w-full md:w-80 shrink-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#18231C] mb-1">
                Ingresá tu Número de Pedido:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#8C827A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchOrderNumber}
                  onChange={(e) => setSearchOrderNumber(e.target.value)}
                  placeholder="Ej: PED-101, PED-104..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold text-[#18231C] placeholder-[#8C827A] outline-none focus:border-[#B9522F] focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Order Tabs (if multiple orders found) */}
          {searchedOrders.length > 1 && (
            <div className="pt-3 border-t border-[#DCD4C9]/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] shrink-0">
                Tus Pedidos Activos:
              </span>
              {searchedOrders.map((o) => {
                const isSelected = activeOrder?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrder(o)}
                    className={`px-3 py-1.5 rounded-xs text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#18231C] text-white shadow-xs'
                        : 'bg-[#FAF8F5] text-[#6F6860] hover:bg-white hover:text-[#18231C] border border-[#DCD4C9]'
                    }`}
                  >
                    <span>{o.orderNumber || o.id}</span>
                    <span className="text-[10px] opacity-75">({o.clientName})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Tracking Visual Display */}
        {activeOrder ? (
          <div className="space-y-6">
            
            {/* Active Order Summary Header */}
            <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DCD4C9]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-xs font-mono text-sm font-black">
                      {activeOrder.orderNumber || activeOrder.id}
                    </span>
                    <span className="text-xs text-[#6F6860] font-medium">
                      Registrado el {activeOrder.date}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-wider text-[#18231C] mt-2">
                    {activeOrder.clientName}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
                    <span className="text-[10px] text-[#6F6860] uppercase block font-bold">Dotación / Cantidad</span>
                    <strong className="text-[#18231C] font-mono text-sm">{activeOrder.totalUnits} prendas</strong>
                  </div>

                  <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
                    <span className="text-[10px] text-[#6F6860] uppercase block font-bold">Sucursal Asignada</span>
                    <strong className="text-[#18231C] text-sm">{activeOrder.branch || 'Maipú'}</strong>
                  </div>

                  <div className="p-2.5 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
                    <span className="text-[10px] text-[#6F6860] uppercase block font-bold">Asesor Comercial</span>
                    <strong className="text-[#18231C] text-sm">{activeOrder.seller || 'Itatí'}</strong>
                  </div>

                  {activeOrder.totalEstimated > 0 && (
                    <div className="p-2.5 bg-emerald-50 rounded-xs border border-emerald-300">
                      <span className="text-[10px] text-emerald-800 uppercase block font-bold">Total Estimado</span>
                      <strong className="text-emerald-950 font-mono text-sm">$ {activeOrder.totalEstimated.toLocaleString('es-AR')}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* INTERACTIVE VISUAL STEPPER (5 FASES DE SEGUIMIENTO EN KANBAN) */}
              <div className="pt-6 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6F6860] block mb-4">
                  PROGRESO DEL PEDIDO EN LÍNEA DE PRODUCCIÓN PAMPERO:
                </span>

                {/* Stepper Bar for Desktop / Tablet */}
                <div className="hidden md:grid md:grid-cols-5 gap-3 relative">
                  {ORDER_STEPS.map((s, idx) => {
                    const isCompleted = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const isPending = idx > currentStepIdx;
                    const IconComponent = s.icon;

                    return (
                      <div
                        key={s.id}
                        className={`relative p-3.5 rounded-xs border flex flex-col justify-between transition-all ${
                          isCurrent
                            ? 'bg-amber-50/70 border-[#B9522F] shadow-sm ring-2 ring-[#B9522F]/30'
                            : isCompleted
                            ? 'bg-emerald-50/40 border-emerald-300'
                            : 'bg-[#FAF8F5]/60 border-[#DCD4C9] opacity-60'
                        }`}
                      >
                        {/* Top Step Number Badge & Status Icon */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-[#B9522F] text-white shadow-xs animate-bounce'
                                : 'bg-[#DCD4C9] text-[#6F6860]'
                            }`}
                          >
                            {isCompleted ? '✓' : s.stepNumber}
                          </span>

                          <IconComponent
                            className={`w-4 h-4 ${
                              isCurrent
                                ? 'text-[#B9522F]'
                                : isCompleted
                                ? 'text-emerald-600'
                                : 'text-[#8C827A]'
                            }`}
                          />
                        </div>

                        <div>
                          <h4
                            className={`font-bold text-xs uppercase tracking-wider leading-tight ${
                              isCurrent
                                ? 'text-[#B9522F]'
                                : isCompleted
                                ? 'text-emerald-950'
                                : 'text-[#6F6860]'
                            }`}
                          >
                            {s.label}
                          </h4>
                          <p className="text-[10px] text-[#6F6860] mt-1 line-clamp-2">
                            {s.shortDesc}
                          </p>
                        </div>

                        {/* Current Active Indicator Pill */}
                        {isCurrent && (
                          <div className="mt-3 pt-2 border-t border-[#B9522F]/20 flex items-center gap-1 text-[10px] font-black uppercase text-[#B9522F]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#B9522F] animate-ping" />
                            <span>Fase Actual</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Stepper Timeline for Mobile */}
                <div className="md:hidden space-y-3">
                  {ORDER_STEPS.map((s, idx) => {
                    const isCompleted = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const IconComponent = s.icon;

                    return (
                      <div
                        key={s.id}
                        className={`p-3 rounded-xs border flex items-start gap-3 ${
                          isCurrent
                            ? 'bg-amber-50 border-[#B9522F] ring-1 ring-[#B9522F]'
                            : isCompleted
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-[#DCD4C9] opacity-60'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-[#B9522F] text-white'
                              : 'bg-[#DCD4C9] text-[#6F6860]'
                          }`}
                        >
                          {isCompleted ? '✓' : s.stepNumber}
                        </span>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs uppercase text-[#18231C]">
                              {s.label}
                            </h4>
                            {isCurrent && (
                              <span className="text-[9px] bg-[#B9522F] text-white px-1.5 py-0.5 rounded-xs font-black uppercase">
                                Actual
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#6F6860] mt-0.5">
                            {s.detailDesc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Explanation of Current Stage */}
                <div className="mt-5 p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B9522F] block">
                      INFORMACIÓN DE LA ETAPA ACTUAL:
                    </span>
                    <h5 className="font-bold text-sm uppercase text-[#18231C]">
                      {ORDER_STEPS[currentStepIdx]?.label}
                    </h5>
                    <p className="text-xs text-[#6F6860] leading-relaxed max-w-2xl">
                      {ORDER_STEPS[currentStepIdx]?.detailDesc}
                    </p>
                    {activeOrder.observations && (
                      <p className="text-xs text-[#18231C] font-semibold mt-1">
                        <strong>Detalle / Ficha:</strong> {activeOrder.observations}
                      </p>
                    )}
                  </div>

                  {/* Direct Contact Button */}
                  <a
                    href={`https://wa.me/549${theme?.whatsappNumber || '2612128105'}?text=${encodeURIComponent(
                      `¡Hola Pampero Gran Mendoza! Consulto por el estado de mi pedido ${activeOrder.orderNumber || activeOrder.id} a nombre de ${activeOrder.clientName}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Consultar por WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 text-center rounded-xs border border-[#DCD4C9] space-y-4">
            <Package className="w-12 h-12 text-[#8C827A] mx-auto opacity-50" />
            <h3 className="font-display font-bold text-xl uppercase tracking-wider text-[#18231C]">
              No se encontró ningún pedido con ese número
            </h3>
            <p className="text-xs text-[#6F6860] max-w-md mx-auto">
              Verificá haber escrito correctamente el código (ej: <strong>PED-101</strong>) o contactanos directamente por WhatsApp con tu razón social.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSearchOrderNumber('')}
                className="px-4 py-2 bg-[#FAF8F5] border border-[#DCD4C9] text-xs font-bold uppercase rounded-xs hover:bg-[#ECE5DC]"
              >
                Limpiar Búsqueda
              </button>
              {onOpenCatalog && (
                <button
                  type="button"
                  onClick={onOpenCatalog}
                  className="px-4 py-2 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs hover:bg-black"
                >
                  Ir al Catálogo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
