export type BillingCycleType = 'monthly' | 'yearly';

export class BillingCycle {
  constructor(public cycleType: BillingCycleType) {}

  /**
   * 計算下次扣款日期
   * @param currentDate 當前日期的ISO字串
   * @returns 下次扣款日期的ISO字串
   */
  calculateNextDate(currentDate: string): string {
    const date = new Date(currentDate);

    if (this.cycleType === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (this.cycleType === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date.toISOString();
  }
}
