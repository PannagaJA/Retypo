# Quick Plan: Responsive Hero & Satellites for Tablet & Large Screens

## Task Description
Ensure the hero section (header, headline, centerpiece dropzone, all 4 floating satellite cards, and CTA button) maintains its signature composition across all large screens and tablet views (768px - 1024px+).

## Problem Analysis
1. Floating satellite cards are currently set to `hidden lg:block`, causing them to disappear completely on tablet viewports (768px–1023px, iPad portrait & landscape).
2. On 768px–1023px viewports, if satellites are enabled naively with fixed absolute coordinates, they overlap the 500px centerpiece card.
3. Header navigation links are currently `hidden lg:flex`, disappearing on tablet viewports where they can comfortably fit.
4. Spacing and scale need to ensure the full composed view fits attractively within the screen view across large and tablet screens.

## Implementation Steps
1. **Header Navigation**:
   - Change `hidden lg:flex` to `hidden md:flex` with responsive text size (`text-[11px] lg:text-xs`) and padding (`px-2 lg:px-3`) so the full navigation is visible on tablet and large screens.
2. **Hero Centerpiece & Orbiting Satellites**:
   - Enable satellites on tablet (`md:block`) instead of `hidden lg:block`.
   - Implement responsive positioning, sizing, and smooth scale adaptation (`md:scale-[0.82] lg:scale-100` or responsive coordinate insets) so all 4 satellite cards frame the center studio dropzone card without collision or overlapping.
   - Satellite 1 (Font Matcher): Responsive sizing and offset for `md:` and `lg:`.
   - Satellite 2 (Sample Templates): Responsive sizing and offset for `md:` and `lg:`.
   - Satellite 3 (Auto Text Scanner): Responsive sizing and offset for `md:` and `lg:`.
   - Satellite 4 (Pixel Quality): Responsive sizing and offset for `md:` and `lg:`.
3. **Verification**:
   - Verify on 1280px (Desktop), 1024px (iPad Pro Landscape), 834px (iPad Pro Portrait), and 768px (Tablet) using browser testing.
   - Run unit tests and production build.
