import React, { useState, useRef } from 'react';
import { Product } from '../../types';
import { 
  Images, 
  Upload, 
  Link as LinkIcon, 
  Check, 
  Sparkles, 
  Search, 
  FolderOpen, 
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

interface AdminMassImagesTabProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  triggerSaveNotice: () => void;
}

// Convert any Google Drive sharing link to a direct embeddable image URL
export const formatGoogleDriveUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Case 1: https://drive.google.com/file/d/FILE_ID/view...
  const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }

  // Case 2: id=FILE_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
  }

  // Case 3: Already an image URL or googleusercontent
  return trimmed;
};

// Curated high quality Pampero Argentina catalog image library
export const DEMO_PAMPERO_IMAGES = [
  {
    code: 'BOM-01',
    name: 'Bombacha de Campo Pampero Clásica',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80',
  },
  {
    code: 'CAM-01',
    name: 'Campera Softshell Térmica Pampero',
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
  },
  {
    code: 'CAL-01',
    name: 'Bota de Seguridad Pampero Cuero Dieléctrico',
    image: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=800&q=80',
  },
  {
    code: 'REM-01',
    name: 'Chomba Pampero Piqué Algodón 100%',
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
  },
];

export const AdminMassImagesTab: React.FC<AdminMassImagesTabProps> = ({
  products,
  onUpdateProducts,
  triggerSaveNotice,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'instructions' | 'batch_files' | 'drive_links' | 'product_list'>('instructions');
  const [searchQuery, setSearchQuery] = useState('');
  const [driveLinksText, setDriveLinksText] = useState('');
  const [uploadedFilesPreview, setUploadedFilesPreview] = useState<Array<{ name: string; dataUrl: string; matchedCode?: string; matchedProduct?: Product }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileBatchInputRef = useRef<HTMLInputElement>(null);

  // 1. Batch upload multiple files from local disk
  const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const fileList = Array.from(files) as File[];
    const previews: Array<{ name: string; dataUrl: string; matchedCode?: string; matchedProduct?: Product }> = [];

    let processedCount = 0;

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();

        // Match against product code or product name
        const matched = products.find((p) => {
          const codeLower = p.code.toLowerCase();
          const nameLower = p.name.toLowerCase();
          return (
            codeLower === fileNameWithoutExt ||
            fileNameWithoutExt.includes(codeLower) ||
            codeLower.includes(fileNameWithoutExt) ||
            nameLower.includes(fileNameWithoutExt) ||
            fileNameWithoutExt.includes(nameLower)
          );
        });

        previews.push({
          name: file.name,
          dataUrl,
          matchedCode: matched?.code,
          matchedProduct: matched,
        });

        processedCount++;
        if (processedCount === fileList.length) {
          setUploadedFilesPreview(previews);
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Apply batch files to products
  const handleApplyBatchFiles = () => {
    if (uploadedFilesPreview.length === 0) return;

    let updatedCount = 0;
    const matchMap = new Map<string, string>();
    uploadedFilesPreview.forEach((item) => {
      if (item.matchedProduct) {
        matchMap.set(item.matchedProduct.id, item.dataUrl);
      }
    });

    const updated = products.map((p) => {
      const newImg = matchMap.get(p.id);
      if (newImg) {
        updatedCount++;
        return { ...p, image: newImg };
      }
      return p;
    });

    onUpdateProducts(updated);
    alert(`¡Éxito! Se actualizaron las imágenes de ${updatedCount} productos del catálogo.`);
    triggerSaveNotice();
    setUploadedFilesPreview([]);
  };

  // 2. Process Google Drive links pasted line by line
  const handleProcessDriveLinks = () => {
    const lines = driveLinksText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Pegá los enlaces primero en el recuadro.');
      return;
    }

    let updatedCount = 0;
    const updated = [...products];

    lines.forEach((line) => {
      const parts = line.split(/[\t,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        const codeOrName = parts[0].toLowerCase();
        const rawUrl = parts[1];
        const formatted = formatGoogleDriveUrl(rawUrl);

        const prodIndex = updated.findIndex((p) => {
          return p.code.toLowerCase() === codeOrName || p.name.toLowerCase().includes(codeOrName);
        });

        if (prodIndex !== -1 && formatted) {
          updated[prodIndex] = {
            ...updated[prodIndex],
            image: formatted,
          };
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      onUpdateProducts(updated);
      alert(`¡Éxito! Se actualizaron ${updatedCount} imágenes mediante enlaces.`);
      triggerSaveNotice();
      setDriveLinksText('');
    } else {
      alert('No se pudo emparejar ningún producto. Verificá que cada renglón tenga: CODIGO [espacio] LINK_DE_DRIVE');
    }
  };

  // Demo test button
  const handleLoadDemoImages = () => {
    let count = 0;
    const updated = products.map((p) => {
      const demo = DEMO_PAMPERO_IMAGES.find((d) => d.code === p.code || p.name.includes(d.code));
      if (demo) {
        count++;
        return { ...p, image: demo.image };
      }
      return p;
    });

    if (count > 0) {
      onUpdateProducts(updated);
      alert(`¡Se aplicaron fotos oficiales de demostración a ${count} productos del catálogo!`);
      triggerSaveNotice();
    } else {
      // Fallback: apply to first 4 products
      const fallbackUpdated = products.map((p, idx) => {
        if (idx < DEMO_PAMPERO_IMAGES.length) {
          return { ...p, image: DEMO_PAMPERO_IMAGES[idx].image };
        }
        return p;
      });
      onUpdateProducts(fallbackUpdated);
      alert('¡Se aplicaron fotos oficiales a los primeros 4 productos del catálogo!');
      triggerSaveNotice();
    }
  };

  // Update single product image manually
  const handleUpdateSingleProduct = (productId: string, newUrl: string) => {
    const formatted = formatGoogleDriveUrl(newUrl);
    const updated = products.map((p) => (p.id === productId ? { ...p, image: formatted } : p));
    onUpdateProducts(updated);
    triggerSaveNotice();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xs border border-[#DCD4C9] shadow-2xs">
        <div>
          <h3 className="font-bold text-sm text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Images className="w-4 h-4 text-[#B9522F]" />
            Carga Masiva de Fotos & Catálogo Pampero
          </h3>
          <p className="text-xs text-[#6F6860]">
            Cargá todas las fotos de tu carpeta de una sola vez o vinculá enlaces directos de Google Drive.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadDemoImages}
          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Probar con Fotos de Demostración
        </button>
      </div>

      {/* Sub Tabs */}
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
          Instructivo Paso a Paso (Guía Visual)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('batch_files')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'batch_files'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-emerald-600" />
          1. Subir Carpeta de Fotos desde tu PC
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('drive_links')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'drive_links'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <LinkIcon className="w-4 h-4 text-blue-600" />
          2. Pegar Enlaces de Google Drive
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('product_list')}
          className={`py-2.5 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'product_list'
              ? 'border-[#B9522F] text-[#B9522F] bg-white shadow-2xs'
              : 'border-transparent text-[#6F6860] hover:text-[#18231C]'
          }`}
        >
          <Images className="w-4 h-4 text-neutral-600" />
          3. Ver y Cambiar Producto por Producto
        </button>
      </div>

      {/* 1. INSTRUCTIVO ILUSTRADO */}
      {activeSubTab === 'instructions' && (
        <div className="bg-white p-6 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#B9522F]" />
              ¿Cómo cargar fotos de forma masiva? (Explicación Paso a Paso)
            </h4>
            <p className="text-xs text-[#6F6860] mt-1">
              Podés elegir el método que te resulte más cómodo: desde tu computadora o desde tu carpeta de Google Drive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Método A: Carpeta Local */}
            <div className="p-5 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-[#18231C] text-[#F5F2EC] text-xs font-bold grid place-items-center">
                  A
                </span>
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Método 1: Subir archivos desde tu Computadora (Más rápido)
                </h5>
              </div>

              <div className="space-y-2 text-xs text-[#4A453F] leading-relaxed">
                <p>
                  <strong>Paso 1:</strong> En tu computadora, asegurate de que los nombres de los archivos de imagen contengan el código del producto o parte del nombre.
                </p>
                <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs font-mono text-[11px] space-y-1">
                  <div>✓ <span className="text-[#18231C] font-bold">BOM-01.jpg</span> (Se vinculará con Bombacha Pampero)</div>
                  <div>✓ <span className="text-[#18231C] font-bold">CAM-01.png</span> (Se vinculará con Campera Softshell)</div>
                  <div>✓ <span className="text-[#18231C] font-bold">CAL-01.webp</span> (Se vinculará con Botas de Seguridad)</div>
                </div>
                <p>
                  <strong>Paso 2:</strong> Hacé clic en la pestaña <strong>"1. Subir Carpeta de Fotos desde tu PC"</strong>.
                </p>
                <p>
                  <strong>Paso 3:</strong> Hacé clic en <strong>"Seleccionar Todas las Fotos de tu Carpeta"</strong>. Podés seleccionar 10, 20 o 50 fotos juntas manteniendo presionado <kbd className="px-1 py-0.5 bg-white border border-[#DCD4C9] rounded font-mono text-[10px]">Ctrl + A</kbd>.
                </p>
                <p>
                  <strong>Paso 4:</strong> Verás las fotos en pantalla con el producto al que fueron asignadas. Hacé clic en el botón verde <strong>"Aplicar Fotos al Catálogo"</strong>.
                </p>
              </div>
            </div>

            {/* Método B: Google Drive */}
            <div className="p-5 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-[#18231C] text-[#F5F2EC] text-xs font-bold grid place-items-center">
                  B
                </span>
                <h5 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Método 2: Usar fotos desde tu Google Drive
                </h5>
              </div>

              <div className="space-y-2 text-xs text-[#4A453F] leading-relaxed">
                <p>
                  <strong>Paso 1:</strong> En tu Google Drive, abrí la foto que querés usar.
                </p>
                <p>
                  <strong>Paso 2:</strong> Hacé clic en el botón <strong>"Compartir"</strong> y seleccioná <span className="underline font-semibold">"Cualquier persona con el enlace puede ver"</span> (esto es fundamental para que se pueda mostrar en la página).
                </p>
                <p>
                  <strong>Paso 3:</strong> Copiá el enlace que te da Google Drive.
                </p>
                <p>
                  <strong>Paso 4:</strong> Vení a la pestaña <strong>"2. Pegar Enlaces de Google Drive"</strong> y pegá el código seguido del enlace:
                </p>
                <div className="p-2.5 bg-white border border-[#DCD4C9] rounded-xs font-mono text-[10px] text-neutral-600 break-all">
                  BOM-01 https://drive.google.com/file/d/1kfNAYd.../view<br />
                  CAM-01 https://drive.google.com/file/d/1AbC234.../view
                </div>
                <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-xs border border-emerald-200">
                  ✓ El sistema convierte automáticamente el enlace de Drive para que se vea directamente en alta resolución sin bloqueos.
                </p>
              </div>
            </div>
          </div>

          {/* Direct Demo Testing Banner */}
          <div className="p-4 bg-[#18231C] text-[#F5F2EC] rounded-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block text-white">
                ¿Querés probar la carga masiva ahora mismo?
              </span>
              <span className="text-[11px] text-[#DCD4C9]">
                Hacé clic en el botón para cargar 4 fotos oficiales de prueba y ver cómo se actualiza el catálogo en el acto.
              </span>
            </div>
            <button
              type="button"
              onClick={handleLoadDemoImages}
              className="px-4 py-2 bg-[#FDB813] hover:bg-[#E0A310] text-[#18231C] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors shrink-0 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              Cargar Fotos Oficiales de Prueba
            </button>
          </div>
        </div>
      )}

      {/* 2. SUBIR ARCHIVOS LOCALES MASIVAMENTE */}
      {activeSubTab === 'batch_files' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-600" />
                Subir Múltiples Imágenes desde tu Disco
              </h4>
              <p className="text-xs text-[#6F6860]">
                Seleccioná todas las fotos que quieras a la vez. El sistema buscará el código o nombre en cada archivo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileBatchInputRef}
                multiple
                accept="image/*"
                onChange={handleBatchFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileBatchInputRef.current?.click()}
                className="px-5 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                Seleccionar Fotos Masivas (Múltiples)
              </button>
            </div>
          </div>

          {/* Status message */}
          {isProcessing && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xs font-semibold flex items-center gap-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Procesando y emparejando archivos de imagen con los productos...
            </div>
          )}

          {/* Previews grid if files selected */}
          {uploadedFilesPreview.length > 0 && (
            <div className="space-y-4 p-4 bg-[#FAF8F5] border-2 border-emerald-500/40 rounded-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Se cargaron {uploadedFilesPreview.length} archivos. Revisá el emparejamiento:
                </div>
                <button
                  type="button"
                  onClick={handleApplyBatchFiles}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Fotos al Catálogo Ahora
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {uploadedFilesPreview.map((item, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-xs border border-[#DCD4C9] space-y-1.5 shadow-2xs">
                    <div className="aspect-[4/5] bg-neutral-100 rounded-xs overflow-hidden">
                      <img src={item.dataUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500 truncate" title={item.name}>
                      {item.name}
                    </div>
                    {item.matchedProduct ? (
                      <div className="text-[10px] font-bold text-emerald-700 truncate" title={item.matchedProduct.name}>
                        ✓ {item.matchedProduct.code}
                      </div>
                    ) : (
                      <div className="text-[9px] font-bold text-amber-700">
                        ⚠ Sin emparejar
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PEGAR ENLACES DE GOOGLE DRIVE */}
      {activeSubTab === 'drive_links' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD4C9] pb-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#18231C] flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                Vincular Enlaces Directos de Google Drive
              </h4>
              <p className="text-xs text-[#6F6860]">
                Escribí un renglón por producto con el Código seguido del Enlace de Drive.
              </p>
            </div>

            <button
              type="button"
              onClick={handleProcessDriveLinks}
              disabled={!driveLinksText.trim()}
              className="px-5 py-2.5 bg-[#18231C] hover:bg-black text-[#F5F2EC] disabled:opacity-40 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors shadow-xs"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Sincronizar Enlaces con Productos
            </button>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#4A453F] mb-1.5">
              Renglones (Código + Enlace de Drive):
            </label>
            <textarea
              rows={8}
              value={driveLinksText}
              onChange={(e) => setDriveLinksText(e.target.value)}
              placeholder={`BOM-01 https://drive.google.com/file/d/1kfNAYd.../view\nCAM-01 https://drive.google.com/file/d/1AbC.../view\nCAL-01 https://drive.google.com/file/d/1XyZ.../view`}
              className="w-full p-3.5 bg-[#FAF8F5] border-2 border-[#DCD4C9] rounded-xs font-mono text-xs text-[#18231C] focus:outline-none focus:border-[#FDB813]"
            />
          </div>
        </div>
      )}

      {/* 4. PRODUCTO POR PRODUCTO */}
      {activeSubTab === 'product_list' && (
        <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6F6860]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs text-[#18231C]"
              />
            </div>
            <span className="text-xs text-[#6F6860]">
              Pegá la URL directa en cualquier casilla para cambiar la foto de ese artículo.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {products
              .filter((p) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
              })
              .map((p) => (
                <div key={p.id} className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs flex gap-3">
                  <div className="w-20 h-24 bg-neutral-200 rounded-xs overflow-hidden shrink-0 border border-[#DCD4C9]">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#18231C]">{p.code}</span>
                      <span className="text-[9px] text-[#6F6860] uppercase truncate max-w-[80px]">{p.category}</span>
                    </div>
                    <div className="text-xs font-bold text-[#18231C] truncate" title={p.name}>
                      {p.name}
                    </div>
                    <input
                      type="text"
                      defaultValue={p.image}
                      onBlur={(e) => {
                        if (e.target.value !== p.image) {
                          handleUpdateSingleProduct(p.id, e.target.value);
                        }
                      }}
                      placeholder="Pegar URL de foto..."
                      className="w-full px-2 py-1 bg-white border border-[#DCD4C9] rounded-xs text-[10px] font-mono"
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
