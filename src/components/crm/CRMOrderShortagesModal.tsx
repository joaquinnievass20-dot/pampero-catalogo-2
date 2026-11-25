import React, { useState, useMemo } from 'react';
import {
  CategoryHierarchyItem,
  CRMOrder,
  CRMOrderShortageItem,
  Product,
  ShortageStatus,
  ThemeConfig,
} from '../../types';
import { fixUtf8Encoding, sanitizeObjectEncoding } from '../../utils/encodingUtils';
import { getSavedColorCodes, resolveColorDef } from '../../utils/colorUtils';
import { X, Plus, Trash2, PackageX, CheckCircle2, Truck } from 'lucide-react';

interface CRMOrderShortagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CRMOrder;
  products?: Product[];
  categories?: CategoryHierarchyItem[];
  theme?: ThemeConfig;
  knownSuppliers?: string[];
  activeStaffUser: string;
  onUpdateShortages: (
    order: CRMOrder,
    nextShortages: CRMOrderShortageItem[],
    removedIds?: string[]
  ) => Promise<void> | void;
}

const DEFAULT_SUPPLIERS = ['Macata', 'Pampero Central', 'Calzado Confort', 'Otro'];

const STATUS_LABEL: Record<ShortageStatus, string> = {
  pendiente: 'Pendiente de pedir',
  pedido: 'Pedido a proveedor',
  recibido: 'Recibido',
};

export const CRMOrderShortagesModal: React.FC<CRMOrderShortagesModalProps> = ({
  isOpen,
  onClose,
  order,
  products = [],
  categories = [],
  theme,
  knownSuppliers = [],
  activeStaffUser,
  onUpdateShortages,
}) => {
  const st = theme?.siteTexts;
  const shortages: CRMOrderShortageItem[] = Array.isArray(order.shortages) ? order.shortages : [];

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [supplier, setSupplier] = useState('Macata');
  const [isSaving, setIsSaving] = useState(false);

  const catalogCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    (categories || []).forEach((c) => {
      if (c?.name) set.add(fixUtf8Encoding(String(c.name)));
    });
    products.forEach((p) => {
      if (p?.category && String(p.category).trim()) {
        set.add(fixUtf8Encoding(String(p.category).trim()));
      }
    });
    return Array.from(set);
  }, [categories, products]);

  const filteredCatalogProducts = useMemo(() => {
    if (selectedCategory === 'Todas') return products;
    return products.filter(
      (p) => fixUtf8Encoding(String(p.category || '')).toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  const supplierOptions = useMemo(() => {
    const merged = new Set<string>([...DEFAULT_SUPPLIERS, ...knownSuppliers.filter(Boolean)]);
    shortages.forEach((s) => {
      if (s.supplier) merged.add(s.supplier);
    });
    return Array.from(merged);
  }, [knownSuppliers, shortages]);

  const matchedProduct = useMemo(() => {
    const codeClean = productCode.trim().toLowerCase();
    const nameClean = productName.trim().toLowerCase();
    if (codeClean) {
      const byCode = products.find(
        (p) =>
          (p.code || '').toLowerCase() === codeClean ||
          (p.id || '').toLowerCase() === codeClean
      );
      if (byCode) return byCode;
    }
    if (nameClean) {
      return products.find((p) => (p.name || '').toLowerCase() === nameClean);
    }
    return undefined;
  }, [productCode, productName, products]);

  // Synced catalog colors (product's availableColors prioritized + all saved catalog color codes)
  const syncedColorOptions = useMemo(() => {
    const catalogDefs = getSavedColorCodes();
    const list: Array<{ value: string; label: string; hex: string; isProductColor: boolean }> = [];
    const seen = new Set<string>();

    const addOption = (rawVal: string, isProductColor: boolean) => {
      const resolved = resolveColorDef(rawVal);
      const displayVal = resolved.code && resolved.name
        ? `${resolved.code} · ${resolved.name}`
        : resolved.name || rawVal;
      const dedupeKey = (resolved.code || resolved.name || rawVal).toLowerCase().trim();
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      list.push({
        value: displayVal,
        label: displayVal,
        hex: resolved.hex,
        isProductColor,
      });
    };

    if (matchedProduct && Array.isArray(matchedProduct.availableColors)) {
      matchedProduct.availableColors.forEach((c) => addOption(c, true));
    }

    catalogDefs.forEach((def) => {
      const val = def.code ? `${def.code} · ${def.name}` : def.name;
      const dedupeKey = (def.code || def.name).toLowerCase().trim();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      list.push({
        value: val,
        label: val,
        hex: def.hex,
        isProductColor: false,
      });
    });

    return list;
  }, [matchedProduct]);

  if (!isOpen) return null;

  const applyProductMatch = (match: Product) => {
    if (match.code) setProductCode(match.code);
    if (match.name) setProductName(match.name);
    if (!size && Array.isArray(match.availableSizes) && match.availableSizes.length > 0) {
      setSize(match.availableSizes[0]);
    }
    if (!color && Array.isArray(match.availableColors) && match.availableColors.length > 0) {
      const resolved = resolveColorDef(match.availableColors[0]);
      setColor(resolved.code && resolved.name ? `${resolved.code} · ${resolved.name}` : match.availableColors[0]);
    }
  };

  const handleCodeChange = (val: string) => {
    setProductCode(val);
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    const match = products.find(
      (p) =>
        (p.code || '').toLowerCase() === clean ||
        (p.id || '').toLowerCase() === clean
    );
    if (match) applyProductMatch(match);
  };

  const handleNameChange = (val: string) => {
    setProductName(val);
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    const match = filteredCatalogProducts.find(
      (p) => (p.name || '').toLowerCase() === clean
    ) || products.find((p) => (p.name || '').toLowerCase() === clean);
    if (match) applyProductMatch(match);
  };

  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode.trim() && !productName.trim()) return;

    setIsSaving(true);
    try {
      const newItem: CRMOrderShortageItem = sanitizeObjectEncoding({
        id: `sht-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber || order.trackingCode,
        trackingCode: order.trackingCode || order.orderNumber,
        clientName: order.clientName,
        branch: order.branch || 'Maipú',
        productCode: productCode.trim().toUpperCase() || '-',
        productName: productName.trim() || matchedProduct?.name || 'Artículo sin nombre',
        size: size.trim() || 'U',
        color: color.trim() || 'Estándar',
        quantity: Math.max(1, Number(quantity) || 1),
        supplier: supplier.trim() || 'Macata',
        status: 'pendiente',
        createdAt: new Date().toISOString(),
        createdBy: activeStaffUser,
      });

      const nextList = [newItem, ...shortages];
      await onUpdateShortages(order, nextList);

      setProductCode('');
      setProductName('');
      setSize('');
      setColor('');
      setQuantity('1');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeStatus = async (itemId: string, nextStatus: ShortageStatus) => {
    const nextList = shortages.map((s) =>
      s.id === itemId ? { ...s, status: nextStatus } : s
    );
    await onUpdateShortages(order, nextList);
  };

  const handleDeleteRow = async (itemId: string) => {
    const nextList = shortages.filter((s) => s.id !== itemId);
    await onUpdateShortages(order, nextList, [itemId]);
  };

  const pendingCount = shortages.filter((s) => s.status === 'pendiente').length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-5 py-4 flex items-center justify-between text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-xs bg-[#FDB813] text-[#18231C]">
                {order.trackingCode || order.orderNumber || `#${order.id.slice(-6)}`}
              </span>
              <span className="text-[10px] uppercase font-bold text-[#DCD4C9]">
                {fixUtf8Encoding(order.branch || 'Maipú')}
              </span>
              {pendingCount > 0 && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs bg-white/10 text-[#FDB813] border border-white/20 tabular-nums">
                  {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de pedir
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm uppercase tracking-wider truncate mt-1 flex items-center gap-2">
              <PackageX className="w-4 h-4 text-[#FDB813] shrink-0" />
              <span>
                {st?.crmShortagesTitle || 'Faltantes para Completar Pedido'} · {fixUtf8Encoding(order.clientName)}
              </span>
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white cursor-pointer p-1"
            aria-label="Cerrar faltantes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Info banner */}
          <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex items-center justify-between gap-2 flex-wrap text-[11px] text-[#4A453F]">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#18231C] shrink-0" />
              <span>
                Todos los faltantes que cargues acá se envían automáticamente al menú <strong>Pedidos Proveedor</strong> agrupados por proveedor. Podés elegir del catálogo o escribir artículos/colores manualmente.
              </span>
            </div>
          </div>

          {/* Add Shortage Row Form */}
          <form onSubmit={handleAddRow} className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#18231C]">
                Agregar Artículo Faltante
              </span>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase text-[#6F6860] whitespace-nowrap">
                  Categoría Catálogo:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold text-[#18231C] outline-none focus:border-[#18231C] cursor-pointer"
                >
                  <option value="Todas">Todas ({products.length})</option>
                  {catalogCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">Código *</label>
                <input
                  type="text"
                  list="shortage-catalog-codes"
                  value={productCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Ej: 1045"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-mono outline-none focus:border-[#18231C]"
                />
                <datalist id="shortage-catalog-codes">
                  {filteredCatalogProducts.slice(0, 250).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">Artículo *</label>
                <input
                  type="text"
                  list="shortage-catalog-articles"
                  required
                  value={productName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Elegí del catálogo o escribí uno nuevo..."
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                />
                <datalist id="shortage-catalog-articles">
                  {filteredCatalogProducts.slice(0, 250).map((p) => (
                    <option key={`${p.id}-art`} value={p.name}>
                      {p.code} · {p.category}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">Talle *</label>
                <input
                  type="text"
                  list="shortage-sizes-list"
                  required
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="Ej: 44 / L"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                />
                {matchedProduct && Array.isArray(matchedProduct.availableSizes) && (
                  <datalist id="shortage-sizes-list">
                    {matchedProduct.availableSizes.map((sz) => (
                      <option key={sz} value={sz} />
                    ))}
                  </datalist>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">Color *</label>
                <input
                  type="text"
                  list="shortage-colors-list"
                  required
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Elegí o escribí color..."
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white outline-none focus:border-[#18231C]"
                />
                <datalist id="shortage-colors-list">
                  {syncedColorOptions.map((cOpt) => (
                    <option key={cOpt.value} value={cOpt.value} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-mono tabular-nums outline-none focus:border-[#18231C]"
                />
              </div>
            </div>

            {/* Quick Catalog Color Swatches (clickable, optional) */}
            {syncedColorOptions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[9px] font-bold uppercase text-[#6F6860] mr-1">
                  {matchedProduct ? 'Colores del artículo / catálogo:' : 'Colores del catálogo:'}
                </span>
                {syncedColorOptions.slice(0, 14).map((cOpt) => {
                  const isActive = color.trim().toLowerCase() === cOpt.value.toLowerCase();
                  return (
                    <button
                      key={cOpt.value}
                      type="button"
                      onClick={() => setColor(cOpt.value)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs border text-[10px] font-semibold cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#18231C] text-white border-[#18231C]'
                          : cOpt.isProductColor
                          ? 'bg-amber-50 text-[#18231C] border-amber-300 hover:bg-amber-100'
                          : 'bg-white text-[#4A453F] border-[#DCD4C9] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: cOpt.hex }}
                      />
                      <span>{cOpt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 pt-1">
              <div className="flex-1 max-w-xs">
                <label className="block text-[9px] font-bold uppercase text-[#6F6860] mb-1">
                  Proveedor que se necesita *
                </label>
                <input
                  type="text"
                  list="shortage-suppliers-list"
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ej: Macata, Pampero Central..."
                  className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-semibold outline-none focus:border-[#18231C]"
                />
                <datalist id="shortage-suppliers-list">
                  {supplierOptions.map((sup) => (
                    <option key={sup} value={sup} />
                  ))}
                </datalist>
              </div>

              <button
                type="submit"
                disabled={isSaving || (!productCode.trim() && !productName.trim())}
                className="px-4 py-2 bg-[#18231C] hover:bg-black disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Agregando...' : 'Agregar a Tabla de Faltantes'}</span>
              </button>
            </div>
          </form>

          {/* Table of Shortages */}
          <div className="border border-[#DCD4C9] rounded-xs overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#18231C] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Artículo</th>
                    <th className="py-2.5 px-3">Talle</th>
                    <th className="py-2.5 px-3">Color</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE5DC]">
                  {shortages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#6F6860]">
                        No hay faltantes registrados para este pedido. Usá el formulario de arriba para cargar los artículos necesarios.
                      </td>
                    </tr>
                  ) : (
                    shortages.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF8F5]/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#18231C] whitespace-nowrap">
                          {item.productCode || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#18231C]">
                          {fixUtf8Encoding(item.productName)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#18231C] whitespace-nowrap">
                          {fixUtf8Encoding(item.size)}
                        </td>
                        <td className="py-2.5 px-3 text-[#4A453F] whitespace-nowrap">
                          {fixUtf8Encoding(item.color)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums text-[#18231C]">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#18231C] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-xs bg-[#FAF8F5] border border-[#DCD4C9]">
                            {fixUtf8Encoding(item.supplier)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <select
                            value={item.status}
                            onChange={(e) => handleChangeStatus(item.id, e.target.value as ShortageStatus)}
                            className={`px-2 py-1 rounded-xs border text-[10px] font-bold uppercase cursor-pointer outline-none ${
                              item.status === 'recibido'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : item.status === 'pedido'
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : 'bg-[#FAF8F5] border-[#DCD4C9] text-[#18231C]'
                            }`}
                          >
                            <option value="pendiente">{STATUS_LABEL.pendiente}</option>
                            <option value="pedido">{STATUS_LABEL.pedido}</option>
                            <option value="recibido">{STATUS_LABEL.recibido}</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xs cursor-pointer transition-colors"
                            title="Quitar faltante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#6F6860] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Guardado automático en tiempo real ({shortages.length} ítems)</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DCD4C9] bg-white hover:bg-[#ECE5DC] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
