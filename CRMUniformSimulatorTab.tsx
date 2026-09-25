import React, { useState, useRef } from 'react';
import { 
  Shirt, 
  Upload, 
  Download, 
  Sparkles, 
  Layers, 
  Sliders, 
  RotateCcw, 
  Check, 
  MessageCircle,
  Building2,
  Eye
} from 'lucide-react';

interface GarmentPreset {
  id: string;
  name: string;
  category: string;
  baseImage: string;
  availableColors: { name: string; hex: string; filterClass?: string }[];
}

const GARMENTS: GarmentPreset[] = [
  {
    id: 'chomba',
    name: 'Chomba Pampero Piqué Clásica',
    category: 'Indumentaria Corporativa',
    baseImage: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Azul Marino', hex: '#1B263B' },
      { name: 'Negro', hex: '#1C1C1C' },
      { name: 'Verde Oliva', hex: '#3E4A35' },
      { name: 'Blanco', hex: '#F8F9FA' },
      { name: 'Rojo', hex: '#8B0000' },
    ],
  },
  {
    id: 'camisa',
    name: 'Camisa de Trabajo Pampero Soler',
    category: 'Industria & Laboral',
    baseImage: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Azul Marino', hex: '#1A2938' },
      { name: 'Beige Arena', hex: '#D7C4A5' },
      { name: 'Verde Oliva', hex: '#3C4934' },
      { name: 'Gris Topo', hex: '#585E64' },
    ],
  },
  {
    id: 'campera',
    name: 'Campera Softshell Térmica Pampero',
    category: 'Abrigos Técnicos',
    baseImage: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Negro', hex: '#1A1A1A' },
      { name: 'Azul Marino', hex: '#152238' },
      { name: 'Verde Militar', hex: '#3B4436' },
      { name: 'Bordeaux', hex: '#5E1925' },
    ],
  },
  {
    id: 'chaleco',
    name: 'Chaleco de Seguridad Alta Visibilidad',
    category: 'Seguridad Industrial',
    baseImage: 'https://images.unsplash.com/photo-1578873375972-02656910609f?auto=format&fit=crop&w=800&q=80',
    availableColors: [
      { name: 'Naranja Flúor', hex: '#FF6700' },
      { name: 'Amarillo Flúor', hex: '#E2F700' },
    ],
  },
];

type LogoPosition = 'pecho_izq' | 'pecho_centro' | 'espalda' | 'manga';
type LogoTechnique = 'bordado' | 'estampado';

export const CRMUniformSimulatorTab: React.FC = () => {
  const [selectedGarment, setSelectedGarment] = useState<GarmentPreset>(GARMENTS[0]);
  const [selectedColor, setSelectedColor] = useState(GARMENTS[0].availableColors[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string>('');
  const [technique, setTechnique] = useState<LogoTechnique>('bordado');
  const [position, setPosition] = useState<LogoPosition>('pecho_izq');
  const [logoScale, setLogoScale] = useState(70);
  const [companyName, setCompanyName] = useState('');
  const [estimatedQuantity, setEstimatedQuantity] = useState('30');
  const previewRef = useRef<HTMLDivElement>(null);

  // File upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUseSampleLogo = () => {
    setLogoUrl('/logo-oficial.png.png');
    setLogoName('Logo Pampero Oficial');
  };

  const getPlacementStyles = () => {
    switch (position) {
      case 'pecho_izq':
        return {
          top: '32%',
          left: '32%',
          transform: 'translate(-50%, -50%)',
        };
      case 'pecho_centro':
        return {
          top: '34%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case 'espalda':
        return {
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case 'manga':
        return {
          top: '38%',
          left: '18%',
          transform: 'translate(-50%, -50%)',
        };
      default:
        return {
          top: '32%',
          left: '32%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  const handleRequestQuote = () => {
    const text = encodeURIComponent(
      `Hola Pampero Gran Mendoza! Vengo del Armador de Uniformes Virtual con un diseño corporativo.\n\n` +
      `• Empresa: ${companyName.trim() || 'Mi Empresa'}\n` +
      `• Prenda: ${selectedGarment.name}\n` +
      `• Color: ${selectedColor.name}\n` +
      `• Aplicación: ${technique === 'bordado' ? 'Bordado Computarizado' : 'Estampado Transfer HD'}\n` +
      `• Ubicación: ${position === 'pecho_izq' ? 'Pecho Izquierdo' : position === 'pecho_centro' ? 'Pecho Centro' : position === 'espalda' ? 'Espalda Grande' : 'Manga'}\n` +
      `• Cantidad estimada: ${estimatedQuantity} prendas\n\n` +
      `¿Podrían cotizarme con matriz de bordado incluida?`
    );
    window.open(`https://wa.me/5492615276713?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#18231C] uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#B9522F]" />
            Armador de Uniformes Virtual (Simulador de Bordado)
          </h3>
          <p className="text-xs text-[#6F6860] mt-0.5">
            Subí el logo de la empresa y previsualizá de inmediato cómo quedaría bordado o estampado en prendas oficiales Pampero.
          </p>
        </div>

        <button
          onClick={handleRequestQuote}
          className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          Cotizar este Uniforme por WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Mockup Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xs border border-[#DCD4C9] shadow-2xs flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#ECE5DC] text-xs">
            <div className="flex items-center gap-2 font-bold text-[#18231C]">
              <Eye className="w-4 h-4 text-[#B9522F]" />
              <span>Simulación: {selectedGarment.name}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#6F6860] bg-[#FAF8F5] px-2 py-0.5 rounded-xs border border-[#DCD4C9]">
              Color: {selectedColor.name}
            </span>
          </div>

          {/* Interactive Garment & Logo Viewport */}
          <div 
            ref={previewRef}
            className="relative w-full max-w-md aspect-square bg-[#FAF8F5] rounded-xs overflow-hidden border border-[#DCD4C9] shadow-inner flex items-center justify-center select-none"
          >
            {/* Color Tint Overlay for Garment */}
            <div 
              className="absolute inset-0 z-10 mix-blend-color opacity-70 pointer-events-none transition-colors duration-300"
              style={{ backgroundColor: selectedColor.hex }}
            />

            {/* Base Garment Photo */}
            <img 
              src={selectedGarment.baseImage} 
              alt={selectedGarment.name}
              className="w-full h-full object-cover shrink-0"
            />

            {/* Overlaid Logo with Embroidery / Transfer Effect */}
            {logoUrl && (
              <div 
                className="absolute z-20 pointer-events-none transition-all duration-200"
                style={{
                  ...getPlacementStyles(),
                  width: `${logoScale}px`,
                  maxWidth: '120px',
                }}
              >
                <div 
                  className={`relative p-1 rounded-xs transition-all ${
                    technique === 'bordado'
                      ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] contrast-110 saturate-125'
                      : 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                  }`}
                  style={{
                    filter: technique === 'bordado' ? 'drop-shadow(0px 1px 1px rgba(0,0,0,0.7))' : 'none',
                  }}
                >
                  <img 
                    src={logoUrl} 
                    alt="Logo Empresa" 
                    className="w-full h-auto object-contain max-h-24"
                  />
                  {technique === 'bordado' && (
                    <div 
                      className="absolute inset-0 border border-white/20 rounded-xs pointer-events-none opacity-40 mix-blend-overlay"
                      style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 20%)', backgroundSize: '3px 3px' }}
                    />
                  )}
                </div>
              </div>
            )}

            {!logoUrl && (
              <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-xs text-white p-4 rounded-xs text-center max-w-[200px]">
                <Upload className="w-6 h-6 mx-auto mb-1.5 text-amber-400" />
                <p className="text-xs font-bold uppercase">Subí tu logo</p>
                <p className="text-[10px] text-white/80 mt-0.5">para verlo aplicado en la prenda</p>
              </div>
            )}

            {/* Watermark badge */}
            <div className="absolute bottom-2.5 right-2.5 z-30 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-xs text-[9px] font-bold tracking-wider uppercase">
              Pampero Simulador
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between w-full text-xs text-[#6F6860] px-2">
            <span>Técnica: <strong className="text-[#18231C] uppercase">{technique === 'bordado' ? 'Bordado Computarizado' : 'Estampado Transfer HD'}</strong></span>
            <span>Ubicación: <strong className="text-[#18231C] uppercase">{position.replace('_', ' ')}</strong></span>
          </div>
        </div>

        {/* Right Column: Controls & Configuration (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xs border border-[#DCD4C9] shadow-2xs space-y-5">
          {/* 1. Empresa y Cantidad */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              1. Datos de la Empresa
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nombre de la Empresa"
                  className="w-full px-3 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-[#FAF8F5]"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={estimatedQuantity}
                  onChange={(e) => setEstimatedQuantity(e.target.value)}
                  placeholder="Prendas"
                  title="Cantidad estimada de uniformes"
                  className="w-full px-2 py-1.5 text-xs border border-[#DCD4C9] rounded-xs outline-none bg-[#FAF8F5]"
                />
              </div>
            </div>
          </div>

          {/* 2. Subir Logo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
                2. Subir Logo de la Empresa
              </h4>
              <button
                type="button"
                onClick={handleUseSampleLogo}
                className="text-[10px] font-bold text-[#B9522F] hover:underline cursor-pointer"
              >
                Usar Logo de Prueba
              </button>
            </div>

            <label className="border-2 border-dashed border-[#DCD4C9] hover:border-[#B9522F] rounded-xs p-3.5 flex flex-col items-center justify-center cursor-pointer bg-[#FAF8F5] transition-colors">
              <Upload className="w-5 h-5 text-[#8C827A] mb-1" />
              <span className="text-xs font-bold text-[#18231C]">
                {logoName ? logoName : 'Hacé clic para cargar logo (PNG o JPG)'}
              </span>
              <span className="text-[10px] text-[#6F6860] mt-0.5">
                Recomendado con fondo transparente
              </span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          {/* 3. Selección de Prenda */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              3. Tipo de Prenda
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {GARMENTS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGarment(g);
                    setSelectedColor(g.availableColors[0]);
                  }}
                  className={`p-2.5 rounded-xs border text-left text-xs transition-all cursor-pointer ${
                    selectedGarment.id === g.id
                      ? 'border-[#B9522F] bg-[#B9522F]/10 font-bold text-[#18231C]'
                      : 'border-[#DCD4C9] hover:border-[#18231C] text-[#6F6860]'
                  }`}
                >
                  <p className="truncate font-semibold text-[#18231C]">{g.name}</p>
                  <p className="text-[10px] text-[#8C827A]">{g.category}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Color de la Prenda */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C]">
              4. Color de Tela
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedGarment.availableColors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelectedColor(c)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-xs cursor-pointer ${
                    selectedColor.name === c.name
                      ? 'border-[#18231C] bg-[#18231C] text-white font-bold'
                      : 'border-[#DCD4C9] bg-white text-[#18231C] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Ubicación y Técnica */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1.5">
                5. Ubicación
              </h4>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C]"
              >
                <option value="pecho_izq">Pecho Izquierdo</option>
                <option value="pecho_centro">Pecho Centro</option>
                <option value="espalda">Espalda Superior</option>
                <option value="manga">Manga</option>
              </select>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18231C] mb-1.5">
                6. Técnica
              </h4>
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs border border-[#DCD4C9] rounded-xs bg-[#FAF8F5] outline-none font-medium text-[#18231C]"
              >
                <option value="bordado">Bordado Computarizado</option>
                <option value="estampado">Estampado Transfer HD</option>
              </select>
            </div>
          </div>

          {/* 7. Tamaño del Logo */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#6F6860]">
              <span className="font-bold uppercase tracking-wider text-[#18231C]">Tamaño del Logo:</span>
              <span className="font-mono">{logoScale}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="110"
              value={logoScale}
              onChange={(e) => setLogoScale(Number(e.target.value))}
              className="w-full accent-[#B9522F] cursor-pointer"
            />
          </div>

          {/* WhatsApp CTA Action */}
          <div className="pt-3 border-t border-[#ECE5DC]">
            <button
              onClick={handleRequestQuote}
              className="w-full py-2.5 bg-[#18231C] hover:bg-black text-white font-bold uppercase tracking-wider text-xs rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366] fill-current" />
              Solicitar Cotización con este Diseño
            </button>
            <p className="text-[10px] text-center text-[#8C827A] mt-2">
              Se enviará la configuración detallada a nuestro equipo de ventas en Gran Mendoza.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
