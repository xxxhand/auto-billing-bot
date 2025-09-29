import { Injectable } from '@nestjs/common';
import { Product } from '../../domain/entities/product.entity';
import { ProductRepository } from '../../infra/repositories/product.repository';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async createProduct(productData: { name: string; cycleType: 'monthly' | 'yearly'; price: number; discountPercentage?: number }): Promise<Product> {
    const product = new Product();
    Object.assign(product, productData);
    return await this.productRepository.save(product);
  }

  async getAllProducts(): Promise<Product[]> {
    return await this.productRepository.findAll();
  }

  async getProductById(id: string): Promise<Product | undefined> {
    return await this.productRepository.findById(id);
  }

  async updateProduct(
    id: string,
    updateData: Partial<{
      name: string;
      cycleType: 'monthly' | 'yearly';
      price: number;
      discountPercentage: number;
    }>,
  ): Promise<Product | undefined> {
    const existingProduct = await this.productRepository.findById(id);
    if (!existingProduct) {
      return undefined;
    }

    Object.assign(existingProduct, updateData);
    return await this.productRepository.save(existingProduct);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      return false;
    }

    product.deletedAt = new Date();
    await this.productRepository.save(product);
    return true;
  }

  calculateDiscountedPrice(product: Product): number {
    if (product.discountPercentage && product.discountPercentage > 0) {
      return product.price * (1 - product.discountPercentage / 100);
    }
    return product.price;
  }
}
