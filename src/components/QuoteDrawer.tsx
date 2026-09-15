import React, { useState } from 'react';
import { CartItem, UserSession, ThemeConfig, DiscountCoupon } from '../types';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  MessageCircle, 
  Building2, 
  User, 
  ShoppingBag,
  Ticket,
  Check,
  Tag,
  Copy,
  FileText
} from 'lucide-react';

interface QuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  userSession: UserSession | null;
  theme: ThemeConfig;
  coupons?: DiscountCoupon[];
}

export const QuoteDrawer: React.FC<QuoteDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClear,
  userSession,
  theme,
  coupons = [],
}) => {
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isCompany = userSession?.clientType === 'empresa';
  const targetEmail = theme.screenTexts?.quoteEmail || 'ventas@pamperomaipu.com.ar';

  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
  const qualifiesForCorporatePrice = isCompany || totalUnits > 10;

  const calculateItemPrice = (item: CartItem) => {
    const base = qualifiesForCorporatePrice && item.product.corporatePrice 
      ? item.product.corporatePrice 
      : item.product.price;
    const discount = item.product.discountPercentage || 0;
    return Math.round(base * (1 - discount / 100));
  };

  const subtotalEstimate = items.reduce((acc, item) => {
    return acc + calculateItemPrice(item) * item.quantity;
  }, 0);

  // Calculate discount from applied coupon
  let couponDiscountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'percentage') {
      couponDiscountAmount = Math.round(subtotalEstimate * (appliedCoupon.discountValue / 100));
    } else {
      couponDiscountAmount = Math.min(appliedCoupon.discountValue, subtotalEstimate);
    }
  }

  const finalTotal = Math.max(0, subtotalEstimate - couponDiscountAmount);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);

    const cleanInput = couponCodeInput.trim().toUpperCase();
    if (!cleanInput) {
      setCouponError('Ingresá un código');
      return;
    }

    const found = coupons.find((c) => c.code.toUpperCase() === cleanInput && c.active);
    if (!found) {
      setCouponError('Código inválido o inactivo');
      return;
    }

    // Check expiration
    const today = new Date().toISOString().split('T')[0];
    if (found.expirationDate && found.expirationDate < today) {
      setCouponError(`El cupón venció el ${found.expirationDate}`);
      return;
    }

    // Check minimum order amount
    if (found.minOrderAmount && subtotalEstimate < found.minOrderAmount) {
      setCouponError(`Monto mínimo requerido: $${found.minOrderAmount.toLocaleString('es-AR')}`);
      return;
    }

    setAppliedCoupon(found);
    setCouponError(null);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
  };

  // Generate clean text summary of the quote matching exact required structure
  const buildQuoteText = () => {
    const d = userSession?.clientData as any;

    const empresa = d?.companyName || (userSession?.clientType === 'empresa' ? (d?.fullName || 'Empresa') : (d?.fullName || 'Consumidor Final'));
    const representante = d?.repFullName || d?.fullName || (userSession?.email ? userSession.email.split('@')[0] : 'Cliente');
    const cuit = d?.cuit || (userSession?.clientType === 'empresa' ? '-' : 'Consumidor Final');
    const email = d?.institutionalEmail || d?.email || userSession?.email || '-';
    const telefono = d?.institutionalPhone || d?.phone || '-';

    let direccion = '-';
    if (d?.address) {
      if (typeof d.address === 'string' && d.address.trim()) {
        direccion = d.address.trim();
      } else if (typeof d.address === 'object') {
        const parts = [
          d.address.street,
          d.address.number,
          d.address.city ? `(${d.address.city})` : '',
        ].filter(Boolean);
        if (parts.length > 0) direccion = parts.join(' ');
      }
    }

    const header = `SOLICITUD DE COTIZACIÓN CORPORATIVA - PAMPERO GRAN MENDOZA\n` +
      `Empresa: ${empresa}\n` +
      `Representante: ${representante}\n` +
      `CUIT: ${cuit}\n` +
      `Email Institucional: ${email}\n` +
      `Teléfono: ${telefono}\n` +
      `Dirección: ${direccion}\n\n`;

    let itemsList = `DETALLE DE ARTÍCULOS COTIZADOS (${totalUnits} unidades en total):\n\n`;
    items.forEach((it) => {
      const unitPrice = calculateItemPrice(it);
      itemsList += `${it.product.name} (Cód: ${it.product.code})\n` +
        `• Cantidad: ${it.quantity} un.\n` +
        `• Talle: ${it.selectedSize || 'Estándar'} | Color: ${it.selectedColor || 'Estándar'}\n` +
        `• Estimado Unit: $${unitPrice.toLocaleString('es-AR')}\n\n`;
    });

    const obsText = `OBSERVACIONES / REQUERIMIENTOS:\n` +
      `${observations.trim() || 'Sin observaciones adicionales'}\n\n`;

    const subtotalText = `SUBTOTAL ESTIMADO: $${subtotalEstimate.toLocaleString('es-AR')}\n` +
      `(Sin impuestos nacionales discriminados)\n\n` +
      `Enviado desde Catálogo Oficial Pampero Gran Mendoza (ventas@pamperomaipu.com.ar)`;

    return header + itemsList + obsText + subtotalText;
  };

  const handleSendWhatsAppQuote = () => {
    if (items.length === 0) return;

    // Build the formatted text
    const messageText = buildQuoteText();
    const encoded = encodeURIComponent(messageText);
    const rawPhone = '5492615276713';
    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encoded}`;

    // Record quote in history for customer reference
    const quoteId = `COT-WA-${Date.now().toString().slice(-6)}`;
    const userKey = userSession?.email ? userSession.email.toLowerCase().trim() : 'guest';
    const userHistoryKey = `pampero_quote_history_${userKey}`;
    const quoteRecord = {
      id: quoteId,
      date: new Date().toISOString(),
      clientName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.companyName || 'Cliente Pampero',
      clientEmail: userSession?.email || (userSession?.clientData as any)?.institutionalEmail || 'ventas@pamperomaipu.com.ar',
      clientType: userSession?.clientType || 'consumidor_final',
      items: [...items],
      totalUnits,
      totalEstimated: finalTotal,
      observations: observations.trim(),
      status: 'enviada_whatsapp',
    };

    try {
      const userHistory = JSON.parse(localStorage.getItem(userHistoryKey) || '[]');
      userHistory.unshift(quoteRecord);
      localStorage.setItem(userHistoryKey, JSON.stringify(userHistory));

      const adminQuotes = JSON.parse(localStorage.getItem('pampero_received_quotes') || '[]');
      adminQuotes.unshift(quoteRecord);
      localStorage.setItem('pampero_received_quotes', JSON.stringify(adminQuotes));
    } catch {}

    // Empty cart and redirect to WhatsApp
    onClear();
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(buildQuoteText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        id="quote-cart-drawer"
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#DCD4C9]"
      >
        {/* Header matching Pampero brand */}
        <div 
          style={{
            backgroundColor: theme.primaryColor || '#18231C',
            color: theme.headerTextColor || '#F5F2EC'
          }}
          className="p-4 sm:p-5 flex items-center justify-between border-b border-black/40"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5" style={{ color: theme.iconColor || theme.accentColor || '#FDB813' }} />
            <div>
              <h3 className="font-display text-lg uppercase tracking-wider leading-tight">Lista de Cotización</h3>
              <p className="text-[11px] opacity-75 font-sans">
                {totalUnits} {totalUnits === 1 ? 'artículo seleccionado' : 'artículos seleccionados'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="opacity-75 hover:opacity-100 p-1.5 rounded-xs hover:bg-white/10 transition-colors"
            aria-label="Cerrar lista de cotización"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client identity badge */}
        {userSession?.clientData && (
          <div className="bg-[#FAF8F5] px-4 py-2 text-xs text-[#6F6860] flex items-center justify-between border-b border-[#DCD4C9]">
            <div className="flex items-center gap-1.5 font-medium truncate">
              {isCompany ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                  <span className="truncate font-semibold text-[#18231C]">{(userSession.clientData as any).companyName}</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 shrink-0" style={{ color: theme.iconColor || theme.accentColor || '#FDB813' }} />
                  <span className="truncate font-semibold text-[#18231C]">{(userSession.clientData as any).fullName}</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#18231C] bg-[#ECE5DC] px-2 py-0.5 rounded-xs">
              {isCompany ? 'Tarifa Empresa' : 'Consumidor'}
            </span>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6F6860]">
              <ShoppingBag className="w-12 h-12 mb-3 stroke-[1.5] opacity-40 text-[#18231C]" />
              <p className="font-bold text-[#18231C] text-sm uppercase tracking-wider">Tu lista de cotización está vacía</p>
              <p className="text-xs text-[#6F6860] mt-1 max-w-[240px]">
                Explorá el catálogo Pampero y agregá los artículos que desees cotizar.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const unitPrice = calculateItemPrice(item);
              return (
                <div
                  key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`}
                  className="bg-[#FAF8F5] rounded-xs p-3 border border-[#DCD4C9] flex gap-3 items-center"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-14 h-14 object-cover rounded-xs border border-[#DCD4C9] shrink-0 bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-[#18231C] truncate uppercase">
                      {item.product.name}
                    </h4>
                    <p className="text-[11px] text-[#6F6860]">
                      Talle: {item.selectedSize || 'U'} · Color: {item.selectedColor || '-'}
                    </p>
                    <div className="text-xs font-bold text-[#18231C] mt-0.5">
                      ${(unitPrice * item.quantity).toLocaleString('es-AR')}{' '}
                      <span className="text-[10px] text-[#6F6860] font-normal">
                        (${unitPrice.toLocaleString('es-AR')} c/u)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.product.id)}
                      className="text-[#6F6860] hover:text-red-600 p-1"
                      title="Eliminar artículo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center border border-[#DCD4C9] rounded-xs bg-white">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.product.id, -1)}
                        className="px-2 py-0.5 text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-[#18231C]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.product.id, 1)}
                        className="px-2 py-0.5 text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Coupon & Send inquiry */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#DCD4C9] bg-[#FAF8F5] space-y-3">
            
            {/* Coupon Application Box */}
            <div className="p-3 bg-white border border-[#DCD4C9] rounded-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5" style={{ color: theme.iconColor || theme.accentColor || '#FDB813' }} />
                  Código de Descuento
                </span>
                {appliedCoupon && (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-[10px] text-red-600 hover:underline font-semibold"
                  >
                    Quitar cupón
                  </button>
                )}
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-xs text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-mono font-bold text-emerald-900">{appliedCoupon.code}</span>
                      {appliedCoupon.assignedCompany && (
                        <span className="text-[10px] text-emerald-700 ml-1.5">
                          ({appliedCoupon.assignedCompany})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700">
                    -{appliedCoupon.discountType === 'percentage'
                      ? `${appliedCoupon.discountValue}%`
                      : `$${appliedCoupon.discountValue.toLocaleString('es-AR')}`}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="Ej: edemsa12026"
                    className="flex-1 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold uppercase text-[#18231C] focus:border-[#FDB813] outline-none"
                  />
                  <button
                    type="submit"
                    style={{
                      backgroundColor: theme.primaryColor || '#18231C',
                      color: theme.buttonTextColor || '#F5F2EC'
                    }}
                    className="px-3 py-1.5 hover:brightness-110 text-xs font-bold uppercase tracking-wider rounded-xs transition-colors"
                  >
                    Aplicar
                  </button>
                </form>
              )}

              {couponError && (
                <p className="text-[10px] text-red-600 font-semibold">{couponError}</p>
              )}
            </div>

            {/* OBSERVACIONES / REQUERIMIENTOS ESPECIALES */}
            <div className="pt-2 border-t border-[#DCD4C9]">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A453F] mb-1.5 flex items-center justify-between">
                <span>Observaciones para la cotización</span>
                <span className="text-[9px] text-[#8C827A] normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: Bordado de logo empresarial, solicitud de muestra física, plazos de entrega, talles especiales..."
                rows={2}
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] placeholder-[#A89F91] focus:border-[#FDB813] outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Corporate Price Notice for >10 items */}
            {qualifiesForCorporatePrice && !isCompany && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xs text-xs text-amber-900 my-2">
                <Tag className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-bold">¡Precios Corporativos / Mayoristas Aplicados!</span>
                  <p className="text-[11px] text-amber-800">Al superar las 10 prendas en total ({totalUnits} unidades), accedés a lista de precios empresa.</p>
                </div>
              </div>
            )}

            {/* Total Breakdown */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs text-[#6F6860]">
                <span>Subtotal Estimado</span>
                <span className="font-semibold text-[#18231C]">${subtotalEstimate.toLocaleString('es-AR')}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold">
                  <span>Descuento Cupón ({appliedCoupon.code})</span>
                  <span>-${couponDiscountAmount.toLocaleString('es-AR')}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-[#DCD4C9]">
                <span className="text-xs font-bold text-[#18231C] uppercase tracking-wider">
                  Total Final Estimado
                </span>
                <span className="text-2xl font-bold text-[#18231C]">
                  ${finalTotal.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* ACTION BUTTON: Solicitar Cotización por WhatsApp */}
            <div className="space-y-2 pt-1">
              <button
                id="btn-solicitar-cotizacion-whatsapp"
                type="button"
                onClick={handleSendWhatsAppQuote}
                style={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF'
                }}
                className="w-full py-3.5 px-4 rounded-xs font-bold text-xs shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 uppercase tracking-[0.16em] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white text-[#25D366]" />
                <span>Solicitar Cotización por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="w-full py-2 px-4 border border-[#DCD4C9] hover:border-[#18231C] text-[#6F6860] hover:text-[#18231C] text-[11px] font-semibold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar texto para enviar manualmente'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClear}
              className="w-full text-center text-[11px] text-[#6F6860] hover:text-[#18231C] py-1 uppercase tracking-wider font-semibold cursor-pointer"
            >
              Vaciar lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
