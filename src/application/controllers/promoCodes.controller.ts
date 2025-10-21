import { CustomValidator, CustomResult } from '@xxxhand/app-common';
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { PromoCodeService, AvailablePromoCode, AppliedPromoCodeResult } from '../services/promoCode.service';
import { ApplyPromoCodeRequest } from '../../domain/value-objects/applyPromoCode.request';

@Controller({
  path: 'promoCodes',
  version: '1',
})
export class PromoCodesController {
  constructor(
    private readonly commonService: CommonService,
    private readonly promoCodeService: PromoCodeService,
  ) {}

  /**
   * Get available promo codes for the current user
   * Returns promo codes that the user can use, filtered by product if specified
   *
   * @param userId The user ID (from JWT in future, hardcoded for now)
   * @param productId Optional product ID to filter applicable promo codes
   * @returns List of available promo codes
   */
  @Get('userPromoCodes')
  public async getUserPromoCodes(
    @Query('userId') userId: string,
    @Query('productId') productId?: string,
  ): Promise<CustomResult<AvailablePromoCode[]>> {
    if (!CustomValidator.nonEmptyString(userId)) {
      throw ErrException.newFromCodeName(errConstants.ERR_USER_NOT_FOUND);
    }

    const data = await this.promoCodeService.getAvailablePromoCodesForUser(userId, productId);
    return this.commonService.newResultInstance().withResult(data);
  }

  /**
   * Apply a promo code to an order or subscription
   * Validates and applies the promo code, returning discount details or subscription update info
   *
   * @param request The apply promo code request
   * @returns The applied promo code result with discount details or subscription update info
   */
  @Post('applyPromo')
  public async applyPromoCode(@Body() request: ApplyPromoCodeRequest): Promise<CustomResult<any>> {
    const data = await this.promoCodeService.applyPromoCode(
      request.userId,
      request.promoCode,
      {
        amount: request.orderAmount,
        products: request.productIds,
      },
      request.applyToSubscription || false,
      request.subscriptionId
    );
    return this.commonService.newResultInstance().withResult(data);
  }
}