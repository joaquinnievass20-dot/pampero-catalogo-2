import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  RotateCcw, 
  Check, 
  Sliders, 
  Settings2,
  Palette,
  Eye
} from 'lucide-react';
import { DynamicBoardColumn, BoardFieldConfig } from './CRMView';

interface CRMBoardConfigModalProps {
  boardColumns: DynamicBoardColumn[];
  fieldConfig: BoardFieldConfig;
  onClose: () => void;
  onSave: (updatedCols: DynamicBoardColumn[], updatedFields: BoardFieldConfig) => void;
}

const PRESET_COLORS = [
  { color: '#FDB813', bgColor: '#FFF8E1', name: 'Amarillo Pampero' },
  { color: '#F97316', bgColor: '#FFF7ED', name: 'Naranja' },
  { color: '#B9522F', bgColor: '#FAF0EB', name: 'Terracota' },
  { color: '#8B5CF6', bgColor: '#F5F3FF', name: 'Violeta' },
  { color: '#10B981', bgColor: '#ECFDF5', name: 'Verde' },
  { color: '#3B82F6', bgColor: '#EFF6FF', name: 'Azul' },
  { color: '#EF4444', bgColor: '#FEF2F2', name: 'Rojo' },
  { color: '#64748B', bgColor: '#F8FAFC', name: 'Gris' },
];

export const CRMBoardConfigModal: React.FC<CRMBoardConfigModalProps> = ({
  boardColumns: initialColumns,
  fieldConfig: initialFields,
  onClose,
  onSave,
}) => {
  const [columns, setColumns] = useState<DynamicBoardColumn[]>(() => 
    initialColumns.map((c) => ({ ...c }))
  );
  const [fields, setFields] = useState<BoardFieldConfig>({ ...initialFields });
  const [newStepLabel, setNewStepLabel] = useState('');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'steps' | 'fields'>('steps');

  // Handle edit column name
  const handleUpdateColumnLabel = (index: number, newLabel: string) => {
    const updated = [...columns];
    updated[index].label = newLabel;
    setColumns(updated);
  };

  // Handle edit column color
  const handleUpdateColumnColor = (index: number, colorDef: { color: string; bgColor: string }) => {
    const updated = [...columns];
    updated[index].color = colorDef.color;
    updated[index].bgColor = colorDef.bgColor;
    setColumns(updated);
  };

  // Move column order
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const updated = [...columns];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setColumns(updated);
  };

  // Delete column
  const handleDeleteColumn = (index: number) => {
    if (columns.length <= 2) {
      alert('El tablero debe tener al menos 2 pasos obligatorios.');
      return;
    }
    const target = columns[index];
    if (confirm(`¿Eliminar el paso "${target.label}"?`)) {
      setColumns(columns.filter((_, idx) => idx !== index));
    }
  };

  // Add new step
  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepLabel.trim()) return;

    const chosenColor = PRESET_COLORS[selectedColorIdx] || PRESET_COLORS[0];
    const newId = `step_${Date.now()}`;
    const newCol: DynamicBoardColumn = {
      id: newId,
      label: `${columns.length + 1}. ${newStepLabel.trim()}`,
      color: chosenColor.color,
      bgColor: chosenColor.bgColor,
    };

    setColumns([...columns, newCol]);
    setNewStepLabel('');
  };

  // Toggle field visibility
  const handleToggleField = (key: keyof BoardFieldConfig) => {
    setFields((prev: BoardFieldConfig) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveAll = () => {
    onSave(columns, fields);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white border-b border-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-400 text-[#18231C] rounded-xs">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base uppercase tracking-wider text-white">
                Configuración del Tablero de Gestión
              </h3>
              <p className="text-[11px] text-[#DCD4C9]/70">
                Personalizá dinámicamente las etapas del Kanban y los campos visibles en las tarjetas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Pasos del Tablero vs Campos a Llenar */}
        <div className="flex border-b border-[#DCD4C9] bg-[#FAF8F5] px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('steps')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'steps'
                ? 'border-[#B9522F] text-[#18231C] font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Pasos y Columnas ({columns.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'fields'
                ? 'border-[#B9522F] text-[#18231C] font-black'
                : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Campos Visibles en Tarjetas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: STEPS / COLUMNS CONFIGURATION */}
          {activeTab === 'steps' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1">
                  Etapas Actuales del Proceso
                </h4>
                <p className="text-[11px] text-[#6F6860]">
                  Podés renombrar cada paso, cambiar su color o reordenarlo con las flechas.
                </p>
              </div>

              {/* Column list */}
              <div className="space-y-2.5">
                {columns.map((col, idx) => (
                  <div
                    key={col.id}
                    className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center gap-3 justify-between shadow-2xs hover:border-[#18231C]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Color indicator and quick picker */}
                      <div 
                        className="w-4 h-8 rounded-xs shrink-0" 
                        style={{ backgroundColor: col.color }}
                        title="Color del encabezado"
                      />
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => handleUpdateColumnLabel(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs text-[#18231C] outline-none focus:border-[#FDB813]"
                        placeholder="Nombre de la etapa"
                      />
                    </div>

                    {/* Color Presets Palette */}
                    <div className="flex items-center gap-1 shrink-0">
                      {PRESET_COLORS.slice(0, 4).map((p, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleUpdateColumnColor(idx, p)}
                          className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: p.color }}
                          title={`Color ${p.name}`}
                        />
                      ))}
                    </div>

                    {/* Reorder & Delete actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveColumn(idx, 'up')}
                        className="p-1 rounded-xs hover:bg-[#ECE5DC] text-[#6F6860] hover:text-[#18231C] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Mover arriba"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === columns.length - 1}
                        onClick={() => handleMoveColumn(idx, 'down')}
                        className="p-1 rounded-xs hover:bg-[#ECE5DC] text-[#6F6860] hover:text-[#18231C] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Mover abajo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(idx)}
                        className="p-1 rounded-xs hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Eliminar paso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Step Form */}
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xs space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B9522F] block">
                  Agregar Nueva Etapa al Proceso
                </span>
                <form onSubmit={handleAddStep} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newStepLabel}
                    onChange={(e) => setNewStepLabel(e.target.value)}
                    placeholder="Ej: Control de Calidad, Facturación, En Envío..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#DCD4C9] rounded-xs outline-none focus:border-[#FDB813]"
                  />
                  <div className="flex items-center gap-1.5 self-center">
                    {PRESET_COLORS.map((p, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setSelectedColorIdx(pIdx)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                          selectedColorIdx === pIdx ? 'scale-125 border-[#18231C]' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: p.color }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FDB813]" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: FIELDS CONFIGURATION */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1">
                  Campos y Datos a Mostrar en las Tarjetas
                </h4>
                <p className="text-[11px] text-[#6F6860]">
                  Activá o desactivá los campos que tu equipo necesita visualizar en cada pedido del Kanban.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { key: 'showOrderNumber', label: 'Número de Pedido / Cotización', desc: 'Identificador único oficial (ej: COT-123456)' },
                  { key: 'showSeller', label: 'Vendedora / Asesor Asignado', desc: 'Nombre del responsable del pedido' },
                  { key: 'showBranch', label: 'Sucursal / Local', desc: 'Maipú, Ciudad o Luján de Cuyo' },
                  { key: 'showEstimatedUnits', label: 'Cantidad de Prendas', desc: 'Volumen total de unidades requeridas' },
                  { key: 'showEstimatedAmount', label: 'Monto Total Estimado ($)', desc: 'Valor presupuestado de la cotización' },
                  { key: 'showObservations', label: 'Notas & Observaciones', desc: 'Comentarios del cliente y detalles especiales' },
                  { key: 'showDeliveryDate', label: 'Fecha de Entrega Estimada', desc: 'Plazos pactados con fábrica o cliente' },
                  { key: 'showEmbroideryNotes', label: 'Especificaciones de Bordado', desc: 'Ubicaciones de logos y matrices' },
                ].map((item) => {
                  const isChecked = fields[item.key as keyof BoardFieldConfig];
                  return (
                    <label
                      key={item.key}
                      onClick={() => handleToggleField(item.key as keyof BoardFieldConfig)}
                      className={`p-3 rounded-xs border flex items-start gap-3 cursor-pointer transition-colors select-none ${
                        isChecked 
                          ? 'bg-amber-50/50 border-amber-300' 
                          : 'bg-[#FAF8F5] border-[#DCD4C9] opacity-75'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded-xs accent-[#18231C] cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-[#18231C] block">{item.label}</span>
                        <span className="text-[11px] text-[#6F6860] leading-snug">{item.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-6 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all"
          >
            <Save className="w-4 h-4 text-[#FDB813]" />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </div>
    </div>
  );
};
