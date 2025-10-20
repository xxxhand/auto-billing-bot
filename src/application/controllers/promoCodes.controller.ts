import { CustomValidator, CustomResult } from '@xxxhand/app-common';
import { Controller, Get, Query } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { PromoCodeService, AvailablePromoCode } from '../services/promoCode.service';

@Controller('promoCodes')
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
}