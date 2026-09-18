import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Maximize2
} from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productTitle?: string;
  productCode?: string;
  productPrice?: number;
  onViewDetail?: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productTitle = 'Prenda Pampero',
  productCode,
  productPrice,
  onViewDetail,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  const validImages = images && images.length > 0 ? images : ['https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80'];

  // Sync initialIndex when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), validImages.length - 1));
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex, validImages.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, validImages.length]);

  if (!isOpen) return null;

  const currentImage = validImages[currentIndex] || validImages[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.75, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.75, 1);
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleToggleZoom = (e: React.MouseEvent) => {
    // If zoomed, reset to 1x. If 1x, zoom to 2.2x centered on click
    if (zoomLevel > 1) {
      handleResetZoom();
    } else {
      setZoomLevel(2.2);
    }
  };

  // Mouse pan handling when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panPosition.x,
      initialPanY: panPosition.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setPanPosition({
      x: dragStartRef.current.initialPanX + deltaX,
      y: dragStartRef.current.initialPanY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      id="pampero-image-lightbox"
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Header Bar */}
      <div className="w-full px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 bg-black/40 z-20">
        <div className="flex items-center gap-3 text-white">
          <div className="min-w-0">
            <h3 className="font-display text-base sm:text-lg uppercase tracking-wider font-bold truncate">
              {productTitle}
            </h3>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
              {productCode && <span>Cód: {productCode}</span>}
              {productPrice && (
                <>
                  <span>•</span>
                  <span className="text-[#FDB813] font-sans font-bold">
                    ${productPrice.toLocaleString('es-AR')}
                  </span>
                </>
              )}
              {validImages.length > 1 && (
                <>
                  <span>•</span>
                  <span>Foto {currentIndex + 1} de {validImages.length}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          {/* Zoom controls bar */}
          <div className="flex items-center bg-white/10 rounded-xs p-0.5 border border-white/15">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className={`p-1.5 rounded-xs transition-colors ${
                zoomLevel <= 1 ? 'text-white/30 cursor-not-allowed' : 'text-white hover:bg-white/15 cursor-pointer'
              }`}
              title="Alejar (-)"
              aria-label="Alejar imagen"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="px-2 text-[11px] font-mono font-bold text-white min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              className={`p-1.5 rounded-xs transition-colors ${
                zoomLevel >= 3.5 ? 'text-white/30 cursor-not-allowed' : 'text-white hover:bg-white/15 cursor-pointer'
              }`}
              title="Acercar (+)"
              aria-label="Acercar imagen"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-xs text-amber-400 hover:bg-white/15 transition-colors cursor-pointer border-l border-white/15 ml-0.5"
                title="Restablecer tamaño (100%)"
                aria-label="Restablecer zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onViewDetail && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewDetail();
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FDB813] hover:bg-[#E5A70F] text-[#18231C] rounded-xs text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <span>Ver Ficha</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xs bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15 ml-1"
            title="Cerrar (Esc)"
            aria-label="Cerrar modal de imagen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden p-2 sm:p-6"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Navigation Arrows */}
        {validImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-lg"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-lg"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image Container with Zoom & Pan */}
        <div 
          className="relative max-w-full max-h-[80vh] flex items-center justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onClick={handleToggleZoom}
        >
          <img
            src={currentImage}
            alt={productTitle}
            className="max-h-[75vh] max-w-[90vw] object-contain rounded-xs shadow-2xl pointer-events-none select-none"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        </div>

        {/* Floating Zoom Indicator on Mobile / Overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none bg-black/70 backdrop-blur-xs text-white/85 text-[11px] px-3 py-1 rounded-full border border-white/15 flex items-center gap-1.5 shadow-md">
          <Maximize2 className="w-3 h-3 text-[#FDB813]" />
          <span>{zoomLevel > 1 ? 'Arrastrá para recorrer los detalles' : 'Hacé clic en la imagen para ampliar'}</span>
        </div>
      </div>

      {/* Bottom Thumbnails Strip (if > 1 image) */}
      {validImages.length > 1 && (
        <div className="w-full px-4 py-3 bg-black/40 border-t border-white/10 z-20 flex items-center justify-center gap-2 overflow-x-auto">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setZoomLevel(1);
                setPanPosition({ x: 0, y: 0 });
              }}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xs overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 bg-neutral-900 ${
                currentIndex === idx
                  ? 'border-[#FDB813] scale-105 shadow-md opacity-100 ring-1 ring-[#FDB813]'
                  : 'border-white/20 opacity-60 hover:opacity-90'
              }`}
            >
              <img
                src={img}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
