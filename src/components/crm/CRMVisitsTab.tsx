import React, { useState, useEffect, useRef } from 'react';
import { LeadVisit, ObservationHistoryEntry, ThemeConfig } from '../../types';
import { 
  saveLeadVisit, 
  deleteLeadVisit, 
  subscribeToLeadVisits,
  subscribeToKanbanColumns, 
  DEFAULT_VISIT_COLUMNS, 
  KanbanColumnConfig,
  getNextStructuredTrackingCode,
  isValidStructuredTrackingCode,
  ensureVisitsHaveStructuredTrackingCodes,
  upsertObservationReminderCalendarEvent,
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
  Eye,
  MapPin,
  ExternalLink,
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
  CheckCircle2,
  Bell,
  MessageSquarePlus
} from 'lucide-react';
import { exportVisitsToExcel, importVisitsFromExcel } from '../../utils/kanbanExcelUtils';
import { normalizeLeadVisit } from '../../utils/crmNormalizers';
import { CRMObservationsModal } from './CRMObservationsModal';

interface CRMVisitsTabProps {
  visits: LeadVisit[];
  accentColor: string;
  crmScope?: 'all' | 'branch_only' | 'own_only';
  assignedBranch?: string;
  assignedSellerName?: string;
  onPromoteToCompanies?: (visit: LeadVisit) => void;
  onVisitsUpdated?: (visits: LeadVisit[]) => void;
  theme?: ThemeConfig;
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

export const CRMVisitsTab: React.FC<CRMVisitsTabProps> = ({
  visits,
  accentColor,
  crmScope = 'all',
  assignedBranch = '',
  assignedSellerName = '',
  onPromoteToCompanies,
  onVisitsUpdated,
  theme,
}) => {
  const st = theme?.siteTexts;
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

  const [localVisits, setLocalVisits] = useState<LeadVisit[]>(() =>
    (Array.isArray(visits) ? visits : []).map((v, idx) => normalizeLeadVisit(v, idx))
  );

  // Sync prop updates safely without infinite re-renders
  useEffect(() => {
    if (Array.isArray(visits)) {
      const normalized = visits.map((v, idx) => normalizeLeadVisit(v, idx));
      setLocalVisits((prev) => {
        if (prev.length === normalized.length) {
          const hasDiff = normalized.some((v, idx) => {
            const p = prev[idx];
            return !p || p.id !== v.id || p.status !== v.status || p.updatedAt !== v.updatedAt || p.phone !== v.phone;
          });
          if (!hasDiff) return prev;
        }
        return normalized;
      });
    }
  }, [visits]);

  // Real-time Firestore onSnapshot for crm_leads_visitas (only if not provided by parent)
  useEffect(() => {
    if (Array.isArray(visits) && visits.length > 0) {
      return () => {};
    }
    const unsub = subscribeToLeadVisits((updated) => {
      if (Array.isArray(updated)) {
        const normalized = updated.map((v, idx) => normalizeLeadVisit(v, idx));
        setLocalVisits((prev) => {
          if (prev.length === normalized.length) {
            const hasDiff = normalized.some((v, idx) => {
              const p = prev[idx];
              return !p || p.id !== v.id || p.status !== v.status || p.updatedAt !== v.updatedAt || p.phone !== v.phone;
            });
            if (!hasDiff) return prev;
          }
          return normalized;
        });
      }
    });
    return () => {
      unsub();
    };
  }, [visits]);

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
  const [compactView, setCompactView] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<LeadVisit | null>(null);
  const [viewingVisit, setViewingVisit] = useState<LeadVisit | null>(null);
  const [showVisitObsModal, setShowVisitObsModal] = useState(false);
  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [excelNotice, setExcelNotice] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputVisitsRef = React.useRef<HTMLInputElement>(null);
  const backfilledVisitIdsRef = useRef<Set<string>>(new Set());

  // Centralizar TODAS las visitas (incluidas iniciales/generales sin código estructurado)
  useEffect(() => {
    const missing = localVisits.filter(
      (v) => v && v.id && !isValidStructuredTrackingCode(v.trackingCode) && !backfilledVisitIdsRef.current.has(v.id)
    );
    if (missing.length === 0) return;
    missing.forEach((v) => backfilledVisitIdsRef.current.add(v.id));

    let cancelled = false;
    ensureVisitsHaveStructuredTrackingCodes(localVisits).then((enriched) => {
      if (cancelled) return;
      setLocalVisits(enriched);
      if (onVisitsUpdated) onVisitsUpdated(enriched);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [localVisits, onVisitsUpdated]);

  // Lista dinámica de vendedores (conservando nombres cargados por Excel o manualmente)
  const sellerOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    const seed = ['Itatí', 'Guada', 'Carolina', 'Gustavo'];
    seed.forEach((n) => map.set(n.toLowerCase(), n));
    try {
      const savedSellers = JSON.parse(localStorage.getItem('pampero_sellers') || '[]');
      if (Array.isArray(savedSellers)) {
        savedSellers.forEach((s: any) => {
          const nm = String(s?.name || '').trim();
          if (nm) map.set(nm.toLowerCase(), fixUtf8Encoding(nm));
        });
      }
    } catch {}
    localVisits.forEach((v) => {
      const nm = String(v.seller || '').trim();
      if (nm && nm.toLowerCase() !== 'sin asignar') {
        map.set(nm.toLowerCase(), fixUtf8Encoding(nm));
      }
    });
    return Array.from(map.values());
  }, [localVisits]);

  const handleExportVisits = () => {
    exportVisitsToExcel(localVisits);
  };

  const handleImportVisits = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExcelProcessing(true);
    setExcelError(null);
    setExcelNotice(null);
    try {
      const res = await importVisitsFromExcel(file, localVisits, columns);
      const safeVisits = (res.visits || []).map((v, idx) => normalizeLeadVisit(v, idx));
      setLocalVisits(safeVisits);
      if (onVisitsUpdated) onVisitsUpdated(safeVisits);
      setExcelNotice(`¡Visitas actualizadas con éxito! ${res.updatedCount} actualizadas, ${res.newCount} nuevas en Firestore.`);
      setTimeout(() => setExcelNotice(null), 7000);
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Error desconocido al leer el archivo Excel.';
      setExcelError(`No se pudo procesar el Excel: ${msg}`);
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
  const [companyLocation, setCompanyLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [seller, setSeller] = useState('Itatí');
  const [branch, setBranch] = useState('Maipú');
  const [step, setStep] = useState<VisitKanbanStep>('primer_contacto');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [objective, setObjective] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextStepDate, setNextStepDate] = useState('');
  const [estimatedUnits, setEstimatedUnits] = useState('');
  const [notes, setNotes] = useState('');
  const [observationDate, setObservationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [generateReminder, setGenerateReminder] = useState(false);

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
    const todayIso = new Date().toISOString().split('T')[0];
    setEditingVisit(null);
    setCompanyName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setCompanyLocation('');
    setLocationUrl('');
    setSeller('Itatí');
    setBranch('Maipú');
    setStep(targetStep as any);
    setDate(todayIso);
    setObjective('');
    setNextStep('');
    setNextStepDate('');
    setEstimatedUnits('');
    setNotes('');
    setObservationDate(todayIso);
    setReminderDate('');
    setReminderTime('');
    setReminderNote('');
    setGenerateReminder(false);
    setShowModal(true);
  };

  const openEditModal = (v: LeadVisit) => {
    setEditingVisit(v);
    setCompanyName(v.companyName || '');
    setContactName(v.contactName || '');
    setPhone(v.phone || '');
    setEmail(v.email || '');
    setCompanyLocation(v.companyLocation || '');
    setLocationUrl(v.locationUrl || '');
    setSeller(v.seller || 'Sin asignar');
    setBranch(v.branch || 'Maipú');
    setStep(getVisitStep(v) as any);
    setDate(v.date || new Date().toISOString().split('T')[0]);
    setObjective(v.objective || '');
    setNextStep(v.nextStep || '');
    setNextStepDate(v.nextStepDate || '');
    setEstimatedUnits(v.estimatedUnits ? String(v.estimatedUnits) : '');
    setNotes(v.notes || '');
    setObservationDate(v.observationDate || new Date().toISOString().split('T')[0]);
    setReminderDate(v.reminderDate || '');
    setReminderTime(v.reminderTime || '');
    setReminderNote(v.reminderNote || '');
    setGenerateReminder(Boolean(v.reminderDate));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    const chosenStep = step || columns[0]?.id || 'primer_contacto';
    // Los 4 dígitos DDMM corresponden a la fecha de alta en el sistema (createdAt o fecha actual), nunca a la fecha futura de visita
    const regDateObj = editingVisit?.createdAt ? new Date(editingVisit.createdAt) : new Date();
    const validRegDate = !Number.isNaN(regDateObj.getTime()) ? regDateObj : new Date();
    const resolvedTracking =
      editingVisit?.trackingCode && isValidStructuredTrackingCode(editingVisit.trackingCode)
        ? editingVisit.trackingCode
        : await getNextStructuredTrackingCode('empresa', branch || 'Maipú', validRegDate);

    const visitId = editingVisit ? editingVisit.id : `VIS-${Date.now().toString().slice(-6)}`;
    const activeReminderDate = generateReminder && reminderDate.trim() ? reminderDate.trim() : undefined;
    const activeReminderTime = generateReminder && reminderTime.trim() ? reminderTime.trim() : undefined;
    const activeReminderNote =
      generateReminder && (reminderNote.trim() || notes.trim())
        ? (reminderNote.trim() || notes.trim())
        : undefined;

    const prevHistory: ObservationHistoryEntry[] = Array.isArray(editingVisit?.observationHistory)
      ? editingVisit!.observationHistory!
      : [];
    const cleanNotes = notes.trim();
    const notesChanged = cleanNotes && cleanNotes !== (editingVisit?.notes || '').trim();
    const reminderAdded = activeReminderDate && activeReminderDate !== (editingVisit?.reminderDate || '');
    const nextHistory: ObservationHistoryEntry[] =
      notesChanged || reminderAdded
        ? [
            {
              id: `obs-${Date.now()}`,
              observationDate: observationDate || new Date().toISOString().split('T')[0],
              text: cleanNotes || activeReminderNote || 'Recordatorio programado',
              reminderDate: activeReminderDate,
              reminderTime: activeReminderTime,
              author: seller.trim() || 'Equipo Pampero',
              createdAt: new Date().toISOString(),
            },
            ...prevHistory,
          ]
        : prevHistory;

    const updatedVisit: LeadVisit = sanitizeObjectEncoding({
      id: visitId,
      trackingCode: resolvedTracking,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      companyLocation: companyLocation.trim() || undefined,
      locationUrl: locationUrl.trim() || undefined,
      seller: seller.trim() || 'Sin asignar',
      branch,
      status: (chosenStep === 'convertida' ? 'cerrada' : chosenStep === 'previo_cotizacion' ? 'presupuesto_enviado' : chosenStep === 'reunion' ? 'realizada' : 'programada') as any,
      columnId: chosenStep,
      step: chosenStep,
      kanbanStep: chosenStep,
      objective: objective.trim(),
      nextStep: nextStep.trim(),
      nextStepDate: nextStepDate.trim() || undefined,
      estimatedUnits: estimatedUnits ? Number(estimatedUnits) : undefined,
      notes: cleanNotes,
      observationDate: cleanNotes || activeReminderDate ? (observationDate || new Date().toISOString().split('T')[0]) : undefined,
      reminderDate: activeReminderDate,
      reminderTime: activeReminderTime,
      reminderNote: activeReminderNote,
      observationHistory: nextHistory.length > 0 ? nextHistory : undefined,
      date,
      createdAt: editingVisit ? editingVisit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Immediate local React state update
    setLocalVisits((prev) => [updatedVisit, ...prev.filter((v) => v.id !== updatedVisit.id)]);

    try {
      await saveLeadVisit(updatedVisit);
      await upsertObservationReminderCalendarEvent('visit', {
        sourceId: visitId,
        title: `${updatedVisit.companyName}${updatedVisit.trackingCode ? ` (${updatedVisit.trackingCode})` : ''}`,
        reminderDate: activeReminderDate || '',
        reminderTime: activeReminderTime,
        reminderNote: activeReminderNote || cleanNotes,
        branch: updatedVisit.branch,
        seller: updatedVisit.seller,
        createdBy: updatedVisit.seller,
      });
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

  // Filter visits from localVisits (con coerción segura a string y alcance RBAC)
  const filteredVisits = localVisits.filter((v) => {
    if (crmScope === 'branch_only' && assignedBranch && String(v.branch ?? '').toLowerCase() !== assignedBranch.toLowerCase()) {
      return false;
    }
    if (crmScope === 'own_only' && assignedSellerName && String(v.seller ?? '').toLowerCase() !== assignedSellerName.toLowerCase()) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    const matchesSeller = sellerFilter === 'todos' || String(v.seller ?? '').toLowerCase() === sellerFilter.toLowerCase();
    const matchesBranch = branchFilter === 'todos' || String(v.branch ?? '').toLowerCase() === branchFilter.toLowerCase();
    const matchesQuery =
      !q.trim() ||
      String(v.companyName ?? '').toLowerCase().includes(q) ||
      String(v.contactName ?? '').toLowerCase().includes(q) ||
      String(v.phone ?? '').toLowerCase().includes(q) ||
      String(v.trackingCode ?? '').toLowerCase().includes(q) ||
      String(v.companyLocation ?? '').toLowerCase().includes(q) ||
      String(v.seller ?? '').toLowerCase().includes(q) ||
      String(v.notes ?? '').toLowerCase().includes(q);
    return matchesSeller && matchesBranch && matchesQuery;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner and Filters */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#18231C]" />
              {st?.crmVisitsTitle || 'Visitas Comerciales'}
            </h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs bg-[#FAF8F5] text-[#18231C] border border-[#DCD4C9]">
              Prospección a Empresas
            </span>
          </div>
          <p className="text-xs text-[#6F6860] mt-0.5">
            {st?.crmVisitsSubtitle ||
              'Flujo paso a paso desde el primer contacto hasta superar "Previo a cotización" (momento en que la empresa pasa automáticamente al tablero de Seguimiento Empresas).'}
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
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Descargar tarjetas de visitas comerciales en Excel"
          >
            <Download className="w-3.5 h-3.5 text-[#18231C]" />
            <span>Descargar Excel</span>
          </button>
          <button
            type="button"
            disabled={isExcelProcessing}
            onClick={() => fileInputVisitsRef.current?.click()}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Subir archivo Excel para actualizar fases y visitas en Firestore"
          >
            <Upload className="w-3.5 h-3.5 text-[#18231C]" />
            <span>{isExcelProcessing ? 'Procesando...' : 'Subir Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => openNewModal('primer_contacto')}
            className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{st?.crmNewVisitBtnText || 'Nueva Empresa / Visita'}</span>
          </button>
        </div>
      </div>

      {/* Excel Notification Banners */}
      {excelError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xs flex items-center justify-between gap-2 text-xs text-red-900 animate-fadeIn">
          <span className="font-semibold">{excelError}</span>
          <button
            type="button"
            onClick={() => setExcelError(null)}
            className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {excelNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs flex items-center justify-between gap-2 text-xs text-emerald-950 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{excelNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExcelNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
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
            {sellerOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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
            placeholder="Buscar empresa, código, contacto o ubicación..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
          />
        </div>

        <label
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xs border text-xs font-bold cursor-pointer select-none transition-colors ${
            compactView
              ? 'bg-[#18231C] text-white border-[#18231C]'
              : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
          }`}
          title="Achicar tarjetas para ver solo los nombres de las empresas"
        >
          <input
            type="checkbox"
            checked={compactView}
            onChange={(e) => setCompactView(e.target.checked)}
            className="accent-[#FDB813] w-3.5 h-3.5 cursor-pointer"
          />
          <span>Solo nombres de empresas</span>
        </label>
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
                className={`bg-[#FAF8F5] rounded-sm border flex flex-col h-full min-h-[520px] transition-all ${
                  isDragTarget ? 'border-[#18231C] bg-amber-50/40 shadow-sm' : 'border-[#DCD4C9]'
                }`}
              >
                {/* Column Header */}
                <div className="px-3.5 py-2.5 border-b border-[#DCD4C9] bg-white rounded-t-sm space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: col.color }}
                      />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] truncate">
                        {fixUtf8Encoding(col.label)}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] text-[11px] font-mono font-bold tabular-nums shrink-0">
                      {colVisits.length}
                    </span>
                  </div>
                  {col.description && (
                    <p className="text-[10px] text-[#6F6860] leading-tight truncate">
                      {fixUtf8Encoding(col.description)}
                    </p>
                  )}
                </div>

                {/* Cards Container */}
                <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto">
                  {colVisits.length === 0 ? (
                    <div className="h-32 border border-dashed border-[#DCD4C9] rounded-sm flex flex-col items-center justify-center text-center p-3 text-[#6F6860] bg-white/40">
                      <p className="text-[11px] font-medium">Sin empresas en esta etapa</p>
                      <button
                        type="button"
                        onClick={() => openNewModal(col.id)}
                        className="mt-1.5 text-[10px] text-[#18231C] hover:underline font-bold cursor-pointer"
                      >
                        + Agregar acá
                      </button>
                    </div>
                  ) : (
                    colVisits.map((visit) => {
                      const currentStep = getVisitStep(visit);

                      if (compactView) {
                        return (
                          <div
                            key={visit.id}
                            draggable
                            onDragStart={() => handleDragStart(visit.id)}
                            onClick={() => setViewingVisit(visit)}
                            className="bg-white rounded-sm px-3 py-2 border border-[#DCD4C9] hover:border-[#18231C] shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-xs text-[#18231C] block truncate uppercase">
                                {fixUtf8Encoding(visit.companyName)}
                              </span>
                              {visit.trackingCode && (
                                <span className="text-[9px] font-mono text-[#6F6860] block truncate">
                                  {visit.trackingCode}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingVisit(visit);
                              }}
                              className="p-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] rounded-xs text-[#18231C] border border-[#DCD4C9] cursor-pointer shrink-0"
                              title="Ver ficha completa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      const hasQuietDetails = Boolean(
                        visit.companyLocation ||
                        visit.locationUrl ||
                        visit.objective ||
                        visit.nextStep ||
                        visit.reminderDate
                      );

                      return (
                        <div
                          key={visit.id}
                          draggable
                          onDragStart={() => handleDragStart(visit.id)}
                          className="bg-white rounded-sm p-3 border border-[#DCD4C9] hover:border-[#18231C] shadow-2xs hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group space-y-2 overflow-hidden"
                        >
                          {/* Line 1: Tracking Code + Branch */}
                          <div className="flex items-center justify-between gap-1.5">
                            {visit.trackingCode ? (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs bg-[#18231C] text-[#FDB813]">
                                {visit.trackingCode}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#8C827A] font-medium">Visita</span>
                            )}
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#ECE5DC] text-[#6F6860] shrink-0">
                              {fixUtf8Encoding(visit.branch || 'Maipú')}
                            </span>
                          </div>

                          {/* Line 2: Company Title + Contact & Quick Info */}
                          <div className="space-y-1">
                            <span className="font-bold text-xs text-[#18231C] block truncate uppercase leading-snug">
                              {fixUtf8Encoding(visit.companyName)}
                            </span>
                            <div className="text-[11px] text-[#4A453F] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="inline-flex items-center gap-1 font-medium text-[#18231C]">
                                <User className="w-3 h-3 text-[#6F6860] shrink-0" />
                                <span>{fixUtf8Encoding(visit.contactName || 'Sin contacto')}</span>
                              </span>
                              {Boolean(visit.phone && String(visit.phone).trim()) && (
                                <a
                                  href={`https://wa.me/${String(visit.phone).replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{String(visit.phone)}</span>
                                </a>
                              )}
                              <span className="text-[#6F6860]">
                                · Resp: <strong className="text-[#18231C]">{fixUtf8Encoding(visit.seller || 'Sin asignar')}</strong>
                              </span>
                              {visit.estimatedUnits && (
                                <span className="text-[#18231C] font-bold font-mono tabular-nums">
                                  · Est. {visit.estimatedUnits} u.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Line 3: Quiet Single-Box Detail Block (all extra info without visual noise) */}
                          {hasQuietDetails && (
                            <div className="bg-[#FAF8F5] border border-[#ECE5DC] rounded-xs px-2.5 py-2 space-y-1 text-[11px] text-[#4A453F]">
                              {(visit.companyLocation || visit.locationUrl) && (
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-[#6F6860] shrink-0" />
                                    <span className="truncate">{fixUtf8Encoding(visit.companyLocation || 'Ubicación registrada')}</span>
                                  </span>
                                  {visit.locationUrl && (
                                    <a
                                      href={visit.locationUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[#18231C] hover:underline font-bold shrink-0 inline-flex items-center gap-0.5 text-[10px]"
                                      title="Abrir mapa en Google Maps"
                                    >
                                      <span>Mapa</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {visit.objective && (
                                <p className="leading-snug text-[#4A453F] line-clamp-2">
                                  <strong className="text-[#18231C]">Obj.:</strong> {fixUtf8Encoding(visit.objective)}
                                </p>
                              )}

                              {visit.nextStep && (
                                <div className="flex items-center gap-1 text-[#18231C] truncate">
                                  <Clock className="w-3 h-3 text-[#6F6860] shrink-0" />
                                  <span className="truncate">
                                    Próx.{visit.nextStepDate ? ` (${visit.nextStepDate})` : ''}:{' '}
                                    <strong>{fixUtf8Encoding(visit.nextStep)}</strong>
                                  </span>
                                </div>
                              )}

                              {visit.reminderDate && (
                                <div className="flex items-center gap-1 text-[#18231C] font-semibold truncate">
                                  <Bell className="w-3 h-3 text-[#18231C] shrink-0" />
                                  <span className="truncate">
                                    Recordatorio: {visit.reminderDate}{visit.reminderTime ? ` ${visit.reminderTime}hs` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Line 4: Unified Action Controls */}
                          <div className="pt-1.5 border-t border-[#ECE5DC] flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setViewingVisit(visit)}
                                className="px-2 py-1 bg-[#FAF8F5] hover:bg-[#ECE5DC] rounded-xs text-[#18231C] border border-[#DCD4C9] cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-colors"
                                title="Ver ficha completa"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ficha</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(visit.id)}
                                className="p-1 bg-[#FAF8F5] hover:bg-red-50 rounded-xs text-[#6F6860] hover:text-red-600 border border-[#DCD4C9] cursor-pointer transition-colors"
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
                                      className="text-[10px] px-2.5 py-1 rounded-xs flex items-center gap-1 cursor-pointer transition-colors font-bold text-white bg-[#18231C] hover:bg-black"
                                      title={`Avanzar a ${nextCol.label}`}
                                    >
                                      <span>{isConverting ? 'A Seguimiento' : `A ${nextCol.label}`}</span>
                                      {isConverting ? (
                                        <ArrowRightCircle className="w-3 h-3 text-[#FDB813]" />
                                      ) : (
                                        <ArrowRight className="w-3 h-3 text-[#FDB813]" />
                                      )}
                                    </button>
                                  );
                                }

                                if (isLastCol) {
                                  return (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-xs flex items-center gap-1">
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

      {/* Modal Ver Ficha Completa (con lápiz para editar adentro) */}
      {viewingVisit && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {viewingVisit.trackingCode && (
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-xs bg-[#FDB813] text-[#18231C]">
                      {viewingVisit.trackingCode}
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold text-[#DCD4C9]">
                    {fixUtf8Encoding(viewingVisit.branch || 'Maipú')}
                  </span>
                </div>
                <h4 className="font-bold text-base uppercase tracking-wider truncate mt-1">
                  {fixUtf8Encoding(viewingVisit.companyName)}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingVisit(null)}
                className="text-white/70 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 bg-[#FAF8F5] p-3 rounded-xs border border-[#DCD4C9]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Contacto</span>
                  <span className="font-bold text-[#18231C]">{fixUtf8Encoding(viewingVisit.contactName || 'Sin contacto')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Vendedor Asignado</span>
                  <span className="font-bold text-[#18231C]">{fixUtf8Encoding(viewingVisit.seller || 'Sin asignar')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Teléfono / WhatsApp</span>
                  {viewingVisit.phone ? (
                    <a
                      href={`https://wa.me/${String(viewingVisit.phone).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {viewingVisit.phone}
                    </a>
                  ) : (
                    <span className="text-neutral-500">Sin teléfono</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Email</span>
                  <span className="font-medium text-[#18231C] break-all">{viewingVisit.email || 'Sin email'}</span>
                </div>
              </div>

              {/* Ubicación de la empresa para entregas / cadetería */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xs space-y-1.5">
                <span className="text-[10px] font-black uppercase text-blue-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-700" />
                  <span>Ubicación de la Empresa (Entrega / Logística)</span>
                </span>
                <p className="text-xs font-semibold text-blue-950">
                  {fixUtf8Encoding(viewingVisit.companyLocation || 'Sin dirección / zona cargada')}
                </p>
                {viewingVisit.locationUrl && (
                  <a
                    href={viewingVisit.locationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xs text-[11px] font-bold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir Ubicación en Google Maps</span>
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Fecha Registro</span>
                  <span className="font-bold text-[#18231C]">{viewingVisit.date || '-'}</span>
                </div>
                <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Unidades Estimadas</span>
                  <span className="font-bold text-amber-900">
                    {viewingVisit.estimatedUnits ? `${viewingVisit.estimatedUnits} prendas` : 'No especificado'}
                  </span>
                </div>
              </div>

              {viewingVisit.objective && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block mb-1">Objetivo del Contacto</span>
                  <p className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[#18231C]">
                    {fixUtf8Encoding(viewingVisit.objective)}
                  </p>
                </div>
              )}

              {(viewingVisit.nextStep || viewingVisit.nextStepDate) && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-800 block mb-1">
                    Próximo Paso {viewingVisit.nextStepDate ? `(${viewingVisit.nextStepDate})` : ''}
                  </span>
                  <p className="p-2.5 bg-purple-50 border border-purple-200 rounded-xs text-purple-950 font-semibold">
                    {fixUtf8Encoding(viewingVisit.nextStep || 'Seguimiento programado')}
                  </p>
                </div>
              )}

              {(viewingVisit.notes || viewingVisit.reminderDate || (viewingVisit.observationHistory && viewingVisit.observationHistory.length > 0)) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#8C827A]">
                      Observaciones {viewingVisit.observationDate ? `(${viewingVisit.observationDate})` : ''}
                    </span>
                    {viewingVisit.reminderDate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-xs flex items-center gap-1">
                        <Bell className="w-3 h-3 text-[#B9522F]" />
                        Recordatorio: {viewingVisit.reminderDate} {viewingVisit.reminderTime || ''}
                      </span>
                    )}
                  </div>
                  {viewingVisit.notes && (
                    <p className="p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-[#18231C] whitespace-pre-wrap">
                      {fixUtf8Encoding(viewingVisit.notes)}
                    </p>
                  )}
                  {Array.isArray(viewingVisit.observationHistory) && viewingVisit.observationHistory.length > 1 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto pt-1">
                      <span className="text-[9px] font-bold uppercase text-[#8C827A] block">Historial de observaciones:</span>
                      {viewingVisit.observationHistory.map((h) => (
                        <div key={h.id} className="text-[10px] p-1.5 bg-white border border-[#ECE5DC] rounded-xs">
                          <span className="font-bold text-[#18231C]">{h.observationDate} · {fixUtf8Encoding(h.author)}:</span>{' '}
                          <span className="text-[#4A453F]">{fixUtf8Encoding(h.text)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowVisitObsModal(true)}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-[#18231C]" />
                  <span className="tabular-nums">
                    Observaciones ({Array.isArray(viewingVisit.observationHistory) ? viewingVisit.observationHistory.length : viewingVisit.notes ? 1 : 0})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = viewingVisit;
                    setViewingVisit(null);
                    openEditModal(target);
                  }}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#18231C]" />
                  <span>Editar Ficha</span>
                </button>

                {getVisitStep(viewingVisit) !== 'convertida' && onPromoteToCompanies && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingVisit;
                      setViewingVisit(null);
                      handleMoveStep(target, 'convertida');
                    }}
                    className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5 text-[#18231C]" />
                    <span>Pasar a Seguimiento</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingVisit(null)}
                className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal Observaciones para Visitas Comerciales */}
      {viewingVisit && (
        <CRMObservationsModal
          isOpen={showVisitObsModal}
          onClose={() => setShowVisitObsModal(false)}
          entityTitle={viewingVisit.companyName}
          trackingCode={viewingVisit.trackingCode}
          branch={viewingVisit.branch}
          currentObservation={viewingVisit.notes}
          currentObservationDate={viewingVisit.observationDate}
          currentReminderDate={viewingVisit.reminderDate}
          currentReminderTime={viewingVisit.reminderTime}
          currentReminderNote={viewingVisit.reminderNote}
          history={viewingVisit.observationHistory}
          activeStaffUser={assignedSellerName || viewingVisit.seller || 'Equipo Pampero'}
          onSaveObservation={async (payload) => {
            const updated: LeadVisit = sanitizeObjectEncoding({
              ...viewingVisit,
              notes: payload.observations,
              observationDate: payload.observationDate,
              reminderDate: payload.reminderDate,
              reminderTime: payload.reminderTime,
              reminderNote: payload.reminderNote,
              observationHistory: payload.observationHistory,
              updatedAt: new Date().toISOString(),
            });
            setViewingVisit(updated);
            setLocalVisits((prev) => {
              const next = [updated, ...prev.filter((v) => v.id !== updated.id)];
              if (onVisitsUpdated) onVisitsUpdated(next);
              return next;
            });
            await saveLeadVisit(updated);
            if (payload.reminderDate) {
              await upsertObservationReminderCalendarEvent('visit', {
                sourceId: updated.id,
                title: `${updated.companyName}${updated.trackingCode ? ` (${updated.trackingCode})` : ''}`,
                reminderDate: payload.reminderDate,
                reminderTime: payload.reminderTime,
                reminderNote: payload.reminderNote || payload.observations,
                branch: updated.branch,
                seller: updated.seller,
                createdBy: assignedSellerName || updated.seller || 'Equipo Pampero',
              });
            }
          }}
        />
      )}

      {/* Modal Nueva / Editar Visita */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-sm uppercase text-[#18231C]">
                  {editingVisit ? 'Editar Empresa / Visita Comercial' : 'Nueva Empresa / Visita Comercial'}
                </h4>
                {editingVisit?.trackingCode && (
                  <span className="text-[10px] font-mono font-bold text-[#B9522F]">
                    Seguimiento: {editingVisit.trackingCode}
                  </span>
                )}
              </div>
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

              {/* Ubicación física y link de mapa para reparto/visitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF8F5] p-2.5 rounded-xs border border-[#DCD4C9]">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Ubicación / Dirección de la Empresa</label>
                  <input
                    type="text"
                    value={companyLocation}
                    onChange={(e) => setCompanyLocation(e.target.value)}
                    placeholder="Ej: Carril Rodríguez Peña 2400, Maipú"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Link Google Maps (opcional)</label>
                  <input
                    type="url"
                    value={locationUrl}
                    onChange={(e) => setLocationUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Vendedor Asignado</label>
                  <input
                    type="text"
                    list="visits-sellers-datalist"
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    placeholder="Nombre del vendedor"
                    className="w-full px-2.5 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                  <datalist id="visits-sellers-datalist">
                    {sellerOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-neutral-700 mb-1">Próximo Paso Acordado</label>
                  <input
                    type="text"
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="Ej: Enviar muestras de talle"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Fecha Próx. Paso</label>
                  <input
                    type="date"
                    value={nextStepDate}
                    onChange={(e) => setNextStepDate(e.target.value)}
                    className="w-full px-2 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Fecha Visita</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
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

              <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="font-bold text-neutral-700">Observaciones / Requerimientos</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#6F6860]">Fecha Obs.:</span>
                    <input
                      type="date"
                      value={observationDate}
                      onChange={(e) => setObservationDate(e.target.value)}
                      className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none focus:border-[#B9522F]"
                    />
                  </div>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre bordados de logo, plazos urgentes, etc."
                  className="w-full p-2.5 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F] resize-none"
                />

                {/* Recordatorio automático en Calendario y Centro de Notificaciones */}
                <div className="pt-2 border-t border-[#DCD4C9]/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#18231C] text-[11px]">
                    <input
                      type="checkbox"
                      checked={generateReminder}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setGenerateReminder(checked);
                        if (checked && !reminderDate) {
                          setReminderDate(nextStepDate || new Date().toISOString().split('T')[0]);
                        }
                      }}
                      className="accent-[#B9522F] w-3.5 h-3.5 cursor-pointer"
                    />
                    <Bell className="w-3.5 h-3.5 text-[#B9522F]" />
                    <span>Generar notificación y evento recordatorio en Calendario</span>
                  </label>

                  {generateReminder && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                          Fecha Recordatorio *
                        </label>
                        <input
                          type="date"
                          required={generateReminder}
                          value={reminderDate}
                          onChange={(e) => setReminderDate(e.target.value)}
                          className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none focus:border-[#B9522F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                          Hora (opcional)
                        </label>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none focus:border-[#B9522F]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-0.5">
                          Texto de Aviso
                        </label>
                        <input
                          type="text"
                          value={reminderNote}
                          onChange={(e) => setReminderNote(e.target.value)}
                          placeholder="Ej: Llamar para confirmar muestra"
                          className="w-full px-2 py-1.5 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none focus:border-[#B9522F]"
                        />
                      </div>
                    </div>
                  )}
                </div>
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
                  className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] font-bold uppercase rounded-xs transition-colors cursor-pointer"
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
