import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Check, Plus, Trash2, Palette, Shield, Info, DollarSign } from 'lucide-react';
import { saveFirestoreStoreConfig, fetchFirestoreStoreConfig } from '../../services/firebase';

interface SimulatorConfig {
  title: string;
  subtitle: string;
  embroideryMatrixPrice: number;
  embroideryPerGarmentPrice: number;
  minUnitsForDiscount: number;
  discountPercentage: number;
  allowedPlacements: Array<{ id: string; label: string; maxDimensions: string; enabled: boolean }>;
  acceptedFileFormats: string;
  instructionsText: string;
}

const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  title: 'Simulador Bordado · Armador de Uniformes Pampero',
  subtitle: 'Previsualizá tu logo bordado en tiempo real sobre prendas de trabajo oficiales',
  embroideryMatrixPrice: 15000,
  embroideryPerGarmentPrice: 2800,
  minUnitsForDiscount: 20,
  discountPercentage: 15,
  allowedPlacements: [
    { id: 'chest_left', label: 'Pecho Izquierdo (Estándar 9x5 cm)', maxDimensions: '9x5 cm', enabled: true },
    { id: 'chest_right', label: 'Pecho Derecho (9x5 cm)', maxDimensions: '9x5 cm', enabled: true },
    { id: 'back_upper', label: 'Espalda Superior (25x10 cm)', maxDimensions: '25x10 cm', enabled: true },
    { id: 'back_center', label: 'Espalda Central (Grande 28x15 cm)', maxDimensions: '28x15 cm', enabled: true },
    { id: 'sleeve_left', label: 'Manga Izquierda (7x4 cm)', maxDimensions: '7x4 cm', enabled: true },
    { id: 'sleeve_right', label: 'Manga Derecha (7x4 cm)', maxDimensions: '7x4 cm', enabled: true },
  ],
  acceptedFileFormats: 'PNG, JPG, PDF vectorial, AI, EPS, DST',
  instructionsText: 'Subí tu logo en fondo transparente para una mejor simulación. Los precios de matriz y bordado son estimados y se confirman con la muestra física.',
};

interface AdminUniformSimulatorConfigTabProps {
  triggerSaveNotice: () => void;
}

export const AdminUniformSimulatorConfigTab: React.FC<AdminUniformSimulatorConfigTabProps> = ({ triggerSaveNotice }) => {
  const [config, setConfig] = useState<SimulatorConfig>(() => {
    try {
      const saved = localStorage.getItem('pampero_simulator_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SIMULATOR_CONFIG;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchFirestoreStoreConfig().then((remote: any) => {
      if (remote && remote.simulatorConfig) {
        setConfig(remote.simulatorConfig);
        try {
          localStorage.setItem('pampero_simulator_config', JSON.stringify(remote.simulatorConfig));
        } catch {}
      }
    }).catch(console.warn);
  }, []);

  const handleTogglePlacement = (id: string) => {
    const updated = config.allowedPlacements.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    );
    setConfig({ ...config, allowedPlacements: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('pampero_simulator_config', JSON.stringify(config));
      await saveFirestoreStoreConfig({ simulatorConfig: config });
      triggerSaveNotice();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración del simulador:', err);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#18231C] text-white rounded-xs">
            <Sparkles className="w-6 h-6 text-[#FDB813]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider">
              Configuración y Contenido · Simulador Bordado
            </h3>
            <p className="text-xs text-[#6F6860] mt-0.5">
              Ajustá los costos de matriz y bordado, ubicaciones permitidas e instrucciones de personalización.
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
            <label className="block font-bold text-neutral-700 mb-1">Título del Simulador</label>
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

        {/* Pricing of embroidery */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#DCD4C9]">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Costo de Matriz Digital ($)</label>
            <input
              type="number"
              value={config.embroideryMatrixPrice}
              onChange={(e) => setConfig({ ...config, embroideryMatrixPrice: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
            <span className="text-[10px] text-neutral-500">Costo único de digitalización de matriz</span>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Bordado por Prenda ($)</label>
            <input
              type="number"
              value={config.embroideryPerGarmentPrice}
              onChange={(e) => setConfig({ ...config, embroideryPerGarmentPrice: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
            <span className="text-[10px] text-neutral-500">Costo unitario por aplicación</span>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Descuento Corporativo (%)</label>
            <input
              type="number"
              value={config.discountPercentage}
              onChange={(e) => setConfig({ ...config, discountPercentage: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
            <span className="text-[10px] text-neutral-500">Al superar {config.minUnitsForDiscount} prendas</span>
          </div>
        </div>

        {/* Allowed placements */}
        <div className="pt-2 border-t border-[#DCD4C9]">
          <label className="block font-bold text-neutral-700 mb-2">Posiciones de Bordado Habilitadas</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {config.allowedPlacements.map((p) => (
              <label
                key={p.id}
                className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-xs cursor-pointer hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={() => handleTogglePlacement(p.id)}
                    className="rounded-xs text-[#B9522F]"
                  />
                  <span className="font-semibold text-neutral-800">{p.label}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">{p.maxDimensions}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#DCD4C9]">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Formatos de Archivo Aceptados</label>
            <input
              type="text"
              value={config.acceptedFileFormats}
              onChange={(e) => setConfig({ ...config, acceptedFileFormats: e.target.value })}
              className="w-full px-3 py-2 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F]"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Instrucciones al Cliente</label>
            <textarea
              value={config.instructionsText}
              onChange={(e) => setConfig({ ...config, instructionsText: e.target.value })}
              rows={2}
              className="w-full p-2.5 border border-[#DCD4C9] rounded-xs font-medium outline-none focus:border-[#B9522F] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#DCD4C9]">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#B9522F] hover:bg-[#9E3E1E] text-white font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración del Simulador</span>
          </button>
        </div>
      </form>
    </div>
  );
};
