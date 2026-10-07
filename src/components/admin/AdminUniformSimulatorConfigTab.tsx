import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Save, 
  Check, 
  Plus, 
  Trash2, 
  Palette, 
  Shield, 
  Info, 
  DollarSign,
  Search,
  Upload,
  CheckCircle2,
  Shirt,
  X,
  Filter,
  Image as ImageIcon
} from 'lucide-react';
import { Product } from '../../types';
import { saveFirestoreStoreConfig, fetchFirestoreStoreConfig, uploadImageToStorage, saveFirestoreSimulatorConfig } from '../../services/firebase';

export interface CustomSimulatorGarment {
  id: string;
  name: string;
  category: string;
  baseImage: string;
  availableColors: { name: string; hex: string }[];
}

export interface SimulatorConfig {
  title: string;
  subtitle: string;
  embroideryMatrixPrice: number;
  embroideryPerGarmentPrice: number;
  minUnitsForDiscount: number;
  discountPercentage: number;
  allowedPlacements: Array<{ id: string; label: string; maxDimensions: string; enabled: boolean }>;
  acceptedFileFormats: string;
  instructionsText: string;
  enabledProductIds?: string[];
  customGarments?: CustomSimulatorGarment[];
}

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  title: 'Simulador Bordado · Armador de Uniformes Pampero',
  subtitle: 'Previsualizá tu logo bordado en tiempo real sobre prendas de trabajo oficiales',
  embroideryMatrixPrice: 15000,
  embroideryPerGarmentPrice: 2800,
  minUnitsForDiscount: 20,
  discountPercentage: 15,
  allowedPlacements: [
    { id: 'chest_left', label: 'Pecho Izquierdo (Estándar 9x5 cm)', maxDimensions: '9x5 cm', enabled: true },
    { id: 'chest_right', label: 'Pecho Derecho (9x5 cm)', maxDimensions: '9x5 cm', enabled: true },
    { id: 'back_upper', label: 'Espalda Superior (25x10 cm)', maxDimensions: '25x10 cm', enabled: true },
    { id: 'back_center', label: 'Espalda Central (Grande 28x15 cm)', maxDimensions: '28x15 cm', enabled: true },
    { id: 'sleeve_left', label: 'Manga Izquierda (7x4 cm)', maxDimensions: '7x4 cm', enabled: true },
    { id: 'sleeve_right', label: 'Manga Derecha (7x4 cm)', maxDimensions: '7x4 cm', enabled: true },
  ],
  acceptedFileFormats: 'PNG, JPG, PDF vectorial, AI, EPS, DST',
  instructionsText: 'Subí tu logo en fondo transparente para una mejor simulación. Los precios de matriz y bordado son estimados y se confirman con la muestra física.',
  enabledProductIds: [],
  customGarments: [],
};

interface AdminUniformSimulatorConfigTabProps {
  triggerSaveNotice: () => void;
  products?: Product[];
}

export const AdminUniformSimulatorConfigTab: React.FC<AdminUniformSimulatorConfigTabProps> = ({ 
  triggerSaveNotice,
  products = []
}) => {
  const [config, setConfig] = useState<SimulatorConfig>(() => {
    try {
      const saved = localStorage.getItem('pampero_simulator_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SIMULATOR_CONFIG;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('todas');

  // Custom garment upload form
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Indumentaria Especial');
  const [customColors, setCustomColors] = useState('Azul Marino, Negro, Blanco, Verde Oliva');
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchFirestoreStoreConfig().then((remote: any) => {
      if (remote && remote.simulatorConfig) {
        setConfig((prev) => ({
          ...prev,
          ...remote.simulatorConfig,
          enabledProductIds: remote.simulatorConfig.enabledProductIds || prev.enabledProductIds || [],
          customGarments: remote.simulatorConfig.customGarments || prev.customGarments || [],
        }));
        try {
          localStorage.setItem('pampero_simulator_config', JSON.stringify(remote.simulatorConfig));
        } catch {}
      }
    }).catch(console.warn);
  }, []);

  const handleTogglePlacement = (id: string) => {
    const updated = config.allowedPlacements.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    );
    setConfig({ ...config, allowedPlacements: updated });
  };

  const handleToggleProduct = (productId: string) => {
    const current = config.enabledProductIds || [];
    const exists = current.includes(productId);
    const updated = exists 
      ? current.filter((id) => id !== productId) 
      : [...current, productId];
    setConfig({ ...config, enabledProductIds: updated });
  };

  const handleEnableAllProducts = () => {
    const allIds = products.map((p) => p.id || p.code);
    setConfig({ ...config, enabledProductIds: allIds });
  };

  const handleEnableApparelProducts = () => {
    const apparelIds = products
      .filter((p) => {
        const cat = (p.category || '').toLowerCase();
        const sub = (p.subcategory || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return (
          cat.includes('indumentaria') || 
          sub.includes('camisa') || 
          sub.includes('chomba') || 
          sub.includes('remera') || 
          sub.includes('campera') || 
          sub.includes('chaleco') ||
          sub.includes('pantalon') ||
          name.includes('camisa') ||
          name.includes('chomba') ||
          name.includes('campera')
        );
      })
      .map((p) => p.id || p.code);
    setConfig({ ...config, enabledProductIds: apparelIds });
  };

  const handleDisableAllProducts = () => {
    setConfig({ ...config, enabledProductIds: [] });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCustomGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setUploadError('Ingresá el nombre de la prenda.');
      return;
    }
    if (!customImageFile && !customImagePreview) {
      setUploadError('Seleccioná una imagen o mockup de la prenda.');
      return;
    }

    setIsUploadingCustom(true);
    setUploadError(null);

    try {
      let finalImageUrl = customImagePreview || '';
      if (customImageFile) {
        finalImageUrl = await uploadImageToStorage(customImageFile, 'simulator-mockups');
      }

      const parsedColors = customColors
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((name) => {
          let hex = '#1C1C1C';
          const n = name.toLowerCase();
          if (n.includes('azul')) hex = '#1B263B';
          else if (n.includes('blanco')) hex = '#F8F9FA';
          else if (n.includes('verde')) hex = '#3E4A35';
          else if (n.includes('rojo')) hex = '#8B0000';
          else if (n.includes('gris')) hex = '#585E64';
          else if (n.includes('beige') || n.includes('arena')) hex = '#D7C4A5';
          else if (n.includes('naranja')) hex = '#FF6700';
          return { name, hex };
        });

      const newGarment: CustomSimulatorGarment = {
        id: `garment-${Date.now()}`,
        name: customName.trim(),
        category: customCategory.trim() || 'Indumentaria',
        baseImage: finalImageUrl,
        availableColors: parsedColors.length > 0 ? parsedColors : [{ name: 'Estándar', hex: '#1C1C1C' }],
      };

      const updatedCustom = [...(config.customGarments || []), newGarment];
      setConfig({ ...config, customGarments: updatedCustom });
      setCustomName('');
      setCustomImageFile(null);
      setCustomImagePreview(null);
      setShowAddCustom(false);
    } catch (err: any) {
      console.error('[SIMULATOR] Error subiendo prenda personalizada:', err);
      setUploadError(`Error al subir la imagen: ${err?.message || err}`);
    } finally {
      setIsUploadingCustom(false);
    }
  };

  const handleDeleteCustomGarment = (id: string) => {
    const updated = (config.customGarments || []).filter((g) => g.id !== id);
    setConfig({ ...config, customGarments: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('pampero_simulator_config', JSON.stringify(config));
      await saveFirestoreSimulatorConfig(config);
      await saveFirestoreStoreConfig({ simulatorConfig: config });
      triggerSaveNotice();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración del simulador:', err);
    }
  };

  // Filter products for selector
  const categoriesList = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      (p.name || '').toLowerCase().includes(searchCatalog.toLowerCase()) ||
      (p.code || '').toLowerCase().includes(searchCatalog.toLowerCase());
    const matchesCat = catalogCategoryFilter === 'todas' || p.category === catalogCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const enabledCount = (config.enabledProductIds || []).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#18231C] text-white rounded-xs">
            <Sparkles className="w-6 h-6 text-[#FDB813]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Armador de Uniformes · Selección de Artículos & Costos
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Habilitá qué artículos del catálogo pueden simularse con bordados/estampados y subí mockups personalizados para las empresas.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600" />
            ¡Guardado en Cloud Firestore!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECCIÓN 1: SELECCIÓN DE ARTÍCULOS DEL CATÁLOGO PARA SIMULACIÓN */}
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#ECE5DC]">
            <div>
              <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#B9522F]" />
                Artículos del Catálogo Habilitados para Simulación de Logos
              </h4>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Seleccioná las prendas del catálogo que aparecerán en el Armador Virtual.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-xs border border-neutral-300">
                {enabledCount} seleccionados
              </span>
              <button
                type="button"
                onClick={handleEnableApparelProducts}
                className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-xs hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Solo Indumentaria
              </button>
              <button
                type="button"
                onClick={handleEnableAllProducts}
                className="text-xs font-semibold px-2.5 py-1 bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Habilitar Todos
              </button>
              <button
                type="button"
                onClick={handleDisableAllProducts}
                className="text-xs font-semibold px-2.5 py-1 text-red-700 hover:text-red-900 transition-colors cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchCatalog}
                onChange={(e) => setSearchCatalog(e.target.value)}
                placeholder="Buscar artículo por nombre o código..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white text-[#18231C] outline-none"
              >
                <option value="todas">Todas las categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Grid */}
          <div className="max-h-72 overflow-y-auto border border-[#DCD4C9] rounded-xs divide-y divide-[#ECE5DC]">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                No se encontraron artículos con ese filtro.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const pId = p.id || p.code;
                const isEnabled = (config.enabledProductIds || []).includes(pId);
                const thumb = p.image || (p.images && p.images[0]) || '/placeholder.jpg';

                return (
                  <label
                    key={pId}
                    className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-50 transition-colors ${
                      isEnabled ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleProduct(pId)}
                        className="rounded-xs text-[#B9522F] accent-[#B9522F] cursor-pointer w-4 h-4 shrink-0"
                      />
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-10 h-10 object-contain rounded-xs border border-[#DCD4C9] bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#18231C] truncate">{p.name}</p>
                        <p className="text-[10px] text-[#6F6860] font-mono">{p.code} · {p.category}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-xs shrink-0 ${
                      isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {isEnabled ? 'Habilitado' : 'No visible'}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* SECCIÓN 2: SUBIR PRENDAS / MOCKUPS PERSONALIZADOS */}
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECE5DC]">
            <div>
              <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#B9522F]" />
                Subir Prendas o Mockups Especiales
              </h4>
              <p className="text-xs text-[#6F6860] mt-0.5">
                Subí imágenes con fondo transparente o prendas especiales para el simulador de bordados.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="text-xs font-bold px-3 py-1.5 bg-[#18231C] text-white hover:bg-black rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAddCustom ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showAddCustom ? 'Cerrar' : 'Subir Nueva Prenda'}</span>
            </button>
          </div>

          {showAddCustom && (
            <div className="p-4 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-4">
              <h5 className="font-bold text-xs uppercase text-[#18231C]">Cargar Prenda al Simulador</h5>

              {uploadError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xs">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Nombre de la Prenda *</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ej: Chomba Piqué Premium"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Ej: Indumentaria Corporativa"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-neutral-700 mb-1">Colores Disponibles (separados por coma)</label>
                  <input
                    type="text"
                    value={customColors}
                    onChange={(e) => setCustomColors(e.target.value)}
                    placeholder="Ej: Azul Marino, Blanco, Negro, Verde Oliva"
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#B9522F]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-neutral-700 mb-1">Foto / Mockup de la Prenda *</label>
                  <div className="flex items-center gap-4">
                    <label className="border-2 border-dashed border-[#DCD4C9] hover:border-[#B9522F] bg-white p-3 rounded-xs flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-bold text-neutral-700">
                      <Upload className="w-4 h-4 text-neutral-500" />
                      <span>{customImageFile ? customImageFile.name : 'Seleccionar Archivo (PNG / JPG)'}</span>
                      <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                    </label>

                    {customImagePreview && (
                      <img
                        src={customImagePreview}
                        alt="Preview"
                        className="w-12 h-12 object-contain border border-[#DCD4C9] rounded-xs bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCreateCustomGarment}
                  disabled={isUploadingCustom}
                  className="px-4 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider text-xs rounded-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isUploadingCustom ? 'Subiendo a Storage...' : 'Guardar Prenda'}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of custom garments */}
          {(config.customGarments || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(config.customGarments || []).map((cg) => (
                <div key={cg.id} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={cg.baseImage}
                      alt={cg.name}
                      className="w-10 h-10 object-contain rounded-xs border border-neutral-300 bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800 truncate">{cg.name}</p>
                      <p className="text-[10px] text-neutral-500">{cg.category} · {cg.availableColors?.length || 0} colores</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomGarment(cg.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Eliminar prenda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">No hay prendas mockup personalizadas cargadas actualmente.</p>
          )}
        </div>

        {/* SECCIÓN 3: PRECIOS Y CONDICIONES DE BORDADO */}
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4 text-xs">
          <h4 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#ECE5DC]">
            <DollarSign className="w-4 h-4 text-[#B9522F]" />
            Tarifas y Condiciones de Bordado Corporativo
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Título del Simulador</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Subtítulo Descriptivo</label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#ECE5DC]">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Costo de Matriz Digital ($)</label>
              <input
                type="number"
                value={config.embroideryMatrixPrice}
                onChange={(e) => setConfig({ ...config, embroideryMatrixPrice: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
              <span className="text-[10px] text-neutral-500">Costo único de digitalización de matriz</span>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Bordado por Prenda ($)</label>
              <input
                type="number"
                value={config.embroideryPerGarmentPrice}
                onChange={(e) => setConfig({ ...config, embroideryPerGarmentPrice: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
              <span className="text-[10px] text-neutral-500">Costo unitario por aplicación</span>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Descuento Corporativo (%)</label>
              <input
                type="number"
                value={config.discountPercentage}
                onChange={(e) => setConfig({ ...config, discountPercentage: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
              <span className="text-[10px] text-neutral-500">Al superar {config.minUnitsForDiscount} prendas</span>
            </div>
          </div>

          {/* Posiciones de bordado */}
          <div className="pt-2 border-t border-[#ECE5DC]">
            <label className="block font-bold text-neutral-700 mb-2">Posiciones de Bordado Habilitadas</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {config.allowedPlacements.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-xs cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={() => handleTogglePlacement(p.id)}
                      className="rounded-xs text-[#B9522F] accent-[#B9522F]"
                    />
                    <span className="font-semibold text-neutral-800">{p.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">{p.maxDimensions}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#ECE5DC]">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Formatos de Archivo Aceptados</label>
              <input
                type="text"
                value={config.acceptedFileFormats}
                onChange={(e) => setConfig({ ...config, acceptedFileFormats: e.target.value })}
                className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Instrucciones al Cliente</label>
              <textarea
                value={config.instructionsText}
                onChange={(e) => setConfig({ ...config, instructionsText: e.target.value })}
                rows={2}
                className="w-full p-2.5 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider text-xs rounded-xs flex items-center gap-2 cursor-pointer shadow-md transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Toda la Configuración en Firestore</span>
          </button>
        </div>
      </form>
    </div>
  );
};
