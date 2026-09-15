import React, { useState } from 'react';
import { ColorCodeDef } from '../../types';
import { getSavedColorCodes, saveColorCodes } from '../../utils/colorUtils';
import { Palette, Plus, Trash2, Edit3, Save, Check, RotateCcw } from 'lucide-react';

interface AdminColorArticlesSectionProps {
  triggerSaveNotice: () => void;
}

export const AdminColorArticlesSection: React.FC<AdminColorArticlesSectionProps> = ({
  triggerSaveNotice,
}) => {
  const [colorCodes, setColorCodes] = useState<ColorCodeDef[]>(() => getSavedColorCodes());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const [form, setForm] = useState<ColorCodeDef>({
    code: '',
    name: '',
    hex: '#1D4ED8',
    description: '',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;

    const formattedCode = form.code.toUpperCase().trim();
    let updated: ColorCodeDef[];

    if (editingCode) {
      updated = colorCodes.map((c) =>
        c.code.toUpperCase() === editingCode.toUpperCase()
          ? { ...form, code: formattedCode }
          : c
      );
    } else {
      // Check if duplicate code
      const exists = colorCodes.some((c) => c.code.toUpperCase() === formattedCode);
      if (exists) {
        alert(`El código ${formattedCode} ya existe. Por favor use otro o edite el existente.`);
        return;
      }
      updated = [...colorCodes, { ...form, code: formattedCode }];
    }

    setColorCodes(updated);
    saveColorCodes(updated);
    setEditingCode(null);
    setIsAddingNew(false);
    setForm({ code: '', name: '', hex: '#1D4ED8', description: '' });
    triggerSaveNotice();
  };

  const handleDelete = (code: string) => {
    if (confirm(`¿Eliminar el artículo de color ${code}?`)) {
      const updated = colorCodes.filter((c) => c.code.toUpperCase() !== code.toUpperCase());
      setColorCodes(updated);
      saveColorCodes(updated);
      triggerSaveNotice();
    }
  };

  const handleStartEdit = (item: ColorCodeDef) => {
    setEditingCode(item.code);
    setForm({ ...item });
    setIsAddingNew(false);
  };

  return (
    <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-3">
        <div>
          <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#FDB813]" />
            Catálogo de Artículos y Códigos de Color (C1, C2, C4...)
          </h4>
          <p className="text-xs text-[#6F6860] mt-1">
            Asigná los códigos oficiales de Pampero a cada color (ej. C4 = Azul Francia). Al cargar imágenes por color o importar artículos, el sistema vinculará la foto y el cuadrito automáticamente.
          </p>
        </div>

        {!isAddingNew && !editingCode && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(true);
              setEditingCode(null);
              // Suggest next code (e.g. C13)
              const nextNum = colorCodes.length + 1;
              setForm({
                code: `C${nextNum}`,
                name: '',
                hex: '#B9522F',
                description: '',
              });
            }}
            className="px-3.5 py-1.5 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Nuevo Código Color
          </button>
        )}
      </div>

      {/* Form: Adding or Editing */}
      {(isAddingNew || editingCode) && (
        <form onSubmit={handleSave} className="p-4 bg-[#FAF8F5] border border-[#18231C] rounded-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
              {editingCode ? `Editar Artículo: ${editingCode}` : 'Agregar Nuevo Código de Color'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setEditingCode(null);
              }}
              className="text-xs text-neutral-500 hover:text-black cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#4A453F] uppercase mb-1">
                Código / Artículo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: C4"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#4A453F] uppercase mb-1">
                Nombre del Color *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Azul Francia"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-semibold focus:outline-none focus:border-[#FDB813]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#4A453F] uppercase mb-1">
                Tono Muestra (Hex)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.hex}
                  onChange={(e) => setForm({ ...form, hex: e.target.value })}
                  className="w-8 h-8 rounded-xs border border-[#DCD4C9] cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={form.hex}
                  onChange={(e) => setForm({ ...form, hex: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#4A453F] uppercase mb-1">
                Uso / Descripción
              </label>
              <input
                type="text"
                placeholder="Ej: Gabardina industrial clásica"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DCD4C9]/60">
            <button
              type="submit"
              className="px-5 py-1.5 bg-[#FDB813] hover:bg-[#E0A310] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Artículo de Color
            </button>
          </div>
        </form>
      )}

      {/* Grid of registered color codes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {colorCodes.map((item) => (
          <div
            key={item.code}
            className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex flex-col justify-between hover:border-neutral-700 transition-all shadow-2xs group"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-black text-white">
                  {item.code}
                </span>
                <span 
                  className="w-5 h-5 rounded-full border border-black/20 shadow-2xs" 
                  style={{ backgroundColor: item.hex }} 
                  title={item.hex}
                />
              </div>
              <p className="text-xs font-bold text-neutral-900 truncate">
                {item.name}
              </p>
              {item.description && (
                <p className="text-[10px] text-neutral-500 line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-[#DCD4C9]/60 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => handleStartEdit(item)}
                className="p-1 text-neutral-500 hover:text-black cursor-pointer"
                title="Editar"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.code)}
                className="p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
