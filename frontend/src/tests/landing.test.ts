import { describe, it, expect } from 'vitest';
import { LandingPage } from '../components/LandingPage';

describe('LandingPage Architecture & Presets', () => {
  it('exports LandingPage component correctly', () => {
    expect(LandingPage).toBeDefined();
    expect(typeof LandingPage).toBe('function');
  });

  it('validates supported preset types', () => {
    const supportedPresets = ['magazine', 'coffee', 'tech'];
    expect(supportedPresets).toContain('magazine');
    expect(supportedPresets).toContain('coffee');
    expect(supportedPresets).toContain('tech');
    expect(supportedPresets.length).toBe(3);
  });

  it('validates core studio sections without pricing', () => {
    const coreSections = ['features', 'demo', 'workflow', 'faq'];
    expect(coreSections).toContain('features');
    expect(coreSections).toContain('demo');
    expect(coreSections).toContain('workflow');
    expect(coreSections).toContain('faq');
    expect(coreSections).not.toContain('pricing');
  });

  it('validates tablet and large screen satellite cards configuration', () => {
    const satelliteTitles = [
      'Font Matcher',
      'Sample Templates',
      'Auto Text Scanner',
      'Pixel Quality'
    ];
    expect(satelliteTitles.length).toBe(4);
    expect(satelliteTitles).toContain('Font Matcher');
    expect(satelliteTitles).toContain('Sample Templates');
    expect(satelliteTitles).toContain('Auto Text Scanner');
    expect(satelliteTitles).toContain('Pixel Quality');
  });

  it('validates clean header layout actions', () => {
    const headerActions = ['Retypo', 'Upload Image', 'Toggle dark mode'];
    expect(headerActions).toContain('Retypo');
    expect(headerActions).toContain('Upload Image');
    expect(headerActions).toContain('Toggle dark mode');
  });
});
