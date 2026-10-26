import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { ImageMetadata, TextLayer, InpaintPatch, DetectedTextRegion } from '../types';
import { calculateFitScale } from '../utils/coordinates';
import { UploadCloud, Image as ImageIcon, HelpCircle, ZoomIn, ZoomOut } from 'lucide-react';

function isPointInPolygon(pt: { x: number; y: number }, poly: number[][]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInBBox(pt: { x: number; y: number }, bbox: number[], padding: number = 10): boolean {
  if (!bbox || bbox.length < 4) return false;
  const [x, y, w, h] = bbox;
  return (
    pt.x >= x - padding &&
    pt.x <= x + w + padding &&
    pt.y >= y - padding &&
    pt.y <= y + h + padding
  );
}

interface CanvasWorkspaceProps {
  image: ImageMetadata | null;
  patches: InpaintPatch[];
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<TextLayer>, commitHistory?: boolean) => void;
  onStartTextEditing?: () => void;
  onEndTextEditing?: (hasChanged: boolean) => void;
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
  onHideDetectionOverlay?: () => void;
  onShowDetectionOverlay?: () => void;
  hoveredRegionId?: string | null;
  onHoverRegion?: (regionId: string | null) => void;
  isDetecting?: boolean;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  image,
  patches,
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onStartTextEditing,
  onEndTextEditing,
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
  onHideDetectionOverlay,
  onShowDetectionOverlay,
  hoveredRegionId,
  onHoverRegion,
  isDetecting = false,
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

  const propsRef = useRef({
    image,
    layers,
    detectedRegions,
    onConvertRegion,
    showDetectionOverlay,
    onHideDetectionOverlay,
    onShowDetectionOverlay,
    onSelectLayer,
    onUpdateLayer,
    onStartTextEditing,
    onEndTextEditing,
    onZoomChange,
    onHoverRegion,
  });
  propsRef.current = {
    image,
    layers,
    detectedRegions,
    onConvertRegion,
    showDetectionOverlay,
    onHideDetectionOverlay,
    onShowDetectionOverlay,
    onSelectLayer,
    onUpdateLayer,
    onStartTextEditing,
    onEndTextEditing,
    onZoomChange,
    onHoverRegion,
  };

  // 1. Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#f1f5f9',
      preserveObjectStacking: true,
      selectionColor: 'rgba(15, 23, 42, 0.08)',
      selectionBorderColor: '#0f172a',
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

    // Handle Object Modifications (drag, scale, rotate)
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
      target.initDimensions();
      target.setCoords();

      propsRef.current.onUpdateLayer(target.layerId, {
        left: target.left || 0,
        top: target.top || 0,
        width: scaledWidth,
        height: scaledHeight,
        angle: target.angle || 0,
        fontSize: newFontSize,
        text: target.text || '',
      }, true);
      canvas.renderAll();
    };

    const handleTextChanged = (e: any) => {
      if (isUpdatingFromProps.current) return;
      const target = e.target as (fabric.Textbox & { layerId?: string });
      if (!target || !target.layerId) return;

      propsRef.current.onUpdateLayer(target.layerId, {
        text: target.text || '',
      }, false);
    };

    let textBeforeEditing: string = '';
    const handleEditingEntered = (e: any) => {
      const target = e.target as (fabric.Textbox & { layerId?: string });
      if (!target) return;
      textBeforeEditing = target.text || '';
      propsRef.current.onStartTextEditing?.();
    };

    const handleEditingExited = (e: any) => {
      if (isUpdatingFromProps.current) return;
      const target = e.target as (fabric.Textbox & { layerId?: string });
      if (!target || !target.layerId) return;

      const hasChanged = (target.text || '') !== textBeforeEditing;
      propsRef.current.onEndTextEditing?.(hasChanged);
      if (hasChanged) {
        propsRef.current.onUpdateLayer(target.layerId, {
          text: target.text || '',
        }, false);
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('text:changed', handleTextChanged);
    canvas.on('text:editing:entered', handleEditingEntered);
    canvas.on('text:editing:exited', handleEditingExited);

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

    // Touch and Mouse Helpers
    let lastTouchDistance = 0;
    let touchDownPos = { x: 0, y: 0 };
    let hasMoved = false;

    const getEvtPos = (e: any) => {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX ?? 0, y: e.clientY ?? 0 };
    };

    // Panning & Outside Click Handling
    canvas.on('mouse:down', (opt) => {
      const e = opt.e as any;
      const isTouch = Boolean(e && e.touches);
      const isBgTouch = isTouch && !opt.target;

      const pos = getEvtPos(e);
      touchDownPos = { x: pos.x, y: pos.y };
      hasMoved = false;

      if (isSpacePressed || (e && e.button === 1) || isBgTouch) {
        isPanningRef.current = true;
        lastPanPos.current = { x: pos.x, y: pos.y };
        if (isTouch && e.touches.length === 2) {
          lastTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
        canvas.setCursor('grab');
      }
    });

    canvas.on('mouse:move', (opt) => {
      const e = opt.e as any;
      const pos = getEvtPos(e);

      if (Math.hypot(pos.x - touchDownPos.x, pos.y - touchDownPos.y) > 6) {
        hasMoved = true;
      }

      // Handle 2-finger touch pinch-to-zoom
      if (e && e.touches && e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDistance > 0) {
          const ratio = dist / lastTouchDistance;
          let newZoom = canvas.getZoom() * ratio;
          newZoom = Math.min(Math.max(0.1, newZoom), 5.0);
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const rect = canvas.upperCanvasEl.getBoundingClientRect();
          const point = new fabric.Point(midX - rect.left, midY - rect.top);
          canvas.zoomToPoint(point, newZoom);
          onZoomChange(newZoom);
        }
        lastTouchDistance = dist;
        return;
      }

      if (isPanningRef.current) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += pos.x - lastPanPos.current.x;
          vpt[5] += pos.y - lastPanPos.current.y;
          canvas.requestRenderAll();
          lastPanPos.current = { x: pos.x, y: pos.y };
        }
      }
    });

    canvas.on('mouse:up', (opt) => {
      isPanningRef.current = false;
      lastTouchDistance = 0;
      canvas.setCursor('default');

      // If user was panning / dragging (> 6px moved), do not treat as tap or click
      if (hasMoved) return;

      const scenePt = (canvas as any).getScenePoint
        ? (canvas as any).getScenePoint(opt.e)
        : (canvas as any).getPointer(opt.e);

      if (!scenePt) return;

      const {
        detectedRegions: curRegions,
        onConvertRegion: curConvert,
        onShowDetectionOverlay: curShow,
        onHideDetectionOverlay: curHide,
        showDetectionOverlay: isOverlayOn,
        layers: curLayers,
        onSelectLayer: curSelect,
      } = propsRef.current;

      // 1. Did user tap an unconverted detected OCR text region?
      let targetRegion: DetectedTextRegion | undefined;

      if (opt.target && (opt.target as any).regionData) {
        targetRegion = (opt.target as any).regionData;
      } else if (curRegions && curRegions.length > 0) {
        targetRegion = curRegions.find(
          (r) =>
            !r.isConverted &&
            (isPointInPolygon(scenePt, r.polygon) || isPointInBBox(scenePt, r.bbox, 12))
        );
      }

      if (targetRegion) {
        // Tapped on detected text! Re-enable overlay and convert to editable text layer
        if (curShow) curShow();
        curConvert(targetRegion);
        return;
      }

      // 2. Did user tap an existing editable TextLayer?
      if (opt.target && (opt.target as any).layerId) {
        curSelect((opt.target as any).layerId);
        return;
      }

      if (curLayers && curLayers.length > 0) {
        for (const [layerId, tbObj] of objectMapRef.current.entries()) {
          const layer = curLayers.find((l) => l.id === layerId);
          if (layer && layer.isVisible && !layer.isLocked) {
            if ((tbObj as any).containsPoint?.(scenePt)) {
              curSelect(layerId);
              return;
            }
          }
        }
      }

      // 3. User tapped outside any detected text or layer (on background or empty image)
      // Disable detected text overlay and deselect any selected layer
      if (isOverlayOn && curHide) {
        curHide();
      }
      curSelect(null);
      setHoveredRegion(null);
      propsRef.current.onHoverRegion?.(null);
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
        canvas.backgroundColor = '#f1f5f9';
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
        shadow: new fabric.Shadow({
          color: 'rgba(15, 23, 42, 0.12)',
          blur: 20,
          offsetX: 0,
          offsetY: 8,
        }),
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

  // 4. Render Detected OCR Polygons Overlay (keeps ghost hitboxes active even when visual overlay is dismissed)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const currentPolys = detectedPolygonsRef.current;

    currentPolys.forEach((p) => canvas.remove(p));
    currentPolys.clear();

    if (!image) {
      canvas.renderAll();
      return;
    }

    const isVisible = showDetectionOverlay;

    detectedRegions.forEach((region) => {
      if (region.isConverted) return;

      const isHov = region.regionId === hoveredRegionId;
      const points = region.polygon.map((p) => ({ x: p[0], y: p[1] }));
      const poly = new fabric.Polygon(points, {
        fill: isHov
          ? (isVisible ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.25)')
          : (isVisible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.001)'),
        stroke: isHov
          ? (isVisible ? '#34d399' : '#10b981')
          : (isVisible ? '#10b981' : 'transparent'),
        strokeWidth: isHov
          ? (isVisible ? 3 : 1.5)
          : (isVisible ? 2 : 0),
        strokeDashArray: isHov ? [3, 2] : (isVisible ? [4, 3] : undefined),
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
      });

      (poly as any).regionData = region;

      poly.on('mouseover', (opt) => {
        const isOverlayOn = propsRef.current.showDetectionOverlay;
        poly.set({
          fill: isOverlayOn ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.25)',
          stroke: isOverlayOn ? '#34d399' : '#10b981',
          strokeWidth: isOverlayOn ? 3 : 1.5,
          strokeDashArray: isOverlayOn ? [4, 3] : [3, 2],
        });
        canvas.requestRenderAll();
        propsRef.current.onHoverRegion?.(region.regionId);

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
        const isOverlayOn = propsRef.current.showDetectionOverlay;
        poly.set({
          fill: isOverlayOn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.001)',
          stroke: isOverlayOn ? '#10b981' : 'transparent',
          strokeWidth: isOverlayOn ? 2 : 0,
          strokeDashArray: isOverlayOn ? [4, 3] : undefined,
        });
        canvas.requestRenderAll();
        setHoveredRegion(null);
        propsRef.current.onHoverRegion?.(null);
      });

      poly.on('mousedown', () => {
        setHoveredRegion(null);
        propsRef.current.onHoverRegion?.(null);
        // Re-activate detection overlay if it was hidden
        if (!propsRef.current.showDetectionOverlay && propsRef.current.onShowDetectionOverlay) {
          propsRef.current.onShowDetectionOverlay();
        }
        onConvertRegion(region);
      });

      currentPolys.set(region.regionId, poly);
      canvas.add(poly);
    });

    canvas.renderAll();
  }, [detectedRegions, showDetectionOverlay, image, onConvertRegion]);

  // Synchronize canvas polygon highlight when hovered from sidebar or canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const currentPolys = detectedPolygonsRef.current;
    const isVisible = showDetectionOverlay;

    currentPolys.forEach((poly, id) => {
      const isHov = id === hoveredRegionId;
      if (isVisible) {
        poly.set({
          fill: isHov ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.15)',
          stroke: isHov ? '#34d399' : '#10b981',
          strokeWidth: isHov ? 3 : 2,
          strokeDashArray: [4, 3],
        });
      } else {
        poly.set({
          fill: isHov ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 0, 0, 0.001)',
          stroke: isHov ? '#10b981' : 'transparent',
          strokeWidth: isHov ? 1.5 : 0,
          strokeDashArray: isHov ? [3, 2] : undefined,
        });
      }
    });
    canvas.requestRenderAll();
  }, [hoveredRegionId, showDetectionOverlay]);

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

      const shadowConfig = layer.shadow && layer.shadow.blur > 0
        ? new fabric.Shadow({
            color: layer.shadow.color,
            blur: layer.shadow.blur,
            offsetX: layer.shadow.offsetX,
            offsetY: layer.shadow.offsetY,
          })
        : undefined;

      const isMobile =
        typeof window !== 'undefined' &&
        (window.innerWidth < 768 ||
          'ontouchstart' in window ||
          (navigator as any).maxTouchPoints > 0);

      const controlOptions = {
        borderColor: '#3b82f6',
        borderScaleFactor: isMobile ? 2.5 : 1.5,
        cornerColor: '#3b82f6',
        cornerStrokeColor: '#ffffff',
        cornerStyle: 'circle' as const,
        cornerSize: isMobile ? 18 : 10,
        touchCornerSize: 36,
        transparentCorners: false,
        padding: 6,
        hasControls: true,
        hasBorders: true,
      };

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
          shadow: shadowConfig,
          visible: shouldBeVisible,
          lockMovementX: layer.isLocked,
          lockMovementY: layer.isLocked,
          lockRotation: layer.isLocked,
          lockScalingX: layer.isLocked,
          lockScalingY: layer.isLocked,
          editable: !layer.isLocked,
          ...controlOptions,
        });

        (tb as any).layerId = layer.id;
        const textObj = tb;
        let lastTap = 0;
        tb.on('mousedown', () => {
          const now = Date.now();
          if (now - lastTap < 350) {
            // Rapid double-tap or double-click enters inline editing mode
            if (!layer.isLocked && textObj) {
              textObj.enterEditing();
              canvas.requestRenderAll();
            }
          }
          lastTap = now;
        });
        tb.on('mousedblclick', () => {
          if (!layer.isLocked && textObj) {
            textObj.enterEditing();
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
          shadow: shadowConfig,
          visible: shouldBeVisible,
          lockMovementX: layer.isLocked,
          lockMovementY: layer.isLocked,
          lockRotation: layer.isLocked,
          lockScalingX: layer.isLocked,
          lockScalingY: layer.isLocked,
          editable: !layer.isLocked,
          ...controlOptions,
        });
        tb.initDimensions();
        tb.setCoords();
      }

      if (selectedLayerId === layer.id && !layer.isLocked && tb) {
        if (canvas.getActiveObject() !== tb) {
          canvas.setActiveObject(tb);
        }
      } else if (selectedLayerId !== layer.id && canvas.getActiveObject() === tb) {
        if (tb.isEditing) {
          tb.exitEditing();
        }
        if (selectedLayerId === null) {
          canvas.discardActiveObject();
        }
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
      onMouseDown={(e) => {
        if (e.target === containerRef.current) {
          if (propsRef.current.showDetectionOverlay && propsRef.current.onHideDetectionOverlay) {
            propsRef.current.onHideDetectionOverlay();
          }
          propsRef.current.onSelectLayer(null);
        }
      }}
      onTouchEnd={(e) => {
        if (e.target === containerRef.current) {
          if (propsRef.current.showDetectionOverlay && propsRef.current.onHideDetectionOverlay) {
            propsRef.current.onHideDetectionOverlay();
          }
          propsRef.current.onSelectLayer(null);
        }
      }}
      className={`relative flex-1 h-full w-full overflow-hidden bg-slate-100 ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasElRef} id="editor-canvas" className="w-full h-full block" />

      {/* Scanning Document Animation (from LottieFiles scanning-document) */}
      {isDetecting && image && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px] transition-all duration-200">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center justify-center max-w-xs text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-32 h-32 sm:w-36 sm:h-36 relative flex items-center justify-center mb-2">
              <img
                src="/scanning-document.gif"
                alt="Scanning Document"
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
              Scanning Document...
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[210px] leading-relaxed">
              Detecting text regions and matching typography
            </p>
          </div>
        </div>
      )}

      {/* Hover Tooltip for Detected Text Region */}
      {hoveredRegion && (
        <div
          className="fixed z-40 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-2.5 py-1.5 rounded-md bg-white/95 border border-slate-200 shadow-xl backdrop-blur-sm text-xs select-none flex flex-col gap-0.5"
          style={{ left: hoveredRegion.x, top: hoveredRegion.y - 12 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-900 font-semibold max-w-[220px] truncate">{hoveredRegion.text}</span>
            <span className="text-[10px] font-mono px-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {Math.round(hoveredRegion.confidence * 100)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Click to edit on canvas</span>
        </div>
      )}

      {/* Split Comparison Overlay */}
      {image && isComparing && compareMode === 'split' && (
        <div className="absolute inset-0 pointer-events-none select-none">
          <div
            className="absolute top-0 bottom-0 border-r-2 border-slate-900 z-30 shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize"
            style={{ left: `${splitPosition}%` }}
            onTouchStart={(e) => {
              const startX = e.touches[0].clientX;
              const startPos = splitPosition;
              const handleTouchMove = (moveEvent: TouchEvent) => {
                if (!containerRef.current || moveEvent.touches.length === 0) return;
                const rect = containerRef.current.getBoundingClientRect();
                const diff = ((moveEvent.touches[0].clientX - startX) / rect.width) * 100;
                const newPos = Math.max(5, Math.min(95, startPos + diff));
                onSplitChange(newPos);
              };
              const handleTouchEnd = () => {
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
              };
              window.addEventListener('touchmove', handleTouchMove);
              window.addEventListener('touchend', handleTouchEnd);
            }}
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
            <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] sm:text-[10px] shadow-md">
              ⇄
            </div>
          </div>
          <div className="absolute top-3 left-4 px-2.5 py-1 rounded-full bg-white/90 text-slate-800 text-[10px] font-mono border border-slate-200 shadow-xs">
            ORIGINAL
          </div>
          <div className="absolute top-3 right-4 px-2.5 py-1 rounded-full bg-white/90 text-slate-800 text-[10px] font-mono border border-slate-200 shadow-xs">
            EDITED
          </div>
        </div>
      )}

      {/* Empty State */}
      {!image && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none pointer-events-auto">
          <div
            className={`w-full max-w-lg p-6 sm:p-10 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center ${
              isDraggingOver
                ? 'border-slate-800 bg-slate-200/50 scale-[1.02]'
                : 'border-slate-300 bg-white shadow-sm hover:border-slate-400'
            }`}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center mb-4 shadow-xs">
              <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
              Drag & Drop your Image here
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm px-2">
              Supports PNG, JPG, JPEG, and WebP. Automatically detects text regions with PaddleOCR.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 mt-6 w-full sm:w-auto">
              <label className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer transition-all active:scale-95">
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
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-slate-500" />
                Load Sample Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Hint */}
      {image && (
        <div className="absolute bottom-3 left-3 sm:left-4 flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-[10px] sm:text-[11px] text-slate-600 pointer-events-none select-none shadow-xs z-10">
          <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="hidden sm:inline">Hold Space + Drag to Pan • Mouse Wheel to Zoom</span>
          <span className="sm:hidden">Drag canvas to pan • Pinch to zoom</span>
        </div>
      )}

      {/* Floating Canvas Zoom Controls */}
      {image && (
        <div className="absolute bottom-3 right-3 flex items-center bg-white/95 backdrop-blur-md rounded-full p-1 border border-slate-200 shadow-md gap-1 z-20">
          <button
            onClick={() => onZoomChange(Math.max(0.1, _zoom * 0.85))}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            className="px-1.5 text-[11px] font-mono text-slate-700 hover:text-slate-900"
            title="Reset zoom"
          >
            {Math.round(_zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(5.0, _zoom * 1.15))}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </main>
  );
};
