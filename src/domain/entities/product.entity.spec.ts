import { ProductEntity } from './product.entity';

describe('ProductEntity', () => {
  describe('constructor', () => {
    it('should create a product entity with default values', () => {
      const product = new ProductEntity();

      expect(product.productId).toBe('');
      expect(product.name).toBe('');
      expect(product.price).toBe(0);
      expect(product.cycleType).toBe('monthly');
      expect(product.cycleValue).toBeUndefined();
      expect(product.gracePeriodDays).toBe(7);
    });

    it('should allow setting product properties', () => {
      const product = new ProductEntity();
      product.productId = 'prod-123';
      product.name = 'Premium Plan';
      product.price = 99.99;
      product.cycleType = 'yearly';
      product.cycleValue = null;
      product.gracePeriodDays = 14;

      expect(product.productId).toBe('prod-123');
      expect(product.name).toBe('Premium Plan');
      expect(product.price).toBe(99.99);
      expect(product.cycleType).toBe('yearly');
      expect(product.cycleValue).toBeNull();
      expect(product.gracePeriodDays).toBe(14);
    });
  });
});
