import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PaymentResult } from '../value-objects/payment-result.value-object';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('processPayment', () => {
    it('應該返回成功結果（模擬80%成功率）', async () => {
      // Mock Math.random to return 0.5 (success)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      const result = await service.processPayment('sub-123', 100);

      expect(result.isSuccess()).toBe(true);
      expect(result.failureReason).toBeUndefined();

      // Restore original Math.random
      Math.random = originalRandom;
    });

    it('應該返回失敗結果（模擬20%失敗率）', async () => {
      // Mock Math.random to return 0.9 (failure)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9);

      const result = await service.processPayment('sub-123', 100);

      expect(result.isSuccess()).toBe(false);
      expect(result.failureReason).toBeDefined();
      expect(['insufficient_funds', 'card_declined', 'network_error', 'card_expired']).toContain(result.failureReason);

      // Restore original Math.random
      Math.random = originalRandom;
    });

    it('應該處理支付延遲', async () => {
      const startTime = Date.now();

      // Mock Math.random to return 0.5 (success)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      await service.processPayment('sub-123', 100);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 應該至少有100ms延遲
      expect(duration).toBeGreaterThanOrEqual(90);

      // Restore original Math.random
      Math.random = originalRandom;
    });

    it('應該正確處理subscriptionId和amount參數', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      const result = await service.processPayment('test-subscription-id', 299.99);

      expect(result.isSuccess()).toBe(true);
      expect(result.failureReason).toBeUndefined();

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });
});
