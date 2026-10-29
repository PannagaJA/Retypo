import React, { useState, useEffect } from 'react';
import {
  X,
  Info,
  Scale,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Cpu,
  Layers,
  Heart,
  CheckCircle2
} from 'lucide-react';

export type AboutTab = 'about' | 'licenses' | 'privacy';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AboutTab;
}

const OPEN_SOURCE_DEPENDENCIES = [
  {
    name: 'PaddleOCR / PP-OCRv6',
    role: 'Text detection and high-accuracy textline recognition engine',
    license: 'Apache-2.0',
    url: 'https://github.com/PaddlePaddle/PaddleOCR'
  },
  {
    name: 'OpenCV (Python & C++)',
    role: 'Computer vision, stroke isolation, and Telea Navier-Stokes inpainting',
    license: 'Apache-2.0',
    url: 'https://opencv.org/'
  },
  {
    name: 'FastAPI & Uvicorn',
    role: 'Asynchronous backend gateway with Pydantic type safety',
    license: 'MIT / BSD-3-Clause',
    url: 'https://fastapi.tiangolo.com/'
  },
  {
    name: 'Fabric.js',
    role: 'High-performance interactive HTML5 2D canvas layer manipulation',
    license: 'MIT',
    url: 'https://fabricjs.com/'
  },
  {
    name: 'React 19 & TypeScript',
    role: 'Reactive component model and compile-time type safety',
    license: 'MIT',
    url: 'https://react.dev/'
  },
  {
    name: 'Tailwind CSS v4',
    role: 'Modern utility-first styling engine with customized brand palette',
    license: 'MIT',
    url: 'https://tailwindcss.com/'
  },
  {
    name: 'Lucide React',
    role: 'Crisp, minimalist iconography suite',
    license: 'ISC',
    url: 'https://lucide.dev/'
  },
  {
    name: 'Lenis',
    role: 'Smooth physics-based scroll animation engine',
    license: 'MIT',
    url: 'https://lenis.darkroom.engineering/'
  }
];

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'about'
}) => {
  const [activeTab, setActiveTab] = useState<AboutTab>(initialTab);

  // Sync initial tab whenever modal is reopened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-[#fbfaf7] border border-[#e8e4dc] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e4dc] bg-white/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/Retypo Logo with Orange Accents.png"
              alt="Retypo"
              className="h-7 w-auto object-contain"
            />
            <span className="px-2 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 text-[10px] font-mono uppercase tracking-wider font-bold">
              v1.0.0
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-[#ffefe8] transition-colors"
            title="Close (Esc)"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e8e4dc] bg-[#f4f1ea] px-6 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-[#ff6f42] text-[#ff6f42] bg-white rounded-t-lg -mb-px'
                : 'border-transparent text-neutral-600 hover:text-neutral-950'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>About Retypo</span>
          </button>

          <button
            onClick={() => setActiveTab('licenses')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'licenses'
                ? 'border-[#ff6f42] text-[#ff6f42] bg-white rounded-t-lg -mb-px'
                : 'border-transparent text-neutral-600 hover:text-neutral-950'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Licenses &amp; Attributions</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'privacy'
                ? 'border-[#ff6f42] text-[#ff6f42] bg-white rounded-t-lg -mb-px'
                : 'border-transparent text-neutral-600 hover:text-neutral-950'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy &amp; Safety</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-neutral-700 leading-relaxed">
          {/* TAB 1: ABOUT */}
          {activeTab === 'about' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 id="about-modal-title" className="text-base font-extrabold text-neutral-950 mb-1">
                  Universal AI Image Text Editor &amp; Typography Engine
                </h3>
                <p className="text-neutral-600">
                  Retypo enables seamless in-place editing of text inside raster images (posters, memes,
                  screenshots, flyers, product labels, and social graphics) without losing the original
                  texture, typography, or background fidelity.
                </p>
              </div>

              {/* Core Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] shadow-2xs space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-neutral-950 text-xs">Smart OCR &amp; Filter</h4>
                  <p className="text-[11px] text-neutral-600 leading-normal">
                    PP-OCRv6 textline localization paired with geometric circularity checks to avoid touching UI icons.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] shadow-2xs space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-neutral-950 text-xs">Texture Inpainting</h4>
                  <p className="text-[11px] text-neutral-600 leading-normal">
                    Stroke-level mask extraction with Navier-Stokes restoration leaves non-text pixels bitwise untouched.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] shadow-2xs space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-neutral-950 text-xs">Font Matching</h4>
                  <p className="text-[11px] text-neutral-600 leading-normal">
                    Estimates font family, weight, size, letter-spacing, and hex color to recreate vector text layers instantly.
                  </p>
                </div>
              </div>

              {/* Developer & Author Spotlight */}
              <div className="p-4 rounded-xl bg-white border border-[#e8e4dc] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#ff6f42] font-bold">
                    Author &amp; Engineering
                  </div>
                  <div className="text-sm font-black text-neutral-950">
                    Pannaga J A
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    Software &amp; AI Engineer specializing in Full-Stack Systems, Computer Vision &amp; Generative Graphics.
                  </p>
                </div>
                <a
                  href="https://pannagaja.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#ffefe8] hover:bg-[#ff6f42] text-[#ff6f42] hover:text-white font-bold transition-all text-xs shrink-0"
                >
                  <span>View Portfolio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: LICENSES */}
          {activeTab === 'licenses' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Project License */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-neutral-950">
                    Project License: MIT License
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                    Open Source
                  </span>
                </div>
                <div className="p-3.5 bg-neutral-900 text-neutral-200 font-mono text-[11px] rounded-xl border border-neutral-800 space-y-2 select-text">
                  <p className="font-bold text-white">Copyright (c) 2026 Pannaga J A</p>
                  <p className="text-neutral-400">
                    Permission is hereby granted, free of charge, to any person obtaining a copy
                    of this software and associated documentation files (the &quot;Software&quot;), to deal
                    in the Software without restriction, including without limitation the rights
                    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                    copies of the Software, and to permit persons to whom the Software is
                    furnished to do so, subject to the following conditions:
                  </p>
                  <p className="text-neutral-400">
                    The above copyright notice and this permission notice shall be included in all
                    copies or substantial portions of the Software.
                  </p>
                  <p className="text-neutral-500 text-[10px]">
                    THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
                  </p>
                </div>
              </div>

              {/* Open Source Acknowledgements */}
              <div>
                <h4 className="text-xs font-extrabold text-neutral-950 mb-2">
                  Third-Party Software &amp; Framework Acknowledgements
                </h4>
                <div className="divide-y divide-[#e8e4dc] border border-[#e8e4dc] rounded-xl bg-white overflow-hidden">
                  {OPEN_SOURCE_DEPENDENCIES.map((dep) => (
                    <div key={dep.name} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-neutral-950 flex items-center gap-2">
                          <span>{dep.name}</span>
                          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[#ffefe8] text-[#ff6f42] rounded-md font-semibold">
                            {dep.license}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5">{dep.role}</p>
                      </div>
                      <a
                        href={dep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-[#ff6f42] transition-colors p-1"
                        title={`Open ${dep.name}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY & SAFETY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-950 mb-1">
                  Privacy &amp; Data Guarantees
                </h3>
                <p className="text-neutral-600">
                  Retypo is built with strict user-privacy-first principles. Your visual assets belong exclusively to you.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-neutral-950">Stateless &amp; In-Memory Processing</h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Images uploaded for OCR text detection or background patch extraction are held transiently in RAM
                      only for the duration of the compute request. No files are saved to disks or permanent databases.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-neutral-950">Zero Telemetry &amp; Zero Trackers</h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      We do not inject third-party ad networks, surveillance trackers, cross-site beacons, or user session recorders.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e8e4dc] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-neutral-950">Lossless Client-Side Export</h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Final canvas compositing and image export run directly inside your web browser via HTML5 Canvas API
                      at 100% native resolution.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#e8e4dc] bg-[#f9f8f4] flex items-center justify-between text-[11px] text-neutral-500 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <span>Made with</span>
            <Heart className="w-3 h-3 text-[#ff6f42] fill-[#ff6f42]" />
            <span>by</span>
            <a
              href="https://pannagaja.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 font-bold hover:text-[#ff6f42] transition-colors"
            >
              Pannaga J A
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

