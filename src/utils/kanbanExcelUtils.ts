import * as XLSX from 'xlsx';
import { CRMOrder, LeadVisit, SupplierOrder } from '../types';
import { 
  saveCRMOrder, 
  saveLeadVisit, 
  saveSupplierOrder 
} from '../services/firebase';

// ============================================================
// 1. KANBAN SEGUIMIENTO EMPRESAS (CRM ORDERS)
// ============================================================

export function exportOrdersToExcel(orders: CRMOrder[]): void {
  const rows = orders.map((o) => ({
    'Número de Pedido': o.orderNumber || o.id,
    'ID Sistema': o.id,
    'Cliente / Razón Social': o.clientName,
    'Tipo Cliente': o.clientType === 'empresa' ? 'Empresa' : 'Consumidor Final',
    'Estado / Columna': o.status || o.columnId || 'cotizacion',
    'Vendedor Asignado': o.seller || '',
    'Sucursal': o.branch || '',
    'Total Unidades': o.totalUnits || 0,
    'Total Estimado ($)': o.totalEstimated || 0,
    'Fecha': o.date || '',
    'Teléfono': o.clientPhone || '',
    'Email': o.clientEmail || '',
    'Canal': o.channel || 'Web',
    'Días Demora': o.delayDays || 0,
    'Observaciones': o.observations || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguimiento Empresas');
  XLSX.writeFile(workbook, `Pampero_Seguimiento_Empresas_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function importOrdersFromExcel(
  file: File,
  currentOrders: CRMOrder[]
): Promise<{ updatedCount: number; newCount: number; orders: CRMOrder[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

  let updatedCount = 0;
  let newCount = 0;
  const ordersMap = new Map<string, CRMOrder>();

  // Index existing orders by orderNumber and by id
  currentOrders.forEach((o) => {
    ordersMap.set(o.id, { ...o });
    if (o.orderNumber) {
      ordersMap.set(String(o.orderNumber).trim().toLowerCase(), { ...o });
    }
  });

  const resultingOrders: CRMOrder[] = [...currentOrders];

  for (const row of rawRows) {
    const rawOrderNum = row['Número de Pedido'] || row['Numero de Pedido'] || row['Nro Pedido'] || row['Pedido'] || '';
    const rawId = row['ID Sistema'] || row['ID'] || '';
    const orderKey = String(rawOrderNum).trim().toLowerCase();
    const idKey = String(rawId).trim();

    // Check if matches existing card
    let matchedIndex = resultingOrders.findIndex((o) => 
      (idKey && o.id === idKey) ||
      (orderKey && o.orderNumber && String(o.orderNumber).trim().toLowerCase() === orderKey)
    );

    const clientName = row['Cliente / Razón Social'] || row['Cliente'] || 'Empresa';
    const statusVal = String(row['Estado / Columna'] || row['Estado'] || 'cotizacion').trim().toLowerCase();
    
    // Normalize status into valid CRMOrderStatus
    let normalizedStatus: any = 'cotizacion';
    if (statusVal.includes('seña') || statusVal.includes('sena') || statusVal.includes('50')) normalizedStatus = 'sena_50';
    else if (statusVal.includes('producc') || statusVal.includes('taller')) normalizedStatus = 'produccion';
    else if (statusVal.includes('listo')) normalizedStatus = 'listo';
    else if (statusVal.includes('entreg')) normalizedStatus = 'entregado';
    else if (statusVal.includes('cancel')) normalizedStatus = 'cancelado';
    else if (statusVal.includes('cotiz')) normalizedStatus = 'cotizacion';

    const totalUnits = Number(row['Total Unidades'] || row['Unidades'] || 0) || 0;
    const totalEstimated = Number(row['Total Estimado ($)'] || row['Total Estimado'] || row['Monto'] || 0) || 0;
    const seller = row['Vendedor Asignado'] || row['Vendedor'] || 'Itatí';
    const branch = row['Sucursal'] || 'Maipú';
    const observations = row['Observaciones'] || row['Notas'] || '';
    const dateVal = row['Fecha'] ? String(row['Fecha']).trim() : new Date().toISOString().split('T')[0];

    if (matchedIndex >= 0) {
      // Update existing
      const existing = resultingOrders[matchedIndex];
      const updated: CRMOrder = {
        ...existing,
        clientName: clientName || existing.clientName,
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        totalUnits: totalUnits || existing.totalUnits,
        totalEstimated: totalEstimated || existing.totalEstimated,
        seller: seller || existing.seller,
        branch: branch || existing.branch,
        observations: observations || existing.observations,
        clientPhone: row['Teléfono'] || row['Telefono'] || existing.clientPhone,
        clientEmail: row['Email'] || existing.clientEmail,
        updatedAt: new Date().toISOString(),
      };
      resultingOrders[matchedIndex] = updated;
      await saveCRMOrder(updated);
      updatedCount++;
    } else {
      // Add new card
      const newId = idKey || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newCard: CRMOrder = {
        id: newId,
        orderNumber: rawOrderNum ? String(rawOrderNum).trim() : `PED-${Math.floor(100 + Math.random() * 900)}`,
        date: dateVal,
        clientName: clientName,
        clientType: 'empresa',
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        seller: seller,
        branch: branch,
        totalUnits: totalUnits,
        totalEstimated: totalEstimated,
        observations: observations,
        clientPhone: row['Teléfono'] || row['Telefono'] || '',
        clientEmail: row['Email'] || '',
        channel: 'Excel',
        updatedAt: new Date().toISOString(),
      };
      resultingOrders.unshift(newCard);
      await saveCRMOrder(newCard);
      newCount++;
    }
  }

  return { updatedCount, newCount, orders: resultingOrders };
}

// ============================================================
// 2. KANBAN VISITAS COMERCIALES (LEAD VISITS)
// ============================================================

export function exportVisitsToExcel(visits: LeadVisit[]): void {
  const rows = visits.map((v) => ({
    'ID Visita': v.id,
    'Empresa': v.companyName,
    'Contacto': v.contactName,
    'Teléfono': v.phone || '',
    'Email': v.email || '',
    'Vendedor': v.seller || '',
    'Sucursal': v.branch || '',
    'Fase / Columna': v.status || v.columnId || 'primer_contacto',
    'Fecha': v.date || '',
    'Unidades Estimadas': v.estimatedUnits || 0,
    'Objetivo': v.objective || '',
    'Próximo Paso': v.nextStep || '',
    'Fecha Próximo Paso': v.nextStepDate || '',
    'Notas': v.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitas Comerciales');
  XLSX.writeFile(workbook, `Pampero_Visitas_Comerciales_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function importVisitsFromExcel(
  file: File,
  currentVisits: LeadVisit[]
): Promise<{ updatedCount: number; newCount: number; visits: LeadVisit[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

  let updatedCount = 0;
  let newCount = 0;
  const resultingVisits: LeadVisit[] = [...currentVisits];

  for (const row of rawRows) {
    const rawId = String(row['ID Visita'] || row['ID'] || '').trim();
    const company = String(row['Empresa'] || row['Cliente'] || '').trim();

    let matchedIndex = resultingVisits.findIndex((v) => 
      (rawId && v.id === rawId) ||
      (company && v.companyName.toLowerCase() === company.toLowerCase())
    );

    const statusVal = String(row['Fase / Columna'] || row['Estado'] || row['Fase'] || 'primer_contacto').trim().toLowerCase();
    let normalizedStatus: any = 'primer_contacto';
    if (statusVal.includes('reun') || statusVal.includes('visita')) normalizedStatus = 'reunion';
    else if (statusVal.includes('previo') || statusVal.includes('cotiz')) normalizedStatus = 'previo_cotizacion';
    else if (statusVal.includes('convert') || statusVal.includes('seguid') || statusVal.includes('cerrad')) normalizedStatus = 'convertida';
    else if (statusVal.includes('primer') || statusVal.includes('contacto')) normalizedStatus = 'primer_contacto';

    const contactName = row['Contacto'] || '';
    const phone = row['Teléfono'] || row['Telefono'] || '';
    const email = row['Email'] || '';
    const seller = row['Vendedor'] || 'Gustavo';
    const branch = row['Sucursal'] || 'Maipú';
    const estimatedUnits = Number(row['Unidades Estimadas'] || row['Unidades'] || 0) || 0;
    const objective = row['Objetivo'] || '';
    const nextStep = row['Próximo Paso'] || '';
    const notes = row['Notas'] || '';
    const dateVal = row['Fecha'] ? String(row['Fecha']).trim() : new Date().toISOString().split('T')[0];

    if (matchedIndex >= 0) {
      const existing = resultingVisits[matchedIndex];
      const updated: LeadVisit = {
        ...existing,
        companyName: company || existing.companyName,
        contactName: contactName || existing.contactName,
        phone: phone || existing.phone,
        email: email || existing.email,
        seller: seller || existing.seller,
        branch: branch || existing.branch,
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        estimatedUnits: estimatedUnits || existing.estimatedUnits,
        objective: objective || existing.objective,
        nextStep: nextStep || existing.nextStep,
        notes: notes || existing.notes,
        updatedAt: new Date().toISOString(),
      };
      resultingVisits[matchedIndex] = updated;
      await saveLeadVisit(updated);
      updatedCount++;
    } else {
      const newVisit: LeadVisit = {
        id: rawId || `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: dateVal,
        companyName: company || 'Nueva Empresa',
        contactName: contactName,
        phone: phone,
        email: email,
        seller: seller,
        branch: branch,
        status: normalizedStatus,
        columnId: normalizedStatus,
        step: normalizedStatus,
        estimatedUnits: estimatedUnits,
        objective: objective,
        nextStep: nextStep,
        notes: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resultingVisits.unshift(newVisit);
      await saveLeadVisit(newVisit);
      newCount++;
    }
  }

  return { updatedCount, newCount, visits: resultingVisits };
}

// ============================================================
// 3. PEDIDOS A PROVEEDORES (SUPPLIER ORDERS)
// ============================================================

export function exportSupplierOrdersToExcel(orders: SupplierOrder[]): void {
  const rows = orders.map((o) => ({
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
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos Proveedores');
  XLSX.writeFile(workbook, `Pampero_Pedidos_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function importSupplierOrdersFromExcel(
  file: File,
  currentOrders: SupplierOrder[]
): Promise<{ updatedCount: number; newCount: number; orders: SupplierOrder[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

  let updatedCount = 0;
  let newCount = 0;
  const resultingOrders: SupplierOrder[] = [...currentOrders];

  for (const row of rawRows) {
    const rawOrderNum = String(row['Nro Pedido'] || row['Numero Pedido'] || row['Orden'] || '').trim();
    const rawId = String(row['ID Sistema'] || row['ID'] || '').trim();

    let matchedIndex = resultingOrders.findIndex((o) => 
      (rawId && o.id === rawId) ||
      (rawOrderNum && o.orderNumber.toLowerCase() === rawOrderNum.toLowerCase())
    );

    const supplierName = row['Proveedor'] || 'Macata';
    const statusVal = String(row['Estado'] || 'borrador').trim().toLowerCase();
    
    let normalizedStatus: any = 'borrador';
    if (statusVal.includes('env')) normalizedStatus = 'enviado';
    else if (statusVal.includes('fab') || statusVal.includes('prod')) normalizedStatus = 'en_fabricacion';
    else if (statusVal.includes('despach')) normalizedStatus = 'despachado';
    else if (statusVal.includes('complet')) normalizedStatus = 'recibido_completo';
    else if (statusVal.includes('incomplet')) normalizedStatus = 'recibido_incompleto';

    const itemsCount = Number(row['Cantidad Ítems'] || row['Items'] || 0) || 0;
    const totalAmount = Number(row['Monto Total ($)'] || row['Total'] || 0) || 0;
    const itemsDescription = row['Descripción Ítems'] || row['Descripcion'] || '';
    const trackingNumber = row['Nro Seguimiento'] || row['Tracking'] || '';
    const branchDestination = row['Sucursal Destino'] || 'Maipú';
    const responsibleStaff = row['Responsable'] || 'Itatí';
    const notes = row['Notas'] || '';
    const orderDate = row['Fecha Pedido'] ? String(row['Fecha Pedido']).trim() : new Date().toISOString().split('T')[0];
    const estimatedArrivalDate = row['Fecha Estimada Llegada'] ? String(row['Fecha Estimada Llegada']).trim() : '';
    const actualArrivalDate = row['Fecha Llegada Real'] ? String(row['Fecha Llegada Real']).trim() : '';

    if (matchedIndex >= 0) {
      const existing = resultingOrders[matchedIndex];
      const updated: SupplierOrder = {
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
      };
      resultingOrders[matchedIndex] = updated;
      await saveSupplierOrder(updated);
      updatedCount++;
    } else {
      const newOrder: SupplierOrder = {
        id: rawId || `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: rawOrderNum || `PROV-${Date.now().toString().slice(-4)}`,
        supplierName: supplierName,
        status: normalizedStatus,
        itemsCount: itemsCount,
        totalAmount: totalAmount,
        itemsDescription: itemsDescription,
        trackingNumber: trackingNumber,
        branchDestination: branchDestination,
        responsibleStaff: responsibleStaff,
        orderDate: orderDate,
        estimatedArrivalDate: estimatedArrivalDate,
        actualArrivalDate: actualArrivalDate,
        notes: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resultingOrders.unshift(newOrder);
      await saveSupplierOrder(newOrder);
      newCount++;
    }
  }

  return { updatedCount, newCount, orders: resultingOrders };
}
