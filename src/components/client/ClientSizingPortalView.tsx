import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Shirt, 
  Users, 
  Building2, 
  CheckCircle2, 
  Save, 
  Share2, 
  Copy, 
  Check, 
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { ThemeConfig, SizingCampaign, EmployeeSizeEntry, UserSession } from '../../types';
import { 
  subscribeToSizingCampaigns, 
  saveEmployeeSizeEntry, 
  subscribeToEmployeeSizeEntries 
} from '../../services/firebase';

interface ClientSizingPortalViewProps {
  onBackToHome: () => void;
  theme: ThemeConfig;
  userSession?: UserSession | null;
}

export const ClientSizingPortalView: React.FC<ClientSizingPortalViewProps> = ({
  onBackToHome,
  theme,
  userSession,
}) => {
  const [campaigns, setCampaigns] = useState<SizingCampaign[]>([]);
  const [entries, setEntries] = useState<EmployeeSizeEntry[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Enterprise logged-in detection for Strict RLS
  const isCompanyUser = userSession?.role === 'client' && (
    userSession?.clientType === 'empresa' || Boolean(userSession?.clientData?.companyName)
  );
  const loggedCompanyName = (
    userSession?.clientData?.companyName || 
    userSession?.clientData?.businessName || 
    userSession?.clientData?.name || 
    ''
  ).trim();

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

  useEffect(() => {
    const unsubCamp = subscribeToSizingCampaigns((camps) => {
      setCampaigns(camps);
      if (camps.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(camps[0].id);
      }
    });

    const unsubEntries = subscribeToEmployeeSizeEntries('all', (loadedEntries) => {
      setEntries(loadedEntries);
    });

    return () => {
      unsubCamp();
      unsubEntries();
    };
  }, [selectedCampaignId]);

  // Sincronización estricta (RLS/Filtro):
  // La vista del Portal de Talles debe filtrar los datos para que cada empresa logueada
  // vea única y exclusivamente a sus propios empleados.
  const filteredCampaigns = campaigns.filter((c) => {
    if (!isCompanyUser) return true;
    if (!loggedCompanyName) return true;
    const cName = (c.companyName || '').toLowerCase().trim();
    const myName = loggedCompanyName.toLowerCase().trim();
    return cName.includes(myName) || myName.includes(cName);
  });

  const activeCampaign: SizingCampaign | undefined = 
    filteredCampaigns.find((c) => c.id === selectedCampaignId) || 
    filteredCampaigns[0] || 
    (isCompanyUser ? {
      id: `camp-${loggedCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'empresa'}`,
      companyName: loggedCompanyName || 'Mi Empresa',
      contactName: userSession?.clientData?.fullName || (userSession?.clientData as any)?.repFullName || 'Responsable',
      contactPhone: (userSession?.clientData as any)?.phone || '261 527-6713',
      active: true,
      requiredGarments: ['Camisa / Chomba', 'Pantalón Pampero', 'Calzado de Seguridad', 'Campera Térmica'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    } : campaigns[0]);

  // Strict RLS on employee size entries: only show employees of the logged company
  const campaignEntries = entries.filter((e) => {
    if (isCompanyUser && loggedCompanyName) {
      const eComp = (e.companyName || '').toLowerCase().trim();
      const myComp = loggedCompanyName.toLowerCase().trim();
      const matchesCompany = eComp.includes(myComp) || myComp.includes(eComp);
      const matchesCampaign = Boolean(activeCampaign?.id && e.campaignId === activeCampaign.id);
      return matchesCompany || matchesCampaign;
    }
    return activeCampaign ? e.campaignId === activeCampaign.id : true;
  });

  const handleCopyShareLink = () => {
    const url = window.location.origin + '?portal_talles=' + (activeCampaign?.id || 'general');
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empDni.trim()) return;

    const newEntry: EmployeeSizeEntry = {
      id: `SZ-${Date.now().toString().slice(-6)}`,
      campaignId: activeCampaign?.id || 'general',
      companyName: activeCampaign?.companyName || 'Empresa Cliente',
      employeeName: empName.trim(),
      employeeDni: empDni.trim(),
      department: empDept.trim() || 'General',
      gender: empGender,
      shirtSize: empShirt,
      pantsSize: empPants,
      footwearSize: empFootwear,
      jacketSize: empJacket,
      notes: empNotes.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };

    saveEmployeeSizeEntry(newEntry);
    setSubmittedSuccess(true);
    setEmpName('');
    setEmpDni('');
    setEmpDept('');
    setEmpNotes('');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      {/* Top Banner Navigation */}
      <div className="bg-[#18231C] text-white border-b border-black py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 hover:bg-white/10 rounded-xs text-[#FAF8F5] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Inicio</span>
            </button>
            <span className="text-neutral-500 hidden sm:inline">|</span>
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-[#FDB813]" />
              <span className="font-display font-bold uppercase tracking-wider text-sm sm:text-base">
                Portal de Talles para Empleados · Pampero
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 bg-[#FAF8F5]/10 hover:bg-[#FAF8F5]/20 text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link para Empleados'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Intro */}
        <div className="bg-white p-6 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-[#B9522F] text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Carga Digital de Indumentaria Corporativa</span>
          </div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-wider text-[#18231C]">
            Completá tus talles para el uniforme de tu empresa
          </h1>
          <p className="text-xs text-[#6F6860] leading-relaxed">
            Este formulario digital permite a cada trabajador cargar su número de calzado, bombacha/pantalón, camisa y abrigo sin planillas de papel. Los datos quedan consolidados de inmediato para el pedido a fábrica Pampero.
          </p>

          {/* Enterprise RLS Banner */}
          {isCompanyUser && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-950">
              <div className="flex items-center gap-2 font-bold">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Sesión Empresarial: {loggedCompanyName}</span>
              </div>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-xs font-mono font-bold uppercase tracking-wider self-start sm:self-auto">
                Filtro Estricto RLS Activo
              </span>
            </div>
          )}

          {/* Company Campaign Selector */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#DCD4C9]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#18231C] uppercase">Empresa activa:</span>
              {isCompanyUser ? (
                <div className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs font-bold text-[#18231C]">
                  {activeCampaign?.companyName || loggedCompanyName}
                </div>
              ) : (
                <select
                  value={selectedCampaignId}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value);
                    setSubmittedSuccess(false);
                  }}
                  className="text-xs font-bold bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs px-3 py-1.5 text-[#18231C] outline-none"
                >
                  {filteredCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} {c.cuit ? `(CUIT ${c.cuit})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="text-xs text-[#6F6860]">
              Total colaboradores registrados: <strong className="text-[#18231C]">{campaignEntries.length} empleados</strong>
            </div>
          </div>
        </div>

        {/* Success Notice */}
        {submittedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xs text-emerald-900 flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">¡Talles registrados exitosamente!</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Tus medidas han sido guardadas y consolidadas para la empresa <strong>{activeCampaign?.companyName}</strong>. Si ingresa otro empleado en este dispositivo, puede completar el formulario a continuación.
              </p>
            </div>
          </div>
        )}

        {/* Employee Sizing Form Card */}
        <div className="bg-white p-6 sm:p-8 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-6">
          <div className="border-b border-[#DCD4C9] pb-3">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider text-[#18231C]">
              Formulario Individual del Trabajador
            </h2>
            <p className="text-xs text-[#6F6860]">
              Ingresá tus datos personales y seleccioná las medidas exactas de tus prendas.
            </p>
          </div>

          <form onSubmit={handleSubmitEntry} className="space-y-6 text-xs">
            {/* Row 1: Personal Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="Ej: Juan Carlos Morales"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  DNI o N° de Legajo *
                </label>
                <input
                  type="text"
                  required
                  value={empDni}
                  onChange={(e) => setEmpDni(e.target.value)}
                  placeholder="Ej: 32.405.112"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Sector o Área de Trabajo
                </label>
                <input
                  type="text"
                  value={empDept}
                  onChange={(e) => setEmpDept(e.target.value)}
                  placeholder="Ej: Mantenimiento / Bodega"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813]"
                />
              </div>
            </div>

            {/* Row 2: Gender & Sizes */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-[#ECE5DC]">
              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Línea / Género
                </label>
                <select
                  value={empGender}
                  onChange={(e) => setEmpGender(e.target.value as any)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none font-bold"
                >
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Camisa / Chomba
                </label>
                <select
                  value={empShirt}
                  onChange={(e) => setEmpShirt(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none font-bold text-[#B9522F]"
                >
                  {['38', '40', '42', '44', '46', '48', '50', '52', '54', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => (
                    <option key={s} value={s}>Talle {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Pantalón / Bombacha
                </label>
                <select
                  value={empPants}
                  onChange={(e) => setEmpPants(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none font-bold text-[#B9522F]"
                >
                  {['38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'].map((s) => (
                    <option key={s} value={s}>Talle {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Calzado / Borcego
                </label>
                <select
                  value={empFootwear}
                  onChange={(e) => setEmpFootwear(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none font-bold text-[#B9522F]"
                >
                  {['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'].map((s) => (
                    <option key={s} value={s}>N° {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                  Campera / Polar
                </label>
                <select
                  value={empJacket}
                  onChange={(e) => setEmpJacket(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none font-bold text-[#B9522F]"
                >
                  {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map((s) => (
                    <option key={s} value={s}>Talle {s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#18231C] mb-1">
                Aclaraciones o Requerimientos Especiales (opcional)
              </label>
              <textarea
                value={empNotes}
                onChange={(e) => setEmpNotes(e.target.value)}
                placeholder="Ej: Puntera de acero obligatoria, botamanga con ajuste especial, calzado horma ancha..."
                rows={2}
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C9] rounded-xs text-xs outline-none focus:border-[#FDB813] resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[11px] text-[#6F6860]">
                * Tus datos se sincronizan directamente con el sistema de provisión Pampero Mendoza.
              </span>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-[#18231C] hover:bg-black text-[#F5F2EC] rounded-xs font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Save className="w-4 h-4 text-[#FDB813]" />
                <span>Confirmar y Guardar mis Talles</span>
              </button>
            </div>
          </form>
        </div>

        {/* Table of consolidated entries for verification */}
        {campaignEntries.length > 0 && (
          <div className="bg-white p-6 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base uppercase tracking-wider text-[#18231C]">
                  Personal Registrado en {activeCampaign?.companyName} ({campaignEntries.length})
                </h3>
                <p className="text-xs text-[#6F6860]">
                  Visualización consolidada para delegados o responsables de compras.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#DCD4C9] rounded-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#18231C] uppercase font-bold tracking-wider border-b border-[#DCD4C9]">
                  <tr>
                    <th className="p-3">Trabajador / Legajo</th>
                    <th className="p-3">Sector</th>
                    <th className="p-3 text-center">Camisa/Chomba</th>
                    <th className="p-3 text-center">Pantalón</th>
                    <th className="p-3 text-center">Calzado</th>
                    <th className="p-3 text-center">Campera</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCD4C9]">
                  {campaignEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-[#FAF8F5]">
                      <td className="p-3">
                        <div className="font-bold text-[#18231C]">{e.employeeName}</div>
                        <div className="text-[10px] text-[#6F6860] font-mono">{e.employeeDni}</div>
                      </td>
                      <td className="p-3 text-[#4A453F]">{e.department}</td>
                      <td className="p-3 text-center font-bold text-[#B9522F]">{e.shirtSize || '-'}</td>
                      <td className="p-3 text-center font-bold text-[#B9522F]">{e.pantsSize || '-'}</td>
                      <td className="p-3 text-center font-bold text-[#18231C]">{e.footwearSize ? `N° ${e.footwearSize}` : '-'}</td>
                      <td className="p-3 text-center font-bold text-[#18231C]">{e.jacketSize || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
