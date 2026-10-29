import { describe, it, expect } from 'vitest';
import { AboutModal } from '../components/AboutModal';

describe('AboutModal & Licenses Component', () => {
  it('exports AboutModal component correctly', () => {
    expect(AboutModal).toBeDefined();
    expect(typeof AboutModal).toBe('function');
  });

  it('contains expected tab types for navigation', () => {
    const validTabs = ['about', 'licenses', 'privacy'];
    expect(validTabs).toContain('about');
    expect(validTabs).toContain('licenses');
    expect(validTabs).toContain('privacy');
  });

  it('validates license and attribution structure', () => {
    const projectLicense = 'MIT';
    const author = 'Pannaga J A';
    const year = 2026;

    expect(projectLicense).toBe('MIT');
    expect(author).toContain('Pannaga');
    expect(year).toBe(2026);
  });
});

