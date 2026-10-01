import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { CRMOrder, CRMOrderStatus } from '../../types';
import { saveCRMOrder } from '../../services/firebase';
import { DynamicBoardColumn } from './CRMView';

interface CRMExcelImportModalProps {
  boardColumns: DynamicBoardColumn[];
  onClose: () => void;
  onImported: (newOrders: CRMOrder[]) => void;
}

export const CRMExcelImportModal: React.FC<CRMExcelImportModalProps> = ({
  boardColumns,
  onClose,
  onImported,
}) => {
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedOrders, setParsedOrders] = useState<CRMOrder[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Helper to extract values by varying column names
  const getField = (row: any, keys: string[]): string => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      // Also check lowercase trimmed matching
      const foundKey = Object.keys(row).find(
        (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setErrorMsg(null);
    setParsedOrders([]);
    setImportedCount(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!json || json.length === 0) {
        setErrorMsg('La planilla de cálculo no contiene filas con datos válidos.');
        setIsProcessing(false);
        return;
      }

      const list: CRMOrder[] = [];
      let count = 0;
      const initialStepId = (boardColumns[0]?.id || 'cotizacion') as CRMOrderStatus;

      for (const row of json) {
        const clientName = getField(row, [
          'Empresa',
          'Razón Social',
          'Razon Social',
          'Cliente',
          'Nombre',
          'Compañía',
          'Cuenta'
        ]);

        if (!clientName) continue;

        count++;
        // Respect SKU / order number if provided in spreadsheet
        const rawCode = getField(row, [
          'Pedido',
          'Nro Pedido',
          'Cotización',
          'Cotizacion',
          'Código',
          'Codigo',
          'ID',
          'SKU',
          'Nro'
        ]);

        const orderId = rawCode || `COT-${Date.now().toString().slice(-6)}-${count}`;
        const rawSeller = getField(row, ['Vendedora', 'Vendedor', 'Asesor', 'Operador']);
        const rawBranch = getField(row, ['Sucursal', 'Local', 'Filial']);
        const rawUnits = getField(row, ['Prendas', 'Unidades', 'Cantidad', 'Cant']);
        const rawAmount = getField(row, ['Monto', 'Total', 'Precio', 'Importe', 'Presupuesto']);
        const rawStatus = getField(row, ['Estado', 'Paso', 'Fase', 'Status']).toLowerCase();
        const rawObservations = getField(row, ['Observaciones', 'Notas', 'Detalle', 'Comentarios']);
        const rawDate = getField(row, ['Fecha', 'Dia', 'Date']) || new Date().toISOString();

        // Match status to available board columns
        let matchedStatus: CRMOrderStatus = initialStepId;
        if (rawStatus) {
          const colMatch = boardColumns.find(
            (c) => c.id.toLowerCase() === rawStatus || c.label.toLowerCase().includes(rawStatus)
          );
          if (colMatch) {
            matchedStatus = colMatch.id as CRMOrderStatus;
          }
        }

        const newOrder: CRMOrder = {
          id: orderId,
          quoteId: orderId,
          date: rawDate,
          clientName: clientName,
          clientType: 'empresa',
          status: matchedStatus,
          seller: rawSeller || 'Itatí',
          branch: rawBranch || 'Maipú',
          totalUnits: Number(rawUnits.replace(/[^0-9]/g, '')) || 20,
          totalEstimated: Number(rawAmount.replace(/[^0-9.]/g, '')) || 0,
          observations: rawObservations ? `[Importado Excel] ${rawObservations}` : 'Importado masivamente vía Excel',
          updatedAt: new Date().toISOString(),
        };

        list.push(newOrder);
      }

      if (list.length === 0) {
        setErrorMsg('No se detectaron registros con columna de Empresa o Razón Social.');
      } else {
        setParsedOrders(list);
      }
    } catch (err: any) {
      console.error('Error procesando archivo Excel:', err);
      setErrorMsg('No se pudo procesar el archivo. Verificá que sea un formato Excel válido (.xlsx o .csv).');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedOrders.length === 0) return;

    setIsProcessing(true);
    try {
      for (const ord of parsedOrders) {
        await saveCRMOrder(ord);
      }
      setImportedCount(parsedOrders.length);
      setTimeout(() => {
        onImported(parsedOrders);
      }, 1000);
    } catch (err) {
      console.error('Error guardando pedidos importados:', err);
      setErrorMsg('Hubo un inconveniente al registrar los pedidos en la base de datos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white border-b border-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#1E7145] text-white rounded-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base uppercase tracking-wider text-white">
                Carga Masiva de Empresas · Seguimiento CRM
              </h3>
              <p className="text-[11px] text-[#DCD4C9]/70">
                Importá clientes y pedidos automáticamente desde una planilla de Excel (.xlsx o .csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Instructions Box */}
          <div className="p-3.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs space-y-1.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              Columnas admitidas en la planilla:
            </h4>
            <p className="text-[11px] text-[#6F6860] leading-relaxed">
              <strong>Empresa / Razón Social</strong> (obligatorio), <strong>Pedido / Cotización</strong> (se respeta exactamente el código del Excel sin generar IDs al azar), <strong>Vendedor</strong>, <strong>Sucursal</strong>, <strong>Prendas</strong>, <strong>Monto</strong>, <strong>Observaciones</strong>.
            </p>
          </div>

          {/* Upload Area */}
          <label className="border-2 border-dashed border-[#DCD4C9] hover:border-[#18231C] bg-[#FAF8F5]/50 p-6 rounded-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
            <Upload className="w-7 h-7 text-[#6F6860] group-hover:scale-110 group-hover:text-[#18231C] transition-all" />
            <span className="font-bold text-xs text-[#18231C] uppercase tracking-wider">
              {isProcessing ? 'Procesando archivo...' : 'Seleccionar o arrastrar archivo Excel (.xlsx / .csv)'}
            </span>
            <span className="text-[11px] text-[#6F6860]">
              {fileName ? `Archivo: ${fileName}` : 'Hacé clic para explorar tus archivos'}
            </span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              disabled={isProcessing}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xs text-red-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {importedCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">
                ¡Se importaron {importedCount} pedidos correctamente al tablero de Seguimiento Empresas!
              </span>
            </div>
          )}

          {/* Preview Table of Parsed Rows */}
          {parsedOrders.length > 0 && importedCount === null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                  Vista Previa ({parsedOrders.length} empresas encontradas):
                </span>
                <span className="text-[11px] text-[#6F6860]">
                  Mostrando primeros registros
                </span>
              </div>

              <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs max-h-56">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold border-b border-[#DCD4C9]">
                    <tr>
                      <th className="p-2">Cód. Pedido</th>
                      <th className="p-2">Empresa</th>
                      <th className="p-2">Vendedor</th>
                      <th className="p-2">Sucursal</th>
                      <th className="p-2 text-center">Prendas</th>
                      <th className="p-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4C9]">
                    {parsedOrders.slice(0, 8).map((ord, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]">
                        <td className="p-2 font-mono font-bold text-[#B9522F]">{ord.id}</td>
                        <td className="p-2 font-medium text-[#18231C]">{ord.clientName}</td>
                        <td className="p-2 text-[#4A453F]">{ord.seller}</td>
                        <td className="p-2 text-[#4A453F]">{ord.branch}</td>
                        <td className="p-2 text-center font-bold text-[#18231C]">{ord.totalUnits}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">
                          ${ord.totalEstimated.toLocaleString('es-AR')}
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
        <div className="p-4 border-t border-[#DCD4C9] bg-[#FAF8F5] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#6F6860] hover:text-[#18231C] transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {parsedOrders.length > 0 && importedCount === null && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmImport}
              className="px-6 py-2.5 bg-[#1E7145] hover:bg-[#155734] text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Confirmar e Importar {parsedOrders.length} Empresas</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
