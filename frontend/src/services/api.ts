import type { DetectedTextRegion, TypographyMatchResponse, TextLayer, InpaintPatch, CompositorExportResult } from '../types';

const PRODUCTION_BACKEND = 'https://retypo-backend.onrender.com';
const CONFIGURED_API_URL = ((import.meta.env.VITE_API_URL as string) || '').trim().replace(/\/+$/, '');

export function getBaseApiUrl(): string {
  if (CONFIGURED_API_URL) return CONFIGURED_API_URL;
  // In local development, default to local backend port 8000
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:8000';
  }
  // On production (Vercel), empty string routes through Vercel's rewrite proxy (same-origin, eliminates CORS completely)
  return '';
}

/**
 * Universal API fetch helper.
 * On production (Vercel), routes through Vercel's rewrites to the cloud backend (Render)
 * with zero CORS issues, falling back directly to remote backend if needed.
 */
async function callApi(endpoint: string, init?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getBaseApiUrl();

  // If explicit remote URL is configured, use it directly
  if (baseUrl) {
    return await fetch(`${baseUrl}${cleanEndpoint}`, init);
  }

  // On production (e.g. Vercel):
  // 1. First try relative path /api/... which uses Vercel's server-side rewrite (same-origin, 0 CORS)
  try {
    const res = await fetch(cleanEndpoint, init);
    // If Vercel rewrite returns 404/502, try direct fallback
    if (res.status === 404 || res.status === 502) {
      console.warn(`[API] Rewrite endpoint ${cleanEndpoint} returned ${res.status}. Falling back to direct backend...`);
      return await fetch(`${PRODUCTION_BACKEND}${cleanEndpoint}`, init);
    }
    return res;
  } catch (err) {
    console.warn(`[API] Rewrite endpoint ${cleanEndpoint} failed. Falling back to direct backend...`, err);
    return await fetch(`${PRODUCTION_BACKEND}${cleanEndpoint}`, init);
  }
}

export interface OCRAnalysisResult {
  status: string;
  imageWidth: number;
  imageHeight: number;
  regionsCount: number;
  processingTimeMs: number;
  regions: DetectedTextRegion[];
}

export interface InpaintRestoreResult {
  status: string;
  patchDataUrl: string;
  maskDataUrl: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  strategyUsed: string;
  processingTimeMs: number;
  maskPixelCount: number;
}

export interface MaskInspectResult {
  status: string;
  maskDataUrl: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  maskPixelCount: number;
}

export async function checkBackendHealth(): Promise<{ isHealthy: boolean; engine?: string }> {
  try {
    const res = await callApi('/api/health', { method: 'GET' });
    if (!res.ok) return { isHealthy: false };
    const data = await res.json();
    return { isHealthy: data.status === 'healthy', engine: data.ocr_engine };
  } catch {
    return { isHealthy: false };
  }
}

export async function analyzeImageOCR(file: File | Blob, fileName: string = 'image.png', lang: string = 'en'): Promise<OCRAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('lang', lang);

  const response = await callApi('/api/ocr/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR analysis failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function restoreBackground(
  file: File | Blob,
  polygon: [number, number][],
  fontSize: number = 32.0,
  strategy: string = 'auto',
  padding: number = 0,
  fileName: string = 'image.png'
): Promise<InpaintRestoreResult> {
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('polygon', JSON.stringify(polygon));
  formData.append('fontSize', String(fontSize));
  formData.append('strategy', strategy);
  formData.append('padding', String(padding));

  const response = await callApi('/api/inpaint/restore', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inpainting failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function matchTypography(
  fileOrCrop: { file?: File | Blob; cropBase64?: string },
  text: string,
  polygon?: [number, number][],
  bbox?: [number, number, number, number],
  fontSize?: number,
  topK: number = 5
): Promise<TypographyMatchResponse> {
  const formData = new FormData();
  if (fileOrCrop.file) {
    formData.append('file', fileOrCrop.file);
  }
  if (fileOrCrop.cropBase64) {
    formData.append('cropBase64', fileOrCrop.cropBase64);
  }
  formData.append('text', text);
  if (polygon) {
    formData.append('polygon', JSON.stringify(polygon));
  }
  if (bbox) {
    formData.append('bbox', JSON.stringify(bbox));
  }
  if (fontSize) {
    formData.append('fontSize', String(fontSize));
  }
  formData.append('topK', String(topK));

  const response = await callApi('/api/typography/match', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Typography matching failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function renderStudioExport(
  fileOrBase64: { file?: File | Blob; imageBase64?: string },
  layers: TextLayer[],
  inpaintPatches: InpaintPatch[],
  options: {
    format: 'png' | 'jpeg' | 'webp';
    quality?: number;
    preserveIcc?: boolean;
  }
): Promise<CompositorExportResult> {
  const formData = new FormData();
  if (fileOrBase64.file) {
    formData.append('file', fileOrBase64.file);
  }
  if (fileOrBase64.imageBase64) {
    formData.append('imageBase64', fileOrBase64.imageBase64);
  }
  formData.append('format', options.format);
  formData.append('quality', String(options.quality ?? 0.95));
  formData.append('layers', JSON.stringify(layers));
  formData.append('inpaintPatches', JSON.stringify(inpaintPatches));
  formData.append('preserveIcc', String(options.preserveIcc ?? true));

  const response = await callApi('/api/export/render', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Studio compositor render failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
