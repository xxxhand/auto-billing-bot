import { BillingCycle } from './billing-cycle.value-object';

describe('BillingCycle Value Object', () => {
  describe('calculateNextDate', () => {
    it('should calculate next date for monthly cycle', () => {
      const billingCycle = new BillingCycle('monthly');

      const nextDate = billingCycle.calculateNextDate('2025-01-15T00:00:00.000Z');

      expect(nextDate).toBe('2025-02-15T00:00:00.000Z');
    });

    it('should calculate next date for yearly cycle', () => {
      const billingCycle = new BillingCycle('yearly');

      const nextDate = billingCycle.calculateNextDate('2025-01-15T00:00:00.000Z');

      expect(nextDate).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should handle month boundary correctly', () => {
      const billingCycle = new BillingCycle('monthly');

      const nextDate = billingCycle.calculateNextDate('2025-01-31T00:00:00.000Z');

      expect(nextDate).toBe('2025-03-03T00:00:00.000Z'); // JavaScript Date rolls over
    });

    it('should handle leap year correctly', () => {
      const billingCycle = new BillingCycle('yearly');

      const nextDate = billingCycle.calculateNextDate('2024-02-29T00:00:00.000Z');

      expect(nextDate).toBe('2025-03-01T00:00:00.000Z'); // JavaScript adjusts invalid date
    });
  });

  describe('equality', () => {
    it('should be equal for same cycle type', () => {
      const cycle1 = new BillingCycle('monthly');
      const cycle2 = new BillingCycle('monthly');

      // Value objects should be compared by value, not reference
      expect(cycle1.cycleType).toBe(cycle2.cycleType);
    });

    it('should be different for different cycle types', () => {
      const cycle1 = new BillingCycle('monthly');
      const cycle2 = new BillingCycle('yearly');

      expect(cycle1.cycleType).not.toBe(cycle2.cycleType);
    });
  });
});
