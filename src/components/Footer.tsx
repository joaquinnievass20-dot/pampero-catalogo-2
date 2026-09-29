import React from 'react';
import { BranchLocation, ThemeConfig } from '../types';
import { PamperoLogo } from './PamperoLogo';
import { 
  Phone, 
  MapPin, 
  Instagram, 
  MessageCircle, 
  ShieldCheck,
  Building2,
  Clock
} from 'lucide-react';

interface FooterProps {
  theme: ThemeConfig;
  branches: BranchLocation[];
  onOpenAdmin: () => void;
  onOpenCRM?: () => void;
  onOpenUniformSimulator?: () => void;
  onOpenSizingPortal?: () => void;
  onSelectCategory: (cat: string) => void;
  onOpenLookbook?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  theme,
  branches,
  onOpenAdmin,
  onOpenCRM,
  onOpenUniformSimulator,
  onOpenSizingPortal,
  onOpenLookbook,
}) => {
  const accent = theme.accentColor || '#FDB813';
  const iconColor = theme.iconColor || accent;

  return (
    <footer 
      id="pampero-footer" 
      className="text-[#F5F2EC] pt-14 pb-10 border-t border-neutral-800 transition-colors"
      style={{ backgroundColor: theme.primaryColor || '#18231C' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          
          {/* Col 1: Brand & PamperoLogo */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 select-none">
              <PamperoLogo 
                customUrl={theme.customLogoUrl || theme.logoUrl} 
                variant="light" 
                onDarkBackground={true}
                imageClassName="brightness-0 invert filter"
                size="lg" 
                height={theme.logoHeight || 52} 
              />
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              Catálogo digital de exhibición. Precios e imágenes sujetos a actualización. Distribución oficial en Gran Mendoza.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/5492615276713?text=Hola%20Pampero%20Gran%20Mendoza,%20quisiera%20consultar%20su%20cat%C3%A1logo.`}
                target="_blank"
                rel="noreferrer"
                style={{ backgroundColor: accent }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-white text-[11px] font-bold uppercase tracking-wider transition-all hover:brightness-110 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp 261 527-6713
              </a>

              <a
                href="https://instagram.com/pamperogranmendoza"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
              >
                <Instagram className="w-3.5 h-3.5" style={{ color: iconColor }} />
                @pamperogranmendoza
              </a>
            </div>
          </div>

          {/* Col 2: Contacto con los textos exactos solicitados */}
          <div className="space-y-3">
            <h4 className="font-display text-xl tracking-[0.08em] text-[#F5F2EC] uppercase font-bold">
              CONTACTO
            </h4>
            <div className="space-y-2.5 text-xs text-neutral-300">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                <span>Teléfono / Celular: <strong className="text-white">261 527-6713</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <Instagram className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                <span>Instagram: <strong className="text-white">@pamperogranmendoza</strong></span>
              </p>
              <p className="text-neutral-300 leading-relaxed text-[11px] pt-1">
                Atención personalizada a particulares y ventas corporativas para cualquier tipo de empresa.
              </p>
            </div>
          </div>

          {/* Col 3: Locales */}
          <div className="space-y-3">
            <h4 className="font-display text-xl tracking-[0.08em] text-[#F5F2EC] uppercase font-bold">
              LOCALES ({branches.length})
            </h4>
            <div className="space-y-3 text-xs text-neutral-300">
              {branches.map((b) => (
                <div key={b.id} className="border-b border-neutral-800 pb-2.5 last:border-0">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" style={{ color: iconColor }} />
                      {b.name}
                    </span>
                    {b.isPrimary && (
                      <span 
                        style={{ backgroundColor: accent }}
                        className="text-[9px] uppercase px-1.5 py-0.5 rounded-xs font-mono text-white"
                      >
                        Casa Central
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-400 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                    {b.address}{b.city ? `, ${b.city}` : ''}
                  </p>
                  <p className="text-neutral-500 text-[10px] mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-neutral-600 shrink-0" />
                    {b.hours || b.openingHours || 'Lun a Vie 8:30 a 19:30 | Sáb 9:00 a 13:30'}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer bottom bar */}
        <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-400">
          <p>© 2026 Pampero Gran Mendoza - Distribución Oficial</p>
        </div>
      </div>
    </footer>
  );
};
