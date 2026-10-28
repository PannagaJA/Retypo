import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageMetadata, TextLayer, InpaintPatch, DetectedTextRegion, WordRegion } from './types';
import { HistoryManager, type EditorSnapshot } from './utils/history';
import { Header } from './components/Header';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ExportModal } from './components/ExportModal';
import { DiscardModal } from './components/DiscardModal';
import { LandingPage } from './components/LandingPage';
import { analyzeImageOCR, restoreBackground } from './services/api';
import { Layers, Type, Maximize2, Eye, Sliders, Copy, Trash2, X, ScanText, Plus, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<'toggle' | 'split'>('toggle');
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [inpaintPatches, setInpaintPatches] = useState<InpaintPatch[]>([]);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'canvas' | 'layers' | 'properties'>('canvas');
  const [isStyleExpanded, setIsStyleExpanded] = useState<boolean>(false);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  // OCR state
  const [detectedRegions, setDetectedRegions] = useState<DetectedTextRegion[]>([]);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const isDetectingRef = useRef<boolean>(false);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState<boolean>(true);
  const [selectionLevel, setSelectionLevel] = useState<'line' | 'word' | 'block'>('line');
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState<string>('en');

  // Inpaint state
  const [isInpainting, setIsInpainting] = useState<boolean>(false);
  const [isInpaintingAll, setIsInpaintingAll] = useState<boolean>(false);

  // Discard Confirmation Modal State
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const [discardModalConfig, setDiscardModalConfig] = useState<{
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
  }>({});
  const [pendingDiscardAction, setPendingDiscardAction] = useState<(() => void) | null>(null);
  const isAllowingUnloadRef = useRef<boolean>(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // History Manager
  const historyRef = useRef<HistoryManager<EditorSnapshot>>(new HistoryManager<EditorSnapshot>(50));
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const imageRef = useRef(image);
  imageRef.current = image;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const inpaintPatchesRef = useRef(inpaintPatches);
  inpaintPatchesRef.current = inpaintPatches;
  const detectedRegionsRef = useRef(detectedRegions);
  detectedRegionsRef.current = detectedRegions;

  // Prevent accidental page refresh / navigation when editing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAllowingUnloadRef.current) return;
      if (!imageRef.current) return;

      e.preventDefault();
      e.returnValue = 'Your changes will be discarded.';
      return 'Your changes will be discarded.';
    };

    window.addEventListener('beforeunload', handleBeforeUnload, { capture: true });
    window.onbeforeunload = handleBeforeUnload;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload, { capture: true });
      window.onbeforeunload = null;
    };
  }, []);

  const textEditingSnapshotRef = useRef<EditorSnapshot | null>(null);
  const lastContinuousPushRef = useRef<{ time: number }>({ time: 0 });

  const getSnapshot = useCallback((): EditorSnapshot => ({
    layers: JSON.parse(JSON.stringify(layersRef.current)),
    inpaintPatches: JSON.parse(JSON.stringify(inpaintPatchesRef.current)),
    convertedRegionIds: detectedRegionsRef.current.filter((r) => r.isConverted).map((r) => r.regionId),
  }), []);

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const pushHistory = useCallback((snapshot?: EditorSnapshot, continuous: boolean = false) => {
    const now = Date.now();
    if (continuous) {
      if (now - lastContinuousPushRef.current.time < 500) {
        return;
      }
      lastContinuousPushRef.current = { time: now };
    } else {
      lastContinuousPushRef.current = { time: 0 };
    }
    const snap = snapshot || getSnapshot();
    historyRef.current.pushState(snap);
    updateUndoRedoState();
  }, [getSnapshot, updateUndoRedoState]);

  const applySnapshot = useCallback((snapshot: EditorSnapshot) => {
    const nextLayers = snapshot.layers || [];
    setLayers(nextLayers);
    setInpaintPatches(snapshot.inpaintPatches || []);
    if (snapshot.convertedRegionIds) {
      const convertedSet = new Set(snapshot.convertedRegionIds);
      setDetectedRegions((prev) =>
        prev.map((r) => ({ ...r, isConverted: convertedSet.has(r.regionId) }))
      );
    }
    setSelectedLayerId((curId) => {
      if (curId && !nextLayers.some((l) => l.id === curId)) {
        return null;
      }
      return curId;
    });
  }, []);

  // Handle Undo
  const handleUndo = useCallback(() => {
    const currentSnap = getSnapshot();
    const prevState = historyRef.current.undo(currentSnap);
    if (prevState) {
      applySnapshot(prevState);
      updateUndoRedoState();
    }
  }, [getSnapshot, applySnapshot, updateUndoRedoState]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    const currentSnap = getSnapshot();
    const nextState = historyRef.current.redo(currentSnap);
    if (nextState) {
      applySnapshot(nextState);
      updateUndoRedoState();
    }
  }, [getSnapshot, applySnapshot, updateUndoRedoState]);

  const handleStartTextEditing = useCallback(() => {
    textEditingSnapshotRef.current = getSnapshot();
  }, [getSnapshot]);

  const handleEndTextEditing = useCallback((hasChanged: boolean) => {
    if (hasChanged && textEditingSnapshotRef.current) {
      historyRef.current.pushState(textEditingSnapshotRef.current);
      updateUndoRedoState();
    }
    textEditingSnapshotRef.current = null;
  }, [updateUndoRedoState]);

  // Run OCR on current image with strict synchronous locking and cancellation
  const handleRunOCR = async (fileToAnalyze?: File | Blob, langOverride?: string) => {
    // 1. Synchronously prevent double submits - guarantees zero duplicate requests if fired in same tick/action
    if (isDetectingRef.current) {
      console.warn('OCR detection is already in progress, ignoring duplicate submit.');
      return;
    }

    const activeLang = langOverride || ocrLang;
    const file = fileToAnalyze || image?.file;
    if (!file && !image?.dataUrl) return;

    // 2. Abort any previous pending in-flight request if present
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    ocrAbortControllerRef.current = abortController;

    isDetectingRef.current = true;
    setIsDetecting(true);

    try {
      let blob: Blob;
      if (file) {
        blob = file;
      } else {
        const res = await fetch(image!.dataUrl, { signal: abortController.signal });
        blob = await res.blob();
      }

      const result = await analyzeImageOCR(blob, image?.fileName || 'image.png', activeLang, {
        signal: abortController.signal,
      });

      // Ignore results if this request was aborted mid-flight
      if (abortController.signal.aborted) return;

      setDetectedRegions(result.regions);
      setShowDetectionOverlay(true);
      if (result.regions.length > 0) {
        showToast(`Detected ${result.regions.length} text region(s). Click any green box to edit.`, 'success');
      } else {
        showToast('No text regions detected in this image.', 'info');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Previous OCR request aborted.');
        return;
      }
      console.warn('Text detection error:', err);
      showToast('Text detection failed. Please check connection.', 'warn');
    } finally {
      if (ocrAbortControllerRef.current === abortController) {
        ocrAbortControllerRef.current = null;
        isDetectingRef.current = false;
        setIsDetecting(false);
      }
    }
  };

  // Convert a single detected OCR region to an editable TextLayer with seamless automatic background restoration & typography matching
  const handleConvertRegion = async (region: DetectedTextRegion) => {
    if (detectedRegions.find((r) => r.regionId === region.regionId)?.isConverted) {
      return;
    }
    const newId = `layer-ocr-${Date.now()}`;
    const newLayer: TextLayer = {
      id: newId,
      text: region.text,
      fontFamily: region.estimatedFontFamily || 'Inter',
      fontSize: region.estimatedFontSize,
      fontWeight: region.estimatedWeight || '400',
      fontStyle: 'normal',
      fill: region.estimatedColor || '#ffffff',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: region.bbox[0],
      top: region.bbox[1],
      width: Math.max(region.bbox[2] * 1.08 + 12, 24),
      height: Math.max(region.bbox[3], 14),
      angle: region.angle || 0,
      opacity: 1,
      blur: 0,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    pushHistory();
    setDetectedRegions((prev) =>
      prev.map((r) => (r.regionId === region.regionId ? { ...r, isConverted: true } : r))
    );

    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newId);

    // Auto Inpaint Background & Match Typography (PhoText 1-click seamless workflow)
    if (image) {
      try {
        let blob: Blob;
        if (image.file) {
          blob = image.file;
        } else {
          const res = await fetch(image.dataUrl);
          blob = await res.blob();
        }

        // Restore background non-destructively so original text is cleanly erased
        // STRICT RULE: Do NOT automatically change font family or size when clicking to edit! Keep as-is.
        const result = await restoreBackground(
          blob,
          region.polygon,
          region.estimatedFontSize,
          'auto',
          2,
          image.fileName || 'image.png'
        );

        const newPatch: InpaintPatch = {
          id: `patch-${newId}`,
          targetLayerId: newId,
          bounds: result.bounds,
          dataUrl: result.patchDataUrl,
          maskDataUrl: result.maskDataUrl,
          strategy: result.strategyUsed as any,
          createdAt: Date.now(),
        };
        setInpaintPatches((prev) => [...prev.filter((p) => p.id !== newPatch.id), newPatch]);
      } catch (err) {
        console.warn('Auto inpaint/typo error:', err);
      }
    }
  };

  // Convert an individual word from a detected text region
  const handleConvertWord = async (region: DetectedTextRegion, word: WordRegion) => {
    const newId = `layer-ocr-w-${Date.now()}`;
    const newLayer: TextLayer = {
      id: newId,
      text: word.text,
      fontFamily: region.estimatedFontFamily || 'Inter',
      fontSize: region.estimatedFontSize,
      fontWeight: region.estimatedWeight || '400',
      fontStyle: 'normal',
      fill: region.estimatedColor || '#ffffff',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: word.bbox[0],
      top: word.bbox[1],
      width: Math.max(word.bbox[2] * 1.08 + 8, 20),
      height: Math.max(word.bbox[3], 14),
      angle: region.angle || 0,
      opacity: 1,
      blur: 0,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    pushHistory();
    setDetectedRegions((prev) =>
      prev.map((r) => {
        if (r.regionId !== region.regionId) return r;
        const remainingWords = (r.words || []).filter((w) => w.wordId !== word.wordId);
        return {
          ...r,
          words: remainingWords,
          isConverted: remainingWords.length === 0,
        };
      })
    );

    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newId);

    if (image) {
      try {
        let blob: Blob = image.file ? image.file : await (await fetch(image.dataUrl)).blob();
        const result = await restoreBackground(
          blob,
          word.polygon,
          region.estimatedFontSize,
          'auto',
          2,
          image.fileName || 'image.png'
        );
        const newPatch: InpaintPatch = {
          id: `patch-${newId}`,
          targetLayerId: newId,
          bounds: result.bounds,
          dataUrl: result.patchDataUrl,
          maskDataUrl: result.maskDataUrl,
          strategy: result.strategyUsed as any,
          createdAt: Date.now(),
        };
        setInpaintPatches((prev) => [...prev.filter((p) => p.id !== newPatch.id), newPatch]);
      } catch (err) {
        console.warn('Word inpaint error:', err);
      }
    }
  };

  // Convert an entire multi-line block / wrapped sentence
  const handleConvertBlock = async (regions: DetectedTextRegion[]) => {
    if (regions.length === 0) return;
    if (regions.length === 1) {
      return handleConvertRegion(regions[0]);
    }

    const newId = `layer-ocr-block-${Date.now()}`;
    const allXs = regions.flatMap((r) => [r.bbox[0], r.bbox[0] + r.bbox[2]]);
    const allYs = regions.flatMap((r) => [r.bbox[1], r.bbox[1] + r.bbox[3]]);
    const minX = Math.min(...allXs);
    const maxX = Math.max(...allXs);
    const minY = Math.min(...allYs);
    const maxY = Math.max(...allYs);

    const combinedText = regions.map((r) => r.text).join('\n');
    const firstRegion = regions[0];

    const newLayer: TextLayer = {
      id: newId,
      text: combinedText,
      fontFamily: firstRegion.estimatedFontFamily || 'Inter',
      fontSize: firstRegion.estimatedFontSize,
      fontWeight: firstRegion.estimatedWeight || '400',
      fontStyle: 'normal',
      fill: firstRegion.estimatedColor || '#ffffff',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.25,
      textAlign: 'left',
      left: minX,
      top: minY,
      width: Math.max((maxX - minX) * 1.05 + 12, 40),
      height: Math.max(maxY - minY, 24),
      angle: firstRegion.angle || 0,
      opacity: 1,
      blur: 0,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    pushHistory();
    const regionIds = new Set(regions.map((r) => r.regionId));
    setDetectedRegions((prev) =>
      prev.map((r) => (regionIds.has(r.regionId) ? { ...r, isConverted: true } : r))
    );

    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newId);

    if (image) {
      try {
        let blob: Blob = image.file ? image.file : await (await fetch(image.dataUrl)).blob();
        for (const reg of regions) {
          const result = await restoreBackground(
            blob,
            reg.polygon,
            reg.estimatedFontSize,
            'auto',
            2,
            image.fileName || 'image.png'
          );
          const newPatch: InpaintPatch = {
            id: `patch-${reg.regionId}-${Date.now()}`,
            targetLayerId: newId,
            bounds: result.bounds,
            dataUrl: result.patchDataUrl,
            maskDataUrl: result.maskDataUrl,
            strategy: result.strategyUsed as any,
            createdAt: Date.now(),
          };
          setInpaintPatches((prev) => [...prev.filter((p) => p.id !== newPatch.id), newPatch]);
        }
      } catch (err) {
        console.warn('Block inpaint error:', err);
      }
    }
  };

  // Convert all unconverted detected regions at once with parallel inpainting
  const handleConvertAllRegions = async () => {
    const unconverted = detectedRegions.filter((r) => !r.isConverted);
    if (unconverted.length === 0) return;

    const baseTimestamp = Date.now();
    const newLayers: TextLayer[] = unconverted.map((region, i) => ({
      id: `layer-ocr-${baseTimestamp}-${i}`,
      text: region.text,
      fontFamily: region.estimatedFontFamily || 'Inter',
      fontSize: region.estimatedFontSize,
      fontWeight: region.estimatedWeight || '400',
      fontStyle: 'normal',
      fill: region.estimatedColor || '#ffffff',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: region.bbox[0],
      top: region.bbox[1],
      width: Math.max(region.bbox[2] * 1.08 + 12, 24),
      height: Math.max(region.bbox[3], 14),
      angle: region.angle || 0,
      opacity: 1,
      blur: 0,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    }));

    pushHistory();
    setDetectedRegions((prev) => prev.map((r) => ({ ...r, isConverted: true })));
    setLayers((prev) => [...prev, ...newLayers]);
    if (newLayers.length > 0) {
      setSelectedLayerId(newLayers[0].id);
    }

    if (image) {
      setIsInpaintingAll(true);
      try {
        let blob: Blob;
        if (image.file) {
          blob = image.file;
        } else {
          const res = await fetch(image.dataUrl);
          blob = await res.blob();
        }

        // Run batch inpainting with concurrency limit of 5
        const patchesToAdd: InpaintPatch[] = [];
        for (let i = 0; i < unconverted.length; i += 5) {
          const batch = unconverted.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map((reg, idx) =>
              restoreBackground(blob, reg.polygon, reg.estimatedFontSize, 'auto', 2, image.fileName).then((res) => ({
                id: `patch-${newLayers[i + idx].id}`,
                targetLayerId: newLayers[i + idx].id,
                bounds: res.bounds,
                dataUrl: res.patchDataUrl,
                strategy: res.strategyUsed as any,
                createdAt: Date.now(),
              }))
            )
          );
          results.forEach((r) => {
            if (r.status === 'fulfilled') patchesToAdd.push(r.value);
          });
        }

        setInpaintPatches((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          patchesToAdd.forEach((p) => map.set(p.id, p));
          return Array.from(map.values());
        });
      } catch (err) {
        console.error('Batch inpainting failed:', err);
      } finally {
        setIsInpaintingAll(false);
      }
    }
  };

  const handleUpdateDetectedText = (regionId: string, newText: string) => {
    setDetectedRegions((prev) =>
      prev.map((r) => (r.regionId === regionId ? { ...r, text: newText } : r))
    );
  };

  const handleDismissDetectedRegion = (regionId: string) => {
    setDetectedRegions((prev) => prev.filter((r) => r.regionId !== regionId));
  };

  // Inpaint / Restore Background for a specific TextLayer
  const handleInpaintLayer = async (layer: TextLayer, strategy: string = 'auto', padding: number = 2) => {
    if (!image) return;
    setIsInpainting(true);
    pushHistory();

    try {
      // Find matching polygon or construct from layer bbox
      let polygon: [number, number][];
      const matchedRegion = detectedRegions.find(
        (r) => Math.abs(r.bbox[0] - layer.left) < 15 && Math.abs(r.bbox[1] - layer.top) < 15
      );

      if (matchedRegion) {
        polygon = matchedRegion.polygon;
      } else {
        const { left, top, width, height } = layer;
        polygon = [
          [left, top],
          [left + width, top],
          [left + width, top + height],
          [left, top + height],
        ];
      }

      let blob: Blob;
      if (image.file) {
        blob = image.file;
      } else {
        const res = await fetch(image.dataUrl);
        blob = await res.blob();
      }

      const result = await restoreBackground(
        blob,
        polygon,
        layer.fontSize,
        strategy,
        padding,
        image.fileName
      );

      const newPatch: InpaintPatch = {
        id: `patch-${layer.id}`,
        bounds: result.bounds,
        dataUrl: result.patchDataUrl,
        strategy: result.strategyUsed as any,
      };

      setInpaintPatches((prev) => {
        const filtered = prev.filter((p) => p.id !== newPatch.id);
        return [...filtered, newPatch];
      });
    } catch (err) {
      console.error('Inpainting error:', err);
    } finally {
      setIsInpainting(false);
    }
  };

  // Inpaint All Detected OCR Regions in bulk
  const handleInpaintAllDetected = async () => {
    if (!image || detectedRegions.length === 0) return;
    setIsInpaintingAll(true);
    pushHistory();

    try {
      let blob: Blob;
      if (image.file) {
        blob = image.file;
      } else {
        const res = await fetch(image.dataUrl);
        blob = await res.blob();
      }

      const newPatches: InpaintPatch[] = [];

      for (const region of detectedRegions) {
        try {
          const res = await restoreBackground(
            blob,
            region.polygon,
            region.estimatedFontSize,
            'auto',
            2,
            image.fileName
          );

          newPatches.push({
            id: `patch-${region.regionId}`,
            bounds: res.bounds,
            dataUrl: res.patchDataUrl,
            strategy: res.strategyUsed as any,
          });
        } catch (e) {
          console.warn('Failed inpainting region:', region.regionId, e);
        }
      }

      setInpaintPatches((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        newPatches.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      });
    } catch (err) {
      console.error('Inpaint all error:', err);
    } finally {
      setIsInpaintingAll(false);
    }
  };

  const handleDeletePatch = (patchId: string) => {
    pushHistory();
    setInpaintPatches((prev) => prev.filter((p) => p.id !== patchId));
  };

  // Load Image File
  const handleImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const meta: ImageMetadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          fileName: file.name,
          format: file.type.replace('image/', ''),
          dataUrl,
          file,
        };
        setImage(meta);
        setLayers([]);
        setSelectedLayerId(null);
        setInpaintPatches([]);
        setDetectedRegions([]);
        historyRef.current.clear();
        updateUndoRedoState();

        handleRunOCR(file);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Generate Sample High-Resolution Poster
  const handleLoadSample = (type: 'magazine' | 'coffee' | 'tech' = 'magazine') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let headline = 'RETYPO STUDIO';
    let subline = 'HIGH-FIDELITY TYPOGRAPHY RECONSTRUCTION';
    let description = 'Precision typography matching, seamless text removal & non-destructive 4K export.';
    let tag = 'PRO EDITION 2026';
    let primaryFont = 'bold 84px "Montserrat", sans-serif';
    let textColor = '#0f172a';
    let accentColor = '#ff6f42';

    if (type === 'coffee') {
      headline = 'ROAST & CO.';
      subline = 'ARTISAN SINGLE ORIGIN';
      description = 'Freshly roasted in small batches with notes of dark chocolate and toasted hazelnut.';
      tag = 'DIRECT TRADE 250G';
      primaryFont = '900 84px "Space Grotesk", sans-serif';
      textColor = '#1c1917';
      accentColor = '#ea580c';

      const grad = ctx.createLinearGradient(0, 0, 1600, 1000);
      grad.addColorStop(0, '#fffbf5');
      grad.addColorStop(0.5, '#fef3e2');
      grad.addColorStop(1, '#faebd7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1000);

      // Warm radial glow
      const radGrad = ctx.createRadialGradient(800, 450, 50, 800, 450, 450);
      radGrad.addColorStop(0, 'rgba(234, 88, 12, 0.08)');
      radGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 1600, 1000);
    } else if (type === 'magazine') {
      headline = 'VOGUE & ATELIER';
      subline = 'THE AUTUMN EDITORIAL';
      description = 'Contemporary architecture, quiet luxury, and the modern visual typography renaissance.';
      tag = 'PARIS & MILAN • ISSUE 42';
      primaryFont = 'bold 84px "Playfair Display", serif';
      textColor = '#18181b';
      accentColor = '#b45309';

      const grad = ctx.createLinearGradient(0, 0, 1600, 1000);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#faf7f2');
      grad.addColorStop(1, '#f4ece1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1000);

      // Subtle editorial borders
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(80, 80, 1440, 840);
    } else {
      // Tech theme
      const grad = ctx.createLinearGradient(0, 0, 1600, 1000);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f8fafc');
      grad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1000);

      // Decorative grid
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1600; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1000);
        ctx.stroke();
      }
      for (let y = 0; y < 1000; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1600, y);
        ctx.stroke();
      }
    }

    // Flattened text inside image
    ctx.fillStyle = '#64748b';
    ctx.font = '600 24px "Inter", sans-serif';
    ctx.fillText(subline, 150, 260);

    ctx.fillStyle = textColor;
    ctx.font = primaryFont;
    ctx.fillText(headline, 150, 390);

    ctx.fillStyle = '#475569';
    ctx.font = '400 28px "Inter", sans-serif';
    ctx.fillText(description, 150, 470);

    ctx.fillStyle = accentColor;
    ctx.font = '600 22px "Outfit", sans-serif';
    ctx.fillText(tag, 150, 560);

    const dataUrl = canvas.toDataURL('image/png');

    const meta: ImageMetadata = {
      width: 1600,
      height: 1000,
      fileName: `retypo_${type}_sample.png`,
      format: 'png',
      dataUrl,
    };

    const sampleDetected: DetectedTextRegion[] = [
      {
        regionId: 'ocr-sample-1',
        text: headline,
        polygon: [[148, 305], [960, 305], [960, 400], [148, 400]],
        bbox: [148, 305, 812, 95],
        angle: 0,
        estimatedFontSize: 84,
        estimatedColor: textColor,
        confidence: 0.988,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-2',
        text: subline,
        polygon: [[148, 235], [780, 235], [780, 268], [148, 268]],
        bbox: [148, 235, 632, 33],
        angle: 0,
        estimatedFontSize: 24,
        estimatedColor: '#64748b',
        confidence: 0.975,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-3',
        text: description,
        polygon: [[148, 442], [1160, 442], [1160, 480], [148, 480]],
        bbox: [148, 442, 1012, 38],
        angle: 0,
        estimatedFontSize: 28,
        estimatedColor: '#475569',
        confidence: 0.965,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-4',
        text: tag,
        polygon: [[148, 538], [520, 538], [520, 570], [148, 570]],
        bbox: [148, 538, 372, 32],
        angle: 0,
        estimatedFontSize: 22,
        estimatedColor: accentColor,
        confidence: 0.992,
        geometryConfidence: 1.0,
        isConverted: false,
      },
    ];

    setImage(meta);
    setLayers([]);
    setSelectedLayerId(null);
    setInpaintPatches([]);
    setDetectedRegions([]);
    setShowDetectionOverlay(true);
    historyRef.current.clear();
    updateUndoRedoState();
    setIsDetecting(true);

    setTimeout(() => {
      setDetectedRegions(sampleDetected);
      setIsDetecting(false);
      showToast(`Detected ${sampleDetected.length} text region(s). Click any green box to edit.`, 'success');
    }, 1200);
  };

  const handleAddText = () => {
    if (!image) return;
    pushHistory();
    const newId = `layer-${Date.now()}`;
    const newLayer: TextLayer = {
      id: newId,
      text: 'Double click to edit',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: '600',
      fontStyle: 'normal',
      fill: '#ffffff',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: image.width / 4,
      top: image.height / 3,
      width: 400,
      height: 70,
      angle: 0,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      origin: 'manual',
    };

    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newId);
  };

  const handleUpdateLayer = (
    id: string,
    updates: Partial<TextLayer>,
    commitHistory: boolean = false,
    continuous: boolean = false
  ) => {
    if (commitHistory) {
      pushHistory(undefined, continuous);
    }
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const handleDuplicateLayer = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;
    pushHistory();

    const duplicated: TextLayer = {
      ...JSON.parse(JSON.stringify(target)),
      id: `layer-${Date.now()}`,
      left: target.left + 25,
      top: target.top + 25,
    };

    setLayers((prev) => [...prev, duplicated]);
    setSelectedLayerId(duplicated.id);
  };

  const handleDeleteLayer = (layerId: string) => {
    pushHistory();
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  };

  const handleBringForward = (layerId: string) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0 || idx === layers.length - 1) return;
    pushHistory();
    const reordered = [...layers];
    const item = reordered.splice(idx, 1)[0];
    reordered.splice(idx + 1, 0, item);
    setLayers(reordered);
  };

  const handleSendBackward = (layerId: string) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    pushHistory();
    const reordered = [...layers];
    const item = reordered.splice(idx, 1)[0];
    reordered.splice(idx - 1, 0, item);
    setLayers(reordered);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardModal(false);
    if (pendingDiscardAction) {
      pendingDiscardAction();
      setPendingDiscardAction(null);
    }
  };

  const handleCloseDiscardModal = () => {
    setShowDiscardModal(false);
    setPendingDiscardAction(null);
  };

  const handleHomeClick = () => {
    if (imageRef.current) {
      setDiscardModalConfig({
        title: 'Discard changes & exit?',
        message: 'You have an active editing session. If you return to the home screen, all your current text edits and inpainting modifications will be discarded.',
        confirmText: 'Discard & Exit',
        cancelText: 'Keep Editing',
      });
      setPendingDiscardAction(() => () => {
        setImage(null);
        setLayers([]);
        setSelectedLayerId(null);
        setInpaintPatches([]);
        setDetectedRegions([]);
        historyRef.current.clear();
        updateUndoRedoState();
      });
      setShowDiscardModal(true);
    } else {
      setImage(null);
      setLayers([]);
      setSelectedLayerId(null);
      setInpaintPatches([]);
      setDetectedRegions([]);
      historyRef.current.clear();
      updateUndoRedoState();
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Intercept page refresh shortcuts (F5 or Cmd+R / Ctrl+R) when editing
      const isRefresh = e.key === 'F5' || (modKey && (e.key === 'r' || e.key === 'R'));
      if (isRefresh && imageRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setDiscardModalConfig({
          title: 'Discard changes & refresh?',
          message: 'You have unsaved changes in your editor. If you refresh now, all your text edits, inpainting, and modifications will be discarded.',
          confirmText: 'Discard & Refresh',
          cancelText: 'Keep Editing',
        });
        setPendingDiscardAction(() => () => {
          isAllowingUnloadRef.current = true;
          window.location.reload();
        });
        setShowDiscardModal(true);
        return;
      }

      const activeTag = (e.target as HTMLElement).tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (modKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (modKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (modKey && e.key.toLowerCase() === 'd') {
        if (selectedLayerId) {
          e.preventDefault();
          handleDuplicateLayer(selectedLayerId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault();
          handleDeleteLayer(selectedLayerId);
        }
      } else if (e.key === 'Escape') {
        setSelectedLayerId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [selectedLayerId, layers, handleUndo, handleRedo]);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const hasInpaintPatch = selectedLayer
    ? inpaintPatches.some((p) => p.id === `patch-${selectedLayer.id}`)
    : false;

  if (!image) {
    return (
      <div id="landing-scroll-container" className="flex flex-col min-h-screen min-h-[100dvh] w-screen bg-[#f7f5f0] text-slate-900 relative overflow-y-auto overflow-x-hidden">
        <LandingPage
          onSelectImage={handleImageSelected}
          onLoadSample={handleLoadSample}
        />

        {/* Floating Status Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 shadow-xl text-xs font-medium text-slate-800 max-w-[90vw]">
            <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'warn' ? 'bg-amber-500' : 'bg-blue-500'} shrink-0`} />
            <span className="truncate">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-700 shrink-0">✕</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-screen overflow-hidden bg-[#f7f5f0] text-neutral-950 relative">
      {/* Top Header */}
      <Header
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(5.0, z * 1.15))}
        onZoomOut={() => setZoom((z) => Math.max(0.1, z * 0.85))}
        onZoomFit={() => setFitTrigger((t) => t + 1)}
        onZoomReset={() => setZoom(1.0)}
        onImageSelected={(file) => {
          const hasUnsavedChanges = Boolean(image) && (
            layers.length > 0 ||
            inpaintPatches.length > 0 ||
            canUndo ||
            detectedRegions.some((r) => r.isConverted)
          );
          if (hasUnsavedChanges) {
            setDiscardModalConfig({
              title: 'Discard current edits?',
              message: 'Opening a new image will discard all your current text edits and modifications.',
              confirmText: 'Discard & Open',
              cancelText: 'Keep Editing',
            });
            setPendingDiscardAction(() => () => handleImageSelected(file));
            setShowDiscardModal(true);
          } else {
            handleImageSelected(file);
          }
        }}
        onLoadSample={() => {
          const hasUnsavedChanges = Boolean(image) && (
            layers.length > 0 ||
            inpaintPatches.length > 0 ||
            canUndo ||
            detectedRegions.some((r) => r.isConverted)
          );
          if (hasUnsavedChanges) {
            setDiscardModalConfig({
              title: 'Discard current edits?',
              message: 'Loading a sample template will discard all your current text edits and modifications.',
              confirmText: 'Discard & Load',
              cancelText: 'Keep Editing',
            });
            setPendingDiscardAction(() => () => handleLoadSample('magazine'));
            setShowDiscardModal(true);
          } else {
            handleLoadSample('magazine');
          }
        }}
        isComparing={isComparing}
        onToggleCompare={() => setIsComparing((c) => !c)}
        compareMode={compareMode}
        onChangeCompareMode={setCompareMode}
        onOpenExport={() => setIsExportOpen(true)}
        hasImage={Boolean(image)}
        isDetecting={isDetecting}
        onRunOCR={() => handleRunOCR()}
        showDetectionOverlay={showDetectionOverlay}
        onToggleDetectionOverlay={() => setShowDetectionOverlay((v) => !v)}
        detectedCount={detectedRegions.length}
        ocrLang={ocrLang}
        onChangeOcrLang={(l) => {
          setOcrLang(l);
          handleRunOCR(undefined, l);
        }}
        onHome={handleHomeClick}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] overflow-hidden relative">
        {/* Left: Layers & Inpaint Patches Panel */}
        <div
          className={`
            lg:static lg:block lg:w-72 lg:h-full lg:z-auto
            ${
              mobileTab === 'layers'
                ? 'fixed inset-x-0 bottom-0 z-40 h-[58vh] max-h-[58dvh] bg-[#fdfbf9] rounded-t-3xl shadow-[0_-12px_48px_rgba(0,0,0,0.12)] border-t border-[#e8e4dc] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200'
                : 'hidden lg:flex'
            }
          `}
        >
          <div className="lg:hidden w-12 h-1.5 bg-[#dcd7ce] rounded-full mx-auto my-2.5 shrink-0" />
          <LayersPanel
            image={image}
            patches={inpaintPatches}
            layers={layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onAddText={handleAddText}
            onToggleVisibility={(id) => {
              const layer = layers.find((l) => l.id === id);
              if (layer) handleUpdateLayer(id, { isVisible: !layer.isVisible }, true);
            }}
            onToggleLock={(id) => {
              const layer = layers.find((l) => l.id === id);
              if (layer) handleUpdateLayer(id, { isLocked: !layer.isLocked }, true);
            }}
            onDeleteLayer={handleDeleteLayer}
            onDeletePatch={handleDeletePatch}
            detectedRegions={detectedRegions}
            onConvertRegion={(region) => {
              handleConvertRegion(region);
              setMobileTab('canvas');
            }}
            onConvertAllRegions={handleConvertAllRegions}
            onUpdateDetectedText={handleUpdateDetectedText}
            onDismissDetectedRegion={handleDismissDetectedRegion}
            onRunOCR={() => handleRunOCR()}
            isDetecting={isDetecting}
            onShowDetectionOverlay={() => setShowDetectionOverlay(true)}
            hoveredRegionId={hoveredRegionId}
            onHoverRegion={setHoveredRegionId}
            onInpaintAllDetected={handleInpaintAllDetected}
            isInpaintingAll={isInpaintingAll}
            onClose={() => setMobileTab('canvas')}
          />
        </div>

        {/* Center: Interactive Fabric.js Canvas */}
        <CanvasWorkspace
          image={image}
          patches={inpaintPatches}
          layers={layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onUpdateLayer={handleUpdateLayer}
          onStartTextEditing={handleStartTextEditing}
          onEndTextEditing={handleEndTextEditing}
          zoom={zoom}
          onZoomChange={setZoom}
          fitTrigger={fitTrigger}
          isComparing={isComparing}
          compareMode={compareMode}
          splitPosition={splitPosition}
          onSplitChange={setSplitPosition}
          onDropImage={handleImageSelected}
          onLoadSample={handleLoadSample}
          detectedRegions={detectedRegions}
          showDetectionOverlay={showDetectionOverlay}
          selectionLevel={selectionLevel}
          onSelectionLevelChange={setSelectionLevel}
          onConvertRegion={handleConvertRegion}
          onConvertWord={handleConvertWord}
          onConvertBlock={handleConvertBlock}
          onHideDetectionOverlay={() => setShowDetectionOverlay(false)}
          onShowDetectionOverlay={() => setShowDetectionOverlay(true)}
          hoveredRegionId={hoveredRegionId}
          onHoverRegion={setHoveredRegionId}
          isDetecting={isDetecting}
        />

        {/* Right: Typography & Inpainting Properties Inspector */}
        <div
          className={`
            lg:static lg:block lg:w-80 lg:h-full lg:z-auto
            ${
              mobileTab === 'properties'
                ? `fixed inset-x-0 bottom-0 z-40 ${
                    isStyleExpanded ? 'h-[75vh] max-h-[75dvh]' : 'h-[38vh] max-h-[38dvh] sm:h-[42vh] sm:max-h-[42dvh]'
                  } bg-[#fdfbf9] rounded-t-3xl shadow-[0_-12px_48px_rgba(0,0,0,0.15)] border-t border-[#e8e4dc] flex flex-col overflow-hidden transition-[height] duration-200 ease-out`
                : 'hidden lg:flex'
            }
          `}
        >
          {/* Mobile Drag / Expand Handle */}
          <div
            onClick={() => setIsStyleExpanded((v) => !v)}
            className="lg:hidden w-full flex items-center justify-center py-2 cursor-pointer hover:bg-[#ffefe8]/40 active:bg-[#ffefe8] transition-colors shrink-0 group select-none"
            title={isStyleExpanded ? 'Tap to collapse' : 'Tap to expand'}
          >
            <div className="w-10 h-1.5 bg-[#dcd7ce] group-hover:bg-[#ff6f42] rounded-full transition-colors" />
          </div>
          <PropertiesPanel
            layer={selectedLayer}
            image={image}
            onChange={(updates) => {
              if (selectedLayerId) {
                const isContinuous =
                  'opacity' in updates ||
                  'blur' in updates ||
                  'strokeWidth' in updates ||
                  'letterSpacing' in updates ||
                  'lineHeight' in updates ||
                  'text' in updates;
                handleUpdateLayer(selectedLayerId, updates, true, isContinuous);
              }
            }}
            onDuplicate={handleDuplicateLayer}
            onDelete={handleDeleteLayer}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onInpaintLayer={handleInpaintLayer}
            isInpainting={isInpainting}
            hasInpaintPatch={hasInpaintPatch}
            onClose={() => setMobileTab('canvas')}
          />
        </div>

        {/* Backdrop for Mobile Drawers */}
        {mobileTab !== 'canvas' && (
          <div
            className={`lg:hidden fixed inset-0 z-30 transition-opacity ${
              mobileTab === 'properties'
                ? 'bg-transparent pointer-events-none'
                : 'bg-black/25 backdrop-blur-xs'
            }`}
            onClick={() => setMobileTab('canvas')}
          />
        )}

        {/* Mobile Quick Action Pill Card */}
        {image && mobileTab === 'canvas' && !selectedLayer && (
          <div className="lg:hidden absolute top-3 inset-x-3 sm:max-w-md sm:mx-auto z-20 bg-white/95 border border-[#e8e4dc] shadow-xl backdrop-blur-xl rounded-2xl p-2.5 flex items-center justify-around gap-2 animate-in slide-in-from-top duration-150">
            {/* Auto OCR */}
            <button
              onClick={() => handleRunOCR()}
              disabled={isDetecting}
              className={`flex flex-col items-center gap-1 text-center transition-all ${
                isDetecting ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#ffefe8] border border-[#ff6f42]/20 flex items-center justify-center text-[#ff6f42] shadow-xs">
                {isDetecting ? <Loader2 className="w-4 h-4 animate-spin text-[#ff6f42]" /> : <ScanText className="w-4 h-4 text-[#ff6f42]" />}
              </div>
              <span className="text-[10px] font-semibold text-neutral-700">{isDetecting ? 'Detecting...' : 'Detect Text'}</span>
            </button>

            {/* Add Text */}
            <button
              onClick={handleAddText}
              className="flex flex-col items-center gap-1 text-center active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffefe8] border border-[#ff6f42]/20 flex items-center justify-center text-[#ff6f42] shadow-xs">
                <Type className="w-4 h-4 text-[#ff6f42]" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-700">Add Text</span>
            </button>

            {/* Compare */}
            <button
              onClick={() => setIsComparing((c) => !c)}
              className="flex flex-col items-center gap-1 text-center active:scale-95 transition-transform"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs transition-all ${
                  isComparing
                    ? 'bg-[#ffefe8] border border-[#ff6f42]/40 text-[#ff6f42]'
                    : 'bg-[#ede9df] border border-[#e8e4dc] text-neutral-700'
                }`}
              >
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-700">
                {isComparing ? 'Original' : 'Compare'}
              </span>
            </button>
          </div>
        )}

        {/* Mobile Floating Layer Card */}
        {selectedLayer && mobileTab === 'canvas' && (
          <div className="lg:hidden absolute bottom-20 left-3 right-3 sm:max-w-md sm:mx-auto z-30 rounded-2xl bg-white border border-[#e8e4dc] shadow-xl p-3 flex items-center justify-between animate-in slide-in-from-bottom duration-150">
            <div
              onClick={() => setMobileTab('properties')}
              className="flex items-center gap-2.5 min-w-0 flex-1 mr-2 cursor-pointer active:opacity-80"
              title="Tap to edit typography & styling"
            >
              <div className="w-9 h-9 rounded-xl bg-[#ff6f42] text-white flex items-center justify-center shrink-0 shadow-xs font-bold">
                <Type className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-900 truncate max-w-[140px] sm:max-w-[200px]">
                  {selectedLayer.text || 'Empty Text'}
                </p>
                <p className="text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 mt-0.5">
                  <span>{selectedLayer.fontFamily}</span>
                  <span>•</span>
                  <span>{Math.round(selectedLayer.fontSize)}px</span>
                  {selectedLayer.angle !== 0 && (
                    <>
                      <span>•</span>
                      <span>{Math.round(selectedLayer.angle)}°</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setMobileTab('properties')}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-[#ff6f42] text-white hover:bg-[#ee6037] transition-colors flex items-center gap-1 shadow-xs active:scale-95"
              >
                <Sliders className="w-3 h-3" />
                <span>Style</span>
              </button>
              <button
                onClick={() => handleDuplicateLayer(selectedLayer.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-700 hover:text-[#ff6f42] bg-white hover:bg-[#ffefe8] border border-[#e8e4dc] transition-colors"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteLayer(selectedLayer.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedLayerId(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 bg-white hover:bg-[#ede9df] border border-[#e8e4dc]"
                title="Deselect"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Modern Pill Dock */}
      {image && (
        <nav className="lg:hidden fixed bottom-4 inset-x-0 mx-auto w-fit z-40 bg-white/95 border border-[#e8e4dc] shadow-xl shadow-neutral-300/40 backdrop-blur-2xl rounded-full p-1.5 flex items-center gap-1 select-none">
          {/* Canvas Tab */}
          <button
            onClick={() => setMobileTab('canvas')}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs transition-all ${
              mobileTab === 'canvas'
                ? 'bg-[#ff6f42] text-white font-semibold shadow-xs scale-100'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#ffefe8]'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {mobileTab === 'canvas' && <span>Canvas</span>}
          </button>

          {/* Layers Tab */}
          <button
            onClick={() => setMobileTab(mobileTab === 'layers' ? 'canvas' : 'layers')}
            className={`relative flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs transition-all ${
              mobileTab === 'layers'
                ? 'bg-[#ff6f42] text-white font-semibold shadow-xs scale-100'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#ffefe8]'
            }`}
          >
            <div className="relative">
              <Layers className="w-3.5 h-3.5" />
              {(layers.length > 0 || detectedRegions.length > 0) && (
                <span
                  className={`absolute -top-1 -right-2 px-1 text-[8px] font-mono rounded-full font-bold leading-none py-0.5 min-w-[12px] text-center ${
                    mobileTab === 'layers' ? 'bg-white text-[#ff6f42]' : 'bg-[#ff6f42] text-white'
                  }`}
                >
                  {layers.length + detectedRegions.filter((r) => !r.isConverted).length}
                </span>
              )}
            </div>
            {mobileTab === 'layers' && <span>Layers</span>}
          </button>

          {/* Typography / Style Tab */}
          <button
            onClick={() => setMobileTab(mobileTab === 'properties' ? 'canvas' : 'properties')}
            className={`relative flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs transition-all ${
              mobileTab === 'properties'
                ? 'bg-[#ff6f42] text-white font-semibold shadow-xs scale-100'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-[#ffefe8]'
            }`}
          >
            <div className="relative">
              <Sliders className="w-3.5 h-3.5" />
              {selectedLayer && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#ff6f42] animate-pulse" />
              )}
            </div>
            {mobileTab === 'properties' && <span>Style</span>}
          </button>

          {/* Quick Add Text Pill Button */}
          <button
            onClick={handleAddText}
            disabled={!image}
            className="w-8 h-8 rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-xs active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none ml-1"
            title="Add Text Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </nav>
      )}

      {/* Floating Status Toast */}
      {toast && (
        <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#e8e4dc] shadow-xl text-xs font-semibold text-neutral-800 max-w-[90vw]">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-[#ff6f42]' : toast.type === 'warn' ? 'bg-amber-500' : 'bg-blue-500'} shrink-0`} />
          <span className="truncate">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-neutral-400 hover:text-neutral-700 shrink-0">✕</button>
        </div>
      )}

      {/* High-Resolution Native Export Modal */}
      {image && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          image={image}
          patches={inpaintPatches}
          layers={layers}
        />
      )}

      {/* Discard Changes Confirmation Modal */}
      <DiscardModal
        isOpen={showDiscardModal}
        onClose={handleCloseDiscardModal}
        onConfirm={handleConfirmDiscard}
        title={discardModalConfig.title}
        message={discardModalConfig.message}
        confirmText={discardModalConfig.confirmText}
        cancelText={discardModalConfig.cancelText}
      />
    </div>
  );
};

export default App;
