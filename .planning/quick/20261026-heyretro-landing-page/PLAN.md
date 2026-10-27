# Quick Task: HeyRetro-Inspired Original Landing Page for Retypo

## Objective
Build a complete, top-tier original landing page for Retypo (Starlight Canvas AI Image Text Editor), using HeyRetro's landing page structure, layout patterns, and quality bar as inspiration, with complete original branding, typography, and interactive features.

## Architecture & Sections
1. **Pill-Shaped Floating Header**:
   - Capsule container with glassmorphic backdrop (`backdrop-blur-xl bg-white/85 ring-1 ring-black/7`)
   - Retypo vector typography logo
   - Navigation anchors: Features, Workflow, Presets, Pricing, FAQ
   - Dark mode toggle button & "Try Live Demo" / "Launch Studio" CTAs
2. **Hero Section with Multi-Layered Centerpiece**:
   - Warm background (`bg-[#f7f5f0]`) with radial dot grid (`radial-gradient(rgba(23,23,23,0.12)_1px,transparent_1px)`)
   - Centered headline with organic highlight shimmer & hand-drawn curved accent icon
   - Interactive Drag & Drop centerpiece card with hover state, animated floating upload icon (`animate-float`), ripple rings, format indicators (`PNG`, `JPG`, `WebP`), and 1-click file selector
   - Full-window global drag & drop detection overlay ("Drop Image Here to Edit")
   - 4 tilted satellite cards around hero:
     - Top-Left (-rotate-6): 4-Signal Font Matching Pill ("98.4% Top-1 Accuracy")
     - Bottom-Left (rotate-3): Interactive Typography Preset Switcher
     - Top-Right (rotate-6): PaddleOCR Sub-pixel Geometry Badge
     - Bottom-Right (-rotate-3): Bitwise Lossless Compositor guarantee ("SSIM 1.000 • 0.0 Delta E")
   - Primary & Secondary CTAs with glowing green pulse status dot ("Try Live Interactive Demo")
3. **Features Bento Grid (5 Columns)**:
   - 5 cards with 4:3 preview container, zoom-on-hover, backdrop-blur reveal overlay with descriptive insights, and bold feature titles:
     1. Real-time OCR Text Detection
     2. Multi-Tier Background Inpainting
     3. 4-Signal Font Reconstruction
     4. Bitwise Lossless Compositor
     5. Fabric.js Vector Canvas Studio
4. **Interactive Before / After Transformation Slider**:
   - Side-by-side interactive split slider comparing raw static raster image vs. cleanly reconstructed editable typography + inpainted canvas
5. **Interactive 4-Step Workflow ("Static image. Editable canvas.")**:
   - 4 steps connected by SVG curved dashed arrows (`stroke-dasharray="5 6"`):
     1. Drop your image
     2. Sub-pixel text detection
     3. Seamless background restoration
     4. Edit typography & export lossless
6. **Curated Sample Presets Gallery**:
   - 3 curated presets (Vintage Editorial Magazine, Artisan Coffee Brand, Tech Summit Poster) with instant 1-click loading into the canvas editor
7. **Pricing Section**:
   - Monthly / Yearly billing toggle with hand-drawn cursive "Save ~25%" arrow badge
   - 4 plans: Free ($0), Creator ($14/mo), Studio Pro ($49/mo, highlighted dark card), Enterprise ($99/mo)
8. **Enterprise Callout Banner**:
   - High-contrast dark card highlighting SAML SSO, team workspaces, and batch API
9. **FAQ Accordion**:
   - Expandable interactive accordion addressing resolution, fonts, privacy, and export formats
10. **Bottom CTA & Detailed Footer**:
    - High-impact closing banner and multi-column footer with brand links
