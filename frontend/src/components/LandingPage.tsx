import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Type,
  ScanText,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Lock,
  Layers,
  Eraser,
  LayoutTemplate,
  Download,
  Share2,
  FileCheck,
  Sun,
  Moon
} from 'lucide-react';

interface LandingPageProps {
  onSelectImage: (file: File) => void;
  onLoadSample: (type?: 'magazine' | 'coffee' | 'tech') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectImage,
  onLoadSample
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isGlobalDraggingOver, setIsGlobalDraggingOver] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [isYearly, setIsYearly] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global window drag & drop detection
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter++;
        setIsGlobalDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsGlobalDraggingOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsGlobalDraggingOver(false);
      setIsDraggingOver(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          onSelectImage(file);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onSelectImage]);

  // Comparison slider drag logic
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = () => setIsSliding(true);
  const handleTouchStart = () => setIsSliding(true);

  useEffect(() => {
    const handleMouseUp = () => setIsSliding(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isSliding) handleSliderMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isSliding && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };

    if (isSliding) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
    }

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isSliding, handleSliderMove]);

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0a0a0c] text-white' : 'bg-[#f7f5f0] text-neutral-950'} [font-family:'Inter',var(--font-sans)] antialiased select-none`}>
      {/* Background Dot Texture */}
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(23,23,23,0.14)_1px,transparent_1px)] [background-size:18px_18px] opacity-70 dark:[background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] dark:opacity-20" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-white/90 to-transparent dark:from-neutral-900/60" />

        {/* Global Drag-and-Drop Overlay */}
        {isGlobalDraggingOver && (
          <div className="fixed inset-0 z-50 bg-[#ff6f42]/15 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-[#ff6f42] animate-in fade-in duration-150">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4 text-center max-w-md ring-1 ring-black/10 scale-105 transition-transform">
              <div className="w-20 h-20 rounded-full bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center animate-bounce">
                <UploadCloud className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">Drop Image to Open</h3>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Release anywhere to instantly launch Retypo Studio with sub-pixel OCR detection.
              </p>
            </div>
          </div>
        )}

        {/* Floating Capsule Header */}
        <header className="fixed inset-x-0 top-0 z-40 pt-4 pb-3">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="relative flex items-center justify-between gap-4 rounded-[1.75rem] bg-white/90 px-4 py-3 shadow-[0_18px_55px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/8 backdrop-blur-xl dark:bg-neutral-900/90 dark:ring-white/10">
              {/* Brand Logo */}
              <a href="#" className="flex shrink-0 items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-neutral-950 font-bold shadow-sm transition-transform group-hover:scale-105">
                  <span className="font-serif text-lg tracking-tight">R</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-extrabold tracking-tight text-neutral-950 dark:text-white">Retypo</span>
                  <span className="text-[10px] text-neutral-600 dark:text-neutral-400 -mt-1 font-semibold">Starlight Canvas</span>
                </div>
              </a>

              {/* Navigation Links */}
              <nav className="hidden items-center gap-0.5 md:flex lg:gap-1 text-xs lg:text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                <a href="#features" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  Features
                </a>
                <a href="#demo" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  Interactive Demo
                </a>
                <a href="#workflow" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  Workflow
                </a>
                <a href="#presets" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  Templates
                </a>
                <a href="#pricing" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  Pricing
                </a>
                <a href="#faq" className="rounded-md px-2 lg:px-3 py-1.5 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white">
                  FAQ
                </a>
              </nav>

              {/* Action Buttons & Theme Switcher */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  aria-label="Toggle dark mode"
                  className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-neutral-200 dark:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f42]"
                >
                  <Sun className="pointer-events-none absolute left-1.5 size-3.5 text-amber-500 opacity-100 dark:opacity-40" />
                  <Moon className="pointer-events-none absolute right-1.5 size-3.5 text-indigo-400 opacity-40 dark:opacity-100" />
                  <span className={`grid size-5 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 dark:bg-neutral-900 dark:ring-white/15 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`}>
                    {isDarkMode ? <Moon className="size-3 text-indigo-400" /> : <Sun className="size-3 text-amber-500" />}
                  </span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-all"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onSelectImage(e.target.files[0]);
            }
          }}
        />

        {/* Main Content */}
        <main className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-20 md:pt-24 lg:pt-28">
          {/* HERO SECTION */}
          <section className="pt-6 pb-12 sm:pt-8 md:pt-8 lg:pt-10 lg:pb-20">
            <div className="flex flex-col items-center text-center">
              {/* Main Headline */}
              <h1 className="max-w-[22ch] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance text-neutral-950 dark:text-white">
                Images with text.{' '}
                <span className="hero-shimmer bg-clip-text text-transparent">
                  Now editable.
                </span>
              </h1>

              {/* Subtitle - HIGH CONTRAST */}
              <p className="mt-5 max-w-[56ch] text-base/7 text-pretty text-neutral-700 sm:text-lg/8 dark:text-neutral-200 font-medium">
                Upload any flattened PNG, JPG, or WebP. Retypo detects text with sub-pixel geometry, inpaints the background cleanly, and reconstructs editable typography while preserving 100% untouched pixels.
              </p>
            </div>

            {/* HERO CENTERPIECE WITH FLOATING SATELLITES */}
            <div className="relative mx-auto mt-8 md:mt-10 lg:mt-12 max-w-[1020px] pb-4 md:pb-6">
              {/* Diffuse Colorful Radial Ambient Backlight */}
              <div className="pointer-events-none absolute -inset-x-12 -top-12 -z-10 h-[calc(100%+7rem)] rounded-[4rem] bg-gradient-to-br from-[#ffd3bd] via-[#fdeee2] to-[#dceefb] opacity-90 blur-3xl sm:-inset-x-24 dark:from-[#ff6f42]/20 dark:via-transparent dark:to-sky-500/15" />

              {/* Responsive Scaling Container: Preserves exact floating satellite composition on tablet and desktop */}
              <div className="relative w-full transition-transform duration-200 md:scale-[0.76] min-[840px]:scale-[0.84] min-[940px]:scale-[0.92] lg:scale-100 origin-top md:-mb-24 min-[840px]:-mb-16 min-[940px]:-mb-8 lg:mb-0">
                {/* Centerpiece Studio Dropzone Card */}
                <div className="relative z-10 mx-auto w-full max-w-[500px] rounded-2xl bg-white shadow-[0_44px_90px_-36px_rgba(15,23,42,0.4)] ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 p-5">
                  {/* Mock Card Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold tracking-tight text-neutral-900 dark:text-white">Studio Canvas Workspace</span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono font-medium">1920×1080</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        <ScanText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Auto Text Detection Ready
                      </span>
                    </div>
                  </div>

                  {/* Animated Interactive Drop Target */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      if (e.dataTransfer?.files?.[0]) {
                        onSelectImage(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative mt-4 overflow-hidden rounded-xl border-2 border-dashed p-7 text-center transition-all cursor-pointer group ${
                      isDraggingOver
                        ? 'border-[#ff6f42] bg-[#fff6f2] scale-[1.02] dark:bg-[#ff6f42]/10'
                        : 'border-neutral-300 bg-[#fdfbf9] hover:border-[#ff6f42] hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/60'
                    }`}
                  >
                    {/* Upload Icon Container */}
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 shadow-md ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-[#ff6f42] mb-3 transition-transform duration-200 group-hover:scale-110">
                      <UploadCloud className="w-7 h-7" />
                    </div>

                    <p className="text-base font-extrabold tracking-tight text-neutral-950 dark:text-white">
                      Drag & Drop your image here
                    </p>
                    <p className="mt-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      Supports PNG, JPG, JPEG, WebP • Auto detects text & background
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="rounded-md bg-white dark:bg-neutral-700 px-2.5 py-1 text-xs font-bold text-neutral-800 dark:text-white shadow-xs ring-1 ring-black/10">
                        PNG
                      </span>
                      <span className="rounded-md bg-white dark:bg-neutral-700 px-2.5 py-1 text-xs font-bold text-neutral-800 dark:text-white shadow-xs ring-1 ring-black/10">
                        JPG
                      </span>
                      <span className="rounded-md bg-white dark:bg-neutral-700 px-2.5 py-1 text-xs font-bold text-neutral-800 dark:text-white shadow-xs ring-1 ring-black/10">
                        WebP
                      </span>
                      <span className="rounded-md bg-neutral-100 dark:bg-neutral-700 px-2.5 py-1 text-xs font-mono font-bold text-neutral-700 dark:text-neutral-200 ring-1 ring-black/5">
                        ⌘O
                      </span>
                    </div>
                  </div>

                  {/* Bottom Phase Progress Capsule */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>100% Non-destructive Editing</span>
                    </div>
                    <button
                      onClick={() => onLoadSample('magazine')}
                      className="text-xs font-bold text-[#ff6f42] hover:underline flex items-center gap-1"
                    >
                      Open Sample <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 4 TILTED SATELLITE CARDS (Preserved across all large and tablet screens) */}
                {/* Satellite 1: Top-Left (-rotate-6) */}
                <div className="absolute top-2 left-0 z-0 hidden w-52 -rotate-6 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block dark:bg-neutral-900 dark:ring-white/15">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-950 dark:text-white">Font Matcher</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                    <div className="flex justify-between font-semibold text-[11px]">
                      <span>Font Accuracy</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">98.4%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 font-mono">Playfair · Inter · Lato</p>
                </div>

                {/* Satellite 2: Bottom-Left (rotate-3) */}
                <div className="absolute bottom-4 left-6 z-20 hidden w-56 rotate-3 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block dark:bg-neutral-900 dark:ring-white/15">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                      <LayoutTemplate className="w-3.5 h-3.5 text-[#ff6f42]" />
                    </div>
                    <span className="text-xs font-bold text-neutral-950 dark:text-white">Sample Templates</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onLoadSample('magazine')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] dark:bg-neutral-800 dark:text-neutral-200 py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Magazine
                    </button>
                    <button
                      onClick={() => onLoadSample('coffee')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] dark:bg-neutral-800 dark:text-neutral-200 py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Coffee
                    </button>
                    <button
                      onClick={() => onLoadSample('tech')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] dark:bg-neutral-800 dark:text-neutral-200 py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Tech
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[10px] font-bold text-[#ff6f42]">1-click instant sample</p>
                </div>

                {/* Satellite 3: Top-Right (rotate-6) */}
                <div className="absolute top-4 right-0 z-20 hidden w-56 rotate-6 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block dark:bg-neutral-900 dark:ring-white/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <ScanText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-neutral-950 dark:text-white">Auto Text Scanner</span>
                    </div>
                    <span className="rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold px-1.5 py-0.5">
                      Active
                    </span>
                  </div>
                  <p className="mt-2 text-xs/5 font-medium text-neutral-700 dark:text-neutral-300">
                    Detects angles, sizes, and font positions instantly.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      Lightning Fast Processing
                    </span>
                  </div>
                </div>

                {/* Satellite 4: Bottom-Right (-rotate-3 dark card) */}
                <div className="absolute right-4 bottom-2 z-20 hidden w-60 -rotate-3 rounded-xl bg-neutral-950 p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.55)] ring-1 ring-neutral-800 md:block text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-950/80 text-emerald-400 flex items-center justify-center">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-bold text-white">Pixel Quality</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5">
                      Lossless
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-[10px] font-medium text-neutral-300">
                    <p>Original Background Intact</p>
                    <p>Color Profiles Preserved</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-white/15 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Pixel Perfect
                  </div>
                </div>
              </div>
            </div>

            {/* HERO CTA BUTTONS */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-neutral-950 px-7 text-base font-bold text-white shadow-[0_18px_38px_-18px_rgba(15,23,42,0.65)] hover:bg-neutral-800 transition-all sm:text-sm dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
              >
                Upload Image to Edit <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            <p className="mt-4 text-center text-xs font-bold text-neutral-600 dark:text-neutral-400">
              No account required • 100% local processing • Works with all resolutions
            </p>
          </section>

          {/* SECTION 2: 5-COLUMN BENTO FEATURES (HeyRetro Layout) */}
          <section id="features" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-12">
              <div>
                <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950 dark:text-white">
                  One studio canvas.{' '}
                  <span className="text-neutral-500 dark:text-neutral-400">Total typography control.</span>
                </h2>
              </div>
              <p className="max-w-[44ch] text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Five purpose-built deep imaging pipelines seamlessly connected to let you edit flattened text in seconds.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Feature 1: Text Detection */}
              <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/10 dark:hover:ring-white/20 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#fff3ec] dark:bg-[#ff6f42]/10 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs text-[#ff6f42]">
                      <ScanText className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#ff6f42]/15 text-[#ff6f42]">
                      Auto Scan
                    </span>
                  </div>
                  <div className="rounded-xl bg-neutral-950 p-2.5 text-white shadow-xs border border-white/10">
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800 text-[10px] text-neutral-400 font-mono">
                      <span>DETECTED_TEXT</span>
                      <span className="text-emerald-400 font-bold">99.8% match</span>
                    </div>
                    <div className="mt-2 py-1 px-2 rounded border border-dashed border-[#ff6f42] bg-[#ff6f42]/20 flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wider font-mono text-white">"EDITORIAL"</span>
                      <span className="size-1.5 bg-[#ff6f42] rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">Smart Text Detection</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">Detects any text block, font angle, and position automatically.</p>
                </div>
              </div>

              {/* Feature 2: Clean Inpainting */}
              <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/10 dark:hover:ring-white/20 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f0fdf4] dark:bg-emerald-950/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs text-emerald-600">
                      <Eraser className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Background Fill
                    </span>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-2.5 shadow-xs border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                      <span>CLEAN_TEXTURE</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Seamless</span>
                    </div>
                    <div className="mt-2 h-7 rounded-lg bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-200 dark:from-emerald-950/60 dark:to-teal-950/60 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                        Texture Restored ✓
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">Background Inpainting</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">Erases text seamlessly while perfectly restoring underlying texture.</p>
                </div>
              </div>

              {/* Feature 3: Font Matcher */}
              <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/10 dark:hover:ring-white/20 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eff6ff] dark:bg-sky-950/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs text-sky-600">
                      <Type className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                      Font Matcher
                    </span>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-2.5 shadow-xs border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                      <span>MATCHED_STYLE</span>
                      <span className="text-sky-600 dark:text-sky-400 font-bold">ACTIVE</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Playfair</span>
                      <span className="text-[10px] font-mono bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-semibold">
                        Serif · 700
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">Font Reconstruction</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">Instantly matches serif, sans-serif, and weight to fonts.</p>
                </div>
              </div>

              {/* Feature 4: Vector Canvas */}
              <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/10 dark:hover:ring-white/20 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#faf5ff] dark:bg-indigo-950/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs text-indigo-600">
                      <Layers className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                      Full Controls
                    </span>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-2.5 shadow-xs border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                      <span>TEXT_LAYER</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">VECTOR</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-neutral-800 dark:text-neutral-200">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700">Size: 48px</span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700">Track: -0.02</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">Vector Typography Layer</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">Rotate, scale, recolor, and change text with total design freedom.</p>
                </div>
              </div>

              {/* Feature 5: Lossless Compositor */}
              <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/10 dark:hover:ring-white/20 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#fefce8] dark:bg-amber-950/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs text-amber-600">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-300">
                      Full Quality
                    </span>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-2.5 shadow-xs border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                      <span>EXPORT_QUALITY</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">ORIGINAL</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      <span>High-Res</span>
                      <span className="text-emerald-600 dark:text-emerald-400">PNG, JPG, WebP</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950 dark:text-white">Lossless Export Pipeline</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">Exports at full native source resolution with untouched pixels.</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: INTERACTIVE BEFORE / AFTER TRANSFORMATION SLIDER */}
          <section id="demo" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col items-center text-center mb-10">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950 dark:text-white">
                See the reconstruction in action.
              </h2>
              <p className="mt-4 text-sm font-medium text-neutral-700 dark:text-neutral-300 max-w-xl">
                Drag the divider below to inspect the transformation between the raw flattened raster image and Retypo's reconstructed editable vector typography.
              </p>
            </div>

            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.4)] ring-1 ring-black/10 p-4 dark:bg-neutral-900 dark:ring-white/15">
              <div
                ref={sliderContainerRef}
                className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-900 cursor-ew-resize select-none touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                {/* AFTER STATE: Inpainted background + Reconstructed typography */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 flex flex-col justify-between text-white">
                  <div className="flex justify-between items-center">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur text-xs font-mono font-bold tracking-widest uppercase text-emerald-400 border border-emerald-500/40">
                      ✓ Retypo Inpainted & Reconstructed
                    </span>
                    <span className="text-xs text-white/70 font-mono font-semibold">Editable Vector Text</span>
                  </div>

                  <div className="my-auto space-y-3">
                    <div className="inline-block px-3 py-1 rounded-md bg-[#ff6f42]/20 border border-[#ff6f42] text-[#ff6f42] font-mono font-bold text-xs">
                      [Selected Layer: Playfair Display]
                    </div>
                    <h3 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-white drop-shadow-md">
                      Timeless Elegance
                    </h3>
                    <p className="text-sm sm:text-base text-slate-200 font-medium max-w-md">
                      Every letter is now an editable vector object with matched font metrics, live sizing, and custom color controls.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold text-white/80">
                    <span className="px-2 py-1 rounded bg-white/15">Font: Playfair Display</span>
                    <span className="px-2 py-1 rounded bg-white/15">Size: 48px</span>
                    <span className="px-2 py-1 rounded bg-white/15">Color: #FFFFFF</span>
                  </div>
                </div>

                {/* BEFORE STATE: Original flattened raster image */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-stone-900 p-8 flex flex-col justify-between text-white overflow-hidden pointer-events-none"
                  style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
                >
                  <div className="flex justify-between items-center">
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur text-xs font-mono font-bold tracking-widest uppercase text-amber-300 border border-amber-500/40">
                      Original Flattened Raster (Uneditable)
                    </span>
                  </div>

                  <div className="my-auto space-y-3">
                    <div className="inline-block px-3 py-1 rounded-md bg-neutral-800 text-amber-200 border border-amber-500/30 font-mono font-bold text-xs">
                      Locked Pixel Image
                    </div>
                    <h3 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight text-neutral-300 line-through opacity-80">
                      Timeless Elegance
                    </h3>
                    <p className="text-sm sm:text-base text-neutral-300 font-medium max-w-md">
                      Static image pixels locked into background texture. Cannot change words, fonts, or styling without repainting.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-400">
                    <span>Rasterized JPEG • No Layer Data</span>
                  </div>
                </div>

                {/* SLIDER DIVIDER LINE */}
                <div
                  className="absolute inset-y-0 w-1 bg-white shadow-2xl pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-neutral-950 shadow-xl flex items-center justify-center font-bold text-xs ring-2 ring-black/20">
                    ⇄
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-2">
                <span>◀ Drag left for Reconstructed Vector</span>
                <span>Drag right for Flattened Raster ▶</span>
              </div>
            </div>
          </section>

          {/* SECTION 4: STEP-BY-STEP WORKFLOW WITH CURVED ARROWS (HeyRetro Signature Pattern) */}
          <section id="workflow" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div>
              <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950 dark:text-white">
                Static image. <span className="text-neutral-500 dark:text-neutral-400">Editable canvas.</span>
              </h2>
            </div>

            <div className="mt-16 hidden items-center justify-between gap-3 lg:flex">
              {/* Step 1 */}
              <div className="flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-[#fff1ec] text-[#ff6f42] dark:bg-[#ff6f42]/10 flex items-center justify-center mb-2.5">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950 dark:text-white">1. Ingest Image</span>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">PNG, JPG, or WebP</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950 dark:text-white">Drop image</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                  Drag any image onto the canvas. Works directly in browser.
                </p>
              </div>

              {/* Connector 1 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300 dark:via-neutral-700 dark:to-neutral-700" />
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-neutral-800 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent dark:from-neutral-700 dark:via-neutral-700" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                    <ScanText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950 dark:text-white">2. Detect Polygons</span>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Auto Angle & Position</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950 dark:text-white">Detect text</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                  Instant scanner maps exact text angle, position, and bounding box.
                </p>
              </div>

              {/* Connector 2 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300 dark:via-neutral-700 dark:to-neutral-700" />
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-neutral-800 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent dark:from-neutral-700 dark:via-neutral-700" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                    <Eraser className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950 dark:text-white">3. Inpaint Background</span>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Seamless Background Fill</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950 dark:text-white">Restore texture</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                  Erase original raster text while reconstructing underlying texture.
                </p>
              </div>

              {/* Connector 3 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300 dark:via-neutral-700 dark:to-neutral-700" />
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-neutral-800 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent dark:from-neutral-700 dark:via-neutral-700" />
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center mb-2.5">
                    <Download className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950 dark:text-white">4. Export Lossless</span>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Original High Resolution</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950 dark:text-white">Edit & Export</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                  Type new copy, resize typography, and export untouched pixels.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 5: CURATED SAMPLE TEMPLATES (HeyRetro Inspiration) */}
          <section id="presets" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-12">
              <div>
                <h2 className="max-w-[28ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950 dark:text-white">
                  Choose a sample preset.
                </h2>
              </div>
              <p className="max-w-[48ch] text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Test the full studio workflow instantly without uploading an image. Select any preset to generate canvas layers and OCR text.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {/* Preset 1 */}
              <div className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div className="aspect-[16/11] overflow-hidden bg-gradient-to-br from-stone-900 to-amber-950 p-6 flex flex-col justify-between text-white relative">
                  <span className="self-start px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                    Serif Editorial
                  </span>
                  <div>
                    <p className="text-2xl font-serif font-bold text-white">VOGUE & STYLE</p>
                    <p className="text-xs text-amber-200 font-semibold">Autumn Edition • Issue 42</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-extrabold text-neutral-950 dark:text-white">Vintage Editorial Magazine</h3>
                  <p className="mt-1 text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                    Playfair Display headline with editorial sub-lines and subtle gradient overlays.
                  </p>
                  <button
                    onClick={() => onLoadSample('magazine')}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff6f42] hover:underline"
                  >
                    Open in Studio <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preset 2 */}
              <div className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div className="aspect-[16/11] overflow-hidden bg-gradient-to-br from-stone-900 to-amber-900 p-6 flex flex-col justify-between text-white relative">
                  <span className="self-start px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-xs font-mono font-bold">
                    Artisan Brand
                  </span>
                  <div>
                    <p className="text-2xl font-sans font-black tracking-tight text-white">ROAST & CO.</p>
                    <p className="text-xs text-orange-200 font-semibold">Single Origin Organic 250g</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-extrabold text-neutral-950 dark:text-white">Artisan Coffee Brand</h3>
                  <p className="mt-1 text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                    Heavy geometric typography, product packaging badges, and organic color palettes.
                  </p>
                  <button
                    onClick={() => onLoadSample('coffee')}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff6f42] hover:underline"
                  >
                    Open in Studio <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preset 3 */}
              <div className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:ring-black/20 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div className="aspect-[16/11] overflow-hidden bg-gradient-to-br from-indigo-950 to-slate-900 p-6 flex flex-col justify-between text-white relative">
                  <span className="self-start px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold">
                    Tech Summit
                  </span>
                  <div>
                    <p className="text-2xl font-mono font-bold text-white">NEXT DEV 2026</p>
                    <p className="text-xs text-indigo-200 font-semibold">San Francisco • Nov 14-16</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-extrabold text-neutral-950 dark:text-white">Tech Conference Poster</h3>
                  <p className="mt-1 text-xs/5 font-medium text-neutral-600 dark:text-neutral-300">
                    High-contrast modern monospace typography with speaker tags and barcode details.
                  </p>
                  <button
                    onClick={() => onLoadSample('tech')}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#ff6f42] hover:underline"
                  >
                    Open in Studio <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: PRICING SECTION (HeyRetro Layout) */}
          <section id="pricing" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col items-center text-center">
              <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950 dark:text-white">
                Simple, transparent pricing.
              </h2>
              <p className="mt-4 max-w-[50ch] text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Start editing free forever. Upgrade for unlimited high-resolution batch jobs and API access.
              </p>

              {/* Billing Toggle */}
              <div className="mt-8 inline-flex items-center rounded-full bg-white dark:bg-neutral-900 p-1.5 ring-1 ring-black/10 dark:ring-white/15 shadow-xs">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    !isYearly ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs' : 'text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    isYearly ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs' : 'text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'
                  }`}
                >
                  <span>Yearly</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isYearly ? 'bg-[#ff6f42] text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                  }`}>
                    Save 25%
                  </span>
                </button>
              </div>
            </div>

            {/* 4-Tier Pricing Grid */}
            <div className="mt-12 grid gap-4 lg:grid-cols-4 items-stretch">
              {/* Plan 1: Free */}
              <div className="flex flex-col justify-between rounded-3xl p-6 bg-white ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-extrabold text-neutral-950 dark:text-white">Free</p>
                  </div>
                  <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">For individual creators & quick one-off edits.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">$0</span>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Forever free</p>

                  <ul className="mt-6 space-y-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Up to 10 image exports / mo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Instant auto text detection</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Core Google Fonts library</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Standard PNG / WebP export</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white ring-1 ring-black/10 dark:ring-white/15 text-xs font-bold transition"
                  >
                    Start Free
                  </button>
                </div>
              </div>

              {/* Plan 2: Creator */}
              <div className="flex flex-col justify-between rounded-3xl p-6 bg-white ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-extrabold text-neutral-950 dark:text-white">Creator</p>
                  </div>
                  <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">For designers & content marketers.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                      {isYearly ? '$14' : '$19'}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{isYearly ? 'Billed yearly ($168/yr)' : 'Billed monthly'}</p>

                  <ul className="mt-6 space-y-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Unlimited image exports</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Automated font matching</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Deep background texture fill</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Studio JPEG & WebP Ultra</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white ring-1 ring-black/10 dark:ring-white/15 text-xs font-bold transition"
                  >
                    Start 7-Day Trial
                  </button>
                </div>
              </div>

              {/* Plan 3: Studio Pro (Highlighted Card - HeyRetro Style) */}
              <div className="flex flex-col justify-between rounded-3xl p-6 bg-neutral-950 text-white ring-1 ring-neutral-950 dark:bg-white dark:text-neutral-950 dark:ring-white shadow-xl scale-105 z-10">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-extrabold">Studio Pro</p>
                    <span className="rounded-full bg-[#ff6f42] px-2.5 py-0.5 text-xs font-bold text-white">
                      Most popular
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-neutral-300 dark:text-neutral-700">For agencies, media studios, and e-commerce teams.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {isYearly ? '$49' : '$59'}
                    </span>
                    <span className="text-xs font-medium text-neutral-400 dark:text-neutral-600">/month</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 font-medium">{isYearly ? 'Billed yearly ($588/yr)' : 'Billed monthly'}</p>

                  <ul className="mt-6 space-y-2.5 text-xs font-semibold text-neutral-100 dark:text-neutral-900">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Everything in Creator</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Batch image processing API</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Custom font uploads (.ttf, .otf, .woff2)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Color profile preservation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>GPU-accelerated rendering</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white text-xs font-bold shadow-md transition"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>

              {/* Plan 4: Enterprise */}
              <div className="flex flex-col justify-between rounded-3xl p-6 bg-white ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-extrabold text-neutral-950 dark:text-white">Enterprise</p>
                  </div>
                  <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">For corporations with scale & security needs.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                      {isYearly ? '$99' : '$119'}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{isYearly ? 'Billed yearly' : 'Billed monthly'}</p>

                  <ul className="mt-6 space-y-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Unlimited team members</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>SAML & OIDC SSO</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Self-hosted on-premise container option</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#ff6f42] shrink-0 mt-0.5" />
                      <span>Dedicated SLA & 24/7 engineering support</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white ring-1 ring-black/10 dark:ring-white/15 text-xs font-bold transition"
                  >
                    Contact Sales
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: ENTERPRISE CALLOUT BANNER (HeyRetro Layout) */}
          <section className="py-16">
            <div className="overflow-hidden rounded-[2rem] bg-neutral-950 p-8 text-white shadow-[0_34px_90px_-44px_rgba(15,23,42,0.8)] sm:p-10 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20">
                    <Lock className="w-3.5 h-3.5" /> Enterprise Grade
                  </div>
                  <h2 className="mt-5 max-w-[28ch] text-2xl font-extrabold tracking-tight text-balance sm:text-4xl text-white">
                    Built for high-volume catalog & localization pipelines.
                  </h2>
                  <p className="mt-4 max-w-[50ch] text-sm font-medium text-neutral-300">
                    Deploy Retypo on-premises or connect our batch REST endpoints to automatically replace pricing, translate product labels, and update brand banners at scale.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      onClick={() => onLoadSample('tech')}
                      className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-[#ff6f42] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#ee6037] transition"
                    >
                      Explore Enterprise <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <a href="#pricing" className="text-xs font-bold text-neutral-300 hover:text-white">
                      See plan comparison
                    </a>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                    <ShieldCheck className="w-5 h-5 text-[#ff6f42] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">100% Pixel Safety</p>
                      <p className="mt-0.5 text-xs font-medium text-neutral-300">
                        Pixel-perfect guarantee ensures only edited text zones are touched.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                    <Share2 className="w-5 h-5 text-[#ff6f42] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">REST API & Batch Ingestion</p>
                      <p className="mt-0.5 text-xs font-medium text-neutral-300">
                        Headless automated processing runs inside containerized pipelines.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                    <FileCheck className="w-5 h-5 text-[#ff6f42] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">ICC Color Profile Passthrough</p>
                      <p className="mt-0.5 text-xs font-medium text-neutral-300">
                        Preserves CMYK & sRGB profiles for professional printing houses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 8: FAQ ACCORDION (HeyRetro Layout) */}
          <section id="faq" className="py-20 border-t border-neutral-200 dark:border-neutral-800">
            <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-start">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950 dark:text-white">
                  Common questions.
                </h2>
                <p className="mt-4 text-sm font-medium text-neutral-700 dark:text-neutral-300 max-w-sm">
                  Everything you need to know about font reconstruction, inpainting quality, and image safety.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: 'Will editing text degrade the rest of my image?',
                    a: 'No. Retypo uses non-destructive masked compositing. Only the exact text region is inpainted and updated. All surrounding background pixels remain 100% untouched with original color profiles preserved.'
                  },
                  {
                    q: 'How does font reconstruction find the right font?',
                    a: 'Retypo analyzes letter geometry, stroke weight, serifs, and aspect ratios to match the closest typeface from Google Fonts and system font libraries.'
                  },
                  {
                    q: 'What image formats and resolutions are supported?',
                    a: 'You can upload PNG, JPG, JPEG, and WebP images up to 50MB and 8K resolution. Exports are rendered at full native source resolution without downsampling artifacts.'
                  },
                  {
                    q: 'Does it work with complex gradient or textured backgrounds?',
                    a: 'Yes. Retypo incorporates multi-tier background restoration, from solid fills and directional gradients up to deep texture restoration for complex scenery.'
                  },
                  {
                    q: 'Can I use this completely offline or locally?',
                    a: 'Yes. Retypo runs directly on your machine with zero external cloud dependencies or data sharing.'
                  }
                ].map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/15 overflow-hidden shadow-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">{item.q}</span>
                        <ChevronDown className={`w-4 h-4 text-neutral-600 dark:text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-xs/6 sm:text-sm/6 font-medium text-neutral-700 dark:text-neutral-300 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 9: BOTTOM CTA BANNER (HeyRetro Layout) */}
          <section className="py-16">
            <div className="overflow-hidden rounded-[2rem] bg-white p-8 text-center ring-1 ring-black/10 sm:p-12 dark:bg-neutral-900 dark:ring-white/15 shadow-xl">
              <div className="mx-auto flex max-w-[640px] flex-col items-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#ffefe8] text-[#ff6f42] dark:bg-[#ff6f42]/20 dark:text-[#ff946f] mb-4">
                  <Type className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950 dark:text-white">
                  Start editing text in your images now.
                </h2>
                <p className="mt-4 text-sm font-medium text-neutral-700 dark:text-neutral-300 max-w-md">
                  Drop any flattened image into the studio or test with our sample presets in one click.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-[#ff6f42] hover:bg-[#ee6037] px-6 text-sm font-bold text-white shadow-md transition"
                  >
                    Upload Image to Edit <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* SECTION 10: COMPREHENSIVE FOOTER (HeyRetro Multi-column Layout) */}
        <footer className="border-t border-neutral-200 dark:border-neutral-800 py-14 bg-neutral-100/70 dark:bg-neutral-950">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[minmax(15rem,0.9fr)_minmax(0,3.1fr)]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-neutral-950 font-bold">
                    <span className="font-serif text-sm">R</span>
                  </div>
                  <span className="font-extrabold text-base tracking-tight text-neutral-950 dark:text-white">Retypo</span>
                </div>
                <p className="mt-4 text-xs/5 font-medium text-neutral-700 dark:text-neutral-400 max-w-xs">
                  High-fidelity AI image text editor with OCR detection, background inpainting, and typography reconstruction.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 text-xs font-medium">
                <div>
                  <p className="font-extrabold text-neutral-950 dark:text-white mb-3">Product</p>
                  <ul className="space-y-2 text-neutral-700 dark:text-neutral-300">
                    <li><a href="#features" className="hover:text-neutral-950 dark:hover:text-white font-semibold">Features</a></li>
                    <li><a href="#demo" className="hover:text-neutral-950 dark:hover:text-white font-semibold">Interactive Demo</a></li>
                    <li><a href="#workflow" className="hover:text-neutral-950 dark:hover:text-white font-semibold">Workflow</a></li>
                    <li><a href="#presets" className="hover:text-neutral-950 dark:hover:text-white font-semibold">Templates</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-neutral-950 dark:text-white mb-3">Capabilities</p>
                  <ul className="space-y-2 text-neutral-700 dark:text-neutral-300 font-semibold">
                    <li><span>Instant Text Scanner</span></li>
                    <li><span>Background Texture Fill</span></li>
                    <li><span>Automated Font Matcher</span></li>
                    <li><span>Vector Studio Canvas</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-neutral-950 dark:text-white mb-3">Sample Presets</p>
                  <ul className="space-y-2 text-neutral-700 dark:text-neutral-300">
                    <li><button onClick={() => onLoadSample('magazine')} className="hover:text-neutral-950 dark:hover:text-white text-left font-semibold">Editorial Magazine</button></li>
                    <li><button onClick={() => onLoadSample('coffee')} className="hover:text-neutral-950 dark:hover:text-white text-left font-semibold">Artisan Coffee</button></li>
                    <li><button onClick={() => onLoadSample('tech')} className="hover:text-neutral-950 dark:hover:text-white text-left font-semibold">Tech Conference</button></li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-neutral-950 dark:text-white mb-3">Legal & Safety</p>
                  <ul className="space-y-2 text-neutral-700 dark:text-neutral-300 font-semibold">
                    <li><span>100% Non-Destructive</span></li>
                    <li><span>Zero Data Tracking</span></li>
                    <li><span>Local Processing</span></li>
                    <li><span>100% Native Resolution</span></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-400 gap-4">
              <p>© 2026 Retypo — Starlight Canvas. All rights reserved.</p>
              <p>Designed with HeyRetro structure & precision typography.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
