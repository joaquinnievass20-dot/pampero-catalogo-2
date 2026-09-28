import React, { useState, useMemo } from 'react';
import { CartItem, UserSession, ThemeConfig, DiscountCoupon, QuantityDiscountRule } from '../types';
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
  FileText,
  TrendingDown,
} from 'lucide-react';
import { trackWhatsAppQuote } from '../utils/analytics';
import { saveCRMOrder } from '../services/firebase';

interface QuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, delta: number, color?: string, size?: string, codeWithSuffix?: string) => void;
  onRemoveItem: (productId: string, color?: string, size?: string, codeWithSuffix?: string) => void;
  onClear: () => void;
  userSession: UserSession | null;
  theme: ThemeConfig;
  coupons?: DiscountCoupon[];
  volumeDiscounts?: QuantityDiscountRule[];
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
  volumeDiscounts = [],
}) => {
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Sanitize items list to prevent crashes if an item or product is corrupted in localStorage
  const safeItems = (items || []).filter((it) => it && it.product && typeof it.product === 'object' && it.quantity > 0);

  const isCompany = userSession?.clientType === 'empresa';
  const targetEmail = theme?.screenTexts?.quoteEmail || 'ventas@pamperomaipu.com.ar';

  const totalUnits = safeItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  const qualifiesForCorporatePrice = isCompany || totalUnits > 10;

  // Base item price taking into account special sizes and corporate tier
  const calculateItemBasePrice = (item: CartItem) => {
    if (!item?.product) return 0;
    if (item.specialSizeRange) {
      return (qualifiesForCorporatePrice && item.specialSizeRange.corporatePrice)
        ? Number(item.specialSizeRange.corporatePrice)
        : Number(item.specialSizeRange.price || item.unitPriceAdjusted || item.product.price || 0);
    }
    return (qualifiesForCorporatePrice && item.product.corporatePrice)
      ? Number(item.product.corporatePrice)
      : Number(item.unitPriceAdjusted || item.product.price || 0);
  };

  // Check applicable volume discount percentage for an item
  const getItemVolumeDiscountPercent = (item: CartItem) => {
    if (!volumeDiscounts || volumeDiscounts.length === 0 || !item?.product) return 0;
    const applicableRules = volumeDiscounts.filter((rule) => {
      if (!rule.active) return false;
      const catMatch = !rule.category || rule.category === 'Todas' || rule.category === item.product?.category;
      const subMatch = !rule.subCategory || rule.subCategory === 'Todas' || rule.subCategory === item.product?.subCategory;
      if (!catMatch || !subMatch) return false;

      // Count units in cart matching rule's scope
      const matchingUnits = safeItems
        .filter((it) => {
          const cM = !rule.category || rule.category === 'Todas' || rule.category === it.product?.category;
          const sM = !rule.subCategory || rule.subCategory === 'Todas' || rule.subCategory === it.product?.subCategory;
          return cM && sM;
        })
        .reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

      return matchingUnits >= rule.minQuantity;
    });

    if (applicableRules.length === 0) return 0;
    return Math.max(...applicableRules.map((r) => r.discountPercentage || 0));
  };

  // Final unit price with best discount
  const calculateItemPrice = (item: CartItem) => {
    const base = calculateItemBasePrice(item);
    const prodDiscount = item?.product?.discountPercentage || 0;
    const volDiscount = getItemVolumeDiscountPercent(item);
    const effectiveDiscount = Math.max(prodDiscount, volDiscount);
    return Math.round(base * (1 - effectiveDiscount / 100));
  };

  // Active volume discount rules currently triggered
  const activeVolumeRules = useMemo(() => {
    if (!volumeDiscounts || volumeDiscounts.length === 0) return [];
    return volumeDiscounts.filter((rule) => {
      if (!rule.active) return false;
      const matchingUnits = safeItems
        .filter((it) => {
          const cM = !rule.category || rule.category === 'Todas' || rule.category === it.product?.category;
          const sM = !rule.subCategory || rule.subCategory === 'Todas' || rule.subCategory === it.product?.subCategory;
          return cM && sM;
        })
        .reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      return matchingUnits >= rule.minQuantity;
    });
  }, [volumeDiscounts, safeItems]);

  const subtotalEstimate = safeItems.reduce((acc, item) => {
    return acc + calculateItemPrice(item) * (Number(item.quantity) || 0);
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

    const found = coupons.find((c) => c.code.toUpperCase() === cleanInput && (c as any).isActive !== false);
    if (!found) {
      setCouponError('Código inválido o inactivo');
      return;
    }

    // Check expiration
    const today = new Date().toISOString().split('T')[0];
    const exp = found.expiresAt || (found as any).expirationDate;
    if (exp && exp < today) {
      setCouponError(`El cupón venció el ${exp}`);
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
    safeItems.forEach((it) => {
      const unitPrice = calculateItemPrice(it);
      const code = it.codeWithSuffix || (it.specialSizeRange?.suffix ? `${it.product?.code || ''}${it.specialSizeRange.suffix}` : (it.product?.code || ''));
      itemsList += `${it.product?.name || 'Artículo'} (Cód: ${code})\n` +
        `• Cantidad: ${it.quantity} un.\n` +
        `• Talle: ${it.selectedSize || 'Estándar'} | Color: ${it.selectedColor || 'Estándar'}\n` +
        `• Estimado Unit: $${unitPrice.toLocaleString('es-AR')}\n\n`;
    });

    const obsText = `OBSERVACIONES / REQUERIMIENTOS:\n` +
      `${observations.trim() || 'Sin observaciones adicionales'}\n\n`;

    const subtotalText = `SUBTOTAL ESTIMADO: $${finalTotal.toLocaleString('es-AR')}\n` +
      `(Sin impuestos nacionales discriminados)\n\n` +
      `Enviado desde Catálogo Oficial Pampero Gran Mendoza (${targetEmail})`;

    return header + itemsList + obsText + subtotalText;
  };

  const handleSendWhatsAppQuote = () => {
    if (items.length === 0) return;

    // Track Vercel Analytics event
    trackWhatsAppQuote({
      totalUnits,
      totalEstimated: finalTotal,
      itemCount: items.length,
      clientType: userSession?.clientType || 'consumidor_final',
      clientName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.companyName,
      hasCoupon: Boolean(appliedCoupon),
    });

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

      // GUARDADO EN FIREBASE PARA EL NUEVO CRM KANBAN
      saveCRMOrder({
        id: quoteId,
        date: new Date().toISOString(),
        quoteId: quoteId,
        clientName: quoteRecord.clientName,
        clientType: quoteRecord.clientType,
        status: 'cotizacion',
        seller: 'Sin Asignar',
        branch: 'Sin Asignar',
        totalUnits: totalUnits,
        totalEstimated: finalTotal,
        observations: observations.trim(),
        items: items,
      });
    } catch {}

    // Empty cart and redirect to WhatsApp
    onClear();
    try {
      if (typeof window !== 'undefined') {
        const opened = window.open(whatsappUrl, '_blank');
        if (!opened) {
          window.location.href = whatsappUrl;
        }
      }
    } catch (err) {
      console.warn('Could not launch WhatsApp URL:', err);
    }
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
              <h3 className="font-display text-lg uppercase tracking-wider leading-tight">Mi Pedido</h3>
              <p className="text-[11px] opacity-75 font-sans">
                {totalUnits} {totalUnits === 1 ? 'artículo en tu pedido' : 'artículos en tu pedido'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="opacity-75 hover:opacity-100 p-1.5 rounded-xs hover:bg-white/10 transition-colors"
            aria-label="Cerrar Mi Pedido"
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

        {/* Active Volume Discounts Notice */}
        {activeVolumeRules.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-900 text-xs">
            <TrendingDown className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">¡Descuento por Volumen Activado! </span>
              <span className="text-amber-800">
                {activeVolumeRules[0].name} ({activeVolumeRules[0].discountPercentage}% OFF al superar {activeVolumeRules[0].minQuantity} prendas)
              </span>
            </div>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {safeItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6F6860]">
              <ShoppingBag className="w-12 h-12 mb-3 stroke-[1.5] opacity-40 text-[#18231C]" />
              <p className="font-bold text-[#18231C] text-sm uppercase tracking-wider">Tu lista de cotización está vacía</p>
              <p className="text-xs text-[#6F6860] mt-1 max-w-[240px]">
                Explorá el catálogo Pampero y agregá los artículos que desees cotizar.
              </p>
            </div>
          ) : (
            safeItems.map((item, idx) => {
              const unitPrice = calculateItemPrice(item);
              const displayCode = item.codeWithSuffix || (item.specialSizeRange?.suffix ? `${item.product?.code || ''}${item.specialSizeRange.suffix}` : (item.product?.code || ''));
              return (
                <div
                  key={`${item.product?.id || idx}-${item.selectedSize}-${item.selectedColor}-${idx}`}
                  className="bg-[#FAF8F5] rounded-xs p-3 border border-[#DCD4C9] flex gap-3 items-center"
                >
                  <img
                    src={item.product?.image || '/logo.png'}
                    alt={item.product?.name || 'Artículo'}
                    className="w-14 h-14 object-cover rounded-xs border border-[#DCD4C9] shrink-0 bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-[#18231C] truncate uppercase">
                      {item.product?.name || 'Artículo Pampero'}
                    </h4>
                    <p className="text-[11px] text-[#6F6860]">
                      Cód: <span className="font-semibold text-[#18231C]">{displayCode}</span>
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#6F6860] mt-0.5">
                      <span>Talle: <strong className="text-neutral-900">{item.selectedSize || 'U'}</strong></span>
                      <span>·</span>
                      <span>Color: <strong className="text-neutral-900">{item.selectedColor || '-'}</strong></span>
                      {item.specialSizeRange && (
                        <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded-xs border border-amber-300">
                          Talle Esp. ({item.specialSizeRange.suffix})
                        </span>
                      )}
                    </div>
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
                      onClick={() => onRemoveItem(item?.product?.id || (item as any)?.id, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                      className="text-[#6F6860] hover:text-red-600 p-1 cursor-pointer"
                      title="Eliminar artículo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center border border-[#DCD4C9] rounded-xs bg-white">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item?.product?.id || (item as any)?.id, -1, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                        className="px-2 py-0.5 text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-[#18231C]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item?.product?.id || (item as any)?.id, 1, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                        className="px-2 py-0.5 text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold cursor-pointer"
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

              {activeVolumeRules.length > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-800 font-semibold">
                  <span>Descuento por Volumen ({activeVolumeRules[0].name})</span>
                  <span>{activeVolumeRules[0].discountPercentage}% OFF</span>
                </div>
              )}

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

