import { Config } from './config.entity';

describe('Config Entity', () => {
  describe('constructor', () => {
    it('should create a global config with default values', () => {
      // Arrange & Act
      const config = new Config('config_123', 'global');

      // Assert
      expect(config.configId).toBe('config_123');
      expect(config.type).toBe('global');
      expect(config.productId).toBeNull();
      expect(config.gracePeriodDays).toBe(7); // default value
      expect(config.refundPolicy).toEqual({});
    });

    it('should create a global config with custom values', () => {
      // Arrange
      const refundPolicy = { allowFullRefund: true, maxDays: 30 };

      // Act
      const config = new Config('config_123', 'global', null, 14, refundPolicy);

      // Assert
      expect(config.configId).toBe('config_123');
      expect(config.type).toBe('global');
      expect(config.productId).toBeNull();
      expect(config.gracePeriodDays).toBe(14);
      expect(config.refundPolicy).toEqual(refundPolicy);
    });

    it('should create a product config with required productId', () => {
      // Arrange & Act
      const config = new Config('config_123', 'product', 'prod_456');

      // Assert
      expect(config.configId).toBe('config_123');
      expect(config.type).toBe('product');
      expect(config.productId).toBe('prod_456');
      expect(config.gracePeriodDays).toBe(7); // default value
      expect(config.refundPolicy).toEqual({});
    });

    it('should throw error when creating product config without productId', () => {
      // Act & Assert
      expect(() => {
        new Config('config_123', 'product');
      }).toThrow('Product config must have a productId');
    });

    it('should throw error when creating product config with null productId', () => {
      // Act & Assert
      expect(() => {
        new Config('config_123', 'product', null);
      }).toThrow('Product config must have a productId');
    });

    it('should throw error for invalid config type', () => {
      // Act & Assert
      expect(() => {
        new Config('config_123', 'invalid' as any);
      }).toThrow('Invalid config type: invalid');
    });
  });

  describe('isGlobal', () => {
    it('should return true for global config', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act
      const result = config.isGlobal();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for product config', () => {
      // Arrange
      const config = new Config('config_123', 'product', 'prod_456');

      // Act
      const result = config.isGlobal();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isProductSpecific', () => {
    it('should return false for global config', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act
      const result = config.isProductSpecific();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for product config', () => {
      // Arrange
      const config = new Config('config_123', 'product', 'prod_456');

      // Act
      const result = config.isProductSpecific();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getGracePeriodDays', () => {
    it('should return configured grace period days', () => {
      // Arrange
      const config = new Config('config_123', 'global', null, 14);

      // Act
      const result = config.getGracePeriodDays();

      // Assert
      expect(result).toBe(14);
    });

    it('should return default grace period days when not configured', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act
      const result = config.getGracePeriodDays();

      // Assert
      expect(result).toBe(7);
    });
  });

  describe('updateGracePeriodDays', () => {
    it('should update grace period days', () => {
      // Arrange
      const config = new Config('config_123', 'global', null, 7);

      // Act
      config.updateGracePeriodDays(14);

      // Assert
      expect(config.gracePeriodDays).toBe(14);
    });

    it('should throw error for invalid grace period days', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act & Assert
      expect(() => {
        config.updateGracePeriodDays(-1);
      }).toThrow('Grace period days must be positive');

      expect(() => {
        config.updateGracePeriodDays(0);
      }).toThrow('Grace period days must be positive');
    });
  });

  describe('updateRefundPolicy', () => {
    it('should update refund policy', () => {
      // Arrange
      const config = new Config('config_123', 'global');
      const newRefundPolicy = { allowFullRefund: false, maxDays: 15 };

      // Act
      config.updateRefundPolicy(newRefundPolicy);

      // Assert
      expect(config.refundPolicy).toEqual(newRefundPolicy);
    });

    it('should allow empty refund policy', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act
      config.updateRefundPolicy({});

      // Assert
      expect(config.refundPolicy).toEqual({});
    });
  });

  describe('appliesToProduct', () => {
    it('should return true for global config regardless of productId', () => {
      // Arrange
      const config = new Config('config_123', 'global');

      // Act & Assert
      expect(config.appliesToProduct('prod_123')).toBe(true);
      expect(config.appliesToProduct('prod_456')).toBe(true);
    });

    it('should return true for product config when productId matches', () => {
      // Arrange
      const config = new Config('config_123', 'product', 'prod_456');

      // Act & Assert
      expect(config.appliesToProduct('prod_456')).toBe(true);
    });

    it('should return false for product config when productId does not match', () => {
      // Arrange
      const config = new Config('config_123', 'product', 'prod_456');

      // Act & Assert
      expect(config.appliesToProduct('prod_123')).toBe(false);
      expect(config.appliesToProduct('prod_789')).toBe(false);
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return global config values when no product config exists', () => {
      // Arrange
      const globalConfig = new Config('global_config', 'global', null, 10, { allowRefund: true });

      // Act
      const result = Config.getEffectiveConfig([globalConfig], 'prod_123');

      // Assert
      expect(result.gracePeriodDays).toBe(10);
      expect(result.refundPolicy).toEqual({ allowRefund: true });
    });

    it('should prioritize product-specific config over global config', () => {
      // Arrange
      const globalConfig = new Config('global_config', 'global', null, 7, { allowRefund: true });
      const productConfig = new Config('product_config', 'product', 'prod_123', 14, { allowRefund: false });

      // Act
      const result = Config.getEffectiveConfig([globalConfig, productConfig], 'prod_123');

      // Assert
      expect(result.gracePeriodDays).toBe(14);
      expect(result.refundPolicy).toEqual({ allowRefund: false });
    });

    it('should fall back to global config when product config exists but for different product', () => {
      // Arrange
      const globalConfig = new Config('global_config', 'global', null, 7, { allowRefund: true });
      const otherProductConfig = new Config('product_config', 'product', 'prod_456', 14, { allowRefund: false });

      // Act
      const result = Config.getEffectiveConfig([globalConfig, otherProductConfig], 'prod_123');

      // Assert
      expect(result.gracePeriodDays).toBe(7);
      expect(result.refundPolicy).toEqual({ allowRefund: true });
    });

    it('should return default values when no configs exist', () => {
      // Act
      const result = Config.getEffectiveConfig([], 'prod_123');

      // Assert
      expect(result.gracePeriodDays).toBe(7);
      expect(result.refundPolicy).toEqual({});
    });
  });
});