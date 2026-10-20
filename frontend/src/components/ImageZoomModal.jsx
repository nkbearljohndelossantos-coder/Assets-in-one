import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';

export default function ImageZoomModal({ isOpen, src, title = 'Image Preview', onClose }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, src]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') resetZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !src) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.3, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.3, 0.5));
  const resetZoom = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = title ? `${title.replace(/\s+/g, '_')}_image` : 'image_download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center text-white z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 max-w-xl truncate">
          <Maximize2 className="h-5 w-5 text-gold-400 flex-shrink-0" />
          <h3 className="font-extrabold text-sm truncate text-slate-100">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-1 flex items-center gap-1 shadow-lg">
            <button 
              onClick={handleZoomOut} 
              title="Zoom Out (-)"
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="text-[11px] font-mono font-bold text-gold-400 min-w-[45px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button 
              onClick={handleZoomIn} 
              title="Zoom In (+)"
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <button 
              onClick={resetZoom} 
              title="Reset Zoom (0)"
              className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-extrabold rounded transition-colors uppercase"
            >
              Reset
            </button>

            <div className="w-[1px] h-4 bg-slate-700 my-auto" />

            <button 
              onClick={handleRotate} 
              title="Rotate 90°"
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button 
              onClick={handleDownload} 
              title="Download Image"
              className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>

          {/* Close button */}
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
            title="Close Preview (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <img 
          src={src} 
          alt={title}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className="max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl rounded pointer-events-auto select-none"
          draggable={false}
        />
      </div>

      {/* Footer Instructions */}
      <div className="text-center text-[11px] text-slate-400 font-mono select-none pointer-events-none">
        Scroll wheel / drag to zoom & move | Click outside or press Esc to close
      </div>

    </div>
  );
}

export function getImageUrl(src) {
  if (!src || src === 'null' || src === 'undefined') return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  const cleanPath = src.startsWith('/') ? src : `/${src}`;
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `http://localhost:5000${cleanPath}`;
  }
  return cleanPath;
}

export function ZoomableImage({ src, alt, className = '', containerClassName = '', fallbackIcon: FallbackIcon }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const resolvedUrl = getImageUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [src, resolvedUrl]);

  if (!resolvedUrl || hasError) {
    if (FallbackIcon) {
      return <FallbackIcon className={className} />;
    }
    return (
      <div className={`bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 flex items-center justify-center text-slate-300 p-2 ${containerClassName || className}`}>
        <Laptop className="h-8 w-8 text-gold-400 drop-shadow" />
      </div>
    );
  }

  return (
    <>
      <div 
        className={`relative group cursor-zoom-in overflow-hidden ${containerClassName}`}
        onClick={() => setModalOpen(true)}
        title="Click to view full image details"
      >
        <img 
          src={resolvedUrl} 
          alt={alt || 'Image'} 
          className={`transition-transform duration-300 group-hover:scale-105 ${className}`}
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
          <ZoomIn className="h-5 w-5 text-white drop-shadow" />
        </div>
      </div>

      <ImageZoomModal 
        isOpen={modalOpen} 
        src={resolvedUrl} 
        title={alt || 'Asset Image Preview'} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  );
}
