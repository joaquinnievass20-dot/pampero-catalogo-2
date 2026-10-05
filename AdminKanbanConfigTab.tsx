import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Check, 
  LayoutDashboard, 
  Building2, 
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Palette,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  saveKanbanColumns, 
  subscribeToKanbanColumns, 
  DEFAULT_VISIT_COLUMNS, 
  DEFAULT_COMPANY_COLUMNS, 
  KanbanColumnConfig 
} from '../../services/firebase';

interface AdminKanbanConfigTabProps {
  triggerSaveNotice?: () => void;
}

export const AdminKanbanConfigTab: React.FC<AdminKanbanConfigTabProps> = ({ triggerSaveNotice }) => {
  const [activeBoard, setActiveBoard] = useState<'visits' | 'companies'>('visits');
  const [visitColumns, setVisitColumns] = useState<KanbanColumnConfig[]>(DEFAULT_VISIT_COLUMNS);
  const [companyColumns, setCompanyColumns] = useState<KanbanColumnConfig[]>(DEFAULT_COMPANY_COLUMNS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New column modal/form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColColor, setNewColColor] = useState('#3B82F6');
  const [newColDesc, setNewColDesc] = useState('');

  // Sync from Cloud Firestore / localStorage
  useEffect(() => {
    const unsub = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.visits) && data.visits.length > 0) {
        setVisitColumns(data.visits);
      }
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanyColumns(data.companies);
      }
    });
    return () => unsub();
  }, []);

  const currentColumns = activeBoard === 'visits' ? visitColumns : companyColumns;

  const handleUpdateCol = (idx: number, field: keyof KanbanColumnConfig, val: string) => {
    if (activeBoard === 'visits') {
      setVisitColumns((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
      });
    } else {
      setCompanyColumns((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
      });
    }
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newColLabel.trim();
    if (!trimmed) {
      setFeedbackNotice({ type: 'error', message: 'Ingresá un título para la columna.' });
      return;
    }

    const cleanId = trimmed.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20) || `col_${Date.now()}`;

    const newCol: KanbanColumnConfig = {
      id: `${cleanId}_${Date.now().toString().slice(-4)}`,
      label: trimmed,
      color: newColColor,
      description: newColDesc.trim() || undefined,
    };

    if (activeBoard === 'visits') {
      setVisitColumns((prev) => [...prev, newCol]);
    } else {
      setCompanyColumns((prev) => [...prev, newCol]);
    }

    setNewColLabel('');
    setNewColDesc('');
    setShowAddForm(false);
    setFeedbackNotice({ type: 'success', message: `Columna "${trimmed}" agregada. Recordá presionar "Guardar Columnas" para aplicar a los tableros.` });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleDeleteColumn = (idx: number, label: string) => {
    if (currentColumns.length <= 2) {
      alert('El tablero debe tener al menos 2 columnas.');
      return;
    }
    if (!confirm(`¿Eliminar la columna "${label}" del tablero?`)) return;

    if (activeBoard === 'visits') {
      setVisitColumns((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCompanyColumns((prev) => prev.filter((_, i) => i !== idx));
    }
    setFeedbackNotice({ type: 'success', message: `Columna "${label}" eliminada del borrador. Presioná "Guardar Columnas" para confirmar.` });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleMoveColumn = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentColumns.length) return;

    const list = [...currentColumns];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    if (activeBoard === 'visits') {
      setVisitColumns(list);
    } else {
      setCompanyColumns(list);
    }
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const success = await saveKanbanColumns({
      visits: visitColumns,
      companies: companyColumns,
    });

    setIsSaving(false);
    if (success) {
      setSaveSuccess(true);
      setFeedbackNotice({ type: 'success', message: '¡Columnas guardadas y sincronizadas con éxito en Cloud Firestore!' });
      if (triggerSaveNotice) triggerSaveNotice();
      setTimeout(() => {
        setSaveSuccess(false);
        setFeedbackNotice(null);
      }, 3500);
    } else {
      setFeedbackNotice({ type: 'error', message: 'Error al sincronizar con Cloud Firestore.' });
    }
  };

  const handleResetDefaults = () => {
    if (!confirm('¿Restablecer las columnas a los nombres oficiales predeterminados de Pampero?')) return;
    if (activeBoard === 'visits') {
      setVisitColumns(DEFAULT_VISIT_COLUMNS);
    } else {
      setCompanyColumns(DEFAULT_COMPANY_COLUMNS);
    }
    setFeedbackNotice({ type: 'success', message: 'Columnas restablecidas a valores de fábrica. Presioná "Guardar Columnas" para confirmar.' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#18231C] text-[#FDB813] rounded-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Editar Gestión · Columnas de Tableros Kanban
              </h3>
              <p className="text-xs text-[#6F6860]">
                Podés agregar, renombrar, cambiar color o eliminar las etapas de ambos tableros ("Visitas comerciales" y "Seguimiento empresas").
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
            title="Restablecer nombres predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Predeterminados</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveToCloud}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Columnas'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className={`p-4 rounded-xs text-xs font-semibold flex items-center gap-2 ${
          feedbackNotice.type === 'success'
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
            : 'bg-red-50 border border-red-300 text-red-900'
        }`}>
          {feedbackNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{feedbackNotice.message}</span>
        </div>
      )}

      {/* Board Selector Tabs */}
      <div className="flex border-b border-[#DCD4C9] bg-white px-4 pt-3 gap-2 rounded-t-xs">
        <button
          type="button"
          onClick={() => {
            setActiveBoard('visits');
            setShowAddForm(false);
          }}
          className={`py-2 px-4 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'visits'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Tablero: Visitas Comerciales ({visitColumns.length} columnas)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBoard('companies');
            setShowAddForm(false);
          }}
          className={`py-2 px-4 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'companies'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>2. Tablero: Seguimiento Empresas ({companyColumns.length} columnas)</span>
        </button>
      </div>

      {/* Column Editor Container */}
      <div className="bg-white p-5 rounded-b-xs border border-[#DCD4C9] shadow-2xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-[#6F6860]">
            Editá los pasos para el tablero de <strong>{activeBoard === 'visits' ? 'Visitas comerciales' : 'Seguimiento empresas'}</strong>. Podés reordenarlas, cambiarles el color y agregar nuevos pasos según la necesidad comercial.
          </p>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#FDB813]" />
            <span>{showAddForm ? 'Cancelar' : 'Agregar Columna'}</span>
          </button>
        </div>

        {/* Add Column Mini-Form */}
        {showAddForm && (
          <form onSubmit={handleAddColumn} className="p-4 bg-amber-50/70 border border-amber-300 rounded-xs space-y-3 animate-fadeIn">
            <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#B9522F]" />
              Crear Nuevo Paso / Columna para {activeBoard === 'visits' ? 'Visitas Comerciales' : 'Seguimiento Empresas'}
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Título de la Columna *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Demostración de Muestras, En Espera de Seña..."
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Color Identificador</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColColor}
                    onChange={(e) => setNewColColor(e.target.value)}
                    className="w-9 h-8 rounded-xs border border-[#DCD4C9] cursor-pointer"
                  />
                  <span className="font-mono text-xs text-neutral-700 font-bold">{newColColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-700 block mb-1">Descripción / Instrucción para el Vendedor (Opcional)</label>
              <input
                type="text"
                placeholder="Detalle o instrucción que guíe al vendedor en este paso..."
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Columna al Tablero</span>
              </button>
            </div>
          </form>
        )}

        {/* Existing Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentColumns.map((col, idx) => (
            <div
              key={col.id}
              className="p-4 rounded-xs border border-[#DCD4C9] bg-[#FAF8F5] space-y-3.5 relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-xs"
              style={{ borderTopWidth: 4, borderTopColor: col.color }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#6F6860]">
                    Etapa #{idx + 1}
                  </span>
                  <span className="font-mono text-[9px] text-neutral-400 truncate max-w-[100px]" title={col.id}>
                    {col.id}
                  </span>
                </div>

                {/* Title input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#18231C] block uppercase">
                    Título de la Columna:
                  </label>
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => handleUpdateCol(idx, 'label', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
                  />
                </div>

                {/* Description input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#6F6860] block">
                    Descripción / Guía:
                  </label>
                  <textarea
                    rows={2}
                    value={col.description || ''}
                    onChange={(e) => handleUpdateCol(idx, 'description', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C] resize-none"
                    placeholder="Instrucción de este paso..."
                  />
                </div>

                {/* Color Picker */}
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[11px] font-bold text-[#6F6860] flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Color:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={col.color}
                      onChange={(e) => handleUpdateCol(idx, 'color', e.target.value)}
                      className="w-7 h-7 rounded-xs border border-[#DCD4C9] cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-neutral-600">
                      {col.color}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar: Move left/right and Delete */}
              <div className="flex items-center justify-between pt-3 border-t border-[#DCD4C9]/70">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveColumn(idx, 'left')}
                    className="p-1 rounded-xs bg-white border border-[#DCD4C9] hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-neutral-700"
                    title="Mover columna a la izquierda"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === currentColumns.length - 1}
                    onClick={() => handleMoveColumn(idx, 'right')}
                    className="p-1 rounded-xs bg-white border border-[#DCD4C9] hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-neutral-700"
                    title="Mover columna a la derecha"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteColumn(idx, col.label)}
                  className="px-2 py-1 text-[11px] text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xs flex items-center gap-1 font-bold cursor-pointer transition-colors"
                  title="Eliminar esta columna"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
