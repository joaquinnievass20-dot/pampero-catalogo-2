import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SizingCampaign, EmployeeSizeEntry } from '../../types';
import { 
  Users, 
  Plus, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Share2, 
  Shirt, 
  Download, 
  CheckCircle2, 
  Trash2,
  X,
  Save,
  Building2
} from 'lucide-react';

interface CRMSizingPortalTabProps {
  campaigns: SizingCampaign[];
  entries: EmployeeSizeEntry[];
  onSaveCampaign: (campaign: SizingCampaign) => void;
  onSaveEntry: (entry: EmployeeSizeEntry) => void;
  onDeleteCampaign?: (campaignId: string) => void;
}

export const CRMSizingPortalTab: React.FC<CRMSizingPortalTabProps> = ({
  campaigns,
  entries,
  onSaveCampaign,
  onSaveEntry,
  onDeleteCampaign,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns.length > 0 ? campaigns[0].id : 'default-campaign'
  );
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [showEmployeeFormModal, setShowEmployeeFormModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // New Campaign Form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCuit, setNewCuit] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // Employee Entry Form
  const [empName, setEmpName] = useState('');
  const [empDni, setEmpDni] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empGender, setEmpGender] = useState<'Hombre' | 'Mujer'>('Hombre');
  const [empShirt, setEmpShirt] = useState('42');
  const [empPants, setEmpPants] = useState('44');
  const [empFootwear, setEmpFootwear] = useState('42');
  const [empJacket, setEmpJacket] = useState('L');
  const [empNotes, setEmpNotes] = useState('');

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || {
    id: 'camp-edemsa',
    companyName: 'EDEMSA Distribuidora',
    cuit: '30-65489211-4',
    contactName: 'Ing. Rodrigo Videla',
    contactPhone: '261 423-5599',
    active: true,
    requiredGarments: ['Camisa/Chomba', 'Pantalón/Bombacha', 'Calzado de Seguridad', 'Campera Térmica'],
    createdAt: '2026-03-01',
    expiresAt: '2026-04-15',
  };

  const campaignEntries = entries.filter((e) => e.campaignId === activeCampaign.id);

  // Sizing Consolidation Calculation
  const calculateSizeBreakdown = (field: 'shirtSize' | 'pantsSize' | 'footwearSize' | 'jacketSize') => {
    const counts: Record<string, number> = {};
    campaignEntries.forEach((e) => {
      const val = e[field];
      if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  };

  const shirtCounts = calculateSizeBreakdown('shirtSize');
  const pantsCounts = calculateSizeBreakdown('pantsSize');
  const footwearCounts = calculateSizeBreakdown('footwearSize');
  const jacketCounts = calculateSizeBreakdown('jacketSize');

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const camp: SizingCampaign = {
      id: `CAMP-${Date.now().toString().slice(-6)}`,
      companyName: newCompanyName.trim(),
      cuit: newCuit.trim() || undefined,
      contactName: newContactName.trim() || 'Responsable',
      contactPhone: newContactPhone.trim() || '261',
      active: true,
      requiredGarments: ['Camisa de Trabajo', 'Pantalón Cargo', 'Calzado con Puntera', 'Campera Térmica'],
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      entriesCount: 0,
    };

    onSaveCampaign(camp);
    setSelectedCampaignId(camp.id);
    setShowNewCampaignModal(false);
  };

  const handleAddEmployeeEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empDni.trim()) return;

    const entry: EmployeeSizeEntry = {
      id: `SZ-${Date.now().toString().slice(-6)}`,
      campaignId: activeCampaign.id,
      companyName: activeCampaign.companyName,
      employeeName: empName.trim(),
      employeeDni: empDni.trim(),
      department: empDept.trim() || 'Operaciones',
      gender: empGender,
      shirtSize: empShirt,
      pantsSize: empPants,
      footwearSize: empFootwear,
      jacketSize: empJacket,
      notes: empNotes.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };

    onSaveEntry(entry);
    setEmpName('');
    setEmpDni('');
    setEmpDept('');
    setEmpNotes('');
    setShowEmployeeFormModal(false);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/?portal_talles=${activeCampaign.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyReport = () => {
    let report = `PLANILLA DE TALLES CONSOLIDADA - PAMPERO GRAN MENDOZA\n`;
    report += `Empresa: ${activeCampaign.companyName}\n`;
    report += `Total Empleados Registrados: ${campaignEntries.length}\n`;
    report += `Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`;

    report += `--- RESUMEN POR PRENDA ---\n`;
    report += `• CAMISAS/CHOMBAS:\n  ${shirtCounts.map(([sz, qty]) => `Talle ${sz}: ${qty} un.`).join(' | ') || 'Sin datos'}\n\n`;
    report += `• PANTALONES/BOMBACHAS:\n  ${pantsCounts.map(([sz, qty]) => `Talle ${sz}: ${qty} un.`).join(' | ') || 'Sin datos'}\n\n`;
    report += `• CALZADO DE SEGURIDAD:\n  ${footwearCounts.map(([sz, qty]) => `Talle ${sz}: ${qty} pares`).join(' | ') || 'Sin datos'}\n\n`;
    report += `• CAMPERAS TÉRMICAS:\n  ${jacketCounts.map(([sz, qty]) => `Talle ${sz}: ${qty} un.`).join(' | ') || 'Sin datos'}\n\n`;

    report += `--- NÓMINA INDIVIDUAL ---\n`;
    campaignEntries.forEach((e, idx) => {
      report += `${idx + 1}. ${e.employeeName} (DNI ${e.employeeDni}) - Área: ${e.department} - Camisa: ${e.shirtSize} | Pant: ${e.pantsSize} | Calz: ${e.footwearSize} | Camp: ${e.jacketSize}\n`;
    });

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handleExportExcel = () => {
    if (campaignEntries.length === 0) {
      alert('No hay registros de empleados cargados para exportar.');
      return;
    }

    const rows = campaignEntries.map((e, idx) => ({
      'Nº': idx + 1,
      'Empresa': e.companyName,
      'Empleado': e.employeeName,
      'DNI': e.employeeDni,
      'Sector / Área': e.department,
      'Género': e.gender || 'Hombre',
      'Talle Camisa': e.shirtSize,
      'Talle Pantalón': e.pantsSize,
      'Talle Calzado': e.footwearSize,
      'Talle Campera': e.jacketSize,
      'Observaciones': e.notes || '',
      'Fecha Carga': new Date(e.submittedAt).toLocaleDateString('es-AR'),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Talles Empleados');
    XLSX.writeFile(wb, `Planilla_Talles_${activeCampaign.companyName.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B9522F]" />
            Portal de Talles para Empleados (Fase 4)
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Generá un link único para que cada empresa cargue la nómina y talles de su personal. El sistema totaliza la curva para producción.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="px-3.5 py-2 bg-[#18231C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nueva Empresa / Campaña
          </button>
        </div>
      </div>

      {/* Campaign Selector & Quick Actions */}
      <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#6F6860] uppercase">Campaña Activa:</span>
          <select
            value={activeCampaign.id}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="text-xs border border-[#DCD4C9] rounded-xs px-3 py-1.5 bg-[#FAF8F5] font-bold text-[#18231C] outline-none cursor-pointer"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName} ({entries.filter((e) => e.campaignId === c.id).length} empleados)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-white border border-[#DCD4C9] hover:bg-[#FAF8F5] text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer text-[#18231C]"
            title="Copiar enlace para enviar por WhatsApp a la empresa"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-[#B9522F]" />}
            {copiedLink ? '¡Link Copiado!' : 'Copiar Link para la Empresa'}
          </button>

          <button
            onClick={() => setShowEmployeeFormModal(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-[#18231C] text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Shirt className="w-3.5 h-3.5" />
            Cargar Empleado Manual
          </button>

          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#ECE5DC] border border-[#DCD4C9] text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer text-[#18231C]"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedReport ? '¡Copiado!' : 'Copiar Reporte Totalizado'}
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-[#107C41] hover:bg-[#0c6333] text-white text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Sizing Breakdown Cards (Curva Totalizada) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Camisas */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#ECE5DC]">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">Camisas / Chombas</h4>
            <span className="text-[10px] font-bold text-[#B9522F]">
              {shirtCounts.reduce((acc, [, q]) => acc + q, 0)} un.
            </span>
          </div>
          <div className="space-y-1">
            {shirtCounts.map(([size, count]) => (
              <div key={size} className="flex justify-between text-xs py-0.5">
                <span className="font-medium text-[#6F6860]">Talle {size}:</span>
                <span className="font-bold text-[#18231C]">{count} un.</span>
              </div>
            ))}
            {shirtCounts.length === 0 && <p className="text-[11px] text-[#8C827A] italic">Sin registros</p>}
          </div>
        </div>

        {/* Pantalones */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#ECE5DC]">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">Pantalones / Bombachas</h4>
            <span className="text-[10px] font-bold text-[#B9522F]">
              {pantsCounts.reduce((acc, [, q]) => acc + q, 0)} un.
            </span>
          </div>
          <div className="space-y-1">
            {pantsCounts.map(([size, count]) => (
              <div key={size} className="flex justify-between text-xs py-0.5">
                <span className="font-medium text-[#6F6860]">Talle {size}:</span>
                <span className="font-bold text-[#18231C]">{count} un.</span>
              </div>
            ))}
            {pantsCounts.length === 0 && <p className="text-[11px] text-[#8C827A] italic">Sin registros</p>}
          </div>
        </div>

        {/* Calzado */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#ECE5DC]">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">Calzado de Seguridad</h4>
            <span className="text-[10px] font-bold text-[#B9522F]">
              {footwearCounts.reduce((acc, [, q]) => acc + q, 0)} pares
            </span>
          </div>
          <div className="space-y-1">
            {footwearCounts.map(([size, count]) => (
              <div key={size} className="flex justify-between text-xs py-0.5">
                <span className="font-medium text-[#6F6860]">Número {size}:</span>
                <span className="font-bold text-[#18231C]">{count} pares</span>
              </div>
            ))}
            {footwearCounts.length === 0 && <p className="text-[11px] text-[#8C827A] italic">Sin registros</p>}
          </div>
        </div>

        {/* Camperas */}
        <div className="bg-white p-4 rounded-xs border border-[#DCD4C9] shadow-2xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#ECE5DC]">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">Camperas Térmicas</h4>
            <span className="text-[10px] font-bold text-[#B9522F]">
              {jacketCounts.reduce((acc, [, q]) => acc + q, 0)} un.
            </span>
          </div>
          <div className="space-y-1">
            {jacketCounts.map(([size, count]) => (
              <div key={size} className="flex justify-between text-xs py-0.5">
                <span className="font-medium text-[#6F6860]">Talle {size}:</span>
                <span className="font-bold text-[#18231C]">{count} un.</span>
              </div>
            ))}
            {jacketCounts.length === 0 && <p className="text-[11px] text-[#8C827A] italic">Sin registros</p>}
          </div>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#DCD4C9] flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
            Nómina de Empleados Registrados ({campaignEntries.length})
          </h4>
          <span className="text-[11px] text-[#6F6860]">
            Empresa: <strong>{activeCampaign.companyName}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
              <tr>
                <th className="p-3">Empleado</th>
                <th className="p-3">DNI</th>
                <th className="p-3">Sector</th>
                <th className="p-3 text-center">Camisa</th>
                <th className="p-3 text-center">Pantalón</th>
                <th className="p-3 text-center">Calzado</th>
                <th className="p-3 text-center">Campera</th>
                <th className="p-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCD4C9]">
              {campaignEntries.map((e) => (
                <tr key={e.id} className="hover:bg-[#FAF8F5]">
                  <td className="p-3 font-bold text-[#18231C]">{e.employeeName}</td>
                  <td className="p-3 font-mono text-[#6F6860]">{e.employeeDni}</td>
                  <td className="p-3 text-[#6F6860]">{e.department}</td>
                  <td className="p-3 text-center font-bold">{e.shirtSize || '-'}</td>
                  <td className="p-3 text-center font-bold">{e.pantsSize || '-'}</td>
                  <td className="p-3 text-center font-bold">{e.footwearSize || '-'}</td>
                  <td className="p-3 text-center font-bold">{e.jacketSize || '-'}</td>
                  <td className="p-3 text-[#6F6860] max-w-xs truncate">{e.notes || '-'}</td>
                </tr>
              ))}
              {campaignEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6F6860]">
                    No hay empleados cargados para esta campaña. Compartí el link con la empresa o cargalos manualmente con el botón "Cargar Empleado Manual".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Campaign */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase tracking-wider">Nueva Campaña de Talles</h3>
              <button onClick={() => setShowNewCampaignModal(false)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Nombre de la Empresa *</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Razón Social o Empresa"
                  required
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">CUIT (opcional)</label>
                <input
                  type="text"
                  value={newCuit}
                  onChange={(e) => setNewCuit(e.target.value)}
                  placeholder="30-XXXXXXXX-X"
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Contacto RRHH</label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Nombre del contacto"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="Ej: 2612345678"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
                <button type="button" onClick={() => setShowNewCampaignModal(false)} className="px-4 py-2 text-xs font-bold text-[#6F6860]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs">
                  Crear Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Employee Sizing */}
      {showEmployeeFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xs border border-[#DCD4C9] shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#18231C] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase tracking-wider">Cargar Talle de Empleado ({activeCampaign.companyName})</h3>
              <button onClick={() => setShowEmployeeFormModal(false)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddEmployeeEntry} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Ingresar nombre completo"
                    required
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">DNI *</label>
                  <input
                    type="text"
                    value={empDni}
                    onChange={(e) => setEmpDni(e.target.value)}
                    placeholder="XXXXXXXX"
                    required
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Sector / Área</label>
                  <input
                    type="text"
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                    placeholder="Sector / Área"
                    className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Corte / Género</label>
                  <select value={empGender} onChange={(e) => setEmpGender(e.target.value as any)} className="w-full px-2.5 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-white">
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 bg-[#FAF8F5] p-3 rounded-xs border border-[#DCD4C9]">
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Camisa</label>
                  <select value={empShirt} onChange={(e) => setEmpShirt(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-bold">
                    {['38', '40', '42', '44', '46', '48', '50', '52', '54'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Pantalón</label>
                  <select value={empPants} onChange={(e) => setEmpPants(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-bold">
                    {['38', '40', '42', '44', '46', '48', '50', '52', '54', '56'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Calzado</label>
                  <select value={empFootwear} onChange={(e) => setEmpFootwear(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-bold">
                    {['38', '39', '40', '41', '42', '43', '44', '45', '46'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Campera</label>
                  <select value={empJacket} onChange={(e) => setEmpJacket(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-white font-bold">
                    {['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#6F6860] uppercase font-bold mb-1">Observaciones</label>
                <input
                  type="text"
                  value={empNotes}
                  onChange={(e) => setEmpNotes(e.target.value)}
                  placeholder="Ej: Tiro largo especial, calzado horma ancha..."
                  className="w-full px-3 py-2 text-xs border border-[#DCD4C9] rounded-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCD4C9]">
                <button type="button" onClick={() => setShowEmployeeFormModal(false)} className="px-4 py-2 text-xs font-bold text-[#6F6860]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-[#18231C] text-white text-xs font-bold uppercase rounded-xs">
                  Guardar Talle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
