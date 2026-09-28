import React, { useState } from 'react';
import { LeadVisit, LeadVisitStatus } from '../../types';
import { saveLeadVisit, deleteLeadVisit } from '../../services/firebase';
import { 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  ArrowRight, 
  Trash2, 
  Edit3, 
  CheckCircle,
  X,
  Save,
  MessageCircle
} from 'lucide-react';

interface CRMVisitsTabProps {
  visits: LeadVisit[];
  accentColor: string;
}

const VISIT_STATUS_LABELS: Record<LeadVisitStatus, { label: string; bg: string; text: string }> = {
  programada: { label: 'Visita Programada', bg: 'bg-blue-100', text: 'text-blue-800' },
  realizada: { label: 'Visita Realizada', bg: 'bg-purple-100', text: 'text-purple-800' },
  presupuesto_enviado: { label: 'Presupuesto Enviado', bg: 'bg-amber-100', text: 'text-amber-800' },
  cerrada: { label: 'Venta Cerrada / Ganada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  cancelada: { label: 'Cancelada', bg: 'bg-neutral-100', text: 'text-neutral-700' },
};

export const CRMVisitsTab: React.FC<CRMVisitsTabProps> = ({ visits, accentColor }) => {
  const [sellerFilter, setSellerFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<LeadVisit | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [seller, setSeller] = useState('Itatí');
  const [branch, setBranch] = useState('Ciudad');
  const [status, setStatus] = useState<LeadVisitStatus>('programada');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [objective, setObjective] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextStepDate, setNextStepDate] = useState('');
  const [estimatedUnits, setEstimatedUnits] = useState('');
  const [notes, setNotes] = useState('');

  const openNewModal = () => {
    setEditingVisit(null);
    setCompanyName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setSeller('Itatí');
    setBranch('Ciudad');
    setStatus('programada');
    setDate(new Date().toISOString().split('T')[0]);
    setObjective('');
    setNextStep('');
    setNextStepDate('');
    setEstimatedUnits('');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (v: LeadVisit) => {
    setEditingVisit(v);
    setCompanyName(v.companyName);
    setContactName(v.contactName);
    setPhone(v.phone);
    setEmail(v.email);
    setSeller(v.seller);
    setBranch(v.branch);
    setStatus(v.status);
    setDate(v.date);
    setObjective(v.objective);
    setNextStep(v.nextStep);
    setNextStepDate(v.nextStepDate || '');
    setEstimatedUnits(v.estimatedUnits ? String(v.estimatedUnits) : '');
    setNotes(v.notes || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    const visitData: LeadVisit = {
      id: editingVisit ? editingVisit.id : `VIS-${Date.now().toString().slice(-6)}`,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      seller,
      branch,
      status,
      date,
      objective: objective.trim(),
      nextStep: nextStep.trim(),
      nextStepDate: nextStepDate.trim() || undefined,
      estimatedUnits: Number(estimatedUnits) || undefined,
      notes: notes.trim(),
      createdAt: editingVisit ? editingVisit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLeadVisit(visitData);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar registro de visita comercial?')) {
      deleteLeadVisit(id);
    }
  };

  const filteredVisits = visits.filter((v) => {
    const matchSeller = sellerFilter === 'todos' || v.seller.toLowerCase() === sellerFilter.toLowerCase();
    const matchStatus = statusFilter === 'todos' || v.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      v.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.objective.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSeller && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#B9522F]" />
            Visitas Comerciales & Leads Corporativos
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Registro y seguimiento de reuniones en empresas de Itatí, Guada, Carolina y Gustavo.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Visita
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[#8C827A]" />
        
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
        >
          <option value="todos">Vendedora: Todas</option>
          <option value="itatí">Itatí</option>
          <option value="guada">Guada</option>
          <option value="carolina">Carolina</option>
          <option value="gustavo">Gustavo</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 bg-white font-medium text-[#18231C] outline-none cursor-pointer"
        >
          <option value="todos">Estado: Todos</option>
          <option value="programada">Programada</option>
          <option value="realizada">Realizada</option>
          <option value="presupuesto_enviado">Presupuesto Enviado</option>
          <option value="cerrada">Venta Cerrada</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar empresa, contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs outline-none"
          />
        </div>

        <div className="ml-auto text-[11px] font-bold text-[#8C827A] uppercase">
          {filteredVisits.length} registros
        </div>
      </div>

      {/* Grid of Visits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVisits.map((v) => {
          const badge = VISIT_STATUS_LABELS[v.status] || VISIT_STATUS_LABELS.programada;
          return (
            <div
              key={v.id}
              className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-1 text-[#8C827A]">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-mono">{v.date}</span>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-[#18231C] leading-snug">{v.companyName}</h4>
                <div className="flex items-center gap-1.5 text-xs text-[#6F6860] mt-1">
                  <User className="w-3 h-3 text-[#B9522F]" />
                  <span>{v.contactName || 'Sin contacto directo'}</span>
                </div>

                <div className="mt-3 p-2.5 bg-[#FAF8F5] rounded-xs border border-[#ECE5DC] space-y-1.5">
                  <div className="text-xs text-[#18231C]">
                    <strong className="text-[10px] uppercase text-[#6F6860] block">Objetivo:</strong>
                    {v.objective || 'Presentación de catálogo institucional.'}
                  </div>
                  {v.nextStep && (
                    <div className="text-xs text-blue-900 font-medium pt-1 border-t border-[#ECE5DC]">
                      <strong className="text-[10px] uppercase text-blue-800 block">Próximo paso:</strong>
                      {v.nextStep} {v.nextStepDate ? `(Fecha: ${v.nextStepDate})` : ''}
                    </div>
                  )}
                </div>

                {v.estimatedUnits && (
                  <div className="mt-2 text-xs font-bold text-emerald-700">
                    Potencial estimado: {v.estimatedUnits} prendas
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-[#ECE5DC] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#6F6860]">
                  Vendedor: <strong className="text-[#18231C]">{v.seller}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  {v.phone && (
                    <a
                      href={`https://wa.me/${v.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(v.contactName)},%20te%20escribimos%20de%20Pampero%20Mendoza.`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-white bg-[#25D366] hover:bg-[#20ba59] rounded-xs cursor-pointer"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    </a>
                  )}
                  <button
                    onClick={() => openEditModal(v)}
                    className="p-1.5 text-[#6F6860] hover:text-[#18231C] hover:bg-[#FAF8F5] rounded-xs cursor-pointer"
                    title="Editar"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVisits.length === 0 && (
        <div className="bg-white p-12 text-center rounded-xs border border-[#DCD4C9]">
          <Building2 className="w-12 h-12 text-[#8C827A] mx-auto mb-3 opacity-40" />
          <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">No se encontraron visitas registradas</h4>
          <p className="text-xs text-[#6F6860] mt-1">
            Crea la primera visita comercial con el botón superior para dar seguimiento a tus leads.
          </p>
        </div>
      )}

      {/* Modal: New / Edit Visit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {editingVisit ? 'Editar Visita Comercial' : 'Nueva Visita Comercial'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Empresa *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: BODEGA NORTON, VALMEN JCB..."
                  required
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Contacto / Cargo</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej: Lic. Marcelo Pérez (Compras)"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="261..."
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Vendedor</label>
                  <select value={seller} onChange={(e) => setSeller(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white">
                    <option value="Itatí">Itatí</option>
                    <option value="Guada">Guada</option>
                    <option value="Carolina">Carolina</option>
                    <option value="Gustavo">Gustavo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Sucursal</label>
                  <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white">
                    <option value="Ciudad">Ciudad</option>
                    <option value="Maipú">Maipú</option>
                    <option value="Luján">Luján</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Fecha</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white font-medium">
                    <option value="programada">Programada</option>
                    <option value="realizada">Realizada</option>
                    <option value="presupuesto_enviado">Presupuesto Enviado</option>
                    <option value="cerrada">Venta Cerrada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Prendas Estimadas</label>
                  <input
                    type="number"
                    value={estimatedUnits}
                    onChange={(e) => setEstimatedUnits(e.target.value)}
                    placeholder="Ej: 50"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Objetivo / Necesidad</label>
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ej: Dotación invierno 2026 camperas y calzado dieléctrico"
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Próximo Paso</label>
                  <input
                    type="text"
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="Ej: Enviar cotización por email"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Fecha Próximo Paso</label>
                  <input
                    type="date"
                    value={nextStepDate}
                    onChange={(e) => setNextStepDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Notas / Observaciones</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre logo, colores corporativos, condiciones de pago..."
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Visita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
