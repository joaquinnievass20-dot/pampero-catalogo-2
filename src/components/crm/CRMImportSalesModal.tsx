import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  DollarSign, 
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { CRMSale } from '../../types';
import { 
  saveCRMSalesBatch, 
  cleanCurrencyAmount, 
  parseExcelDate 
} from '../../services/firebase';
import { fixUtf8Encoding } from '../../utils/encodingUtils';

interface CRMImportSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (importedCount: number) => void;
}

export const CRMImportSalesModal: React.FC<CRMImportSalesModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [previewSales, setPreviewSales] = useState<CRMSale[]>([]);
  const [detectedBranches, setDetectedBranches] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setPreviewSales([]);
    setDetectedBranches([]);
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsParsing(false);
    setIsSaving(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMessage(null);
    setSuccessNotice(null);
    setPreviewSales([]);
    setDetectedBranches([]);
    setIsParsing(true);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        if (!buffer) {
          throw new Error('No se pudo leer el contenido del archivo.');
        }

        // 1. Leer libro Excel
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        // 2. Buscar estrictamente la hoja llamada Control_Cierres
        const targetSheetName = workbook.SheetNames.find(
          (name) => name.trim().toLowerCase() === 'control_cierres'
        );

        if (!targetSheetName) {
          const available = workbook.SheetNames.join(', ');
          throw new Error(
            `El archivo no contiene la hoja obligatoria "Control_Cierres". Hojas detectadas en el archivo: [${available || 'ninguna'}]. Por favor verificá que la pestaña se llame exactamente Control_Cierres.`
          );
        }

        const worksheet = workbook.Sheets[targetSheetName];
        if (!worksheet) {
          throw new Error(`La hoja "${targetSheetName}" está vacía o no tiene formato válido.`);
        }

        // 3. Convertir hoja a matriz 2D para acceder por coordenadas de fila y columna
        // Columna A = 0, B = 1 (Fecha), C = 2 (Local), K = 10 (TOTAL DEL DÍA)
        // Ignora el cuadro resumen de las columnas N-Q (índices 13 a 16)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true,
          defval: null,
        });

        if (!rawRows || rawRows.length < 2) {
          throw new Error('La hoja "Control_Cierres" no contiene suficientes filas de datos.');
        }

        // Detectar si la tabla comienza en la fila 2 (índice 1)
        // Buscamos dinámicamente si la fila 2 es el encabezado o si ya tiene datos
        let startRowIndex = 1; // Fila 2 (0-indexed es 1)
        let colFechaIndex = 1; // Columna B
        let colLocalIndex = 2; // Columna C
        let colTotalIndex = 10; // Columna K

        // Inspeccionar las primeras filas para validar o confirmar encabezados
        for (let r = 0; r < Math.min(5, rawRows.length); r++) {
          const rRow = rawRows[r] || [];
          const bCell = String(rRow[1] || '').toLowerCase().trim();
          const cCell = String(rRow[2] || '').toLowerCase().trim();
          const kCell = String(rRow[10] || '').toLowerCase().trim();

          if (bCell.includes('fecha') || cCell.includes('local') || kCell.includes('total')) {
            startRowIndex = r + 1; // Los datos comienzan en la siguiente fila
            // Verificar si los encabezados están exactamente en B, C, K o si hubo desplazamiento
            for (let c = 0; c < rRow.length; c++) {
              // Ignorar columnas N-Q (índices 13 a 16)
              if (c >= 13 && c <= 16) continue;
              const text = String(rRow[c] || '').toLowerCase().trim();
              if (text.includes('fecha')) colFechaIndex = c;
              if (text.includes('local') || text.includes('sucursal')) colLocalIndex = c;
              if (
                text.includes('total del') || 
                text.includes('total dia') || 
                text.includes('total día') || 
                (text.includes('total') && !text.includes('resumen') && !text.includes('mes'))
              ) {
                colTotalIndex = c;
              }
            }
            break;
          }
        }

        const parsedList: CRMSale[] = [];
        const branchesSet = new Set<string>();

        for (let r = startRowIndex; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          const rawDateCell = row[colFechaIndex];
          const rawLocalCell = row[colLocalIndex];
          const rawTotalCell = row[colTotalIndex];

          // Validar si la fila contiene datos reales
          if (rawDateCell === null || rawDateCell === undefined || rawLocalCell === null || rawLocalCell === undefined) {
            continue;
          }

          const parsedDate = parseExcelDate(rawDateCell);
          const cleanLocal = fixUtf8Encoding(String(rawLocalCell).trim());

          // Omitir filas de totales generales o resúmenes al pie
          const lowerLocal = cleanLocal.toLowerCase();
          if (
            !cleanLocal || 
            lowerLocal === 'total' || 
            lowerLocal === 'totales' || 
            lowerLocal.startsWith('total ') || 
            lowerLocal.includes('resumen')
          ) {
            continue;
          }

          if (!parsedDate) {
            continue;
          }

          // Limpiar formato de moneda de la columna TOTAL DEL DÍA (ej: "$652,700.00" -> 652700)
          const cleanTotal = cleanCurrencyAmount(rawTotalCell);

          // Clave de actualización segura en Firebase: Fecha + '-' + Local
          // (ej: doc(db, 'crm_sales', fila['Fecha'] + '-' + fila['Local']))
          const safeBranchKey = cleanLocal.replace(/[\/\\]/g, '-').trim();
          const docId = `${parsedDate}-${safeBranchKey}`;

          parsedList.push({
            id: docId,
            date: parsedDate,
            branch: cleanLocal,
            totalDaily: cleanTotal,
            rawDate: String(rawDateCell),
            importedAt: new Date().toISOString(),
          });

          branchesSet.add(cleanLocal);
        }

        if (parsedList.length === 0) {
          throw new Error(
            'No se encontraron filas válidas en la hoja "Control_Cierres". Asegurate de que comience en la fila 2 con Fecha (Col B), Local (Col C) y TOTAL DEL DÍA (Col K).'
          );
        }

        setPreviewSales(parsedList);
        setDetectedBranches(Array.from(branchesSet));
      } catch (err: any) {
        console.error('[EXCEL IMPORT ERROR]:', err);
        setErrorMessage(
          err?.message || 'Error al procesar el archivo Excel. Verificá que el formato sea correcto.'
        );
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setIsParsing(false);
      setErrorMessage('Error al leer el archivo en el navegador.');
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleSaveToFirestore = async () => {
    if (previewSales.length === 0) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Guardar en Cloud Firestore en la colección crm_sales usando writeBatch
      const result = await saveCRMSalesBatch(previewSales);

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar los cierres de ventas en Cloud Firestore.');
      }

      setSuccessNotice(
        `¡Éxito! Se sincronizaron ${result.count} cierres de ventas en la colección crm_sales de Cloud Firestore.`
      );

      if (onSuccess) {
        onSuccess(result.count);
      }

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('[FIRESTORE SAVE ERROR]:', err);
      setErrorMessage(
        err?.message || 'Error al guardar en Cloud Firestore. Verificá la conexión a Firebase.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Cálculos rápidos de vista previa
  const totalImportRevenue = previewSales.reduce((acc, s) => acc + (s.totalDaily || 0), 0);
  const minDate = previewSales.length > 0 ? previewSales[0].date : '';
  const maxDate = previewSales.length > 0 ? previewSales[previewSales.length - 1].date : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-[#F5F2EC] w-full max-w-3xl max-h-[92vh] rounded-xs border-2 border-[#18231C] shadow-2xl flex flex-col overflow-hidden text-[#18231C]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#18231C] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#DCD4C9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FDB813] text-[#18231C] rounded-xs font-black">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wider uppercase text-[#F5F2EC]">
                Importar Cierres de Ventas (Excel)
              </h3>
              <p className="text-xs text-neutral-300">
                Lectura de hoja <strong className="text-[#FDB813]">Control_Cierres</strong> · Sincronización a Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Instrucciones y Reglas de Importación */}
          <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-[#18231C] font-bold">
              <Info className="w-4 h-4 text-[#B9522F] shrink-0" />
              <span>Estructura Requerida de la Planilla</span>
            </div>
            <ul className="text-neutral-600 space-y-1 list-disc list-inside">
              <li>Hoja obligatoria nombrada estrictamente: <strong className="text-[#18231C]">Control_Cierres</strong>.</li>
              <li>La tabla comienza en la <strong>Fila 2</strong> con: <strong className="text-[#18231C]">Fecha</strong> (Col B), <strong className="text-[#18231C]">Local</strong> (Col C) y <strong className="text-[#18231C]">TOTAL DEL DÍA</strong> (Col K).</li>
              <li>Las columnas de resumen N-Q se ignoran automáticamente.</li>
              <li>Limpieza inteligente de moneda: convierte formatos como <code>$652,700.00</code> a valor numérico puro.</li>
              <li>Clave única anti-duplicados: <code>Fecha-Local</code> con actualización <code>{'{ merge: true }'}</code>.</li>
            </ul>
          </div>

          {/* Banner de Error */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xs text-red-950 font-medium flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Error al procesar el archivo:</span>
                <span className="text-xs leading-relaxed">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-700 hover:text-red-900 font-bold text-xs underline cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Banner de Éxito */}
          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xs text-emerald-950 font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="flex-1">{successNotice}</span>
            </div>
          )}

          {/* Selector de Archivo / Dropzone */}
          {previewSales.length === 0 && !isParsing && (
            <div className="bg-white p-6 rounded-xs border-2 border-dashed border-[#DCD4C9] hover:border-[#18231C] text-center transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-sales-file-input"
              />
              <label 
                htmlFor="excel-sales-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C9] text-[#18231C] rounded-full group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-[#18231C]" />
                </div>
                <div className="font-bold text-sm text-[#18231C]">
                  {file ? file.name : 'Hacé clic para seleccionar el archivo Excel (.xlsx / .xls)'}
                </div>
                <span className="text-neutral-500 text-[11px]">
                  El archivo debe contener la hoja Control_Cierres con Fecha, Local y TOTAL DEL DÍA
                </span>
              </label>
            </div>
          )}

          {/* Spinner de procesamiento */}
          {isParsing && (
            <div className="p-8 bg-white rounded-xs border border-[#DCD4C9] text-center space-y-3">
              <Sparkles className="w-6 h-6 text-[#FDB813] animate-spin mx-auto" />
              <p className="font-bold text-sm text-[#18231C]">
                Leyendo hoja "Control_Cierres" y procesando filas...
              </p>
              <p className="text-xs text-neutral-500">
                Limpiando formato de moneda y preparando claves de actualización.
              </p>
            </div>
          )}

          {/* Vista Previa de Datos Extraídos */}
          {previewSales.length > 0 && !isParsing && (
            <div className="space-y-4 animate-fadeIn">
              {/* Tarjetas resumen de importación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xs border border-[#DCD4C9]">
                  <div className="flex items-center justify-between text-neutral-500 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Filas Extraídas</span>
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <p className="text-lg font-black text-[#18231C]">
                    {previewSales.length} registros
                  </p>
                  <span className="text-[10px] text-neutral-500">
                    Desde {minDate} hasta {maxDate}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xs border border-[#DCD4C9]">
                  <div className="flex items-center justify-between text-neutral-500 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Locales Detectados</span>
                    <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <p className="text-lg font-black text-[#18231C]">
                    {detectedBranches.length} locales
                  </p>
                  <span className="text-[10px] text-neutral-500 truncate block">
                    {detectedBranches.join(', ')}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xs border border-[#DCD4C9]">
                  <div className="flex items-center justify-between text-neutral-500 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Total Ventas</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-lg font-black text-emerald-700">
                    ${totalImportRevenue.toLocaleString('es-AR')}
                  </p>
                  <span className="text-[10px] text-neutral-500">
                    Suma total calculada
                  </span>
                </div>
              </div>

              {/* Tabla de Primeras Filas */}
              <div className="bg-white rounded-xs border border-[#DCD4C9] overflow-hidden">
                <div className="p-3 bg-[#FAF8F5] border-b border-[#DCD4C9] flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-[#18231C]">
                    Muestra de Cierres Diarios a Importar (Primeras 8 filas)
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Colección destino: <code>crm_sales</code>
                  </span>
                </div>

                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#18231C] text-white text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border-r border-neutral-700">Document ID (Fecha-Local)</th>
                        <th className="p-2 border-r border-neutral-700">Fecha (Col B)</th>
                        <th className="p-2 border-r border-neutral-700">Local (Col C)</th>
                        <th className="p-2 text-right">TOTAL DEL DÍA (Col K)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCD4C9]">
                      {previewSales.slice(0, 8).map((sale, idx) => (
                        <tr key={sale.id || idx} className="hover:bg-[#FAF8F5]">
                          <td className="p-2 font-mono text-[10px] text-neutral-600">
                            {sale.id}
                          </td>
                          <td className="p-2 font-medium">
                            {sale.date}
                          </td>
                          <td className="p-2 font-bold text-[#18231C]">
                            {sale.branch}
                          </td>
                          <td className="p-2 text-right font-black text-emerald-700">
                            ${sale.totalDaily.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white p-4 border-t border-[#DCD4C9] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving || isParsing || (!file && previewSales.length === 0)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 cursor-pointer disabled:opacity-40"
          >
            Limpiar selección
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold uppercase tracking-wider rounded-xs cursor-pointer"
            >
              Cancelar
            </button>

            {previewSales.length > 0 && (
              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={isSaving}
                className="px-5 py-2 bg-[#18231C] hover:bg-black text-[#FDB813] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-[#FDB813]" />
                    <span>Guardando en Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-[#FDB813]" />
                    <span>Confirmar e Importar ({previewSales.length} ventas)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
