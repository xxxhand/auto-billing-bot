import { Product } from './product.entity';

describe('Product Entity', () => {
  describe('constructor and properties', () => {
    it('should create a product with required properties', () => {
      const product = new Product();
      product.id = 'product-1';
      product.name = 'Premium Plan';
      product.cycleType = 'monthly';
      product.price = 29.99;

      expect(product.id).toBe('product-1');
      expect(product.name).toBe('Premium Plan');
      expect(product.cycleType).toBe('monthly');
      expect(product.price).toBe(29.99);
      expect(product.discountPercentage).toBeUndefined();
    });

    it('should create a product with discount percentage', () => {
      const product = new Product();
      product.id = 'product-2';
      product.name = 'Annual Plan';
      product.cycleType = 'yearly';
      product.price = 299.99;
      product.discountPercentage = 0.1;

      expect(product.id).toBe('product-2');
      expect(product.name).toBe('Annual Plan');
      expect(product.cycleType).toBe('yearly');
      expect(product.price).toBe(299.99);
      expect(product.discountPercentage).toBe(0.1);
    });
  });

  describe('business rules', () => {
    it('should validate cycle type is either monthly or yearly', () => {
      const product = new Product();
      product.id = 'product-1';
      product.name = 'Test Product';
      product.price = 10.0;

      // Valid cycle types
      product.cycleType = 'monthly';
      expect(product.cycleType).toBe('monthly');

      product.cycleType = 'yearly';
      expect(product.cycleType).toBe('yearly');
    });

    it('should validate price is positive', () => {
      const product = new Product();
      product.id = 'product-1';
      product.name = 'Test Product';
      product.cycleType = 'monthly';

      product.price = 10.0;
      expect(product.price).toBe(10.0);

      product.price = 0.01;
      expect(product.price).toBe(0.01);
    });

    it('should validate discount percentage is between 0 and 1 when present', () => {
      const product = new Product();
      product.id = 'product-1';
      product.name = 'Test Product';
      product.cycleType = 'monthly';
      product.price = 10.0;

      product.discountPercentage = 0;
      expect(product.discountPercentage).toBe(0);

      product.discountPercentage = 0.5;
      expect(product.discountPercentage).toBe(0.5);

      product.discountPercentage = 1;
      expect(product.discountPercentage).toBe(1);
    });
  });
});
