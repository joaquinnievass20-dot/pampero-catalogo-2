import React, { useState, useRef, useEffect } from 'react';
import { Promotion, Product, PromotionButton } from '../../types';
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Upload, 
  Image, 
  Eye, 
  EyeOff, 
  Search, 
  Layers, 
  Palette, 
  Type, 
  MousePointer, 
  ExternalLink, 
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  uploadPromotionBanner,
  saveFirestorePromotion,
  deleteFirestorePromotion,
  subscribeToFirestorePromotions,
} from '../../services/firebase';

interface AdminPromosTabProps {
  promotions: Promotion[];
  products: Product[];
  onUpdatePromotions: (promos: Promotion[]) => void;
  onUpdateProducts?: (products: Product[]) => void;
  triggerSaveNotice: () => void;
}

export const AdminPromosTab: React.FC<AdminPromosTabProps> = ({
  promotions,
  products,
  onUpdatePromotions,
  onUpdateProducts,
  triggerSaveNotice,
}) => {
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronización en vivo exclusiva con Cloud Firestore mediante onSnapshot
  useEffect(() => {
    const unsub = subscribeToFirestorePromotions((remotePromos) => {
      if (Array.isArray(remotePromos) && remotePromos.length > 0) {
        onUpdatePromotions(remotePromos);
      }
    });
    return () => unsub();
  }, []);

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
    buttons: [
      { id: 'btn-1', label: 'VER ESPECIAL CAMPO', actionType: 'catalog', style: 'primary' },
      { id: 'btn-2', label: 'CUENTA EMPRESA', actionType: 'auth', actionValue: 'empresa', style: 'outline' },
    ],
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
      associatedProductCodes: [],
      textColor: '#FFFFFF',
      fontSize: '72px',
      subtitleColor: '#DCD4C9',
      subtitleFontSize: '16px',
      primaryBtnText: 'VER CATÁLOGO',
      buttons: [
        { id: 'btn-' + Date.now() + '-1', label: 'VER ESPECIAL CAMPO', actionType: 'catalog', style: 'primary' },
        { id: 'btn-' + Date.now() + '-2', label: 'CUENTA EMPRESA', actionType: 'auth', actionValue: 'empresa', style: 'outline' },
      ],
    });
    setEditingPromo(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    const existingButtons = promo.buttons && promo.buttons.length > 0 
      ? promo.buttons 
      : [
          { id: 'btn-1', label: promo.primaryBtnText || 'VER CATÁLOGO', actionType: 'catalog' as const, style: 'primary' as const },
          { id: 'btn-2', label: 'CUENTA EMPRESA', actionType: 'auth' as const, actionValue: 'empresa', style: 'outline' as const },
        ];

    // Find all products that are currently associated with this promo:
    // Either directly by associatedProductCodes OR by matching tagFilter/badge/title
    const linkedCodes = new Set<string>(promo.associatedProductCodes || []);
    products.forEach((p) => {
      if (
        p.promotionTag &&
        (p.promotionTag === promo.tagFilter ||
         p.promotionTag === promo.badge ||
         p.promotionTag === promo.title)
      ) {
        linkedCodes.add(p.code);
      }
    });

    setForm({
      ...promo,
      textColor: promo.textColor || '#FFFFFF',
      fontSize: promo.fontSize || '72px',
      subtitleColor: promo.subtitleColor || '#DCD4C9',
      subtitleFontSize: promo.subtitleFontSize || '16px',
      associatedProductCodes: Array.from(linkedCodes),
      buttons: existingButtons,
    });
    setIsCreating(true);
  };

  const handleAddButton = () => {
    const newBtn: PromotionButton = {
      id: 'btn-' + Date.now(),
      label: 'NUEVO BOTÓN',
      actionType: 'catalog',
      actionValue: '',
      style: (form.buttons?.length || 0) === 0 ? 'primary' : 'outline',
    };
    setForm((prev) => ({
      ...prev,
      buttons: [...(prev.buttons || []), newBtn],
    }));
  };

  const handleUpdateButton = (id: string, updates: Partial<PromotionButton>) => {
    setForm((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const handleRemoveButton = (id: string) => {
    setForm((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).filter((b) => b.id !== id),
    }));
  };

  // EXCLUSIVAMENTE subida de archivos utilizando uploadBytes y getDownloadURL de Firebase Storage
  const handleFileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccioná una imagen válida (JPG, PNG, WEBP, AVIF).');
      return;
    }

    setIsUploadingImage(true);
    setUploadError(null);

    try {
      const promoId = editingPromo?.id || form.id || `promo-${Date.now()}`;
      // Subida obligatoria y exclusiva a Firebase Storage mediante SDK oficial
      const downloadUrl = await uploadPromotionBanner(file, promoId);
      setForm((prev) => ({ ...prev, bannerImage: downloadUrl }));
    } catch (err: any) {
      console.error('[FIREBASE STORAGE] Error al subir imagen de banner:', err);
      const msg = err?.message || 'Error de conexión con Firebase Storage.';
      setUploadError(msg);
      alert(`Error al subir la imagen a Firebase Storage: ${msg}`);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  // Guardado persistente exclusivo en Cloud Firestore (Colección dedicada 'promotions')
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) {
      alert('Por favor ingresá el título de la promoción.');
      return;
    }

    if (form.bannerImage && form.bannerImage.startsWith('data:image/')) {
      alert('Prohibido guardar imágenes en Base64. Por favor subí la imagen mediante el botón oficial de Firebase Storage (uploadBytes) o ingresá una URL pública válida.');
      return;
    }

    setIsSaving(true);
    const primaryLabel = form.buttons?.[0]?.label || form.primaryBtnText || 'VER CATÁLOGO';
    const selectedCodes = form.associatedProductCodes || [];
    const targetTag = form.tagFilter || form.badge || form.title || 'Promoción';

    try {
      if (editingPromo) {
        const updatedPromo: Promotion = {
          ...editingPromo,
          ...form,
          primaryBtnText: primaryLabel,
          textColor: form.textColor || '#FFFFFF',
          fontSize: form.fontSize || '72px',
          subtitleColor: form.subtitleColor || '#DCD4C9',
          subtitleFontSize: form.subtitleFontSize || '16px',
        } as Promotion;

        const updated = promotions.map((p) =>
          p.id === editingPromo.id ? updatedPromo : p
        );
        onUpdatePromotions(updated);

        // Guardado directo en Firestore
        await saveFirestorePromotion(updatedPromo);

        // Synchronize product promotion tags
        if (onUpdateProducts) {
          const updatedProducts = products.map((p) => {
            const isSelected = selectedCodes.includes(p.code);
            const wasTaggedWithThisPromo = p.promotionTag && (
              p.promotionTag === editingPromo.tagFilter ||
              p.promotionTag === editingPromo.badge ||
              p.promotionTag === editingPromo.title ||
              p.promotionTag === form.tagFilter ||
              p.promotionTag === form.badge
            );

            if (isSelected) {
              return { ...p, promotionTag: targetTag };
            } else if (wasTaggedWithThisPromo) {
              return { ...p, promotionTag: '' };
            }
            return p;
          });
          onUpdateProducts(updatedProducts);
        }
      } else {
        const newPromo: Promotion = {
          id: form.id || 'promo-' + Date.now(),
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
          associatedProductCodes: selectedCodes,
          textColor: form.textColor || '#FFFFFF',
          fontSize: form.fontSize || '72px',
          subtitleColor: form.subtitleColor || '#DCD4C9',
          subtitleFontSize: form.subtitleFontSize || '16px',
          primaryBtnText: primaryLabel,
          buttons: form.buttons || [],
        };
        onUpdatePromotions([newPromo, ...promotions]);

        // Guardado directo en Firestore
        await saveFirestorePromotion(newPromo);

        if (onUpdateProducts && selectedCodes.length > 0) {
          const updatedProducts = products.map((p) => {
            if (selectedCodes.includes(p.code)) {
              return { ...p, promotionTag: targetTag };
            }
            return p;
          });
          onUpdateProducts(updatedProducts);
        }
      }

      setIsCreating(false);
      setEditingPromo(null);
      triggerSaveNotice();
    } catch (err: any) {
      console.error('[PROMOTION SAVE ERROR]:', err);
      alert('Hubo un error al guardar la promoción en Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminación persistente exclusiva en Cloud Firestore (Colección dedicada 'promotions')
  const handleDelete = async (id: string) => {
    if (confirm('¿Desea eliminar esta promoción permanentemente?')) {
      const promoToDelete = promotions.find((p) => p.id === id);
      onUpdatePromotions(promotions.filter((p) => p.id !== id));

      try {
        await deleteFirestorePromotion(id);
      } catch (err) {
        console.error('[PROMOTION DELETE ERROR]:', err);
      }

      if (promoToDelete && onUpdateProducts) {
        const updatedProducts = products.map((p) => {
          const wasTagged = p.promotionTag && (
            p.promotionTag === promoToDelete.tagFilter ||
            p.promotionTag === promoToDelete.badge ||
            p.promotionTag === promoToDelete.title ||
            promoToDelete.associatedProductCodes?.includes(p.code)
          );
          if (wasTagged) {
            return { ...p, promotionTag: '' };
          }
          return p;
        });
        onUpdateProducts(updatedProducts);
      }

      triggerSaveNotice();
    }
  };

  // Activación / Desactivación en vivo persistida en Cloud Firestore
  const toggleActive = async (id: string) => {
    const target = promotions.find((p) => p.id === id);
    if (!target) return;
    const updatedPromo: Promotion = { ...target, active: !target.active };
    const updated = promotions.map((p) =>
      p.id === id ? updatedPromo : p
    );
    onUpdatePromotions(updated);

    try {
      await saveFirestorePromotion(updatedPromo);
    } catch (err) {
      console.error('[PROMOTION TOGGLE ERROR]:', err);
    }

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

                  {/* Buttons Preview inside Live Banner */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                    {(form.buttons && form.buttons.length > 0
                      ? form.buttons
                      : [{ id: 'b-default', label: form.primaryBtnText || 'VER CATÁLOGO', style: 'primary' as const }]
                    ).map((btn) => (
                      <span
                        key={btn.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider ${
                          btn.style === 'primary'
                            ? 'bg-[#FDB813] text-[#18231C]'
                            : 'border border-white/70 text-white bg-black/40'
                        }`}
                      >
                        {btn.label}
                        {btn.style === 'primary' && <ArrowRight className="w-2.5 h-2.5" />}
                      </span>
                    ))}
                  </div>
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

            {/* Banner Image Selection: Upload File exclusively to Firebase Storage or URL */}
            <div className="space-y-3 p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#18231C]">
                  Foto de la Promoción (Firebase Storage)
                </label>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Firebase Storage SDK (uploadBytes)
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileImageUpload}
                  accept="image/*"
                  disabled={isUploadingImage}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-4 py-2 bg-white hover:bg-neutral-100 border border-[#DCD4C9] rounded-xs text-xs font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2 cursor-pointer transition-all shadow-xs ${
                    isUploadingImage ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 text-[#B9522F] animate-spin" />
                      <span>Subiendo a Firebase Storage...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-[#B9522F]" />
                      <span>Subir Imagen a Firebase Storage</span>
                    </>
                  )}
                </button>
                <span className="text-xs text-[#6F6860]">o ingresá la URL pública de Storage:</span>
              </div>

              {uploadError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-xs text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <input
                type="text"
                value={form.bannerImage}
                onChange={(e) => setForm({ ...form, bannerImage: e.target.value })}
                placeholder="https://firebasestorage.googleapis.com/..."
                className="w-full px-3 py-2 bg-white border border-[#DCD4C9] rounded-xs text-xs font-mono text-[#18231C]"
              />

              {form.bannerImage && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-16 h-10 rounded-xs overflow-hidden border border-[#DCD4C9] shrink-0 bg-neutral-200">
                    <img 
                      src={form.bannerImage} 
                      alt="Vista previa" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#6F6860] block">URL actual almacenada:</span>
                    <span className="text-xs font-mono text-[#18231C] truncate block max-w-md">{form.bannerImage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN DEL BANNER (PERSONALIZACIÓN COMPLETA DE BOTONES) */}
            <div className="space-y-4 p-4 bg-[#FAF8F5] rounded-xs border border-[#DCD4C9]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCD4C9]/80 pb-3">
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                    <MousePointer className="w-4 h-4 text-[#B9522F]" />
                    Botones de Acción del Banner ({form.buttons?.length || 0})
                  </h5>
                  <p className="text-xs text-[#6F6860] mt-0.5">
                    Personalizá dinámicamente cada botón del slider: editá su texto (ej: "VER ESPECIAL CAMPO"), su enlace/acción y su estilo visual.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    + Agregar Botón
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        buttons: [
                          { id: 'btn-' + Date.now() + '-1', label: 'VER ESPECIAL CAMPO', actionType: 'catalog', style: 'primary' },
                          { id: 'btn-' + Date.now() + '-2', label: 'CUENTA EMPRESA', actionType: 'auth', actionValue: 'empresa', style: 'outline' },
                        ],
                      }));
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-[#DCD4C9] text-[#4A453F] rounded-xs text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    title="Cargar botones estándar Pampero"
                  >
                    Cargar Predeterminados
                  </button>
                </div>
              </div>

              {(!form.buttons || form.buttons.length === 0) ? (
                <div className="p-4 text-center bg-white rounded-xs border border-dashed border-[#DCD4C9]">
                  <p className="text-xs text-[#6F6860]">
                    Este banner no tiene botones personalizados. Se utilizará el botón por defecto ("{form.primaryBtnText || 'VER CATÁLOGO'}").
                  </p>
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#B9522F] font-bold hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar el primer botón
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.buttons.map((btn, index) => (
                    <div
                      key={btn.id}
                      className="p-3.5 bg-white rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#DCD4C9]/40 pb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#18231C] text-white text-[9px] flex items-center justify-center font-mono">
                            {index + 1}
                          </span>
                          Botón {index + 1}: "{btn.label}"
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(btn.id)}
                          className="text-[11px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Quitar botón
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Texto del Botón */}
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                            Texto / Etiqueta del Botón *
                          </label>
                          <input
                            type="text"
                            value={btn.label}
                            onChange={(e) => handleUpdateButton(btn.id, { label: e.target.value })}
                            placeholder="Ej: VER ESPECIAL CAMPO"
                            required
                            className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                          />
                        </div>

                        {/* 2. Tipo de Acción */}
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                            Acción al hacer clic
                          </label>
                          <select
                            value={btn.actionType}
                            onChange={(e) => handleUpdateButton(btn.id, { actionType: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                          >
                            <option value="catalog">Abrir Catálogo (con filtro)</option>
                            <option value="category">Ir a Categoría del Catálogo</option>
                            <option value="whatsapp">Abrir WhatsApp de Consulta</option>
                            <option value="auth">Abrir Registro Empresa / Login</option>
                            <option value="url">Abrir Enlace Web / URL Externa</option>
                          </select>
                        </div>

                        {/* 3. Parámetro o Valor de la Acción */}
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                            {btn.actionType === 'category'
                              ? 'Categoría Destino'
                              : btn.actionType === 'whatsapp'
                              ? 'Mensaje WhatsApp predeterminado'
                              : btn.actionType === 'url'
                              ? 'URL de destino'
                              : 'Filtro / Etiqueta (opcional)'}
                          </label>
                          {btn.actionType === 'category' ? (
                            <select
                              value={btn.actionValue || 'Hombre'}
                              onChange={(e) => handleUpdateButton(btn.id, { actionValue: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                            >
                              <option value="Hombre">Hombre</option>
                              <option value="Mujer">Mujer</option>
                              <option value="Venta Corporativa">Venta Corporativa</option>
                              <option value="Calzado">Calzado</option>
                              <option value="Infantil">Infantil</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={btn.actionValue || ''}
                              onChange={(e) => handleUpdateButton(btn.id, { actionValue: e.target.value })}
                              placeholder={
                                btn.actionType === 'whatsapp'
                                  ? 'Ej: Hola, quiero consultar por la promo...'
                                  : btn.actionType === 'url'
                                  ? 'https://... o #seccion'
                                  : 'Ej: Campo, Calzado, Invierno...'
                              }
                              className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
                            />
                          )}
                        </div>

                        {/* 4. Estilo Visual */}
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F]">
                            Estilo Visual
                          </label>
                          <select
                            value={btn.style || 'primary'}
                            onChange={(e) => handleUpdateButton(btn.id, { style: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]"
                          >
                            <option value="primary">Principal (Amarillo Pampero)</option>
                            <option value="outline">Secundario (Borde Blanco)</option>
                            <option value="secondary">Blanco Opaco con Sombra</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                disabled={isSaving || isUploadingImage}
                className={`px-6 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs cursor-pointer ${
                  isSaving || isUploadingImage ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>Guardando en Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{editingPromo ? 'Guardar Cambios de Promoción' : 'Crear Promoción'}</span>
                  </>
                )}
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

                {/* Botones configurados en la tarjeta */}
                <div className="pt-2 border-t border-[#DCD4C9]/50">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-bold text-[#4A453F] flex items-center gap-1">
                      <MousePointer className="w-3 h-3 text-[#B9522F]" />
                      Botones del Banner ({promo.buttons?.length || (promo.primaryBtnText ? 1 : 0)}):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {promo.buttons && promo.buttons.length > 0 ? (
                      promo.buttons.map((btn) => (
                        <span
                          key={btn.id}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider ${
                            btn.style === 'primary'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                          }`}
                        >
                          {btn.label} ({btn.actionType})
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                        {promo.primaryBtnText || 'VER CATÁLOGO'} (default)
                      </span>
                    )}
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
