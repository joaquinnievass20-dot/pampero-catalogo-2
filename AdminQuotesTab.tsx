import React, { useState, useEffect } from 'react';
import { ReceivedQuote } from '../../types';
import { 
  ShoppingBag, 
  Search, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  RefreshCw, 
  Building2, 
  MessageCircle, 
  Copy, 
  Check, 
  FileText,
  DollarSign
} from 'lucide-react';

export const AdminQuotesTab: React.FC = () => {
  const [quotes, setQuotes] = useState<ReceivedQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<ReceivedQuote | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const local = localStorage.getItem('pampero_received_quotes');
      if (local) {
        setQuotes(JSON.parse(local));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const filteredQuotes = quotes.filter((q) => {
    const s = search.toLowerCase();
    return (
      q.id.toLowerCase().includes(s) ||
      q.clientName.toLowerCase().includes(s) ||
      q.clientEmail.toLowerCase().includes(s) ||
      q.clientPhone.toLowerCase().includes(s) ||
      q.clientAddress.toLowerCase().includes(s)
    );
  });

  const totalRevenue = quotes.reduce((acc, q) => acc + (q.totalEstimated || 0), 0);
  const totalUnits = quotes.reduce((acc, q) => acc + (q.totalUnits || 0), 0);

  const handleCopyQuoteSummary = (q: ReceivedQuote) => {
    let text = `COTIZACIÓN #${q.id}\nCliente: ${q.clientName}\nEmail: ${q.clientEmail}\nTel: ${q.clientPhone}\nDirección: ${q.clientAddress}\n\nARTÍCULOS:\n`;
    q.items?.forEach((it: any, idx) => {
      const pName = it.name || it.product?.name || 'Artículo';
      const pCode = it.code || it.product?.code || '-';
      const pSize = it.size || it.selectedSize || '-';
      const pColor = it.color || it.selectedColor || '-';
      const pPrice = it.unitPrice || it.product?.price || 0;
      text += `${idx + 1}. ${pName} (${pCode}) - ${it.quantity} un. - Talle: ${pSize} | Color: ${pColor} - $${pPrice.toLocaleString('es-AR')}\n`;
    });
    text += `\nTOTAL ESTIMADO: $${(q.totalEstimated || 0).toLocaleString('es-AR')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
            <ShoppingBag className="w-6 h-6 text-[#B9522F]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Bandeja de Cotizaciones Recibidas
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Todas las solicitudes enviadas automáticamente por los clientes a <strong>ventas@pamperomaipu.com.ar</strong> quedan registradas aquí en tiempo real.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchQuotes}
          disabled={loading}
          className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#B9522F] ${loading ? 'animate-spin' : ''}`} />
          Actualizar Lista
        </button>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Cotizaciones Totales</span>
          <div className="text-2xl font-bold font-display text-[#18231C] mt-1">{quotes.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Prendas Solicitadas</span>
          <div className="text-2xl font-bold font-display text-[#B9522F] mt-1">{totalUnits} un.</div>
        </div>
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#6F6860]">Monto Estimado en Cartera</span>
          <div className="text-2xl font-bold font-display text-emerald-700 mt-1">
            ${totalRevenue.toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      {/* Quotes list */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6F6860] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por cliente, cotización, email o dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none"
            />
          </div>
          <span className="text-xs font-bold text-[#6F6860] uppercase">
            {filteredQuotes.length} cotizaciones
          </span>
        </div>

        <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
              <tr>
                <th className="p-3">ID / Fecha</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Contacto</th>
                <th className="p-3 text-center">Prendas</th>
                <th className="p-3 text-right">Total Estimado</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#6F6860]">
                    No hay cotizaciones registradas aún. Cuando los clientes envíen solicitudes desde el catálogo, aparecerán aquí automáticamente.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-[#FAF8F5]">
                    <td className="p-3 font-mono">
                      <div className="font-bold text-[#18231C]">{q.id}</div>
                      <div className="text-[10px] text-[#6F6860]">{q.date}</div>
                    </td>
                    <td className="p-3 font-bold text-[#18231C]">
                      <div className="flex items-center gap-1.5">
                        {q.clientType === 'empresa' ? (
                          <Building2 className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{q.clientName}</span>
                      </div>
                      {q.clientAddress && (
                        <div className="text-[10px] text-[#6F6860] font-normal flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#B9522F]" />
                          {q.clientAddress}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-[#18231C]">{q.clientEmail}</div>
                      <div className="text-[10px] text-[#6F6860]">{q.clientPhone || 'Sin teléfono'}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-[#B9522F]">
                      {q.totalUnits} un.
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      ${(q.totalEstimated || 0).toLocaleString('es-AR')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedQuote(q)}
                        className="px-3 py-1 bg-[#18231C] hover:bg-black text-white rounded-xs font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h4 className="font-display text-base uppercase tracking-wider font-bold">
                  Cotización #{selectedQuote.id}
                </h4>
                <p className="text-[11px] text-[#DCD4C9]/70">
                  Fecha: {selectedQuote.date} · Destinatario: ventas@pamperomaipu.com.ar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Client info */}
              <div className="p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-2">
                <h5 className="font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#B9522F]" />
                  Datos del Cliente
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#4A453F]">
                  <div><strong>Nombre/Razón Social:</strong> {selectedQuote.clientName}</div>
                  <div><strong>Tipo de Cuenta:</strong> {selectedQuote.clientType}</div>
                  <div><strong>Email:</strong> {selectedQuote.clientEmail}</div>
                  <div><strong>Teléfono:</strong> {selectedQuote.clientPhone || '-'}</div>
                  <div className="sm:col-span-2">
                    <strong>Dirección:</strong> {selectedQuote.clientAddress || 'No especificada'}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h5 className="font-bold uppercase tracking-wider text-[#18231C]">
                  Artículos Solicitados ({selectedQuote.totalUnits} un.)
                </h5>
                <div className="border border-[#DCD4C9] rounded-xs divide-y divide-[#DCD4C9]">
                  {selectedQuote.items?.map((it: any, idx) => {
                    const name = it.name || it.product?.name || 'Artículo';
                    const code = it.code || it.product?.code || '-';
                    const size = it.size || it.selectedSize || 'Estándar';
                    const color = it.color || it.selectedColor || 'Estándar';
                    const price = it.unitPrice || it.product?.price || 0;
                    return (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#18231C]">
                            {name} ({code})
                          </div>
                          <div className="text-[11px] text-[#6F6860] mt-0.5">
                            Talle: <span className="font-bold">{size}</span> · 
                            Color: <span className="font-bold">{color}</span> · 
                            Cantidad: <span className="font-bold">{it.quantity} un.</span>
                          </div>
                        </div>
                        <div className="text-right font-bold text-[#18231C]">
                          ${(price * it.quantity).toLocaleString('es-AR')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observations if any */}
              {selectedQuote.observations && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xs text-[#4A453F]">
                  <strong className="block text-[#18231C] mb-1 uppercase font-bold text-[10px]">
                    Observaciones del Cliente:
                  </strong>
                  {selectedQuote.observations}
                </div>
              )}

              {/* Totals */}
              <div className="p-4 bg-[#18231C] text-white rounded-xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#DCD4C9]/70">Total Estimado</div>
                  <div className="text-xs text-[#DCD4C9]/60">{selectedQuote.totalUnits} prendas totales</div>
                </div>
                <div className="text-xl font-bold font-display text-emerald-400">
                  ${(selectedQuote.totalEstimated || 0).toLocaleString('es-AR')}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {selectedQuote.clientPhone && (
                  <a
                    href={`https://wa.me/${selectedQuote.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(selectedQuote.clientName)},%20te%20escribimos%20de%20Pampero%20Gran%20Mendoza%20por%20tu%20cotización%20%23${selectedQuote.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs font-bold text-xs flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Contactar por WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyQuoteSummary(selectedQuote)}
                  className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] rounded-xs font-bold text-xs flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '¡Copiado!' : 'Copiar Resumen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
