import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductVariantService } from './product-variant.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private variantService: ProductVariantService,
  ) {}

  async create(consumerId: number, dto: CreateProductDto) {
    // Validate that at least one variant is provided
    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    // For non-variant products, ensure only one variant is provided
    if (!dto.has_variants && dto.variants.length > 1) {
      throw new BadRequestException(
        'Simple products can only have one variant',
      );
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
        dto.tag_ids.map((tagId) =>
          this.prisma.tagOnProduct.create({
            data: {
              product_id: product.id,
              tag_id: tagId,
            },
          }),
        ),
      );
    }

    // Create variants
    // For simple products, mark the variant as default
    if (!dto.has_variants) {
      dto.variants[0].is_default = true;
    }

    await Promise.all(
      dto.variants.map((variantDto) =>
        this.variantService.create(product.id, variantDto),
      ),
    );

    return this.findOne(product.id, consumerId);
  }

  async findAll(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      categoryIds?: number[]; // Updated to support multiple
      brandIds?: number[]; // Updated to support multiple
      tagIds?: number[]; // Updated to support multiple
    } = {},
  ) {
    const {
      page = 1,
      limit = 10,
      search = '',
      categoryIds,
      brandIds,
      tagIds,
    } = options;

    const skip = (page - 1) * limit;

    // Build the where clause properly for Prisma
    const whereClause: any = {
      consumer_id: consumerId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' as any } },
        { code: { contains: search, mode: 'insensitive' as any } },
        { description: { contains: search, mode: 'insensitive' as any } },
      ];
    }

    // Handle multiple categories
    if (categoryIds && categoryIds.length > 0) {
      whereClause.category_id = { in: categoryIds };
    }

    // Handle multiple brands
    if (brandIds && brandIds.length > 0) {
      whereClause.brand_id = { in: brandIds };
    }

    // Handle multiple tags
    if (tagIds && tagIds.length > 0) {
      whereClause.tags = {
        some: {
          tag_id: { in: tagIds },
        },
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          variants: {
            include: {
              sale_unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
              purchase_unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
              inventory_items: {
                select: {
                  quantity: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              serials: {
                select: {
                  id: true,
                  status: true,
                },
              },
              price_history: {
                take: 1,
                orderBy: { effective_date: 'desc' },
                select: {
                  regular_price: true,
                  wholesale_price: true,
                },
              },
            },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
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
      },
      include: {
        // Basic product relations
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        consumer: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
          },
        },

        // Tags relation
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        // Complete variant information
        variants: {
          include: {
            // Unit relations
            sale_unit: {
              select: {
                id: true,
                name: true,
                code: true,
                conversion_factor: true,
                base_unit: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            purchase_unit: {
              select: {
                id: true,
                name: true,
                code: true,
                conversion_factor: true,
                base_unit: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },

            // Variant attributes
            VariantAttribute: {
              select: {
                id: true,
                name: true,
                value: true,
              },
            },

            // Serial numbers with full details
            serials: {
              orderBy: { created_at: 'desc' },
              select: {
                id: true,
                serial_number: true,
                status: true,
                sold_date: true,
                notes: true,
                created_at: true,
                updated_at: true,
                batch: {
                  select: {
                    id: true,
                    batch_number: true,
                    expiry_date: true,
                  },
                },
              },
            },

            // Complete inventory information
            inventory_items: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    is_main: true,
                    address: true,
                  },
                },
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    contact: true,
                    phone: true,
                    email: true,
                  },
                },
              },
              orderBy: { created_at: 'desc' },
            },

            // Complete price history
            price_history: {
              include: {
                created_by_user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: { effective_date: 'desc' },
              take: 10, // Get last 10 price changes
            },

            // Active promotions for this variant
            promotions: {
              where: {
                promotion: {
                  is_active: true,
                  start_date: { lte: new Date() },
                  OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
                },
              },
              include: {
                promotion: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    discount_type: true,
                    discount_value: true,
                    start_date: true,
                    end_date: true,
                    min_purchase: true,
                    branch_specific: true,
                    branches: {
                      include: {
                        branch: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { is_default: 'desc' }, // Default variants first
            { created_at: 'asc' }, // Then by creation order
          ],
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Calculate additional metrics for each variant
    const enrichedProduct = {
      ...product,
      variants: product.variants.map((variant) => {
        // Calculate total stock across all branches
        const totalStock = variant.inventory_items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        // Calculate stock by branch
        const stockByBranch = variant.inventory_items.reduce(
          (acc, item) => {
            const branchName = item.branch?.name || 'Central Inventory';
            acc[branchName] = (acc[branchName] || 0) + item.quantity;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Calculate serial status summary
        const serialsSummary = variant.serials.reduce(
          (acc, serial) => {
            acc[serial.status] = (acc[serial.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Check if stock is low
        const isLowStock =
          variant.alert_quantity &&
          variant.alert_quantity > 0 &&
          totalStock <= variant.alert_quantity;

        // Get current and previous prices
        const currentPrice = variant.price_history[0];
        const previousPrice = variant.price_history[1];

        // Calculate price change percentage
        let priceChangePercentage: number | null = null;
        if (currentPrice && previousPrice) {
          const currentRegular = parseFloat(
            currentPrice.regular_price.toString(),
          );
          const previousRegular = parseFloat(
            previousPrice.regular_price.toString(),
          );
          priceChangePercentage =
            ((currentRegular - previousRegular) / previousRegular) * 100;
        }

        // Get expiring inventory (within 30 days)
        const now = new Date();
        const thirtyDaysFromNow = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        const expiringInventory = variant.inventory_items.filter(
          (item) =>
            item.expiry_date &&
            new Date(item.expiry_date) <= thirtyDaysFromNow &&
            new Date(item.expiry_date) > now,
        );

        return {
          ...variant,
          // Calculated metrics
          total_stock: totalStock,
          stock_by_branch: stockByBranch,
          is_low_stock: isLowStock,
          serials_summary: serialsSummary,
          available_serials_count: serialsSummary.available || 0,
          sold_serials_count: serialsSummary.sold || 0,
          defective_serials_count: serialsSummary.defective || 0,
          returned_serials_count: serialsSummary.returned || 0,
          price_change_percentage: priceChangePercentage,
          has_expiring_inventory: expiringInventory.length > 0,
          expiring_inventory_count: expiringInventory.length,
          expiring_inventory: expiringInventory.map((item) => ({
            batch_number: item.batch_number,
            quantity: item.quantity,
            expiry_date: item.expiry_date,
            branch_name: item.branch?.name || 'Central Inventory',
          })),
        };
      }),
    };

    // Calculate product-level metrics
    const productMetrics = {
      total_variants: enrichedProduct.variants.length,
      total_stock_all_variants: enrichedProduct.variants.reduce(
        (sum, v) => sum + v.total_stock,
        0,
      ),
      total_serials_all_variants: enrichedProduct.variants.reduce(
        (sum, v) => sum + v.serials.length,
        0,
      ),
      available_serials_all_variants: enrichedProduct.variants.reduce(
        (sum, v) => sum + v.available_serials_count,
        0,
      ),
      variants_with_low_stock: enrichedProduct.variants.filter(
        (v) => v.is_low_stock,
      ).length,
      variants_with_expiring_inventory: enrichedProduct.variants.filter(
        (v) => v.has_expiring_inventory,
      ).length,
      has_active_promotions: enrichedProduct.variants.some(
        (v) => v.promotions.length > 0,
      ),
      price_range: {
        min_regular_price: Math.min(
          ...enrichedProduct.variants.map((v) =>
            parseFloat(v.regular_price.toString()),
          ),
        ),
        max_regular_price: Math.max(
          ...enrichedProduct.variants.map((v) =>
            parseFloat(v.regular_price.toString()),
          ),
        ),
      },
    };

    return {
      ...enrichedProduct,
      metrics: productMetrics,
    };
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
          dto.tag_ids.map((tagId) =>
            this.prisma.tagOnProduct.create({
              data: {
                product_id: id,
                tag_id: tagId,
              },
            }),
          ),
        );
      }
    }

    // Update existing variants
    if (dto.variants && dto.variants.length > 0) {
      // Process each variant
      await Promise.all(
        dto.variants.map(async (variantDto) => {
          // If variant has ID, update it
          if ('id' in variantDto && variantDto.id) {
            // In edit mode, preserve inventory by setting the preserve_inventory flag
            const updateVariantDto = dto.is_edit_mode 
              ? { ...variantDto, preserve_inventory: true }
              : variantDto;
            
            await this.variantService.update(variantDto.id, updateVariantDto);
          } else {
            // Create new variant - need to ensure all required fields exist
            if (
              !variantDto.name ||
              !variantDto.regular_price ||
              !variantDto.sale_unit_id ||
              !variantDto.purchase_unit_id
            ) {
              throw new BadRequestException(
                'New variants require all required fields',
              );
            }

            // Safe cast to CreateProductVariantDto since we've verified required fields
            await this.variantService.create(
              id,
              variantDto as unknown as CreateProductVariantDto,
            );
          }
        }),
      );
    }

    // Delete variants if requested
    if (dto.variant_ids_to_delete && dto.variant_ids_to_delete.length > 0) {
      await Promise.all(
        dto.variant_ids_to_delete.map((variantId) =>
          this.variantService.remove(variantId),
        ),
      );
    }

    return this.findOne(id, consumerId);
  }

  async remove(id: number, consumerId: number) {
    // First check if product exists and belongs to this consumer
    await this.findOne(id, consumerId);

    // Soft delete - set deleted_at timestamp
    await this.prisma.product.delete({
      where: { id },
    });

    return { success: true, message: 'Product deleted successfully' };
  }
}
