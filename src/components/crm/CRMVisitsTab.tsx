import React, { useState } from 'react';
import { LeadVisit } from '../../types';
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
  MessageCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRightCircle
} from 'lucide-react';

interface CRMVisitsTabProps {
  visits: LeadVisit[];
  accentColor: string;
  onPromoteToCompanies?: (visit: LeadVisit) => void;
}

export type VisitKanbanStep = 'primer_contacto' | 'reunion' | 'previo_cotizacion' | 'convertida';

export const VISIT_COLUMNS: { id: VisitKanbanStep; label: string; description: string; color: string; bgColor: string }[] = [
  { 
    id: 'primer_contacto', 
    label: '1. Primer Contacto', 
    description: 'Contacto inicial telefónico, WhatsApp o prospección',
    color: '#3B82F6', 
    bgColor: '#EFF6FF' 
  },
  { 
    id: 'reunion', 
    label: '2. Reunión / Visita', 
    description: 'Visita en planta/oficina o presentación en local',
    color: '#8B5CF6', 
    bgColor: '#F5F3FF' 
  },
  { 
    id: 'previo_cotizacion', 
    label: '3. Previo a Cotización', 
    description: 'Relevamiento de prendas, talles y muestras físicas',
    color: '#F97316', 
    bgColor: '#FFF7ED' 
  },
  { 
    id: 'convertida', 
    label: '4. Pasado a Seguimiento', 
    description: 'Avanzado con éxito al tablero de Seguimiento Empresas',
    color: '#10B981', 
    bgColor: '#ECFDF5' 
  },
];

export const CRMVisitsTab: React.FC<CRMVisitsTabProps> = ({ visits, accentColor, onPromoteToCompanies }) => {
  const [sellerFilter, setSellerFilter] = useState('todos');
  const [branchFilter, setBranchFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<LeadVisit | null>(null);
  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [seller, setSeller] = useState('Itatí');
  const [branch, setBranch] = useState('Maipú');
  const [step, setStep] = useState<VisitKanbanStep>('primer_contacto');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [objective, setObjective] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [estimatedUnits, setEstimatedUnits] = useState('');
  const [notes, setNotes] = useState('');

  // Normalize visit step
  const getVisitStep = (v: LeadVisit): VisitKanbanStep => {
    const raw = (v as any).step || (v as any).kanbanStep;
    if (raw === 'primer_contacto' || raw === 'reunion' || raw === 'previo_cotizacion' || raw === 'convertida') {
      return raw;
    }
    // Fallback from legacy LeadVisitStatus
    if (v.status === 'programada') return 'primer_contacto';
    if (v.status === 'realizada') return 'reunion';
    if (v.status === 'presupuesto_enviado') return 'previo_cotizacion';
    if (v.status === 'cerrada') return 'convertida';
    return 'primer_contacto';
  };

  const openNewModal = (defaultStep: VisitKanbanStep = 'primer_contacto') => {
    setEditingVisit(null);
    setCompanyName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setSeller('Itatí');
    setBranch('Maipú');
    setStep(defaultStep);
    setDate(new Date().toISOString().split('T')[0]);
    setObjective('');
    setNextStep('');
    setEstimatedUnits('');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (v: LeadVisit) => {
    setEditingVisit(v);
    setCompanyName(v.companyName || '');
    setContactName(v.contactName || '');
    setPhone(v.phone || '');
    setEmail(v.email || '');
    setSeller(v.seller || 'Itatí');
    setBranch(v.branch || 'Maipú');
    setStep(getVisitStep(v));
    setDate(v.date || new Date().toISOString().split('T')[0]);
    setObjective(v.objective || '');
    setNextStep(v.nextStep || '');
    setEstimatedUnits(v.estimatedUnits ? String(v.estimatedUnits) : '');
    setNotes(v.notes || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    const updatedVisit: LeadVisit = {
      id: editingVisit ? editingVisit.id : `VIS-${Date.now().toString().slice(-6)}`,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      seller,
      branch,
      status: (step === 'convertida' ? 'cerrada' : step === 'previo_cotizacion' ? 'presupuesto_enviado' : step === 'reunion' ? 'realizada' : 'programada') as any,
      objective: objective.trim(),
      nextStep: nextStep.trim(),
      estimatedUnits: estimatedUnits ? Number(estimatedUnits) : undefined,
      notes: notes.trim(),
      date,
      createdAt: editingVisit ? editingVisit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...({ kanbanStep: step, step } as any),
    };

    await saveLeadVisit(updatedVisit);

    // If promoted to 'convertida', move automatically to Seguimiento empresas
    if (step === 'convertida' && onPromoteToCompanies) {
      onPromoteToCompanies(updatedVisit);
    }

    setShowModal(false);
  };

  // Move visit to next or specific step
  const handleMoveStep = async (visit: LeadVisit, nextTargetStep: VisitKanbanStep) => {
    const updated: LeadVisit = {
      ...visit,
      status: (nextTargetStep === 'convertida' ? 'cerrada' : nextTargetStep === 'previo_cotizacion' ? 'presupuesto_enviado' : nextTargetStep === 'reunion' ? 'realizada' : 'programada') as any,
      updatedAt: new Date().toISOString(),
      ...({ kanbanStep: nextTargetStep, step: nextTargetStep } as any),
    };

    await saveLeadVisit(updated);

    // If it reaches or surpasses "Previo a cotización", move automatically to "Seguimiento empresas"
    if (nextTargetStep === 'convertida' && onPromoteToCompanies) {
      onPromoteToCompanies(updated);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta visita comercial?')) {
      await deleteLeadVisit(id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedVisitId(id);
  };

  const handleDrop = async (targetStep: VisitKanbanStep) => {
    if (!draggedVisitId) return;
    const v = visits.find((item) => item.id === draggedVisitId);
    if (v) {
      await handleMoveStep(v, targetStep);
    }
    setDraggedVisitId(null);
    setDragOverCol(null);
  };

  // Filter visits
  const filteredVisits = visits.filter((v) => {
    const matchesSeller = sellerFilter === 'todos' || (v.seller || '').toLowerCase() === sellerFilter.toLowerCase();
    const matchesBranch = branchFilter === 'todos' || (v.branch || '').toLowerCase() === branchFilter.toLowerCase();
    const matchesQuery = 
      !searchQuery.trim() ||
      (v.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeller && matchesBranch && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner and Filters */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#B9522F]" />
              Tablero Kanban · Visitas Comerciales
            </h3>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900 border border-amber-300">
              Prospección a Empresas
            </span>
          </div>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Flujo paso a paso desde el primer contacto hasta superar <strong>"Previo a cotización"</strong> (momento en que la empresa pasa automáticamente al tablero de <strong>Seguimiento Empresas</strong>).
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewModal('primer_contacto')}
          className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Visita / Contacto</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <Filter className="w-4 h-4 text-[#8C827A]" />

        <div className="flex items-center gap-1.5">
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C]"
          >
            <option value="todos">Vendedor: Todos</option>
            <option value="Itatí">Itatí</option>
            <option value="Guada">Guada</option>
            <option value="Carolina">Carolina</option>
            <option value="Gustavo">Gustavo</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-2.5 py-1.5 outline-none font-medium bg-white text-[#18231C]"
          >
            <option value="todos">Local: Todos</option>
            <option value="Maipú">Maipú</option>
            <option value="Ciudad">Ciudad</option>
            <option value="Luján">Luján</option>
            <option value="Godoy Cruz">Godoy Cruz</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar empresa, contacto o notas..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>
      </div>

      {/* Kanban Board with 4 Columns */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-w-[1000px]">
          {VISIT_COLUMNS.map((col) => {
            const colVisits = filteredVisits.filter((v) => getVisitStep(v) === col.id);
            const isDragTarget = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.id)}
                className={`bg-[#FAF8F5] rounded-xs border-2 flex flex-col h-full min-h-[520px] transition-all ${
                  isDragTarget ? 'border-[#B9522F] bg-amber-50/50 shadow-md' : 'border-[#DCD4C9]'
                }`}
              >
                {/* Column Header */}
                <div 
                  className="p-3 border-b border-[#DCD4C9] bg-white rounded-t-xs"
                  style={{ borderTop: `4px solid ${col.color}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                      {col.label}
                    </h4>
                    <span 
                      style={{ backgroundColor: col.bgColor, color: col.color }}
                      className="w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center border border-current"
                    >
                      {colVisits.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6F6860] leading-tight">
                    {col.description}
                  </p>
                </div>

                {/* Cards Container */}
                <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto">
                  {colVisits.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[#DCD4C9] rounded-xs flex flex-col items-center justify-center text-center p-3 text-neutral-400">
                      <p className="text-[11px] font-medium">Sin empresas en esta etapa</p>
                      <button
                        type="button"
                        onClick={() => openNewModal(col.id)}
                        className="mt-1 text-[10px] text-[#B9522F] hover:underline font-bold"
                      >
                        + Agregar acá
                      </button>
                    </div>
                  ) : (
                    colVisits.map((visit) => {
                      const currentStep = getVisitStep(visit);
                      return (
                        <div
                          key={visit.id}
                          draggable
                          onDragStart={() => handleDragStart(visit.id)}
                          className="bg-white rounded-xs p-3 border border-[#DCD4C9] hover:border-[#18231C] shadow-2xs transition-all cursor-grab active:cursor-grabbing group space-y-2"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[#18231C] block truncate uppercase">
                                {visit.companyName}
                              </span>
                              <span className="text-[11px] text-[#6F6860] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                <strong className="text-neutral-800">{visit.contactName || 'Sin contacto'}</strong>
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-xs bg-[#ECE5DC] text-[#18231C] shrink-0">
                              {visit.branch || 'Maipú'}
                            </span>
                          </div>

                          {/* Contact quick links */}
                          <div className="text-[10px] text-[#6F6860] flex flex-wrap gap-2 pt-1 border-t border-neutral-100">
                            {visit.phone && (
                              <a
                                href={`https://wa.me/${visit.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>{visit.phone}</span>
                              </a>
                            )}
                            <span className="text-neutral-500">Resp: <strong>{visit.seller}</strong></span>
                          </div>

                          {visit.objective && (
                            <p className="text-[11px] text-neutral-700 bg-neutral-50 p-1.5 rounded-xs border border-neutral-200/60 leading-snug">
                              {visit.objective}
                            </p>
                          )}

                          {visit.estimatedUnits && (
                            <div className="text-[10px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200 inline-block font-bold">
                              Estimado: {visit.estimatedUnits} prendas
                            </div>
                          )}

                          {/* Next step notice */}
                          {visit.nextStep && (
                            <div className="text-[10px] text-purple-900 bg-purple-50 px-2 py-1 rounded-xs border border-purple-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-purple-600 shrink-0" />
                              <span className="truncate">Próximo paso: <strong>{visit.nextStep}</strong></span>
                            </div>
                          )}

                          {/* Action controls */}
                          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(visit)}
                                className="p-1 hover:bg-neutral-100 rounded-xs text-neutral-600 hover:text-black cursor-pointer"
                                title="Editar detalles"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(visit.id)}
                                className="p-1 hover:bg-red-50 rounded-xs text-neutral-400 hover:text-red-600 cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Column Navigation Buttons */}
                            <div className="flex items-center gap-1">
                              {currentStep === 'primer_contacto' && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(visit, 'reunion')}
                                  className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-xs border border-blue-200 flex items-center gap-1"
                                >
                                  <span>A Reunión</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              {currentStep === 'reunion' && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(visit, 'previo_cotizacion')}
                                  className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-xs border border-amber-200 flex items-center gap-1"
                                >
                                  <span>A Previo Cotiz.</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              {currentStep === 'previo_cotizacion' && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(visit, 'convertida')}
                                  className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded-xs shadow-xs flex items-center gap-1"
                                  title="Supera la etapa previo a cotización y pasa automáticamente al tablero de Seguimiento Empresas"
                                >
                                  <ArrowRightCircle className="w-3.5 h-3.5" />
                                  <span>Pasar a Seguimiento</span>
                                </button>
                              )}

                              {currentStep === 'convertida' && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>En Seguimiento</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nueva / Editar Visita */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm uppercase text-[#18231C]">
                {editingVisit ? 'Editar Visita / Contacto Comercial' : 'Nueva Visita / Contacto Comercial'}
              </h4>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Empresa / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Bodegas Salentein / Constructora Mendoza"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Contacto / Responsable</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej: Ing. Martín Gómez"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="261 555-1234"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Vendedor Asignado</label>
                  <select
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  >
                    <option value="Itatí">Itatí</option>
                    <option value="Guada">Guada</option>
                    <option value="Carolina">Carolina</option>
                    <option value="Gustavo">Gustavo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Local / Sucursal</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  >
                    <option value="Maipú">Maipú</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Luján">Luján</option>
                    <option value="Godoy Cruz">Godoy Cruz</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Etapa del Tablero</label>
                  <select
                    value={step}
                    onChange={(e) => setStep(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold text-[#18231C]"
                  >
                    <option value="primer_contacto">1. Primer Contacto</option>
                    <option value="reunion">2. Reunión / Visita</option>
                    <option value="previo_cotizacion">3. Previo a Cotización</option>
                    <option value="convertida">4. Pasado a Seguimiento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Objetivo del Contacto</label>
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ej: Renovar camisas y calzado para 40 operarios de vendimia"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Próximo Paso Acordado</label>
                  <input
                    type="text"
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="Ej: Enviar muestras de talle y cotización"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Estimado de Unidades</label>
                  <input
                    type="number"
                    value={estimatedUnits}
                    onChange={(e) => setEstimatedUnits(e.target.value)}
                    placeholder="40"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Observaciones / Requerimientos</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre bordados de logo, plazos urgentes, etc."
                  className="w-full p-2.5 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-neutral-600 hover:text-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase rounded-xs transition-colors cursor-pointer"
                >
                  Guardar en Tablero
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
