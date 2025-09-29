import { validate } from 'class-validator';
import { Coupon, DiscountType, CouponPriority } from './coupon.entity';

describe('Coupon Entity', () => {
  let validCoupon: Coupon;

  beforeEach(() => {
    validCoupon = new Coupon(
      'coupon-001',
      'TEST10',
      DiscountType.PERCENTAGE,
      10,
      CouponPriority.BASIC,
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      100,
    );
  });

  describe('constructor', () => {
    it('should create a coupon with valid properties', () => {
      expect(validCoupon.id).toBe('coupon-001');
      expect(validCoupon.code).toBe('TEST10');
      expect(validCoupon.type).toBe(DiscountType.PERCENTAGE);
      expect(validCoupon.value).toBe(10);
      expect(validCoupon.priority).toBe(CouponPriority.BASIC);
      expect(validCoupon.validFrom).toEqual(new Date('2024-01-01'));
      expect(validCoupon.validUntil).toEqual(new Date('2024-12-31'));
      expect(validCoupon.usageLimit).toBe(100);
      expect(validCoupon.usedCount).toBe(0);
      expect(validCoupon.usedBy).toEqual([]);
    });
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const errors = await validate(validCoupon);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid id', async () => {
      const invalidCoupon = new Coupon(
        '',
        'TEST10',
        DiscountType.PERCENTAGE,
        10,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      const errors = await validate(invalidCoupon);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation with negative value', async () => {
      const invalidCoupon = new Coupon(
        'coupon-001',
        'TEST10',
        DiscountType.PERCENTAGE,
        -10,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      const errors = await validate(invalidCoupon);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('isValid', () => {
    it('should return true when current date is within validity period', () => {
      const now = new Date('2024-06-15');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      expect(validCoupon.isValid()).toBe(true);
    });

    it('should return false when current date is before validFrom', () => {
      const now = new Date('2023-12-31');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      expect(validCoupon.isValid()).toBe(false);
    });

    it('should return false when current date is after validUntil', () => {
      const now = new Date('2025-01-01');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      expect(validCoupon.isValid()).toBe(false);
    });
  });

  describe('isUsageLimitReached', () => {
    it('should return false when usedCount is less than usageLimit', () => {
      validCoupon.usedCount = 50;
      expect(validCoupon.isUsageLimitReached()).toBe(false);
    });

    it('should return true when usedCount equals usageLimit', () => {
      validCoupon.usedCount = 100;
      expect(validCoupon.isUsageLimitReached()).toBe(true);
    });

    it('should return false when usageLimit is not set', () => {
      const unlimitedCoupon = new Coupon(
        'coupon-002',
        'UNLIMITED',
        DiscountType.FIXED,
        50,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      unlimitedCoupon.usedCount = 1000;
      expect(unlimitedCoupon.isUsageLimitReached()).toBe(false);
    });
  });

  describe('canBeUsedBy', () => {
    it('should return true when user has not used the coupon', () => {
      expect(validCoupon.canBeUsedBy('user-001')).toBe(true);
    });

    it('should return false when user has already used the coupon', () => {
      validCoupon.usedBy = ['user-001', 'user-002'];
      expect(validCoupon.canBeUsedBy('user-001')).toBe(false);
    });
  });

  describe('useBy', () => {
    it('should add user to usedBy list and increment usedCount', () => {
      validCoupon.useBy('user-001');
      expect(validCoupon.usedBy).toContain('user-001');
      expect(validCoupon.usedCount).toBe(1);
    });

    it('should throw error when user has already used the coupon', () => {
      validCoupon.usedBy = ['user-001'];
      expect(() => validCoupon.useBy('user-001')).toThrow('Coupon already used by this user');
    });

    it('should throw error when usage limit is reached', () => {
      validCoupon.usedCount = 100;
      expect(() => validCoupon.useBy('user-001')).toThrow('Coupon usage limit reached');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount correctly', () => {
      const percentageCoupon = new Coupon(
        'coupon-001',
        'PERCENT10',
        DiscountType.PERCENTAGE,
        10,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(percentageCoupon.calculateDiscount(100)).toBe(10);
      expect(percentageCoupon.calculateDiscount(50)).toBe(5);
    });

    it('should not exceed original amount for percentage discount', () => {
      const percentageCoupon = new Coupon(
        'coupon-001',
        'PERCENT150',
        DiscountType.PERCENTAGE,
        150,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(percentageCoupon.calculateDiscount(100)).toBe(100);
    });

    it('should calculate fixed discount correctly', () => {
      const fixedCoupon = new Coupon(
        'coupon-002',
        'FIXED50',
        DiscountType.FIXED,
        50,
        CouponPriority.BASIC,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(fixedCoupon.calculateDiscount(100)).toBe(50);
      expect(fixedCoupon.calculateDiscount(30)).toBe(30);
    });
  });
});