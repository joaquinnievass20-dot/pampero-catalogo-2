import * as XLSX from 'xlsx';
import { doc, writeBatch } from 'firebase/firestore';
import { CRMOrder, LeadVisit, SupplierOrder } from '../types';
import {
  db,
  getFirebaseDb,
  getNextStructuredTrackingCode,
  parseExcelDate,
  saveCRMOrder,
  saveLeadVisit,
  saveSupplierOrder,
} from '../services/firebase';
import {
  normalizeCRMOrder,
  normalizeLeadVisit,
  normalizeSupplierOrder,
  safeCellNumber,
  safeCellString,
  sanitizeFirestoreDocId,
} from './crmNormalizers';

// ============================================================
// UTILIDADES COMPARTIDAS DE LECTURA INTELIGENTE DE EXCEL / CSV
// ============================================================

function normalizeHeaderKey(key: string): string {
  return safeCellString(key)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Busca una columna en la fila priorizando coincidencia exacta y luego coincidencia parcial.
 */
function getRowField(
  row: Record<string, any>,
  exactAliases: string[],
  partialAliases: string[] = []
): any {
  const keys = Object.keys(row);
  const normalizedPairs = keys.map((k) => ({
    rawKey: k,
    norm: normalizeHeaderKey(k),
  }));

  // 1. Coincidencia exacta
  for (const alias of exactAliases) {
    const normAlias = normalizeHeaderKey(alias);
    if (!normAlias) continue;
    const hit = normalizedPairs.find((p) => p.norm === normAlias);
    if (hit !== undefined && row[hit.rawKey] !== undefined && row[hit.rawKey] !== '') {
      return row[hit.rawKey];
    }
  }

  // 2. Coincidencia parcial
  const partials = partialAliases.length > 0 ? partialAliases : exactAliases;
  for (const alias of partials) {
    const normAlias = normalizeHeaderKey(alias);
    if (!normAlias || normAlias.length < 3) continue;
    const hit = normalizedPairs.find((p) => p.norm.includes(normAlias));
    if (hit !== undefined && row[hit.rawKey] !== undefined && row[hit.rawKey] !== '') {
      return row[hit.rawKey];
    }
  }

  return undefined;
}

/**
 * Lee un archivo Excel (.xlsx/.xls/.csv), detecta automáticamente la fila real de encabezados
 * (aun si existen filas de título o filas vacías arriba) y descarta filas vacías o de instrucciones.
 */
async function parseSpreadsheetSheet(
  file: File,
  headerHintTokens: string[]
): Promise<{ rows: Record<string, any>[]; sheetName: string }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas válidas.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error(`No se pudo leer la hoja "${firstSheetName}" del archivo.`);
  }

  const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  if (!matrix || matrix.length === 0) {
    throw new Error('La hoja del archivo Excel está vacía.');
  }

  const normalizedHints = headerHintTokens.map(normalizeHeaderKey).filter(Boolean);
  let headerRowIdx = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(12, matrix.length); r++) {
    const rowArr = Array.isArray(matrix[r]) ? matrix[r] : [];
    const nonEmptyCount = rowArr.filter((c) => safeCellString(c) !== '').length;
    if (nonEmptyCount === 0) continue;

    let score = 0;
    for (const cell of rowArr) {
      const normCell = normalizeHeaderKey(String(cell ?? ''));
      if (!normCell) continue;
      if (normalizedHints.some((h) => normCell === h || (h.length >= 4 && normCell.includes(h)))) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = r;
    }
  }

  // Fallback si ninguna fila matcheó hints: tomar primera fila con al menos 2 celdas no vacías
  if (bestScore <= 0) {
    const firstValid = matrix.findIndex(
      (rowArr) => Array.isArray(rowArr) && rowArr.filter((c) => safeCellString(c) !== '').length >= 2
    );
    headerRowIdx = firstValid >= 0 ? firstValid : 0;
  }

  const headerCells = (matrix[headerRowIdx] || []).map((h, colIdx) => {
    const label = safeCellString(h);
    return label || `COL_${colIdx + 1}`;
  });

  // Deduplicar nombres de columna repetidos
  const seenHeaders = new Map<string, number>();
  const uniqueHeaders = headerCells.map((h) => {
    const count = seenHeaders.get(h) || 0;
    seenHeaders.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });

  const rows: Record<string, any>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rowArr = matrix[r];
    if (!Array.isArray(rowArr)) continue;

    let hasAnyValue = false;
    const obj: Record<string, any> = {};

    for (let c = 0; c < uniqueHeaders.length; c++) {
      const val = c < rowArr.length ? rowArr[c] : '';
      if (val !== null && val !== undefined && safeCellString(val) !== '') {
        hasAnyValue = true;
      }
      obj[uniqueHeaders[c]] = val;
    }

    if (!hasAnyValue) continue;

    // Saltar filas de instrucciones de plantilla
    const firstValUpper = safeCellString(rowArr[0]).toUpperCase();
    if (firstValUpper.startsWith('INSTRUCCIONES')) continue;

    rows.push(obj);
  }

  return { rows, sheetName: firstSheetName };
}

async function commitDocsBatch(
  collectionName: string,
  items: Record<string, any>[],
  fallbackSave: (item: any) => Promise<any>
): Promise<void> {
  const firestoreDb = db || getFirebaseDb();
  if (!firestoreDb) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(firestoreDb);
      for (const item of chunk) {
        const docId = sanitizeFirestoreDocId(item.id, 'doc');
        const docRef = doc(firestoreDb, collectionName, docId);
        const cleaned = JSON.parse(
          JSON.stringify({ ...item, id: docId }, (_, v) => (v === undefined ? null : v))
        );
        batch.set(docRef, cleaned, { merge: true });
      }
      await batch.commit();
    } catch (batchErr) {
      console.warn(`[EXCEL BATCH] Fallback individual en ${collectionName}:`, batchErr);
      await Promise.allSettled(chunk.map((item) => fallbackSave(item)));
    }
  }
}

// ============================================================
// 1. KANBAN SEGUIMIENTO EMPRESAS (CRM ORDERS)
// ============================================================

export function exportOrdersToExcel(orders: CRMOrder[]): void {
  const rows = orders.map((raw) => {
    const o = normalizeCRMOrder(raw);
    return {
      'Número de Pedido': o.orderNumber || o.trackingCode || o.id,
      'N° Seguimiento': o.trackingCode || o.orderNumber || o.id,
      'ID Sistema': o.id,
      'Cliente / Razón Social': o.clientName,
      'Tipo Cliente': o.clientType === 'empresa' ? 'Empresa' : 'Consumidor Final',
      'Estado / Columna': o.status || o.columnId || 'cotizacion',
      'Vendedor Asignado': o.seller || '',
      'Sucursal': o.branch || '',
      'Ubicación Empresa': o.companyLocation || '',
      'Link Mapa': o.locationUrl || '',
      'Total Unidades': o.totalUnits || 0,
      'Total Estimado ($)': o.totalEstimated || 0,
      'Fecha': o.date || '',
      'Teléfono': o.clientPhone || '',
      'Email': o.clientEmail || '',
      'Canal': o.channel || 'Web',
      'Días Demora': o.delayDays || 0,
      'Observaciones': o.observations || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguimiento Empresas');
  XLSX.writeFile(
    workbook,
    `Pampero_Seguimiento_Empresas_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}

export async function importOrdersFromExcel(
  file: File,
  currentOrders: CRMOrder[]
): Promise<{ updatedCount: number; newCount: number; orders: CRMOrder[] }> {
  const { rows: rawRows } = await parseSpreadsheetSheet(file, [
    'Numero de Pedido',
    'Nro Seguimiento',
    'ID Sistema',
    'Cliente',
    'Razon Social',
    'Estado',
    'Vendedor',
    'Sucursal',
    'Ubicacion',
    'Unidades',
    'Total Estimado',
    'Telefono',
  ]);

  if (rawRows.length === 0) {
    throw new Error('No se encontraron filas de datos válidas en el archivo Excel.');
  }

  let updatedCount = 0;
  let newCount = 0;
  const resultingOrders: CRMOrder[] = currentOrders.map((o, idx) => normalizeCRMOrder(o, idx));
  const toPersist: CRMOrder[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rawOrderNum = safeCellString(
      getRowField(row, ['Número de Pedido', 'Numero de Pedido', 'Nro Pedido', 'N° Seguimiento', 'Nro Seguimiento', 'Pedido'], ['pedido', 'seguimiento'])
    );
    const rawTracking = safeCellString(
      getRowField(row, ['N° Seguimiento', 'Nro Seguimiento', 'Tracking'], ['seguimiento', 'tracking'])
    );
    const rawId = safeCellString(getRowField(row, ['ID Sistema', 'ID'], []));
    const clientName = safeCellString(
      getRowField(
        row,
        ['Cliente / Razón Social', 'Cliente', 'Razón Social', 'Razon Social', 'Empresa', 'Nombre'],
        ['cliente', 'razonsocial', 'empresa']
      )
    );

    if (!clientName && !rawOrderNum && !rawId) continue;

    const orderKey = rawOrderNum.toLowerCase();
    const idKey = rawId ? sanitizeFirestoreDocId(rawId, 'ord', idx) : '';

    const matchedIndex = resultingOrders.findIndex(
      (o) =>
        (idKey && o.id === idKey) ||
        (orderKey && o.orderNumber && safeCellString(o.orderNumber).toLowerCase() === orderKey)
    );

    const statusVal = safeCellString(
      getRowField(row, ['Estado / Columna', 'Estado', 'Columna', 'Etapa', 'Fase'], ['estado', 'columna', 'etapa'])
    ).toLowerCase();

    let normalizedStatus: any = 'cotizacion';
    if (statusVal.includes('seña') || statusVal.includes('sena') || statusVal.includes('50')) normalizedStatus = 'sena_50';
    else if (statusVal.includes('producc') || statusVal.includes('taller') || statusVal.includes('bordad')) normalizedStatus = 'produccion';
    else if (statusVal.includes('listo')) normalizedStatus = 'listo';
    else if (statusVal.includes('entreg')) normalizedStatus = 'entregado';
    else if (statusVal.includes('cancel')) normalizedStatus = 'cancelado';
    else if (statusVal.includes('cotiz') || !statusVal) normalizedStatus = 'cotizacion';

    const totalUnits = Math.round(
      safeCellNumber(getRowField(row, ['Total Unidades', 'Unidades', 'Cantidad', 'Prendas'], ['unidad', 'cantidad']))
    );
    const totalEstimated = Math.round(
      safeCellNumber(
        getRowField(row, ['Total Estimado ($)', 'Total Estimado', 'Monto', 'Total', 'Importe'], ['estimado', 'monto', 'importe'])
      )
    );
    const seller = safeCellString(
      getRowField(row, ['Vendedor Asignado', 'Vendedor', 'Asesor', 'Responsable'], ['vendedor', 'asesor'])
    );
    const branch = safeCellString(
      getRowField(row, ['Sucursal', 'Local', 'Sede'], ['sucursal', 'local'])
    );
    const companyLocation = safeCellString(
      getRowField(row, ['Ubicación Empresa', 'Ubicación / Zona', 'Ubicación', 'Ubicacion', 'Dirección', 'Direccion', 'Zona'], ['ubicacion', 'direccion'])
    );
    const locationUrl = safeCellString(
      getRowField(row, ['Link Mapa', 'Google Maps', 'Mapa', 'URL Mapa'], ['mapa'])
    );
    const observations = safeCellString(
      getRowField(row, ['Observaciones', 'Notas', 'Detalle', 'Comentarios'], ['observacion', 'nota'])
    );
    const clientPhone = safeCellString(
      getRowField(row, ['Teléfono', 'Telefono', 'Tel', 'Celular', 'WhatsApp'], ['telefon', 'celular', 'whatsapp'])
    );
    const clientEmail = safeCellString(
      getRowField(row, ['Email', 'Correo', 'Mail'], ['email', 'correo'])
    );
    const rawDate = getRowField(row, ['Fecha'], ['fecha']);
    const dateVal = parseExcelDate(rawDate) || safeCellString(rawDate) || new Date().toISOString().split('T')[0];

    if (matchedIndex >= 0) {
      const existing = resultingOrders[matchedIndex];
      const updated = normalizeCRMOrder({
        ...existing,
        clientName: clientName || existing.clientName,
        trackingCode: rawTracking || existing.trackingCode,
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        totalUnits: totalUnits || existing.totalUnits,
        totalEstimated: totalEstimated || existing.totalEstimated,
        seller: seller || existing.seller,
        branch: branch || existing.branch,
        companyLocation: companyLocation || existing.companyLocation,
        locationUrl: locationUrl || existing.locationUrl,
        observations: observations || existing.observations,
        clientPhone: clientPhone || existing.clientPhone,
        clientEmail: clientEmail || existing.clientEmail,
        date: dateVal || existing.date,
        updatedAt: new Date().toISOString(),
      });
      resultingOrders[matchedIndex] = updated;
      toPersist.push(updated);
      updatedCount++;
    } else {
      const newId = idKey || sanitizeFirestoreDocId('', 'ord', idx);
      const resolvedBranch = branch || 'Maipú';
      const generatedTracking = rawTracking || rawOrderNum || await getNextStructuredTrackingCode('empresa', resolvedBranch);
      const newCard = normalizeCRMOrder({
        id: newId,
        orderNumber: generatedTracking,
        trackingCode: generatedTracking,
        date: dateVal,
        clientName: clientName || 'Empresa',
        clientType: 'empresa',
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        seller: seller || 'Sin asignar',
        branch: resolvedBranch,
        nearestBranch: resolvedBranch,
        companyLocation: companyLocation || undefined,
        locationUrl: locationUrl || undefined,
        totalUnits,
        totalEstimated,
        observations,
        clientPhone,
        clientEmail,
        channel: 'Excel',
        updatedAt: new Date().toISOString(),
      });
      resultingOrders.unshift(newCard);
      toPersist.push(newCard);
      newCount++;
    }
  }

  if (toPersist.length === 0) {
    throw new Error(
      'No se encontraron filas válidas para importar. Verificá que la planilla tenga una columna "Cliente" o "Empresa".'
    );
  }

  try {
    localStorage.setItem('pampero_crm_orders', JSON.stringify(resultingOrders));
  } catch {}

  await commitDocsBatch('crm_orders', toPersist, saveCRMOrder);
  return { updatedCount, newCount, orders: resultingOrders };
}

// ============================================================
// 2. KANBAN VISITAS COMERCIALES (LEAD VISITS)
// ============================================================

export function exportVisitsToExcel(visits: LeadVisit[]): void {
  const rows = visits.map((raw) => {
    const v = normalizeLeadVisit(raw);
    return {
      'ID Visita': v.id,
      'N° Seguimiento': v.trackingCode || '',
      'Empresa': v.companyName,
      'Contacto': v.contactName,
      'Teléfono': v.phone || '',
      'Email': v.email || '',
      'Ubicación / Zona': v.companyLocation || '',
      'Link Mapa': v.locationUrl || '',
      'Vendedor': v.seller || '',
      'Sucursal': v.branch || '',
      'Fase / Columna': v.columnId || v.status || 'primer_contacto',
      'Fecha': v.date || '',
      'Unidades Estimadas': v.estimatedUnits || 0,
      'Objetivo': v.objective || '',
      'Próximo Paso': v.nextStep || '',
      'Fecha Próximo Paso': v.nextStepDate || '',
      'Notas': v.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitas Comerciales');
  XLSX.writeFile(
    workbook,
    `Pampero_Visitas_Comerciales_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}

function resolveVisitStepFromExcel(
  rawPhase: string,
  customColumns?: { id: string; label: string }[]
): string {
  const val = safeCellString(rawPhase).toLowerCase();
  if (!val) return customColumns?.[0]?.id || 'primer_contacto';

  if (customColumns && customColumns.length > 0) {
    const exactId = customColumns.find((c) => safeCellString(c.id).toLowerCase() === val);
    if (exactId) return exactId.id;

    const cleanVal = normalizeHeaderKey(val);
    const byLabel = customColumns.find((c) => {
      const normLabel = normalizeHeaderKey(c.label);
      return normLabel === cleanVal || (cleanVal.length >= 4 && normLabel.includes(cleanVal));
    });
    if (byLabel) return byLabel.id;
  }

  if (val.includes('reun') || val.includes('visita') || val === 'realizada') return 'reunion';
  if (val.includes('previo') || val.includes('cotiz') || val === 'presupuesto_enviado') return 'previo_cotizacion';
  if (val.includes('convert') || val.includes('seguid') || val.includes('cerrad') || val.includes('pasado')) return 'convertida';
  if (val.includes('primer') || val.includes('contacto') || val === 'programada') return 'primer_contacto';

  return customColumns?.[0]?.id || 'primer_contacto';
}

export async function importVisitsFromExcel(
  file: File,
  currentVisits: LeadVisit[],
  customColumns?: { id: string; label: string }[]
): Promise<{ updatedCount: number; newCount: number; visits: LeadVisit[] }> {
  const { rows: rawRows } = await parseSpreadsheetSheet(file, [
    'ID Visita',
    'Empresa',
    'Razon Social',
    'Cliente',
    'Contacto',
    'Telefono',
    'Celular',
    'Email',
    'Vendedor',
    'Sucursal',
    'Local',
    'Fase',
    'Columna',
    'Estado',
    'Objetivo',
    'Proximo Paso',
    'Notas',
  ]);

  if (rawRows.length === 0) {
    throw new Error('El archivo Excel no contiene filas de datos válidas.');
  }

  let updatedCount = 0;
  let newCount = 0;
  const resultingVisits: LeadVisit[] = currentVisits.map((v, idx) => normalizeLeadVisit(v, idx));
  const toPersist: LeadVisit[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rawId = safeCellString(getRowField(row, ['ID Visita', 'ID Sistema', 'ID'], []));
    const rawTracking = safeCellString(
      getRowField(row, ['N° Seguimiento', 'Nro Seguimiento', 'Tracking'], ['seguimiento', 'tracking'])
    );
    const company = safeCellString(
      getRowField(
        row,
        [
          'Empresa',
          'Razón Social',
          'Razon Social',
          'Nombre Empresa',
          'Nombre de Empresa',
          'Cliente',
          'Compañía',
          'Compania',
          'Organización',
          'Organizacion',
        ],
        ['empresa', 'razonsocial', 'cliente']
      )
    );
    const contactName = safeCellString(
      getRowField(
        row,
        ['Contacto', 'Nombre Contacto', 'Referente', 'Persona de Contacto', 'Encargado'],
        ['contacto', 'referente']
      )
    );
    const phone = safeCellString(
      getRowField(
        row,
        ['Teléfono', 'Telefono', 'Tel', 'Celular', 'Móvil', 'Movil', 'WhatsApp', 'Numero'],
        ['telefon', 'celular', 'whatsapp', 'movil']
      )
    );
    const email = safeCellString(
      getRowField(row, ['Email', 'Correo', 'Mail', 'E-mail'], ['email', 'correo', 'mail'])
    );

    // Si la fila no tiene ni empresa ni contacto ni teléfono ni email, omitir fila basura
    if (!company && !contactName && !phone && !email) continue;

    const safeIdCandidate = rawId ? sanitizeFirestoreDocId(rawId, 'vis', idx) : '';
    const companyLow = company.toLowerCase();

    const matchedIndex = resultingVisits.findIndex(
      (v) =>
        (safeIdCandidate && v.id === safeIdCandidate) ||
        (companyLow && safeCellString(v.companyName).toLowerCase() === companyLow)
    );

    const statusRaw = safeCellString(
      getRowField(
        row,
        ['Fase / Columna', 'Columna', 'Fase', 'Etapa', 'Estado', 'Paso'],
        ['fase', 'columna', 'etapa', 'estado']
      )
    );
    const resolvedStep = resolveVisitStepFromExcel(statusRaw, customColumns);
    const normalizedStatus =
      resolvedStep === 'convertida'
        ? 'cerrada'
        : resolvedStep === 'previo_cotizacion'
        ? 'presupuesto_enviado'
        : resolvedStep === 'reunion'
        ? 'realizada'
        : 'programada';

    const seller = safeCellString(
      getRowField(row, ['Vendedor', 'Asesor', 'Comercial', 'Responsable'], ['vendedor', 'asesor'])
    );
    const branch = safeCellString(
      getRowField(row, ['Sucursal', 'Local', 'Sede'], ['sucursal', 'local'])
    );
    const companyLocation = safeCellString(
      getRowField(row, ['Ubicación / Zona', 'Ubicación Empresa', 'Ubicación', 'Ubicacion', 'Dirección', 'Direccion', 'Zona'], ['ubicacion', 'direccion'])
    );
    const locationUrl = safeCellString(
      getRowField(row, ['Link Mapa', 'Google Maps', 'Mapa', 'URL Mapa'], ['mapa'])
    );
    const estimatedUnitsRaw = getRowField(
      row,
      ['Unidades Estimadas', 'Unidades', 'Cantidad', 'Prendas', 'Empleados'],
      ['unidad', 'cantidad', 'prenda']
    );
    const estimatedUnits = estimatedUnitsRaw !== undefined && estimatedUnitsRaw !== ''
      ? Math.max(0, Math.round(safeCellNumber(estimatedUnitsRaw)))
      : undefined;

    const objective = safeCellString(
      getRowField(row, ['Objetivo', 'Rubro', 'Motivo', 'Actividad', 'Requerimiento'], ['objetivo', 'rubro', 'motivo'])
    );
    const nextStep = safeCellString(
      getRowField(row, ['Próximo Paso', 'Proximo Paso', 'Seguimiento', 'Acción'], ['proximopaso', 'seguimiento'])
    );
    const nextStepDateRaw = getRowField(row, ['Fecha Próximo Paso', 'Fecha Proximo Paso'], []);
    const nextStepDate = parseExcelDate(nextStepDateRaw) || safeCellString(nextStepDateRaw);
    const notes = safeCellString(
      getRowField(row, ['Notas', 'Observaciones', 'Comentarios', 'Detalle'], ['nota', 'observacion', 'comentario'])
    );
    const rawDate = getRowField(row, ['Fecha', 'Fecha Visita', 'Fecha Contacto'], ['fecha']);
    const dateVal = parseExcelDate(rawDate) || safeCellString(rawDate) || new Date().toISOString().split('T')[0];

    if (matchedIndex >= 0) {
      const existing = resultingVisits[matchedIndex];
      const updated = normalizeLeadVisit({
        ...existing,
        trackingCode: rawTracking || existing.trackingCode,
        companyName: company || existing.companyName,
        contactName: contactName || existing.contactName,
        phone: phone || existing.phone,
        email: email || existing.email,
        companyLocation: companyLocation || existing.companyLocation,
        locationUrl: locationUrl || existing.locationUrl,
        seller: seller || existing.seller,
        branch: branch || existing.branch,
        status: normalizedStatus,
        columnId: resolvedStep,
        step: resolvedStep,
        kanbanStep: resolvedStep,
        date: dateVal || existing.date,
        estimatedUnits: estimatedUnits !== undefined ? estimatedUnits : existing.estimatedUnits,
        objective: objective || existing.objective,
        nextStep: nextStep || existing.nextStep,
        nextStepDate: nextStepDate || existing.nextStepDate,
        notes: notes || existing.notes,
        updatedAt: new Date().toISOString(),
      });
      resultingVisits[matchedIndex] = updated;
      toPersist.push(updated);
      updatedCount++;
    } else {
      const newId = safeIdCandidate || sanitizeFirestoreDocId('', 'vis', idx);
      const resolvedBranch = branch || 'Maipú';
      const generatedTracking = rawTracking || await getNextStructuredTrackingCode('empresa', resolvedBranch);
      const newVisit = normalizeLeadVisit({
        id: newId,
        trackingCode: generatedTracking,
        date: dateVal,
        companyName: company || contactName || 'Nueva Empresa',
        contactName,
        phone,
        email,
        companyLocation: companyLocation || undefined,
        locationUrl: locationUrl || undefined,
        seller: seller || 'Sin asignar',
        branch: resolvedBranch,
        status: normalizedStatus,
        columnId: resolvedStep,
        step: resolvedStep,
        kanbanStep: resolvedStep,
        estimatedUnits,
        objective,
        nextStep,
        nextStepDate,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      resultingVisits.unshift(newVisit);
      toPersist.push(newVisit);
      newCount++;
    }
  }

  if (toPersist.length === 0) {
    throw new Error(
      'No se detectaron empresas válidas en el Excel. Verificá que la planilla tenga al menos la columna "Empresa" (o "Razón Social" / "Cliente") y filas con datos.'
    );
  }

  try {
    localStorage.setItem('pampero_lead_visits', JSON.stringify(resultingVisits));
  } catch {}

  await commitDocsBatch('crm_leads_visitas', toPersist, saveLeadVisit);
  return { updatedCount, newCount, visits: resultingVisits };
}

// ============================================================
// 3. PEDIDOS A PROVEEDORES (SUPPLIER ORDERS)
// ============================================================

export function exportSupplierOrdersToExcel(orders: SupplierOrder[]): void {
  const rows = orders.map((raw) => {
    const o = normalizeSupplierOrder(raw);
    return {
      'Nro Pedido': o.orderNumber || o.id,
      'ID Sistema': o.id,
      'Proveedor': o.supplierName,
      'Fecha Pedido': o.orderDate || '',
      'Fecha Estimada Llegada': o.estimatedArrivalDate || '',
      'Fecha Llegada Real': o.actualArrivalDate || '',
      'Estado': o.status || 'borrador',
      'Cantidad Ítems': o.itemsCount || 0,
      'Monto Total ($)': o.totalAmount || 0,
      'Descripción Ítems': o.itemsDescription || '',
      'Nro Seguimiento': o.trackingNumber || '',
      'Sucursal Destino': o.branchDestination || '',
      'Responsable': o.responsibleStaff || '',
      'Notas': o.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos Proveedores');
  XLSX.writeFile(
    workbook,
    `Pampero_Pedidos_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}

export async function importSupplierOrdersFromExcel(
  file: File,
  currentOrders: SupplierOrder[]
): Promise<{ updatedCount: number; newCount: number; orders: SupplierOrder[] }> {
  const { rows: rawRows } = await parseSpreadsheetSheet(file, [
    'Nro Pedido',
    'ID Sistema',
    'Proveedor',
    'Fecha Pedido',
    'Estado',
    'Cantidad Items',
    'Monto Total',
    'Sucursal Destino',
    'Responsable',
  ]);

  if (rawRows.length === 0) {
    throw new Error('No se encontraron filas de datos válidas en el archivo Excel.');
  }

  let updatedCount = 0;
  let newCount = 0;
  const resultingOrders: SupplierOrder[] = currentOrders.map((o, idx) => normalizeSupplierOrder(o, idx));
  const toPersist: SupplierOrder[] = [];

  rawRows.forEach((row, idx) => {
    const rawOrderNum = safeCellString(
      getRowField(row, ['Nro Pedido', 'Numero Pedido', 'Orden', 'N° Orden', 'Pedido'], ['orden', 'pedido'])
    );
    const rawId = safeCellString(getRowField(row, ['ID Sistema', 'ID'], []));
    const supplierName = safeCellString(getRowField(row, ['Proveedor', 'Fábrica', 'Fabrica'], ['proveedor']));

    if (!rawOrderNum && !rawId && !supplierName) return;

    const safeIdCandidate = rawId ? sanitizeFirestoreDocId(rawId, 'sup', idx) : '';
    const orderKey = rawOrderNum.toLowerCase();

    const matchedIndex = resultingOrders.findIndex(
      (o) =>
        (safeIdCandidate && o.id === safeIdCandidate) ||
        (orderKey && safeCellString(o.orderNumber).toLowerCase() === orderKey)
    );

    const statusVal = safeCellString(getRowField(row, ['Estado'], ['estado'])).toLowerCase();
    let normalizedStatus: any = 'borrador';
    if (statusVal.includes('env')) normalizedStatus = 'enviado';
    else if (statusVal.includes('fab') || statusVal.includes('prod')) normalizedStatus = 'en_fabricacion';
    else if (statusVal.includes('despach') || statusVal.includes('trans')) normalizedStatus = 'despachado';
    else if (statusVal.includes('complet')) normalizedStatus = 'recibido_completo';
    else if (statusVal.includes('incomplet')) normalizedStatus = 'recibido_incompleto';

    const itemsCount = Math.round(
      safeCellNumber(getRowField(row, ['Cantidad Ítems', 'Cantidad Items', 'Items', 'Unidades', 'Prendas'], ['item', 'unidad']))
    );
    const totalAmount = Math.round(
      safeCellNumber(getRowField(row, ['Monto Total ($)', 'Monto Total', 'Total', 'Costo', 'Importe'], ['monto', 'total', 'costo']))
    );
    const itemsDescription = safeCellString(
      getRowField(row, ['Descripción Ítems', 'Descripcion Items', 'Descripción', 'Descripcion', 'Detalle'], ['descripcion', 'detalle'])
    );
    const trackingNumber = safeCellString(
      getRowField(row, ['Nro Seguimiento', 'Tracking', 'Guía', 'Guia'], ['seguimiento', 'tracking', 'guia'])
    );
    const branchDestination = safeCellString(
      getRowField(row, ['Sucursal Destino', 'Sucursal', 'Destino', 'Local'], ['sucursal', 'destino'])
    );
    const responsibleStaff = safeCellString(
      getRowField(row, ['Responsable', 'Vendedor', 'Encargado'], ['responsable'])
    );
    const notes = safeCellString(getRowField(row, ['Notas', 'Observaciones'], ['nota', 'observacion']));

    const rawOrderDate = getRowField(row, ['Fecha Pedido', 'Fecha'], []);
    const rawEstArrival = getRowField(row, ['Fecha Estimada Llegada', 'Llegada Estimada'], []);
    const rawActualArrival = getRowField(row, ['Fecha Llegada Real', 'Llegada Real'], []);

    const orderDate = parseExcelDate(rawOrderDate) || safeCellString(rawOrderDate) || new Date().toISOString().split('T')[0];
    const estimatedArrivalDate = parseExcelDate(rawEstArrival) || safeCellString(rawEstArrival);
    const actualArrivalDate = parseExcelDate(rawActualArrival) || safeCellString(rawActualArrival);

    if (matchedIndex >= 0) {
      const existing = resultingOrders[matchedIndex];
      const updated = normalizeSupplierOrder({
        ...existing,
        supplierName: supplierName || existing.supplierName,
        status: normalizedStatus,
        itemsCount: itemsCount || existing.itemsCount,
        totalAmount: totalAmount || existing.totalAmount,
        itemsDescription: itemsDescription || existing.itemsDescription,
        trackingNumber: trackingNumber || existing.trackingNumber,
        branchDestination: branchDestination || existing.branchDestination,
        responsibleStaff: responsibleStaff || existing.responsibleStaff,
        orderDate: orderDate || existing.orderDate,
        estimatedArrivalDate: estimatedArrivalDate || existing.estimatedArrivalDate,
        actualArrivalDate: actualArrivalDate || existing.actualArrivalDate,
        notes: notes || existing.notes,
        updatedAt: new Date().toISOString(),
      });
      resultingOrders[matchedIndex] = updated;
      toPersist.push(updated);
      updatedCount++;
    } else {
      const newId = safeIdCandidate || sanitizeFirestoreDocId('', 'sup', idx);
      const newOrder = normalizeSupplierOrder({
        id: newId,
        orderNumber: rawOrderNum || `PROV-${Date.now().toString().slice(-4)}-${idx + 1}`,
        supplierName: supplierName || 'Macata',
        status: normalizedStatus,
        itemsCount,
        totalAmount,
        itemsDescription,
        trackingNumber: trackingNumber || undefined,
        branchDestination: branchDestination || 'Maipú',
        responsibleStaff: responsibleStaff || 'Itatí',
        orderDate,
        estimatedArrivalDate,
        actualArrivalDate: actualArrivalDate || undefined,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      resultingOrders.unshift(newOrder);
      toPersist.push(newOrder);
      newCount++;
    }
  });

  if (toPersist.length === 0) {
    throw new Error('No se detectaron órdenes de proveedor válidas en el archivo Excel.');
  }

  try {
    localStorage.setItem('pampero_supplier_orders', JSON.stringify(resultingOrders));
  } catch {}

  await commitDocsBatch('crm_pedidos_proveedor', toPersist, saveSupplierOrder);
  return { updatedCount, newCount, orders: resultingOrders };
}
