import { Injectable } from '@nestjs/common';
import { Config, ConfigType } from '../../domain/entities/config.entity';
import { ConfigRepository } from '../../infra/repositories/config.repository';

/**
 * Configuration retrieval result
 */
export interface ConfigRetrievalResult {
  config: Config | null;
  source: 'product' | 'global' | 'default';
  gracePeriodDays: number;
  refundPolicy: Record<string, any>;
}

/**
 * Domain service for configuration management
 * Handles global and product-specific configurations with priority-based retrieval
 */
@Injectable()
export class ConfigService {
  constructor(private readonly configRepository: ConfigRepository) {}

  /**
   * Create a new configuration
   * @param configId Unique configuration identifier
   * @param type Configuration type ('global' or 'product')
   * @param productId Product ID (required for product-specific configs)
   * @param gracePeriodDays Grace period in days (defaults to 7)
   * @param refundPolicy Refund policy configuration
   * @returns The created config entity
   */
  public async createConfig(
    configId: string,
    type: ConfigType,
    productId: string | null = null,
    gracePeriodDays: number = 7,
    refundPolicy: Record<string, any> = {},
  ): Promise<Config> {
    // Validate inputs
    if (!configId || configId.trim() === '') {
      throw new Error('Config ID is required');
    }

    // Check if config already exists
    const existingConfig = await this.configRepository.findByConfigId(configId);
    if (existingConfig) {
      throw new Error(`Config with ID '${configId}' already exists`);
    }

    // Create new config entity
    const config = new Config(configId, type, productId, gracePeriodDays, refundPolicy);

    // Save to repository
    const savedConfig = await this.configRepository.save(config);
    if (!savedConfig) {
      throw new Error('Failed to save configuration');
    }

    return savedConfig;
  }

  /**
   * Get configuration by configId
   * @param configId The configuration identifier
   * @returns The config entity if found, null otherwise
   */
  public async getConfigById(configId: string): Promise<Config | null> {
    return await this.configRepository.findByConfigId(configId);
  }

  /**
   * Get effective configuration for a product
   * Priority: product-specific > global > system defaults
   * @param productId The product identifier
   * @returns Configuration retrieval result with effective values
   */
  public async getEffectiveConfigForProduct(productId: string): Promise<ConfigRetrievalResult> {
    if (!productId || productId.trim() === '') {
      throw new Error('Product ID is required');
    }

    // Try to get product-specific config first
    const productConfig = await this.configRepository.findByProductId(productId);
    if (productConfig) {
      return {
        config: productConfig,
        source: 'product',
        gracePeriodDays: productConfig.getGracePeriodDays(),
        refundPolicy: productConfig.refundPolicy,
      };
    }

    // Fall back to global config
    const globalConfig = await this.configRepository.findGlobalConfig();
    if (globalConfig) {
      return {
        config: globalConfig,
        source: 'global',
        gracePeriodDays: globalConfig.getGracePeriodDays(),
        refundPolicy: globalConfig.refundPolicy,
      };
    }

    // Fall back to system defaults
    return {
      config: null,
      source: 'default',
      gracePeriodDays: 7,
      refundPolicy: {},
    };
  }

  /**
   * Get global configuration
   * @returns The global config entity if found, null otherwise
   */
  public async getGlobalConfig(): Promise<Config | null> {
    return await this.configRepository.findGlobalConfig();
  }

  /**
   * Get product-specific configuration
   * @param productId The product identifier
   * @returns The product config entity if found, null otherwise
   */
  public async getProductConfig(productId: string): Promise<Config | null> {
    if (!productId || productId.trim() === '') {
      throw new Error('Product ID is required');
    }
    return await this.configRepository.findByProductId(productId);
  }

  /**
   * Update an existing configuration
   * @param configId The configuration identifier
   * @param updates Partial configuration updates
   * @returns The updated config entity
   */
  public async updateConfig(
    configId: string,
    updates: {
      gracePeriodDays?: number;
      refundPolicy?: Record<string, any>;
    },
  ): Promise<Config> {
    const config = await this.configRepository.findByConfigId(configId);
    if (!config) {
      throw new Error(`Configuration '${configId}' not found`);
    }

    // Apply updates
    if (updates.gracePeriodDays !== undefined) {
      config.updateGracePeriodDays(updates.gracePeriodDays);
    }

    if (updates.refundPolicy !== undefined) {
      config.updateRefundPolicy(updates.refundPolicy);
    }

    // Save updated config
    const savedConfig = await this.configRepository.save(config);
    if (!savedConfig) {
      throw new Error('Failed to update configuration');
    }

    return savedConfig;
  }

  /**
   * Delete a configuration
   * @param configId The configuration identifier
   * @returns True if deleted, false if not found
   */
  public async deleteConfig(configId: string): Promise<boolean> {
    return await this.configRepository.deleteByConfigId(configId);
  }

  /**
   * Get all configurations
   * @returns Array of all config entities
   */
  public async getAllConfigs(): Promise<Config[]> {
    return await this.configRepository.findAll();
  }

  /**
   * Get configurations by type
   * @param type The configuration type
   * @returns Array of config entities of the specified type
   */
  public async getConfigsByType(type: ConfigType): Promise<Config[]> {
    return await this.configRepository.findByType(type);
  }

  /**
   * Validate configuration data
   * @param configData The configuration data to validate
   * @returns Validation result
   */
  public validateConfigData(configData: {
    configId: string;
    type: ConfigType;
    productId?: string | null;
    gracePeriodDays?: number;
    refundPolicy?: Record<string, any>;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate configId
    if (!configData.configId || configData.configId.trim() === '') {
      errors.push('Config ID is required');
    }

    // Validate type
    if (configData.type !== 'global' && configData.type !== 'product') {
      errors.push('Config type must be either "global" or "product"');
    }

    // Validate productId for product configs
    if (configData.type === 'product') {
      if (!configData.productId || configData.productId.trim() === '') {
        errors.push('Product ID is required for product-specific configurations');
      }
    }

    // Validate gracePeriodDays
    if (configData.gracePeriodDays !== undefined && configData.gracePeriodDays <= 0) {
      errors.push('Grace period days must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}