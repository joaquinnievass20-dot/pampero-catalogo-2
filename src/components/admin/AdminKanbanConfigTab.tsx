import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  LayoutDashboard, 
  Building2, 
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Palette,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Tag,
  ClipboardList
} from 'lucide-react';
import { CRMTaskImportance, CRMTaskTag, CRMTaskTemplate } from '../../types';
import { 
  saveKanbanColumns, 
  subscribeToKanbanColumns, 
  DEFAULT_VISIT_COLUMNS, 
  DEFAULT_COMPANY_COLUMNS, 
  DEFAULT_TASK_COLUMNS,
  KanbanColumnConfig,
  DEFAULT_TASK_TAGS,
  DEFAULT_TASK_TEMPLATES,
  saveCRMTaskConfig,
  subscribeToCRMTaskConfig
} from '../../services/firebase';
import { sanitizeObjectEncoding } from '../../utils/encodingUtils';

interface AdminKanbanConfigTabProps {
  triggerSaveNotice?: () => void;
}

export const AdminKanbanConfigTab: React.FC<AdminKanbanConfigTabProps> = ({ triggerSaveNotice }) => {
  const [activeBoard, setActiveBoard] = useState<'visits' | 'companies' | 'tasks' | 'templates' | 'tags'>('visits');
  const [visitColumns, setVisitColumns] = useState<KanbanColumnConfig[]>(DEFAULT_VISIT_COLUMNS);
  const [companyColumns, setCompanyColumns] = useState<KanbanColumnConfig[]>(DEFAULT_COMPANY_COLUMNS);
  const [taskColumns, setTaskColumns] = useState<KanbanColumnConfig[]>(DEFAULT_TASK_COLUMNS);
  const [taskTags, setTaskTags] = useState<CRMTaskTag[]>(DEFAULT_TASK_TAGS);
  const [taskTemplates, setTaskTemplates] = useState<CRMTaskTemplate[]>(DEFAULT_TASK_TEMPLATES);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New column modal/form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColColor, setNewColColor] = useState('#3B82F6');
  const [newColDesc, setNewColDesc] = useState('');

  // New Tag form
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563EB');

  // New Template form
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tplTitle, setTplTitle] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplImportance, setTplImportance] = useState<CRMTaskImportance>('media');
  const [tplTags, setTplTags] = useState<string[]>([]);
  const [tplRequiredAdvance, setTplRequiredAdvance] = useState('');
  const [tplTargetProgress, setTplTargetProgress] = useState(100);
  const [tplBranch, setTplBranch] = useState('Todas');

  // Sync from Cloud Firestore / localStorage
  useEffect(() => {
    const unsubCols = subscribeToKanbanColumns((data) => {
      if (Array.isArray(data.visits) && data.visits.length > 0) {
        setVisitColumns(data.visits.map(sanitizeObjectEncoding));
      }
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        setCompanyColumns(data.companies.map(sanitizeObjectEncoding));
      }
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        setTaskColumns(data.tasks.map(sanitizeObjectEncoding));
      }
    });
    const unsubTaskCfg = subscribeToCRMTaskConfig((cfg) => {
      if (Array.isArray(cfg.tags)) setTaskTags(cfg.tags);
      if (Array.isArray(cfg.templates)) setTaskTemplates(cfg.templates);
    });
    return () => {
      unsubCols();
      unsubTaskCfg();
    };
  }, []);

  const currentColumns =
    activeBoard === 'visits' ? visitColumns : activeBoard === 'companies' ? companyColumns : taskColumns;

  const handleUpdateCol = (idx: number, field: keyof KanbanColumnConfig, val: string) => {
    const updater = (prev: KanbanColumnConfig[]) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    };
    if (activeBoard === 'visits') setVisitColumns(updater);
    else if (activeBoard === 'companies') setCompanyColumns(updater);
    else setTaskColumns(updater);
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

    const newCol: KanbanColumnConfig = sanitizeObjectEncoding({
      id: `${cleanId}_${Date.now().toString().slice(-4)}`,
      label: trimmed,
      color: newColColor,
      description: newColDesc.trim() || undefined,
    });

    if (activeBoard === 'visits') {
      setVisitColumns((prev) => [...prev, newCol]);
    } else if (activeBoard === 'companies') {
      setCompanyColumns((prev) => [...prev, newCol]);
    } else {
      setTaskColumns((prev) => [...prev, newCol]);
    }

    setNewColLabel('');
    setNewColDesc('');
    setShowAddForm(false);
    setFeedbackNotice({ type: 'success', message: `Columna "${trimmed}" agregada. Presioná "Guardar Configuración" para aplicar.` });
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
    } else if (activeBoard === 'companies') {
      setCompanyColumns((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setTaskColumns((prev) => prev.filter((_, i) => i !== idx));
    }
    setFeedbackNotice({ type: 'success', message: `Columna "${label}" eliminada del borrador. Presioná "Guardar Configuración" para confirmar.` });
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
    } else if (activeBoard === 'companies') {
      setCompanyColumns(list);
    } else {
      setTaskColumns(list);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagName.trim();
    if (!clean) return;
    if (taskTags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      setFeedbackNotice({ type: 'error', message: `Ya existe una etiqueta llamada "${clean}".` });
      return;
    }
    setTaskTags((prev) => [...prev, { id: `tag-${Date.now()}`, name: clean, color: newTagColor }]);
    setNewTagName('');
    setFeedbackNotice({ type: 'success', message: `Etiqueta "${clean}" agregada. Presioná "Guardar Configuración" para sincronizar.` });
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tplTitle.trim();
    if (!clean) return;
    const newTpl: CRMTaskTemplate = {
      id: `tpl-${Date.now()}`,
      title: clean,
      description: tplDesc.trim() || undefined,
      defaultImportance: tplImportance,
      defaultTags: tplTags,
      defaultRequiredAdvance: tplRequiredAdvance.trim() || undefined,
      defaultTargetProgressPercent: Math.max(10, Math.min(100, Number(tplTargetProgress) || 100)),
      defaultBranch: tplBranch,
    };
    setTaskTemplates((prev) => [newTpl, ...prev]);
    setTplTitle('');
    setTplDesc('');
    setTplImportance('media');
    setTplTags([]);
    setTplRequiredAdvance('');
    setTplTargetProgress(100);
    setTplBranch('Todas');
    setShowTemplateForm(false);
    setFeedbackNotice({ type: 'success', message: `Tarea preestablecida "${clean}" agregada. Presioná "Guardar Configuración" para aplicar.` });
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const [colsOk, taskCfgRes] = await Promise.all([
      saveKanbanColumns({
        visits: visitColumns,
        companies: companyColumns,
        tasks: taskColumns,
      }),
      saveCRMTaskConfig(taskTags, taskTemplates),
    ]);

    setIsSaving(false);
    if (colsOk && taskCfgRes.success) {
      setSaveSuccess(true);
      setFeedbackNotice({ type: 'success', message: '¡Configuración de Tableros, Plantillas y Etiquetas guardada en Cloud Firestore!' });
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
    if (!confirm('¿Restablecer los valores de esta pestaña a los predeterminados de Pampero?')) return;
    if (activeBoard === 'visits') {
      setVisitColumns(DEFAULT_VISIT_COLUMNS);
    } else if (activeBoard === 'companies') {
      setCompanyColumns(DEFAULT_COMPANY_COLUMNS);
    } else if (activeBoard === 'tasks') {
      setTaskColumns(DEFAULT_TASK_COLUMNS);
    } else if (activeBoard === 'tags') {
      setTaskTags(DEFAULT_TASK_TAGS);
    } else if (activeBoard === 'templates') {
      setTaskTemplates(DEFAULT_TASK_TEMPLATES);
    }
    setFeedbackNotice({ type: 'success', message: 'Valores restablecidos. Presioná "Guardar Configuración" para confirmar.' });
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
                Editar Gestión · Tableros Kanban, Tareas Preestablecidas y Etiquetas
              </h3>
              <p className="text-xs text-[#6F6860]">
                Configurá las columnas de los tableros, creá plantillas de tareas recurrentes y administrá etiquetas de filtrado.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
            title="Restablecer predeterminados"
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
                <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
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
      <div className="flex flex-wrap border-b border-[#DCD4C9] bg-white px-4 pt-3 gap-2 rounded-t-xs">
        <button
          type="button"
          onClick={() => {
            setActiveBoard('visits');
            setShowAddForm(false);
          }}
          className={`py-2 px-3.5 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'visits'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Visitas Comerciales ({visitColumns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBoard('companies');
            setShowAddForm(false);
          }}
          className={`py-2 px-3.5 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'companies'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>2. Seguimiento Empresas ({companyColumns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBoard('tasks');
            setShowAddForm(false);
          }}
          className={`py-2 px-3.5 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'tasks'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>3. Columnas Tareas ({taskColumns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBoard('templates');
            setShowAddForm(false);
          }}
          className={`py-2 px-3.5 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'templates'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>4. Tareas Preestablecidas ({taskTemplates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBoard('tags');
            setShowAddForm(false);
          }}
          className={`py-2 px-3.5 border-b-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
            activeBoard === 'tags'
              ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>5. Etiquetas de Tareas ({taskTags.length})</span>
        </button>
      </div>

      {/* PANEL 1-3: KANBAN COLUMNS */}
      {(activeBoard === 'visits' || activeBoard === 'companies' || activeBoard === 'tasks') && (
        <div className="bg-white p-5 rounded-b-xs border border-[#DCD4C9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-[#6F6860]">
              Editá los pasos para el tablero de{' '}
              <strong>
                {activeBoard === 'visits'
                  ? 'Visitas comerciales'
                  : activeBoard === 'companies'
                  ? 'Seguimiento empresas'
                  : 'Tareas del equipo'}
              </strong>
              . Podés reordenarlas, cambiarles el color y agregar nuevos pasos según la necesidad operativa.
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

          {showAddForm && (
            <form onSubmit={handleAddColumn} className="p-4 bg-amber-50/70 border border-amber-300 rounded-xs space-y-3 animate-fadeIn">
              <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#B9522F]" />
                Crear Nuevo Paso / Columna para{' '}
                {activeBoard === 'visits'
                  ? 'Visitas Comerciales'
                  : activeBoard === 'companies'
                  ? 'Seguimiento Empresas'
                  : 'Tareas del Equipo'}
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
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Descripción / Instrucción (Opcional)</label>
                <input
                  type="text"
                  placeholder="Detalle o instrucción que guíe al equipo en este paso..."
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
      )}

      {/* PANEL 4: TAREAS PREESTABLECIDAS */}
      {activeBoard === 'templates' && (
        <div className="bg-white p-5 rounded-b-xs border border-[#DCD4C9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
                Plantillas de Tareas Preestablecidas
              </h4>
              <p className="text-xs text-[#6F6860]">
                Aparecen en el desplegable de "Nueva Tarea" en Gestión para cargar tareas habituales en segundos (luego el usuario solo ajusta fecha, responsables o descripción).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplateForm((prev) => !prev)}
              className="px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FDB813]" />
              <span>{showTemplateForm ? 'Cancelar' : 'Nueva Plantilla'}</span>
            </button>
          </div>

          {showTemplateForm && (
            <form onSubmit={handleAddTemplate} className="p-4 bg-amber-50/70 border border-amber-300 rounded-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#18231C] block mb-1">Título de la Tarea Preestablecida *</label>
                  <input
                    type="text"
                    required
                    value={tplTitle}
                    onChange={(e) => setTplTitle(e.target.value)}
                    placeholder="Ej: Control semanal de stock y curva de talles"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#18231C] block mb-1">Importancia Inicial</label>
                  <select
                    value={tplImportance}
                    onChange={(e) => setTplImportance(e.target.value as CRMTaskImportance)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#18231C] block mb-1">Descripción Base</label>
                <textarea
                  rows={2}
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  placeholder="Detalle de lo que debe realizarse..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#18231C] block mb-1">Meta de Avance Requerida</label>
                  <input
                    type="text"
                    value={tplRequiredAdvance}
                    onChange={(e) => setTplRequiredAdvance(e.target.value)}
                    placeholder="Ej: Listado verificado"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#18231C] block mb-1">% Meta Esperado</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={tplTargetProgress}
                    onChange={(e) => setTplTargetProgress(Number(e.target.value) || 100)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#18231C] block mb-1">Sucursal Sugerida</label>
                  <select
                    value={tplBranch}
                    onChange={(e) => setTplBranch(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  >
                    <option value="Todas">Todas</option>
                    <option value="Maipú">Maipú</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Luján">Luján</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#18231C] block mb-1.5">Etiquetas Asignadas:</label>
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tag) => {
                    const active = tplTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setTplTags((prev) => (active ? prev.filter((t) => t !== tag.name) : [...prev, tag.name]))
                        }
                        className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border cursor-pointer transition-colors ${
                          active ? 'text-white border-transparent' : 'bg-white text-[#18231C] border-[#DCD4C9]'
                        }`}
                        style={active ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Plantilla</span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskTemplates.map((tpl, idx) => (
              <div key={tpl.id} className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={tpl.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskTemplates((prev) => prev.map((item, i) => (i === idx ? { ...item, title: val } : item)));
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTaskTemplates((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer"
                    title="Eliminar plantilla"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={tpl.description || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTaskTemplates((prev) => prev.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                  }}
                  placeholder="Descripción base..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={tpl.defaultImportance}
                    onChange={(e) => {
                      const val = e.target.value as CRMTaskImportance;
                      setTaskTemplates((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, defaultImportance: val } : item))
                      );
                    }}
                    className="px-2 py-1 text-[11px] font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>

                  <select
                    value={tpl.defaultBranch || 'Todas'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskTemplates((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, defaultBranch: val } : item))
                      );
                    }}
                    className="px-2 py-1 text-[11px] bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  >
                    <option value="Todas">Todas</option>
                    <option value="Maipú">Maipú</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Luján">Luján</option>
                  </select>

                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={tpl.defaultTargetProgressPercent || 100}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 100;
                      setTaskTemplates((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, defaultTargetProgressPercent: val } : item))
                      );
                    }}
                    className="px-2 py-1 text-[11px] bg-white border border-[#DCD4C9] rounded-xs outline-none"
                    title="% Meta de avance"
                  />
                </div>

                <input
                  type="text"
                  value={tpl.defaultRequiredAdvance || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTaskTemplates((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, defaultRequiredAdvance: val } : item))
                    );
                  }}
                  placeholder="Qué se necesita de avance..."
                  className="w-full px-2.5 py-1 text-[11px] bg-white border border-[#DCD4C9] rounded-xs outline-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tag) => {
                    const active = (tpl.defaultTags || []).includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setTaskTemplates((prev) =>
                            prev.map((item, i) => {
                              if (i !== idx) return item;
                              const curr = item.defaultTags || [];
                              return {
                                ...item,
                                defaultTags: active ? curr.filter((t) => t !== tag.name) : [...curr, tag.name],
                              };
                            })
                          );
                        }}
                        className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border cursor-pointer ${
                          active ? 'text-white border-transparent' : 'bg-white text-[#6F6860] border-[#DCD4C9]'
                        }`}
                        style={active ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANEL 5: ETIQUETAS DE TAREAS */}
      {activeBoard === 'tags' && (
        <div className="bg-white p-5 rounded-b-xs border border-[#DCD4C9] shadow-2xs space-y-5">
          <div>
            <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider">
              Etiquetas para Clasificar y Filtrar Tareas
            </h4>
            <p className="text-xs text-[#6F6860]">
              Ejemplos: Stock, Control de pedidos, Salón, Logística. Los responsables podrán asignarlas al crear tareas y filtrar el tablero por etiqueta.
            </p>
          </div>

          <form onSubmit={handleAddTag} className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-bold text-[#18231C] block mb-1">Nombre de Nueva Etiqueta *</label>
              <input
                type="text"
                required
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ej: Vidriera, Bordado, Caja..."
                className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#18231C] block mb-1">Color</label>
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-10 h-8 rounded-xs border border-[#DCD4C9] cursor-pointer"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Etiqueta</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {taskTags.map((tag, idx) => (
              <div
                key={tag.id}
                className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="color"
                    value={tag.color}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskTags((prev) => prev.map((t, i) => (i === idx ? { ...t, color: val } : t)));
                    }}
                    className="w-7 h-7 rounded-xs border border-[#DCD4C9] cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={tag.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskTags((prev) => prev.map((t, i) => (i === idx ? { ...t, name: val } : t)));
                    }}
                    className="w-full px-2 py-1 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTaskTags((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer shrink-0"
                  title="Eliminar etiqueta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

