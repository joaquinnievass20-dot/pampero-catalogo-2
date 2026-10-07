import React, { useState, useEffect } from 'react';
import { LeadVisit } from '../../types';
import { 
  saveLeadVisit, 
  deleteLeadVisit, 
  subscribeToLeadVisits,
  subscribeToKanbanColumns, 
  DEFAULT_VISIT_COLUMNS, 
  KanbanColumnConfig 
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
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
  ArrowRightCircle,
  Download,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { exportVisitsToExcel, importVisitsFromExcel } from '../../utils/kanbanExcelUtils';

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
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pampero_kanban_visits_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(sanitizeObjectEncoding);
        }
      }
    } catch {}
    return DEFAULT_VISIT_COLUMNS.map(sanitizeObjectEncoding);
  });

  const [localVisits, setLocalVisits] = useState<LeadVisit[]>(() => (visits || []).map(sanitizeObjectEncoding));

  // Sync prop updates
  useEffect(() => {
    if (Array.isArray(visits) && visits.length > 0) {
      setLocalVisits(visits.map(sanitizeObjectEncoding));
    }
  }, [visits]);

  // Real-time Firestore onSnapshot for crm_leads_visitas
  useEffect(() => {
    const unsub = subscribeToLeadVisits((updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setLocalVisits(updated.map(sanitizeObjectEncoding));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.visits) && data.visits.length > 0) {
        setColumns(data.visits.map(sanitizeObjectEncoding));
      }
    });
    return () => unsub();
  }, []);

  const [sellerFilter, setSellerFilter] = useState('todos');
  const [branchFilter, setBranchFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<LeadVisit | null>(null);
  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputVisitsRef = React.useRef<HTMLInputElement>(null);

  const handleExportVisits = () => {
    exportVisitsToExcel(localVisits);
  };

  const handleImportVisits = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExcelProcessing(true);
    try {
      const res = await importVisitsFromExcel(file, localVisits);
      setLocalVisits(res.visits);
      setExcelNotice(`¡Visitas actualizadas con éxito! ${res.updatedCount} actualizadas, ${res.newCount} nuevas en Firestore.`);
      setTimeout(() => setExcelNotice(null), 6000);
    } catch (err: any) {
      alert(`Error al importar Excel de visitas: ${err?.message || err}`);
    } finally {
      setIsExcelProcessing(false);
      if (fileInputVisitsRef.current) fileInputVisitsRef.current.value = '';
    }
  };

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

  // Normalize visit step dynamically
  const getVisitStep = (v: LeadVisit): string => {
    const raw = (v as any).columnId || (v as any).step || (v as any).kanbanStep;
    if (raw && columns.some((c) => c.id === raw)) {
      return raw;
    }
    if (raw === 'primer_contacto' || raw === 'reunion' || raw === 'previo_cotizacion' || raw === 'convertida') {
      return raw;
    }
    // Fallback from legacy LeadVisitStatus
    if (v.status === 'programada') return columns[0]?.id || 'primer_contacto';
    if (v.status === 'realizada') return columns[1]?.id || 'reunion';
    if (v.status === 'presupuesto_enviado') return columns[2]?.id || 'previo_cotizacion';
    if (v.status === 'cerrada') return columns[columns.length - 1]?.id || 'convertida';
    return columns[0]?.id || 'primer_contacto';
  };

  const openNewModal = (defaultStep?: string) => {
    const targetStep = defaultStep || columns[0]?.id || 'primer_contacto';
    setEditingVisit(null);
    setCompanyName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setSeller('Itatí');
    setBranch('Maipú');
    setStep(targetStep as any);
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
    setStep(getVisitStep(v) as any);
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

    const chosenStep = step || columns[0]?.id || 'primer_contacto';

    const updatedVisit: LeadVisit = sanitizeObjectEncoding({
      id: editingVisit ? editingVisit.id : `VIS-${Date.now().toString().slice(-6)}`,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      seller,
      branch,
      status: (chosenStep === 'convertida' ? 'cerrada' : chosenStep === 'previo_cotizacion' ? 'presupuesto_enviado' : chosenStep === 'reunion' ? 'realizada' : 'programada') as any,
      columnId: chosenStep,
      step: chosenStep,
      kanbanStep: chosenStep,
      objective: objective.trim(),
      nextStep: nextStep.trim(),
      estimatedUnits: estimatedUnits ? Number(estimatedUnits) : undefined,
      notes: notes.trim(),
      date,
      createdAt: editingVisit ? editingVisit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Immediate local React state update
    setLocalVisits((prev) => [updatedVisit, ...prev.filter((v) => v.id !== updatedVisit.id)]);

    try {
      await saveLeadVisit(updatedVisit);
    } catch (err) {
      console.error('Error guardando visita:', err);
    }

    // If promoted to 'convertida', move automatically to Seguimiento empresas
    if (chosenStep === 'convertida' && onPromoteToCompanies) {
      onPromoteToCompanies(updatedVisit);
    }

    setShowModal(false);
  };

  // Move visit to next or specific step
  const handleMoveStep = async (visit: LeadVisit, nextTargetStep: VisitKanbanStep) => {
    const updated: LeadVisit = sanitizeObjectEncoding({
      ...visit,
      status: (nextTargetStep === 'convertida' ? 'cerrada' : nextTargetStep === 'previo_cotizacion' ? 'presupuesto_enviado' : nextTargetStep === 'reunion' ? 'realizada' : 'programada') as any,
      columnId: nextTargetStep,
      step: nextTargetStep,
      kanbanStep: nextTargetStep,
      updatedAt: new Date().toISOString(),
    });

    // Immediate optimistic local update
    setLocalVisits((prev) => [updated, ...prev.filter((v) => v.id !== updated.id)]);

    try {
      await saveLeadVisit(updated);
    } catch (err) {
      console.error('Error al mover paso de visita:', err);
    }

    // If it reaches or surpasses "Previo a cotización", move automatically to "Seguimiento empresas"
    if (nextTargetStep === 'convertida' && onPromoteToCompanies) {
      onPromoteToCompanies(updated);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta visita comercial?')) {
      // Force immediate local update to unblock UI
      setLocalVisits((prev) => prev.filter((v) => v.id !== id));
      try {
        await deleteLeadVisit(id);
      } catch (err) {
        console.error('Error al eliminar visita comercial:', err);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedVisitId(id);
  };

  const handleDrop = async (targetStep: VisitKanbanStep) => {
    if (!draggedVisitId) return;
    const v = localVisits.find((item) => item.id === draggedVisitId);
    if (v) {
      await handleMoveStep(v, targetStep);
    }
    setDraggedVisitId(null);
    setDragOverCol(null);
  };

  // Filter visits from localVisits
  const filteredVisits = localVisits.filter((v) => {
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

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Excel Bulk Tools */}
          <input
            type="file"
            ref={fileInputVisitsRef}
            onChange={handleImportVisits}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportVisits}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Descargar tarjetas de visitas comerciales en Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel</span>
          </button>
          <button
            type="button"
            disabled={isExcelProcessing}
            onClick={() => fileInputVisitsRef.current?.click()}
            className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="Subir archivo Excel para actualizar fases y visitas en Firestore"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isExcelProcessing ? 'Procesando...' : 'Subir Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => openNewModal('primer_contacto')}
            className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Visita / Contacto</span>
          </button>
        </div>
      </div>

      {/* Excel Notification Banner */}
      {excelNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs flex items-center justify-between gap-2 text-xs text-emerald-950 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{excelNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExcelNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Kanban Board with Dynamic Columns */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div 
          className="grid gap-4 min-w-[1000px]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }}
        >
          {columns.map((col) => {
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
                      {fixUtf8Encoding(col.label)}
                    </h4>
                    <span 
                      style={{ backgroundColor: `${col.color}22`, color: col.color }}
                      className="w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center border border-current"
                    >
                      {colVisits.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6F6860] leading-tight">
                    {fixUtf8Encoding(col.description || '')}
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
                                {fixUtf8Encoding(visit.companyName)}
                              </span>
                              <span className="text-[11px] text-[#6F6860] flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-neutral-400 shrink-0" />
                                <strong className="text-neutral-800">{fixUtf8Encoding(visit.contactName || 'Sin contacto')}</strong>
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-xs bg-[#ECE5DC] text-[#18231C] shrink-0">
                              {fixUtf8Encoding(visit.branch || 'Maipú')}
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
                            <span className="text-neutral-500">Resp: <strong>{fixUtf8Encoding(visit.seller || '')}</strong></span>
                          </div>

                          {visit.objective && (
                            <p className="text-[11px] text-neutral-700 bg-neutral-50 p-1.5 rounded-xs border border-neutral-200/60 leading-snug">
                              {fixUtf8Encoding(visit.objective)}
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
                              <span className="truncate">Próximo paso: <strong>{fixUtf8Encoding(visit.nextStep)}</strong></span>
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
                              {(() => {
                                const currentIndex = columns.findIndex((c) => c.id === currentStep);
                                const nextCol = currentIndex >= 0 && currentIndex < columns.length - 1 ? columns[currentIndex + 1] : null;
                                const isLastCol = currentIndex === columns.length - 1 || currentStep === 'convertida';

                                if (nextCol) {
                                  const isConverting = currentIndex === columns.length - 2;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStep(visit, nextCol.id as any)}
                                      className={`text-[10px] px-2 py-1 rounded-xs flex items-center gap-1 cursor-pointer transition-colors ${
                                        isConverting
                                          ? 'font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs'
                                          : 'font-bold text-neutral-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
                                      }`}
                                      title={`Avanzar a ${nextCol.label}`}
                                    >
                                      <span>A {nextCol.label}</span>
                                      {isConverting ? (
                                        <ArrowRightCircle className="w-3.5 h-3.5" />
                                      ) : (
                                        <ArrowRight className="w-3 h-3 text-[#B9522F]" />
                                      )}
                                    </button>
                                  );
                                }

                                if (isLastCol) {
                                  return (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                                      <span>En Seguimiento</span>
                                    </span>
                                  );
                                }

                                return null;
                              })()}
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
                  placeholder="Razón Social o Empresa"
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
                    placeholder="Nombre del contacto"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 2612345678"
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
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
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
