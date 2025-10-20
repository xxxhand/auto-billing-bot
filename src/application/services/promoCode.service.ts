import { Injectable } from '@nestjs/common';
import { PromoCodeRepository } from '../../infra/repositories/promoCode.repository';
import { PromoCodeUsageRepository } from '../../infra/repositories/promoCodeUsage.repository';
import { PromoCodeDomainService } from '../../domain/services/promo-code-domain.service';
import { PromoCode } from '../../domain/entities/promoCode.entity';

export interface AvailablePromoCode {
  code: string;
  discountId: string;
  isSingleUse: boolean;
  remainingUses: number;
  minimumAmount: number;
  applicableProducts: string[];
}

/**
 * Application service for handling promo code operations
 */
@Injectable()
export class PromoCodeService {
  constructor(
    private readonly promoCodeRepository: PromoCodeRepository,
    private readonly promoCodeUsageRepository: PromoCodeUsageRepository,
    private readonly promoCodeDomainService: PromoCodeDomainService,
  ) {}

  /**
   * Get available promo codes for a user
   * Filters promo codes based on user eligibility, usage history, and product applicability
   *
   * @param userId The user ID
   * @param productId Optional product ID to filter applicable promo codes
   * @returns List of available promo codes with details
   */
  public async getAvailablePromoCodesForUser(userId: string, productId?: string): Promise<AvailablePromoCode[]> {
    // Get all potentially applicable promo codes
    const applicablePromoCodes = await this.promoCodeRepository.findApplicablePromoCodes(userId, productId);

    // Get user's usage history
    const userUsageHistory = await this.promoCodeUsageRepository.findByUserId(userId);
    const usedPromoCodes = userUsageHistory.map(usage => usage.promoCode);

    // Filter promo codes that the user can actually use
    const availablePromoCodes: AvailablePromoCode[] = [];

    for (const promoCode of applicablePromoCodes) {
      // Check if user can use this promo code based on domain rules
      if (this.promoCodeDomainService.canUserUsePromoCode(promoCode, usedPromoCodes)) {
        // Calculate remaining uses
        const remainingUses = promoCode.usageLimit ? promoCode.usageLimit - promoCode.usedCount : Infinity;

        availablePromoCodes.push({
          code: promoCode.code,
          discountId: promoCode.discountId,
          isSingleUse: promoCode.isSingleUse,
          remainingUses: remainingUses === Infinity ? -1 : remainingUses, // -1 indicates unlimited
          minimumAmount: promoCode.minimumAmount,
          applicableProducts: promoCode.applicableProducts,
        });
      }
    }

    return availablePromoCodes;
  }
}