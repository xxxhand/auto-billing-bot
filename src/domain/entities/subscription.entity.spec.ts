import { Subscription } from './subscription.entity';
import { Discount } from './discount.entity';

describe('Subscription Entity', () => {
  describe('calculateNextBillingDate', () => {
    it('should calculate next billing date for monthly cycle', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should handle month-end billing correctly for monthly cycle', () => {
      // Arrange - January 31st
      const startDate = new Date('2024-01-31');
      const nextBillingDate = new Date('2024-01-31');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert - Should be February 29th (2024 is leap year)
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(29);
    });

    it('should handle month-end billing for non-leap year', () => {
      // Arrange - January 31st in non-leap year
      const startDate = new Date('2023-01-31');
      const nextBillingDate = new Date('2023-01-31');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert - Should be February 28th (2023 is not leap year)
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(28);
    });

    it('should calculate next billing date for quarterly cycle', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'quarterly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(3); // April (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should calculate next billing date for yearly cycle', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'yearly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should calculate next billing date for weekly cycle', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'weekly', startDate, nextBillingDate);

      // Act
      const result = subscription.calculateNextBillingDate();

      // Assert
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(22);
    });

    it('should throw error for unsupported cycleType', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'unsupported', startDate, nextBillingDate);

      // Act & Assert
      expect(() => subscription.calculateNextBillingDate()).toThrow('Unsupported cycleType: unsupported');
    });

    it('should throw error for fixedDays cycleType (not yet implemented)', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'fixedDays', startDate, nextBillingDate);

      // Act & Assert
      expect(() => subscription.calculateNextBillingDate()).toThrow('fixedDays cycleType requires cycleValue from product, not yet implemented');
    });
  });

  describe('constructor', () => {
    it('should create subscription with default values', () => {
      // Arrange & Act
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Assert
      expect(subscription.subscriptionId).toBe('sub_123');
      expect(subscription.userId).toBe('user_123');
      expect(subscription.productId).toBe('prod_123');
      expect(subscription.status).toBe('pending');
      expect(subscription.cycleType).toBe('monthly');
      expect(subscription.startDate).toBe(startDate);
      expect(subscription.nextBillingDate).toBe(nextBillingDate);
      expect(subscription.renewalCount).toBe(0);
      expect(subscription.remainingDiscountPeriods).toBe(0);
      expect(subscription.id).toBe('sub_123'); // BaseEntity id should be set to subscriptionId
    });

    it('should create subscription with custom values', () => {
      // Arrange & Act
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate, 'active', 5, 3);

      // Assert
      expect(subscription.status).toBe('active');
      expect(subscription.renewalCount).toBe(5);
      expect(subscription.remainingDiscountPeriods).toBe(3);
    });
  });

  describe('applyDiscount', () => {
    let subscription: Subscription;
    let originalPrice: number;

    beforeEach(() => {
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);
      originalPrice = 100;
    });

    it('should apply percentage discount correctly', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'percentage',
        20, // 20% off
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      // Act
      const result = subscription.applyDiscount(discount, originalPrice);

      // Assert
      expect(result).toBe(80); // 100 * (1 - 0.20) = 80
    });

    it('should apply fixed discount correctly', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'fixed',
        30, // $30 off
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      // Act
      const result = subscription.applyDiscount(discount, originalPrice);

      // Assert
      expect(result).toBe(70); // 100 - 30 = 70
    });

    it('should not allow fixed discount to make price negative', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'fixed',
        150, // $150 off, more than original price
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      // Act
      const result = subscription.applyDiscount(discount, originalPrice);

      // Assert
      expect(result).toBe(0); // Math.max(0, 100 - 150) = 0
    });

    it('should update remainingDiscountPeriods when discountPeriods is provided', () => {
      // Arrange
      const discount = new Discount('disc_123', 'percentage', 10, 1, new Date('2024-01-01'), new Date('2024-12-31'));

      // Act
      subscription.applyDiscount(discount, originalPrice, 5);

      // Assert
      expect(subscription.remainingDiscountPeriods).toBe(5);
    });

    it('should not update remainingDiscountPeriods when discountPeriods is not provided', () => {
      // Arrange
      const discount = new Discount('disc_123', 'percentage', 10, 1, new Date('2024-01-01'), new Date('2024-12-31'));
      subscription.remainingDiscountPeriods = 3; // Set initial value

      // Act
      subscription.applyDiscount(discount, originalPrice);

      // Assert
      expect(subscription.remainingDiscountPeriods).toBe(3); // Should remain unchanged
    });
  });

  describe('convertToNewCycle', () => {
    it('should convert from monthly to yearly cycle and recalculate nextBillingDate', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-02-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate, 'active', 2, 5);

      // Act
      subscription.convertToNewCycle('yearly');

      // Assert
      expect(subscription.cycleType).toBe('yearly');
      expect(subscription.nextBillingDate.getFullYear()).toBe(2025); // Next year from 2024-02-15
      expect(subscription.nextBillingDate.getMonth()).toBe(1); // February
      expect(subscription.nextBillingDate.getDate()).toBe(15);
      expect(subscription.remainingDiscountPeriods).toBe(5); // Should remain unchanged
      expect(subscription.renewalCount).toBe(2); // Should remain unchanged
    });

    it('should convert from yearly to monthly cycle and recalculate nextBillingDate', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2025-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'yearly', startDate, nextBillingDate, 'active', 1, 3);

      // Act
      subscription.convertToNewCycle('monthly');

      // Assert
      expect(subscription.cycleType).toBe('monthly');
      expect(subscription.nextBillingDate.getFullYear()).toBe(2025);
      expect(subscription.nextBillingDate.getMonth()).toBe(1); // February (next month from 2025-01-15)
      expect(subscription.nextBillingDate.getDate()).toBe(15);
      expect(subscription.remainingDiscountPeriods).toBe(3); // Should remain unchanged
    });

    it('should convert from weekly to quarterly cycle and recalculate nextBillingDate', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-22');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'weekly', startDate, nextBillingDate, 'active', 0, 10);

      // Act
      subscription.convertToNewCycle('quarterly');

      // Assert
      expect(subscription.cycleType).toBe('quarterly');
      expect(subscription.nextBillingDate.getFullYear()).toBe(2024);
      expect(subscription.nextBillingDate.getMonth()).toBe(3); // April (3 months from 2024-01-22)
      expect(subscription.nextBillingDate.getDate()).toBe(22);
      expect(subscription.remainingDiscountPeriods).toBe(10); // Should remain unchanged
    });

    it('should handle month-end billing when converting cycles', () => {
      // Arrange - End of month billing
      const startDate = new Date('2024-01-31');
      const nextBillingDate = new Date('2024-02-29'); // Leap year February 29
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate, 'active', 0, 2);

      // Act - Convert to yearly
      subscription.convertToNewCycle('yearly');

      // Assert
      expect(subscription.cycleType).toBe('yearly');
      expect(subscription.nextBillingDate.getFullYear()).toBe(2025); // Next year from 2024-02-29
      expect(subscription.nextBillingDate.getMonth()).toBe(1); // February
      expect(subscription.nextBillingDate.getDate()).toBe(28); // 2025 is not leap year, so February 28
      expect(subscription.remainingDiscountPeriods).toBe(2); // Should remain unchanged
    });

    it('should throw error for unsupported newCycleType', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Act & Assert
      expect(() => subscription.convertToNewCycle('unsupported')).toThrow('Unsupported cycleType: unsupported');
    });

    it('should throw error when converting to fixedDays cycleType (not yet implemented)', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const nextBillingDate = new Date('2024-01-15');
      const subscription = new Subscription('sub_123', 'user_123', 'prod_123', 'monthly', startDate, nextBillingDate);

      // Act & Assert
      expect(() => subscription.convertToNewCycle('fixedDays')).toThrow('fixedDays cycleType requires cycleValue from product, not yet implemented');
    });
  });
});
