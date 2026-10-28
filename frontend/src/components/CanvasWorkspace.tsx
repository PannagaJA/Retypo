import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { ImageMetadata, TextLayer, InpaintPatch, DetectedTextRegion, WordRegion } from '../types';
import { calculateFitScale } from '../utils/coordinates';
import { UploadCloud, HelpCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
  onLoadSample?: () => void;
  // OCR detection overlay & hierarchical selection
  detectedRegions: DetectedTextRegion[];
  showDetectionOverlay: boolean;
  selectionLevel?: 'line' | 'word' | 'block';
  onSelectionLevelChange?: (level: 'line' | 'word' | 'block') => void;
  onConvertRegion: (region: DetectedTextRegion) => void;
  onConvertWord?: (region: DetectedTextRegion, word: WordRegion) => void;
  onConvertBlock?: (regions: DetectedTextRegion[]) => void;
  onHideDetectionOverlay?: () => void;
  onShowDetectionOverlay?: () => void;
  hoveredRegionId?: string | null;
  onHoverRegion?: (regionId: string | null) => void;
  isDetecting?: boolean;
  fitTrigger?: number;
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
  detectedRegions,
  showDetectionOverlay,
  selectionLevel: propsSelectionLevel,
  onSelectionLevelChange,
  onConvertRegion,
  onConvertWord,
  onConvertBlock,
  onHideDetectionOverlay,
  onShowDetectionOverlay,
  hoveredRegionId,
  onHoverRegion,
  isDetecting = false,
  fitTrigger = 0,
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
  const isSpacePressedRef = useRef<boolean>(false);
  const isInternalZoomUpdate = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [internalSelectionLevel, setInternalSelectionLevel] = useState<'line' | 'word' | 'block'>('line');
  const selectionLevel = propsSelectionLevel || internalSelectionLevel;

  const handleSelectionLevelChange = (level: 'line' | 'word' | 'block') => {
    setInternalSelectionLevel(level);
    onSelectionLevelChange?.(level);
  };

  const [hoveredRegion, setHoveredRegion] = useState<{
    text: string;
    confidence: number;
    screenX: number;
    screenY: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const computePolygonScreenPlacement = (poly: [number, number][]) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !containerRef.current || !poly || poly.length === 0) return null;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const centerX = (minX + maxX) / 2;
    const screenCenterX = rect.left + centerX * vpt[0] + vpt[4];
    const screenTopY = rect.top + minY * vpt[3] + vpt[5];
    const screenBottomY = rect.top + maxY * vpt[3] + vpt[5];

    // Tooltip requires ~52px height + clearance.
    // If there is enough room above the region within the viewport and container, place on top.
    // Otherwise place below the region so text is never obscured.
    const hasRoomAbove = screenTopY - rect.top > 65 && screenTopY > 70;
    const placement: 'top' | 'bottom' = hasRoomAbove ? 'top' : 'bottom';
    const screenY = hasRoomAbove ? screenTopY - 10 : screenBottomY + 10;

    // Clamp horizontally so tooltip stays comfortably inside the canvas / screen
    const halfWidth = 140;
    const minScreenX = Math.max(rect.left + halfWidth + 8, halfWidth + 8);
    const maxScreenX = Math.min(rect.right - halfWidth - 8, window.innerWidth - halfWidth - 8);
    const screenX = Math.max(minScreenX, Math.min(maxScreenX, screenCenterX));

    return { screenX, screenY, placement };
  };

  const propsRef = useRef({
    image,
    layers,
    detectedRegions,
    onConvertRegion,
    onConvertWord,
    onConvertBlock,
    selectionLevel,
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
    onConvertWord,
    onConvertBlock,
    selectionLevel,
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
      selection: false,
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
      const pos = getEvtPos(e);
      touchDownPos = { x: pos.x, y: pos.y };
      hasMoved = false;

      // Check if target is an editable text layer, detected text region, or active transform control
      const isDetectedRegion = Boolean(opt.target && (opt.target as any).regionData);
      const isSelectableTarget = Boolean(opt.target && (opt.target.selectable || isDetectedRegion));
      const isTransformControl = Boolean(
        opt.target &&
        (canvas as any)._currentTransform
      );

      // Pan when holding outside any selectable text layer/control/traced region, or holding space, or middle click
      const shouldPan = (!isSelectableTarget && !isTransformControl) || isSpacePressedRef.current || (e && e.button === 1);

      if (shouldPan) {
        isPanningRef.current = true;
        lastPanPos.current = { x: pos.x, y: pos.y };
        canvas.setCursor('grab');

        if (e && e.touches && e.touches.length === 2) {
          lastTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
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
          isInternalZoomUpdate.current = true;
          onZoomChange(newZoom);
        }
        lastTouchDistance = dist;
        return;
      }

      if (isPanningRef.current) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          const dx = pos.x - lastPanPos.current.x;
          const dy = pos.y - lastPanPos.current.y;
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.setViewportTransform(vpt);
          canvas.requestRenderAll();
          lastPanPos.current = { x: pos.x, y: pos.y };
          canvas.setCursor('grabbing');
        }
      }
    });

    canvas.on('mouse:up', (opt) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.setViewportTransform(canvas.viewportTransform);
        canvas.requestRenderAll();
      }
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
        targetRegion =
          curRegions.find((r) => !r.isConverted && isPointInPolygon(scenePt, r.polygon)) ||
          curRegions.find((r) => !r.isConverted && isPointInBBox(scenePt, r.bbox, 3));
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

    // Global mouseup/touchend listeners to safely reset panning
    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = true;
        canvas.setCursor('default');
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Space key listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsSpacePressed(true);
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        isSpacePressedRef.current = false;
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
      isInternalZoomUpdate.current = true;
      onZoomChange(fitScale);
      c.renderAll();
    };
  }, [image]);

  // Respond to fitTrigger prop changes (e.g. Fit to view button in Header)
  useEffect(() => {
    if (fitTrigger && fitTrigger > 0) {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !containerRef.current || !image) return;
      const cWidth = containerRef.current.clientWidth;
      const cHeight = containerRef.current.clientHeight;
      const fitScale = calculateFitScale(image.width, image.height, cWidth, cHeight, 40);
      const panX = (cWidth - image.width * fitScale) / 2;
      const panY = (cHeight - image.height * fitScale) / 2;
      canvas.setViewportTransform([fitScale, 0, 0, fitScale, panX, panY]);
      canvas.requestRenderAll();
      isInternalZoomUpdate.current = true;
      onZoomChange(fitScale);
    }
  }, [fitTrigger, image, onZoomChange]);

  // Respond to zoom prop changes from external (e.g. Header + / - buttons or reset)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !containerRef.current) return;
    if (isInternalZoomUpdate.current) {
      isInternalZoomUpdate.current = false;
      return;
    }
    const currentZoom = canvas.getZoom();
    if (Math.abs(currentZoom - _zoom) < 0.001) return;

    const centerPoint = new fabric.Point(
      containerRef.current.clientWidth / 2,
      containerRef.current.clientHeight / 2
    );
    canvas.zoomToPoint(centerPoint, _zoom);
    canvas.requestRenderAll();
  }, [_zoom]);

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

  // 4. Render Detected OCR Polygons Overlay with multi-level selection support (Line, Word, Block)
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
    const unconvertedRegions = detectedRegions.filter((r) => !r.isConverted);

    if (selectionLevel === 'line') {
      // Default: Clean single dashed rectangle per line / text field (No word box clutter!)
      unconvertedRegions.forEach((region) => {
        const isHov = region.regionId === hoveredRegionId;
        const points = region.polygon.map((p) => ({ x: p[0], y: p[1] }));
        const poly = new fabric.Polygon(points, {
          fill: isHov
            ? (isVisible ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)')
            : (isVisible ? 'rgba(255, 111, 66, 0.14)' : 'rgba(0, 0, 0, 0.001)'),
          stroke: isHov
            ? (isVisible ? '#ff5400' : '#ff6f42')
            : (isVisible ? '#ff6f42' : 'transparent'),
          strokeWidth: isVisible || isHov ? 2 : 0,
          strokeUniform: true,
          strokeDashArray: isVisible || isHov ? [4, 3] : undefined,
          selectable: false,
          evented: true,
          hoverCursor: 'pointer',
        });

        (poly as any).regionData = region;
        (poly as any).polyCoords = region.polygon;
        (poly as any).hoverText = region.text;
        (poly as any).hoverConf = region.confidence;
        (poly as any).level = 'line';

        poly.on('mouseover', () => {
          const isOverlayOn = propsRef.current.showDetectionOverlay;
          poly.set({
            fill: isOverlayOn ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)',
            stroke: isOverlayOn ? '#ff5400' : '#ff6f42',
            strokeWidth: 2,
            strokeUniform: true,
            strokeDashArray: [4, 3],
          });
          canvas.requestRenderAll();
          propsRef.current.onHoverRegion?.(region.regionId);

          const placement = computePolygonScreenPlacement(region.polygon);
          if (placement) {
            setHoveredRegion({
              text: region.text,
              confidence: region.confidence,
              ...placement,
            });
          }
        });

        poly.on('mouseout', () => {
          const isOverlayOn = propsRef.current.showDetectionOverlay;
          poly.set({
            fill: isOverlayOn ? 'rgba(255, 111, 66, 0.14)' : 'rgba(0, 0, 0, 0.001)',
            stroke: isOverlayOn ? '#ff6f42' : 'transparent',
            strokeWidth: isOverlayOn ? 2 : 0,
            strokeUniform: true,
            strokeDashArray: isOverlayOn ? [4, 3] : undefined,
          });
          canvas.requestRenderAll();
          setHoveredRegion(null);
          propsRef.current.onHoverRegion?.(null);
        });

        poly.on('mousedown', () => {
          setHoveredRegion(null);
          propsRef.current.onHoverRegion?.(null);
          if (!propsRef.current.showDetectionOverlay && propsRef.current.onShowDetectionOverlay) {
            propsRef.current.onShowDetectionOverlay();
          }
          onConvertRegion(region);
        });

        currentPolys.set(region.regionId, poly);
        canvas.add(poly);
      });
    } else if (selectionLevel === 'word') {
      // Word Selection Level: shows individual word boxes for fine-grained editing
      unconvertedRegions.forEach((region) => {
        const words = region.words && region.words.length > 0 ? region.words : [
          {
            wordId: `${region.regionId}-w0`,
            text: region.text,
            polygon: region.polygon,
            bbox: region.bbox,
            confidence: region.confidence,
          }
        ];

        words.forEach((w) => {
          const isHov = w.wordId === hoveredRegionId;
          const points = w.polygon.map((p) => ({ x: p[0], y: p[1] }));
          const poly = new fabric.Polygon(points, {
            fill: isHov
              ? (isVisible ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)')
              : (isVisible ? 'rgba(255, 111, 66, 0.16)' : 'rgba(0, 0, 0, 0.001)'),
            stroke: isHov
              ? (isVisible ? '#ff5400' : '#ff6f42')
              : (isVisible ? '#ff6f42' : 'transparent'),
            strokeWidth: isVisible || isHov ? 2 : 0,
            strokeUniform: true,
            strokeDashArray: isVisible || isHov ? [3, 2] : undefined,
            selectable: false,
            evented: true,
            hoverCursor: 'pointer',
          });

          (poly as any).regionData = region;
          (poly as any).wordData = w;
          (poly as any).polyCoords = w.polygon;
          (poly as any).hoverText = w.text;
          (poly as any).hoverConf = w.confidence;
          (poly as any).level = 'word';

          poly.on('mouseover', () => {
            const isOverlayOn = propsRef.current.showDetectionOverlay;
            poly.set({
              fill: isOverlayOn ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)',
              stroke: isOverlayOn ? '#ff5400' : '#ff6f42',
              strokeWidth: 2,
              strokeUniform: true,
              strokeDashArray: [3, 2],
            });
            canvas.requestRenderAll();
            propsRef.current.onHoverRegion?.(w.wordId);

            const placement = computePolygonScreenPlacement(w.polygon);
            if (placement) {
              setHoveredRegion({
                text: w.text,
                confidence: w.confidence,
                ...placement,
              });
            }
          });

          poly.on('mouseout', () => {
            const isOverlayOn = propsRef.current.showDetectionOverlay;
            poly.set({
              fill: isOverlayOn ? 'rgba(255, 111, 66, 0.16)' : 'rgba(0, 0, 0, 0.001)',
              stroke: isOverlayOn ? '#ff6f42' : 'transparent',
              strokeWidth: isOverlayOn ? 2 : 0,
              strokeUniform: true,
              strokeDashArray: isOverlayOn ? [3, 2] : undefined,
            });
            canvas.requestRenderAll();
            setHoveredRegion(null);
            propsRef.current.onHoverRegion?.(null);
          });

          poly.on('mousedown', () => {
            setHoveredRegion(null);
            propsRef.current.onHoverRegion?.(null);
            if (!propsRef.current.showDetectionOverlay && propsRef.current.onShowDetectionOverlay) {
              propsRef.current.onShowDetectionOverlay();
            }
            if (propsRef.current.onConvertWord) {
              propsRef.current.onConvertWord(region, w);
            } else {
              propsRef.current.onConvertRegion({
                ...region,
                text: w.text,
                polygon: w.polygon,
                bbox: w.bbox,
              });
            }
          });

          currentPolys.set(w.wordId, poly);
          canvas.add(poly);
        });
      });
    } else if (selectionLevel === 'block') {
      // Block Selection Level: groups multi-line wrapped sentences into single selectable blocks
      const blockGroups = new Map<string, DetectedTextRegion[]>();
      unconvertedRegions.forEach((r) => {
        const key = r.paragraphId || r.regionId;
        if (!blockGroups.has(key)) blockGroups.set(key, []);
        blockGroups.get(key)!.push(r);
      });

      blockGroups.forEach((groupRegions, blockKey) => {
        const allXs = groupRegions.flatMap((r) => r.polygon.map((p) => p[0]));
        const allYs = groupRegions.flatMap((r) => r.polygon.map((p) => p[1]));
        const minX = Math.min(...allXs);
        const maxX = Math.max(...allXs);
        const minY = Math.min(...allYs);
        const maxY = Math.max(...allYs);

        const blockPoly: [number, number][] = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
        ];

        const isHov = blockKey === hoveredRegionId;
        const points = blockPoly.map((p) => ({ x: p[0], y: p[1] }));
        const poly = new fabric.Polygon(points, {
          fill: isHov
            ? (isVisible ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)')
            : (isVisible ? 'rgba(255, 111, 66, 0.14)' : 'rgba(0, 0, 0, 0.001)'),
          stroke: isHov
            ? (isVisible ? '#ff5400' : '#ff6f42')
            : (isVisible ? '#ff6f42' : 'transparent'),
          strokeWidth: isVisible || isHov ? 2 : 0,
          strokeUniform: true,
          strokeDashArray: isVisible || isHov ? [5, 4] : undefined,
          selectable: false,
          evented: true,
          hoverCursor: 'pointer',
        });

        const combinedText = groupRegions.map((r) => r.text).join(' ');
        const avgConf = groupRegions.reduce((sum, r) => sum + r.confidence, 0) / groupRegions.length;

        (poly as any).blockRegions = groupRegions;
        (poly as any).polyCoords = blockPoly;
        (poly as any).hoverText = combinedText;
        (poly as any).hoverConf = avgConf;
        (poly as any).level = 'block';

        poly.on('mouseover', () => {
          const isOverlayOn = propsRef.current.showDetectionOverlay;
          poly.set({
            fill: isOverlayOn ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.22)',
            stroke: isOverlayOn ? '#ff5400' : '#ff6f42',
            strokeWidth: 2,
            strokeUniform: true,
            strokeDashArray: [5, 4],
          });
          canvas.requestRenderAll();
          propsRef.current.onHoverRegion?.(blockKey);

          const placement = computePolygonScreenPlacement(blockPoly);
          if (placement) {
            setHoveredRegion({
              text: combinedText,
              confidence: avgConf,
              ...placement,
            });
          }
        });

        poly.on('mouseout', () => {
          const isOverlayOn = propsRef.current.showDetectionOverlay;
          poly.set({
            fill: isOverlayOn ? 'rgba(255, 111, 66, 0.14)' : 'rgba(0, 0, 0, 0.001)',
            stroke: isOverlayOn ? '#ff6f42' : 'transparent',
            strokeWidth: isOverlayOn ? 2 : 0,
            strokeUniform: true,
            strokeDashArray: isOverlayOn ? [5, 4] : undefined,
          });
          canvas.requestRenderAll();
          setHoveredRegion(null);
          propsRef.current.onHoverRegion?.(null);
        });

        poly.on('mousedown', () => {
          setHoveredRegion(null);
          propsRef.current.onHoverRegion?.(null);
          if (!propsRef.current.showDetectionOverlay && propsRef.current.onShowDetectionOverlay) {
            propsRef.current.onShowDetectionOverlay();
          }
          if (propsRef.current.onConvertBlock) {
            propsRef.current.onConvertBlock(groupRegions);
          } else {
            groupRegions.forEach((r) => propsRef.current.onConvertRegion(r));
          }
        });

        currentPolys.set(blockKey, poly);
        canvas.add(poly);
      });
    }

    canvas.renderAll();
  }, [detectedRegions, showDetectionOverlay, selectionLevel, image, onConvertRegion, onConvertWord, onConvertBlock]);

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
          fill: isHov ? 'rgba(255, 111, 66, 0.38)' : 'rgba(255, 111, 66, 0.14)',
          stroke: isHov ? '#ff5400' : '#ff6f42',
          strokeWidth: 2,
          strokeUniform: true,
          strokeDashArray: (poly as any).level === 'block' ? [5, 4] : [4, 3],
        });
      } else {
        poly.set({
          fill: isHov ? 'rgba(255, 111, 66, 0.22)' : 'rgba(0, 0, 0, 0.001)',
          stroke: isHov ? '#ff6f42' : 'transparent',
          strokeWidth: isHov ? 2 : 0,
          strokeUniform: true,
          strokeDashArray: isHov ? [3, 2] : undefined,
        });
      }
    });

    if (hoveredRegionId && currentPolys.has(hoveredRegionId)) {
      const poly = currentPolys.get(hoveredRegionId)!;
      const polyCoords = (poly as any).polyCoords;
      if (polyCoords) {
        const placement = computePolygonScreenPlacement(polyCoords);
        if (placement) {
          setHoveredRegion({
            text: (poly as any).hoverText || '',
            confidence: (poly as any).hoverConf || 0.98,
            ...placement,
          });
        }
      }
    } else {
      setHoveredRegion(null);
    }

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
        borderColor: '#ff6f42',
        borderScaleFactor: isMobile ? 1.5 : 1,
        cornerColor: '#ff6f42',
        cornerStrokeColor: '#ffffff',
        cornerStyle: 'circle' as const,
        cornerSize: isMobile ? 8 : 6,
        touchCornerSize: 24,
        transparentCorners: false,
        padding: isMobile ? 10 : 8,
        hasControls: true,
        hasBorders: true,
      };

      const charSpacingVal = layer.letterSpacing
        ? Math.round((layer.letterSpacing / Math.max(1, layer.fontSize)) * 1000)
        : 0;
      const lineHeightVal = layer.lineHeight || 1.16;

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
          charSpacing: charSpacingVal,
          lineHeight: lineHeightVal,
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
          charSpacing: charSpacingVal,
          lineHeight: lineHeightVal,
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

      // Hide middle-top and middle-bottom control handles on textboxes to keep text unobstructed
      tb.setControlVisible('mt', false);
      tb.setControlVisible('mb', false);

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
      className={`relative flex-1 h-full w-full overflow-hidden bg-[#f7f5f0] touch-none ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasElRef} id="editor-canvas" className="w-full h-full block" />

      {/* Floating Multi-Level Selection Bar (Line, Word, Block) */}
      {showDetectionOverlay && image && detectedRegions.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 rounded-full border border-[#e8e4dc] shadow-sm text-xs select-none animate-in fade-in duration-150">
          <span className="text-neutral-500 font-medium px-1.5 text-[11px]">Select:</span>
          <button
            type="button"
            onClick={() => handleSelectionLevelChange('line')}
            className={`px-3 py-1 rounded-full transition-all text-xs font-semibold ${
              selectionLevel === 'line'
                ? 'bg-[#ff6f42] text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#f7f5f0]'
            }`}
            title="Line selection: selects full text lines and fields (Default)"
          >
            Line
          </button>
          <button
            type="button"
            onClick={() => handleSelectionLevelChange('word')}
            className={`px-3 py-1 rounded-full transition-all text-xs font-semibold ${
              selectionLevel === 'word'
                ? 'bg-[#ff6f42] text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#f7f5f0]'
            }`}
            title="Word selection: selects individual words for fine editing"
          >
            Word
          </button>
          <button
            type="button"
            onClick={() => handleSelectionLevelChange('block')}
            className={`px-3 py-1 rounded-full transition-all text-xs font-semibold ${
              selectionLevel === 'block'
                ? 'bg-[#ff6f42] text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#f7f5f0]'
            }`}
            title="Block selection: selects full wrapped sentences or paragraphs"
          >
            Block
          </button>
        </div>
      )}

      {/* Scanning Document Animation (from LottieFiles scanning-document) */}
      {isDetecting && image && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-black/10 backdrop-blur-[2px] transition-all duration-200">
          <div className="bg-white/95 backdrop-blur-md border border-[#e8e4dc] rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center justify-center max-w-xs text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-32 h-32 sm:w-36 sm:h-36 relative flex items-center justify-center mb-2">
              <img
                src="/scanning-document.gif"
                alt="Scanning Document"
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
              Scanning Document...
            </h3>
            <p className="text-[11px] text-neutral-600 mt-1 max-w-[210px] leading-relaxed">
              Detecting text regions and matching typography
            </p>
          </div>
        </div>
      )}

      {/* Hover Tooltip for Detected Text Region */}
      {hoveredRegion && (
        <div
          className={`fixed z-40 pointer-events-none -translate-x-1/2 px-2.5 py-1.5 rounded-xl bg-white/95 border border-[#e8e4dc] shadow-xl backdrop-blur-sm text-xs select-none flex flex-col gap-0.5 transition-transform duration-75 ${
            hoveredRegion.placement === 'top' ? '-translate-y-full' : 'translate-y-0'
          }`}
          style={{ left: hoveredRegion.screenX, top: hoveredRegion.screenY }}
        >
          <div className="flex items-center gap-2">
            <span className="text-neutral-900 font-semibold max-w-[220px] truncate">{hoveredRegion.text}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 font-bold">
              {Math.round(hoveredRegion.confidence * 100)}%
            </span>
          </div>
          <span className="text-[10px] text-[#ff6f42] font-semibold">Click to edit on canvas</span>
        </div>
      )}

      {/* Split Comparison Overlay */}
      {image && isComparing && compareMode === 'split' && (
        <div className="absolute inset-0 pointer-events-none select-none">
          <div
            className="absolute top-0 bottom-0 border-r-2 border-[#ff6f42] z-30 shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize"
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
            <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-[#ff6f42] text-white flex items-center justify-center font-bold text-[11px] sm:text-[10px] shadow-md">
              ⇄
            </div>
          </div>
          <div className="absolute top-3 left-4 px-2.5 py-1 rounded-full bg-white/95 text-neutral-800 text-[10px] font-mono border border-[#e8e4dc] shadow-xs">
            ORIGINAL
          </div>
          <div className="absolute top-3 right-4 px-2.5 py-1 rounded-full bg-white/95 text-neutral-800 text-[10px] font-mono border border-[#e8e4dc] shadow-xs">
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
                ? 'border-[#ff6f42] bg-[#ffefe8]/40 scale-[1.02]'
                : 'border-[#e8e4dc] bg-white shadow-sm hover:border-[#ff6f42]/40'
            }`}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 flex items-center justify-center mb-4 shadow-xs">
              <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h2 className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight">
              Drag & Drop your Image here
            </h2>
            <p className="text-xs text-neutral-600 mt-1 max-w-sm px-2">
              Supports PNG, JPG, JPEG, and WebP. Automatically detects text regions and styles.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 mt-6 w-full sm:w-auto">
              <label className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-md shadow-[#ff6f42]/20 cursor-pointer transition-all active:scale-95">
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

            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Hint */}
      {image && (
        <div className="hidden sm:flex absolute bottom-3 left-3 sm:left-4 items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-white/95 backdrop-blur border border-[#e8e4dc] text-[10px] sm:text-[11px] text-neutral-700 pointer-events-none select-none shadow-xs z-10">
          <HelpCircle className="w-3.5 h-3.5 text-[#ff6f42] shrink-0" />
          <span>Hold Space + Drag to Pan • Mouse Wheel to Zoom</span>
        </div>
      )}

      {/* Floating Canvas Zoom Controls */}
      {image && (
        <div className="absolute bottom-20 sm:bottom-3 right-3 flex items-center bg-white/95 backdrop-blur-md rounded-full p-1 border border-[#e8e4dc] shadow-md gap-1 z-20">
          <button
            onClick={() => onZoomChange(Math.max(0.1, _zoom * 0.85))}
            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            className="px-2 text-[11px] font-mono font-semibold text-neutral-800 hover:text-[#ff6f42]"
            title="Reset zoom"
          >
            {Math.round(_zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(5.0, _zoom * 1.15))}
            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-[#e8e4dc] my-auto mx-0.5" />
          <button
            onClick={() => {
              const canvas = fabricCanvasRef.current;
              if (!canvas || !containerRef.current || !image) return;
              const cWidth = containerRef.current.clientWidth;
              const cHeight = containerRef.current.clientHeight;
              const fitScale = calculateFitScale(image.width, image.height, cWidth, cHeight, 40);
              const panX = (cWidth - image.width * fitScale) / 2;
              const panY = (cHeight - image.height * fitScale) / 2;
              canvas.setViewportTransform([fitScale, 0, 0, fitScale, panX, panY]);
              canvas.requestRenderAll();
              isInternalZoomUpdate.current = true;
              onZoomChange(fitScale);
            }}
            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
            title="Fit to screen"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </main>
  );
};
