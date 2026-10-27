import React, { useState, useRef, useEffect, useCallback } from 'react';
import Lenis from 'lenis';
import {
  UploadCloud,
  Type,
  ScanText,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Layers,
  Eraser,
  LayoutTemplate,
  Download
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Smooth scroll state (Lenis driven)
  const [scrollY, setScrollY] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [headingOffset, setHeadingOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const lenisRef = useRef<Lenis | null>(null);
  const heroHeadingRef = useRef<HTMLDivElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enforce light theme only - keep document element clean of 'dark' class
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Initialize Lenis Buttery Smooth Inertia Scroll (Two26 & Roveia style)
  useEffect(() => {
    const scrollContainer = document.getElementById('landing-scroll-container') || (typeof window !== 'undefined' ? window : null);
    if (!scrollContainer) return;

    let lenis: Lenis;
    try {
      lenis = new Lenis({
        wrapper: scrollContainer instanceof HTMLElement ? scrollContainer : window,
        content: scrollContainer instanceof HTMLElement ? (scrollContainer.firstElementChild as HTMLElement) || undefined : undefined,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5,
      });

      lenisRef.current = lenis;

      let animationFrameId: number;
      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameId = requestAnimationFrame(raf);
      };
      animationFrameId = requestAnimationFrame(raf);

      const handleScroll = (e: { scroll: number; limit: number }) => {
        const current = e.scroll || 0;
        const max = e.limit || 1;
        setScrollY(current);
        setScrollProgress(Math.min(100, Math.max(0, (current / max) * 100)));
      };

      lenis.on('scroll', handleScroll);

      const handleResize = () => lenis.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        lenis.destroy();
        lenisRef.current = null;
      };
    } catch (err) {
      console.warn('Lenis scroll initialization', err);
    }
  }, []);

  // Scroll Reveal Observer (Smooth viewport entry animation)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);

  // Two26 Magnetic Dual Heading Pointer Tracker
  const handleHeadingMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroHeadingRef.current) return;
    const rect = heroHeadingRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const maxRadius = Math.max(rect.width, rect.height) / 2 || 200;
    const intensity = Math.min(1, Math.max(0.2, distance / maxRadius));
    const angle = Math.atan2(dy, dx);
    setHeadingOffset({
      x: Math.cos(angle) * (intensity * 4.5),
      y: Math.sin(angle) * (intensity * 3.5),
    });
  };

  const handleHeadingMouseLeave = () => {
    setHeadingOffset({ x: 0, y: 0 });
  };

  // Smooth Section Navigation Link Scroll (Lenis backed)
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) return;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -90, duration: 1.1 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  const isScrolled = scrollY > 25;

  return (
    <div className="min-h-screen w-full bg-[#f7f5f0] text-neutral-950 [font-family:'Inter',var(--font-sans)] antialiased select-none">
      {/* Top Dynamic Reading Progress Bar (Two26 & Roveia style) */}
      <div className="fixed top-0 inset-x-0 z-50 h-[3px] bg-neutral-200/40 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-[#ff6f42] via-[#ff885e] to-[#ff5400] transition-[width] duration-75 ease-out shadow-[0_0_10px_rgba(255,111,66,0.6)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Background Dot Texture */}
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(23,23,23,0.14)_1px,transparent_1px)] [background-size:18px_18px] opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-white/90 to-transparent" />

        {/* Global Drag-and-Drop Overlay */}
        {isGlobalDraggingOver && (
          <div className="fixed inset-0 z-50 bg-[#ff6f42]/15 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-[#ff6f42] animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4 text-center max-w-md ring-1 ring-black/10 scale-105 transition-transform">
              <div className="w-20 h-20 rounded-full bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center animate-bounce">
                <UploadCloud className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-950">Drop Image to Open</h3>
              <p className="text-sm font-medium text-neutral-700">
                Release anywhere to instantly open your image in Retypo Studio.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Capsule Header (Scroll-reactive) */}
        <header
          className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
            isScrolled ? 'pt-2.5 pb-2' : 'pt-4 pb-3'
          }`}
        >
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div
              className={`relative flex items-center justify-between gap-4 rounded-[1.75rem] px-5 py-3 transition-all duration-300 ${
                isScrolled
                  ? 'bg-white/95 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.2)] ring-1 ring-black/10 backdrop-blur-2xl scale-[0.99]'
                  : 'bg-white/90 shadow-[0_18px_55px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/8 backdrop-blur-xl'
              }`}
            >
              {/* Brand Logo */}
              <a href="#" className="flex shrink-0 items-center group">
                <img
                  src="/Retypo Logo with Orange Accents.png"
                  alt="Retypo"
                  className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </a>

              {/* Navigation Links (Smooth Lenis scrolling) */}
              <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-neutral-600">
                <a
                  href="#features"
                  onClick={(e) => scrollToSection(e, 'features')}
                  className="hover:text-[#ff6f42] transition-colors"
                >
                  Features
                </a>
                <a
                  href="#demo"
                  onClick={(e) => scrollToSection(e, 'demo')}
                  className="hover:text-[#ff6f42] transition-colors"
                >
                  Interactive Demo
                </a>
                <a
                  href="#workflow"
                  onClick={(e) => scrollToSection(e, 'workflow')}
                  className="hover:text-[#ff6f42] transition-colors"
                >
                  Workflow
                </a>
                <a
                  href="#faq"
                  onClick={(e) => scrollToSection(e, 'faq')}
                  className="hover:text-[#ff6f42] transition-colors"
                >
                  FAQ
                </a>
              </nav>

              {/* Action Button */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
          <section className="pt-6 pb-12 sm:pt-8 md:pt-8 lg:pt-10 lg:pb-16">
            <div className="flex flex-col items-center text-center">
              {/* TWO26 MAGNETIC DUAL HEADING COMPONENT */}
              <div
                ref={heroHeadingRef}
                onMouseMove={handleHeadingMouseMove}
                onMouseLeave={handleHeadingMouseLeave}
                className="relative inline-block cursor-default select-none group"
              >
                {/* Sharp foreground primary heading */}
                <h1 className="relative z-10 max-w-[22ch] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance text-neutral-950 pointer-events-none">
                  Images with text.{' '}
                  <span className="hero-shimmer bg-clip-text text-transparent">
                    Now editable.
                  </span>
                </h1>

                {/* Two26 magnetic offset layer */}
                <h1
                  aria-hidden="true"
                  style={{
                    transform: `translate3d(${headingOffset.x}px, ${headingOffset.y}px, 0)`,
                    transition: headingOffset.x === 0 ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.12s ease-out',
                  }}
                  className="absolute inset-0 z-0 max-w-[22ch] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance text-[#ff6f42] opacity-75 blur-[0.6px] pointer-events-none select-none"
                >
                  Images with text. <span>Now editable.</span>
                </h1>
              </div>

              {/* Subtitle - HIGH CONTRAST */}
              <p className="mt-5 max-w-[56ch] text-base/7 text-pretty text-neutral-700 sm:text-lg/8 font-medium">
                Upload any flattened PNG, JPG, or WebP. Retypo detects text automatically, cleans the background seamlessly, and lets you edit typography while keeping all your image pixels untouched.
              </p>
            </div>

            {/* HERO CENTERPIECE WITH FLOATING SATELLITES */}
            <div className="relative mx-auto mt-8 md:mt-10 lg:mt-12 max-w-[1020px] pb-4 md:pb-6">
              {/* Diffuse Colorful Radial Ambient Backlight */}
              <div className="pointer-events-none absolute -inset-x-12 -top-12 -z-10 h-[calc(100%+7rem)] rounded-[4rem] bg-gradient-to-br from-[#ffd3bd] via-[#fdeee2] to-[#dceefb] opacity-90 blur-3xl sm:-inset-x-24" />

              {/* Responsive Scaling Container: Preserves exact floating satellite composition on tablet and desktop */}
              <div className="relative w-full transition-transform duration-200 md:scale-[0.76] min-[840px]:scale-[0.84] min-[940px]:scale-[0.92] lg:scale-100 origin-top md:-mb-24 min-[840px]:-mb-16 min-[940px]:-mb-8 lg:mb-0">
                {/* Centerpiece Studio Dropzone Card */}
                <div className="relative z-10 mx-auto w-full max-w-[500px] rounded-2xl bg-white shadow-[0_44px_90px_-36px_rgba(15,23,42,0.4)] ring-1 ring-black/10 p-5">
                  {/* Mock Card Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold tracking-tight text-neutral-900">Studio Canvas Workspace</span>
                      <span className="text-[11px] text-neutral-500 font-mono font-medium">1920×1080</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <ScanText className="w-3 h-3 text-emerald-600" /> Auto Text Detection Ready
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
                        ? 'border-[#ff6f42] bg-[#fff6f2] scale-[1.02]'
                        : 'border-neutral-300 bg-[#fdfbf9] hover:border-[#ff6f42] hover:bg-neutral-50'
                    }`}
                  >
                    {/* Upload Icon Container */}
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white shadow-md ring-1 ring-black/10 flex items-center justify-center text-[#ff6f42] mb-3 transition-transform duration-200 group-hover:scale-110">
                      <UploadCloud className="w-7 h-7" />
                    </div>

                    <p className="text-base font-extrabold tracking-tight text-neutral-950">
                      Drag & Drop your image here
                    </p>
                    <p className="mt-1 text-xs font-semibold text-neutral-600">
                      Supports PNG, JPG, JPEG, WebP • Auto detects text & background
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 shadow-xs ring-1 ring-black/10">
                        PNG
                      </span>
                      <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 shadow-xs ring-1 ring-black/10">
                        JPG
                      </span>
                      <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 shadow-xs ring-1 ring-black/10">
                        WebP
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-mono font-bold text-neutral-700 ring-1 ring-black/5">
                        ⌘O
                      </span>
                    </div>
                  </div>

                  {/* Bottom Phase Progress Capsule */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
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
                <div
                  style={{ transform: `translate3d(0, ${-scrollY * 0.03}px, 0)` }}
                  className="animate-float-satellite-1 absolute top-2 left-0 z-0 hidden w-52 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block transition-transform duration-100 ease-out"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-950">Font Matcher</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-xs text-neutral-700">
                    <div className="flex justify-between font-semibold text-[11px]">
                      <span>Font Accuracy</span>
                      <span className="text-emerald-600 font-extrabold">98.4%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-neutral-500 font-mono">Playfair · Inter · Lato</p>
                </div>

                {/* Satellite 2: Bottom-Left (rotate-3) */}
                <div
                  style={{ transform: `translate3d(0, ${-scrollY * 0.02}px, 0)` }}
                  className="animate-float-satellite-2 absolute bottom-4 left-6 z-20 hidden w-56 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block transition-transform duration-100 ease-out"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center">
                      <LayoutTemplate className="w-3.5 h-3.5 text-[#ff6f42]" />
                    </div>
                    <span className="text-xs font-bold text-neutral-950">Sample Templates</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onLoadSample('magazine')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Magazine
                    </button>
                    <button
                      onClick={() => onLoadSample('coffee')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Coffee
                    </button>
                    <button
                      onClick={() => onLoadSample('tech')}
                      className="rounded-lg bg-neutral-100 hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] py-1.5 px-1 text-center text-[11px] font-bold transition"
                    >
                      Tech
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[10px] font-bold text-[#ff6f42]">1-click instant sample</p>
                </div>

                {/* Satellite 3: Top-Right (rotate-6) */}
                <div
                  style={{ transform: `translate3d(0, ${-scrollY * 0.04}px, 0)` }}
                  className="animate-float-satellite-3 absolute top-4 right-0 z-20 hidden w-56 rounded-xl bg-white p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 md:block transition-transform duration-100 ease-out"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ScanText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-neutral-950">Auto Text Scanner</span>
                    </div>
                    <span className="rounded-md bg-indigo-500/10 text-indigo-600 text-[10px] font-mono font-bold px-1.5 py-0.5">
                      Active
                    </span>
                  </div>
                  <p className="mt-2 text-xs/5 font-medium text-neutral-700">
                    Detects angles, sizes, and font positions instantly.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      Lightning Fast Processing
                    </span>
                  </div>
                </div>

                {/* Satellite 4: Bottom-Right (-rotate-3 dark card) */}
                <div
                  style={{ transform: `translate3d(0, ${-scrollY * 0.025}px, 0)` }}
                  className="animate-float-satellite-4 absolute right-4 bottom-2 z-20 hidden w-60 rounded-xl bg-neutral-950 p-4 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.55)] ring-1 ring-neutral-800 md:block text-white transition-transform duration-100 ease-out"
                >
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
                  <div className="mt-2 space-y-1 font-mono text-[10px] font-medium text-neutral-200">
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
                className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-neutral-950 px-7 text-base font-bold text-white shadow-[0_18px_38px_-18px_rgba(15,23,42,0.65)] hover:bg-neutral-800 transition-all sm:text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Upload Image to Edit <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            <p className="mt-4 text-center text-xs font-bold text-neutral-600">
              No account required • 100% local processing • Works with all resolutions
            </p>
          </section>

          {/* KINETIC CAPABILITIES TICKER (Two26 & Roveia Signature Banner) */}
          <div className="scroll-reveal relative w-full overflow-hidden border-y border-neutral-200/80 bg-white/70 py-3.5 backdrop-blur-md my-8 shadow-xs rounded-xl">
            <div className="animate-marquee-tape flex items-center gap-8 text-[11px] font-extrabold text-neutral-800 uppercase tracking-widest">
              {[
                '100% Non-Destructive Editing',
                'Instant OCR Text Scanner',
                'Seamless Background Inpainting',
                'Automatic Typography Reconstruction',
                'Font Matcher Engine 98.4%',
                'Original High-Resolution Lossless Export',
                'Live Vector Typography Controls',
                '100% Non-Destructive Editing',
                'Instant OCR Text Scanner',
                'Seamless Background Inpainting',
                'Automatic Typography Reconstruction',
                'Font Matcher Engine 98.4%',
                'Original High-Resolution Lossless Export',
                'Live Vector Typography Controls'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6f42]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: 5-COLUMN BENTO FEATURES (HeyRetro Layout + Scroll Reveal) */}
          <section id="features" className="py-20 border-t border-neutral-200">
            <div className="scroll-reveal flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-12">
              <div>
                <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950">
                  One studio canvas.{' '}
                  <span className="text-neutral-500">Total typography control.</span>
                </h2>
              </div>
              <p className="max-w-[44ch] text-sm font-medium text-neutral-700">
                Everything you need to find, style, and edit flattened text in seconds.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Feature 1: Text Detection */}
              <div className="scroll-reveal group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition-all duration-300 hover:ring-black/20 hover:shadow-lg hover:-translate-y-1 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#fff3ec] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white shadow-xs text-[#ff6f42]">
                      <ScanText className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#ff6f42]/15 text-[#ff6f42]">
                      Auto Scan
                    </span>
                  </div>
                  <div className="rounded-xl bg-neutral-950 p-2.5 text-white shadow-xs border border-white/10">
                    <div className="flex items-center justify-between pb-1.5 border-neutral-800 text-[10px] text-neutral-300 font-mono border-b">
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
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950">Smart Text Detection</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Detects any text block, font angle, and position automatically.</p>
                </div>
              </div>

              {/* Feature 2: Clean Inpainting */}
              <div className="scroll-reveal group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition-all duration-300 hover:ring-black/20 hover:shadow-lg hover:-translate-y-1 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f0fdf4] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white shadow-xs text-emerald-600">
                      <Eraser className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Background Fill
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 shadow-xs border border-black/5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>CLEAN_TEXTURE</span>
                      <span className="text-emerald-600 font-bold">Seamless</span>
                    </div>
                    <div className="mt-2 h-7 rounded-lg bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-200 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-800 font-mono">
                        Texture Restored ✓
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950">Background Inpainting</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Erases text seamlessly while perfectly restoring underlying texture.</p>
                </div>
              </div>

              {/* Feature 3: Font Matcher */}
              <div className="scroll-reveal group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition-all duration-300 hover:ring-black/20 hover:shadow-lg hover:-translate-y-1 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eff6ff] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white shadow-xs text-sky-600">
                      <Type className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      Font Matcher
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 shadow-xs border border-black/5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>MATCHED_STYLE</span>
                      <span className="text-sky-600 font-bold">ACTIVE</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-serif text-lg font-bold text-neutral-900">Playfair</span>
                      <span className="text-[10px] font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-semibold">
                        Serif · 700
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950">Font Reconstruction</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Instantly matches serif, sans-serif, and weight to fonts.</p>
                </div>
              </div>

              {/* Feature 4: Vector Canvas */}
              <div className="scroll-reveal group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition-all duration-300 hover:ring-black/20 hover:shadow-lg hover:-translate-y-1 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#faf5ff] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white shadow-xs text-indigo-600">
                      <Layers className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Full Controls
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 shadow-xs border border-black/5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>TEXT_LAYER</span>
                      <span className="text-indigo-600 font-bold">VECTOR</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-neutral-800">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100">Size: 48px</span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100">Track: -0.02</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950">Vector Typography Layer</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Rotate, scale, recolor, and change text with total design freedom.</p>
                </div>
              </div>

              {/* Feature 5: Lossless Compositor */}
              <div className="scroll-reveal group overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition-all duration-300 hover:ring-black/20 hover:shadow-lg hover:-translate-y-1 shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#fefce8] p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-white shadow-xs text-amber-600">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      Full Quality
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 shadow-xs border border-black/5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>EXPORT_QUALITY</span>
                      <span className="text-amber-600 font-bold">ORIGINAL</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono font-bold text-neutral-800">
                      <span>High-Res</span>
                      <span className="text-emerald-600">PNG, JPG, WebP</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold tracking-tight text-neutral-950">Lossless Quality Export</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-600">Exports at full native source resolution with untouched pixels.</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: INTERACTIVE BEFORE / AFTER TRANSFORMATION SLIDER (Scroll Reveal) */}
          <section id="demo" className="py-20 border-t border-neutral-200">
            <div className="scroll-reveal flex flex-col items-center text-center mb-10">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950">
                See the reconstruction in action.
              </h2>
              <p className="mt-4 text-sm font-medium text-neutral-700 max-w-xl">
                Drag the divider below to inspect the transformation between the raw flattened raster image and Retypo's reconstructed editable vector typography.
              </p>
            </div>

            <div className="scroll-reveal mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.4)] ring-1 ring-black/10 p-4">
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

              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-neutral-700 px-2">
                <span>◀ Drag left for Reconstructed Vector</span>
                <span>Drag right for Flattened Raster ▶</span>
              </div>
            </div>
          </section>

          {/* SECTION 4: STEP-BY-STEP WORKFLOW WITH CURVED ARROWS (HeyRetro Signature Pattern) */}
          <section id="workflow" className="py-20 border-t border-neutral-200">
            <div className="scroll-reveal">
              <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-tight text-balance sm:text-5xl text-neutral-950">
                Static image. <span className="text-neutral-500">Editable canvas.</span>
              </h2>
            </div>

            <div className="mt-16 hidden items-center justify-between gap-3 lg:flex">
              {/* Step 1 */}
              <div className="scroll-reveal flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-[#fff1ec] text-[#ff6f42] flex items-center justify-center mb-2.5">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950">1. Ingest Image</span>
                  <span className="text-[11px] font-semibold text-neutral-500">PNG, JPG, or WebP</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950">Drop image</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600">
                  Drag any image onto the canvas. Works directly in browser.
                </p>
              </div>

              {/* Connector 1 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300" />
                  <div className="w-6 h-6 rounded-full bg-white ring-1 ring-black/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="scroll-reveal flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5">
                    <ScanText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950">2. Detect Text</span>
                  <span className="text-[11px] font-semibold text-neutral-500">Auto Angle & Position</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950">Detect text</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600">
                  Instant scanner maps exact text angle, size, and position.
                </p>
              </div>

              {/* Connector 2 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300" />
                  <div className="w-6 h-6 rounded-full bg-white ring-1 ring-black/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="scroll-reveal flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                    <Eraser className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950">3. Fill Background</span>
                  <span className="text-[11px] font-semibold text-neutral-500">Seamless Background Fill</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950">Restore texture</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600">
                  Erase original text while seamlessly restoring underlying texture.
                </p>
              </div>

              {/* Connector 3 */}
              <div className="flex flex-1 items-center justify-center mb-12 px-1" aria-hidden="true">
                <div className="flex items-center w-full gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-neutral-300" />
                  <div className="w-6 h-6 rounded-full bg-white ring-1 ring-black/10 flex items-center justify-center text-neutral-400 shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#ff6f42]" />
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 via-neutral-300 to-transparent" />
                </div>
              </div>

              {/* Step 4 */}
              <div className="scroll-reveal flex w-52 shrink-0 flex-col items-center text-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 p-4 flex flex-col justify-center items-center group hover:ring-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5">
                    <Download className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-950">4. Export Lossless</span>
                  <span className="text-[11px] font-semibold text-neutral-500">Original High Resolution</span>
                </div>
                <p className="mt-4 text-sm font-extrabold text-neutral-950">Edit & Export</p>
                <p className="mt-1 max-w-[22ch] text-xs/5 font-medium text-neutral-600">
                  Type new copy, resize typography, and export in full high resolution.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 8: FAQ ACCORDION (HeyRetro Layout + Scroll Reveal) */}
          <section id="faq" className="py-20 border-t border-neutral-200">
            <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-start">
              <div className="scroll-reveal">
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950">
                  Common questions.
                </h2>
                <p className="mt-4 text-sm font-medium text-neutral-700 max-w-sm">
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
                      className="scroll-reveal rounded-2xl bg-white ring-1 ring-black/10 overflow-hidden shadow-xs transition-shadow duration-200 hover:shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="text-sm sm:text-base font-bold text-neutral-950">{item.q}</span>
                        <ChevronDown className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-xs/6 sm:text-sm/6 font-medium text-neutral-700 border-t border-neutral-100 pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 9: BOTTOM CTA BANNER (HeyRetro Layout + Scroll Reveal) */}
          <section className="py-16">
            <div className="scroll-reveal overflow-hidden rounded-[2rem] bg-white p-8 text-center ring-1 ring-black/10 sm:p-12 shadow-xl">
              <div className="mx-auto flex max-w-[640px] flex-col items-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#ffefe8] text-[#ff6f42] mb-4 shadow-xs">
                  <Type className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-neutral-950">
                  Start editing text in your images now.
                </h2>
                <p className="mt-4 text-sm font-medium text-neutral-700 max-w-md">
                  Drop any flattened image into the studio to reconstruct and edit text in seconds.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-[#ff6f42] hover:bg-[#ee6037] px-6 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Upload Image to Edit <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* SECTION 10: COMPREHENSIVE FOOTER (HeyRetro Multi-column Layout) */}
        <footer className="border-t border-neutral-200 py-14 bg-neutral-100/70">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[minmax(15rem,0.9fr)_minmax(0,3.1fr)]">
              <div>
                <div className="flex items-center gap-2">
                  <img
                    src="/Retypo Logo with Orange Accents.png"
                    alt="Retypo"
                    className="h-6 sm:h-7 w-auto object-contain"
                  />
                </div>
                <p className="mt-4 text-xs/5 font-medium text-neutral-700 max-w-xs">
                  High-fidelity image text editor with automatic text detection, background fill, and typography reconstruction.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 text-xs font-medium">
                <div>
                  <p className="font-extrabold text-neutral-950 mb-3">Product</p>
                  <ul className="space-y-2 text-neutral-700">
                    <li><a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-neutral-950 transition-colors font-semibold">Features</a></li>
                    <li><a href="#demo" onClick={(e) => scrollToSection(e, 'demo')} className="hover:text-neutral-950 transition-colors font-semibold">Interactive Demo</a></li>
                    <li><a href="#workflow" onClick={(e) => scrollToSection(e, 'workflow')} className="hover:text-neutral-950 transition-colors font-semibold">Workflow</a></li>
                    <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="hover:text-neutral-950 transition-colors font-semibold">FAQ</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-neutral-950 mb-3">Capabilities</p>
                  <ul className="space-y-2 text-neutral-700 font-semibold">
                    <li><span>Instant Text Scanner</span></li>
                    <li><span>Background Texture Fill</span></li>
                    <li><span>Automated Font Matcher</span></li>
                    <li><span>Vector Studio Canvas</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-extrabold text-neutral-950 mb-3">Legal & Safety</p>
                  <ul className="space-y-2 text-neutral-700 font-semibold">
                    <li><span>100% Non-Destructive</span></li>
                    <li><span>Zero Data Tracking</span></li>
                    <li><span>Local Processing</span></li>
                    <li><span>100% Native Resolution</span></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-neutral-600 gap-4">
              <p>© 2026 Retypo. All rights reserved.</p>
              <p>Designed with HeyRetro structure & precision typography.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
