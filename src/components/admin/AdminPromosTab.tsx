import React, { useState, useRef } from 'react';
import { Promotion, Product } from '../../types';
import { Tag, Plus, Edit2, Trash2, Check, Upload, Image, Eye, EyeOff, Search, Layers, Palette, Type } from 'lucide-react';

interface AdminPromosTabProps {
  promotions: Promotion[];
  products: Product[];
  onUpdatePromotions: (promos: Promotion[]) => void;
  triggerSaveNotice: () => void;
}

export const AdminPromosTab: React.FC<AdminPromosTabProps> = ({
  promotions,
  products,
  onUpdatePromotions,
  triggerSaveNotice,
}) => {
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = useState<Partial<Promotion>>({
    title: '',
    subtitle: '',
    badge: 'PROMO DESTACADA',
    bannerImage: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1600&q=80',
    tagFilter: 'Temporada 2026',
    active: true,
    discountPercentage: 15,
    associatedProductCodes: [],
    textColor: '#FFFFFF',
    fontSize: '72px',
    subtitleColor: '#DCD4C9',
    subtitleFontSize: '16px',
    primaryBtnText: 'VER CATÁLOGO',
  });

  const handleOpenCreate = () => {
    setForm({
      title: '',
      subtitle: '',
      badge: 'TEMPORADA 2026',
      bannerImage: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1600&q=80',
      tagFilter: 'Temporada 2026',
      active: true,
      discountPercentage: 15,
      associatedProductCodes: products.slice(0, 3).map((p) => p.code),
      textColor: '#FFFFFF',
      fontSize: '72px',
      subtitleColor: '#DCD4C9',
      subtitleFontSize: '16px',
      primaryBtnText: 'VER CATÁLOGO',
    });
    setEditingPromo(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setForm({
      ...promo,
      textColor: promo.textColor || '#FFFFFF',
      fontSize: promo.fontSize || '72px',
      subtitleColor: promo.subtitleColor || '#DCD4C9',
      subtitleFontSize: promo.subtitleFontSize || '16px',
      associatedProductCodes: promo.associatedProductCodes || [],
    });
    setIsCreating(true);
  };

  const handleFileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccioná una imagen válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setForm((prev) => ({ ...prev, bannerImage: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleAssociatedProduct = (code: string) => {
    setForm((prev) => {
      const current = prev.associatedProductCodes || [];
      const exists = current.includes(code);
      const updated = exists ? current.filter((c) => c !== code) : [...current, code];
      return { ...prev, associatedProductCodes: updated };
    });
  };

  const handleSelectAllFiltered = () => {
    const filteredCodes = filteredProducts.map((p) => p.code);
    setForm((prev) => {
      const current = new Set(prev.associatedProductCodes || []);
      filteredCodes.forEach((c) => current.add(c));
      return { ...prev, associatedProductCodes: Array.from(current) };
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredCodes = new Set(filteredProducts.map((p) => p.code));
    setForm((prev) => ({
      ...prev,
      associatedProductCodes: (prev.associatedProductCodes || []).filter((c) => !filteredCodes.has(c)),
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) {
      alert('Por favor ingresá el título de la promoción.');
      return;
    }

    if (editingPromo) {
      const updated = promotions.map((p) =>
        p.id === editingPromo.id ? ({ ...p, ...form } as Promotion) : p
      );
      onUpdatePromotions(updated);
    } else {
      const newPromo: Promotion = {
        id: 'promo-' + Date.now(),
        title: form.title || 'Nueva Promoción',
        subtitle: form.subtitle || '',
        badge: form.badge || 'PROMO',
        bannerImage:
          form.bannerImage ||
          'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1600&q=80',
        tagFilter: form.tagFilter || 'Temporada 2026',
        active: form.active ?? true,
        discountOnly: false,
        discountPercentage: form.discountPercentage || 0,
        associatedProductCodes: form.associatedProductCodes || [],
        textColor: form.textColor || '#FFFFFF',
        fontSize: form.fontSize || '72px',
        subtitleColor: form.subtitleColor || '#DCD4C9',
        subtitleFontSize: form.subtitleFontSize || '16px',
        primaryBtnText: form.primaryBtnText || 'VER CATÁLOGO',
      };
      onUpdatePromotions([newPromo, ...promotions]);
    }

    setIsCreating(false);
    setEditingPromo(null);
    triggerSaveNotice();
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Desea eliminar esta promoción?')) {
      onUpdatePromotions(promotions.filter((p) => p.id !== id));
      triggerSaveNotice();
    }
  };

  const toggleActive = (id: string) => {
    const updated = promotions.map((p) =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    onUpdatePromotions(updated);
    triggerSaveNotice();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.subCategory.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F5F2EC] rounded-xs border border-[#DCD4C9]">
        <div>
          <h3 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#B9522F]" />
            Gestión de Promociones y Temporada Pampero
          </h3>
          <p className="text-xs text-[#6F6860]">
            Editá las fotos de portada, textos que van sobre la imagen y seleccioná qué artículos pertenecen a cada promo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#B9522F]" />
          Nueva Promoción
        </button>
      </div>

      {/* Editor Modal / Drawer if creating or editing */}
      {isCreating && (
        <div className="bg-white p-5 sm:p-6 rounded-xs border-2 border-[#B9522F] shadow-lg space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-3">
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
                {editingPromo ? `Editar Promoción: ${editingPromo.title}` : 'Crear Nueva Promoción'}
              </h4>
              <p className="text-xs text-[#6F6860]">
                Definí los textos superpuestos, la imagen de fondo y los artículos vinculados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-[#6F6860] hover:text-[#18231C] font-semibold"
            >
              ✕ Cerrar
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Live Banner Preview */}
            <div className="space-y-2">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                Vista Previa en Tiempo Real del Banner (Estilos en línea dinámicos)
              </span>
              <div className="relative h-48 sm:h-56 w-full rounded-xs overflow-hidden border border-[#DCD4C9] shadow-sm bg-neutral-900">
                <img
                  src={form.bannerImage}
                  alt={form.title || 'Banner Preview'}
                  className="w-full h-full object-cover object-center opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
                <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end text-white">
                  <span className="inline-block self-start px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs bg-[#B9522F] text-white shadow-xs mb-2">
                    {form.badge || 'ETIQUETA'}
                  </span>
                  <h3 
                    className="font-display uppercase tracking-wider leading-tight font-bold drop-shadow-sm"
                    style={{
                      color: form.textColor || '#FFFFFF',
                      fontSize: form.fontSize ? `clamp(1.5rem, 2.8vw, ${form.fontSize})` : '2rem',
                    }}
                  >
                    {form.title || 'TÍTULO DE LA PROMOCIÓN'}
                  </h3>
                  <p 
                    className="mt-1 max-w-xl line-clamp-2 leading-relaxed"
                    style={{
                      color: form.subtitleColor || '#DCD4C9',
                      fontSize: form.subtitleFontSize || '14px',
                    }}
                  >
                    {form.subtitle || 'Subtítulo y detalles de la promoción para el catálogo oficial.'}
                  </p>
                  {Number(form.discountPercentage || 0) > 0 && (
                    <span className="text-[11px] font-bold text-amber-300 mt-1">
                      Descuento exclusivo: {form.discountPercentage}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs: Title, Subtitle, Badge, Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Título de la Promoción (Texto sobre la imagen) *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: ESPECIAL ABRIGO Y POLAR"
                  required
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Texto del Badge / Etiqueta *
                </label>
                <input
                  type="text"
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="Ej: HASTA 25% OFF"
                  required
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Subtítulo / Bajada Descriptiva
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Ej: Línea térmica de alta resistencia para bajas temperaturas en campo y ciudad."
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1">
                  Porcentaje de Descuento (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={form.discountPercentage || 0}
                  onChange={(e) => setForm({ ...form, discountPercentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                />
              </div>
            </div>

            {/* CONTROLES DE TIPOGRAFÍA: COLOR Y TAMAÑO DE FUENTE */}
            <div className="p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCD4C9]/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#B9522F]" />
                  <span className="text-xs uppercase tracking-wider font-bold text-[#18231C]">
                    Estilos de Tipografía: Color y Tamaño de Fuente
                  </span>
                </div>
                <span className="text-[11px] text-[#6F6860]">
                  Configuración guardada en la promoción y aplicada en el frontend
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Color de Fuente (Título) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                    Color de Fuente (Título)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.textColor || '#FFFFFF'}
                      onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                      className="w-8 h-8 rounded-xs border border-[#DCD4C9] cursor-pointer p-0.5 bg-white shrink-0"
                      title="Elegir color de título"
                    />
                    <input
                      type="text"
                      value={form.textColor || '#FFFFFF'}
                      onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                      placeholder="#FFFFFF"
                      className="flex-1 px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C] uppercase"
                    />
                  </div>
                  {/* Presets rápidos */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {[
                      { name: 'Blanco Puro', color: '#FFFFFF' },
                      { name: 'Amarillo Pampero', color: '#FDB813' },
                      { name: 'Naranja Óxido', color: '#B9522F' },
                      { name: 'Crema Tradición', color: '#F5F2EC' },
                      { name: 'Oscuro Profundo', color: '#18231C' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setForm({ ...form, textColor: c.color })}
                        style={{ backgroundColor: c.color }}
                        className="w-4 h-4 rounded-full border border-neutral-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* 2. Tamaño de Fuente (Título) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                    Tamaño de Fuente (Título)
                  </label>
                  <select
                    value={
                      ['48px', '56px', '64px', '72px', '80px', '96px'].includes(form.fontSize || '')
                        ? form.fontSize
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setForm({ ...form, fontSize: e.target.value });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                  >
                    <option value="48px">48px - Compacto</option>
                    <option value="56px">56px - Mediano</option>
                    <option value="64px">64px - Grande</option>
                    <option value="72px">72px - Extra Grande (Recomendado)</option>
                    <option value="80px">80px - Gigante</option>
                    <option value="96px">96px - Máximo Impacto</option>
                    <option value="custom">Valor libre...</option>
                  </select>
                  <input
                    type="text"
                    value={form.fontSize || '72px'}
                    onChange={(e) => setForm({ ...form, fontSize: e.target.value })}
                    placeholder="Ej: 72px o 4.5rem"
                    className="w-full px-2.5 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C]"
                  />
                </div>

                {/* 3. Color de Fuente (Subtítulo) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                    Color de Fuente (Subtítulo)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.subtitleColor || '#DCD4C9'}
                      onChange={(e) => setForm({ ...form, subtitleColor: e.target.value })}
                      className="w-8 h-8 rounded-xs border border-[#DCD4C9] cursor-pointer p-0.5 bg-white shrink-0"
                      title="Elegir color de subtítulo"
                    />
                    <input
                      type="text"
                      value={form.subtitleColor || '#DCD4C9'}
                      onChange={(e) => setForm({ ...form, subtitleColor: e.target.value })}
                      placeholder="#DCD4C9"
                      className="flex-1 px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C] uppercase"
                    />
                  </div>
                  {/* Presets rápidos */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {[
                      { name: 'Arena Pampero', color: '#DCD4C9' },
                      { name: 'Blanco Puro', color: '#FFFFFF' },
                      { name: 'Gris Claro', color: '#E5E5E5' },
                      { name: 'Dorado Suave', color: '#FEE5A5' },
                      { name: 'Negro Suave', color: '#2B3B30' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setForm({ ...form, subtitleColor: c.color })}
                        style={{ backgroundColor: c.color }}
                        className="w-4 h-4 rounded-full border border-neutral-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* 4. Tamaño de Fuente (Subtítulo) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                    Tamaño de Fuente (Subtítulo)
                  </label>
                  <select
                    value={
                      ['13px', '14px', '16px', '18px', '20px'].includes(form.subtitleFontSize || '')
                        ? form.subtitleFontSize
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setForm({ ...form, subtitleFontSize: e.target.value });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                  >
                    <option value="13px">13px - Discreto</option>
                    <option value="14px">14px - Compacto</option>
                    <option value="16px">16px - Estándar Lectura</option>
                    <option value="18px">18px - Mediano</option>
                    <option value="20px">20px - Destacado</option>
                    <option value="custom">Valor libre...</option>
                  </select>
                  <input
                    type="text"
                    value={form.subtitleFontSize || '16px'}
                    onChange={(e) => setForm({ ...form, subtitleFontSize: e.target.value })}
                    placeholder="Ej: 16px o 1.1rem"
                    className="w-full px-2.5 py-1 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C]"
                  />
                </div>
              </div>
            </div>

            {/* Banner Image Selection: Upload File or URL */}
            <div className="space-y-3 p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#18231C]">
                Foto de la Promoción (Subir Archivo o URL)
              </label>
              
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-[#B9522F]" />
                  Subir Imagen desde la Computadora
                </button>
                <span className="text-xs text-[#6F6860]">o pegá una URL directa abajo:</span>
              </div>

              <input
                type="text"
                value={form.bannerImage}
                onChange={(e) => setForm({ ...form, bannerImage: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C]"
              />
            </div>

            {/* ARTÍCULOS ASOCIADOS A LA PROMOCIÓN */}
            <div className="space-y-3 p-4 bg-white rounded-xs border border-[#DCD4C9]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCD4C9] pb-3">
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#B9522F]" />
                    Artículos Asociados a esta Promoción ({form.associatedProductCodes?.length || 0} seleccionados)
                  </h5>
                  <p className="text-xs text-[#6F6860]">
                    Marcá los productos del catálogo que se mostrarán cuando el cliente haga clic en esta promoción.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[11px] text-[#B9522F] hover:underline font-semibold"
                  >
                    Seleccionar visibles ({filteredProducts.length})
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-[11px] text-[#6F6860] hover:underline"
                  >
                    Deseleccionar visibles
                  </button>
                </div>
              </div>

              {/* Product search filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6F6860]" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar artículos por nombre, código (ej: PAM-10005) o categoría..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                />
              </div>

              {/* Product check list */}
              <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs divide-y divide-[#DCD4C9]/40">
                {filteredProducts.map((p) => {
                  const isChecked = (form.associatedProductCodes || []).includes(p.code);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-2 rounded-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-[#B9522F]/10 border border-[#B9522F]/40' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssociatedProduct(p.code)}
                        className="w-4 h-4 rounded-xs text-[#B9522F] accent-[#B9522F]"
                      />
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-xs border border-[#DCD4C9] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#18231C] truncate">{p.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#DCD4C9] rounded-xs text-[#18231C]">
                            {p.code}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#6F6860]">
                          {p.category} · {p.subCategory} · ${p.price.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6F6860] hover:text-[#18231C]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {editingPromo ? 'Guardar Cambios de Promoción' : 'Crear Promoción'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Promos Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promotions.map((promo) => (
          <div
            key={promo.id}
            className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
          >
            {/* Banner Header */}
            <div className="relative h-40 w-full overflow-hidden bg-black">
              <img
                src={promo.bannerImage}
                alt={promo.title}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
                <span className="self-start px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs bg-[#B9522F] mb-1">
                  {promo.badge}
                </span>
                <h4 
                  className="font-display uppercase tracking-wider leading-tight text-xl sm:text-2xl"
                  style={{
                    color: promo.textColor || '#FFFFFF',
                  }}
                >
                  {promo.title}
                </h4>
                <p 
                  className="text-[11px] line-clamp-1 mt-0.5"
                  style={{
                    color: promo.subtitleColor || '#E5E5E5',
                  }}
                >
                  {promo.subtitle}
                </p>
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(promo.id)}
                  className={`px-2 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm ${
                    promo.active ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {promo.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {promo.active ? 'Activa' : 'Pausada'}
                </button>
              </div>
            </div>

            {/* Card Content & Details */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6F6860]">Artículos vinculados:</span>
                  <span className="font-bold text-[#18231C]">
                    {promo.associatedProductCodes?.length || 0} artículos
                  </span>
                </div>
                {promo.discountPercentage ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6F6860]">Descuento especial:</span>
                    <span className="font-bold text-[#B9522F]">
                      {promo.discountPercentage}% OFF
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#DCD4C9]/50">
                  <span className="text-[#6F6860]">Tipografía del Título:</span>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-3 h-3 rounded-full border border-neutral-300 inline-block shadow-2xs"
                      style={{ backgroundColor: promo.textColor || '#FFFFFF' }}
                    />
                    <span className="font-mono text-[11px] font-bold text-[#18231C]">
                      {promo.textColor || '#FFFFFF'} · {promo.fontSize || '72px'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6F6860]">Tipografía del Subtítulo:</span>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-3 h-3 rounded-full border border-neutral-300 inline-block shadow-2xs"
                      style={{ backgroundColor: promo.subtitleColor || '#DCD4C9' }}
                    />
                    <span className="font-mono text-[11px] font-bold text-[#18231C]">
                      {promo.subtitleColor || '#DCD4C9'} · {promo.subtitleFontSize || '16px'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(promo)}
                  className="px-3 py-1.5 bg-[#F5F2EC] hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-[#B9522F]" />
                  Editar Textos & Artículos
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(promo.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                  title="Eliminar promoción"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
