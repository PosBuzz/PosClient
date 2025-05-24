import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';

@Injectable()
export class ProductVariantService {
  constructor(private prisma: PrismaService) {}

  async create(productId: number, dto: CreateProductVariantDto) {
    // Create the variant
    const variant = await this.prisma.productVariant.create({
      data: {
        product_id: productId,
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        cost_price: dto.cost_price,
        regular_price: dto.regular_price,
        wholesale_price: dto.wholesale_price,
        sale_unit_id: dto.sale_unit_id,
        purchase_unit_id: dto.purchase_unit_id,
        warranty_period: dto.warranty_period, // warranty in months only
        image: dto.image, // single image URL
        is_default: dto.is_default || false,
      },
    });

    // Create initial price history record
    await this.prisma.priceHistory.create({
      data: {
        variant_id: variant.id,
        cost_price: dto.cost_price,
        regular_price: dto.regular_price,
        wholesale_price: dto.wholesale_price,
      },
    });

    // Create variant attributes if provided
    if (dto.attributes && dto.attributes.length > 0) {
      await Promise.all(
        dto.attributes.map(attr =>
          this.prisma.variantAttribute.create({
            data: {
              variant_id: variant.id,
              name: attr.name,
              value: attr.value,
            },
          })
        )
      );
    }

    return this.findOne(variant.id);
  }

  async findOne(id: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        sale_unit: true,
        purchase_unit: true,
        VariantAttribute: true,
        price_history: {
          take: 1,
          orderBy: { effective_date: 'desc' },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }

    return variant;
  }

  async update(id: number, dto: UpdateProductVariantDto) {
    // First check if variant exists
    await this.findOne(id);
    
    // Get current prices to check if they've changed
    const currentVariant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: {
        cost_price: true,
        regular_price: true,
        wholesale_price: true,
      },
    });
    
    if (!currentVariant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }
    
    // Update the variant
    const updatedVariant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        cost_price: dto.cost_price,
        regular_price: dto.regular_price,
        wholesale_price: dto.wholesale_price,
        sale_unit_id: dto.sale_unit_id,
        purchase_unit_id: dto.purchase_unit_id,
        warranty_period: dto.warranty_period, // warranty in months only
        image: dto.image, // single image URL
        is_default: dto.is_default,
      },
    });

    // Create new price history if prices changed
    const priceChanged =
      (dto.cost_price && dto.cost_price !== currentVariant.cost_price.toString()) ||
      (dto.regular_price && dto.regular_price !== currentVariant.regular_price.toString()) ||
      (dto.wholesale_price && 
        dto.wholesale_price !== (currentVariant.wholesale_price ? currentVariant.wholesale_price.toString() : undefined));

    if (priceChanged) {
      await this.prisma.priceHistory.create({
        data: {
          variant_id: id,
          cost_price: dto.cost_price || currentVariant.cost_price.toString(),
          regular_price: dto.regular_price || currentVariant.regular_price.toString(),
          wholesale_price: dto.wholesale_price || currentVariant.wholesale_price?.toString(),
        },
      });
    }

    // Update attributes if provided
    if (dto.attributes && dto.attributes.length > 0) {
      // Delete existing attributes
      await this.prisma.variantAttribute.deleteMany({
        where: { variant_id: id },
      });

      // Create new attributes
      await Promise.all(
        dto.attributes.map(attr =>
          this.prisma.variantAttribute.create({
            data: {
              variant_id: id,
              name: attr.name,
              value: attr.value,
            },
          })
        )
      );
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    // First check if variant exists
    await this.findOne(id);

    // Delete the variant (cascades to attributes and price history)
    await this.prisma.productVariant.delete({
      where: { id },
    });

    return { success: true, message: 'Variant deleted successfully' };
  }
}