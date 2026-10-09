import React, { useState } from 'react';
import { DiscountCoupon } from '../../types';
import { 
  Ticket, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Calendar, 
  Building2, 
  DollarSign, 
  Percent,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface AdminCouponsTabProps {
  coupons: DiscountCoupon[];
  onUpdateCoupons: (coupons: DiscountCoupon[]) => void;
  triggerSaveNotice: () => void;
}

export const AdminCouponsTab: React.FC<AdminCouponsTabProps> = ({
  coupons,
  onUpdateCoupons,
  triggerSaveNotice,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState(15);
  const [expirationDate, setExpirationDate] = useState('2026-12-31');
  const [assignedCompany, setAssignedCompany] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);

  const handleOpenCreate = (presetCompany?: string) => {
    setCode(presetCompany ? `${presetCompany.toLowerCase()}2026` : '');
    setType('percentage');
    setValue(15);
    setExpirationDate('2026-12-31');
    setAssignedCompany(presetCompany || '');
    setMinOrderAmount(undefined);
    setMaxUses(undefined);
    setIsCreating(true);
  };

  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      alert('Por favor ingresá un código de cupón.');
      return;
    }

    if (coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      alert(`El código "${cleanCode}" ya existe. Por favor utilizá otro código único.`);
      return;
    }

    const newCoupon: DiscountCoupon = {
      id: 'coupon-' + Date.now(),
      code: cleanCode,
      discountType: type,
      discountValue: Number(value),
      expirationDate,
      assignedCompany: assignedCompany.trim() || undefined,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      usedCount: 0,
      active: true,
    };

    onUpdateCoupons([newCoupon, ...coupons]);
    setIsCreating(false);
    triggerSaveNotice();
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Desea eliminar este código de descuento?')) {
      onUpdateCoupons(coupons.filter((c) => c.id !== id));
      triggerSaveNotice();
    }
  };

  const toggleActive = (id: string) => {
    const updated = coupons.map((c) =>
      c.id === id ? { ...c, active: !c.active } : c
    );
    onUpdateCoupons(updated);
    triggerSaveNotice();
  };

  const handleCopy = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F5F2EC] rounded-xs border border-[#DCD4C9]">
        <div>
          <h3 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#B9522F]" />
            Generador de Códigos de Descuento Únicos
          </h3>
          <p className="text-xs text-[#6F6860]">
            Creá cupones personalizados para empresas (ej: <code className="bg-white px-1 py-0.5 border text-[#18231C]">edemsa12026</code>) con fecha de vencimiento y porcentaje o monto fijo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenCreate()}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#B9522F]" />
          Crear Código Único
        </button>
      </div>

      {/* Creation Modal / Form */}
      {isCreating && (
        <div className="bg-white p-5 sm:p-6 rounded-xs border-2 border-[#B9522F] shadow-lg space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                Generar Nuevo Código de Descuento
              </h4>
              <p className="text-xs text-[#6F6860]">
                Definí el código, la empresa beneficiaria, el beneficio y el tiempo de vigencia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-[#6F6860] hover:text-[#18231C] font-semibold"
            >
              ✕ Cancelar
            </button>
          </div>

          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Código */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Código Único (Ej: edemsa12026) *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PROMO2026"
                  required
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold uppercase text-[#18231C] focus:border-[#B9522F]"
                />
              </div>

              {/* Empresa Asignada */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Empresa o Cliente Asignado (Opcional)
                </label>
                <input
                  type="text"
                  value={assignedCompany}
                  onChange={(e) => setAssignedCompany(e.target.value)}
                  placeholder="Razón Social o Empresa"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                />
              </div>

              {/* Tipo de Descuento */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Tipo de Descuento *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                >
                  <option value="percentage">Porcentaje de Descuento (%)</option>
                  <option value="fixed">Monto Fijo en Pesos ($ ARS)</option>
                </select>
              </div>

              {/* Valor del Descuento */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  {type === 'percentage' ? 'Porcentaje de Descuento (%) *' : 'Monto de Descuento ($ ARS) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#B9522F]"
                />
              </div>

              {/* Fecha de Vencimiento */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Fecha Límite de Vencimiento *
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                />
              </div>

              {/* Monto Mínimo de Pedido */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Monto Mínimo de Pedido ($ Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Sin mínimo"
                  value={minOrderAmount || ''}
                  onChange={(e) => setMinOrderAmount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Guardar Código
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupons List */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#DCD4C9] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
            Códigos Activos ({coupons.length})
          </span>
          <span className="text-[11px] text-[#6F6860]">
            Los clientes o empresas pueden aplicar estos códigos al solicitar cotizaciones.
          </span>
        </div>

        {coupons.length === 0 ? (
          <div className="p-8 text-center text-[#6F6860] text-xs">
            No hay códigos de descuento registrados. Hacé clic en "Crear Código Único" para generar uno.
          </div>
        ) : (
          <div className="divide-y divide-[#DCD4C9]">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#FAF8F5] transition-colors"
              >
                {/* Code badge & info */}
                <div className="flex items-center gap-4">
                  <div className="px-3 py-1.5 bg-[#18231C] text-[#F5F2EC] rounded-xs font-mono font-bold text-sm tracking-wider flex items-center gap-2">
                    <span>{coupon.code}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(coupon.code)}
                      className="text-neutral-400 hover:text-white"
                      title="Copiar código"
                    >
                      {copiedCode === coupon.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#B9522F]">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% OFF`
                          : `$${coupon.discountValue.toLocaleString('es-AR')} OFF`}
                      </span>
                      {coupon.assignedCompany && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-xs border border-blue-200">
                          <Building2 className="w-3 h-3" />
                          {coupon.assignedCompany}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#6F6860]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Vence: {coupon.expirationDate}
                      </span>
                      {coupon.minOrderAmount && (
                        <span>Mínimo: ${coupon.minOrderAmount.toLocaleString('es-AR')}</span>
                      )}
                      <span>Usos: {coupon.usedCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: Toggle Active & Delete */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(coupon.id)}
                    className={`px-3 py-1 rounded-xs text-xs font-bold uppercase tracking-wider transition-colors ${
                      coupon.active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                    }`}
                  >
                    {coupon.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(coupon.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                    title="Eliminar cupón"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
