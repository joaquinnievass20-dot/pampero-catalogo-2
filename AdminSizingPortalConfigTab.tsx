import React, { useState, useEffect } from 'react';
import { Shirt, Save, Check, Plus, Trash2, Building2, Calendar, FileText, ExternalLink } from 'lucide-react';
import { saveFirestoreStoreConfig, fetchFirestoreStoreConfig } from '../../services/firebase';

interface SizingPortalConfig {
  title: string;
  subtitle: string;
  welcomeMessage: string;
  defaultRequiredGarments: string[];
  instructions: string;
  contactSupportPhone: string;
  notifyOnSubmission: boolean;
  activeCampaignDeadlineDays: number;
}

const DEFAULT_CONFIG: SizingPortalConfig = {
  title: 'Portal Digital de Talles para Empresas',
  subtitle: 'Relevamiento unificado de medidas y uniformes oficiales Pampero',
  welcomeMessage: 'Completá tus talles para la indumentaria de trabajo provista por tu empresa.',
  defaultRequiredGarments: [
    'Camisa / Chomba de Trabajo',
    'Pantalón / Bombacha Pampero',
    'Calzado de Seguridad',
    'Campera Térmica'
  ],
  instructions: 'Seleccioná el talle exacto de cada prenda según la tabla oficial Pampero. Si tenés dudas, solicitá probar las muestras físicas.',
  contactSupportPhone: '261 527-6713',
  notifyOnSubmission: true,
  activeCampaignDeadlineDays: 15,
};

interface AdminSizingPortalConfigTabProps {
  triggerSaveNotice: () => void;
}

export const AdminSizingPortalConfigTab: React.FC<AdminSizingPortalConfigTabProps> = ({ triggerSaveNotice }) => {
  const [config, setConfig] = useState<SizingPortalConfig>(() => {
    try {
      const saved = localStorage.getItem('pampero_sizing_portal_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newGarment, setNewGarment] = useState('');

  useEffect(() => {
    fetchFirestoreStoreConfig().then((remote: any) => {
      if (remote && remote.sizingPortalConfig) {
        setConfig(remote.sizingPortalConfig);
        try {
          localStorage.setItem('pampero_sizing_portal_config', JSON.stringify(remote.sizingPortalConfig));
        } catch {}
      }
    }).catch(console.warn);
  }, []);

  const handleAddGarment = () => {
    if (!newGarment.trim()) return;
    if (!config.defaultRequiredGarments.includes(newGarment.trim())) {
      setConfig({
        ...config,
        defaultRequiredGarments: [...config.defaultRequiredGarments, newGarment.trim()],
      });
      setNewGarment('');
    }
  };

  const handleRemoveGarment = (index: number) => {
    const updated = config.defaultRequiredGarments.filter((_, i) => i !== index);
    setConfig({ ...config, defaultRequiredGarments: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('pampero_sizing_portal_config', JSON.stringify(config));
      await saveFirestoreStoreConfig({ sizingPortalConfig: config });
      triggerSaveNotice();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración del portal de talles:', err);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#18231C] text-white rounded-xs">
            <Shirt className="w-6 h-6 text-[#FDB813]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Configuración y Contenido · Portal de Talles
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Personalizá los textos, prendas solicitadas por defecto y condiciones que ven las empresas y sus colaboradores.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600" />
            ¡Guardado en Cloud Firestore!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-5 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Título Principal del Portal</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Subtítulo Descriptivo</label>
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-neutral-700 mb-1">Mensaje de Bienvenida al Colaborador</label>
          <input
            type="text"
            value={config.welcomeMessage}
            onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
            className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
          />
        </div>

        <div>
          <label className="block font-bold text-neutral-700 mb-1">Instrucciones de Carga de Talles</label>
          <textarea
            value={config.instructions}
            onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
            rows={2}
            className="w-full p-2.5 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F] resize-none"
          />
        </div>

        {/* Prendas Requeridas por Defecto */}
        <div className="pt-2 border-t border-[#DCD4C9]">
          <label className="block font-bold text-neutral-700 mb-2">Prendas Solicitadas por Defecto en Nuevas Campañas</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {config.defaultRequiredGarments.map((g, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 border border-neutral-300 rounded-xs text-xs font-semibold text-neutral-800"
              >
                <span>{g}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveGarment(idx)}
                  className="text-neutral-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              value={newGarment}
              onChange={(e) => setNewGarment(e.target.value)}
              placeholder="Ej: Chaleco Reflectivo, Capa de Lluvia..."
              className="flex-1 px-3 py-1.5 border border-[#DCD4C9] rounded-xs outline-none"
            />
            <button
              type="button"
              onClick={handleAddGarment}
              className="px-3 py-1.5 bg-[#18231C] text-white font-bold rounded-xs flex items-center gap-1 hover:bg-black cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#DCD4C9]">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">WhatsApp de Soporte para Empleados</label>
            <input
              type="text"
              value={config.contactSupportPhone}
              onChange={(e) => setConfig({ ...config, contactSupportPhone: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Vigencia por Defecto de Campañas (Días)</label>
            <input
              type="number"
              value={config.activeCampaignDeadlineDays}
              onChange={(e) => setConfig({ ...config, activeCampaignDeadlineDays: Number(e.target.value) || 15 })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#DCD4C9]">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración del Portal</span>
          </button>
        </div>
      </form>
    </div>
  );
};
