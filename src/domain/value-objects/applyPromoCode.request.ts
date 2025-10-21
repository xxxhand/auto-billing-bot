import * as cv from 'class-validator';
import { errConstants } from '@myapp/common';

/**
 * Request DTO for applying a promo code to an order
 */
export class ApplyPromoCodeRequest {
  @cv.IsNotEmpty({ message: errConstants.ERR_USER_NOT_FOUND })
  @cv.IsString({ message: errConstants.ERR_USER_NOT_FOUND })
  public userId: string = '';

  @cv.IsNotEmpty({ message: errConstants.ERR_INVALID_PROMO_CODE })
  @cv.IsString({ message: errConstants.ERR_INVALID_PROMO_CODE })
  public promoCode: string = '';

  @cv.IsNotEmpty({ message: errConstants.ERR_ORDER_AMOUNT_INVALID })
  @cv.IsNumber({}, { message: errConstants.ERR_ORDER_AMOUNT_INVALID })
  @cv.Min(0.01, { message: errConstants.ERR_ORDER_AMOUNT_INVALID })
  public orderAmount: number = 0;

  @cv.IsArray({ message: errConstants.ERR_PRODUCT_IDS_REQUIRED })
  @cv.ArrayNotEmpty({ message: errConstants.ERR_PRODUCT_IDS_REQUIRED })
  @cv.IsString({ each: true, message: errConstants.ERR_PRODUCT_IDS_REQUIRED })
  public productIds: string[] = [];

  @cv.IsOptional()
  @cv.IsBoolean({ message: errConstants.ERR_INVALID_PROMO_CODE })
  public applyToSubscription?: boolean = false;

  @cv.IsOptional()
  @cv.IsString({ message: errConstants.ERR_SUBSCRIPTION_ID_EMPTY })
  @cv.ValidateIf(o => o.applyToSubscription === true)
  @cv.IsNotEmpty({ message: errConstants.ERR_SUBSCRIPTION_ID_EMPTY })
  public subscriptionId?: string = '';
}