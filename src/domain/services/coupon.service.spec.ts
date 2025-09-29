import { Test, TestingModule } from '@nestjs/testing';
import { CouponService } from './coupon.service';
import { Coupon, DiscountType, CouponPriority } from '../entities/coupon.entity';
import { Discount } from '../value-objects/discount.value-object';

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CouponService],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sortByPriority', () => {
    it('should sort coupons by priority (highest first)', () => {
      const coupon1 = new Coupon('1', 'CODE1', DiscountType.PERCENTAGE, 10, CouponPriority.BASIC, new Date(), new Date());
      const coupon2 = new Coupon('2', 'CODE2', DiscountType.PERCENTAGE, 20, CouponPriority.RENEWAL, new Date(), new Date());
      const coupon3 = new Coupon('3', 'CODE3', DiscountType.PERCENTAGE, 30, CouponPriority.CAMPAIGN, new Date(), new Date());

      const coupons = [coupon1, coupon3, coupon2];
      const sorted = service.sortByPriority(coupons);

      expect(sorted[0].priority).toBe(CouponPriority.CAMPAIGN);
      expect(sorted[1].priority).toBe(CouponPriority.RENEWAL);
      expect(sorted[2].priority).toBe(CouponPriority.BASIC);
    });
  });

  describe('compareDiscounts', () => {
    it('should return the better discount (higher amount)', () => {
      const discount1 = new Discount(DiscountType.PERCENTAGE, 10); // $10 on $100
      const discount2 = new Discount(DiscountType.FIXED, 15); // $15

      const result = service.compareDiscounts(discount1, discount2, 100);
      expect(result).toBe(discount2);
    });

    it('should return the first discount when amounts are equal', () => {
      const discount1 = new Discount(DiscountType.PERCENTAGE, 20); // $20
      const discount2 = new Discount(DiscountType.FIXED, 20); // $20

      const result = service.compareDiscounts(discount1, discount2, 100);
      expect(result).toBe(discount1);
    });
  });

  describe('validateCoupon', () => {
    it('should validate active coupon within date range', () => {
      const now = new Date();
      const coupon = new Coupon(
        '1',
        'VALID',
        DiscountType.PERCENTAGE,
        10,
        CouponPriority.BASIC,
        new Date(now.getTime() - 86400000), // yesterday
        new Date(now.getTime() + 86400000), // tomorrow
        100,
      );

      expect(() => service.validateCoupon(coupon)).not.toThrow();
    });

    it('should throw error for expired coupon', () => {
      const coupon = new Coupon('1', 'EXPIRED', DiscountType.PERCENTAGE, 10, CouponPriority.BASIC, new Date('2020-01-01'), new Date('2020-12-31'));

      expect(() => service.validateCoupon(coupon)).toThrow('Coupon has expired');
    });

    it('should throw error for not yet valid coupon', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      const coupon = new Coupon('1', 'FUTURE', DiscountType.PERCENTAGE, 10, CouponPriority.BASIC, future, new Date(future.getTime() + 86400000));

      expect(() => service.validateCoupon(coupon)).toThrow('Coupon is not yet valid');
    });

    it('should throw error for coupon at usage limit', () => {
      const coupon = new Coupon(
        '1',
        'LIMITED',
        DiscountType.PERCENTAGE,
        10,
        CouponPriority.BASIC,
        new Date(),
        new Date(Date.now() + 86400000), // tomorrow
        1,
      );
      coupon.usedCount = 1;

      expect(() => service.validateCoupon(coupon)).toThrow('Coupon usage limit exceeded');
    });
  });

  describe('applyBestDiscount', () => {
    it('should prioritize campaign coupon over renewal discount', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      const campaignCoupon = new Coupon('1', 'CAMPAIGN', DiscountType.FIXED, 20, CouponPriority.CAMPAIGN, past, future);
      const renewalCount = 2; // 10% discount
      const baseAmount = 100;

      const result = service.applyBestDiscount([campaignCoupon], renewalCount, baseAmount);

      expect(result.discountAmount).toBe(20); // Campaign coupon wins
      expect(result.finalAmount).toBe(80);
      expect(result.appliedCoupon).toBe(campaignCoupon);
    });

    it('should apply renewal discount when no higher priority coupons available', () => {
      const renewalCount = 2; // 10% discount
      const baseAmount = 100;

      const result = service.applyBestDiscount([], renewalCount, baseAmount);

      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount).toBe(90);
      expect(result.appliedCoupon).toBeNull();
    });

    it('should choose better discount between same priority coupons', () => {
      const basicCoupon1 = new Coupon('1', 'BASIC1', DiscountType.PERCENTAGE, 5, CouponPriority.BASIC, new Date(), new Date());
      const basicCoupon2 = new Coupon('2', 'BASIC2', DiscountType.FIXED, 10, CouponPriority.BASIC, new Date(), new Date());
      const renewalCount = 1; // 5% discount

      const result = service.applyBestDiscount([basicCoupon1, basicCoupon2], renewalCount, 100);

      expect(result.discountAmount).toBe(10); // Fixed $10 wins over 5%
      expect(result.appliedCoupon).toBe(basicCoupon2);
    });
  });
});
