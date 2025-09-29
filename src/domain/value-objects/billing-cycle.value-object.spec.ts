import { validate } from 'class-validator';
import { BillingCycle, BillingCycleUnit } from './billing-cycle.value-object';

describe('BillingCycle Value Object', () => {
  describe('constructor', () => {
    it('should create a billing cycle with valid properties', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      expect(cycle.unit).toBe(BillingCycleUnit.MONTHS);
      expect(cycle.value).toBe(1);
    });
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      const errors = await validate(cycle);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid unit', async () => {
      const cycle = new BillingCycle('invalid' as any, 1);
      const errors = await validate(cycle);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with zero value', async () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 0);
      const errors = await validate(cycle);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with negative value', async () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, -1);
      const errors = await validate(cycle);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('calculateNextBillingDate', () => {
    it('should calculate next billing date for days', () => {
      const cycle = new BillingCycle(BillingCycleUnit.DAYS, 30);
      const fromDate = new Date('2024-01-01');
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      const expectedDate = new Date('2024-01-31');
      expect(nextDate).toEqual(expectedDate);
    });

    it('should calculate next billing date for weeks', () => {
      const cycle = new BillingCycle(BillingCycleUnit.WEEKS, 2);
      const fromDate = new Date('2024-01-01');
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      const expectedDate = new Date('2024-01-15');
      expect(nextDate).toEqual(expectedDate);
    });

    it('should calculate next billing date for months', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      const fromDate = new Date('2024-01-15');
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      const expectedDate = new Date('2024-02-15');
      expect(nextDate).toEqual(expectedDate);
    });

    it('should handle month end correctly', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      const fromDate = new Date('2024-01-31');
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      // Should be February 29, 2024 (leap year)
      const expectedDate = new Date('2024-02-29');
      expect(nextDate).toEqual(expectedDate);
    });

    it('should calculate next billing date for years', () => {
      const cycle = new BillingCycle(BillingCycleUnit.YEARS, 1);
      const fromDate = new Date('2024-06-15');
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      const expectedDate = new Date('2025-06-15');
      expect(nextDate).toEqual(expectedDate);
    });

    it('should handle leap year correctly', () => {
      const cycle = new BillingCycle(BillingCycleUnit.YEARS, 1);
      const fromDate = new Date('2024-02-29'); // 2024 is leap year
      const nextDate = cycle.calculateNextBillingDate(fromDate);
      const expectedDate = new Date('2025-02-28'); // 2025 is not leap year
      expect(nextDate).toEqual(expectedDate);
    });
  });

  describe('isBillingDate', () => {
    it('should return true for correct billing date', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      const baseDate = new Date('2024-01-01');
      const checkDate = new Date('2024-02-01');
      expect(cycle.isBillingDate(baseDate, checkDate)).toBe(true);
    });

    it('should return false for incorrect billing date', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 1);
      const baseDate = new Date('2024-01-01');
      const checkDate = new Date('2024-02-02');
      expect(cycle.isBillingDate(baseDate, checkDate)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return correct string representation', () => {
      const cycle = new BillingCycle(BillingCycleUnit.MONTHS, 3);
      expect(cycle.toString()).toBe('3 months');
    });
  });

  describe('static factory methods', () => {
    it('should create weekly cycle', () => {
      const cycle = BillingCycle.weekly();
      expect(cycle.unit).toBe(BillingCycleUnit.WEEKS);
      expect(cycle.value).toBe(1);
    });

    it('should create monthly cycle', () => {
      const cycle = BillingCycle.monthly();
      expect(cycle.unit).toBe(BillingCycleUnit.MONTHS);
      expect(cycle.value).toBe(1);
    });

    it('should create quarterly cycle', () => {
      const cycle = BillingCycle.quarterly();
      expect(cycle.unit).toBe(BillingCycleUnit.MONTHS);
      expect(cycle.value).toBe(3);
    });

    it('should create yearly cycle', () => {
      const cycle = BillingCycle.yearly();
      expect(cycle.unit).toBe(BillingCycleUnit.YEARS);
      expect(cycle.value).toBe(1);
    });

    it('should create custom cycle', () => {
      const cycle = BillingCycle.custom(BillingCycleUnit.DAYS, 15);
      expect(cycle.unit).toBe(BillingCycleUnit.DAYS);
      expect(cycle.value).toBe(15);
    });
  });
});