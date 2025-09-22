import { Test, TestingModule } from '@nestjs/testing';
import { Subscription } from './subscription.entity';
import { BillingCycleType } from '../value-objects/billing-cycle.value-object';

describe('Subscription', () => {
  let subscription: Subscription;

  beforeEach(() => {
    subscription = new Subscription();
  });

  describe('calculateNextBillingDate', () => {
    it('應該正確計算月週期的下次扣款日（正常月份）', () => {
      // 2025-01-15 開始，月週期
      subscription.startDate = '2025-01-15T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2025-02-15T10:00:00.000Z');
    });

    it('應該正確處理1/31的邊緣案例（轉到2/28，非閏年）', () => {
      // 2025-01-31 開始（非閏年），月週期
      subscription.startDate = '2025-01-31T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2025-02-28T10:00:00.000Z');
    });

    it('應該正確處理1/31的邊緣案例（轉到2/29，閏年）', () => {
      // 2024-01-31 開始（閏年），月週期
      subscription.startDate = '2024-01-31T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2024-02-29T10:00:00.000Z');
    });

    it('應該正確處理1/29的邊緣案例（轉到2/29，閏年）', () => {
      // 2024-01-29 開始（閏年），月週期
      subscription.startDate = '2024-01-29T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2024-02-29T10:00:00.000Z');
    });

    it('應該正確處理1/30的邊緣案例（轉到2/29，閏年）', () => {
      // 2024-01-30 開始（閏年），月週期
      subscription.startDate = '2024-01-30T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2024-02-29T10:00:00.000Z');
    });

    it('應該正確處理2/29的邊緣案例（轉到3/29，閏年）', () => {
      // 2024-02-29 開始（閏年），月週期
      subscription.startDate = '2024-02-29T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('monthly');

      expect(nextDate).toBe('2024-03-29T10:00:00.000Z');
    });

    it('應該正確計算年週期的下次扣款日', () => {
      // 2025-03-15 開始，年週期
      subscription.startDate = '2025-03-15T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('yearly');

      expect(nextDate).toBe('2026-03-15T10:00:00.000Z');
    });

    it('應該正確處理年週期的閏年2/29', () => {
      // 2024-02-29 開始，年週期
      subscription.startDate = '2024-02-29T10:00:00.000Z';
      const nextDate = subscription.calculateNextBillingDate('yearly');

      expect(nextDate).toBe('2025-02-28T10:00:00.000Z');
    });
  });

  describe('狀態管理', () => {
    it('應該能夠從pending狀態激活', () => {
      subscription.status = 'pending';
      subscription.activate();
      expect(subscription.status).toBe('active');
    });

    it('應該能夠取消pending狀態的訂閱', () => {
      subscription.status = 'pending';
      subscription.cancel();
      expect(subscription.status).toBe('cancelled');
    });

    it('應該能夠取消active狀態的訂閱', () => {
      subscription.status = 'active';
      subscription.cancel();
      expect(subscription.status).toBe('cancelled');
    });

    it('激活非pending狀態應該拋出錯誤', () => {
      subscription.status = 'active';
      expect(() => subscription.activate()).toThrow('只能從 pending 狀態激活訂閱');
    });

    it('取消已取消的訂閱應該拋出錯誤', () => {
      subscription.status = 'cancelled';
      expect(() => subscription.cancel()).toThrow('訂閱已經被取消');
    });
  });
});
