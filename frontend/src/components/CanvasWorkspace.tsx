import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { ImageMetadata, TextLayer, InpaintPatch, DetectedTextRegion } from '../types';
import { calculateFitScale } from '../utils/coordinates';
import { UploadCloud, Image as ImageIcon, HelpCircle } from 'lucide-react';

interface CanvasWorkspaceProps {
  image: ImageMetadata | null;
  patches: InpaintPatch[];
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  isComparing: boolean;
  compareMode: 'toggle' | 'split';
  splitPosition: number;
  onSplitChange: (pos: number) => void;
  onDropImage: (file: File) => void;
  onLoadSample: () => void;
  // OCR detection overlay
  detectedRegions: DetectedTextRegion[];
  showDetectionOverlay: boolean;
  onConvertRegion: (region: DetectedTextRegion) => void;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  image,
  patches,
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  zoom: _zoom,
  onZoomChange,
  isComparing,
  compareMode,
  splitPosition,
  onSplitChange,
  onDropImage,
  onLoadSample,
  detectedRegions,
  showDetectionOverlay,
  onConvertRegion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const baseImageRef = useRef<fabric.FabricImage | null>(null);
  const objectMapRef = useRef<Map<string, fabric.Textbox>>(new Map());
  const patchMapRef = useRef<Map<string, fabric.FabricImage>>(new Map());
  const detectedPolygonsRef = useRef<Map<string, fabric.Polygon>>(new Map());
  const isUpdatingFromProps = useRef<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredRegion, setHoveredRegion] = useState<{ text: string; confidence: number; x: number; y: number } | null>(null);

  // 1. Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#0b0d13',
      preserveObjectStacking: true,
      selectionColor: 'rgba(59, 130, 246, 0.15)',
      selectionBorderColor: '#3b82f6',
      selectionLineWidth: 1.5,
    });

    fabricCanvasRef.current = canvas;

    // Handle Selection Events
    canvas.on('selection:created', (e) => {
      if (isUpdatingFromProps.current) return;
      const selected = e.selected?.[0] as (fabric.Textbox & { layerId?: string });
      if (selected?.layerId) {
        onSelectLayer(selected.layerId);
      }
    });

    canvas.on('selection:updated', (e) => {
      if (isUpdatingFromProps.current) return;
      const selected = e.selected?.[0] as (fabric.Textbox & { layerId?: string });
      if (selected?.layerId) {
        onSelectLayer(selected.layerId);
      }
    });

    canvas.on('selection:cleared', () => {
      if (isUpdatingFromProps.current) return;
      onSelectLayer(null);
    });

    // Handle Object Modifications
    const handleModified = (e: any) => {
      if (isUpdatingFromProps.current) return;
      const target = e.target as (fabric.Textbox & { layerId?: string });
      if (!target || !target.layerId) return;

      const scaleX = target.scaleX || 1;
      const scaleY = target.scaleY || 1;
      const scaledWidth = (target.width || 100) * scaleX;
      const scaledHeight = (target.height || 40) * scaleY;
      const newFontSize = (target.fontSize || 32) * ((scaleX + scaleY) / 2);

      target.set({
        scaleX: 1,
        scaleY: 1,
        width: scaledWidth,
        fontSize: newFontSize,
      });

      onUpdateLayer(target.layerId, {
        left: target.left || 0,
        top: target.top || 0,
        width: scaledWidth,
        height: scaledHeight,
        angle: target.angle || 0,
        fontSize: newFontSize,
        text: target.text || '',
      });
      canvas.renderAll();
    };

    canvas.on('object:modified', handleModified);
    canvas.on('text:changed', handleModified);

    // Zooming via Wheel
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let newZoom = canvas.getZoom() * (delta > 0 ? 0.92 : 1.08);
      newZoom = Math.min(Math.max(0.1, newZoom), 5.0);
      const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(point, newZoom);
      onZoomChange(newZoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Panning
    canvas.on('mouse:down', (opt) => {
      const mouseEvt = opt.e as MouseEvent;
      if (isSpacePressed || (mouseEvt && mouseEvt.button === 1)) {
        isPanningRef.current = true;
        if (mouseEvt) {
          lastPanPos.current = { x: mouseEvt.clientX, y: mouseEvt.clientY };
        }
        canvas.setCursor('grab');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanningRef.current) {
        const mouseEvt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt && mouseEvt) {
          vpt[4] += mouseEvt.clientX - lastPanPos.current.x;
          vpt[5] += mouseEvt.clientY - lastPanPos.current.y;
          canvas.requestRenderAll();
          lastPanPos.current = { x: mouseEvt.clientX, y: mouseEvt.clientY };
        }
      }
    });

    canvas.on('mouse:up', () => {
      isPanningRef.current = false;
      canvas.setCursor('default');
    });

    // Window Resize Observer
    const handleResize = () => {
      if (containerRef.current && canvas) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        canvas.renderAll();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Space key listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        isPanningRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 2. Load Base Image onto Fabric Canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !image) {
      if (canvas && !image) {
        canvas.clear();
        canvas.backgroundColor = '#0b0d13';
        canvas.renderAll();
      }
      return;
    }

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = image.dataUrl;

    imgEl.onload = () => {
      if (!fabricCanvasRef.current) return;
      const c = fabricCanvasRef.current;

      if (baseImageRef.current) {
        c.remove(baseImageRef.current);
      }

      const fabImg = new fabric.FabricImage(imgEl, {
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      });

      baseImageRef.current = fabImg;
      c.insertAt(0, fabImg);

      const fitScale = calculateFitScale(image.width, image.height, c.getWidth(), c.getHeight(), 40);
      const panX = (c.getWidth() - image.width * fitScale) / 2;
      const panY = (c.getHeight() - image.height * fitScale) / 2;

      c.setViewportTransform([fitScale, 0, 0, fitScale, panX, panY]);
      onZoomChange(fitScale);
      c.renderAll();
    };
  }, [image]);

  // 3. Render Inpaint Patches directly onto Canvas (above base image, below text layers)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !image) return;

    const currentPatchMap = patchMapRef.current;
    const activePatchIds = new Set(patches.map((p) => p.id));

    // Remove deleted patches
    for (const [id, fabImg] of currentPatchMap.entries()) {
      if (!activePatchIds.has(id)) {
        canvas.remove(fabImg);
        currentPatchMap.delete(id);
      }
    }

    // Add or update patches
    patches.forEach((patch) => {
      if (currentPatchMap.has(patch.id)) {
        const existing = currentPatchMap.get(patch.id)!;
        existing.set('visible', !isComparing || compareMode === 'split');
        return;
      }

      const patchImgEl = new Image();
      patchImgEl.crossOrigin = 'anonymous';
      patchImgEl.src = patch.dataUrl;

      patchImgEl.onload = () => {
        if (!fabricCanvasRef.current) return;
        const c = fabricCanvasRef.current;

        const fabPatch = new fabric.FabricImage(patchImgEl, {
          left: patch.bounds.left,
          top: patch.bounds.top,
          selectable: false,
          evented: false,
          hoverCursor: 'default',
          visible: !isComparing || compareMode === 'split',
        });

        currentPatchMap.set(patch.id, fabPatch);
        // Insert above base image
        c.insertAt(1, fabPatch);
        c.renderAll();
      };
    });

    canvas.renderAll();
  }, [patches, isComparing, compareMode, image]);

  // 4. Render Detected OCR Polygons Overlay
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const currentPolys = detectedPolygonsRef.current;

    currentPolys.forEach((p) => canvas.remove(p));
    currentPolys.clear();

    if (!showDetectionOverlay || !image) {
      canvas.renderAll();
      return;
    }

    detectedRegions.forEach((region) => {
      if (region.isConverted) return;

      const points = region.polygon.map((p) => ({ x: p[0], y: p[1] }));
      const poly = new fabric.Polygon(points, {
        fill: 'rgba(16, 185, 129, 0.15)',
        stroke: '#10b981',
        strokeWidth: 2,
        strokeDashArray: [4, 3],
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
      });

      (poly as any).regionData = region;

      poly.on('mouseover', (opt) => {
        poly.set({
          fill: 'rgba(16, 185, 129, 0.35)',
          stroke: '#34d399',
          strokeWidth: 2.5,
        });
        canvas.renderAll();

        const mouseEvt = opt.e as MouseEvent;
        if (mouseEvt) {
          setHoveredRegion({
            text: region.text,
            confidence: region.confidence,
            x: mouseEvt.clientX,
            y: mouseEvt.clientY,
          });
        }
      });

      poly.on('mouseout', () => {
        poly.set({
          fill: 'rgba(16, 185, 129, 0.15)',
          stroke: '#10b981',
          strokeWidth: 2,
        });
        canvas.renderAll();
        setHoveredRegion(null);
      });

      poly.on('mousedown', () => {
        setHoveredRegion(null);
        onConvertRegion(region);
      });

      currentPolys.set(region.regionId, poly);
      canvas.add(poly);
    });

    canvas.renderAll();
  }, [detectedRegions, showDetectionOverlay, image, onConvertRegion]);

  // 5. Synchronize Text Layers with Fabric Textbox Objects
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !image) return;

    isUpdatingFromProps.current = true;
    const currentMap = objectMapRef.current;
    const activeLayerIds = new Set(layers.map((l) => l.id));

    for (const [id, tb] of currentMap.entries()) {
      if (!activeLayerIds.has(id)) {
        canvas.remove(tb);
        currentMap.delete(id);
      }
    }

    layers.forEach((layer) => {
      let tb = currentMap.get(layer.id);
      const shouldBeVisible =
        layer.isVisible && (!isComparing || compareMode === 'split');

      if (!tb) {
        tb = new fabric.Textbox(layer.text, {
          left: layer.left,
          top: layer.top,
          width: layer.width,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          fontStyle: layer.fontStyle,
          fill: layer.fill,
          stroke: layer.stroke || undefined,
          strokeWidth: layer.strokeWidth || 0,
          textAlign: layer.textAlign,
          angle: layer.angle || 0,
          opacity: layer.opacity,
          visible: shouldBeVisible,
          lockMovementX: layer.isLocked,
          lockMovementY: layer.isLocked,
          lockRotation: layer.isLocked,
          lockScalingX: layer.isLocked,
          lockScalingY: layer.isLocked,
          editable: !layer.isLocked,
          borderColor: '#3b82f6',
          cornerColor: '#3b82f6',
          cornerSize: 8,
          transparentCorners: false,
          padding: 4,
        });

        (tb as any).layerId = layer.id;
        const textObj = tb;
        tb.on('mousedblclick', () => {
          if (!layer.isLocked && textObj) {
            textObj.enterEditing();
            textObj.selectAll();
            canvas.requestRenderAll();
          }
        });
        currentMap.set(layer.id, tb);
        canvas.add(tb);
      } else {
        tb.set({
          text: layer.text,
          left: layer.left,
          top: layer.top,
          width: layer.width,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          fontStyle: layer.fontStyle,
          fill: layer.fill,
          stroke: layer.stroke || undefined,
          strokeWidth: layer.strokeWidth || 0,
          textAlign: layer.textAlign,
          angle: layer.angle || 0,
          opacity: layer.opacity,
          visible: shouldBeVisible,
          lockMovementX: layer.isLocked,
          lockMovementY: layer.isLocked,
          lockRotation: layer.isLocked,
          lockScalingX: layer.isLocked,
          lockScalingY: layer.isLocked,
          editable: !layer.isLocked,
        });
      }

      if (selectedLayerId === layer.id && !layer.isLocked && tb) {
        const activeTb = tb;
        canvas.setActiveObject(activeTb);
        setTimeout(() => {
          if (fabricCanvasRef.current && fabricCanvasRef.current.getActiveObject() === activeTb && !activeTb.isEditing) {
            activeTb.enterEditing();
            activeTb.selectAll();
            fabricCanvasRef.current.requestRenderAll();
          }
        }, 50);
      } else if (selectedLayerId === null && canvas.getActiveObject() === tb) {
        canvas.discardActiveObject();
      }
    });

    if (isComparing && compareMode === 'toggle') {
      currentMap.forEach((tb) => tb.set('visible', false));
    }

    canvas.renderAll();
    isUpdatingFromProps.current = false;
  }, [layers, selectedLayerId, isComparing, compareMode, image]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onDropImage(e.dataTransfer.files[0]);
    }
  };

  return (
    <main
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 h-full w-full overflow-hidden bg-[#0a0c12] ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasElRef} id="editor-canvas" className="w-full h-full block" />

      {/* Hover Tooltip for Detected Text Region */}
      {hoveredRegion && (
        <div
          className="fixed z-40 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-2.5 py-1.5 rounded-md bg-[#131722]/95 border border-emerald-500/50 shadow-xl backdrop-blur-sm text-xs select-none flex flex-col gap-0.5"
          style={{ left: hoveredRegion.x, top: hoveredRegion.y - 12 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-white font-medium max-w-[220px] truncate">{hoveredRegion.text}</span>
            <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300">
              {Math.round(hoveredRegion.confidence * 100)}%
            </span>
          </div>
          <span className="text-[10px] text-emerald-400/90 font-medium">Click to edit on canvas</span>
        </div>
      )}

      {/* Split Comparison Overlay */}
      {image && isComparing && compareMode === 'split' && (
        <div className="absolute inset-0 pointer-events-none select-none">
          <div
            className="absolute top-0 bottom-0 border-r-2 border-amber-400 z-30 shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize"
            style={{ left: `${splitPosition}%` }}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startPos = splitPosition;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const diff = ((moveEvent.clientX - startX) / rect.width) * 100;
                const newPos = Math.max(5, Math.min(95, startPos + diff));
                onSplitChange(newPos);
              };
              const handleMouseUp = () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-[10px] shadow-md">
              ⇄
            </div>
          </div>
          <div className="absolute top-3 left-4 px-2 py-1 rounded bg-black/70 text-amber-300 text-[10px] font-mono border border-amber-500/30">
            BEFORE (ORIGINAL)
          </div>
          <div className="absolute top-3 right-4 px-2 py-1 rounded bg-black/70 text-blue-300 text-[10px] font-mono border border-blue-500/30">
            AFTER (RECONSTRUCTED)
          </div>
        </div>
      )}

      {/* Empty State */}
      {!image && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
          <div
            className={`w-full max-w-lg p-10 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center ${
              isDraggingOver
                ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                : 'border-[#262c3d] bg-[#12151e]/80 hover:border-blue-500/40'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-semibold text-white tracking-tight">
              Drag & Drop your Image here
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Supports PNG, JPG, JPEG, and WebP. Automatically detects text regions with PaddleOCR.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all active:scale-95">
                <UploadCloud className="w-4 h-4" />
                Browse File
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onDropImage(e.target.files[0]);
                    }
                  }}
                />
              </label>

              <button
                onClick={onLoadSample}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#1a1f2e] hover:bg-[#242b3e] text-blue-300 border border-blue-500/30 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-blue-400" />
                Load Sample Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Hint */}
      {image && (
        <div className="absolute bottom-3 left-4 flex items-center gap-2 px-2.5 py-1 rounded bg-[#12151e]/80 backdrop-blur border border-[#212636] text-[11px] text-gray-400 pointer-events-none select-none shadow">
          <HelpCircle className="w-3 h-3 text-blue-400" />
          <span>Hold Space + Drag to Pan • Mouse Wheel to Zoom</span>
        </div>
      )}
    </main>
  );
};
