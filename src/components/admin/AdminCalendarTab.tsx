import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarHolidayItem,
  CalendarHolidayScope,
  CalendarModuleConfig,
  Promotion,
} from '../../types';
import {
  DEFAULT_ARGENTINA_MENDOZA_DATES,
  DEFAULT_CALENDAR_MODULE_CONFIG,
  getScopeBadgeMeta,
} from '../../data/calendarDatesData';
import {
  saveCalendarHolidaysAndConfig,
  saveFirestorePromotion,
  subscribeToCalendarConfig,
} from '../../services/firebase';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import {
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

interface AdminCalendarTabProps {
  promotions: Promotion[];
  onUpdatePromotions: (newPromos: Promotion[]) => void;
  setPromotions?: React.Dispatch<React.SetStateAction<Promotion[]>>;
  triggerSaveNotice: () => void;
}

export const AdminCalendarTab: React.FC<AdminCalendarTabProps> = ({
  promotions,
  onUpdatePromotions,
  setPromotions,
  triggerSaveNotice,
}) => {
  const [holidays, setHolidays] = useState<CalendarHolidayItem[]>(DEFAULT_ARGENTINA_MENDOZA_DATES);
  const [config, setConfig] = useState<CalendarModuleConfig>(DEFAULT_CALENDAR_MODULE_CONFIG);
  const [scopeFilter, setScopeFilter] = useState<'all' | CalendarHolidayScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Modal crear / editar fecha o feriado
  const [editingItem, setEditingItem] = useState<CalendarHolidayItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formRecurring, setFormRecurring] = useState(true);
  const [formScope, setFormScope] = useState<CalendarHolidayScope>('mendoza');
  const [formCategory, setFormCategory] =
    useState<CalendarHolidayItem['category']>('fecha_importante');
  const [formDescription, setFormDescription] = useState('');
  const [formMarketingIdea, setFormMarketingIdea] = useState('');
  const [formLinkedPromoId, setFormLinkedPromoId] = useState('');

  useEffect(() => {
    const unsub = subscribeToCalendarConfig((data) => {
      if (Array.isArray(data.holidays) && data.holidays.length > 0) {
        setHolidays(data.holidays);
      }
      if (data.config) {
        setConfig({ ...DEFAULT_CALENDAR_MODULE_CONFIG, ...data.config });
      }
    });
    return () => unsub();
  }, []);

  const persistCalendarState = async (
    nextHolidays: CalendarHolidayItem[],
    nextConfig: CalendarModuleConfig,
    noticeText?: string
  ) => {
    setIsSaving(true);
    setHolidays(nextHolidays);
    setConfig(nextConfig);
    try {
      await saveCalendarHolidaysAndConfig(nextHolidays, nextConfig);
      triggerSaveNotice();
      if (noticeText) {
        setStatusMsg(noticeText);
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleConfigKey = (key: keyof CalendarModuleConfig, val: boolean | string) => {
    const nextConfig: CalendarModuleConfig = {
      ...config,
      [key]: val,
    };
    persistCalendarState(holidays, nextConfig, 'Configuración del Calendario guardada.');
  };

  const handleToggleHolidayActive = (id: string) => {
    const nextHolidays = holidays.map((h) => (h.id === id ? { ...h, active: !h.active } : h));
    persistCalendarState(nextHolidays, config);
  };

  const handleMergeOfficialDefaults = () => {
    const existingIds = new Set(holidays.map((h) => h.id));
    const missing = DEFAULT_ARGENTINA_MENDOZA_DATES.filter((d) => !existingIds.has(d.id));
    if (missing.length === 0) {
      setStatusMsg('Todas las fechas oficiales de Argentina, Mendoza, Ciudad, Maipú y Luján ya están cargadas.');
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }
    const merged = [...holidays, ...missing];
    persistCalendarState(
      merged,
      config,
      `Se incorporaron ${missing.length} fechas oficiales/comerciales faltantes.`
    );
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setIsCreating(true);
    setFormTitle('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormRecurring(true);
    setFormScope('mendoza');
    setFormCategory('fecha_importante');
    setFormDescription('');
    setFormMarketingIdea('');
    setFormLinkedPromoId('');
  };

  const openEditModal = (item: CalendarHolidayItem) => {
    setEditingItem(item);
    setIsCreating(true);
    setFormTitle(fixUtf8Encoding(item.title));
    setFormDate(item.date);
    setFormRecurring(Boolean(item.recurringAnnual));
    setFormScope(item.scope);
    setFormCategory(item.category);
    setFormDescription(fixUtf8Encoding(item.description || ''));
    setFormMarketingIdea(fixUtf8Encoding(item.marketingIdea || ''));
    setFormLinkedPromoId(item.linkedPromotionId || '');
  };

  const handleSaveHolidayForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    const payload: CalendarHolidayItem = sanitizeObjectEncoding({
      id: editingItem ? editingItem.id : `cal-${Date.now()}`,
      title: formTitle.trim(),
      date: formDate,
      recurringAnnual: formRecurring,
      scope: formScope,
      category: formCategory,
      description: formDescription.trim() || undefined,
      marketingIdea: formMarketingIdea.trim() || undefined,
      linkedPromotionId: formLinkedPromoId || undefined,
      active: editingItem ? editingItem.active : true,
    });

    const nextHolidays = editingItem
      ? holidays.map((h) => (h.id === editingItem.id ? payload : h))
      : [payload, ...holidays];

    setIsCreating(false);
    setEditingItem(null);
    persistCalendarState(nextHolidays, config, 'Fecha / feriado actualizado en el Calendario.');
  };

  const handleDeleteHoliday = (id: string) => {
    if (!confirm('¿Eliminar esta fecha del calendario? Podés desactivarla con el ojito si preferís ocultarla sin borrar.')) {
      return;
    }
    const nextHolidays = holidays.filter((h) => h.id !== id);
    persistCalendarState(nextHolidays, config, 'Fecha eliminada del Calendario.');
  };

  // Central de Promociones & Banners vinculada al Calendario
  const handleTogglePromotionLive = async (promo: Promotion) => {
    const updatedPromo: Promotion = sanitizeObjectEncoding({
      ...promo,
      active: !promo.active,
    });
    const nextPromos = promotions.map((p) => (p.id === promo.id ? updatedPromo : p));
    if (setPromotions) setPromotions(nextPromos);
    onUpdatePromotions(nextPromos);
    try {
      localStorage.setItem('pampero_catalog_promotions', JSON.stringify(nextPromos));
    } catch {}
    await saveFirestorePromotion(updatedPromo);
    triggerSaveNotice();
    setStatusMsg(
      updatedPromo.active
        ? `Banner "${updatedPromo.title}" ACTIVADO en el catálogo.`
        : `Banner "${updatedPromo.title}" PAUSADO del catálogo.`
    );
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleUpdatePromoScheduleOrHoliday = async (
    promo: Promotion,
    patch: Partial<Promotion>
  ) => {
    const updatedPromo: Promotion = sanitizeObjectEncoding({
      ...promo,
      ...patch,
    });
    const nextPromos = promotions.map((p) => (p.id === promo.id ? updatedPromo : p));
    if (setPromotions) setPromotions(nextPromos);
    onUpdatePromotions(nextPromos);
    try {
      localStorage.setItem('pampero_catalog_promotions', JSON.stringify(nextPromos));
    } catch {}
    await saveFirestorePromotion(updatedPromo);
    triggerSaveNotice();
  };

  const filteredHolidays = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return holidays
      .filter((h) => {
        if (scopeFilter !== 'all' && h.scope !== scopeFilter) return false;
        if (
          q &&
          !fixUtf8Encoding(h.title).toLowerCase().includes(q) &&
          !fixUtf8Encoding(h.description || '').toLowerCase().includes(q) &&
          !fixUtf8Encoding(h.marketingIdea || '').toLowerCase().includes(q) &&
          !h.date.includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.date.slice(5) || a.date).localeCompare(b.date.slice(5) || b.date));
  }, [holidays, scopeFilter, searchQuery]);

  const activePromosCount = promotions.filter((p) => p.active).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B9522F] block">
            CALENDARIO CENTRAL, FERIADOS Y CAMPAÑAS
          </span>
          <h3 className="font-display font-bold text-xl uppercase tracking-wider text-[#18231C] flex items-center gap-2 mt-0.5">
            <Calendar className="w-5 h-5 text-[#B9522F]" />
            <span>Editor de Calendario, Feriados y Banners del Catálogo</span>
          </h3>
          <p className="text-xs text-[#6F6860] mt-1 max-w-3xl">
            Administrá feriados de Argentina, Mendoza, Ciudad, Maipú y Luján de Cuyo, definí fechas comerciales para publicidad y activá o pausá promociones y banners del catálogo en un solo lugar.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleMergeOfficialDefaults}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-[#18231C] text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#B9522F]" />
            <span>Sincronizar Oficiales</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#FDB813]" />
            <span>Agregar Fecha / Feriado</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs text-xs font-bold text-emerald-950 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 1. Configuración del Calendario de Gestión */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#ECE5DC] pb-3">
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
              1. Visibilidad y Permisos del Calendario de Gestión
            </h4>
            <p className="text-[11px] text-[#6F6860]">
              Elegí qué capas de feriados y fechas comerciales ve el equipo dentro de Gestión → 4. Calendario.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-xs bg-amber-50 text-amber-900 border border-amber-200">
            Sincronización en vivo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {[
            {
              key: 'showArgentinaHolidays' as const,
              label: 'Mostrar Feriados Nacionales (Argentina)',
              desc: 'Inamovibles, trasladables y Carnaval/Semana Santa',
            },
            {
              key: 'showMendozaHolidays' as const,
              label: 'Mostrar Fechas de Mendoza',
              desc: 'Patrono Santiago (25/07), Vendimia, Malbec, Agricultor',
            },
            {
              key: 'showLocalHolidays' as const,
              label: 'Mostrar Ciudad, Maipú y Luján de Cuyo',
              desc: 'Aniversarios, patronales, Carrodilla y Día del Petróleo',
            },
            {
              key: 'showCommercialDates' as const,
              label: 'Mostrar Fechas Comerciales y Publicidad',
              desc: 'Día del Trabajador, Cambios de Temporada, CyberMonday, EPP',
            },
            {
              key: 'allowStaffCreateEvents' as const,
              label: 'Permitir que empleados creen eventos',
              desc: 'Los vendedores pueden agendar vencimientos con permisos',
            },
          ].map((opt) => {
            const active = Boolean(config[opt.key]);
            return (
              <label
                key={opt.key}
                className={`p-3 rounded-xs border cursor-pointer flex items-start gap-2.5 transition-colors ${
                  active ? 'bg-[#FAF8F5] border-[#18231C]' : 'bg-neutral-50 border-[#DCD4C9] opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => handleToggleConfigKey(opt.key, e.target.checked)}
                  className="mt-0.5 accent-[#B9522F] w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[#18231C] block">{opt.label}</span>
                  <span className="text-[10px] text-[#6F6860] block mt-0.5">{opt.desc}</span>
                </div>
              </label>
            );
          })}

          <div className="p-3 rounded-xs border border-[#DCD4C9] bg-[#FAF8F5] flex flex-col justify-center">
            <label className="text-[10px] font-bold uppercase text-[#6F6860] mb-1">
              Visibilidad predeterminada al crear evento
            </label>
            <select
              value={config.defaultVisibilityType || 'all'}
              onChange={(e) =>
                handleToggleConfigKey('defaultVisibilityType', e.target.value as 'all' | 'branch')
              }
              className="w-full px-2.5 py-1.5 border border-[#DCD4C9] rounded-xs bg-white font-bold text-xs text-[#18231C] outline-none"
            >
              <option value="all">Todo el equipo Pampero</option>
              <option value="branch">Solo mi sucursal</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Central de Activación de Promociones y Banners del Catálogo */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECE5DC] pb-3">
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#B9522F]" />
              <span>2. Central de Promociones y Banners del Catálogo ({activePromosCount} activos)</span>
            </h4>
            <p className="text-[11px] text-[#6F6860]">
              Activá o desactivá al instante los banners y campañas publicitarias del catálogo público y vinculalos a una fecha del calendario.
            </p>
          </div>
        </div>

        {promotions.length === 0 ? (
          <div className="p-6 text-center bg-[#FAF8F5] border border-dashed border-[#DCD4C9] rounded-xs text-xs text-[#6F6860]">
            No hay promociones o banners cargados aún. Podés crearlos en la pestaña &ldquo;Promociones &amp; Banners&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {promotions.map((promo) => {
              const linkedDate = holidays.find((h) => h.id === promo.linkedHolidayId);
              return (
                <div
                  key={promo.id}
                  className={`p-3.5 rounded-xs border transition-all flex flex-col justify-between gap-3 ${
                    promo.active
                      ? 'bg-emerald-50/40 border-emerald-400 shadow-2xs'
                      : 'bg-[#FAF8F5] border-[#DCD4C9]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-24 h-16 rounded-xs overflow-hidden border border-[#DCD4C9] bg-neutral-200 shrink-0">
                      {promo.bannerImage ? (
                        <img
                          src={promo.bannerImage}
                          alt={promo.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
                          Sin img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-xs border ${
                            promo.active
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {promo.active ? 'ACTIVO EN CATÁLOGO' : 'PAUSADO'}
                        </span>
                        {promo.badge && (
                          <span className="text-[10px] font-bold text-[#B9522F] truncate">
                            {fixUtf8Encoding(promo.badge)}
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-xs text-[#18231C] mt-1 truncate">
                        {fixUtf8Encoding(promo.title)}
                      </h5>
                      <p className="text-[11px] text-[#6F6860] truncate">
                        Filtro: <strong>{promo.tagFilter || promo.categoryFilter || 'Todos'}</strong>
                        {linkedDate ? ` · Fecha: ${fixUtf8Encoding(linkedDate.title)}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Vinculación a fecha + Vigencia + Botón Activar/Desactivar */}
                  <div className="pt-2.5 border-t border-[#DCD4C9]/80 flex flex-col gap-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={promo.linkedHolidayId || ''}
                        onChange={(e) =>
                          handleUpdatePromoScheduleOrHoliday(promo, {
                            linkedHolidayId: e.target.value || undefined,
                          })
                        }
                        className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none sm:col-span-1"
                        title="Vincular campaña a una fecha del calendario"
                      >
                        <option value="">Sin fecha vinculada</option>
                        {holidays.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.date.slice(5)} · {fixUtf8Encoding(h.title).slice(0, 28)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={promo.scheduledStartDate || ''}
                        onChange={(e) =>
                          handleUpdatePromoScheduleOrHoliday(promo, {
                            scheduledStartDate: e.target.value || undefined,
                          })
                        }
                        title="Fecha inicio campaña (opcional)"
                        className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                      />
                      <input
                        type="date"
                        value={promo.scheduledEndDate || ''}
                        onChange={(e) =>
                          handleUpdatePromoScheduleOrHoliday(promo, {
                            scheduledEndDate: e.target.value || undefined,
                          })
                        }
                        title="Fecha fin campaña (opcional)"
                        className="px-2 py-1 border border-[#DCD4C9] rounded-xs bg-white text-[11px] outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePromotionLive(promo)}
                      className={`w-full py-1.5 rounded-xs text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        promo.active
                          ? 'bg-white hover:bg-red-50 text-red-700 border border-red-300'
                          : 'bg-[#18231C] hover:bg-black text-[#FDB813]'
                      }`}
                    >
                      {promo.active ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Pausar Banner del Catálogo</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Activar Banner en Catálogo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Listado de Feriados y Fechas Clave */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#ECE5DC] pb-3">
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-[#18231C]">
              3. Feriados y Fechas Clave ({filteredHolidays.length})
            </h4>
            <p className="text-[11px] text-[#6F6860]">
              Argentina, Provincia de Mendoza, Ciudad, Maipú, Luján de Cuyo y Campañas Comerciales Pampero.
            </p>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar feriado, fecha o idea..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
            />
          </div>
        </div>

        {/* Scope Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all' as const, label: 'Todas', count: holidays.length },
            { key: 'argentina' as const, label: 'Argentina', count: holidays.filter((h) => h.scope === 'argentina').length },
            { key: 'mendoza' as const, label: 'Mendoza', count: holidays.filter((h) => h.scope === 'mendoza').length },
            { key: 'ciudad' as const, label: 'Ciudad de Mendoza', count: holidays.filter((h) => h.scope === 'ciudad').length },
            { key: 'maipu' as const, label: 'Maipú', count: holidays.filter((h) => h.scope === 'maipu').length },
            { key: 'lujan' as const, label: 'Luján de Cuyo', count: holidays.filter((h) => h.scope === 'lujan').length },
            { key: 'comercial' as const, label: 'Comerciales / Publi', count: holidays.filter((h) => h.scope === 'comercial').length },
          ].map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setScopeFilter(pill.key)}
              className={`px-2.5 py-1 rounded-xs text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                scopeFilter === pill.key
                  ? 'bg-[#18231C] text-white border-[#18231C]'
                  : 'bg-[#FAF8F5] text-[#6F6860] border-[#DCD4C9] hover:text-[#18231C]'
              }`}
            >
              <span>{pill.label}</span>
              <span className="px-1 rounded-xs bg-black/10 text-[10px]">{pill.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filteredHolidays.map((item) => {
            const meta = getScopeBadgeMeta(item.scope);
            const linkedPromo = promotions.find(
              (p) => p.id === item.linkedPromotionId || p.linkedHolidayId === item.id
            );
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xs border flex flex-col justify-between gap-2 ${
                  item.active ? 'bg-white border-[#DCD4C9]' : 'bg-neutral-50 border-neutral-200 opacity-60'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-xs border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                      <span className="font-mono font-black text-xs text-[#18231C]">
                        {item.recurringAnnual ? `${item.date.slice(8, 10)}/${item.date.slice(5, 7)} (Anual)` : item.date}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleHolidayActive(item.id)}
                        className="p-1 hover:bg-neutral-100 rounded-xs text-[#18231C] cursor-pointer"
                        title={item.active ? 'Ocultar del calendario' : 'Mostrar en el calendario'}
                      >
                        {item.active ? <Eye className="w-3.5 h-3.5 text-emerald-700" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1 hover:bg-amber-50 rounded-xs text-[#18231C] cursor-pointer"
                        title="Editar fecha o idea publicitaria"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#B9522F]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(item.id)}
                        className="p-1 hover:bg-red-50 rounded-xs text-neutral-400 hover:text-red-600 cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h5 className="font-bold text-xs text-[#18231C] leading-snug">
                    {fixUtf8Encoding(item.title)}
                  </h5>
                  {item.description && (
                    <p className="text-[11px] text-[#6F6860] leading-snug">
                      {fixUtf8Encoding(item.description)}
                    </p>
                  )}
                  {item.marketingIdea && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-xs text-[10px] text-amber-950">
                      <strong className="uppercase text-[#B9522F]">Publicidad / Acción:</strong>{' '}
                      {fixUtf8Encoding(item.marketingIdea)}
                    </div>
                  )}
                  {linkedPromo && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xs">
                      <Tag className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        Banner vinculado: {fixUtf8Encoding(linkedPromo.title)} ({linkedPromo.active ? 'ACTIVO' : 'Pausado'})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Crear / Editar Fecha / Feriado */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
              <h4 className="font-bold text-sm uppercase tracking-wider">
                {editingItem ? 'Editar Fecha / Feriado' : 'Agregar Nueva Fecha / Campaña'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingItem(null);
                }}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHolidayForm} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Nombre de la Fecha / Feriado *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Promo Aniversario Pampero Maipú"
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none focus:border-[#B9522F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Jurisdicción / Ámbito
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as CalendarHolidayScope)}
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none font-bold"
                  >
                    <option value="argentina">Argentina (Nacional)</option>
                    <option value="mendoza">Mendoza (Provincial)</option>
                    <option value="ciudad">Ciudad de Mendoza</option>
                    <option value="maipu">Maipú</option>
                    <option value="lujan">Luján de Cuyo</option>
                    <option value="comercial">Comercial / Campaña</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as CalendarHolidayItem['category'])
                    }
                    className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                  >
                    <option value="feriado_nacional">Feriado Nacional</option>
                    <option value="feriado_provincial">Feriado Provincial</option>
                    <option value="aniversario_local">Aniversario Local</option>
                    <option value="campana_comercial">Campaña Comercial</option>
                    <option value="fecha_importante">Fecha Importante</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 pt-5 font-bold text-[#18231C] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRecurring}
                    onChange={(e) => setFormRecurring(e.target.checked)}
                    className="accent-[#B9522F] w-4 h-4 cursor-pointer"
                  />
                  <span>Se repite todos los años</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#B9522F] uppercase text-[10px] mb-1">
                  Idea / Sugerencia Publicitaria
                </label>
                <textarea
                  rows={2}
                  value={formMarketingIdea}
                  onChange={(e) => setFormMarketingIdea(e.target.value)}
                  placeholder="Ej: Lanzar banner de ropa térmica con 15% off y envíos en Maipú..."
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#18231C] uppercase text-[10px] mb-1">
                  Vincular Banner / Promoción del Catálogo (opcional)
                </label>
                <select
                  value={formLinkedPromoId}
                  onChange={(e) => setFormLinkedPromoId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs bg-white outline-none"
                >
                  <option value="">-- Ninguno --</option>
                  {promotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {fixUtf8Encoding(p.title)} ({p.active ? 'ACTIVO' : 'Pausado'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 text-neutral-600 hover:text-black font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase rounded-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar en Calendario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
