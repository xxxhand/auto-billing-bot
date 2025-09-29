import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { Product } from '../../domain/entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<ProductRepository>;

  beforeEach(async () => {
    const mockProductRepository = {
      save: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: ProductRepository,
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get(ProductRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Premium Plan',
        cycleType: 'monthly' as const,
        price: 29.99,
        discountPercentage: 10,
      };

      const expectedProduct = new Product();
      Object.assign(expectedProduct, productData);
      expectedProduct.id = 'mock-id';

      productRepository.save.mockResolvedValue(expectedProduct);

      const result = await service.createProduct(productData);

      expect(productRepository.save).toHaveBeenCalledWith(expect.objectContaining(productData));
      expect(result).toEqual(expectedProduct);
    });
  });

  describe('getAllProducts', () => {
    it('should return all products', async () => {
      const products = [
        Object.assign(new Product(), {
          id: '1',
          name: 'Basic Plan',
          cycleType: 'monthly' as const,
          price: 9.99,
        }),
        Object.assign(new Product(), {
          id: '2',
          name: 'Premium Plan',
          cycleType: 'yearly' as const,
          price: 99.99,
        }),
      ];

      productRepository.findAll.mockResolvedValue(products);

      const result = await service.getAllProducts();

      expect(productRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(products);
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      const product = Object.assign(new Product(), {
        id: '1',
        name: 'Basic Plan',
        cycleType: 'monthly' as const,
        price: 9.99,
      });

      productRepository.findById.mockResolvedValue(product);

      const result = await service.getProductById('1');

      expect(productRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(product);
    });

    it('should return undefined if product not found', async () => {
      productRepository.findById.mockResolvedValue(undefined);

      const result = await service.getProductById('non-existent');

      expect(productRepository.findById).toHaveBeenCalledWith('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateProduct', () => {
    it('should update an existing product', async () => {
      const existingProduct = Object.assign(new Product(), {
        id: '1',
        name: 'Basic Plan',
        cycleType: 'monthly' as const,
        price: 9.99,
      });

      const updateData = {
        name: 'Updated Basic Plan',
        price: 14.99,
      };

      const updatedProduct = Object.assign(new Product(), {
        ...existingProduct,
        ...updateData,
      });

      productRepository.findById.mockResolvedValue(existingProduct);
      productRepository.save.mockResolvedValue(updatedProduct);

      const result = await service.updateProduct('1', updateData);

      expect(productRepository.findById).toHaveBeenCalledWith('1');
      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'Updated Basic Plan',
          price: 14.99,
          cycleType: 'monthly',
        }),
      );
      expect(result).toEqual(updatedProduct);
    });

    it('should return undefined if product not found', async () => {
      productRepository.findById.mockResolvedValue(undefined);

      const result = await service.updateProduct('non-existent', { name: 'Test' });

      expect(result).toBeUndefined();
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product by setting deletedAt', async () => {
      const product = Object.assign(new Product(), {
        id: '1',
        name: 'Basic Plan',
        cycleType: 'monthly' as const,
        price: 9.99,
      });

      productRepository.findById.mockResolvedValue(product);
      productRepository.save.mockResolvedValue(product);

      const result = await service.deleteProduct('1');

      expect(productRepository.findById).toHaveBeenCalledWith('1');
      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          deletedAt: expect.any(Date),
        }),
      );
      expect(result).toBe(true);
    });

    it('should return false if product not found', async () => {
      productRepository.findById.mockResolvedValue(undefined);

      const result = await service.deleteProduct('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('calculateDiscountedPrice', () => {
    it('should calculate discounted price when discount percentage is provided', () => {
      const product = Object.assign(new Product(), {
        id: '1',
        name: 'Premium Plan',
        cycleType: 'monthly' as const,
        price: 100,
        discountPercentage: 20,
      });

      const result = service.calculateDiscountedPrice(product);

      expect(result).toBe(80);
    });

    it('should return original price when no discount', () => {
      const product = Object.assign(new Product(), {
        id: '1',
        name: 'Basic Plan',
        cycleType: 'monthly' as const,
        price: 50,
      });

      const result = service.calculateDiscountedPrice(product);

      expect(result).toBe(50);
    });
  });
});
