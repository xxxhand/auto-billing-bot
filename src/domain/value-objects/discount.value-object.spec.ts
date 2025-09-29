import { validate } from 'class-validator';
import { Discount, DiscountType } from './discount.value-object';

describe('Discount Value Object', () => {
  describe('constructor', () => {
    it('should create a percentage discount', () => {
      const discount = new Discount(DiscountType.PERCENTAGE, 10);
      expect(discount.type).toBe(DiscountType.PERCENTAGE);
      expect(discount.value).toBe(10);
    });

    it('should create a fixed discount', () => {
      const discount = new Discount(DiscountType.FIXED, 50);
      expect(discount.type).toBe(DiscountType.FIXED);
      expect(discount.value).toBe(50);
    });
  });

  describe('validation', () => {
    it('should pass validation with valid percentage discount', async () => {
      const discount = new Discount(DiscountType.PERCENTAGE, 10);
      const errors = await validate(discount);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with valid fixed discount', async () => {
      const discount = new Discount(DiscountType.FIXED, 50);
      const errors = await validate(discount);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with negative value', async () => {
      const discount = new Discount(DiscountType.PERCENTAGE, -10);
      const errors = await validate(discount);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('calculate', () => {
    it('should calculate percentage discount correctly', () => {
      const discount = new Discount(DiscountType.PERCENTAGE, 10);
      expect(discount.calculate(100)).toBe(10);
      expect(discount.calculate(50)).toBe(5);
      expect(discount.calculate(200)).toBe(20);
    });

    it('should not exceed original amount for percentage discount', () => {
      const discount = new Discount(DiscountType.PERCENTAGE, 150);
      expect(discount.calculate(100)).toBe(100);
    });

    it('should calculate fixed discount correctly', () => {
      const discount = new Discount(DiscountType.FIXED, 50);
      expect(discount.calculate(100)).toBe(50);
      expect(discount.calculate(30)).toBe(30);
      expect(discount.calculate(200)).toBe(50);
    });
  });

  describe('apply', () => {
    it('should apply percentage discount correctly', () => {
      const discount = new Discount(DiscountType.PERCENTAGE, 10);
      expect(discount.apply(100)).toBe(90);
      expect(discount.apply(50)).toBe(45);
    });

    it('should apply fixed discount correctly', () => {
      const discount = new Discount(DiscountType.FIXED, 50);
      expect(discount.apply(100)).toBe(50);
      expect(discount.apply(30)).toBe(0);
    });
  });
});