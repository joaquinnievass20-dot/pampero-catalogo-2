import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LookbookItem, LookbookHotspot, Product, ThemeConfig } from '../../types';
import { CATEGORY_HIERARCHY } from '../../data/categories';
import { compressImage } from '../../utils/imageCompressor';
import { uploadImageToStorage, saveFirestoreLookbook, subscribeToFirestoreLookbook } from '../../services/firebase';
import { 
  Plus, 
  Trash2, 
  Save, 
  Upload, 
  Move, 
  Eye, 
  Sparkles, 
  Crosshair, 
  Image as ImageIcon,
  Check,
  AlertCircle
} from 'lucide-react';

interface AdminLookbookTabProps {
  lookbook: LookbookItem[];
  products: Product[];
  theme: ThemeConfig;
  onUpdateLookbook: (updated: LookbookItem[]) => Promise<void> | void;
  triggerSaveNotice: () => void;
}

export const AdminLookbookTab: React.FC<AdminLookbookTabProps> = ({
  lookbook,
  products,
  theme,
  onUpdateLookbook,
  triggerSaveNotice,
}) => {
  const [looks, setLooks] = useState<LookbookItem[]>(lookbook || []);
  const [selectedLookId, setSelectedLookId] = useState<string>(looks[0]?.id || '');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const accent = theme.accentColor || '#FDB813';
  const activeLook = looks.find((l) => l.id === selectedLookId) || looks[0];

  // Notify user
  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Live Firestore onSnapshot subscription for Lookbook across all devices
  useEffect(() => {
    const unsub = subscribeToFirestoreLookbook((remoteLooks) => {
      if (Array.isArray(remoteLooks) && remoteLooks.length > 0) {
        setLooks(remoteLooks);
      }
    });
    return () => unsub();
  }, []);

  // 1. Add new Look
  const handleAddNewLook = () => {
    const newLook: LookbookItem = {
      id: `look-${Date.now()}`,
      title: 'Nuevo Look de Campaña',
      subtitle: 'Descripción del conjunto de prendas Pampero.',
      imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80',
      season: 'Temporada 2026',
      order: looks.length + 1,
      hotspots: [],
    };
    const updated = [...looks, newLook];
    setLooks(updated);
    setSelectedLookId(newLook.id);
    setSelectedHotspotId(null);
  };

  // 2. Delete Look
  const handleDeleteLook = (id: string) => {
    if (looks.length <= 1) {
      alert('Debe existir al menos un look en el catálogo interactivo.');
      return;
    }
    if (!confirm('¿Eliminar este look del catálogo interactivo?')) return;
    const updated = looks.filter((l) => l.id !== id);
    setLooks(updated);
    if (selectedLookId === id) {
      setSelectedLookId(updated[0]?.id || '');
      setSelectedHotspotId(null);
    }
  };

  // 3. Update current look field
  const handleUpdateLookField = (field: keyof LookbookItem, value: any) => {
    if (!activeLook) return;
    const updated = looks.map((l) => (l.id === activeLook.id ? { ...l, [field]: value } : l));
    setLooks(updated);
  };

  // 4. Handle file upload for campaign photo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
      });

      // Subir EXCLUSIVAMENTE a Firebase Storage y obtener URL pública
      const publicUrl = await uploadImageToStorage(compressed, 'lookbook');
      handleUpdateLookField('imageUrl', publicUrl);
      notify('success', 'Imagen subida a Firebase Storage exitosamente.');
    } catch (err: any) {
      console.error('Error subiendo imagen de lookbook a Firebase Storage:', err);
      notify('error', 'Error al subir a Firebase Storage: ' + (err?.message || 'Intente nuevamente'));
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Click on image to add or reposition hotspot
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    if (!activeLook || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const rawX = (clickX / rect.width) * 100;
    const rawY = (clickY / rect.height) * 100;

    const x = Math.max(2, Math.min(98, Math.round(rawX * 10) / 10));
    const y = Math.max(2, Math.min(98, Math.round(rawY * 10) / 10));

    // Default to first product if available
    const defaultProduct = products[0];

    const newHotspot: LookbookHotspot = {
      id: `hs-${Date.now()}`,
      productId: defaultProduct ? defaultProduct.id : '',
      x,
      y,
      label: defaultProduct ? defaultProduct.name : 'Nueva prenda',
    };

    const updatedHotspots = [...activeLook.hotspots, newHotspot];
    handleUpdateLookField('hotspots', updatedHotspots);
    setSelectedHotspotId(newHotspot.id);
  };

  // 6. Drag Hotspot logic
  const handleHotspotMouseDown = (e: React.MouseEvent, hotspotId: string) => {
    e.stopPropagation();
    setSelectedHotspotId(hotspotId);
    isDraggingRef.current = false;

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) {
        isDraggingRef.current = true;
      }
      if (!imageRef.current || !activeLook) return;

      const rect = imageRef.current.getBoundingClientRect();
      const currentX = moveEvent.clientX - rect.left;
      const currentY = moveEvent.clientY - rect.top;

      const rawX = (currentX / rect.width) * 100;
      const rawY = (currentY / rect.height) * 100;

      const x = Math.max(2, Math.min(98, Math.round(rawX * 10) / 10));
      const y = Math.max(2, Math.min(98, Math.round(rawY * 10) / 10));

      setLooks((prev) =>
        prev.map((l) => {
          if (l.id !== activeLook.id) return l;
          return {
            ...l,
            hotspots: l.hotspots.map((hs) => (hs.id === hotspotId ? { ...hs, x, y } : hs)),
          };
        })
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 7. Update hotspot product or label
  const handleUpdateHotspot = (hsId: string, updates: Partial<LookbookHotspot>) => {
    if (!activeLook) return;
    const updated = activeLook.hotspots.map((hs) => {
      if (hs.id !== hsId) return hs;
      const next = { ...hs, ...updates };
      // If productId changed, auto-update label if blank
      if (updates.productId) {
        const prod = products.find((p) => p.id === updates.productId || p.code === updates.productId);
        if (prod) {
          next.label = prod.name;
        }
      }
      return next;
    });
    handleUpdateLookField('hotspots', updated);
  };

  // 8. Delete hotspot
  const handleDeleteHotspot = (hsId: string) => {
    if (!activeLook) return;
    const updated = activeLook.hotspots.filter((hs) => hs.id !== hsId);
    handleUpdateLookField('hotspots', updated);
    if (selectedHotspotId === hsId) setSelectedHotspotId(null);
  };

  // 9. Save all to Server and Persist
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveFirestoreLookbook(looks);
      await onUpdateLookbook(looks);
      triggerSaveNotice();
      notify('success', '¡Lookbook guardado y sincronizado con éxito en Firestore y Storage!');
    } catch (err: any) {
      console.error(err);
      notify('error', `Error al persistir lookbook: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedHotspot = activeLook?.hotspots.find((h) => h.id === selectedHotspotId);

  // 3-level chained selector state for hotspot editing
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');

  const currentSelectedProduct = useMemo(() => {
    if (!selectedHotspot?.productId) return null;
    return (
      products.find(
        (p) =>
          p.id === selectedHotspot.productId ||
          p.code?.toLowerCase() === selectedHotspot.productId.toLowerCase()
      ) || null
    );
  }, [products, selectedHotspot?.productId]);

  // Synchronize category and section when selected hotspot changes
  useEffect(() => {
    if (selectedHotspot) {
      const matched = products.find(
        (p) =>
          p.id === selectedHotspot.productId ||
          p.code?.toLowerCase() === selectedHotspot.productId.toLowerCase()
      );
      if (matched) {
        setFilterCategory(matched.category || '');
        setFilterSection(matched.subCategory || matched.section || '');
      } else {
        setFilterCategory('');
        setFilterSection('');
      }
    } else {
      setFilterCategory('');
      setFilterSection('');
    }
  }, [selectedHotspotId, selectedHotspot?.productId, products]);

  const availableSubCategories = useMemo(() => {
    if (!filterCategory) return [];
    
    // Find category structure in CATEGORY_HIERARCHY
    const catStruct = CATEGORY_HIERARCHY.find(
      (c) => c.name.toLowerCase() === filterCategory.toLowerCase()
    );
    
    // Hierarchy subcategories & sections strictly belonging to this category
    const hierarchyItems: string[] = [];
    if (catStruct) {
      catStruct.sections.forEach((sec) => {
        hierarchyItems.push(sec.name);
        sec.subCategories.forEach((sub) => {
          if (sub !== 'Ver Todo' && sub !== 'General') {
            hierarchyItems.push(sub);
          }
        });
      });
    }

    // Also include any actual subCategory or section used by products in this category
    const prodsInCat = products.filter(
      (p) => (p.category || '').toLowerCase() === filterCategory.toLowerCase()
    );
    prodsInCat.forEach((p) => {
      if (p.subCategory && p.subCategory !== 'General' && p.subCategory !== 'Ver Todo') {
        hierarchyItems.push(p.subCategory);
      }
      if (p.section && p.section !== 'General' && p.section !== 'Todos') {
        hierarchyItems.push(p.section);
      }
    });

    return Array.from(new Set(hierarchyItems)).sort();
  }, [products, filterCategory]);

  const filteredProducts = useMemo(() => {
    if (!filterCategory) return [];
    return products.filter((p) => {
      const matchesCat = (p.category || '').toLowerCase() === filterCategory.toLowerCase();
      if (!matchesCat) return false;
      if (!filterSection || filterSection === 'TODAS') return true;
      const filterLower = filterSection.toLowerCase();
      const matchesSec = (p.section || '').toLowerCase() === filterLower;
      const matchesSub = (p.subCategory || '').toLowerCase() === filterLower;
      return matchesSec || matchesSub;
    });
  }, [products, filterCategory, filterSection]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header with Title and Global Save Button */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#18231C] text-white rounded-xs shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Gestión del Lookbook (Catálogo Interactivo)
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Cargá fotos de campaña a cuerpo completo, ubicá puntos interactivos sobre cada prenda y vinculalos directamente al catálogo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusMessage && (
            <div
              className={`px-3 py-1.5 rounded-xs text-xs font-bold flex items-center gap-1.5 animate-fadeIn ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              )}
              {statusMessage.text}
            </div>
          )}

          <button
            id="btn-save-lookbook-server"
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {isSaving ? 'Guardando...' : 'Guardar Lookbook'}
          </button>
        </div>
      </div>

      {/* Tabs of Looks + Add New Look Button */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#DCD4C9]">
        {looks.map((look, index) => (
          <button
            key={look.id}
            type="button"
            onClick={() => {
              setSelectedLookId(look.id);
              setSelectedHotspotId(null);
            }}
            className={`px-3.5 py-2 rounded-xs text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer ${
              look.id === selectedLookId
                ? 'bg-[#18231C] text-white shadow-xs'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400'
            }`}
            style={{
              borderColor: look.id === selectedLookId ? accent : undefined,
            }}
          >
            <span>Look #{index + 1}: {look.title.slice(0, 20)}</span>
            <span 
              className="text-[9px] px-1.5 py-0.2 rounded-full font-black"
              style={{
                backgroundColor: look.id === selectedLookId ? accent : '#ECE5DC',
                color: '#18231C',
              }}
            >
              {look.hotspots.length}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={handleAddNewLook}
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1 border border-neutral-300 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo Look
        </button>
      </div>

      {/* Main Look Editor Area */}
      {activeLook && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Visual Image Hotspot Canvas (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4" style={{ color: accent }} />
                  <span className="font-bold text-xs uppercase tracking-wider text-neutral-900">
                    Editor Visual de Puntos Interactivos
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {activeLook.hotspots.length} prendas vinculadas
                </span>
              </div>

              {/* Instructions banner */}
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xs text-[11px] text-amber-900 flex items-start gap-2">
                <Move className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>¿Cómo agregar o mover puntos?</strong> Hacé clic en cualquier prenda de la foto para crear un nuevo punto interactivo. Podés arrastrarlo con el mouse para ajustar su posición milimétricamente.
                </div>
              </div>

              {/* Interactive Image Container */}
              <div
                onClick={handleImageClick}
                className="relative rounded-xs overflow-hidden bg-neutral-900 cursor-crosshair border border-neutral-300 select-none"
              >
                <img
                  ref={imageRef}
                  src={activeLook.imageUrl}
                  alt={activeLook.title}
                  className="w-full h-auto max-h-[600px] object-cover pointer-events-none"
                />

                {/* Hotspot Pins Overlay */}
                {activeLook.hotspots.map((hs, index) => {
                  const isSelected = hs.id === selectedHotspotId;
                  const linkedProd = products.find(
                    (p) => p.id === hs.productId || p.code.toLowerCase() === hs.productId.toLowerCase()
                  );

                  return (
                    <div
                      key={hs.id}
                      onMouseDown={(e) => handleHotspotMouseDown(e, hs.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHotspotId(hs.id);
                      }}
                      style={{
                        left: `${hs.x}%`,
                        top: `${hs.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute z-20 cursor-grab active:cursor-grabbing p-2"
                      title={`${hs.label || linkedProd?.name || 'Prenda'} (Arrastrar para mover)`}
                    >
                      {/* Pulse Indicator */}
                      <span
                        className="absolute w-7 h-7 rounded-full opacity-60 animate-ping pointer-events-none"
                        style={{ backgroundColor: accent }}
                      />

                      {/* Outer Ring */}
                      <span
                        className={`absolute w-6 h-6 rounded-full border-2 transition-all shadow-md ${
                          isSelected ? 'bg-black border-white scale-125' : 'bg-[#18231C] border-white'
                        }`}
                      />

                      {/* Number Badge */}
                      <span
                        className="relative z-10 w-4 h-4 rounded-full flex items-center justify-center font-black text-[9px]"
                        style={{ backgroundColor: accent, color: '#18231C' }}
                      >
                        {index + 1}
                      </span>

                      {/* Label Tag */}
                      <span
                        className={`absolute ${hs.y <= 40 ? 'top-full mt-1' : 'bottom-full mb-1'} left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-xs bg-black/90 text-white text-[9px] font-bold whitespace-nowrap shadow-md pointer-events-none ${
                          isSelected ? 'border border-amber-400' : 'opacity-85'
                        }`}
                      >
                        {hs.label || linkedProd?.name || `#${index + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Look Data & Selected Hotspot Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* General Look Info */}
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <span className="font-bold text-xs uppercase tracking-wider text-neutral-900">
                  Configuración de la Campaña
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteLook(activeLook.id)}
                  className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar Look
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                  Título del Look / Campaña
                </label>
                <input
                  type="text"
                  value={activeLook.title}
                  onChange={(e) => handleUpdateLookField('title', e.target.value)}
                  placeholder="ej. Campaña Campo Tradición · Mendoza"
                  className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                  Bajada o Subtítulo descriptivo
                </label>
                <textarea
                  rows={2}
                  value={activeLook.subtitle || ''}
                  onChange={(e) => handleUpdateLookField('subtitle', e.target.value)}
                  placeholder="ej. Conjunto completo de labor rural con gabardina pesada."
                  className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                  Etiqueta / Temporada
                </label>
                <input
                  type="text"
                  value={activeLook.season || ''}
                  onChange={(e) => handleUpdateLookField('season', e.target.value)}
                  placeholder="ej. Temporada 2026 o Línea Campo"
                  className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                  Foto de Campaña
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activeLook.imageUrl}
                    onChange={(e) => handleUpdateLookField('imageUrl', e.target.value)}
                    placeholder="https://... o ruta de imagen"
                    className="flex-1 px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none"
                  />
                  <label className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer text-neutral-800 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    Subir
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Hotspot Inspector */}
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <span className="font-bold text-xs uppercase tracking-wider text-neutral-900">
                  {selectedHotspot ? 'Editar Prenda Seleccionada' : 'Seleccioná un punto interactivo'}
                </span>
                {selectedHotspot && (
                  <button
                    type="button"
                    onClick={() => handleDeleteHotspot(selectedHotspot.id)}
                    className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar Punto
                  </button>
                )}
              </div>

              {selectedHotspot ? (
                <div className="space-y-3">
                  {/* Menú 1: Categoría Oficial */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                      1. Categoría
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFilterCategory(newCat);
                        setFilterSection('');
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none bg-white font-medium"
                    >
                      <option value="">-- Seleccionar categoría --</option>
                      {CATEGORY_HIERARCHY.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Menú 2: Subcategoría Oficial */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                      2. Subcategoría / Sección
                    </label>
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      disabled={!filterCategory}
                      className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none bg-white font-medium disabled:opacity-50 disabled:bg-neutral-100"
                    >
                      <option value="">
                        {filterCategory ? '-- Todas las subcategorías --' : '-- Primero elija categoría --'}
                      </option>
                      {availableSubCategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Menú 3: Producto final vinculado */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                      3. Producto final vinculado
                    </label>
                    <select
                      value={selectedHotspot.productId}
                      onChange={(e) => handleUpdateHotspot(selectedHotspot.id, { productId: e.target.value })}
                      disabled={!filterCategory}
                      className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none bg-white font-medium disabled:opacity-50 disabled:bg-neutral-100"
                    >
                      <option value="">
                        {!filterCategory
                          ? '-- Seleccione categoría y sección primero --'
                          : filteredProducts.length === 0
                          ? '-- No hay productos en esta selección --'
                          : '-- Seleccionar producto final --'}
                      </option>
                      {filteredProducts.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          [{prod.code}] {prod.name} ({prod.section || 'General'}) - ${prod.price.toLocaleString('es-AR')}
                        </option>
                      ))}
                    </select>

                    {currentSelectedProduct && (
                      <div className="mt-2 p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold">Prenda actual vinculada:</p>
                          <p className="font-bold text-[#18231C] truncate">
                            [{currentSelectedProduct.code}] {currentSelectedProduct.name}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-neutral-900 shrink-0">
                          ${currentSelectedProduct.price.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                      Etiqueta visible
                    </label>
                    <input
                      type="text"
                      value={selectedHotspot.label || ''}
                      onChange={(e) => handleUpdateHotspot(selectedHotspot.id, { label: e.target.value })}
                      placeholder="Nombre de la prenda que ve el cliente"
                      className="w-full px-3 py-2 text-xs rounded-xs border border-neutral-300 focus:border-neutral-900 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                        Coordenada X (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedHotspot.x}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, { x: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-xs border border-neutral-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                        Coordenada Y (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedHotspot.y}
                        onChange={(e) =>
                          handleUpdateHotspot(selectedHotspot.id, { y: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-xs border border-neutral-300"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  Hacé clic en cualquier punto sobre la foto a la izquierda para editar qué producto del catálogo representa.
                </div>
              )}
            </div>

            {/* List of all hotspots for quick reference */}
            <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-xs space-y-2">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-900 block pb-1 border-b border-neutral-200">
                Resumen de Prendas ({activeLook.hotspots.length})
              </span>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {activeLook.hotspots.map((hs, i) => {
                  const prod = products.find(
                    (p) => p.id === hs.productId || p.code.toLowerCase() === hs.productId.toLowerCase()
                  );
                  const isSelected = hs.id === selectedHotspotId;

                  return (
                    <div
                      key={hs.id}
                      onClick={() => setSelectedHotspotId(hs.id)}
                      className={`p-2 rounded-xs text-xs flex items-center justify-between cursor-pointer border ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-100 font-bold'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                          style={{ backgroundColor: accent, color: '#18231C' }}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate">{hs.label || prod?.name || 'Prenda sin título'}</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                        {hs.x}% / {hs.y}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
