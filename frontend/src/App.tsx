import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageMetadata, TextLayer, InpaintPatch, DetectedTextRegion } from './types';
import { HistoryManager } from './utils/history';
import { Header } from './components/Header';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ExportModal } from './components/ExportModal';
import { analyzeImageOCR, restoreBackground } from './services/api';

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

  // OCR state
  const [detectedRegions, setDetectedRegions] = useState<DetectedTextRegion[]>([]);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState<boolean>(true);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState<string>('en');

  // Inpaint state
  const [isInpainting, setIsInpainting] = useState<boolean>(false);
  const [isInpaintingAll, setIsInpaintingAll] = useState<boolean>(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // History Manager
  const historyRef = useRef<HistoryManager>(new HistoryManager(50));
  const [_historyKey, setHistoryKey] = useState<number>(0);

  // Push history state whenever layers are intentionally updated
  const updateLayersWithHistory = useCallback((newLayers: TextLayer[]) => {
    historyRef.current.pushState(layers);
    setLayers(newLayers);
    setHistoryKey((k) => k + 1);
  }, [layers]);

  // Handle Undo
  const handleUndo = useCallback(() => {
    const prevState = historyRef.current.undo(layers);
    if (prevState) {
      setLayers(prevState);
      setHistoryKey((k) => k + 1);
    }
  }, [layers]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    const nextState = historyRef.current.redo(layers);
    if (nextState) {
      setLayers(nextState);
      setHistoryKey((k) => k + 1);
    }
  }, [layers]);

  // Run OCR on current image
  const handleRunOCR = async (fileToAnalyze?: File | Blob, langOverride?: string) => {
    const activeLang = langOverride || ocrLang;
    const file = fileToAnalyze || image?.file;
    if (!file && !image?.dataUrl) return;

    setIsDetecting(true);
    try {
      let blob: Blob;
      if (file) {
        blob = file;
      } else {
        const res = await fetch(image!.dataUrl);
        blob = await res.blob();
      }

      const result = await analyzeImageOCR(blob, image?.fileName || 'image.png', activeLang);
      setDetectedRegions(result.regions);
      setShowDetectionOverlay(true);
      if (result.regions.length > 0) {
        showToast(`Detected ${result.regions.length} text region(s). Click any green box to edit.`, 'success');
      } else {
        showToast('No text regions detected in this image.', 'info');
      }
    } catch (err) {
      console.warn('OCR API request error (PaddleOCR):', err);
      showToast('OCR detection failed. Please check backend connection.', 'warn');
    } finally {
      setIsDetecting(false);
    }
  };

  // Convert a single detected OCR region to an editable TextLayer with seamless automatic background restoration & typography matching
  const handleConvertRegion = async (region: DetectedTextRegion) => {
    const newId = `layer-ocr-${Date.now()}`;
    const newLayer: TextLayer = {
      id: newId,
      text: region.text,
      fontFamily: 'Inter',
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
      width: Math.max(region.bbox[2], 20),
      height: Math.max(region.bbox[3], 14),
      angle: region.angle || 0,
      opacity: 1,
      blur: region.estimatedBlur ?? 0.6,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    setDetectedRegions((prev) =>
      prev.map((r) => (r.regionId === region.regionId ? { ...r, isConverted: true } : r))
    );

    updateLayersWithHistory([...layers, newLayer]);
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

  // Convert all unconverted detected regions at once with parallel inpainting
  const handleConvertAllRegions = async () => {
    const unconverted = detectedRegions.filter((r) => !r.isConverted);
    if (unconverted.length === 0) return;

    const baseTimestamp = Date.now();
    const newLayers: TextLayer[] = unconverted.map((region, i) => ({
      id: `layer-ocr-${baseTimestamp}-${i}`,
      text: region.text,
      fontFamily: 'Inter',
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
      width: Math.max(region.bbox[2], 20),
      height: Math.max(region.bbox[3], 14),
      angle: region.angle || 0,
      opacity: 1,
      blur: region.estimatedBlur ?? 0.6,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    }));

    setDetectedRegions((prev) => prev.map((r) => ({ ...r, isConverted: true })));
    updateLayersWithHistory([...layers, ...newLayers]);
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
        setHistoryKey((k) => k + 1);

        handleRunOCR(file);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Generate Sample High-Resolution Poster
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1600, 1000);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1000);

    // Decorative grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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

    // Radial glow
    const radGrad = ctx.createRadialGradient(800, 450, 50, 800, 450, 400);
    radGrad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, 1600, 1000);

    // Flattened text inside image
    ctx.fillStyle = '#64748b';
    ctx.font = '600 24px "Inter", sans-serif';
    ctx.fillText('HIGH-FIDELITY TYPOGRAPHY RECONSTRUCTION', 150, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px "Montserrat", sans-serif';
    ctx.fillText('PHOTEXT STUDIO', 150, 390);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 28px "Inter", sans-serif';
    ctx.fillText('Precision typography matching, seamless text removal & non-destructive 4K export.', 150, 470);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 22px "Outfit", sans-serif';
    ctx.fillText('PRO EDITION 2026', 150, 560);

    const dataUrl = canvas.toDataURL('image/png');

    const meta: ImageMetadata = {
      width: 1600,
      height: 1000,
      fileName: 'typography_sample_poster.png',
      format: 'png',
      dataUrl,
    };

    const sampleDetected: DetectedTextRegion[] = [
      {
        regionId: 'ocr-sample-1',
        text: 'PHOTEXT STUDIO',
        polygon: [[148, 305], [960, 305], [960, 400], [148, 400]],
        bbox: [148, 305, 812, 95],
        angle: 0,
        estimatedFontSize: 84,
        estimatedColor: '#ffffff',
        confidence: 0.985,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-2',
        text: 'HIGH-FIDELITY TYPOGRAPHY RECONSTRUCTION',
        polygon: [[148, 235], [780, 235], [780, 268], [148, 268]],
        bbox: [148, 235, 632, 33],
        angle: 0,
        estimatedFontSize: 24,
        estimatedColor: '#64748b',
        confidence: 0.972,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-3',
        text: 'Precision typography matching, seamless text removal & non-destructive 4K export.',
        polygon: [[148, 442], [1160, 442], [1160, 480], [148, 480]],
        bbox: [148, 442, 1012, 38],
        angle: 0,
        estimatedFontSize: 28,
        estimatedColor: '#94a3b8',
        confidence: 0.968,
        geometryConfidence: 1.0,
        isConverted: false,
      },
      {
        regionId: 'ocr-sample-4',
        text: 'PRO EDITION 2026',
        polygon: [[148, 538], [420, 538], [420, 570], [148, 570]],
        bbox: [148, 538, 272, 32],
        angle: 0,
        estimatedFontSize: 22,
        estimatedColor: '#38bdf8',
        confidence: 0.991,
        geometryConfidence: 1.0,
        isConverted: false,
      },
    ];

    setImage(meta);
    setLayers([]);
    setSelectedLayerId(null);
    setInpaintPatches([]);
    setDetectedRegions(sampleDetected);
    setShowDetectionOverlay(true);
    historyRef.current.clear();
    setHistoryKey((k) => k + 1);
  };

  const handleAddText = () => {
    if (!image) return;
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

    updateLayersWithHistory([...layers, newLayer]);
    setSelectedLayerId(newId);
  };

  const handleUpdateLayer = (id: string, updates: Partial<TextLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const handleDuplicateLayer = (layerId: string) => {
    const target = layers.find((l) => l.id === layerId);
    if (!target) return;

    const duplicated: TextLayer = {
      ...JSON.parse(JSON.stringify(target)),
      id: `layer-${Date.now()}`,
      left: target.left + 25,
      top: target.top + 25,
    };

    updateLayersWithHistory([...layers, duplicated]);
    setSelectedLayerId(duplicated.id);
  };

  const handleDeleteLayer = (layerId: string) => {
    updateLayersWithHistory(layers.filter((l) => l.id !== layerId));
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  };

  const handleBringForward = (layerId: string) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0 || idx === layers.length - 1) return;
    const reordered = [...layers];
    const item = reordered.splice(idx, 1)[0];
    reordered.splice(idx + 1, 0, item);
    updateLayersWithHistory(reordered);
  };

  const handleSendBackward = (layerId: string) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    const reordered = [...layers];
    const item = reordered.splice(idx, 1)[0];
    reordered.splice(idx - 1, 0, item);
    updateLayersWithHistory(reordered);
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement).tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, layers, handleUndo, handleRedo]);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const hasInpaintPatch = selectedLayer
    ? inpaintPatches.some((p) => p.id === `patch-${selectedLayer.id}`)
    : false;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0d13]">
      {/* Top Header */}
      <Header
        canUndo={historyRef.current.canUndo()}
        canRedo={historyRef.current.canRedo()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(5.0, z * 1.15))}
        onZoomOut={() => setZoom((z) => Math.max(0.1, z * 0.85))}
        onZoomFit={() => setZoom(1.0)}
        onZoomReset={() => setZoom(1.0)}
        onImageSelected={handleImageSelected}
        onLoadSample={handleLoadSample}
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
      />

      {/* Main Workspace */}
      <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left: Layers & Inpaint Patches Panel */}
        <LayersPanel
          image={image}
          patches={inpaintPatches}
          layers={layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onAddText={handleAddText}
          onToggleVisibility={(id) => {
            const layer = layers.find((l) => l.id === id);
            if (layer) handleUpdateLayer(id, { isVisible: !layer.isVisible });
          }}
          onToggleLock={(id) => {
            const layer = layers.find((l) => l.id === id);
            if (layer) handleUpdateLayer(id, { isLocked: !layer.isLocked });
          }}
          onDeleteLayer={handleDeleteLayer}
          onDeletePatch={handleDeletePatch}
          detectedRegions={detectedRegions}
          onConvertRegion={handleConvertRegion}
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
        />

        {/* Center: Interactive Fabric.js Canvas */}
        <CanvasWorkspace
          image={image}
          patches={inpaintPatches}
          layers={layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onUpdateLayer={handleUpdateLayer}
          zoom={zoom}
          onZoomChange={setZoom}
          isComparing={isComparing}
          compareMode={compareMode}
          splitPosition={splitPosition}
          onSplitChange={setSplitPosition}
          onDropImage={handleImageSelected}
          onLoadSample={handleLoadSample}
          detectedRegions={detectedRegions}
          showDetectionOverlay={showDetectionOverlay}
          onConvertRegion={handleConvertRegion}
          onHideDetectionOverlay={() => setShowDetectionOverlay(false)}
          onShowDetectionOverlay={() => setShowDetectionOverlay(true)}
          hoveredRegionId={hoveredRegionId}
          onHoverRegion={setHoveredRegionId}
        />

        {/* Right: Typography & Inpainting Properties Inspector */}
        <PropertiesPanel
          layer={selectedLayer}
          image={image}
          onChange={(updates) => {
            if (selectedLayerId) {
              handleUpdateLayer(selectedLayerId, updates);
            }
          }}
          onDuplicate={handleDuplicateLayer}
          onDelete={handleDeleteLayer}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onInpaintLayer={handleInpaintLayer}
          isInpainting={isInpainting}
          hasInpaintPatch={hasInpaintPatch}
        />
      </div>

      {/* Floating Status Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141926] border border-[#27364f] shadow-2xl text-xs font-medium text-white">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'warn' ? 'bg-amber-400' : 'bg-blue-400'} shrink-0`} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-white">✕</button>
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
    </div>
  );
};

export default App;
