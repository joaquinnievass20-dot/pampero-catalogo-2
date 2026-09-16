import React, { useState } from 'react';
import { Product, QuantityDiscountRule, CategoryHierarchyItem, MainCategory } from '../../types';
import { 
  DollarSign, 
  FileSpreadsheet, 
  Upload, 
  Check, 
  Download, 
  Search, 
  Edit3, 
  AlertCircle,
  TrendingUp,
  Building2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ClipboardCopy,
  Plus,
  Trash2,
  Tag,
  Percent,
  Layers,
  Power
} from 'lucide-react';

interface AdminPricesTabProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  triggerSaveNotice: () => void;
  volumeDiscounts?: QuantityDiscountRule[];
  onUpdateVolumeDiscounts?: (rules: QuantityDiscountRule[]) => void;
  categories?: CategoryHierarchyItem[];
  initialSubTab?: 'instructions' | 'paste_sheet' | 'manual_table' | 'volume_discounts';
}

// Clean Argentine peso currency strings: "$ 18.791,50" or "18.791" or "18791" -> 18791
export const parseArgentinePrice = (val: any): number => {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  
  let str = String(val).trim().replace('$', '').trim();
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.') && !str.includes(',')) {
    const parts = str.split('.');
    if (parts[parts.length - 1].length === 3) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed);
};

export const SAMPLE_PRICE_DATA = `BOM-01	64900	54000
BOM-02	72500	59900
CAM-01	145000	123000
CAL-01	115000	98000
PAN-01	69000	58000
REM-01	38500	31000`;

export const AdminPricesTab: React.FC<AdminPricesTabProps> = ({
  products,
  onUpdateProducts,
  triggerSaveNotice,
  volumeDiscounts = [],
  onUpdateVolumeDiscounts = (_rules: QuantityDiscountRule[]) => {},
  categories = [],
  initialSubTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'instructions' | 'paste_sheet' | 'manual_table' | 'volume_discounts'>(initialSubTab || 'instructions');
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteData, setPasteData] = useState('');
  const [matchedPreview, setMatchedPreview] = useState<Array<{ product: Product; oldPrice: number; newPrice: number; oldCorp: number; newCorp: number }>>([]);
  
  // Volume Discount Rule Form State
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<Omit<QuantityDiscountRule, 'id'>>({
    name: 'Descuento Mayorista 10+',
    minQuantity: 10,
    discountPercentage: 15,
    applicableCategory: 'ALL',
    applicableSubCategory: 'ALL',
    isActive: true,
  });

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name?.trim() || ruleForm.minQuantity <= 0 || ruleForm.discountPercentage <= 0) return;

    let updated: QuantityDiscountRule[];
    if (editingRuleId) {
      updated = volumeDiscounts.map((r) =>
        r.id === editingRuleId ? { ...r, ...ruleForm } : r
      );
    } else {
      const newRule: QuantityDiscountRule = {
        id: 'rule-' + Date.now(),
        ...ruleForm,
      };
      updated = [...volumeDiscounts, newRule];
    }

    onUpdateVolumeDiscounts(updated);
    setIsCreatingRule(false);
    setEditingRuleId(null);
    triggerSaveNotice();
  };

  const handleDeleteRule = (id: string) => {
    if (window.confirm('¿Deseás eliminar esta regla de descuento por volumen?')) {
      const updated = volumeDiscounts.filter((r) => r.id !== id);
      onUpdateVolumeDiscounts(updated);
      triggerSaveNotice();
    }
  };

  const handleToggleRuleActive = (id: string) => {
    const updated = volumeDiscounts.map((r) =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    );
    onUpdateVolumeDiscounts(updated);
    triggerSaveNotice();
  };

  // Local edit state for the manual table
  const [editablePrices, setEditablePrices] = useState<Record<string, { price: number; corporatePrice: number; discount: number }>>(() => {
    const init: Record<string, { price: number; corporatePrice: number; discount: number }> = {};
    products.forEach((p) => {
      init[p.id] = {
        price: p.price,
        corporatePrice: p.corporatePrice || Math.round(p.price * 0.85),
        discount: p.discountPercentage || 0,
      };
    });
    return init;
  });

  const handleManualPriceChange = (productId: string, field: 'price' | 'corporatePrice' | 'discount', value: number) => {
    setEditablePrices((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const handleSaveManualPrices = () => {
    let count = 0;
    const updated = products.map((p) => {
      const edit = editablePrices[p.id];
      if (edit) {
        count++;
        return {
          ...p,
          price: edit.price,
          corporatePrice: edit.corporatePrice,
          discountPercentage: edit.discount,
        };
      }
      return p;
    });

    onUpdateProducts(updated);
    alert(`¡Éxito! Se actualizaron los precios de ${count} artículos del catálogo.`);
    triggerSaveNotice();
  };

  // Process text pasted from spreadsheet (Columns: ARTICULO, LISTA, EMP, etc.)
  const handlePreviewPastedSheet = (customData?: string) => {
    const textToProcess = customData !== undefined ? customData : pasteData;
    const lines = textToProcess.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Pegá los datos de tu planilla primero en el recuadro.');
      return;
    }

    const matches: Array<{ product: Product; oldPrice: number; newPrice: number; oldCorp: number; newCorp: number }> = [];

    lines.forEach((line) => {
      const parts = line.split(/[\t,;]+/).map((p) => p.trim());
      if (parts.length >= 2) {
        const itemText = parts[0].toLowerCase();
        if (itemText.includes('articulo') || itemText.includes('codigo') || itemText.includes('costo') || itemText === 'k') return;

        const rawLista = parts[1];
        const rawCorp = parts[2] || parts[3] || parts[4] || '';

        const newPrice = parseArgentinePrice(rawLista);
        const newCorp = rawCorp ? parseArgentinePrice(rawCorp) : Math.round(newPrice * 0.85);

        // Match product in catalog
        const found = products.find((p) => {
          const pName = p.name.toLowerCase();
          const pCode = p.code.toLowerCase();
          return pName.includes(itemText) || itemText.includes(pName) || pCode.includes(itemText) || itemText.includes(pCode);
        });

        if (found && newPrice > 0) {
          matches.push({
            product: found,
            oldPrice: found.price,
            newPrice,
            oldCorp: found.corporatePrice || 0,
            newCorp,
          });
        }
      }
    });

    setMatchedPreview(matches);
    if (matches.length === 0) {
      alert('No se encontraron coincidencias. Verificá que la primera columna tenga el Código (ej: BOM-01) o el Nombre del producto.');
    }
  };

  const handleApplyMatchedPrices = () => {
    if (matchedPreview.length === 0) return;

    const matchMap = new Map<string, { product: Product; oldPrice: number; newPrice: number; oldCorp: number; newCorp: number }>(
      matchedPreview.map((m) => [m.product.id, m])
    );
    const updated = products.map((p) => {
      const match = matchMap.get(p.id);
      if (match) {
        return {
          ...p,
          price: match.newPrice,
          corporatePrice: match.newCorp,
        };
      }
      return p;
    });

    onUpdateProducts(updated);
    alert(`¡Éxito! Se actualizaron los precios de ${matchedPreview.length} artículos del catálogo.`);
    triggerSaveNotice();
    setMatchedPreview([]);
    setPasteData('');
  };

  // Load sample demo data and run preview
  const handleLoadDemoData = () => {
    setPasteData(SAMPLE_PRICE_DATA);
    setActiveSubTab('paste_sheet');
    handlePreviewPastedSheet(SAMPLE_PRICE_DATA);
  };

  // Export current catalog prices to CSV
  const handleExportCSV = () => {
    const header = 'CODIGO,ARTICULO,CATEGORIA,PRECIO_LISTA_MINORISTA,PRECIO_EMPRESA_MAYORISTA,DESCUENTO_PORCENTAJE\n';
    const rows = products.map((p) => {
      return `"${p.code}","${p.name.replace(/"/g, '""')}","${p.category}",${p.price},${p.corporatePrice || 0},${p.discountPercentage || 0}`;
    }).join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + header + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lista_precios_pampero_mendoza_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div>
          <h3 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#B9522F]" />
            Actualización de Precios Pampero Gran Mendoza
          </h3>
          <p className="text-xs text-[#6F6860]">
            Sincronizá los precios del catálogo con tus planillas de Excel o modificalos manualmente uno por uno.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#B9522F]" />
            Descargar Plantilla Excel (.CSV)
          </button>
          <button
            type="button"
            onClick={handleLoadDemoData}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Cargar Ejemplo de Prueba
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-[#DCD4C9] bg-[#FAF8F5] gap-2 px-2 pt-2 text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveSubTab('instructions')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'instructions'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-[#B9522F]" />
          Instructivo Paso a Paso (Leé esto primero)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('paste_sheet')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'paste_sheet'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Pegar desde Excel / Sheets
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('manual_table')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'manual_table'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Edit3 className="w-4 h-4 text-blue-600" />
          Edición en Tabla Directa ({products.length} productos)
        </button>

        <button
          type="button"
          id="tab-volume-discounts"
          onClick={() => setActiveSubTab('volume_discounts')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'volume_discounts'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Percent className="w-4 h-4 text-amber-600" />
          Descuentos por Volumen / Escala ({volumeDiscounts.length})
        </button>
      </div>

      {/* 1. INSTRUCTIVO ILUSTRADO PASO A PASO */}
      {activeSubTab === 'instructions' && (
        <div className="bg-white p-6 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#B9522F]" />
              ¿Cómo cambiar la lista de precios? (Guía Sencilla)
            </h4>
            <p className="text-xs text-[#6F6860] mt-1">
              Tenés 2 formas muy fáciles: pegando desde tu Excel o editando celda por celda directamente en pantalla.
            </p>
          </div>

          {/* 3 Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Paso 1 */}
            <div className="p-4 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs space-y-3 relative">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-[#18231C] text-[#F5F2EC] text-xs font-bold grid place-items-center">
                  1
                </span>
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Tu Planilla (Excel o Sheets)
                </h5>
              </div>
              <p className="text-xs text-[#4A453F] leading-relaxed">
                Armá o abrí tu Excel con <strong>2 o 3 columnas</strong> en este orden exacto:
              </p>
              {/* Mini Table Example */}
              <div className="bg-white border border-[#DCD4C9] rounded-xs overflow-hidden text-[11px] font-mono">
                <div className="bg-[#18231C] text-[#F5F2EC] px-2 py-1 flex justify-between font-sans text-[10px] font-bold">
                  <span>Columna A</span>
                  <span>Columna B</span>
                  <span>Columna C</span>
                </div>
                <div className="p-2 space-y-1 divide-y divide-[#DCD4C9]/40">
                  <div className="flex justify-between text-neutral-600 pt-0.5">
                    <span className="text-[#B9522F] font-bold">BOM-01</span>
                    <span>$ 64.900</span>
                    <span className="text-neutral-400">$ 54.000</span>
                  </div>
                  <div className="flex justify-between text-neutral-600 pt-0.5">
                    <span className="text-[#B9522F] font-bold">CAM-01</span>
                    <span>$ 145.000</span>
                    <span className="text-neutral-400">$ 123.000</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#6F6860]">
                * Columna A: Código del producto (ej: BOM-01).<br />
                * Columna B: Precio al Consumidor.<br />
                * Columna C (opcional): Precio Empresa.
              </p>
            </div>

            {/* Paso 2 */}
            <div className="p-4 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-[#18231C] text-[#F5F2EC] text-xs font-bold grid place-items-center">
                  2
                </span>
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Copiar y Pegar
                </h5>
              </div>
              <p className="text-xs text-[#4A453F] leading-relaxed">
                1. En tu Excel, seleccioná las celdas con el mouse.<br />
                2. Presioná <kbd className="px-1.5 py-0.5 bg-white border border-[#DCD4C9] rounded font-mono text-[10px]">Ctrl + C</kbd>.<br />
                3. Hacé clic en la pestaña <strong>"Pegar desde Excel / Sheets"</strong> de arriba.<br />
                4. Hacé clic en el recuadro blanco y presioná <kbd className="px-1.5 py-0.5 bg-white border border-[#DCD4C9] rounded font-mono text-[10px]">Ctrl + V</kbd>.
              </p>
              <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-xs text-[11px] text-emerald-800">
                ✓ Reconoce precios con puntos, comas o signo $ automáticamente.
              </div>
            </div>

            {/* Paso 3 */}
            <div className="p-4 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-[#18231C] text-[#F5F2EC] text-xs font-bold grid place-items-center">
                  3
                </span>
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Previsualizar & Aplicar
                </h5>
              </div>
              <p className="text-xs text-[#4A453F] leading-relaxed">
                1. Presioná el botón verde <strong>"Analizar y Previsualizar"</strong>.<br />
                2. El sistema te mostrará qué productos coincidieron y la diferencia de precio (Precio Viejo ➔ Precio Nuevo).<br />
                3. Presioná <strong>"Aplicar Precios a Productos"</strong> y ¡listo! Se actualiza todo el catálogo al instante.
              </p>
            </div>
          </div>

          {/* Quick Action Button to test right now */}
          <div className="p-4 bg-[#18231C] text-[#F5F2EC] rounded-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block text-white">
                ¿Querés probar cómo funciona sin armar un Excel?
              </span>
              <span className="text-[11px] text-[#DCD4C9]">
                Hacé clic en el botón de la derecha para cargar un ejemplo real y ver la magia en 2 segundos.
              </span>
            </div>
            <button
              type="button"
              onClick={handleLoadDemoData}
              className="px-4 py-2 bg-[#B9522F] hover:bg-[#A84323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors shrink-0 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              Probar con Ejemplo Ahora
            </button>
          </div>
        </div>
      )}

      {/* 2. PEGAR DESDE PLANILLA */}
      {activeSubTab === 'paste_sheet' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Pegar Filas Copiadas desde Excel / Sheets
              </h4>
              <p className="text-xs text-[#6F6860]">
                Copiá las columnas de Código y Precio de tu planilla y pegalas abajo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handlePreviewPastedSheet()}
              disabled={!pasteData.trim()}
              className="px-5 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] disabled:opacity-40 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Analizar y Previsualizar Coincidencias
            </button>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1.5">
              Pegá tus filas acá (Ctrl + V):
            </label>
            <textarea
              rows={8}
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder={`Pegá aquí las celdas copiadas de tu Excel.\nEjemplo:\nBOM-01\t64900\t54000\nCAM-01\t145000\t123000\nCAL-01\t115000\t98000`}
              className="w-full p-3.5 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs font-mono text-xs text-[#18231C] focus:outline-none focus:border-[#B9522F]"
            />
          </div>

          {/* Matched Preview Table */}
          {matchedPreview.length > 0 && (
            <div className="space-y-4 p-4 bg-[#FAF8F5] border-2 border-emerald-500/40 rounded-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Se encontraron {matchedPreview.length} artículos coincidentes para actualizar:
                </div>
                <button
                  type="button"
                  onClick={handleApplyMatchedPrices}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Precios a Productos Ahora
                </button>
              </div>

              <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18231C] text-[#F5F2EC] uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Artículo</th>
                      <th className="p-2.5">Precio Viejo</th>
                      <th className="p-2.5">Precio Nuevo</th>
                      <th className="p-2.5">Precio Empresa Nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {matchedPreview.map((m, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]">
                        <td className="p-2.5 font-mono font-bold text-[#B9522F]">{m.product.code}</td>
                        <td className="p-2.5 font-bold text-[#18231C]">{m.product.name}</td>
                        <td className="p-2.5 font-mono text-[#6F6860] line-through">
                          ${m.oldPrice.toLocaleString('es-AR')}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700 bg-emerald-50">
                          ${m.newPrice.toLocaleString('es-AR')}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-blue-700 bg-blue-50">
                          ${m.newCorp.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. EDICIÓN EN TABLA DIRECTA */}
      {activeSubTab === 'manual_table' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6F6860]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar artículo por nombre, código..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveManualPrices}
              className="px-5 py-2 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Guardar Todos los Precios Editados
            </button>
          </div>

          <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18231C] text-[#F5F2EC] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Código</th>
                  <th className="p-2.5">Artículo</th>
                  <th className="p-2.5">Precio Minorista ($)</th>
                  <th className="p-2.5">Precio Empresa ($)</th>
                  <th className="p-2.5">% Descuento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4C9]">
                {products
                  .filter((p) => {
                    if (!searchQuery) return true;
                    const q = searchQuery.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                  })
                  .map((p) => {
                    const current = editablePrices[p.id] || { price: p.price, corporatePrice: p.corporatePrice || 0, discount: p.discountPercentage || 0 };
                    return (
                      <tr key={p.id} className="hover:bg-[#FAF8F5]">
                        <td className="p-2.5 font-mono font-bold text-[#B9522F]">{p.code}</td>
                        <td className="p-2.5 font-semibold text-[#18231C]">{p.name}</td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={current.price}
                            onChange={(e) => handleManualPriceChange(p.id, 'price', Number(e.target.value))}
                            className="w-28 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs font-mono font-bold text-xs text-[#18231C]"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={current.corporatePrice}
                            onChange={(e) => handleManualPriceChange(p.id, 'corporatePrice', Number(e.target.value))}
                            className="w-28 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs font-mono font-bold text-xs text-blue-700"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={current.discount}
                            onChange={(e) => handleManualPriceChange(p.id, 'discount', Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs font-mono font-bold text-xs text-emerald-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CONTROL Y ASIGNACIÓN DE DESCUENTOS POR VOLUMEN / ESCALA */}
      {activeSubTab === 'volume_discounts' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top description banner */}
          <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-600" />
                Descuentos por Cantidad / Volumen de Prendas
              </h4>
              <p className="text-xs text-[#6F6860] mt-1 max-w-2xl">
                Configurá descuentos automáticos aplicables al alcanzar determinada escala de unidades (ej: 10+, 20+, 50+ unidades).
                Podés aplicarlo a todo el catálogo o restringirlo a una categoría o subcategoría particular.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingRuleId(null);
                setRuleForm({
                  name: '',
                  minQuantity: 10,
                  discountPercentage: 15,
                  applicableCategory: 'ALL',
                  applicableSubCategory: 'ALL',
                  isActive: true,
                });
                setIsCreatingRule(true);
              }}
              className="px-4 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-[#FDB813]" />
              Nueva Regla por Volumen
            </button>
          </div>

          {/* Form to create / edit rule */}
          {isCreatingRule && (
            <form
              onSubmit={handleSaveRule}
              className="bg-white p-5 rounded-xs border-2 border-[#18231C] shadow-md space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-[#DCD4C9] pb-2">
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  {editingRuleId ? 'Editar Regla de Descuento' : 'Crear Regla de Descuento por Volumen'}
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingRule(false);
                    setEditingRuleId(null);
                  }}
                  className="text-xs text-[#6F6860] hover:text-[#18231C]"
                >
                  ✕ Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-[#4A453F] mb-1">
                    Nombre o Etiqueta de la Regla *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mayorista Escala 10+ prendas (15% OFF)"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A453F] mb-1">
                    Cantidad Mínima de Unidades *
                  </label>
                  <input
                    type="number"
                    min="2"
                    required
                    value={ruleForm.minQuantity}
                    onChange={(e) => setRuleForm({ ...ruleForm, minQuantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-bold"
                  />
                  <span className="text-[10px] text-[#6F6860]">A partir de cuántas prendas aplica</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A453F] mb-1">
                    Porcentaje de Descuento (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={ruleForm.discountPercentage}
                    onChange={(e) => setRuleForm({ ...ruleForm, discountPercentage: Math.max(1, Math.min(100, Number(e.target.value))) })}
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-bold text-amber-700"
                  />
                  <span className="text-[10px] text-[#6F6860]">Descuento que se deducirá</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4A453F] mb-1">
                    Categoría Aplicable
                  </label>
                  <select
                    value={ruleForm.applicableCategory || 'ALL'}
                    onChange={(e) => {
                      const newCat = e.target.value as any;
                      setRuleForm({
                        ...ruleForm,
                        applicableCategory: newCat,
                        applicableSubCategory: 'ALL',
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-semibold"
                  >
                    <option value="ALL">Todas las Categorías</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Infantil">Infantil</option>
                    <option value="Venta Corporativa">Venta Corporativa</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#4A453F] mb-1">
                    Subcategoría Específica (Opcional)
                  </label>
                  <select
                    value={ruleForm.applicableSubCategory || 'ALL'}
                    onChange={(e) => setRuleForm({ ...ruleForm, applicableSubCategory: e.target.value })}
                    className="w-full px-3 py-1.5 border border-[#DCD4C9] rounded-xs text-xs font-semibold"
                  >
                    <option value="ALL">Todas las Subcategorías</option>
                    {(() => {
                      if (!ruleForm.applicableCategory || ruleForm.applicableCategory === 'ALL') {
                        // Gather all unique subcategories across all categories
                        const allSubs = new Set<string>();
                        categories.forEach((c) => c.sections.forEach((s) => s.subCategories.forEach((sub) => allSubs.add(sub))));
                        return Array.from(allSubs).map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ));
                      }
                      const catFound = categories.find((c) => c.name === ruleForm.applicableCategory);
                      const catSubs = new Set<string>();
                      catFound?.sections.forEach((s) => s.subCategories.forEach((sub) => catSubs.add(sub)));
                      return Array.from(catSubs).map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#18231C] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                      className="w-4 h-4 text-[#18231C] rounded-xs"
                    />
                    <span>Regla Activa en Cotizador</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#DCD4C9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingRule(false);
                    setEditingRuleId(null);
                  }}
                  className="px-4 py-2 border border-[#DCD4C9] text-xs font-bold text-[#6F6860] hover:text-[#18231C] rounded-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer"
                >
                  {editingRuleId ? 'Guardar Cambios' : 'Crear Regla'}
                </button>
              </div>
            </form>
          )}

          {/* Rules List */}
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#18231C]">
                Reglas de Descuento por Volumen Configuradas ({volumeDiscounts.length})
              </span>
              <span className="text-[11px] text-[#6F6860]">
                Se evalúan automáticamente al sumar prendas al carrito
              </span>
            </div>

            {volumeDiscounts.length === 0 ? (
              <div className="p-8 text-center text-[#6F6860]">
                <Percent className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#18231C]" />
                <p className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  No hay reglas de descuento por volumen configuradas
                </p>
                <p className="text-xs mt-1">
                  Hacé clic en "Nueva Regla por Volumen" para otorgar descuentos automáticos a clientes por escala.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[#6F6860] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Nombre de la Regla</th>
                      <th className="p-3">Escala Mínima</th>
                      <th className="p-3">Descuento</th>
                      <th className="p-3">Categoría / Subcategoría</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {volumeDiscounts.map((rule) => (
                      <tr key={rule.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleToggleRuleActive(rule.id)}
                            className={`px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                              rule.isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            {rule.isActive ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="p-3 font-semibold text-[#18231C]">
                          {rule.name}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-[#18231C]">
                            {rule.minQuantity}+ unidades
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-xs border border-amber-200">
                            {rule.discountPercentage}% OFF
                          </span>
                        </td>
                        <td className="p-3 text-[#6F6860]">
                          <div>
                            <span className="font-semibold text-[#18231C]">
                              {rule.applicableCategory === 'ALL' || !rule.applicableCategory ? 'Todas las categorías' : rule.applicableCategory}
                            </span>
                            {rule.applicableSubCategory && rule.applicableSubCategory !== 'ALL' && (
                              <span className="text-[11px] text-[#6F6860] block">
                                Subcat: {rule.applicableSubCategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setRuleForm({
                                  name: rule.name,
                                  minQuantity: rule.minQuantity,
                                  discountPercentage: rule.discountPercentage,
                                  applicableCategory: rule.applicableCategory || 'ALL',
                                  applicableSubCategory: rule.applicableSubCategory || 'ALL',
                                  isActive: rule.isActive ?? true,
                                });
                                setIsCreatingRule(true);
                              }}
                              className="p-1 text-[#6F6860] hover:text-[#18231C] cursor-pointer"
                              title="Editar regla"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1 text-[#6F6860] hover:text-red-600 cursor-pointer"
                              title="Eliminar regla"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
