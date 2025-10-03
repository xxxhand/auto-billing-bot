import { Discount } from './discount.entity';

describe('Discount Entity', () => {
  describe('isApplicable', () => {
    it('should return true when current date is within validity period', () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );
      const now = new Date('2024-06-15');

      // Act
      const result = discount.isApplicable(now);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when current date is before start date', () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );
      const now = new Date('2023-12-31');

      // Act
      const result = discount.isApplicable(now);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when current date is after end date', () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );
      const now = new Date('2025-01-01');

      // Act
      const result = discount.isApplicable(now);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when current date equals start date', () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );
      const now = new Date('2024-01-01');

      // Act
      const result = discount.isApplicable(now);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when current date equals end date', () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );
      const now = new Date('2024-12-31');

      // Act
      const result = discount.isApplicable(now);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('calculateDiscountedPrice', () => {
    it('should calculate percentage discount correctly', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'percentage',
        20, // 20% off
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      const originalPrice = 100;

      // Act
      const result = discount.calculateDiscountedPrice(originalPrice);

      // Assert
      expect(result).toBe(80); // 100 * (1 - 0.20) = 80
    });

    it('should calculate fixed discount correctly', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'fixed',
        30, // $30 off
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      const originalPrice = 100;

      // Act
      const result = discount.calculateDiscountedPrice(originalPrice);

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
        new Date('2024-12-31')
      );
      const originalPrice = 100;

      // Act
      const result = discount.calculateDiscountedPrice(originalPrice);

      // Assert
      expect(result).toBe(0); // Math.max(0, 100 - 150) = 0
    });

    it('should return original price for unknown discount type', () => {
      // Arrange
      const discount = new Discount(
        'disc_123',
        'unknown' as any, // Force unknown type
        10,
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      const originalPrice = 100;

      // Act
      const result = discount.calculateDiscountedPrice(originalPrice);

      // Assert
      expect(result).toBe(100); // Should return original price
    });
  });

  describe('constructor', () => {
    it('should create discount with correct properties', () => {
      // Arrange & Act
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const discount = new Discount(
        'disc_123',
        'percentage',
        10,
        1,
        startDate,
        endDate
      );

      // Assert
      expect(discount.discountId).toBe('disc_123');
      expect(discount.type).toBe('percentage');
      expect(discount.value).toBe(10);
      expect(discount.priority).toBe(1);
      expect(discount.startDate).toBe(startDate);
      expect(discount.endDate).toBe(endDate);
      expect(discount.id).toBe('disc_123'); // BaseEntity id should be set to discountId
    });
  });
});