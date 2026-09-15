import React, { useState, useMemo } from 'react';
import { Product, MainCategory, ColorCodeDef } from '../../types';
import { CATEGORY_HIERARCHY } from '../../data/categories';
import { getSavedColorCodes, saveColorCodes, getEffectiveColors } from '../../utils/colorUtils';
import { 
  Palette, 
  Ruler, 
  Check, 
  Save, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Layers, 
  Tag, 
  Sparkles,
  Info
} from 'lucide-react';

interface AdminVariantsTabProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  triggerSaveNotice: () => void;
}

// Preset standard sizes
const SIZES_LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Especial'];
const SIZES_NUMBERS_PANTS = ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'];
const SIZES_NUMBERS_SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];
const SIZES_UNIQUE = ['Talle Único'];

export const AdminVariantsTab: React.FC<AdminVariantsTabProps> = ({
  products,
  onUpdateProducts,
  triggerSaveNotice,
}) => {
  // Filters & selection
  const [selectedCategory, setSelectedCategory] = useState<MainCategory>('Hombre');
  const [searchCode, setSearchCode] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    const first = products.find((p) => p.category === 'Hombre');
    return first ? first.id : (products[0]?.id || '');
  });

  // Global color codes dictionary
  const [colorDefs, setColorDefs] = useState<ColorCodeDef[]>(() => getSavedColorCodes());
  const [newColorCode, setNewColorCode] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#1D4ED8');
  const [showColorDict, setShowColorDict] = useState(false);

  // Edit existing color state
  const [editingColor, setEditingColor] = useState<ColorCodeDef | null>(null);
  const [editColorCode, setEditColorCode] = useState('');
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('');

  // Fetch color codes from server on mount
  React.useEffect(() => {
    fetch('/api/colors')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.colors) && data.colors.length > 0) {
          setColorDefs(data.colors);
          saveColorCodes(data.colors);
        }
      })
      .catch(() => {});
  }, []);

  // Selected product object
  const currentProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Working state for the selected product
  const [activeColors, setActiveColors] = useState<string[]>([]);
  const [activeSizes, setActiveSizes] = useState<string[]>([]);
  const [sizeFormat, setSizeFormat] = useState<'letters' | 'pants' | 'shoes' | 'unique'>('letters');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // When selected product changes, sync form state
  React.useEffect(() => {
    if (currentProduct) {
      setActiveColors(currentProduct.availableColors || []);
      setActiveSizes(currentProduct.availableSizes || []);

      // Guess size format
      const sizes = currentProduct.availableSizes || [];
      if (sizes.length === 1 && sizes[0] === 'Talle Único') {
        setSizeFormat('unique');
      } else if (sizes.some((s) => ['S', 'M', 'L', 'XL'].includes(s.toUpperCase()))) {
        setSizeFormat('letters');
      } else if (
        currentProduct.section.toLowerCase().includes('calzado') ||
        currentProduct.subCategory.toLowerCase().includes('calzado')
      ) {
        setSizeFormat('shoes');
      } else {
        setSizeFormat('pants');
      }
    }
  }, [currentProduct?.id]);

  // Filtered list of products for the selector
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'Venta Corporativa'
          ? p.category === 'Venta Corporativa' || p.section?.toLowerCase() === 'industria' || p.subCategory?.toLowerCase() === 'industria'
          : p.category === selectedCategory || (selectedCategory === 'Hombre' && p.category as any === '0');

      if (!matchCat) return false;

      if (searchCode.trim()) {
        const q = searchCode.toLowerCase().trim();
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.section.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchCode]);

  // Toggle a color for the active product
  const handleToggleColor = (colorNameOrCode: string) => {
    setActiveColors((prev) => {
      if (prev.includes(colorNameOrCode)) {
        return prev.filter((c) => c !== colorNameOrCode);
      } else {
        return [...prev, colorNameOrCode];
      }
    });
  };

  // Toggle a size for the active product
  const handleToggleSize = (size: string) => {
    setActiveSizes((prev) => {
      if (prev.includes(size)) {
        return prev.filter((s) => s !== size);
      } else {
        return [...prev, size];
      }
    });
  };

  // Set preset sizes
  const handleApplyPresetSizes = (format: 'letters' | 'pants' | 'shoes' | 'unique') => {
    setSizeFormat(format);
    if (format === 'letters') {
      setActiveSizes(['S', 'M', 'L', 'XL', 'XXL']);
    } else if (format === 'pants') {
      setActiveSizes(['40', '42', '44', '46', '48', '50', '52']);
    } else if (format === 'shoes') {
      setActiveSizes(['39', '40', '41', '42', '43', '44', '45']);
    } else if (format === 'unique') {
      setActiveSizes(['Talle Único']);
    }
  };

  // Add custom size
  const handleAddCustomSize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSizeInput.trim()) return;
    const formatted = customSizeInput.trim().toUpperCase();
    if (!activeSizes.includes(formatted)) {
      setActiveSizes([...activeSizes, formatted]);
    }
    setCustomSizeInput('');
  };

  // Save current product variants
  const handleSaveProductVariants = () => {
    if (!currentProduct) return;

    const updated = products.map((p) => {
      if (p.id === currentProduct.id) {
        return {
          ...p,
          availableColors: activeColors,
          availableSizes: activeSizes,
          sizeType: sizeFormat === 'letters' ? ('letters' as const) : ('numbers' as const),
        };
      }
      return p;
    });

    onUpdateProducts(updated);
    triggerSaveNotice();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Add new color to global dictionary
  const handleAddGlobalColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorCode.trim() || !newColorName.trim()) return;

    const codeUpper = newColorCode.trim().toUpperCase();
    const newColor: ColorCodeDef = {
      code: codeUpper,
      name: newColorName.trim(),
      hex: newColorHex,
    };

    const updated = [...colorDefs.filter((c) => c.code.toUpperCase() !== codeUpper), newColor];

    setColorDefs(updated);
    saveColorCodes(updated);
    setNewColorCode('');
    setNewColorName('');
    triggerSaveNotice();

    // Persist to server
    fetch('/api/colors/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newColor),
    }).catch(() => {});
  };

  // Start editing an existing color
  const handleStartEditColor = (c: ColorCodeDef) => {
    setEditingColor(c);
    setEditColorCode(c.code);
    setEditColorName(c.name);
    setEditColorHex(c.hex);
  };

  // Save changes to edited color
  const handleSaveEditColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingColor || !editColorCode.trim() || !editColorName.trim()) return;

    const codeUpper = editColorCode.trim().toUpperCase();
    const updatedDef: ColorCodeDef = {
      code: codeUpper,
      name: editColorName.trim(),
      hex: editColorHex,
    };

    const updated = colorDefs.map((c) => (c.code === editingColor.code ? updatedDef : c));
    setColorDefs(updated);
    saveColorCodes(updated);
    setEditingColor(null);
    triggerSaveNotice();

    // Persist to server
    fetch('/api/colors/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDef),
    }).catch(() => {});
  };

  // Delete color
  const handleDeleteColor = (code: string) => {
    if (confirm(`¿Eliminar el código de color ${code}?`)) {
      const updated = colorDefs.filter((c) => c.code.toUpperCase() !== code.toUpperCase());
      setColorDefs(updated);
      saveColorCodes(updated);
      if (editingColor?.code === code) {
        setEditingColor(null);
      }
      triggerSaveNotice();

      // Persist to server
      fetch(`/api/colors/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#18231C] text-[#F5F2EC] rounded-xs shrink-0 mt-0.5">
              <Palette className="w-6 h-6 text-[#B9522F]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
                Colores y Talles por Artículo
              </h3>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Seleccioná la categoría y el código de artículo para definir qué colores Pampero tiene disponibles y si utiliza talles en letras o números.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowColorDict(!showColorDict)}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#18231C] rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-[#B9522F]" />
            {showColorDict ? 'Ocultar Códigos C1, C4...' : 'Ver / Editar Códigos de Color (C1, B1...)'}
          </button>
        </div>

        {/* Global Color Dictionary Drawer (Optional expand) */}
        {showColorDict && (
          <div className="mt-4 pt-4 border-t border-[#DCD4C9] bg-[#FAF8F5] p-4 rounded-xs border border-dashed border-[#DCD4C9] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Diccionario de Códigos de Color Pampero (C1, C4, B1, etc.)
                </h4>
                <p className="text-[11px] text-[#6F6860] mt-0.5">
                  Podés agregar nuevos colores o hacer clic sobre cualquiera ya cargado para editar su código, nombre o tono exacto.
                </p>
              </div>
            </div>

            {/* Edit Existing Color Form */}
            {editingColor && (
              <form onSubmit={handleSaveEditColor} className="bg-amber-50/70 p-3 rounded-xs border-2 border-[#B9522F] flex flex-wrap items-center gap-2 animate-fadeIn">
                <span className="text-xs font-bold text-[#B9522F] uppercase tracking-wider">Editando:</span>
                <input
                  type="text"
                  required
                  placeholder="Código"
                  value={editColorCode}
                  onChange={(e) => setEditColorCode(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white rounded-xs border border-[#DCD4C9] uppercase w-24 font-bold"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre de color"
                  value={editColorName}
                  onChange={(e) => setEditColorName(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white rounded-xs border border-[#DCD4C9] w-48 font-medium"
                />
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xs border border-[#DCD4C9]">
                  <input
                    type="color"
                    value={editColorHex}
                    onChange={(e) => setEditColorHex(e.target.value)}
                    className="w-5 h-5 rounded-xs border-0 cursor-pointer p-0"
                  />
                  <span className="text-[10px] font-mono">{editColorHex}</span>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#B9522F] text-white text-xs font-bold rounded-xs flex items-center gap-1 hover:bg-[#A34323] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteColor(editingColor.code)}
                  className="px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                  title="Eliminar este color"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingColor(null)}
                  className="px-2 py-1 text-xs text-[#6F6860] hover:text-[#18231C] font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            )}

            {/* Add New Color Form */}
            {!editingColor && (
              <form onSubmit={handleAddGlobalColor} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Código (ej. B1, C4)"
                  value={newColorCode}
                  onChange={(e) => setNewColorCode(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white rounded-xs border border-[#DCD4C9] uppercase w-28"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre (ej. Beige Ripstop)"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white rounded-xs border border-[#DCD4C9] w-48"
                />
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xs border border-[#DCD4C9]">
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-5 h-5 rounded-xs border-0 cursor-pointer p-0"
                  />
                  <span className="text-[10px] font-mono">{newColorHex}</span>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#18231C] text-white text-xs font-bold rounded-xs flex items-center gap-1 hover:bg-black cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Color
                </button>
              </form>
            )}

            {/* Color Chips Grid with Edit & Delete */}
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
              {colorDefs.map((c) => (
                <div
                  key={c.code}
                  onClick={() => handleStartEditColor(c)}
                  className={`group px-2.5 py-1.5 rounded-xs bg-white border text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all hover:border-[#B9522F] hover:shadow-xs ${
                    editingColor?.code === c.code ? 'border-2 border-[#B9522F] bg-amber-50/50' : 'border-[#DCD4C9]'
                  }`}
                  title="Hacé clic para editar este color"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="font-bold font-mono text-[#18231C]">{c.code}:</span>
                  <span className="text-[#4A453F]">{c.name}</span>
                  
                  {/* Subtle edit pencil */}
                  <Edit3 className="w-3 h-3 text-[#B9522F] opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main 2-Column Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Picker by Category and Search */}
        <div className="lg:col-span-4 bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1.5">
              1. Seleccioná la Categoría
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['Hombre', 'Mujer', 'Infantil', 'Venta Corporativa'] as MainCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-2 rounded-xs text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer border ${
                    selectedCategory === cat
                      ? 'bg-[#18231C] text-white border-[#18231C] shadow-xs'
                      : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18231C] mb-1.5">
              2. Buscá por Código o Nombre
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6F6860] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ej. 32170002M, Ripstop, Cargo..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] outline-none focus:border-[#B9522F]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-[#6F6860] font-bold uppercase tracking-wider mb-1.5">
              <span>Artículos ({availableProducts.length})</span>
              <span>Elegí uno para editar</span>
            </div>

            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {availableProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#6F6860] bg-[#FAF8F5] rounded-xs">
                  No se encontraron artículos con ese filtro.
                </div>
              ) : (
                availableProducts.map((p) => {
                  const isSelected = p.id === currentProduct?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProductId(p.id)}
                      className={`w-full p-2.5 rounded-xs border text-left transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FAF8F5] border-[#B9522F] shadow-xs ring-1 ring-[#B9522F]/40'
                          : 'bg-white border-[#DCD4C9] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-xs border border-[#DCD4C9] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-[#B9522F]">
                            {p.code}
                          </span>
                          <span className="text-[10px] text-[#6F6860] truncate">
                            · {p.section}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-[#18231C] truncate">{p.name}</h5>
                        <div className="text-[10px] text-[#6F6860] mt-0.5 flex items-center gap-2">
                          <span>{p.availableColors?.length || 0} colores</span>
                          <span>·</span>
                          <span>{p.availableSizes?.length || 0} talles</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Editor for Selected Product */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-6">
          {currentProduct ? (
            <>
              {/* Product Header Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
                <div className="flex items-center gap-3.5">
                  <img
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className="w-14 h-14 object-cover rounded-xs border border-[#DCD4C9] shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-xs bg-[#18231C] text-white font-mono text-xs font-bold">
                        {currentProduct.code}
                      </span>
                      <span className="text-xs text-[#6F6860] font-bold">
                        {currentProduct.category} · {currentProduct.section}
                      </span>
                    </div>
                    <h4 className="font-display text-lg text-[#18231C] font-bold mt-1">
                      {currentProduct.name}
                    </h4>
                    <p className="text-xs text-[#6F6860]">
                      Subcategoría: {currentProduct.subCategory}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProductVariants}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Guardar Cambios del Artículo
                </button>
              </div>

              {savedSuccess && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xs text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  ¡Colores y talles actualizados con éxito en el catálogo!
                </div>
              )}

              {/* SECTION A: TALLES (LETRAS O NÚMEROS) */}
              <div className="space-y-4 border-t border-[#DCD4C9] pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-[#B9522F]" />
                      Tipo de Talle y Talles Habilitados
                    </h4>
                    <p className="text-xs text-[#6F6860] mt-0.5">
                      Definí si este artículo usa talles en letras (ej. S, M, L) o en números (ej. 38, 40, 42 para pantalones / 39, 40 para calzado).
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleApplyPresetSizes('letters')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border cursor-pointer ${
                        sizeFormat === 'letters'
                          ? 'bg-[#18231C] text-white border-[#18231C]'
                          : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9]'
                      }`}
                    >
                      Letras (S, M, L...)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetSizes('pants')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border cursor-pointer ${
                        sizeFormat === 'pants'
                          ? 'bg-[#18231C] text-white border-[#18231C]'
                          : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9]'
                      }`}
                    >
                      Pantalones (40, 42...)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetSizes('shoes')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border cursor-pointer ${
                        sizeFormat === 'shoes'
                          ? 'bg-[#18231C] text-white border-[#18231C]'
                          : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9]'
                      }`}
                    >
                      Calzado (39, 40...)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetSizes('unique')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xs border cursor-pointer ${
                        sizeFormat === 'unique'
                          ? 'bg-[#18231C] text-white border-[#18231C]'
                          : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9]'
                      }`}
                    >
                      Único
                    </button>
                  </div>
                </div>

                {/* Sizes List Selection */}
                <div>
                  <span className="text-[11px] font-bold text-[#6F6860] uppercase block mb-2">
                    Talles activos para {currentProduct.name} (Hacé click para activar o desactivar):
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {/* Render according to current format */}
                    {(sizeFormat === 'letters'
                      ? SIZES_LETTERS
                      : sizeFormat === 'shoes'
                      ? SIZES_NUMBERS_SHOES
                      : sizeFormat === 'unique'
                      ? SIZES_UNIQUE
                      : SIZES_NUMBERS_PANTS
                    ).map((size) => {
                      const isEnabled = activeSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleToggleSize(size)}
                          className={`px-3.5 py-2 rounded-xs border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isEnabled
                              ? 'bg-[#18231C] text-white border-[#18231C] shadow-xs'
                              : 'bg-white text-[#6F6860] border-[#DCD4C9] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
                              isEnabled ? 'bg-[#B9522F] border-white/40 text-white' : 'border-[#DCD4C9]'
                            }`}
                          >
                            {isEnabled && <Check className="w-2.5 h-2.5" />}
                          </span>
                          <span>{size}</span>
                        </button>
                      );
                    })}

                    {/* Any other custom sizes already in activeSizes */}
                    {activeSizes
                      .filter(
                        (s) =>
                          !SIZES_LETTERS.includes(s) &&
                          !SIZES_NUMBERS_PANTS.includes(s) &&
                          !SIZES_NUMBERS_SHOES.includes(s) &&
                          !SIZES_UNIQUE.includes(s)
                      )
                      .map((custom) => (
                        <button
                          key={custom}
                          type="button"
                          onClick={() => handleToggleSize(custom)}
                          className="px-3.5 py-2 rounded-xs border text-xs font-bold bg-[#18231C] text-white border-[#18231C] shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="w-3.5 h-3.5 rounded-xs bg-[#B9522F] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                          <span>{custom}</span>
                        </button>
                      ))}
                  </div>

                  {/* Add Custom Size input */}
                  <form onSubmit={handleAddCustomSize} className="flex items-center gap-2 mt-3 max-w-sm">
                    <input
                      type="text"
                      placeholder="Agregar otro talle (ej. 62, 5XL, 38 Especial)"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white rounded-xs border border-[#DCD4C9] outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#18231C] text-white text-xs font-bold rounded-xs flex items-center gap-1 hover:bg-black cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </form>
                </div>
              </div>

              {/* SECTION B: COLORES DISPONIBLES */}
              <div className="space-y-4 border-t border-[#DCD4C9] pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[#B9522F]" />
                      Colores Disponibles para este Artículo
                    </h4>
                    <p className="text-xs text-[#6F6860] mt-0.5">
                      Hacé click sobre los colores que fabricamos o comercializamos de este modelo.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#B9522F]">
                    {activeColors.length} colores seleccionados
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {colorDefs.map((col) => {
                    const isSelected =
                      activeColors.includes(col.name) ||
                      activeColors.includes(col.code) ||
                      activeColors.some((ac) => ac.toLowerCase() === col.name.toLowerCase());

                    return (
                      <button
                        key={col.code}
                        type="button"
                        onClick={() => handleToggleColor(col.name)}
                        className={`p-2.5 rounded-xs border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#18231C] text-white border-[#18231C] shadow-xs'
                            : 'bg-[#FAF8F5] text-[#4A453F] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                          style={{ backgroundColor: col.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-mono text-[10px] font-bold ${
                                isSelected ? 'text-amber-300' : 'text-[#B9522F]'
                              }`}
                            >
                              {col.code}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                          </div>
                          <div className="text-xs font-bold truncate leading-tight mt-0.5">
                            {col.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Action bar */}
              <div className="pt-4 border-t border-[#DCD4C9] flex items-center justify-between">
                <div className="text-xs text-[#6F6860]">
                  Los cambios impactan en tiempo real en la ficha del producto, selector de talles y cotizador.
                </div>
                <button
                  type="button"
                  onClick={handleSaveProductVariants}
                  className="px-6 py-2.5 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Guardar Variantes de {currentProduct.code}
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-[#6F6860]">
              Seleccioná un artículo de la lista izquierda para configurar sus variantes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
