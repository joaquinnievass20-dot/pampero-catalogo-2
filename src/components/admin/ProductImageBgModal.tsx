import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  Check,
  X,
  RefreshCw,
  Sliders,
  Maximize2,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  removeProductBackgroundFast,
  removeProductBackgroundWithAI,
  removeStudioBackgroundCanvas,
} from '../../utils/productBackgroundRemover';

export interface BgQueueItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  whiteBgDataUrl: string | null;
  whiteBgFile: File | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  progressLabel: string;
  useWhiteBg: boolean;
  engine: 'ai' | 'studio';
  tolerance: number;
  studioPadding: boolean;
  error?: string;
}

interface ProductImageBgModalProps {
  isOpen: boolean;
  files: File[];
  onCancel: () => void;
  onConfirm: (approvedFiles: File[]) => void;
}

export const ProductImageBgModal: React.FC<ProductImageBgModalProps> = ({
  isOpen,
  files,
  onCancel,
  onConfirm,
}) => {
  const [items, setItems] = useState<BgQueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isMountedRef = useRef(true);
  const runIdRef = useRef(0);
  const itemVersionRef = useRef<Record<number, number>>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Inicializar cola y procesar automáticamente al abrir
  useEffect(() => {
    if (!isOpen || !files || files.length === 0) {
      setItems([]);
      setActiveIndex(0);
      return;
    }

    const currentRunId = ++runIdRef.current;
    itemVersionRef.current = {};

    const initialItems: BgQueueItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      whiteBgDataUrl: null,
      whiteBgFile: null,
      status: 'pending',
      progress: 0,
      progressLabel: 'En cola...',
      useWhiteBg: true,
      engine: 'ai',
      tolerance: 34,
      studioPadding: false,
    }));

    setItems(initialItems);
    setActiveIndex(0);

    const processSequentially = async () => {
      for (let i = 0; i < initialItems.length; i++) {
        if (!isMountedRef.current || runIdRef.current !== currentRunId) break;
        if ((itemVersionRef.current[i] || 0) > 0) continue; // Ya reprocesado manualmente por el usuario

        const myVersion = (itemVersionRef.current[i] = 1);
        const isCurrentItemActive = () =>
          isMountedRef.current &&
          runIdRef.current === currentRunId &&
          itemVersionRef.current[i] === myVersion;

        const targetItem = initialItems[i];

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: 'processing', progress: 5, progressLabel: 'Analizando fondo de la foto...' }
              : it
          )
        );

        try {
          const res = await removeProductBackgroundFast(
            targetItem.originalFile,
            (pct, label) => {
              if (!isCurrentItemActive()) return;
              setItems((prev) =>
                prev.map((it, idx) =>
                  idx === i ? { ...it, progress: pct, progressLabel: label } : it
                )
              );
            },
            { studioPadding: false, fileName: targetItem.originalFile.name }
          );

          if (!isCurrentItemActive()) continue;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: 'done',
                    progress: 100,
                    progressLabel: res.engineUsed === 'studio' ? 'Fondo borrado al instante' : 'Fondo blanco listo',
                    whiteBgDataUrl: res.whiteBgDataUrl,
                    whiteBgFile: res.whiteBgFile,
                    engine: res.engineUsed,
                  }
                : it
            )
          );
        } catch (aiErr: any) {
          if (!isCurrentItemActive()) continue;
          console.warn('[BG REMOVAL] Fallback a borrado rápido en canvas:', aiErr);
          try {
            const studioRes = await removeStudioBackgroundCanvas(
              targetItem.originalFile,
              34,
              14,
              { studioPadding: false, fileName: targetItem.originalFile.name }
            );
            if (!isCurrentItemActive()) continue;
            setItems((prev) =>
              prev.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: 'done',
                      progress: 100,
                      progressLabel: 'Fondo borrado (Modo Rápido)',
                      whiteBgDataUrl: studioRes.whiteBgDataUrl,
                      whiteBgFile: studioRes.whiteBgFile,
                      engine: 'studio',
                    }
                  : it
              )
            );
          } catch (studioErr: any) {
            if (!isCurrentItemActive()) continue;
            setItems((prev) =>
              prev.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: 'error',
                      progress: 0,
                      progressLabel: 'Error al borrar fondo',
                      useWhiteBg: false,
                      error: studioErr?.message || 'No se pudo procesar automáticamente. Podés usar la foto original.',
                    }
                  : it
              )
            );
          }
        }
      }
    };

    processSequentially();

    return () => {
      initialItems.forEach((it) => {
        try {
          URL.revokeObjectURL(it.originalUrl);
        } catch {}
      });
    };
  }, [isOpen, files]);

  if (!isOpen || items.length === 0) return null;

  const activeItem = items[activeIndex] || items[0];
  const anyProcessing = items.some((it) => it.status === 'pending' || it.status === 'processing');

  const reprocessActiveItem = async (
    nextEngine: 'ai' | 'studio',
    nextTolerance: number,
    nextPadding: boolean
  ) => {
    const idx = activeIndex;
    const current = items[idx];
    if (!current) return;

    const currentRunId = runIdRef.current;
    const myVersion = (itemVersionRef.current[idx] = (itemVersionRef.current[idx] || 0) + 1);
    const isStillValid = () =>
      isMountedRef.current &&
      runIdRef.current === currentRunId &&
      itemVersionRef.current[idx] === myVersion;

    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              engine: nextEngine,
              tolerance: nextTolerance,
              studioPadding: nextPadding,
              status: 'processing',
              progress: 15,
              progressLabel:
                nextEngine === 'ai'
                  ? 'Procesando con motor IA rápido...'
                  : 'Borrando fondo al instante...',
              error: undefined,
            }
          : it
      )
    );

    try {
      const res =
        nextEngine === 'ai'
          ? await removeProductBackgroundWithAI(
              current.originalFile,
              (pct, label) => {
                if (!isStillValid()) return;
                setItems((prev) =>
                  prev.map((it, i) =>
                    i === idx ? { ...it, progress: pct, progressLabel: label } : it
                  )
                );
              },
              { studioPadding: nextPadding, fileName: current.originalFile.name }
            )
          : await removeStudioBackgroundCanvas(
              current.originalFile,
              nextTolerance,
              14,
              { studioPadding: nextPadding, fileName: current.originalFile.name }
            );

      if (!isStillValid()) return;
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                status: 'done',
                progress: 100,
                progressLabel: 'Actualizado',
                whiteBgDataUrl: res.whiteBgDataUrl,
                whiteBgFile: res.whiteBgFile,
                useWhiteBg: true,
              }
            : it
        )
      );
    } catch (err: any) {
      if (!isStillValid()) return;
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                status: 'error',
                progress: 0,
                error: err?.message || 'Error al reprocesar imagen.',
              }
            : it
        )
      );
    }
  };

  const handleAccept = () => {
    const approved = items.map((it) =>
      it.useWhiteBg && it.whiteBgFile ? it.whiteBgFile : it.originalFile
    );
    onConfirm(approved);
  };

  const handleUseAllOriginals = () => {
    onConfirm(items.map((it) => it.originalFile));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-4xl bg-white rounded-xs shadow-2xl border border-[#DCD4C9] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#18231C] text-[#F5F2EC] px-5 py-3.5 flex items-center justify-between border-b border-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#B9522F] text-white rounded-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg uppercase tracking-wider leading-none">
                Previsualización · Eliminación de Fondo (Producto)
              </h3>
              <p className="text-[11px] text-[#DCD4C9] mt-0.5">
                Se elimina únicamente el fondo y se coloca blanco puro (#FFFFFF) sin recortar la foto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-[#A89F91] hover:text-white transition-colors cursor-pointer"
            title="Cancelar subida"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-file strip if > 1 photo */}
        {items.length > 1 && (
          <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#DCD4C9] flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6860] shrink-0 mr-1">
              Fotos ({items.length}):
            </span>
            {items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative flex items-center gap-2 px-2 py-1 rounded-xs border text-left shrink-0 cursor-pointer transition-all ${
                  idx === activeIndex
                    ? 'border-[#B9522F] bg-white shadow-2xs ring-1 ring-[#B9522F]'
                    : 'border-[#DCD4C9] bg-white/70 hover:bg-white'
                }`}
              >
                <img
                  src={it.whiteBgDataUrl || it.originalUrl}
                  alt={it.originalFile.name}
                  className="w-8 h-8 object-contain rounded-xs bg-white border border-neutral-200"
                />
                <div className="max-w-[110px]">
                  <p className="text-[10px] font-mono font-bold text-[#18231C] truncate">
                    {it.originalFile.name}
                  </p>
                  <p className="text-[9px] text-[#6F6860]">
                    {it.status === 'processing' || it.status === 'pending'
                      ? `${it.progress}%`
                      : it.useWhiteBg
                      ? 'Fondo Blanco'
                      : 'Original'}
                  </p>
                </div>
                {it.status === 'done' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-[#FAF8F5]">
          {/* Side by side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div className="bg-white border border-[#DCD4C9] rounded-xs p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6F6860]">
                <span>1. Foto Original</span>
                <span className="font-mono text-[10px] truncate max-w-[180px]" title={activeItem.originalFile.name}>
                  {activeItem.originalFile.name}
                </span>
              </div>
              <div className="aspect-square bg-neutral-100 rounded-xs overflow-hidden border border-neutral-200 flex items-center justify-center">
                <img
                  src={activeItem.originalUrl}
                  alt="Foto Original"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>

            {/* White Background Preview */}
            <div className="bg-white border-2 border-[#18231C] rounded-xs p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#18231C]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#B9522F]" />
                  2. Resultado con Fondo Blanco
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {activeItem.engine === 'ai' ? 'IA Rápida' : 'Estudio Instantáneo'}
                </span>
              </div>

              <div className="aspect-square bg-white rounded-xs overflow-hidden border border-neutral-200 flex items-center justify-center relative">
                {activeItem.status === 'processing' || activeItem.status === 'pending' ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <Loader2 className="w-8 h-8 text-[#B9522F] animate-spin" />
                    <div>
                      <p className="text-xs font-bold text-[#18231C]">
                        {activeItem.progressLabel}
                      </p>
                      <div className="w-48 h-2 bg-neutral-200 rounded-full overflow-hidden mt-2 mx-auto">
                        <div
                          className="h-full bg-[#B9522F] transition-all duration-300"
                          style={{ width: `${activeItem.progress}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        reprocessActiveItem('studio', activeItem.tolerance, activeItem.studioPadding)
                      }
                      className="px-3 py-1.5 bg-[#18231C] hover:bg-black text-white text-[11px] font-bold rounded-xs cursor-pointer transition-colors"
                    >
                      Aplicar al instante (Modo Rápido &lt; 1 seg)
                    </button>
                  </div>
                ) : activeItem.whiteBgDataUrl ? (
                  <img
                    src={activeItem.useWhiteBg ? activeItem.whiteBgDataUrl : activeItem.originalUrl}
                    alt="Previsualización Fondo Blanco"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="p-6 text-center text-xs text-red-700 space-y-2">
                    <AlertCircle className="w-6 h-6 mx-auto text-red-600" />
                    <p>{activeItem.error || 'No se pudo borrar el fondo.'}</p>
                  </div>
                )}

                {activeItem.status === 'done' && (
                  <span
                    className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider shadow-2xs border ${
                      activeItem.useWhiteBg
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-neutral-800 text-white border-black'
                    }`}
                  >
                    {activeItem.useWhiteBg ? 'Se usará Fondo Blanco' : 'Se usará Original'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Adjustment Controls */}
          <div className="bg-white border border-[#DCD4C9] rounded-xs p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#18231C] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#B9522F]" />
                  Modo de Borrado de Fondo:
                </span>

                <button
                  type="button"
                  onClick={() => reprocessActiveItem('studio', activeItem.tolerance, activeItem.studioPadding)}
                  className={`px-2.5 py-1 rounded-xs text-xs font-bold border cursor-pointer transition-colors ${
                    activeItem.engine === 'studio'
                      ? 'bg-[#18231C] text-white border-[#18231C]'
                      : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                  }`}
                >
                  Rápido (Estudio · Instantáneo)
                </button>

                <button
                  type="button"
                  disabled={activeItem.status === 'processing' && activeItem.engine === 'ai'}
                  onClick={() => reprocessActiveItem('ai', activeItem.tolerance, activeItem.studioPadding)}
                  className={`px-2.5 py-1 rounded-xs text-xs font-bold border cursor-pointer transition-colors disabled:opacity-60 ${
                    activeItem.engine === 'ai'
                      ? 'bg-[#18231C] text-white border-[#18231C]'
                      : 'bg-[#FAF8F5] text-[#18231C] border-[#DCD4C9] hover:bg-[#ECE5DC]'
                  }`}
                >
                  Motor IA (Fondos Complejos)
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#18231C] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeItem.studioPadding}
                    disabled={activeItem.status === 'processing'}
                    onChange={(e) =>
                      reprocessActiveItem(activeItem.engine, activeItem.tolerance, e.target.checked)
                    }
                    className="accent-[#B9522F]"
                  />
                  <Maximize2 className="w-3.5 h-3.5 text-[#6F6860]" />
                  <span>Recortar bordes y centrar (opcional)</span>
                </label>

                {activeItem.status === 'done' && (
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((it, i) =>
                          i === activeIndex ? { ...it, useWhiteBg: !it.useWhiteBg } : it
                        )
                      )
                    }
                    className="px-2.5 py-1 rounded-xs text-xs font-bold border border-[#DCD4C9] bg-[#FAF8F5] hover:bg-[#ECE5DC] text-[#18231C] cursor-pointer"
                  >
                    {activeItem.useWhiteBg ? 'Cambiar a Original en esta foto' : 'Usar Fondo Blanco en esta foto'}
                  </button>
                )}
              </div>
            </div>

            {activeItem.engine === 'studio' && (
              <div className="flex items-center gap-3 pt-2 border-t border-[#ECE5DC]">
                <span className="text-xs font-bold text-[#4A453F] shrink-0">
                  Tolerancia de fondo ({activeItem.tolerance}):
                </span>
                <input
                  type="range"
                  min={10}
                  max={85}
                  value={activeItem.tolerance}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setItems((prev) =>
                      prev.map((it, i) => (i === activeIndex ? { ...it, tolerance: val } : it))
                    );
                  }}
                  onMouseUp={() =>
                    reprocessActiveItem('studio', activeItem.tolerance, activeItem.studioPadding)
                  }
                  onTouchEnd={() =>
                    reprocessActiveItem('studio', activeItem.tolerance, activeItem.studioPadding)
                  }
                  className="flex-1 accent-[#B9522F] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() =>
                    reprocessActiveItem('studio', activeItem.tolerance, activeItem.studioPadding)
                  }
                  className="px-2.5 py-1 bg-[#B9522F] text-white text-xs font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white px-5 py-3.5 border-t border-[#DCD4C9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#4A453F] hover:bg-[#FAF8F5] rounded-xs cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleUseAllOriginals}
              className="px-3.5 py-2 border border-[#DCD4C9] text-xs font-bold uppercase tracking-wider text-[#18231C] hover:bg-[#FAF8F5] rounded-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#6F6860]" />
              Subir Fotos Originales
            </button>
          </div>

          <button
            type="button"
            disabled={anyProcessing}
            onClick={handleAccept}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            {anyProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando imágenes...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {items.length > 1
                  ? `Aceptar y Subir (${items.length} fotos)`
                  : 'Aceptar con Fondo Blanco y Subir'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
