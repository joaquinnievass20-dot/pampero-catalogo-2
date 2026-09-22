import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Product, MainCategory } from '../../types';
import { CATEGORY_HIERARCHY } from '../../data/categories';
import { writeBatch, doc } from 'firebase/firestore';
import { db, getFirebaseDb } from '../../services/firebase';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Check, 
  AlertCircle, 
  X, 
  Copy, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface AdminBulkExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProducts?: (newProducts: Product[]) => void;
  onImportSuccess?: (newProducts: Product[]) => void;
  existingProducts?: Product[];
}

export const AdminBulkExcelImportModal: React.FC<AdminBulkExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportProducts,
  onImportSuccess,
  existingProducts = [],
}) => {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<Partial<Product>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  if (!isOpen) return null;

  const sampleTemplateRows = [
    {
      'Código': 'PAM-501',
      'Nombre': 'Camisa Grafa Trabajo Pesado',
      'Categoría': 'Hombre',
      'Sección': 'Industria',
      'Subcategoría': 'Camisas y remeras',
      'Precio': 48000,
      'Precio Mayorista': 41000,
      'Descuento %': 10,
      'Unisex (SI/NO)': 'NO',
      'Venta Corporativa Exclusiva (SI/NO)': 'SI',
      'Talles Especiales (de-hasta:precio:sufijo)': '50-58:56000:-1',
      'Colores': 'Azul Francia, Beige, Verde Oliva',
      'Talles': 'S, M, L, XL, XXL',
      'Imagen URL': 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80',
      'Descripción': 'Confección en gabardina 100% algodón pesada con doble costura reforzada.',
    },
    {
      'Código': 'PAM-502',
      'Nombre': 'Pantalón Cargo Ripstop Antidesgarro',
      'Categoría': 'Hombre',
      'Sección': 'Urbano',
      'Subcategoría': 'Pantalones y bermudas',
      'Precio': 56000,
      'Precio Mayorista': 49000,
      'Descuento %': 0,
      'Unisex (SI/NO)': 'SI',
      'Venta Corporativa Exclusiva (SI/NO)': 'NO',
      'Talles Especiales (de-hasta:precio:sufijo)': '52-60:64000:-1;62-68:72000:-2',
      'Colores': 'Negro, Arena, Verde Oliva',
      'Talles': '38, 40, 42, 44, 46, 48',
      'Imagen URL': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80',
      'Descripción': 'Tejido antidesgarro con seis bolsillos funcionales y refuerzo en rodillas.',
    }
  ];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Pampero');
    XLSX.writeFile(wb, 'Plantilla_Carga_Productos_Pampero.xlsx');
  };

  const handleCopyTemplateHeader = () => {
    const header = 'Código\tNombre\tCategoría\tSección\tSubcategoría\tPrecio\tPrecio Mayorista\tDescuento %\tUnisex (SI/NO)\tCorporativo Exclusivo (SI/NO)\tTalles Especiales\tColores\tTalles\tImagen URL\tDescripción';
    const sample = 'PAM-901\tCamisa Pampero Oficial\tHombre\tUrbano\tCamisas y remeras\t45000\t39000\t0\tSI\tNO\t50-58:52000:-1\tNegro, Azul\tS, M, L\thttps://images.unsplash.com/photo-1544923246-77307dd654cb\tPrenda original';
    navigator.clipboard.writeText(`${header}\n${sample}`);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const normalizeCategory = (raw: any): MainCategory => {
    const str = String(raw || '').trim().toLowerCase();
    if (str.includes('mujer')) return 'Mujer';
    if (str.includes('infant') || str.includes('niñ') || str.includes('chico')) return 'Infantil';
    if (str.includes('corp') || str.includes('mayor') || str.includes('empresa') || str.includes('industria')) return 'Venta Corporativa';
    return 'Hombre';
  };

  const cleanPrice = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
    let str = String(val).trim().replace(/[\$\sA-Za-z]/g, '');
    if (!str) return 0;
    // Format with thousands separator and decimals, e.g. 16.180,50
    if (str.includes('.') && str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      const parts = str.split(',');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1)) {
        str = str.replace(/,/g, '');
      } else {
        str = str.replace(',', '.');
      }
    } else if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length > 2) {
        str = str.replace(/\./g, '');
      } else if (parts.length === 2) {
        // e.g. "$16.180" -> parts[1] is 3 digits, so it's thousands separator: 16180
        if (parts[1].length === 3) {
          str = parts[0] + parts[1];
        } else {
          str = parts[0] + '.' + parts[1];
        }
      }
    }
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : Math.round(num);
  };

  const parseRawRows = (rows: any[]) => {
    const list: Partial<Product>[] = [];

    rows.forEach((r) => {
      // Look for keys flexibly (case-insensitive and accent-insensitive)
      const getVal = (possibleKeys: string[]) => {
        for (const k of Object.keys(r)) {
          const cleanKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
          for (const pk of possibleKeys) {
            const cleanPk = pk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            if (cleanKey.includes(cleanPk)) {
              return r[k];
            }
          }
        }
        return undefined;
      };

      // SKU Obligatorio: extraer exactamente el código de la columna del Excel
      const rawCode = getVal(['codigo', 'sku', 'cod', 'articulo', 'art', 'código', 'cód']);
      const code = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : '';

      // Si no tiene código/SKU se salta la fila (no se generan IDs automáticos)
      if (!code) return;

      const rawName = getVal(['nombre', 'producto', 'denominacion', 'item', 'titulo', 'descripcioncorta']);
      const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : '';

      // Mapeo Estricto: los campos vacíos en el Excel deben guardarse vacíos, no inventes categorías ni subcategorías
      const rawCat = getVal(['categoria', 'rubro', 'linea', 'categoría']);
      const category = rawCat !== undefined && rawCat !== null ? String(rawCat).trim() : '';

      const rawSection = getVal(['seccion', 'area', 'sección']);
      const section = rawSection !== undefined && rawSection !== null ? String(rawSection).trim() : '';

      const rawSubCat = getVal(['subcategoria', 'subrubro', 'tipo', 'subcategoría']);
      const subCategory = rawSubCat !== undefined && rawSubCat !== null ? String(rawSubCat).trim() : '';
      
      const rawPrice = getVal(['precio', 'preciominorista', 'venta', 'pvp', 'valor']);
      const price = cleanPrice(rawPrice);

      const rawCorpPrice = getVal(['preciomayorista', 'empresa', 'mayorista', 'preciocorp']);
      const corporatePrice = rawCorpPrice !== undefined && rawCorpPrice !== null && String(rawCorpPrice).trim() !== ''
        ? cleanPrice(rawCorpPrice)
        : Math.round(price * 0.85);

      const rawDesc = getVal(['descuento', 'descuentoporcentaje', 'promo']);
      const discountPercentage = rawDesc ? cleanPrice(rawDesc) : 0;

      // Extract Unisex flag
      const rawUnisex = String(getVal(['unisex', 'esunisex', 'genero', 'sexo']) || '').trim().toLowerCase();
      const isUnisex = rawUnisex === 'si' || rawUnisex === 'sí' || rawUnisex === 'true' || rawUnisex === '1' || rawUnisex === 'unisex';

      // Extract Corporate Only / Industrial flag
      const rawCorpOnly = String(getVal(['corporativo', 'solocorporativo', 'exclusivocorporativo', 'industrial', 'lineaindustrial']) || '').trim().toLowerCase();
      const isCorporateOnly = rawCorpOnly === 'si' || rawCorpOnly === 'sí' || rawCorpOnly === 'true' || rawCorpOnly === '1';

      // Extract Special Size Ranges: "50-58:56000:-1;60-66:64000:-2"
      const rawSpecialSizes = String(getVal(['tallesespeciales', 'rangotalles', 'variantesprecio', 'talles_especiales', 'preciosdiferenciados']) || '').trim();
      const specialSizeRanges = (() => {
        if (!rawSpecialSizes) return undefined;
        try {
          const parts = rawSpecialSizes.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
          const ranges = parts.map((part, pIdx) => {
            const segments = part.split(':').map((s) => s.trim());
            const rangeStr = segments[0] || '50-58';
            const rangePrice = segments[1] ? cleanPrice(segments[1]) : Math.round(price * 1.15);
            const rangeSuffix = segments[2] || '-1';
            const [fromS, toS] = rangeStr.includes('-') ? rangeStr.split('-').map((s) => s.trim()) : [rangeStr, rangeStr];
            const sizeList: string[] = [];
            const n1 = parseInt(fromS, 10);
            const n2 = parseInt(toS, 10);
            if (!isNaN(n1) && !isNaN(n2) && n2 >= n1) {
              const step = (n2 - n1) >= 2 && n1 % 2 === 0 ? 2 : 1;
              for (let s = n1; s <= n2; s += step) {
                sizeList.push(String(s));
              }
            } else {
              sizeList.push(fromS);
              if (toS !== fromS) sizeList.push(toS);
            }
            return {
              id: `range-${Date.now()}-${pIdx}`,
              suffix: rangeSuffix.startsWith('-') ? rangeSuffix : `-${rangeSuffix}`,
              rangeLabel: `Talles ${fromS} a ${toS}`,
              label: `Talles ${fromS} a ${toS}`,
              sizeRangeLabel: `Talles ${fromS} a ${toS}`,
              fromSize: fromS,
              toSize: toS,
              minSize: fromS,
              maxSize: toS,
              sizes: sizeList,
              price: rangePrice,
              corporatePrice: Math.round(rangePrice * 0.85),
            };
          });
          return ranges.length > 0 ? ranges : undefined;
        } catch {
          return undefined;
        }
      })();

      const rawColors = getVal(['colores', 'color', 'variantes']);
      const availableColors = rawColors 
        ? String(rawColors).split(/[,;/]/).map((c) => c.trim()).filter(Boolean)
        : [];

      // Talles como texto literal
      const rawSizes = getVal(['talles', 'talle', 'medidas', 'curvatalles', 'curva', 'sizes']);
      const standardSizes = rawSizes !== undefined && rawSizes !== null ? String(rawSizes).trim() : '';

      let availableSizes: string[] = [];
      if (standardSizes) {
        if (/[;,/]/.test(standardSizes)) {
          availableSizes = standardSizes.split(/[;,/]+/).map((s) => s.trim()).filter(Boolean);
        } else if (/\s+/.test(standardSizes) && !standardSizes.toLowerCase().includes('al') && !standardSizes.toLowerCase().includes('a')) {
          availableSizes = standardSizes.split(/\s+/).map((s) => s.trim()).filter(Boolean);
        } else {
          availableSizes = [standardSizes];
        }
      }

      const rawImg = String(getVal(['imagen', 'foto', 'url', 'imageurl', 'img']) || '').trim();
      const image = rawImg || '';

      const description = String(getVal(['descripcion', 'descripción', 'detalle', 'observaciones']) || '').trim();
      const rawPromoTag = String(getVal(['etiqueta', 'tag', 'promocion', 'promoción', 'estado']) || '').trim();

      list.push({
        id: code,
        code: code,
        name: name || code,
        category,
        section,
        subCategory,
        price,
        corporatePrice,
        discountPercentage,
        isUnisex,
        isCorporateOnly,
        specialSizeRanges,
        availableColors,
        availableSizes,
        standardSizes,
        image,
        images: image ? [image] : [],
        description,
        features: [],
        inStock: true,
        promotionTag: rawPromoTag,
      });
    });

    setParsedRows(list);
    setErrorMsg(list.length === 0 ? 'No se encontraron filas válidas con Código (SKU) en la planilla.' : null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        parseRawRows(jsonData);
      } catch (err: any) {
        setErrorMsg('Error al leer el archivo Excel/CSV. Comprobá el formato.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Pegá datos copiados desde Excel o Google Sheets.');
      return;
    }

    try {
      const lines = pasteText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      // Determine separator: Tab (from copy-paste) or comma/semicolon
      const firstLine = lines[0];
      const sep = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

      const headers = firstLine.split(sep).map((h) => h.trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(sep);
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = parts[idx] ? parts[idx].trim() : '';
        });
        rows.push(obj);
      }

      parseRawRows(rows);
    } catch (err: any) {
      setErrorMsg('No se pudieron interpretar las celdas pegadas. Asegurate de incluir la fila de encabezados.');
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessCount(null);

    try {
      const firestoreDb = db || getFirebaseDb();
      if (!firestoreDb) {
        throw new Error('No se pudo establecer conexión con Firebase Firestore. Verificá tu conexión a internet.');
      }

      // Preparar los productos asegurando que el código SKU sea el ID único de documento
      const fullProducts: Product[] = parsedRows
        .filter((p) => Boolean(p.code || p.id))
        .map((p) => {
          const sku = String(p.code || p.id).trim();
          const priceCleaned = typeof p.price === 'number' ? p.price : cleanPrice(p.price);
          const corporatePriceCleaned = p.corporatePrice !== undefined && p.corporatePrice !== null
            ? (typeof p.corporatePrice === 'number' ? p.corporatePrice : cleanPrice(p.corporatePrice))
            : Math.round(priceCleaned * 0.85);

          return {
            id: sku,
            code: sku,
            name: p.name || sku,
            category: p.category || '',
            section: p.section || '',
            subCategory: p.subCategory || '',
            description: p.description || '',
            features: Array.isArray(p.features) ? p.features : [],
            price: priceCleaned,
            corporatePrice: corporatePriceCleaned,
            discountPercentage: typeof p.discountPercentage === 'number' ? p.discountPercentage : cleanPrice(p.discountPercentage),
            promotionTag: p.promotionTag || '',
            image: p.image || '',
            images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
            imagesMen: Array.isArray(p.imagesMen) ? p.imagesMen : [],
            imagesWomen: Array.isArray(p.imagesWomen) ? p.imagesWomen : [],
            availableColors: Array.isArray(p.availableColors) ? p.availableColors : [],
            availableSizes: Array.isArray(p.availableSizes) ? p.availableSizes : [],
            standardSizes: p.standardSizes || '',
            isUnisex: Boolean(p.isUnisex),
            isCorporateOnly: Boolean(p.isCorporateOnly),
            specialSizeRanges: p.specialSizeRanges,
            inStock: true,
          };
        });

      // Firebase Batch Write directamente desde el frontend usando writeBatch(db)
      // Firestore limita cada batch a 500 operaciones. Usamos bloques seguros de 200 items.
      const BATCH_SIZE = 200;
      for (let i = 0; i < fullProducts.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestoreDb);
        const chunk = fullProducts.slice(i, i + BATCH_SIZE);

        for (const producto of chunk) {
          const sku = String(producto.code || producto.id).trim();
          if (!sku) continue;

          // SKU Obligatorio: doc(db, 'products', String(fila['CÓDIGO']))
          const docRefProducts = doc(firestoreDb, 'products', sku);
          const docRefProductos = doc(firestoreDb, 'productos', sku);

          // Limpiar valores undefined para evitar rechazos del SDK de Firestore
          const datos = JSON.parse(
            JSON.stringify(
              {
                ...producto,
                id: sku,
                code: sku,
                updatedAt: new Date().toISOString(),
              },
              (_, v) => (v === undefined ? null : v)
            )
          );

          // batch.set(referencia, datos, { merge: true }) para no duplicar
          batch.set(docRefProducts, datos, { merge: true });
          batch.set(docRefProductos, datos, { merge: true });
        }

        // Ejecutar escritura por lotes en Firebase
        await batch.commit();
      }

      // Actualizar el catálogo en memoria y notificar componentes padres
      const currentList = existingProducts || [];
      const updatedMap = new Map<string, Product>();
      currentList.forEach((p) => {
        const k = (p.code || p.id).trim().toUpperCase();
        updatedMap.set(k, p);
      });
      fullProducts.forEach((p) => {
        const k = (p.code || p.id).trim().toUpperCase();
        const existing = updatedMap.get(k);
        updatedMap.set(k, {
          ...(existing || {}),
          ...p,
        });
      });
      const updatedCatalog = Array.from(updatedMap.values());

      if (onImportSuccess) {
        onImportSuccess(updatedCatalog);
      }
      if (onImportProducts) {
        onImportProducts(updatedCatalog);
      }

      setSuccessCount(fullProducts.length);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('[FIREBASE BATCH ERROR]:', err);
      const errorMsgDetails = err?.message || String(err);
      setErrorMsg(`Error al guardar en Firebase: ${errorMsgDetails}. Comprobá los permisos o la conexión.`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-4xl bg-white rounded-xs shadow-2xl flex flex-col max-h-[90vh] border border-[#DCD4C9] overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#18231C] text-[#F5F2EC] px-5 py-4 flex items-center justify-between border-b border-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#B9522F] text-white rounded-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg uppercase tracking-wider leading-none">
                Carga Masiva de Productos (Excel / Google Sheets)
              </h3>
              <p className="text-xs text-[#A89F91] mt-0.5">
                Importá o actualizá decenas de artículos al catálogo central simultáneamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#A89F91] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Instructions */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Top Assistant Bar */}
          <div className="bg-[#FAF8F5] p-3.5 rounded-xs border border-[#DCD4C9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-[#6F6860]">
              <span className="font-bold text-[#18231C] block sm:inline">Columnas soportadas:</span>{' '}
              <span className="font-mono text-[11px] text-[#4A453F]">
                Código, Nombre, Categoría, Sección, Subcategoría, Precio, Precio Mayorista, Descuento %, Colores, Talles, Imagen URL, Descripción
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] text-[#18231C] border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Descargar archivo Excel .xlsx de muestra"
              >
                <Download className="w-3.5 h-3.5 text-[#B9522F]" />
                Descargar Plantilla Excel
              </button>

              <button
                type="button"
                onClick={handleCopyTemplateHeader}
                className="px-3 py-1.5 bg-white hover:bg-[#ECE5DC] text-[#18231C] border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copiar encabezados para pegar en Google Sheets"
              >
                {copiedTemplate ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#6F6860]" />
                    Copiar Encabezados
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mode Tabs: Upload File vs Paste Spreadsheet */}
          <div className="flex border-b border-[#DCD4C9]">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`py-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                activeMode === 'upload'
                  ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              1. Subir Archivo Excel (.xlsx / .csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('paste')}
              className={`py-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                activeMode === 'paste'
                  ? 'border-[#B9522F] text-[#B9522F] bg-[#FAF8F5]'
                  : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
              }`}
            >
              2. Pegar Directo de Google Sheets
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {activeMode === 'upload' && (
            <div className="border-2 border-dashed border-[#DCD4C9] hover:border-[#B9522F] rounded-xs p-6 sm:p-8 text-center transition-colors bg-[#FAF8F5]/60">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-1">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-[#18231C]">
                  {fileName ? `Archivo seleccionado: ${fileName}` : 'Hacé clic para seleccionar tu archivo Excel (.xlsx / .csv)'}
                </span>
                <span className="text-xs text-[#6F6860] max-w-sm">
                  Detecta automáticamente códigos, nombres, categorías, precios y fotos asociadas.
                </span>
              </label>
            </div>
          )}

          {/* Mode 2: Paste Google Sheets */}
          {activeMode === 'paste' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4A453F] uppercase tracking-wider">
                Pegá las celdas copiadas de Google Sheets o Excel (incluyendo la fila de encabezados):
              </label>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Código&#9;Nombre&#9;Categoría&#9;Sección&#9;Precio&#9;Colores&#10;PAM-101&#9;Camisa Pampero&#9;Hombre&#9;Urbano&#9;45000&#9;Azul, Negro"
                className="w-full p-3 font-mono text-xs border border-[#DCD4C9] rounded-xs bg-white text-[#18231C] focus:border-[#B9522F] outline-none"
              />
              <button
                type="button"
                onClick={handlePasteProcess}
                className="px-4 py-2 bg-[#18231C] text-white text-xs font-bold uppercase tracking-wider rounded-xs hover:bg-black transition-colors cursor-pointer"
              >
                Procesar Celdas Pegadas
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Banner */}
          {successCount !== null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xs text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">¡Importación exitosa!</p>
                <p>Se incorporaron {successCount} artículos al catálogo central de Pampero Gran Mendoza.</p>
              </div>
            </div>
          )}

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#B9522F]" />
                  Vista Previa de Productos a Importar ({parsedRows.length} detectados)
                </h4>
                <button
                  type="button"
                  onClick={() => setParsedRows([])}
                  className="text-xs text-[#6F6860] hover:text-red-600 font-medium cursor-pointer"
                >
                  Limpiar lista
                </button>
              </div>

              <div className="border border-[#DCD4C9] rounded-xs overflow-x-auto max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F5] border-b border-[#DCD4C9] text-[10px] uppercase font-bold text-[#4A453F] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2">Código</th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2">Categoría</th>
                      <th className="p-2">Sección / Subcat</th>
                      <th className="p-2">Precio</th>
                      <th className="p-2">Colores</th>
                      <th className="p-2">Talles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-amber-50/40">
                        <td className="p-2 font-mono font-bold text-[#18231C]">{r.code}</td>
                        <td className="p-2 font-medium text-[#18231C]">
                          <div>{r.name}</div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {r.isUnisex && (
                              <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1 rounded-xs border border-blue-200">
                                Unisex
                              </span>
                            )}
                            {r.isCorporateOnly && (
                              <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1 rounded-xs border border-purple-200">
                                Corp Exclusivo
                              </span>
                            )}
                            {r.specialSizeRanges && r.specialSizeRanges.length > 0 && (
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1 rounded-xs border border-amber-200">
                                {r.specialSizeRanges.length} Talles Esp.
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 bg-[#ECE5DC] rounded-xs text-[10px] font-semibold">
                            {r.category}
                          </span>
                        </td>
                        <td className="p-2 text-[#6F6860]">
                          {r.section} · {r.subCategory}
                        </td>
                        <td className="p-2 font-mono font-semibold text-[#18231C]">
                          ${(r.price || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="p-2 text-[#6F6860] text-[11px]">
                          {r.availableColors?.join(', ') || '-'}
                        </td>
                        <td className="p-2 text-[#6F6860] text-[11px]">
                          {r.standardSizes || r.availableSizes?.join(', ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[#FAF8F5] px-5 py-3 border-t border-[#DCD4C9] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#4A453F] hover:bg-[#ECE5DC] rounded-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {parsedRows.length > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[#B9522F] hover:bg-[#A34323] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isProcessing
                ? 'Guardando en Firebase...'
                : `Confirmar e Importar ${parsedRows.length} Artículos`}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
