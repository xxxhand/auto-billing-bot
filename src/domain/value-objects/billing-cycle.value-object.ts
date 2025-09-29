import { IsEnum, IsNumber, Min } from 'class-validator';

export enum BillingCycleUnit {
  DAYS = 'days',
  WEEKS = 'weeks',
  MONTHS = 'months',
  YEARS = 'years',
}

export class BillingCycle {
  @IsEnum(BillingCycleUnit)
  unit: BillingCycleUnit;

  @IsNumber()
  @Min(1)
  value: number;

  constructor(unit: BillingCycleUnit, value: number) {
    this.unit = unit;
    this.value = value;
  }

  /**
   * Calculate next billing date from a given date
   */
  calculateNextBillingDate(fromDate: Date): Date {
    const nextDate = new Date(fromDate);

    switch (this.unit) {
      case BillingCycleUnit.DAYS:
        nextDate.setDate(nextDate.getDate() + this.value);
        break;
      case BillingCycleUnit.WEEKS:
        nextDate.setDate(nextDate.getDate() + this.value * 7);
        break;
      case BillingCycleUnit.MONTHS:
        const currentDay = nextDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + this.value);

        // Handle month boundary: if day changed, it means we went past month end
        // Adjust to last day of previous month
        if (nextDate.getDate() !== currentDay) {
          nextDate.setDate(0); // Set to last day of previous month
        }
        break;
      case BillingCycleUnit.YEARS:
        const currentMonth = nextDate.getMonth();
        const currentDayOfMonth = nextDate.getDate();
        nextDate.setFullYear(nextDate.getFullYear() + this.value);

        // Handle leap year boundary: if month/day changed, adjust to last valid date
        if (nextDate.getMonth() !== currentMonth || nextDate.getDate() !== currentDayOfMonth) {
          // Set to last day of the target month
          nextDate.setMonth(currentMonth + 1);
          nextDate.setDate(0);
        }
        break;
    }

    return nextDate;
  }

  /**
   * Check if a date falls on a billing cycle
   */
  isBillingDate(baseDate: Date, checkDate: Date): boolean {
    const nextBillingDate = this.calculateNextBillingDate(baseDate);
    return nextBillingDate.toDateString() === checkDate.toDateString();
  }

  /**
   * Get billing cycle description
   */
  toString(): string {
    return `${this.value} ${this.unit}`;
  }

  /**
   * Create common billing cycles
   */
  static weekly(): BillingCycle {
    return new BillingCycle(BillingCycleUnit.WEEKS, 1);
  }

  static monthly(): BillingCycle {
    return new BillingCycle(BillingCycleUnit.MONTHS, 1);
  }

  static quarterly(): BillingCycle {
    return new BillingCycle(BillingCycleUnit.MONTHS, 3);
  }

  static yearly(): BillingCycle {
    return new BillingCycle(BillingCycleUnit.YEARS, 1);
  }

  static custom(unit: BillingCycleUnit, value: number): BillingCycle {
    return new BillingCycle(unit, value);
  }
}