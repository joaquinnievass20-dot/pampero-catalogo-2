import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Save, 
  AlertCircle,
  Tag,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { CostCategoryConfig, ExpenseType } from '../../types';
import { 
  DEFAULT_COST_CATEGORIES, 
  fetchCostCategories, 
  saveCostCategories, 
  subscribeToCostCategories 
} from '../../services/firebase';

interface AdminCostCategoriesTabProps {
  triggerSaveNotice?: () => void;
}

export const AdminCostCategoriesTab: React.FC<AdminCostCategoriesTabProps> = ({ triggerSaveNotice }) => {
  const [categories, setCategories] = useState<CostCategoryConfig[]>(DEFAULT_COST_CATEGORIES);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New category form
  const [newName, setNewName] = useState('');
  const [newDefaultType, setNewDefaultType] = useState<ExpenseType>('Fijo');

  // Editing existing category
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<ExpenseType>('Fijo');

  useEffect(() => {
    fetchCostCategories().then((remote) => {
      if (Array.isArray(remote) && remote.length > 0) {
        setCategories(remote);
      }
    });

    const unsub = subscribeToCostCategories((remote) => {
      if (Array.isArray(remote) && remote.length > 0) {
        setCategories(remote);
      }
    });
    return () => unsub();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Ingresá un nombre para la categoría.' });
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setFeedback({ type: 'error', message: 'Ya existe una categoría con este nombre.' });
      return;
    }

    const newCat: CostCategoryConfig = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      defaultType: newDefaultType,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    setNewName('');
    setNewDefaultType('Fijo');
    setIsSaving(true);

    const success = await saveCostCategories(updated);
    setIsSaving(false);
    if (success) {
      setFeedback({ type: 'success', message: `Categoría "${trimmed}" agregada con éxito.` });
      if (triggerSaveNotice) triggerSaveNotice();
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: 'Error guardando en Firestore.' });
    }
  };

  const handleStartEdit = (cat: CostCategoryConfig) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditType(cat.defaultType);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const updated = categories.map((c) =>
      c.id === editingId ? { ...c, name: trimmed, defaultType: editType } : c
    );

    setCategories(updated);
    setEditingId(null);
    setIsSaving(true);

    const success = await saveCostCategories(updated);
    setIsSaving(false);
    if (success) {
      setFeedback({ type: 'success', message: 'Categoría actualizada con éxito.' });
      if (triggerSaveNotice) triggerSaveNotice();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la categoría de costo "${name}"?`)) return;

    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    setIsSaving(true);

    const success = await saveCostCategories(updated);
    setIsSaving(false);
    if (success) {
      setFeedback({ type: 'success', message: `Categoría "${name}" eliminada.` });
      if (triggerSaveNotice) triggerSaveNotice();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('¿Restablecer las categorías de costos a las predeterminadas?')) return;
    setCategories(DEFAULT_COST_CATEGORIES);
    setIsSaving(true);
    await saveCostCategories(DEFAULT_COST_CATEGORIES);
    setIsSaving(false);
    setFeedback({ type: 'success', message: 'Categorías restablecidas a las oficiales.' });
    if (triggerSaveNotice) triggerSaveNotice();
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#18231C] text-[#FDB813] rounded-xs">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Categorías de Costos · Fijo vs. Variable
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Definí las categorías disponibles para el CRM de Costos y el tipo de costo asignado por defecto (Fijo o Variable).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isSaving}
          className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start md:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restablecer</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xs text-xs font-semibold flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
            : 'bg-red-50 border border-red-300 text-red-900'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Form to Add New Category */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#B9522F]" />
          Nueva Categoría de Gasto / Costo
        </h4>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Nombre de la categoría (ej: Seguros, Telefonía, Combustible)..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none focus:border-[#18231C]"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={newDefaultType}
              onChange={(e) => setNewDefaultType(e.target.value as ExpenseType)}
              className="w-full px-3 py-2 text-xs font-bold border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none focus:border-[#18231C]"
            >
              <option value="Fijo">Costo Fijo (Por defecto)</option>
              <option value="Variable">Costo Variable (Por defecto)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSaving || !newName.trim()}
            className="w-full sm:w-auto px-5 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FDB813]" />
            <span>Agregar</span>
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#6F6860]" />
            Listado de Categorías Activas ({categories.length})
          </h4>
          <span className="text-[11px] text-[#6F6860]">
            Al cargar un costo en el CRM, el Tipo se completará automáticamente según esta configuración.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const isEditing = editingId === cat.id;

            return (
              <div
                key={cat.id}
                className="p-3.5 rounded-xs border border-[#DCD4C9] bg-[#FAF8F5] flex flex-col justify-between gap-3 transition-shadow hover:shadow-xs"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as ExpenseType)}
                      className="w-full px-2 py-1 text-xs font-bold bg-white border border-[#DCD4C9] rounded-xs outline-none"
                    >
                      <option value="Fijo">Costo Fijo</option>
                      <option value="Variable">Costo Variable</option>
                    </select>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900 font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-[#18231C] leading-snug">
                        {cat.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-xs text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        cat.defaultType === 'Fijo'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {cat.defaultType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#DCD4C9]/60">
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {cat.isSystem ? 'Oficial' : 'Personalizada'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1 text-neutral-600 hover:text-[#18231C] hover:bg-white rounded-xs transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="p-1 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
