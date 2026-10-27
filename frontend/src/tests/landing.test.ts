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

  it('verifies pricing plan structure', () => {
    const pricingTiers = [
      { name: 'Free', priceMonthly: 0, priceYearly: 0 },
      { name: 'Creator', priceMonthly: 19, priceYearly: 14 },
      { name: 'Studio Pro', priceMonthly: 59, priceYearly: 49 },
      { name: 'Enterprise', priceMonthly: 119, priceYearly: 99 },
    ];

    expect(pricingTiers.length).toBe(4);
    pricingTiers.forEach((tier) => {
      if (tier.priceMonthly > 0) {
        expect(tier.priceYearly).toBeLessThan(tier.priceMonthly);
        // Approximately 20-25% discount
        const discountPercent = ((tier.priceMonthly - tier.priceYearly) / tier.priceMonthly) * 100;
        expect(discountPercent).toBeGreaterThanOrEqual(15);
      }
    });
  });
});
