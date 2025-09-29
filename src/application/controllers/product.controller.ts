import { Controller, Get, Query, LoggerService } from '@nestjs/common';
import { ProductService } from '../../infra/services/product.service';
import { CustomResult } from '@xxxhand/app-common';
import { CommonService } from '@myapp/common';

@Controller({
  path: 'products',
  version: '1',
})
export class ProductController {
  private _logger: LoggerService;
  constructor(
    private readonly productService: ProductService,
    private readonly commonService: CommonService,
  ) {
    this._logger = this.commonService.getDefaultLogger(ProductController.name);
  }

  @Get()
  async getProducts(@Query('userId') userId?: string): Promise<CustomResult> {
    this._logger.log(`Getting products${userId ? ` for user ${userId}` : ''}.`);

    const products = await this.productService.getAllProducts();

    return this.commonService.newResultInstance().withResult(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        cycleType: product.cycleType,
        price: product.price,
        discountPercentage: product.discountPercentage,
      })),
    );
  }
}
