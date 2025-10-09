import { PromoCode } from './promoCode.entity';

describe('PromoCode Entity', () => {
  describe('canBeUsed', () => {
    it('should return true when usageLimit is null (unlimited)', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null, // unlimited
        false,
        5,
        100,
      );

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when usedCount is less than usageLimit', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        10, // limit
        false,
        5, // used
        100,
      );

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when usedCount equals usageLimit', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        10, // limit
        false,
        10, // used
        100,
      );

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when usedCount exceeds usageLimit', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        10, // limit
        false,
        15, // used
        100,
      );

      // Act
      const result = promoCode.canBeUsed();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isApplicableToProduct', () => {
    it('should return true when applicableProducts is empty (global)', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100,
        undefined,
        [], // empty array means global
      );

      // Act
      const result = promoCode.isApplicableToProduct('prod_123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when productId is in applicableProducts', () => {
      // Arrange
      const promoCode = new PromoCode('PROMO123', 'disc_123', null, false, 0, 100, undefined, ['prod_123', 'prod_456']);

      // Act
      const result = promoCode.isApplicableToProduct('prod_123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when productId is not in applicableProducts', () => {
      // Arrange
      const promoCode = new PromoCode('PROMO123', 'disc_123', null, false, 0, 100, undefined, ['prod_123', 'prod_456']);

      // Act
      const result = promoCode.isApplicableToProduct('prod_789');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('meetsMinimumAmount', () => {
    it('should return true when orderAmount meets minimumAmount', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100, // minimum amount
      );

      // Act
      const result = promoCode.meetsMinimumAmount(150);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when orderAmount equals minimumAmount', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100, // minimum amount
      );

      // Act
      const result = promoCode.meetsMinimumAmount(100);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when orderAmount is below minimumAmount', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100, // minimum amount
      );

      // Act
      const result = promoCode.meetsMinimumAmount(50);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isAssignedToUser', () => {
    it('should return true when assignedUserId is not set (global promo code)', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100,
        undefined, // no assigned user
      );

      // Act
      const result = promoCode.isAssignedToUser('user_123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when userId matches assignedUserId', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100,
        'user_123', // assigned to specific user
      );

      // Act
      const result = promoCode.isAssignedToUser('user_123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when userId does not match assignedUserId', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        0,
        100,
        'user_123', // assigned to specific user
      );

      // Act
      const result = promoCode.isAssignedToUser('user_456');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usedCount by 1', () => {
      // Arrange
      const promoCode = new PromoCode(
        'PROMO123',
        'disc_123',
        null,
        false,
        5, // initial used count
        100,
      );

      // Act
      promoCode.incrementUsage();

      // Assert
      expect(promoCode.usedCount).toBe(6);
    });
  });

  describe('constructor', () => {
    it('should create promoCode with correct properties', () => {
      // Arrange & Act
      const promoCode = new PromoCode('PROMO123', 'disc_123', 100, true, 10, 50, 'user_123', ['prod_1', 'prod_2']);

      // Assert
      expect(promoCode.code).toBe('PROMO123');
      expect(promoCode.discountId).toBe('disc_123');
      expect(promoCode.usageLimit).toBe(100);
      expect(promoCode.isSingleUse).toBe(true);
      expect(promoCode.usedCount).toBe(10);
      expect(promoCode.minimumAmount).toBe(50);
      expect(promoCode.assignedUserId).toBe('user_123');
      expect(promoCode.applicableProducts).toEqual(['prod_1', 'prod_2']);
      expect(promoCode.id).toBe('PROMO123'); // BaseEntity id should be set to code
    });

    it('should create promoCode with default applicableProducts as empty array', () => {
      // Arrange & Act
      const promoCode = new PromoCode('PROMO123', 'disc_123', null, false, 0, 100);

      // Assert
      expect(promoCode.applicableProducts).toEqual([]);
    });
  });
});
