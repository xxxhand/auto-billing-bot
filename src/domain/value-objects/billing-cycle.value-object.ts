import { addMonths, addYears } from 'date-fns';

export type BillingCycleType = 'monthly' | 'yearly';

export class BillingCycle {
  constructor(public readonly cycleType: BillingCycleType) {}

  /**
   * 根據當前日期計算下次扣款日期
   * 處理大小月與閏年邏輯
   * @param currentDate 當前日期（ISO 8601格式）
   * @returns 下次扣款日期（ISO 8601格式，UTC時間）
   */
  public calculateNextDate(currentDate: string): string {
    const date = new Date(currentDate);

    let nextDate: Date;
    if (this.cycleType === 'monthly') {
      // 月週期：加1個月，處理大小月
      nextDate = addMonths(date, 1);
    } else if (this.cycleType === 'yearly') {
      // 年週期：加1年
      nextDate = addYears(date, 1);
    } else {
      throw new Error(`不支援的週期類型: ${this.cycleType}`);
    }

    // 確保返回UTC時間格式
    return nextDate.toISOString();
  }
}
