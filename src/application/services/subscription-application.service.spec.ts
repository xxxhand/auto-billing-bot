import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionApplicationService } from './subscription-application.service';
import { SubscriptionService } from '../../domain/services/subscription.service';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { ProductRepository } from '../../infra/repositories/product.repository';
import { OperationLogRepository } from '../../infra/repositories/operation-log.repository';
import { Subscription } from '../../domain/entities/subscription.entity';
import { Product } from '../../domain/entities/product.entity';
import { OperationLog } from '../../domain/entities/operation-log.entity';

describe('SubscriptionApplicationService', () => {
  let service: SubscriptionApplicationService;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let operationLogRepository: jest.Mocked<OperationLogRepository>;

  beforeEach(async () => {
    const mockSubscriptionService = {
      createSubscription: jest.fn(),
      getAvailableProducts: jest.fn(),
    };

    const mockSubscriptionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
    };

    const mockProductRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const mockOperationLogRepository = {
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionApplicationService,
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: SubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        {
          provide: ProductRepository,
          useValue: mockProductRepository,
        },
        {
          provide: OperationLogRepository,
          useValue: mockOperationLogRepository,
        },
      ],
    }).compile();

    service = module.get<SubscriptionApplicationService>(SubscriptionApplicationService);
    subscriptionService = module.get(SubscriptionService);
    subscriptionRepository = module.get(SubscriptionRepository);
    productRepository = module.get(ProductRepository);
    operationLogRepository = module.get(OperationLogRepository);
  });

  describe('createSubscription', () => {
    it('應該成功創建訂閱', async () => {
      const mockProduct = new Product();
      mockProduct.id = 'prod-123';
      mockProduct.cycleType = 'monthly';

      const mockSubscription = new Subscription();
      mockSubscription.id = 'sub-123';

      productRepository.findById.mockResolvedValue(mockProduct);
      subscriptionService.createSubscription.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription('user-123', 'prod-123', '2025-01-15T10:00:00.000Z');

      expect(result).toBe(mockSubscription);
      expect(productRepository.findById).toHaveBeenCalledWith('prod-123');
      expect(subscriptionService.createSubscription).toHaveBeenCalledWith('user-123', 'prod-123', '2025-01-15T10:00:00.000Z', 'monthly');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(mockSubscription);
    });

    it('產品不存在時應該拋出錯誤', async () => {
      productRepository.findById.mockResolvedValue(null);

      await expect(service.createSubscription('user-123', 'prod-999', '2025-01-15T10:00:00.000Z')).rejects.toThrow('產品不存在');
    });

    it('儲存訂閱失敗時應該拋出錯誤', async () => {
      const mockProduct = new Product();
      mockProduct.id = 'prod-123';
      mockProduct.cycleType = 'monthly';

      const mockSubscription = new Subscription();

      productRepository.findById.mockResolvedValue(mockProduct);
      subscriptionService.createSubscription.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue(null);

      await expect(service.createSubscription('user-123', 'prod-123', '2025-01-15T10:00:00.000Z')).rejects.toThrow('儲存訂閱失敗');
    });
  });

  describe('getAvailableProducts', () => {
    it('應該返回使用者可用的產品列表', async () => {
      const mockProducts = [new Product(), new Product()];
      const mockSubscriptions = [new Subscription()];
      const mockAvailableProducts = [new Product()];

      productRepository.findAll.mockResolvedValue(mockProducts);
      subscriptionRepository.findByUserId.mockResolvedValue(mockSubscriptions);
      subscriptionService.getAvailableProducts.mockResolvedValue(mockAvailableProducts);

      const result = await service.getAvailableProducts('user-123');

      expect(result).toBe(mockAvailableProducts);
      expect(productRepository.findAll).toHaveBeenCalled();
      expect(subscriptionRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(subscriptionService.getAvailableProducts).toHaveBeenCalledWith(mockProducts, mockSubscriptions);
    });
  });

  describe('cancelSubscription', () => {
    it('應該成功取消訂閱並記錄操作日誌', async () => {
      const mockSubscription = new Subscription();
      mockSubscription.id = 'sub-123';
      mockSubscription.status = 'active';

      subscriptionRepository.findById.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue(mockSubscription);
      operationLogRepository.save.mockResolvedValue(new OperationLog());

      await service.cancelSubscription('sub-123', 'operator-123');

      expect(subscriptionRepository.findById).toHaveBeenCalledWith('sub-123');
      expect(mockSubscription.status).toBe('cancelled');
      expect(subscriptionRepository.save).toHaveBeenCalledWith(mockSubscription);
      expect(operationLogRepository.save).toHaveBeenCalled();
    });

    it('訂閱不存在時應該拋出錯誤', async () => {
      subscriptionRepository.findById.mockResolvedValue(null);

      await expect(service.cancelSubscription('sub-999', 'operator-123')).rejects.toThrow('訂閱不存在');
    });
  });
});
