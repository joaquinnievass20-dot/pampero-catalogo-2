import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Calendar, 
  Building2, 
  Plus, 
  Check, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  FileText,
  Filter,
  Search,
  CheckCircle2
} from 'lucide-react';
import { CRMSale } from '../../types';
import { fixUtf8Encoding } from '../../utils/encodingUtils';

interface CRMSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: CRMSale[];
  accentColor?: string;
  branches?: string[];
  onSaveSale: (sale: Partial<CRMSale>) => Promise<boolean>;
  onDeleteSale: (id: string) => Promise<boolean>;
}

export const CRMSalesModal: React.FC<CRMSalesModalProps> = ({
  isOpen,
  onClose,
  sales,
  accentColor = '#FDB813',
  branches = ['Maipú', 'Ciudad', 'Luján'],
  onSaveSale,
  onDeleteSale,
}) => {
  // Normalize standard branches
  const standardBranches = ['Maipú', 'Ciudad', 'Luján'];
  const allBranches = Array.from(new Set([...standardBranches, ...branches.map(b => b.replace('Pampero ', '').trim())]));

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBranch, setFormBranch] = useState<string>('Maipú');
  const [formPeriod, setFormPeriod] = useState<'Diario' | 'Semanal' | 'Mensual'>('Diario');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDetail, setFormDetail] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tableBranchFilter, setTableBranchFilter] = useState<string>('todas');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormBranch('Maipú');
    setFormPeriod('Diario');
    setFormAmount('');
    setFormDetail('');
  };

  // Close handler
  const handleClose = () => {
    resetForm();
    setFeedback(null);
    onClose();
  };

  // Start editing a sale
  const handleStartEdit = (sale: CRMSale) => {
    setEditingId(sale.id);
    setFormDate(sale.date || new Date().toISOString().split('T')[0]);
    
    // Match branch cleanly
    const bName = sale.branch || 'Maipú';
    const foundBranch = allBranches.find(b => b.toLowerCase() === bName.toLowerCase() || bName.toLowerCase().includes(b.toLowerCase()));
    setFormBranch(foundBranch || bName);

    setFormPeriod((sale.period as any) || 'Diario');
    setFormAmount(String(sale.amount ?? sale.totalDaily ?? ''));
    setFormDetail(sale.detail || '');

    // Focus input or scroll to top of modal
    setFeedback(null);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(formAmount.replace(/[^0-9.]/g, ''));

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: 'error', message: 'Por favor ingresá un monto de venta válido mayor a cero.' });
      return;
    }

    if (!formDate) {
      setFeedback({ type: 'error', message: 'Por favor seleccioná una fecha.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload: Partial<CRMSale> = {
        id: editingId || undefined,
        date: formDate,
        branch: formBranch,
        period: formPeriod,
        amount: numericAmount,
        totalDaily: numericAmount,
        detail: formDetail.trim(),
        registeredBy: 'Admin / Operador',
      };

      const success = await onSaveSale(payload);
      if (success) {
        setFeedback({ 
          type: 'success', 
          message: editingId ? 'Venta actualizada exitosamente.' : 'Venta registrada con éxito.' 
        });
        resetForm();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', message: 'Hubo un error al guardar en la base de datos.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado al guardar la venta.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete sale
  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Confirmás eliminar este registro de venta?')) return;

    setDeletingId(id);
    try {
      const success = await onDeleteSale(id);
      if (success) {
        if (editingId === id) resetForm();
        setFeedback({ type: 'success', message: 'Registro de venta eliminado.' });
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback({ type: 'error', message: 'No se pudo eliminar el registro.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al eliminar registro.' });
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered sales for history table inside modal
  const modalFilteredSales = sales.filter((item) => {
    const itemBranchNorm = (item.branch || '').toLowerCase();
    const filterBranchNorm = tableBranchFilter.toLowerCase();
    const matchBranch = tableBranchFilter === 'todas' || 
      itemBranchNorm === filterBranchNorm || 
      itemBranchNorm.includes(filterBranchNorm) || 
      filterBranchNorm.includes(itemBranchNorm);

    const matchSearch = !searchFilter.trim() || 
      (item.detail || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.date || '').includes(searchFilter) ||
      (item.period || '').toLowerCase().includes(searchFilter.toLowerCase());

    return matchBranch && matchSearch;
  });

  const totalFilteredAmount = modalFilteredSales.reduce((acc, s) => acc + (Number(s.amount ?? s.totalDaily) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="relative bg-white w-full max-w-4xl rounded-xs shadow-2xl border border-[#DCD4C9] flex flex-col my-auto max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="bg-[#18231C] text-[#F5F2EC] px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xs bg-[#B9522F] text-white flex items-center justify-center shadow-xs">
              <DollarSign className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Carga de Ventas & Registro de Ingresos
              </h2>
              <p className="text-[11px] text-[#DCD4C9]/80">
                Registrá ingresos por sucursal para calcular en tiempo real la Rentabilidad Neta del negocio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF8F5]">
          {/* Feedback message banner */}
          {feedback && (
            <div className={`p-3 rounded-xs text-xs font-semibold flex items-center gap-2 border animate-fadeIn ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-red-50 text-red-900 border-red-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Formulario de Carga Ágil */}
          <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
            <div className="flex items-center justify-between mb-4 border-b border-[#ECE5DC] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B9522F]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#18231C]">
                  {editingId ? 'Editar Registro de Venta' : 'Nuevo Registro de Venta'}
                </h3>
              </div>
              {editingId && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xs">
                  Modo Edición
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Fecha */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4A453F] mb-1">
                    Fecha *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-medium text-[#18231C] focus:bg-white focus:outline-none focus:border-[#B9522F] transition-colors"
                    />
                  </div>
                </div>

                {/* 2. Sucursal (Maipú, Ciudad, Luján) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4A453F] mb-1">
                    Sucursal *
                  </label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] focus:bg-white focus:outline-none focus:border-[#B9522F] transition-colors cursor-pointer"
                  >
                    {allBranches.map((b) => (
                      <option key={b} value={b}>
                        {fixUtf8Encoding(b)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Período (Diario, Semanal, Mensual) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4A453F] mb-1">
                    Período *
                  </label>
                  <select
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C] focus:bg-white focus:outline-none focus:border-[#B9522F] transition-colors cursor-pointer"
                  >
                    <option value="Diario">Diario</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensual">Mensual</option>
                  </select>
                </div>

                {/* 4. Monto Total de Venta */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4A453F] mb-1">
                    Monto Total de Venta ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-[#6F6860] pointer-events-none">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Ej. 450000"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold text-[#18231C] focus:bg-white focus:outline-none focus:border-[#B9522F] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Detalle (texto opcional) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4A453F] mb-1">
                  Detalle / Observaciones <span className="text-[#6F6860] normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cierre de caja mostrador, facturación mayorista prendas de trabajo..."
                  value={formDetail}
                  onChange={(e) => setFormDetail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:bg-white focus:outline-none focus:border-[#B9522F] transition-colors"
                />
              </div>

              {/* Botones de acción del formulario */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-[#DCD4C9] hover:bg-[#ECE5DC] text-[#4A453F] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
                  >
                    Cancelar Edición
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ backgroundColor: '#18231C' }}
                  className="px-6 py-2.5 text-white hover:bg-black text-xs font-black uppercase tracking-wider rounded-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      {editingId ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4 text-amber-300" />}
                      <span>{editingId ? 'Actualizar Venta' : 'Registrar Venta'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Historial de Ventas Cargadas (Dentro del mismo Modal) */}
          <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECE5DC] pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Historial de Ventas Registradas ({modalFilteredSales.length})</span>
                </h3>
                <p className="text-[11px] text-[#6F6860]">
                  Registros activos en <code className="bg-[#FAF8F5] px-1 py-0.5 rounded text-[10px] text-[#18231C]">crm_sales</code> para cálculo de ingresos
                </p>
              </div>

              {/* Filtros de la tabla interna */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar detalle..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F] w-36 sm:w-44"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#DCD4C9] px-2 py-1.5 rounded-xs text-xs">
                  <Filter className="w-3 h-3 text-neutral-500" />
                  <select
                    value={tableBranchFilter}
                    onChange={(e) => setTableBranchFilter(e.target.value)}
                    className="bg-transparent font-bold text-[#18231C] outline-none cursor-pointer text-xs"
                  >
                    <option value="todas">Todas las Sucursales</option>
                    {allBranches.map((b) => (
                      <option key={b} value={b}>{fixUtf8Encoding(b)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla de Historial */}
            {modalFilteredSales.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#FAF8F5] rounded-xs border border-dashed border-[#DCD4C9]">
                <div className="w-10 h-10 rounded-full bg-[#ECE5DC] text-[#6F6860] flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-[#18231C] uppercase tracking-wider">
                  No hay ventas registradas en esta vista
                </p>
                <p className="text-[11px] text-[#6F6860] max-w-sm mx-auto mt-1">
                  Completá el formulario superior con fecha, sucursal y monto para registrar el primer ingreso del local.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#ECE5DC] rounded-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18231C] text-[#F5F2EC] text-[10px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Fecha</th>
                      <th className="px-3.5 py-2.5">Sucursal</th>
                      <th className="px-3.5 py-2.5">Período</th>
                      <th className="px-3.5 py-2.5">Detalle</th>
                      <th className="px-3.5 py-2.5 text-right">Monto de Venta</th>
                      <th className="px-3.5 py-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE5DC] bg-white">
                    {modalFilteredSales.map((s) => {
                      const amountVal = Number(s.amount ?? s.totalDaily) || 0;
                      return (
                        <tr 
                          key={s.id} 
                          className={`hover:bg-[#FAF8F5] transition-colors ${
                            editingId === s.id ? 'bg-amber-50/70' : ''
                          }`}
                        >
                          <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#18231C] whitespace-nowrap">
                            {s.date || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="font-bold text-[#18231C] px-1.5 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[11px]">
                              {fixUtf8Encoding(s.branch || 'Maipú')}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-xs bg-neutral-100 text-[#4A453F]">
                              {s.period || 'Diario'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-[11px] text-[#6F6860] max-w-xs truncate">
                            {s.detail || <span className="text-neutral-400 italic">Sin detalle adicional</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-sm text-[#18231C] whitespace-nowrap">
                            ${amountVal.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(s)}
                                className="p-1 text-[#6F6860] hover:text-[#18231C] hover:bg-neutral-100 rounded-xs transition-colors cursor-pointer"
                                title="Editar venta"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === s.id}
                                onClick={() => handleDelete(s.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xs transition-colors cursor-pointer disabled:opacity-40"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#FAF8F5] border-t-2 border-[#DCD4C9] font-bold">
                    <tr>
                      <td colSpan={4} className="px-3.5 py-2.5 text-xs text-[#18231C] uppercase tracking-wider">
                        Total Sumatoria ({modalFilteredSales.length} registros filtrados):
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-sm text-emerald-800">
                        ${totalFilteredAmount.toLocaleString('es-AR')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F5F2EC] px-5 py-3 border-t border-[#DCD4C9] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#6F6860]">
            Sincronización en tiempo real vía Firebase Firestore (<code className="font-mono text-[#18231C]">crm_sales</code>)
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
