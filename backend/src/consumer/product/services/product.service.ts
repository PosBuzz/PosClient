import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductVariantService } from './product-variant.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private variantService: ProductVariantService
  ) {}

  async create(consumerId: number, dto: CreateProductDto) {
    // Validate that at least one variant is provided
    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    // For non-variant products, ensure only one variant is provided
    if (!dto.has_variants && dto.variants.length > 1) {
      throw new BadRequestException('Simple products can only have one variant');
    }

    // Create the product
    const product = await this.prisma.product.create({
      data: {
        consumer_id: consumerId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        category_id: dto.category_id,
        brand_id: dto.brand_id,
        has_variants: dto.has_variants,
        tax_method: dto.tax_method || 'exclusive',
        tax: dto.tax || 0,
        daily_sale_objective: dto.daily_sale_objective || 0,
      },
    });

    // Add tags if provided
    if (dto.tag_ids && dto.tag_ids.length > 0) {
      await this.prisma.$transaction(
        dto.tag_ids.map(tagId =>
          this.prisma.tagOnProduct.create({
            data: {
              product_id: product.id,
              tag_id: tagId,
            },
          })
        )
      );
    }

    // Create variants
    // For simple products, mark the variant as default
    if (!dto.has_variants) {
      dto.variants[0].is_default = true;
    }

    await Promise.all(
      dto.variants.map(variantDto => this.variantService.create(product.id, variantDto))
    );

    return this.findOne(product.id, consumerId);
  }

  async findAll(consumerId: number, options: { 
    page?: number, 
    limit?: number, 
    search?: string,
    categoryId?: number,
    brandId?: number,
    tagId?: number
  } = {}) {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      categoryId,
      brandId,
      tagId
    } = options;
    
    const skip = (page - 1) * limit;
    
    // Build the where clause properly for Prisma
    const whereClause: any = {
      consumer_id: consumerId,
      deleted_at: null,
    };
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' as any } },
        { code: { contains: search, mode: 'insensitive' as any } },
      ];
    }
    
    if (categoryId) {
      whereClause.category_id = parseInt(categoryId.toString());
    }
    
    if (brandId) {
      whereClause.brand_id = parseInt(brandId.toString());
    }
    
    if (tagId) {
      whereClause.tags = { some: { tag_id: parseInt(tagId.toString()) } };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          tags: {
            include: {
              tag: true,
            },
          },
          variants: {
            include: {
              sale_unit: true,
              price_history: {
                take: 1,
                orderBy: { effective_date: 'desc' },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, consumerId: number) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        deleted_at: null,
      },
      include: {
        category: true,
        brand: true,
        tags: {
          include: {
            tag: true,
          },
        },
        variants: {
          include: {
            sale_unit: true,
            purchase_unit: true,
            VariantAttribute: true,
            serials: {  // Add this line
              orderBy: { created_at: 'desc' },
            },
            inventory_items: {
              include: {
                branch: true,
              },
            },
            price_history: {
              take: 1,
              orderBy: { effective_date: 'desc' },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: number, dto: UpdateProductDto, consumerId: number) {
    // First check if product exists and belongs to this consumer
    await this.findOne(id, consumerId);

    // Update the product
    await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        category_id: dto.category_id,
        brand_id: dto.brand_id,
        has_variants: dto.has_variants,
        tax_method: dto.tax_method,
        tax: dto.tax,
        daily_sale_objective: dto.daily_sale_objective,
      },
    });

    // Update tags if provided
    if (dto.tag_ids) {
      // Remove existing tags
      await this.prisma.tagOnProduct.deleteMany({
        where: { product_id: id },
      });

      // Add new tags
      if (dto.tag_ids.length > 0) {
        await this.prisma.$transaction(
          dto.tag_ids.map(tagId =>
            this.prisma.tagOnProduct.create({
              data: {
                product_id: id,
                tag_id: tagId,
              },
            })
          )
        );
      }
    }

    // Update existing variants
    if (dto.variants && dto.variants.length > 0) {
      // Process each variant
      await Promise.all(
        dto.variants.map(async variantDto => {
          // If variant has ID, update it
          if ('id' in variantDto && variantDto.id) {
            await this.variantService.update(variantDto.id, variantDto);
          } else {
            // Create new variant - need to ensure all required fields exist
            if (!variantDto.name || !variantDto.cost_price || !variantDto.regular_price || 
                !variantDto.sale_unit_id || !variantDto.purchase_unit_id) {
              throw new BadRequestException('New variants require all required fields');
            }
            
            // Safe cast to CreateProductVariantDto since we've verified required fields
            await this.variantService.create(id, variantDto as unknown as CreateProductVariantDto);
          }
        })
      );
    }

    // Delete variants if requested
    if (dto.variant_ids_to_delete && dto.variant_ids_to_delete.length > 0) {
      await Promise.all(
        dto.variant_ids_to_delete.map(variantId => 
          this.variantService.remove(variantId)
        )
      );
    }

    return this.findOne(id, consumerId);
  }

  async remove(id: number, consumerId: number) {
    // First check if product exists and belongs to this consumer
    await this.findOne(id, consumerId);

    // Soft delete - set deleted_at timestamp
    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { success: true, message: 'Product deleted successfully' };
  }
}