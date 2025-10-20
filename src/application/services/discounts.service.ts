import { Inject, Injectable } from '@nestjs/common';
import { DiscountRepository } from '../../infra/repositories/discount.repository';
import { Discount } from '../../domain/entities/discount.entity';

export interface DiscountResponse {
  discountId: string;
  type: string;
  value: number;
  priority: number;
  startDate: Date;
  endDate: Date;
  applicableProducts: string[];
}

@Injectable()
export class DiscountsService {
  constructor(private readonly discountRepository: DiscountRepository) {}

  /**
   * Get all applicable discounts
   * Returns discounts that are currently valid (within start/end date range)
   */
  async getApplicableDiscounts(): Promise<DiscountResponse[]> {
    const allDiscounts = await this.discountRepository.findAll();
    const now = new Date();

    // Filter discounts that are currently valid
    const applicableDiscounts = allDiscounts.filter(discount => discount.isApplicable(now));

    return applicableDiscounts.map((discount) => ({
      discountId: discount.discountId,
      type: discount.type,
      value: discount.value,
      priority: discount.priority,
      startDate: discount.startDate,
      endDate: discount.endDate,
      applicableProducts: discount.applicableProducts,
    }));
  }
}