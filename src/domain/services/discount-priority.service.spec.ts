import { Test, TestingModule } from '@nestjs/testing';
import { DiscountPriorityService } from './discount-priority.service';
import { Discount } from '../../../src/domain/entities/discount.entity';

describe('DiscountPriorityService', () => {
  let service: DiscountPriorityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscountPriorityService],
    }).compile();

    service = module.get<DiscountPriorityService>(DiscountPriorityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('selectBestDiscount', () => {
    it('should return null when no discounts are provided', () => {
      const result = service.selectBestDiscount([], 100);
      expect(result).toBeNull();
    });

    it('should return null when empty discounts array is provided', () => {
      const result = service.selectBestDiscount([], 100);
      expect(result).toBeNull();
    });

    it('should return the single discount when only one discount is provided', () => {
      const discount = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const result = service.selectBestDiscount([discount], 100);
      expect(result).toEqual(discount);
    });

    it('should select discount with highest priority', () => {
      const discount1 = new Discount('disc1', 'percentage', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const discount2 = new Discount('disc2', 'percentage', 15, 2, new Date('2025-01-01'), new Date('2025-12-31'));
      const discount3 = new Discount('disc3', 'percentage', 20, 3, new Date('2025-01-01'), new Date('2025-12-31'));

      const result = service.selectBestDiscount([discount1, discount2, discount3], 100);
      expect(result).toEqual(discount3);
    });

    it('should select discount with highest discount amount when priorities are equal', () => {
      const discount1 = new Discount('disc1', 'percentage', 10, 2, new Date('2025-01-01'), new Date('2025-12-31'));
      const discount2 = new Discount('disc2', 'fixed', 25, 2, new Date('2025-01-01'), new Date('2025-12-31'));
      const discount3 = new Discount('disc3', 'percentage', 15, 2, new Date('2025-01-01'), new Date('2025-12-31'));

      // discount1: 100 * (1 - 0.10) = 90 (saves 10)
      // discount2: 100 - 25 = 75 (saves 25)
      // discount3: 100 * (1 - 0.15) = 85 (saves 15)
      // discount2 saves the most, so should be selected

      const result = service.selectBestDiscount([discount1, discount2, discount3], 100);
      expect(result).toEqual(discount2);
    });

    it('should handle mixed discount types correctly', () => {
      const percentageDiscount = new Discount('disc1', 'percentage', 30, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const fixedDiscount = new Discount('disc2', 'fixed', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      // percentageDiscount: 100 * (1 - 0.30) = 70 (saves 30)
      // fixedDiscount: 100 - 20 = 80 (saves 20)
      // percentageDiscount saves more, so should be selected

      const result = service.selectBestDiscount([percentageDiscount, fixedDiscount], 100);
      expect(result).toEqual(percentageDiscount);
    });

    it('should prioritize higher priority over higher discount amount', () => {
      const highPriorityLowDiscount = new Discount('disc1', 'percentage', 5, 3, new Date('2025-01-01'), new Date('2025-12-31'));
      const lowPriorityHighDiscount = new Discount('disc2', 'percentage', 50, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      // Even though lowPriorityHighDiscount saves more (50 vs 5), highPriorityLowDiscount should be selected due to higher priority

      const result = service.selectBestDiscount([highPriorityLowDiscount, lowPriorityHighDiscount], 100);
      expect(result).toEqual(highPriorityLowDiscount);
    });

    it('should handle zero discount correctly', () => {
      const zeroDiscount = new Discount('disc1', 'percentage', 0, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const normalDiscount = new Discount('disc2', 'percentage', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      const result = service.selectBestDiscount([zeroDiscount, normalDiscount], 100);
      expect(result).toEqual(normalDiscount);
    });

    it('should handle discounts that result in same final price', () => {
      const discount1 = new Discount('disc1', 'fixed', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const discount2 = new Discount('disc2', 'percentage', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      // Both result in final price of 90, should return the first one in the array (stable sort)
      const result = service.selectBestDiscount([discount1, discount2], 100);
      expect(result).toEqual(discount1);
    });

    it('should handle large discount values correctly', () => {
      const fullDiscount = new Discount('disc1', 'percentage', 100, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const largeFixedDiscount = new Discount('disc2', 'fixed', 1000, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      // Both should result in price 0, should return the first one
      const result = service.selectBestDiscount([fullDiscount, largeFixedDiscount], 100);
      expect(result).toEqual(fullDiscount);
    });

    it('should handle negative discount values gracefully', () => {
      const negativeDiscount = new Discount('disc1', 'percentage', -10, 1, new Date('2025-01-01'), new Date('2025-12-31'));
      const normalDiscount = new Discount('disc2', 'percentage', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'));

      // Negative discount would increase price, should select normal discount
      const result = service.selectBestDiscount([negativeDiscount, normalDiscount], 100);
      expect(result).toEqual(normalDiscount);
    });

    it('should filter discounts by product applicability when productId is provided', () => {
      const applicableDiscount = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const nonApplicableDiscount = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.selectBestDiscount([applicableDiscount, nonApplicableDiscount], 100, 'prod1');
      expect(result).toEqual(applicableDiscount);
    });

    it('should return null when no discounts are applicable to the product', () => {
      const discount1 = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const discount2 = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.selectBestDiscount([discount1, discount2], 100, 'prod3');
      expect(result).toBeNull();
    });

    it('should ignore product filtering when no productId is provided', () => {
      const discount1 = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const discount2 = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.selectBestDiscount([discount1, discount2], 100);
      expect(result).toEqual(discount2); // Should select highest priority regardless of product applicability
    });
  });

  describe('filterApplicableDiscounts', () => {
    it('should return empty array when no discounts are provided', () => {
      const result = service.filterApplicableDiscounts([], 'prod1');
      expect(result).toEqual([]);
    });

    it('should return empty array when empty discounts array is provided', () => {
      const result = service.filterApplicableDiscounts([], 'prod1');
      expect(result).toEqual([]);
    });

    it('should filter discounts that are applicable to the product', () => {
      const applicableDiscount = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const nonApplicableDiscount = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.filterApplicableDiscounts([applicableDiscount, nonApplicableDiscount], 'prod1');
      expect(result).toEqual([applicableDiscount]);
    });

    it('should return all applicable discounts for a product', () => {
      const discount1 = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const discount2 = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1', 'prod2']);
      const discount3 = new Discount('disc3', 'percentage', 10, 3, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.filterApplicableDiscounts([discount1, discount2, discount3], 'prod1');
      expect(result).toEqual([discount1, discount2]);
    });

    it('should exclude expired discounts', () => {
      const expiredDiscount = new Discount('disc1', 'percentage', 20, 1, new Date('2020-01-01'), new Date('2020-12-31'), ['prod1']);
      const validDiscount = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);

      const result = service.filterApplicableDiscounts([expiredDiscount, validDiscount], 'prod1');
      expect(result).toEqual([validDiscount]);
    });

    it('should exclude discounts not yet active', () => {
      const futureDiscount = new Discount('disc1', 'percentage', 20, 1, new Date('2030-01-01'), new Date('2030-12-31'), ['prod1']);
      const validDiscount = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);

      const result = service.filterApplicableDiscounts([futureDiscount, validDiscount], 'prod1');
      expect(result).toEqual([validDiscount]);
    });
  });

  describe('getApplicableDiscounts', () => {
    it('should return empty array when no discounts are provided', () => {
      const result = service.getApplicableDiscounts([], 'prod1', 100);
      expect(result).toEqual([]);
    });

    it('should return applicable discounts sorted by priority and savings', () => {
      const discount1 = new Discount('disc1', 'percentage', 10, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 10
      const discount2 = new Discount('disc2', 'percentage', 20, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 20
      const discount3 = new Discount('disc3', 'fixed', 15, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 15

      const result = service.getApplicableDiscounts([discount1, discount2, discount3], 'prod1', 100);

      // Should be sorted: discount2 (priority 2, saves 20), discount3 (priority 2, saves 15), discount1 (priority 1, saves 10)
      expect(result).toEqual([discount2, discount3, discount1]);
    });

    it('should filter out non-applicable discounts', () => {
      const applicableDiscount = new Discount('disc1', 'percentage', 20, 1, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']);
      const nonApplicableDiscount = new Discount('disc2', 'percentage', 30, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod2']);

      const result = service.getApplicableDiscounts([applicableDiscount, nonApplicableDiscount], 'prod1', 100);
      expect(result).toEqual([applicableDiscount]);
    });

    it('should handle discounts with same priority by sorting by savings descending', () => {
      const discount1 = new Discount('disc1', 'percentage', 10, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 10
      const discount2 = new Discount('disc2', 'percentage', 15, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 15
      const discount3 = new Discount('disc3', 'fixed', 12, 2, new Date('2025-01-01'), new Date('2025-12-31'), ['prod1']); // saves 12

      const result = service.getApplicableDiscounts([discount1, discount2, discount3], 'prod1', 100);

      // All priority 2: discount2 (saves 15), discount3 (saves 12), discount1 (saves 10)
      expect(result).toEqual([discount2, discount3, discount1]);
    });
  });
});