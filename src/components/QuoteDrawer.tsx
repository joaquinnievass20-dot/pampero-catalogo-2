import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CartItem, UserSession, ThemeConfig, DiscountCoupon, QuantityDiscountRule } from '../types';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  MessageCircle, 
  FileSpreadsheet, 
  ShoppingBag,
  Ticket,
  Check,
  Tag,
  AlertTriangle,
  Building2,
  User,
  Copy
} from 'lucide-react';
import { trackWhatsAppQuote } from '../utils/analytics';
import { saveCRMOrder, getNextCorrelativeOrderNumber } from '../services/firebase';

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
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  try {
    const accent = theme?.accentColor || '#FDB813';
    const primaryBg = theme?.primaryColor || '#18231C';

    // Safe items sanitization
    const safeItems = Array.isArray(items)
      ? items.filter((it) => it && it.product && typeof it.product === 'object' && Number(it.quantity) > 0)
      : [];

    const isCompany = userSession?.clientType === 'empresa';
    const totalUnits = safeItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
    const qualifiesForCorporatePrice = isCompany || totalUnits > 10;

    // Price calculation with safety
    const calculateItemPrice = (item: CartItem): number => {
      try {
        const prod = item.product;
        if (!prod) return 0;

        let basePrice = Number(prod.price) || 0;
        if (item.specialSizeRange) {
          basePrice = (qualifiesForCorporatePrice && item.specialSizeRange.corporatePrice)
            ? Number(item.specialSizeRange.corporatePrice)
            : Number(item.specialSizeRange.price || item.unitPriceAdjusted || prod.price || 0);
        } else if (qualifiesForCorporatePrice && prod.corporatePrice) {
          basePrice = Number(prod.corporatePrice);
        } else if (item.unitPriceAdjusted) {
          basePrice = Number(item.unitPriceAdjusted);
        }

        // Check volume discount
        let maxDiscount = Number(prod.discountPercentage) || 0;
        if (Array.isArray(volumeDiscounts) && volumeDiscounts.length > 0) {
          for (const rule of volumeDiscounts) {
            if (!rule.active) continue;
            const catMatch = !rule.category || rule.category === 'Todas' || rule.category === prod.category;
            const subMatch = !rule.subCategory || rule.subCategory === 'Todas' || rule.subCategory === prod.subCategory;
            if (catMatch && subMatch) {
              const matchingUnits = safeItems
                .filter((it) => {
                  const p = it.product;
                  const cM = !rule.category || rule.category === 'Todas' || rule.category === p?.category;
                  const sM = !rule.subCategory || rule.subCategory === 'Todas' || rule.subCategory === p?.subCategory;
                  return cM && sM;
                })
                .reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

              if (matchingUnits >= (rule.minQuantity || 1)) {
                maxDiscount = Math.max(maxDiscount, Number(rule.discountPercentage) || 0);
              }
            }
          }
        }

        return Math.max(0, Math.round(basePrice * (1 - maxDiscount / 100)));
      } catch {
        return Number(item?.product?.price) || 0;
      }
    };

    const subtotalEstimate = safeItems.reduce((acc, item) => {
      return acc + calculateItemPrice(item) * (Number(item.quantity) || 0);
    }, 0);

    let couponDiscountAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        couponDiscountAmount = Math.round(subtotalEstimate * ((appliedCoupon.discountValue || 0) / 100));
      } else {
        couponDiscountAmount = Math.min(appliedCoupon.discountValue || 0, subtotalEstimate);
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
      const found = coupons.find((c) => c && c.code && c.code.toUpperCase() === cleanInput && (c as any).isActive !== false);
      if (!found) {
        setCouponError('Código inválido o inactivo');
        return;
      }
      setAppliedCoupon(found);
    };

    const handleRemoveCoupon = () => {
      setAppliedCoupon(null);
      setCouponCodeInput('');
      setCouponError(null);
    };

    // Text format for WhatsApp
    const buildQuoteText = (orderNumberStr?: string) => {
      const d = (userSession?.clientData || {}) as any;
      const empresa = d.companyName || (userSession?.clientType === 'empresa' ? (d.fullName || 'Empresa') : (d.fullName || 'Consumidor Final'));
      const contacto = d.fullName || (userSession?.email ? userSession.email.split('@')[0] : 'Cliente');
      const telefono = d.phone || '-';

      let text = `*SOLICITUD DE COTIZACIÓN / PEDIDO - PAMPERO GRAN MENDOZA*\n`;
      if (orderNumberStr) {
        text += `*N° DE PEDIDO:* ${orderNumberStr}\n`;
      }
      text += `\n*Cliente / Empresa:* ${empresa}\n`;
      text += `*Contacto:* ${contacto}\n`;
      text += `*Teléfono:* ${telefono}\n`;
      text += `*Total de Prendas:* ${totalUnits} unidades\n\n`;
      text += `*DETALLE DE ARTÍCULOS:*\n`;

      safeItems.forEach((it, idx) => {
        const prod = it.product;
        const code = it.codeWithSuffix || (it.specialSizeRange?.suffix ? `${prod.code}${it.specialSizeRange.suffix}` : prod.code);
        const price = calculateItemPrice(it);
        const sub = price * it.quantity;
        text += `${idx + 1}. *${prod.name}* (Cód: ${code})\n`;
        text += `   • *Color:* ${it.selectedColor || 'Estándar'}\n`;
        text += `   • *Talle:* ${it.selectedSize || 'Estándar'}\n`;
        text += `   • *Cantidad:* ${it.quantity} un. x $${price.toLocaleString('es-AR')} = $${sub.toLocaleString('es-AR')}\n\n`;
      });

      if (observations.trim()) {
        text += `*OBSERVACIONES / REQUERIMIENTOS:*\n${observations.trim()}\n\n`;
      }

      if (appliedCoupon) {
        text += `*Cupón Aplicado:* ${appliedCoupon.code} (-$${couponDiscountAmount.toLocaleString('es-AR')})\n`;
      }

      text += `*ESTIMADO TOTAL:* $${finalTotal.toLocaleString('es-AR')}\n`;
      if (orderNumberStr) {
        text += `*Seguimiento:* Tu pedido quedó registrado con el código ${orderNumberStr} en el sistema oficial.\n`;
      }
      text += `_Cotización generada desde el catálogo oficial Pampero Gran Mendoza_`;

      return text;
    };

    // Helper to get first Kanban column ID dynamically
    const getFirstKanbanColId = (): string => {
      try {
        const raw = localStorage.getItem('pampero_kanban_company_cols');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
            return parsed[0].id;
          }
        }
      } catch {}
      return 'cotizacion';
    };

    // 1. Export to Excel (.xlsx) con numeración progresiva y sincronización automática a Kanban
    const handleExportToExcel = async () => {
      if (safeItems.length === 0 || isSubmittingOrder) return;
      setIsSubmittingOrder(true);
      try {
        // Obtener número correlativo de pedido (#1, #2, #3...)
        const { number: orderNum, formatted: formattedOrderNum } = await getNextCorrelativeOrderNumber();
        const orderDocId = `PED-${orderNum}`;
        const firstColId = getFirstKanbanColId();

        // Sincronizar automáticamente con el Tablero Kanban (primera columna del tablero)
        await saveCRMOrder({
          id: orderDocId,
          orderNumber: formattedOrderNum,
          date: new Date().toISOString(),
          quoteId: formattedOrderNum,
          clientName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.companyName || 'Cliente Catálogo',
          clientPhone: (userSession?.clientData as any)?.phone || '',
          clientEmail: userSession?.email || '',
          clientType: isCompany ? 'empresa' : 'consumidor_final',
          channel: 'Excel',
          status: firstColId,
          seller: 'Sin Asignar',
          branch: 'Maipú',
          totalUnits,
          totalEstimated: finalTotal,
          observations: observations.trim(),
          items: safeItems,
        });

        const dataRows = safeItems.map((it) => {
          const prod = it.product;
          const code = it.codeWithSuffix || (it.specialSizeRange?.suffix ? `${prod.code}${it.specialSizeRange.suffix}` : prod.code);
          const price = calculateItemPrice(it);
          const sub = price * it.quantity;
          return {
            'N° Pedido': formattedOrderNum,
            'Código': code,
            'Artículo': prod.name,
            'Color Seleccionado': it.selectedColor || 'Estándar',
            'Talle Seleccionado': it.selectedSize || 'Estándar',
            'Cantidad': it.quantity,
            'Precio Unitario Estimado': price,
            'Subtotal Estimado': sub,
            'Observaciones': observations.trim() || 'N/A'
          };
        });

        // Add summary row
        dataRows.push({
          'N° Pedido': formattedOrderNum,
          'Código': 'TOTAL',
          'Artículo': 'Total General Estimado',
          'Color Seleccionado': '-',
          'Talle Seleccionado': '-',
          'Cantidad': totalUnits,
          'Precio Unitario Estimado': 0,
          'Subtotal Estimado': finalTotal,
          'Observaciones': observations.trim() || ''
        });

        const worksheet = XLSX.utils.json_to_sheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Pedido ${formattedOrderNum}`);

        // Column widths
        worksheet['!cols'] = [
          { wch: 14 },
          { wch: 15 },
          { wch: 35 },
          { wch: 20 },
          { wch: 18 },
          { wch: 10 },
          { wch: 22 },
          { wch: 22 },
          { wch: 40 },
        ];

        const dateStr = new Date().toISOString().split('T')[0];
        const cleanNum = formattedOrderNum.replace(/[^0-9]/g, '');
        XLSX.writeFile(workbook, `Pedido_Pampero_${cleanNum}_${dateStr}.xlsx`);

        setOrderNotice(`¡Pedido ${formattedOrderNum} generado en Excel y sincronizado en el tablero de Gestión!`);
        setTimeout(() => setOrderNotice(null), 5000);
      } catch (err: any) {
        console.error('Error exportando Excel:', err);
        setOrderNotice(`Error al generar Excel: ${err?.message || 'Fallo inesperado'}`);
        setTimeout(() => setOrderNotice(null), 5000);
      } finally {
        setIsSubmittingOrder(false);
      }
    };

    // 2. Send via WhatsApp con numeración progresiva y sincronización automática a Kanban
    const handleSendWhatsApp = async () => {
      if (safeItems.length === 0 || isSubmittingOrder) return;
      setIsSubmittingOrder(true);
      try {
        trackWhatsAppQuote({
          totalUnits,
          totalEstimated: finalTotal,
          itemCount: safeItems.length,
          clientType: userSession?.clientType || 'consumidor_final',
          clientName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.companyName,
          hasCoupon: Boolean(appliedCoupon),
        });

        // Obtener número correlativo progresivo (#1, #2, #3...)
        const { number: orderNum, formatted: formattedOrderNum } = await getNextCorrelativeOrderNumber();
        const orderDocId = `PED-${orderNum}`;
        const firstColId = getFirstKanbanColId();

        // Sincronizar automáticamente con el Tablero Kanban (primera columna del tablero)
        await saveCRMOrder({
          id: orderDocId,
          orderNumber: formattedOrderNum,
          date: new Date().toISOString(),
          quoteId: formattedOrderNum,
          clientName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.companyName || 'Cliente Catálogo',
          clientPhone: (userSession?.clientData as any)?.phone || '',
          clientEmail: userSession?.email || '',
          clientType: isCompany ? 'empresa' : 'consumidor_final',
          channel: 'WhatsApp',
          status: firstColId,
          seller: 'Sin Asignar',
          branch: 'Maipú',
          totalUnits,
          totalEstimated: finalTotal,
          observations: observations.trim(),
          items: safeItems,
        });

        const text = buildQuoteText(formattedOrderNum);
        const rawPhone = theme?.whatsappNumber || '5492615276713';
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

        setOrderNotice(`¡Pedido ${formattedOrderNum} vinculado al Tablero Kanban de Gestión!`);
        setTimeout(() => setOrderNotice(null), 5000);

        // Open WhatsApp
        if (typeof window !== 'undefined') {
          const opened = window.open(whatsappUrl, '_blank');
          if (!opened) {
            window.location.href = whatsappUrl;
          }
        }
      } catch (err: any) {
        console.error('Error enviando a WhatsApp:', err);
        setOrderNotice(`Error enviando a WhatsApp: ${err?.message || 'Fallo inesperado'}`);
        setTimeout(() => setOrderNotice(null), 5000);
      } finally {
        setIsSubmittingOrder(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
        <div 
          id="quote-cart-drawer"
          className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#DCD4C9]"
        >
          {/* Header */}
          <div 
            style={{ backgroundColor: primaryBg }}
            className="p-4 sm:p-5 flex items-center justify-between text-white border-b border-black/40 shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5" style={{ color: accent }} />
              <div>
                <h3 className="font-display font-bold text-lg uppercase tracking-wider leading-tight">Mi Pedido</h3>
                <p className="text-[11px] text-neutral-300 font-sans">
                  {totalUnits} {totalUnits === 1 ? 'artículo en la lista' : 'artículos en la lista'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1.5 rounded-xs hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar pedido"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Client badge if logged in */}
          {userSession?.clientData && (
            <div className="bg-[#FAF8F5] px-4 py-2 text-xs text-[#6F6860] flex items-center justify-between border-b border-[#DCD4C9] shrink-0">
              <div className="flex items-center gap-1.5 font-medium truncate">
                {isCompany ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                    <span className="truncate font-semibold text-[#18231C]">
                      {(userSession.clientData as any).companyName || 'Empresa'}
                    </span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                    <span className="truncate font-semibold text-[#18231C]">
                      {(userSession.clientData as any).fullName || 'Cliente'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#18231C] bg-[#ECE5DC] px-2 py-0.5 rounded-xs">
                {isCompany ? 'Tarifa Empresa' : 'Consumidor'}
              </span>
            </div>
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {safeItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6F6860]">
                <ShoppingBag className="w-12 h-12 mb-3 stroke-[1.5] opacity-40 text-[#18231C]" />
                <p className="font-bold text-[#18231C] text-sm uppercase tracking-wider">Tu pedido está vacío</p>
                <p className="text-xs text-[#6F6860] mt-1 max-w-[240px]">
                  Explorá el catálogo Pampero y agregá los artículos que necesites cotizar.
                </p>
              </div>
            ) : (
              safeItems.map((item, idx) => {
                const prod = item.product;
                const unitPrice = calculateItemPrice(item);
                const displayCode = item.codeWithSuffix || (item.specialSizeRange?.suffix ? `${prod.code}${item.specialSizeRange.suffix}` : prod.code);

                return (
                  <div
                    key={`${prod.id}-${item.selectedColor}-${item.selectedSize}-${idx}`}
                    className="bg-[#FAF8F5] rounded-xs p-3 border border-[#DCD4C9] flex gap-3 items-center hover:border-[#18231C]/30 transition-colors shadow-2xs"
                  >
                    <img
                      src={prod.image || '/logo.png'}
                      alt={prod.name}
                      className="w-16 h-16 object-cover rounded-xs border border-[#DCD4C9] shrink-0 bg-white"
                      onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-[#18231C] truncate uppercase">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] text-[#6F6860]">
                        Cód: <span className="font-semibold text-[#18231C]">{displayCode}</span>
                      </p>

                      {/* Prominent Color and Size badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#18231C] text-white text-[10px] font-bold">
                          <span>Color:</span>
                          <strong className="text-amber-300">{item.selectedColor || 'Único'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-bold">
                          <span>Talle:</span>
                          <strong className="text-[#18231C]">{item.selectedSize || 'Estándar'}</strong>
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[#18231C] mt-1.5">
                        ${(unitPrice * item.quantity).toLocaleString('es-AR')}{' '}
                        <span className="text-[10px] text-[#6F6860] font-normal">
                          (${unitPrice.toLocaleString('es-AR')} c/u)
                        </span>
                      </div>
                    </div>

                    {/* Quantity & Delete Controls */}
                    <div className="flex flex-col items-end justify-between h-full gap-2">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(prod.id, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                        className="text-neutral-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                        title="Eliminar artículo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* + and - controls */}
                      <div className="flex items-center border border-[#DCD4C9] rounded-xs bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(prod.id, -1, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                          className="w-7 h-7 flex items-center justify-center text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold cursor-pointer transition-colors"
                          title="Restar cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-black text-[#18231C] min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(prod.id, 1, item.selectedColor, item.selectedSize, item.codeWithSuffix)}
                          className="w-7 h-7 flex items-center justify-center text-[#18231C] hover:bg-[#ECE5DC] text-xs font-bold cursor-pointer transition-colors"
                          title="Sumar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Observaciones and Two Main Action Buttons */}
          {safeItems.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[#DCD4C9] bg-[#FAF8F5] space-y-3.5 shrink-0 max-h-[50vh] overflow-y-auto">
              {/* Observaciones textarea */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A453F] mb-1 flex items-center justify-between">
                  <span>Observaciones del Pedido</span>
                  <span className="text-[9px] text-[#8C827A] normal-case font-normal">(especificaciones, bordados, talles especiales...)</span>
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ej: Bordado de logo Pampero en pecho izquierdo, solicitud de muestra física, plazos de entrega..."
                  rows={2}
                  className="w-full p-2.5 bg-white border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] placeholder-[#A89F91] focus:border-[#FDB813] outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Coupon Box */}
              <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Cupón {appliedCoupon.code} aplicado</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[10px] text-red-600 hover:underline font-semibold"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      placeholder="Cupón de descuento"
                      className="flex-1 px-2.5 py-1 text-xs font-mono font-bold uppercase bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs hover:bg-black transition-colors"
                    >
                      Aplicar
                    </button>
                  </form>
                )}
                {couponError && <p className="text-[10px] text-red-600 mt-1">{couponError}</p>}
              </div>

              {/* Totals */}
              <div className="flex justify-between items-baseline pt-1 border-t border-[#DCD4C9]">
                <div>
                  <span className="text-xs font-bold text-[#18231C] uppercase tracking-wider block">
                    Total Estimado
                  </span>
                  <span className="text-[10px] text-[#6F6860]">
                    {totalUnits} prendas cotizadas
                  </span>
                </div>
                <span className="text-2xl font-black text-[#18231C]">
                  ${finalTotal.toLocaleString('es-AR')}
                </span>
              </div>

              {/* Two Main Action Buttons: Pasar a Excel and Pasar pedido al WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* 1. Pasar a Excel */}
                <button
                  type="button"
                  id="btn-pasar-a-excel"
                  onClick={handleExportToExcel}
                  className="w-full py-3 px-3 rounded-xs font-bold text-xs bg-[#1E7145] hover:bg-[#155734] text-white shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider transition-all cursor-pointer"
                  title="Descargar lista de pedido en planilla Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Pasar a Excel</span>
                </button>

                {/* 2. Pasar pedido al WhatsApp */}
                <button
                  type="button"
                  id="btn-pasar-pedido-whatsapp"
                  onClick={handleSendWhatsApp}
                  className="w-full py-3 px-3 rounded-xs font-bold text-xs bg-[#25D366] hover:bg-[#20BA5A] text-white shadow-sm flex items-center justify-center gap-1.5 uppercase tracking-wider transition-all cursor-pointer"
                  title="Enviar pedido con formato completo a WhatsApp"
                >
                  <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                  <span>Pasar a WhatsApp</span>
                </button>
              </div>

              <div className="flex justify-between items-center pt-1 text-[11px] text-[#6F6860]">
                <button
                  type="button"
                  onClick={onClear}
                  className="hover:text-red-700 underline cursor-pointer"
                >
                  Vaciar pedido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildQuoteText());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="hover:text-[#18231C] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? '¡Copiado!' : 'Copiar texto'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } catch (err: any) {
    console.error('[QUOTE DRAWER CRASH SAFEGUARD]', err);
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="font-bold text-base text-[#18231C]">Mi Pedido</h3>
              <button onClick={onClose} className="p-1 text-neutral-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xs text-xs text-amber-900 mt-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 mb-1" />
              <p className="font-bold">Se recuperó el carrito con seguridad.</p>
              <p className="mt-1">Podés vaciar la lista o cerrarla para continuar navegando normalmente.</p>
            </div>
          </div>
          <button
            onClick={() => { onClear(); onClose(); }}
            className="w-full py-2.5 bg-red-600 text-white rounded-xs text-xs font-bold uppercase"
          >
            Reiniciar Carrito
          </button>
        </div>
      </div>
    );
  }
};
