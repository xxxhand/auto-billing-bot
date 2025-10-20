import { Controller, Get, Post, Param, Body, LoggerService } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { CustomResult } from '@xxxhand/app-common';
import { DiscountsService, DiscountResponse } from '../services/discounts.service';
import { ApplyDiscountRequest } from '../../domain/value-objects/apply-discount.request';
import { ApplyDiscountResponse } from '../../domain/value-objects/apply-discount.response';

@Controller({
  path: 'discounts',
  version: '1',
})
export class DiscountsController {
  private readonly logger: LoggerService;
  constructor(
    private readonly commonService: CommonService,
    private readonly discountsService: DiscountsService,
  ) {
    this.logger = this.commonService.getDefaultLogger(DiscountsController.name);
  }

  @Get()
  async getDiscounts(): Promise<CustomResult<DiscountResponse[]>> {
    const data = await this.discountsService.getApplicableDiscounts();
    return this.commonService.newResultInstance().withResult(data);
  }

  @Post(':id/apply')
  async applyDiscount(
    @Param('id') discountId: string,
    @Body() request: ApplyDiscountRequest,
  ): Promise<CustomResult<ApplyDiscountResponse>> {
    const data = await this.discountsService.applyDiscountToSubscription(discountId, request);
    return this.commonService.newResultInstance().withResult(data);
  }
}