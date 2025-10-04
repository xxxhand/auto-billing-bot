import { PromoCode } from './promo-code.value-object';

describe('PromoCode Value Object', () => {
  describe('constructor', () => {
    it('should create promo code with required fields', () => {
      // Arrange & Act
      const promoCode = new PromoCode('SAVE10', 'discount_123');

      // Assert
      expect(promoCode.code).toBe('SAVE10');
      expect(promoCode.discountId).toBe('discount_123');
      expect(promoCode.usageLimit).toBeNull();
      expect(promoCode.isSingleUse).toBe(false);
      expect(promoCode.usedCount).toBe(0);
    });

    it('should create promo code with all fields', () => {
      // Arrange & Act
      const promoCode = new PromoCode('VIP20', 'discount_456', 100, true, 5);

      // Assert
      expect(promoCode.code).toBe('VIP20');
      expect(promoCode.discountId).toBe('discount_456');
      expect(promoCode.usageLimit).toBe(100);
      expect(promoCode.isSingleUse).toBe(true);
      expect(promoCode.usedCount).toBe(5);
    });

    it('should trim whitespace from code and discountId', () => {
      // Arrange & Act
      const promoCode = new PromoCode('  SAVE10  ', '  discount_123  ');

      // Assert
      expect(promoCode.code).toBe('SAVE10');
      expect(promoCode.discountId).toBe('discount_123');
    });

    it('should throw error for empty code', () => {
      // Arrange & Act & Assert
      expect(() => new PromoCode('', 'discount_123')).toThrow('Promo code cannot be empty');
      expect(() => new PromoCode('   ', 'discount_123')).toThrow('Promo code cannot be empty');
    });

    it('should throw error for empty discountId', () => {
      // Arrange & Act & Assert
      expect(() => new PromoCode('SAVE10', '')).toThrow('Discount ID cannot be empty');
      expect(() => new PromoCode('SAVE10', '   ')).toThrow('Discount ID cannot be empty');
    });

    it('should throw error for negative usedCount', () => {
      // Arrange & Act & Assert
      expect(() => new PromoCode('SAVE10', 'discount_123', null, false, -1)).toThrow('Used count cannot be negative');
    });

    it('should throw error for negative minimumAmount', () => {
      // Arrange & Act & Assert
      expect(() => new PromoCode('SAVE10', 'discount_123', null, false, 0, -10)).toThrow('Minimum amount cannot be negative');
    });

    it('should create promo code with minimumAmount', () => {
      // Arrange & Act
      const promoCode = new PromoCode('MIN50', 'discount_456', null, false, 0, 50);

      // Assert
      expect(promoCode.minimumAmount).toBe(50);
    });

    it('should throw error for invalid usageLimit', () => {
      // Arrange & Act & Assert
      expect(() => new PromoCode('SAVE10', 'discount_123', 0)).toThrow('Usage limit must be positive when specified');
      expect(() => new PromoCode('SAVE10', 'discount_123', -5)).toThrow('Usage limit must be positive when specified');
    });
  });

  describe('canBeUsed', () => {
    it('should return true for unlimited use promo code with no usage', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'discount_123');

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for single-use promo code that has not been used', () => {
      // Arrange
      const promoCode = new PromoCode('VIP20', 'discount_456', null, true, 0);

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for single-use promo code that has been used', () => {
      // Arrange
      const promoCode = new PromoCode('VIP20', 'discount_456', null, true, 1);

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for limited-use promo code within limit', () => {
      // Arrange
      const promoCode = new PromoCode('LIMITED', 'discount_789', 10, false, 5);

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for limited-use promo code at limit', () => {
      // Arrange
      const promoCode = new PromoCode('LIMITED', 'discount_789', 10, false, 10);

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for limited-use promo code over limit', () => {
      // Arrange
      const promoCode = new PromoCode('LIMITED', 'discount_789', 10, false, 15);

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('incrementUsage', () => {
    it('should return new PromoCode with incremented usedCount', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'discount_123', null, false, 5);

      // Act
      const newPromoCode = promoCode.incrementUsage();

      // Assert
      expect(newPromoCode.code).toBe('SAVE10');
      expect(newPromoCode.discountId).toBe('discount_123');
      expect(newPromoCode.usageLimit).toBeNull();
      expect(newPromoCode.isSingleUse).toBe(false);
      expect(newPromoCode.usedCount).toBe(6);

      // Original should remain unchanged (immutable)
      expect(promoCode.usedCount).toBe(5);
    });
  });

  describe('isExhausted', () => {
    it('should return false for unlimited use promo code', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'discount_123');

      // Act
      const result = promoCode.isExhausted();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for single-use promo code not used', () => {
      // Arrange
      const promoCode = new PromoCode('VIP20', 'discount_456', null, true, 0);

      // Act
      const result = promoCode.isExhausted();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for single-use promo code that has been used', () => {
      // Arrange
      const promoCode = new PromoCode('VIP20', 'discount_456', null, true, 1);

      // Act
      const result = promoCode.isExhausted();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for limited-use promo code below limit', () => {
      // Arrange
      const promoCode = new PromoCode('LIMITED', 'discount_789', 10, false, 5);

      // Act
      const result = promoCode.isExhausted();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for limited-use promo code at limit', () => {
      // Arrange
      const promoCode = new PromoCode('LIMITED', 'discount_789', 10, false, 10);

      // Act
      const result = promoCode.isExhausted();

      // Assert
      expect(result).toBe(true);
    });
  });
});
