import { Injectable } from '@nestjs/common';
import { Coupon, CouponPriority } from '../entities/coupon.entity';
import { Discount } from '../value-objects/discount.value-object';

export interface CouponApplicationResult {
  coupon: Coupon;
  discountAmount: number;
  finalAmount: number;
}

export interface DiscountResult {
  discountAmount: number;
  finalAmount: number;
}

export interface BestDiscountResult extends DiscountResult {
  appliedCoupon: Coupon | null;
}

@Injectable()
export class CouponService {
  /**
   * Sort coupons by priority (highest first)
   */
  sortByPriority(coupons: Coupon[]): Coupon[] {
    return [...coupons].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Compare two discounts and return the better one (higher discount amount)
   */
  compareDiscounts(discount1: Discount, discount2: Discount, amount: number): Discount {
    const amount1 = discount1.calculate(amount);
    const amount2 = discount2.calculate(amount);

    return amount1 >= amount2 ? discount1 : discount2;
  }

  /**
   * Validate if a coupon can be used (date range and usage limit)
   */
  validateCoupon(coupon: Coupon): void {
    const now = new Date();

    if (now < coupon.validFrom) {
      throw new Error('Coupon is not yet valid');
    }

    if (now > coupon.validUntil) {
      throw new Error('Coupon has expired');
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new Error('Coupon usage limit exceeded');
    }
  }

  /**
   * Apply renewal discount based on renewal count
   */
  applyRenewalDiscount(renewalCount: number, amount: number): DiscountResult {
    if (renewalCount < 1) {
      return {
        discountAmount: 0,
        finalAmount: amount,
      };
    }

    // 5% per renewal, max 10%
    const discountPercentage = Math.min(renewalCount * 5, 10);
    const discountAmount = Math.round((amount * discountPercentage) / 100);

    return {
      discountAmount,
      finalAmount: amount - discountAmount,
    };
  }

  /**
   * Apply the best discount considering coupons and renewal discount
   */
  applyBestDiscount(coupons: Coupon[], renewalCount: number, amount: number): BestDiscountResult {
    // Get renewal discount
    const renewalDiscount = this.applyRenewalDiscount(renewalCount, amount);

    // Get best coupon discount
    const couponResult = this.applyBestCoupon(coupons, amount);

    // Compare renewal vs coupon discount based on priority
    if (!couponResult) {
      return {
        ...renewalDiscount,
        appliedCoupon: null,
      };
    }

    // Campaign coupons (priority 3) always take precedence over renewal discount (priority 2)
    if (couponResult.coupon.priority >= CouponPriority.RENEWAL) {
      return {
        discountAmount: couponResult.discountAmount,
        finalAmount: couponResult.finalAmount,
        appliedCoupon: couponResult.coupon,
      };
    }

    // For basic coupons (priority 1), compare discount amounts with renewal discount
    if (couponResult.discountAmount >= renewalDiscount.discountAmount) {
      return {
        discountAmount: couponResult.discountAmount,
        finalAmount: couponResult.finalAmount,
        appliedCoupon: couponResult.coupon,
      };
    } else {
      return {
        ...renewalDiscount,
        appliedCoupon: null,
      };
    }
  }

  /**
   * Apply the best available coupon from a list
   */
  applyBestCoupon(coupons: Coupon[], amount: number): CouponApplicationResult | null {
    const validCoupons = coupons.filter((coupon) => {
      try {
        this.validateCoupon(coupon);
        return true;
      } catch {
        return false;
      }
    });

    if (validCoupons.length === 0) {
      return null;
    }

    const sortedCoupons = this.sortByPriority(validCoupons);
    const bestCoupon = sortedCoupons[0];

    // For same priority, compare discount amounts
    const samePriorityCoupons = sortedCoupons.filter((c) => c.priority === bestCoupon.priority);
    let finalCoupon = bestCoupon;

    for (const coupon of samePriorityCoupons) {
      const discount = new Discount(coupon.type, coupon.value);
      const bestDiscount = new Discount(finalCoupon.type, finalCoupon.value);

      if (this.compareDiscounts(discount, bestDiscount, amount) === discount) {
        finalCoupon = coupon;
      }
    }

    const discount = new Discount(finalCoupon.type, finalCoupon.value);
    const discountAmount = discount.calculate(amount);
    const finalAmount = amount - discountAmount;

    return {
      coupon: finalCoupon,
      discountAmount,
      finalAmount,
    };
  }
}
