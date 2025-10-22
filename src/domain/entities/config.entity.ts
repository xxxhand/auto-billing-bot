import { BaseEntity } from './base-entity.abstract';

/**
 * Config type enums as defined in the system design v0.7.1
 */
export type ConfigType = 'global' | 'product';

/**
 * Config entity - handles global and product-level configurations
 */
export class Config extends BaseEntity {
  public configId: string;
  public type: ConfigType;
  public productId: string | null;
  public gracePeriodDays: number;
  public refundPolicy: Record<string, any>;
  valid: boolean = true;

  constructor(
    configId: string,
    type: ConfigType,
    productId: string | null = null,
    gracePeriodDays: number = 7,
    refundPolicy: Record<string, any> = {},
  ) {
    super();

    // Validate config type
    if (type !== 'global' && type !== 'product') {
      throw new Error(`Invalid config type: ${type}`);
    }

    // Validate product config requirements
    if (type === 'product' && (!productId || productId.trim() === '')) {
      throw new Error('Product config must have a productId');
    }

    // Validate grace period days
    if (gracePeriodDays <= 0) {
      throw new Error('Grace period days must be positive');
    }

    this.configId = configId;
    this.type = type;
    this.productId = productId;
    this.gracePeriodDays = gracePeriodDays;
    this.refundPolicy = refundPolicy;
  }

  /**
   * Check if this is a global configuration
   * @returns true if this is a global config, false otherwise
   */
  public isGlobal(): boolean {
    return this.type === 'global';
  }

  /**
   * Check if this is a product-specific configuration
   * @returns true if this is a product-specific config, false otherwise
   */
  public isProductSpecific(): boolean {
    return this.type === 'product';
  }

  /**
   * Get the grace period days, with fallback to default
   * @returns The number of grace period days
   */
  public getGracePeriodDays(): number {
    return this.gracePeriodDays || 7;
  }

  /**
   * Update the grace period days
   * @param days The new grace period days (must be positive)
   */
  public updateGracePeriodDays(days: number): void {
    if (days <= 0) {
      throw new Error('Grace period days must be positive');
    }
    this.gracePeriodDays = days;
  }

  /**
   * Update the refund policy
   * @param policy The new refund policy object
   */
  public updateRefundPolicy(policy: Record<string, any>): void {
    this.refundPolicy = policy;
  }

  /**
   * Check if this configuration applies to a specific product
   * @param productId The product ID to check
   * @returns true if this config applies to the product, false otherwise
   */
  public appliesToProduct(productId: string): boolean {
    if (this.isGlobal()) {
      return true;
    }
    return this.productId === productId;
  }

  /**
   * Get the effective configuration for a product by merging global and product-specific configs
   * Product-specific configs take priority over global configs
   * @param configs Array of all available configs
   * @param productId The product ID to get effective config for
   * @returns Object containing the effective configuration values
   */
  public static getEffectiveConfig(
    configs: Config[],
    productId: string,
  ): {
    gracePeriodDays: number;
    refundPolicy: Record<string, any>;
  } {
    // Find global config
    const globalConfig = configs.find(config => config.isGlobal());

    // Find product-specific config
    const productConfig = configs.find(
      config => config.isProductSpecific() && config.appliesToProduct(productId),
    );

    // Use product config if available, otherwise fall back to global config
    const effectiveConfig = productConfig || globalConfig;

    if (effectiveConfig) {
      return {
        gracePeriodDays: effectiveConfig.getGracePeriodDays(),
        refundPolicy: effectiveConfig.refundPolicy,
      };
    }

    // Return defaults if no configs found
    return {
      gracePeriodDays: 7,
      refundPolicy: {},
    };
  }
}