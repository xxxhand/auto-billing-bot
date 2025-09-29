import { IsEnum, IsNumber, Min } from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class Discount {
  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  constructor(type: DiscountType, value: number) {
    this.type = type;
    this.value = value;
  }

  /**
   * Calculate discount amount
   * @param amount Original amount
   * @returns Discount amount
   */
  calculate(amount: number): number {
    if (this.type === DiscountType.PERCENTAGE) {
      return Math.min(amount * (this.value / 100), amount);
    } else {
      return Math.min(this.value, amount);
    }
  }

  /**
   * Get final amount after discount
   * @param amount Original amount
   * @returns Final amount
   */
  apply(amount: number): number {
    return amount - this.calculate(amount);
  }
}
