import { PromoCodeDomainService } from './promo-code-domain.service';
import { PromoCode } from '../entities/promoCode.entity';

describe('PromoCodeDomainService', () => {
  let service: PromoCodeDomainService;

  beforeEach(() => {
    service = new PromoCodeDomainService();
  });

  describe('validatePromoCodeUsage', () => {
    it('should validate successfully for single-use promo code when user has not used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, true, 0, 100);
      const userId = 'user_123';
      const orderAmount = 150;
      const userUsageHistory: string[] = []; // User has not used this promo code

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject single-use promo code when user has already used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, true, 0, 100);
      const userId = 'user_123';
      const orderAmount = 150;
      const userUsageHistory: string[] = ['SAVE10']; // User has already used this promo code

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code has already been used by this user');
    });

    it('should validate successfully for shared promo code when user has not used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 100, false, 5, 100); // Shared promo code
      const userId = 'user_123';
      const orderAmount = 150;
      const userUsageHistory: string[] = []; // User has not used this promo code

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject shared promo code when user has already used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 100, false, 5, 100); // Shared promo code
      const userId = 'user_123';
      const orderAmount = 150;
      const userUsageHistory: string[] = ['SAVE10']; // User has already used this promo code

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code has already been used by this user');
    });

    it('should reject when order amount is below minimum threshold', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 100);
      const userId = 'user_123';
      const orderAmount = 50; // Below minimum 100
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Order amount must be at least 100 to use this promo code');
    });

    it('should validate successfully when order amount meets minimum threshold', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 100);
      const userId = 'user_123';
      const orderAmount = 100; // Exactly minimum
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should validate successfully when promo code has no minimum amount', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 0); // No minimum
      const userId = 'user_123';
      const orderAmount = 10; // Any amount
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject when promo code cannot be used (exhausted)', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 5, false, 5, 100); // Usage limit reached
      const userId = 'user_123';
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code is no longer available');
    });

    it('should validate successfully for assigned promo code when used by the assigned user', () => {
      // Arrange
      const promoCode = new PromoCode('EXCLUSIVE10', 'disc_123', null, true, 0, 100, 'user_123'); // Assigned to user_123
      const userId = 'user_123'; // Correct assigned user
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject assigned promo code when used by a different user', () => {
      // Arrange
      const promoCode = new PromoCode('EXCLUSIVE10', 'disc_123', null, true, 0, 100, 'user_123'); // Assigned to user_123
      const userId = 'user_456'; // Different user
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code is not available for your account');
    });

    it('should validate successfully for non-assigned promo code used by any user', () => {
      // Arrange
      const promoCode = new PromoCode('SHARED10', 'disc_123', 100, false, 5, 100); // Not assigned to any user
      const userId = 'user_456'; // Any user
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject assigned promo code when used by a different user', () => {
      // Arrange
      const promoCode = new PromoCode('EXCLUSIVE10', 'disc_123', null, true, 0, 100, 'user_123'); // Assigned to user_123
      const userId = 'user_456'; // Different user
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code is not available for your account');
    });

    it('should validate successfully for non-assigned promo code used by any user', () => {
      // Arrange
      const promoCode = new PromoCode('SHARED10', 'disc_123', 100, false, 5, 100); // Not assigned to any user
      const userId = 'user_456'; // Any user
      const orderAmount = 150;
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, undefined, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should validate successfully when promo code is applicable to product', () => {
      // Arrange
      const promoCode = new PromoCode('PRODUCT10', 'disc_123', null, false, 0, 100, undefined, ['prod_123', 'prod_456']);
      const userId = 'user_123';
      const orderAmount = 150;
      const productId = 'prod_123'; // Product in applicable list
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, productId, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject when promo code is not applicable to product', () => {
      // Arrange
      const promoCode = new PromoCode('PRODUCT10', 'disc_123', null, false, 0, 100, undefined, ['prod_123', 'prod_456']);
      const userId = 'user_123';
      const orderAmount = 150;
      const productId = 'prod_789'; // Product not in applicable list
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, productId, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('This promo code is not applicable to the selected product');
    });

    it('should validate successfully for global promo code (empty applicableProducts)', () => {
      // Arrange
      const promoCode = new PromoCode('GLOBAL10', 'disc_123', null, false, 0, 100, undefined, []); // Empty applicableProducts = global
      const userId = 'user_123';
      const orderAmount = 150;
      const productId = 'prod_789'; // Any product
      const userUsageHistory: string[] = [];

      // Act
      const result = service.validatePromoCodeUsage(promoCode, userId, orderAmount, productId, userUsageHistory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('canUserUsePromoCode', () => {
    it('should return true for single-use promo code when user has not used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, true, 0, 100);
      const userUsageHistory: string[] = [];

      // Act
      const result = service.canUserUsePromoCode(promoCode, userUsageHistory);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for single-use promo code when user has used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, true, 0, 100);
      const userUsageHistory: string[] = ['SAVE10'];

      // Act
      const result = service.canUserUsePromoCode(promoCode, userUsageHistory);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for shared promo code when user has not used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 100, false, 5, 100);
      const userUsageHistory: string[] = [];

      // Act
      const result = service.canUserUsePromoCode(promoCode, userUsageHistory);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for shared promo code when user has used it', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 100, false, 5, 100);
      const userUsageHistory: string[] = ['SAVE10'];

      // Act
      const result = service.canUserUsePromoCode(promoCode, userUsageHistory);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when promo code is exhausted', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', 5, false, 5, 100); // Exhausted
      const userUsageHistory: string[] = [];

      // Act
      const result = service.canUserUsePromoCode(promoCode, userUsageHistory);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isOrderAmountValid', () => {
    it('should return true when order amount meets minimum requirement', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 100);
      const orderAmount = 150;

      // Act
      const result = service.isOrderAmountValid(promoCode, orderAmount);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when order amount is below minimum requirement', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 100);
      const orderAmount = 50;

      // Act
      const result = service.isOrderAmountValid(promoCode, orderAmount);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when promo code has no minimum amount', () => {
      // Arrange
      const promoCode = new PromoCode('SAVE10', 'disc_123', null, false, 0, 0);
      const orderAmount = 10;

      // Act
      const result = service.isOrderAmountValid(promoCode, orderAmount);

      // Assert
      expect(result).toBe(true);
    });
  });
});
