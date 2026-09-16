import React, { useState } from 'react';
import { CategoryHierarchyItem, MainCategory, Product } from '../../types';
import { 
  FolderTree, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Layers, 
  Tag, 
  Save, 
  AlertCircle,
  FolderPlus,
  RefreshCw
} from 'lucide-react';

interface AdminCategoriesTabProps {
  categories: CategoryHierarchyItem[];
  onUpdateCategories: (newCats: CategoryHierarchyItem[]) => void;
  products: Product[];
  onUpdateProducts: (newProds: Product[]) => void;
  triggerSaveNotice: () => void;
}

export const AdminCategoriesTab: React.FC<AdminCategoriesTabProps> = ({
  categories,
  onUpdateCategories,
  products,
  onUpdateProducts,
  triggerSaveNotice,
}) => {
  const [selectedMainCat, setSelectedMainCat] = useState<MainCategory>('Hombre');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [targetSectionName, setTargetSectionName] = useState<string>('');
  const [editingSubcat, setEditingSubcat] = useState<{ sectionName: string; oldName: string } | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  const currentCategory = categories.find((c) => c.name === selectedMainCat) || categories[0];

  const handleAddSubcategory = (sectionName: string) => {
    const trimmed = newSubcatName.trim();
    if (!trimmed) return;

    const updated = categories.map((cat) => {
      if (cat.name !== selectedMainCat) return cat;
      return {
        ...cat,
        sections: cat.sections.map((sec) => {
          if (sec.name !== sectionName) return sec;
          if (sec.subCategories.includes(trimmed)) return sec; // prevent duplicate
          return {
            ...sec,
            subCategories: [...sec.subCategories, trimmed],
          };
        }),
      };
    });

    onUpdateCategories(updated);
    setNewSubcatName('');
    setTargetSectionName('');
    triggerSaveNotice();
  };

  const handleStartEdit = (sectionName: string, subName: string) => {
    setEditingSubcat({ sectionName, oldName: subName });
    setEditingNameValue(subName);
  };

  const handleSaveEdit = () => {
    if (!editingSubcat) return;
    const newName = editingNameValue.trim();
    if (!newName || newName === editingSubcat.oldName) {
      setEditingSubcat(null);
      return;
    }

    const { sectionName, oldName } = editingSubcat;

    // Update categories
    const updatedCats = categories.map((cat) => {
      if (cat.name !== selectedMainCat) return cat;
      return {
        ...cat,
        sections: cat.sections.map((sec) => {
          if (sec.name !== sectionName) return sec;
          return {
            ...sec,
            subCategories: sec.subCategories.map((s) => (s === oldName ? newName : s)),
          };
        }),
      };
    });

    onUpdateCategories(updatedCats);

    // Also update any products using this subcategory in this category/section
    const affectedProducts = products.map((p) => {
      if (p.category === selectedMainCat && p.subCategory === oldName) {
        return { ...p, subCategory: newName };
      }
      return p;
    });

    onUpdateProducts(affectedProducts);
    setEditingSubcat(null);
    triggerSaveNotice();
  };

  const handleDeleteSubcategory = (sectionName: string, subName: string) => {
    const matchingProducts = products.filter(
      (p) => p.category === selectedMainCat && p.subCategory === subName
    );

    const msg = matchingProducts.length > 0
      ? `Hay ${matchingProducts.length} producto(s) asignado(s) a "${subName}". ¿Deseas eliminar esta subcategoría igualmente?`
      : `¿Estás seguro de que deseas eliminar la subcategoría "${subName}"?`;

    if (!window.confirm(msg)) return;

    const updated = categories.map((cat) => {
      if (cat.name !== selectedMainCat) return cat;
      return {
        ...cat,
        sections: cat.sections.map((sec) => {
          if (sec.name !== sectionName) return sec;
          return {
            ...sec,
            subCategories: sec.subCategories.filter((s) => s !== subName),
          };
        }),
      };
    });

    onUpdateCategories(updated);
    triggerSaveNotice();
  };

  const handleAddSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;

    const updated = categories.map((cat) => {
      if (cat.name !== selectedMainCat) return cat;
      if (cat.sections.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return cat;
      return {
        ...cat,
        sections: [
          ...cat.sections,
          {
            name: trimmed,
            subCategories: ['General'],
          },
        ],
      };
    });

    onUpdateCategories(updated);
    setNewSectionName('');
    setIsAddingSection(false);
    triggerSaveNotice();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-[#18231C]" />
            <h3 className="font-display text-base uppercase tracking-wider text-[#18231C]">
              Gestión Dinámica de Subcategorías y Secciones
            </h3>
          </div>
          <p className="text-xs text-[#6F6860] mt-1">
            Editá, agregá o eliminá subcategorías para organizar el catálogo de forma flexible por línea.
          </p>
        </div>
      </div>

      {/* Main Categories Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'] as MainCategory[]).map((catName) => {
          const isSelected = selectedMainCat === catName;
          return (
            <button
              key={catName}
              type="button"
              onClick={() => setSelectedMainCat(catName)}
              className={`p-3 rounded-xs text-xs font-bold uppercase tracking-wider text-center transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#18231C] text-white border-[#18231C] shadow-sm'
                  : 'bg-white text-[#4A453F] border-[#DCD4C9] hover:border-[#18231C]'
              }`}
            >
              {catName}
            </button>
          );
        })}
      </div>

      {/* Sections & Subcategories in current Category */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#FDB813]" />
            Secciones y Subcategorías de <span className="underline">{selectedMainCat}</span>
          </h4>

          <button
            type="button"
            onClick={() => setIsAddingSection(!isAddingSection)}
            className="text-xs font-bold text-[#18231C] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingSection ? 'Cancelar sección' : 'Agregar Nueva Sección'}</span>
          </button>
        </div>

        {/* Add Section Box */}
        {isAddingSection && (
          <div className="bg-white p-3 rounded-xs border-2 border-dashed border-[#18231C] flex items-center gap-2">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Nombre de la nueva sección (Ej: Calzado, Protección Solar, etc.)"
              className="flex-1 px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#18231C]"
            />
            <button
              type="button"
              onClick={handleAddSection}
              className="px-4 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer hover:bg-black"
            >
              Crear Sección
            </button>
          </div>
        )}

        {/* Sections list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentCategory?.sections.map((section) => (
            <div
              key={section.name}
              className="bg-white rounded-xs border border-[#DCD4C9] p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FDB813]" />
                  <span className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                    {section.name}
                  </span>
                  <span className="text-[10px] text-[#6F6860] bg-[#FAF8F5] px-1.5 py-0.5 rounded-xs border border-[#DCD4C9]">
                    {section.subCategories.length} subcategorías
                  </span>
                </div>
              </div>

              {/* Subcategories tags */}
              <div className="flex flex-wrap gap-2">
                {section.subCategories.map((sub) => {
                  const isEditingThis =
                    editingSubcat?.sectionName === section.name &&
                    editingSubcat?.oldName === sub;

                  if (isEditingThis) {
                    return (
                      <div
                        key={sub}
                        className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-xs p-1"
                      >
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="px-2 py-0.5 text-xs bg-white border border-amber-300 rounded-xs font-medium w-36 outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setEditingSubcat(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="p-1 text-emerald-700 hover:text-emerald-900"
                          title="Guardar cambio"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubcat(null)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  const countProducts = products.filter(
                    (p) => p.category === selectedMainCat && p.subCategory === sub
                  ).length;

                  return (
                    <div
                      key={sub}
                      className="group flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#F3EFE9] border border-[#DCD4C9] px-2.5 py-1 rounded-xs transition-colors"
                    >
                      <span className="text-xs font-semibold text-[#18231C]">{sub}</span>
                      <span className="text-[10px] text-[#6F6860] opacity-75">
                        ({countProducts})
                      </span>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(section.name, sub)}
                        className="opacity-0 group-hover:opacity-100 text-[#6F6860] hover:text-[#18231C] transition-opacity cursor-pointer p-0.5"
                        title="Renombrar subcategoría"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSubcategory(section.name, sub)}
                        className="opacity-0 group-hover:opacity-100 text-[#6F6860] hover:text-red-600 transition-opacity cursor-pointer p-0.5"
                        title="Eliminar subcategoría"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add subcategory input */}
              <div className="pt-2 border-t border-[#DCD4C9]/60 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Nueva subcategoría en ${section.name}...`}
                  value={targetSectionName === section.name ? newSubcatName : ''}
                  onFocus={() => setTargetSectionName(section.name)}
                  onChange={(e) => {
                    setTargetSectionName(section.name);
                    setNewSubcatName(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubcategory(section.name);
                    }
                  }}
                  className="flex-1 px-2.5 py-1 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#18231C]"
                />
                <button
                  type="button"
                  onClick={() => handleAddSubcategory(section.name)}
                  disabled={targetSectionName !== section.name || !newSubcatName.trim()}
                  className="px-3 py-1 bg-[#18231C] disabled:bg-neutral-300 text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer disabled:cursor-not-allowed hover:bg-black transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
