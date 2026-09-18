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
  onUpdateProducts?: (newProds: Product[]) => void;
  triggerSaveNotice: () => void;
}

export const AdminCategoriesTab: React.FC<AdminCategoriesTabProps> = ({
  categories,
  onUpdateCategories,
  products,
  onUpdateProducts,
  triggerSaveNotice,
}) => {
  const [selectedMainCat, setSelectedMainCat] = useState<string>(() => {
    return categories[0]?.name || 'Hombre';
  });

  // Main Category management state
  const [isAddingMainCat, setIsAddingMainCat] = useState(false);
  const [newMainCatName, setNewMainCatName] = useState('');
  const [editingMainCat, setEditingMainCat] = useState<string | null>(null);
  const [editingMainCatValue, setEditingMainCatValue] = useState('');

  // Subcategory and Section state
  const [newSubcatName, setNewSubcatName] = useState('');
  const [targetSectionName, setTargetSectionName] = useState<string>('');
  const [editingSubcat, setEditingSubcat] = useState<{ sectionName: string; oldName: string } | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  // Safety fallback if selected category was deleted or renamed
  const currentCategory = categories.find((c) => c.name === selectedMainCat) || categories[0];
  const activeCategoryName = currentCategory?.name || selectedMainCat;

  // 1. ADD MAIN CATEGORY
  const handleAddMainCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newMainCatName.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`La categoría "${trimmed}" ya existe.`);
      return;
    }

    const newCatItem: CategoryHierarchyItem = {
      name: trimmed,
      description: '',
      sections: [
        {
          name: 'General',
          subCategories: ['General'],
        },
      ],
    };

    const updated = [...categories, newCatItem];
    onUpdateCategories(updated);
    setSelectedMainCat(trimmed);
    setNewMainCatName('');
    setIsAddingMainCat(false);
    triggerSaveNotice();
  };

  // 2. RENAME MAIN CATEGORY
  const handleStartRenameMainCategory = (catName: string) => {
    setEditingMainCat(catName);
    setEditingMainCatValue(catName);
  };

  const handleSaveRenameMainCategory = () => {
    if (!editingMainCat) return;
    const trimmed = editingMainCatValue.trim();
    if (!trimmed || trimmed === editingMainCat) {
      setEditingMainCat(null);
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.name !== editingMainCat)) {
      alert(`Ya existe una categoría llamada "${trimmed}".`);
      return;
    }

    const oldName = editingMainCat;

    // Update categories list
    const updatedCats = categories.map((cat) => {
      if (cat.name === oldName) {
        return { ...cat, name: trimmed };
      }
      return cat;
    });

    onUpdateCategories(updatedCats);

    // Update affected products
    if (onUpdateProducts) {
      const affectedProducts = products.map((p) => {
        if (p.category === oldName) {
          return { ...p, category: trimmed as MainCategory };
        }
        return p;
      });
      onUpdateProducts(affectedProducts);
    }

    if (selectedMainCat === oldName) {
      setSelectedMainCat(trimmed);
    }

    setEditingMainCat(null);
    triggerSaveNotice();
  };

  // 3. DELETE MAIN CATEGORY
  const handleDeleteMainCategory = (catName: string) => {
    if (categories.length <= 1) {
      alert('No podés eliminar la única categoría principal restante.');
      return;
    }

    const countProducts = products.filter((p) => p.category === catName).length;
    const msg = countProducts > 0
      ? `Hay ${countProducts} producto(s) asignados a la categoría "${catName}". Si la eliminás, deberás reasignarlos. ¿Deseás continuar?`
      : `¿Estás seguro de que deseás eliminar la categoría principal "${catName}"?`;

    if (!window.confirm(msg)) return;

    const updated = categories.filter((c) => c.name !== catName);
    onUpdateCategories(updated);

    if (selectedMainCat === catName) {
      setSelectedMainCat(updated[0]?.name || 'Hombre');
    }

    triggerSaveNotice();
  };

  // 4. ADD SUBCATEGORY
  const handleAddSubcategory = (sectionName: string) => {
    const trimmed = newSubcatName.trim();
    if (!trimmed) return;

    const updated = categories.map((cat) => {
      if (cat.name !== activeCategoryName) return cat;
      return {
        ...cat,
        sections: cat.sections.map((sec) => {
          if (sec.name !== sectionName) return sec;
          if (sec.subCategories.includes(trimmed)) return sec;
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

  // 5. EDIT SUBCATEGORY
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

    const updatedCats = categories.map((cat) => {
      if (cat.name !== activeCategoryName) return cat;
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

    if (onUpdateProducts) {
      const affectedProducts = products.map((p) => {
        if (p.category === activeCategoryName && p.subCategory === oldName) {
          return { ...p, subCategory: newName };
        }
        return p;
      });
      onUpdateProducts(affectedProducts);
    }

    setEditingSubcat(null);
    triggerSaveNotice();
  };

  // 6. DELETE SUBCATEGORY
  const handleDeleteSubcategory = (sectionName: string, subName: string) => {
    const matchingProducts = products.filter(
      (p) => p.category === activeCategoryName && p.subCategory === subName
    );

    const msg = matchingProducts.length > 0
      ? `Hay ${matchingProducts.length} producto(s) asignado(s) a "${subName}". ¿Deseas eliminar esta subcategoría igualmente?`
      : `¿Estás seguro de que deseas eliminar la subcategoría "${subName}"?`;

    if (!window.confirm(msg)) return;

    const updated = categories.map((cat) => {
      if (cat.name !== activeCategoryName) return cat;
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

  // 7. ADD SECTION
  const handleAddSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;

    const updated = categories.map((cat) => {
      if (cat.name !== activeCategoryName) return cat;
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

  // 8. DELETE SECTION
  const handleDeleteSection = (sectionName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la sección "${sectionName}" y todas sus subcategorías?`)) {
      return;
    }

    const updated = categories.map((cat) => {
      if (cat.name !== activeCategoryName) return cat;
      return {
        ...cat,
        sections: cat.sections.filter((sec) => sec.name !== sectionName),
      };
    });

    onUpdateCategories(updated);
    triggerSaveNotice();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#18231C] text-[#F5F2EC] rounded-xs">
              <FolderTree className="w-5 h-5 text-[#B9522F]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Gestión Dinámica de Categorías Principales y Rubros
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Podés crear nuevas categorías principales, cambiar sus nombres, eliminarlas y organizar sus secciones y subcategorías. Los cambios impactan en la barra de navegación y en el catálogo.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddingMainCat(!isAddingMainCat);
            setNewMainCatName('');
          }}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <FolderPlus className="w-4 h-4 text-[#FDB813]" />
          {isAddingMainCat ? 'Cancelar' : '+ Nueva Categoría Principal'}
        </button>
      </div>

      {/* Add New Main Category Form Drawer */}
      {isAddingMainCat && (
        <form
          onSubmit={handleAddMainCategory}
          className="bg-amber-50/70 border-2 border-[#18231C] p-4 rounded-xs flex flex-col sm:flex-row items-center gap-3 animate-fadeIn"
        >
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1">
              Nombre de la Nueva Categoría Principal:
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej: Calzado Oficial, Accesorios, Outlet, Alta Visibilidad..."
              value={newMainCatName}
              onChange={(e) => setNewMainCatName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none font-medium focus:border-[#18231C]"
            />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto sm:mt-5">
            <button
              type="submit"
              className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-400" /> Crear Categoría
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingMainCat(false);
                setNewMainCatName('');
              }}
              className="px-3 py-2 bg-white text-[#6F6860] border border-[#DCD4C9] text-xs font-semibold rounded-xs hover:bg-[#FAF8F5] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Main Categories Selector Tabs & Renaming Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#6F6860] block">
            Categorías Principales Activas ({categories.length}):
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {categories.map((cat) => {
            const isSelected = activeCategoryName === cat.name;
            const countProducts = products.filter((p) => p.category === cat.name).length;

            return (
              <div
                key={cat.name}
                onClick={() => setSelectedMainCat(cat.name)}
                className={`group relative p-3 rounded-xs text-left transition-all cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#18231C] text-white border-[#18231C] shadow-sm'
                    : 'bg-white text-[#4A453F] border-[#DCD4C9] hover:border-[#18231C]'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider truncate">
                    {cat.name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-xs font-mono font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF8F5] text-[#6F6860] border border-[#DCD4C9]'
                    }`}
                  >
                    {countProducts} art.
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/15">
                  <span className="text-[10px] opacity-75">
                    {cat.sections?.length || 0} secciones
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRenameMainCategory(cat.name);
                      }}
                      className={`p-1 rounded-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'hover:bg-white/20 text-white'
                          : 'hover:bg-[#ECE5DC] text-[#6F6860]'
                      }`}
                      title={`Renombrar categoría ${cat.name}`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMainCategory(cat.name);
                        }}
                        className={`p-1 rounded-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'hover:bg-red-900/80 text-red-200'
                            : 'hover:bg-red-50 text-red-600'
                        }`}
                        title={`Eliminar categoría ${cat.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rename Selected Category Modal / Inline Row */}
      {editingMainCat && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xs flex items-center gap-2 flex-wrap animate-fadeIn">
          <span className="text-xs font-bold text-[#B9522F] uppercase tracking-wider">
            Renombrar categoría &quot;{editingMainCat}&quot;:
          </span>
          <input
            type="text"
            required
            autoFocus
            value={editingMainCatValue}
            onChange={(e) => setEditingMainCatValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRenameMainCategory();
              if (e.key === 'Escape') setEditingMainCat(null);
            }}
            className="px-3 py-1.5 text-xs bg-white rounded-xs border border-[#DCD4C9] font-bold outline-none flex-1 max-w-xs"
          />
          <button
            type="button"
            onClick={handleSaveRenameMainCategory}
            className="px-3 py-1.5 bg-[#18231C] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1 hover:bg-black cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" /> Guardar Nombre
          </button>
          <button
            type="button"
            onClick={() => setEditingMainCat(null)}
            className="px-2.5 py-1.5 text-xs text-[#6F6860] hover:text-[#18231C] font-semibold cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Sections & Subcategories in current Category */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCD4C9] pb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#B9522F]" />
            Secciones y Subcategorías de <span className="underline decoration-2 text-[#B9522F]">{activeCategoryName}</span>
          </h4>

          <button
            type="button"
            onClick={() => setIsAddingSection(!isAddingSection)}
            className="text-xs font-bold text-[#18231C] hover:text-[#B9522F] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
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
              placeholder="Nombre de la nueva sección (Ej: Calzado, Protección Solar, Camisas, etc.)"
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
                  <span className="w-2 h-2 rounded-full bg-[#B9522F]" />
                  <span className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                    {section.name}
                  </span>
                  <span className="text-[10px] text-[#6F6860] bg-[#FAF8F5] px-1.5 py-0.5 rounded-xs border border-[#DCD4C9]">
                    {section.subCategories.length} subcategorías
                  </span>
                </div>

                {currentCategory.sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.name)}
                    className="text-[#8C827A] hover:text-red-600 transition-colors p-1 rounded-xs cursor-pointer"
                    title={`Eliminar sección ${section.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
                    (p) => p.category === activeCategoryName && p.subCategory === sub
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
