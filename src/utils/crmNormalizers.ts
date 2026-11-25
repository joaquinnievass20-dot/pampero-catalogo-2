import { CRMOrder, LeadVisit, SupplierOrder } from '../types';
import { fixUtf8Encoding, sanitizeObjectEncoding } from './encodingUtils';

export function safeCellString(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    if (!isFinite(val)) return '';
    return Number.isInteger(val) ? String(val) : String(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'SI' : 'NO';
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      } catch {
        return '';
      }
    }
    return '';
  }
  return fixUtf8Encoding(String(val)).trim();
}

export function safeCellNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  let str = safeCellString(val).replace(/\$/g, '').trim();
  if (!str) return 0;
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
  str = str.replace(/[^0-9.-]/g, '');
  const n = parseFloat(str);
  return isFinite(n) ? n : 0;
}

export function sanitizeFirestoreDocId(raw: any, prefix: string, fallbackSeed?: string | number): string {
  const cleaned = safeCellString(raw)
    .replace(/[/\\?#\[\]]+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120)
    .trim();

  if (cleaned && cleaned !== '.' && cleaned !== '..') {
    return cleaned;
  }
  const seed = fallbackSeed !== undefined ? `${fallbackSeed}-` : '';
  return `${prefix}-${Date.now()}-${seed}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeLeadVisit(raw: any, indexFallback?: number): LeadVisit {
  const sanitized = raw && typeof raw === 'object' ? sanitizeObjectEncoding(raw) : {};
  const id = sanitizeFirestoreDocId(sanitized.id, 'vis', indexFallback);
  const col = safeCellString(
    sanitized.columnId || sanitized.step || sanitized.kanbanStep || sanitized.status
  );

  // Map status/column cleanly
  let resolvedStep = col || 'primer_contacto';
  if (resolvedStep === 'programada') resolvedStep = 'primer_contacto';
  else if (resolvedStep === 'realizada') resolvedStep = 'reunion';
  else if (resolvedStep === 'presupuesto_enviado') resolvedStep = 'previo_cotizacion';
  else if (resolvedStep === 'cerrada') resolvedStep = 'convertida';

  const statusValue =
    resolvedStep === 'convertida'
      ? 'cerrada'
      : resolvedStep === 'previo_cotizacion'
      ? 'presupuesto_enviado'
      : resolvedStep === 'reunion'
      ? 'realizada'
      : 'programada';

  const rawUnits = sanitized.estimatedUnits;
  const parsedUnits =
    rawUnits !== undefined && rawUnits !== null && rawUnits !== ''
      ? Math.max(0, Math.round(safeCellNumber(rawUnits)))
      : undefined;

  return {
    ...sanitized,
    id,
    trackingCode: safeCellString(sanitized.trackingCode) || undefined,
    date: safeCellString(sanitized.date) || new Date().toISOString().split('T')[0],
    companyName: safeCellString(sanitized.companyName) || 'Empresa',
    contactName: safeCellString(sanitized.contactName),
    phone: safeCellString(sanitized.phone),
    email: safeCellString(sanitized.email),
    companyLocation: safeCellString(sanitized.companyLocation) || undefined,
    locationUrl: safeCellString(sanitized.locationUrl) || undefined,
    seller: safeCellString(sanitized.seller) || 'Sin asignar',
    branch: safeCellString(sanitized.branch) || 'Maipú',
    status: (safeCellString(sanitized.status) || statusValue) as any,
    columnId: safeCellString(sanitized.columnId) || resolvedStep,
    step: safeCellString(sanitized.step) || resolvedStep,
    kanbanStep: safeCellString(sanitized.kanbanStep) || resolvedStep,
    objective: safeCellString(sanitized.objective),
    nextStep: safeCellString(sanitized.nextStep),
    nextStepDate: safeCellString(sanitized.nextStepDate),
    estimatedUnits: parsedUnits,
    notes: safeCellString(sanitized.notes),
    observationDate: safeCellString(sanitized.observationDate) || undefined,
    reminderDate: safeCellString(sanitized.reminderDate) || undefined,
    reminderTime: safeCellString(sanitized.reminderTime) || undefined,
    reminderNote: safeCellString(sanitized.reminderNote) || undefined,
    observationHistory: Array.isArray(sanitized.observationHistory) ? sanitized.observationHistory : undefined,
    originVisitId: safeCellString(sanitized.originVisitId) || undefined,
    createdAt: safeCellString(sanitized.createdAt) || new Date().toISOString(),
    updatedAt: safeCellString(sanitized.updatedAt) || new Date().toISOString(),
  } as LeadVisit;
}

export function normalizeCRMOrder(raw: any, indexFallback?: number): CRMOrder {
  const sanitized = raw && typeof raw === 'object' ? sanitizeObjectEncoding(raw) : {};
  const id = sanitizeFirestoreDocId(sanitized.id, 'ord', indexFallback);
  const statusStr = safeCellString(sanitized.status || sanitized.columnId || 'cotizacion') || 'cotizacion';

  return {
    ...sanitized,
    id,
    orderNumber: safeCellString(sanitized.orderNumber) || safeCellString(sanitized.trackingCode) || id,
    trackingCode: safeCellString(sanitized.trackingCode) || undefined,
    originVisitId: safeCellString(sanitized.originVisitId) || undefined,
    date: safeCellString(sanitized.date) || new Date().toISOString().split('T')[0],
    clientName: safeCellString(sanitized.clientName) || 'Cliente',
    clientPhone: safeCellString(sanitized.clientPhone),
    clientEmail: safeCellString(sanitized.clientEmail),
    clientType: sanitized.clientType === 'consumidor_final' ? 'consumidor_final' : 'empresa',
    nearestBranch: safeCellString(sanitized.nearestBranch) || undefined,
    companyLocation: safeCellString(sanitized.companyLocation) || undefined,
    locationUrl: safeCellString(sanitized.locationUrl) || undefined,
    status: statusStr as any,
    columnId: safeCellString(sanitized.columnId) || statusStr,
    seller: safeCellString(sanitized.seller) || 'Sin asignar',
    branch: safeCellString(sanitized.branch) || 'Maipú',
    totalUnits: Math.max(0, Math.round(safeCellNumber(sanitized.totalUnits))),
    totalEstimated: Math.max(0, Math.round(safeCellNumber(sanitized.totalEstimated))),
    observations: safeCellString(sanitized.observations),
    observationDate: safeCellString(sanitized.observationDate) || undefined,
    reminderDate: safeCellString(sanitized.reminderDate) || undefined,
    reminderTime: safeCellString(sanitized.reminderTime) || undefined,
    reminderNote: safeCellString(sanitized.reminderNote) || undefined,
    observationHistory: Array.isArray(sanitized.observationHistory) ? sanitized.observationHistory : undefined,
    shortages: Array.isArray(sanitized.shortages) ? sanitized.shortages : undefined,
    updatedAt: safeCellString(sanitized.updatedAt) || new Date().toISOString(),
  } as CRMOrder;
}

export function normalizeSupplierOrder(raw: any, indexFallback?: number): SupplierOrder {
  const sanitized = raw && typeof raw === 'object' ? sanitizeObjectEncoding(raw) : {};
  const id = sanitizeFirestoreDocId(sanitized.id, 'sup', indexFallback);
  const statusStr = (safeCellString(sanitized.status) || 'borrador') as any;

  return {
    ...sanitized,
    id,
    orderNumber: safeCellString(sanitized.orderNumber) || `PROV-${id.slice(-4)}`,
    supplierName: safeCellString(sanitized.supplierName) || 'Macata',
    orderDate: safeCellString(sanitized.orderDate) || new Date().toISOString().split('T')[0],
    estimatedArrivalDate: safeCellString(sanitized.estimatedArrivalDate),
    actualArrivalDate: safeCellString(sanitized.actualArrivalDate) || undefined,
    status: statusStr,
    itemsCount: Math.max(0, Math.round(safeCellNumber(sanitized.itemsCount))),
    totalAmount: Math.max(0, Math.round(safeCellNumber(sanitized.totalAmount))),
    itemsDescription: safeCellString(sanitized.itemsDescription),
    trackingNumber: safeCellString(sanitized.trackingNumber) || undefined,
    branchDestination: safeCellString(sanitized.branchDestination) || 'Maipú',
    responsibleStaff: safeCellString(sanitized.responsibleStaff) || 'Itatí',
    notes: safeCellString(sanitized.notes),
    createdAt: safeCellString(sanitized.createdAt) || new Date().toISOString(),
    updatedAt: safeCellString(sanitized.updatedAt) || new Date().toISOString(),
  } as SupplierOrder;
}
