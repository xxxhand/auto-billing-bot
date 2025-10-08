import { CustomValidator, CustomResult } from '@xxxhand/app-common';
import { Controller, Get, Query, LoggerService } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { ProductsService, ProductWithDiscount } from '../services/products.service';

@Controller({
  path: 'products',
  version: '1',
})
export class ProductsController {
  private readonly logger: LoggerService;
  constructor(
    private readonly commonService: CommonService,
    private readonly productsService: ProductsService,
  ) {
    this.logger = this.commonService.getDefaultLogger(ProductsController.name);
  }

  @Get()
  async getProducts(@Query('userId') userId: string): Promise<CustomResult<ProductWithDiscount[]>> {
    const data = await this.productsService.getAvailableProducts(userId);
    return this.commonService.newResultInstance().withResult(data);
  }
}