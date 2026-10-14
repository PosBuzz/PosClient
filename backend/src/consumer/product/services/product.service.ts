import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaxMethod } from '@prisma/client';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductVariantService } from './product-variant.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  constructor(
    private prisma: PrismaService,
    private variantService: ProductVariantService,
  ) {}

  private normalizeExpiryDate(expiryDate?: string): string {
    if (!expiryDate) {
      return '__NO_EXPIRY__';
    }

    const parsed = new Date(expiryDate);
    if (Number.isNaN(parsed.getTime())) {
      return '__NO_EXPIRY__';
    }

    return parsed.toISOString().slice(0, 10);
  }

  private validateBatchExpiryConsistency(dto: CreateProductDto): void {
    dto.variants.forEach((variant, variantIndex) => {
      const batchExpiryMap = new Map<string, { expiry: string; row: number }>();

      (variant.batches || []).forEach((batch, batchIndex) => {
        const batchNumber = (batch.batch_number || '').trim().toUpperCase();

        if (!batchNumber) {
          return;
        }

        const normalizedExpiry = this.normalizeExpiryDate(batch.expiry_date);
        const seen = batchExpiryMap.get(batchNumber);

        if (!seen) {
          batchExpiryMap.set(batchNumber, {
            expiry: normalizedExpiry,
            row: batchIndex + 1,
          });
          return;
        }

        if (seen.expiry !== normalizedExpiry) {
          throw new BadRequestException(
            `Variant ${variantIndex + 1}: batch number "${batch.batch_number}" has different expiry dates in row ${seen.row} and row ${batchIndex + 1}. Same batch number must use the same expiry date.`,
          );
        }
      });
    });
  }

  /**
   * Plans can cap how many products a tenant may hold (Plan.max_products,
   * null = unlimited). Tenants already over the cap keep their data — they just
   * cannot add more.
   */
  async getProductLimit(consumerId: number) {
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: consumerId },
      select: { plan: { select: { name: true, max_products: true } } },
    });

    const used = await this.prisma.product.count({
      where: { consumer_id: consumerId },
    });

    const max = consumer?.plan?.max_products ?? null;

    return {
      plan_name: consumer?.plan?.name ?? null,
      max_products: max,
      used,
      remaining: max === null ? null : Math.max(max - used, 0),
      limit_reached: max !== null && used >= max,
    };
  }

  private async assertProductLimitNotReached(consumerId: number) {
    const limit = await this.getProductLimit(consumerId);

    if (limit.limit_reached) {
      throw new BadRequestException(
        `Product limit reached: your ${limit.plan_name ?? 'current'} plan allows ${limit.max_products} product(s) and you already have ${limit.used}. Upgrade your plan to add more products.`,
      );
    }
  }

  /**
   * Every id the client sends must belong to this tenant. Without this, a
   * product could point at another shop's brand, unit, branch or vendor (and
   * show their names back), or edit and delete another shop's variants.
   */
  private async assertReferencesOwned(
    consumerId: number,
    refs: {
      category_id?: number | null;
      brand_id?: number | null;
      tag_ids?: number[];
      variants?: Array<{
        sale_unit_id?: number;
        purchase_unit_id?: number;
        batches?: Array<{ branch_id?: number; vendor_id?: number | null }>;
      }>;
    },
  ) {
    const unique = (ids: Array<number | null | undefined>) => [
      ...new Set(ids.filter((id): id is number => typeof id === 'number')),
    ];
    const variants = refs.variants ?? [];
    const batches = variants.flatMap((variant) => variant.batches ?? []);
    const owned = (
      ids: number[],
      count: (ids: number[]) => Promise<number>,
      label: string,
    ) =>
      ids.length === 0
        ? Promise.resolve()
        : count(ids).then((found) => {
            if (found !== ids.length) {
              throw new NotFoundException(`${label} not found`);
            }
          });
    const where = { consumer_id: consumerId };

    await owned(
      unique([refs.category_id]),
      (ids) =>
        this.prisma.category.count({ where: { ...where, id: { in: ids } } }),
      'Category',
    );
    await owned(
      unique([refs.brand_id]),
      (ids) =>
        this.prisma.brand.count({ where: { ...where, id: { in: ids } } }),
      'Brand',
    );
    await owned(
      unique(refs.tag_ids ?? []),
      (ids) => this.prisma.tag.count({ where: { ...where, id: { in: ids } } }),
      'Tag',
    );
    await owned(
      unique(
        variants.flatMap((variant) => [
          variant.sale_unit_id,
          variant.purchase_unit_id,
        ]),
      ),
      (ids) => this.prisma.unit.count({ where: { ...where, id: { in: ids } } }),
      'Unit',
    );
    await owned(
      unique(batches.map((batch) => batch.branch_id)),
      (ids) =>
        this.prisma.branch.count({ where: { ...where, id: { in: ids } } }),
      'Branch',
    );
    await owned(
      unique(batches.map((batch) => batch.vendor_id)),
      (ids) =>
        this.prisma.vendor.count({ where: { ...where, id: { in: ids } } }),
      'Vendor',
    );
  }

  async create(
    consumerId: number,
    userId: number | undefined,
    dto: CreateProductDto,
  ) {
    try {
      await this.assertProductLimitNotReached(consumerId);
      await this.assertReferencesOwned(consumerId, dto);

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

      // Ensure same batch number always uses the same expiry date per variant.
      this.validateBatchExpiryConsistency(dto);

      // For simple products, mark the variant as default
      if (!dto.has_variants) {
        dto.variants[0].is_default = true;
      }

      const product = await this.prisma.$transaction(async (prisma) => {
        const createdProduct = await prisma.product.create({
          data: {
            consumer_id: consumerId,
            name: dto.name,
            code: dto.code,
            description: dto.description,
            category_id: dto.category_id,
            brand_id: dto.brand_id,
            has_variants: dto.has_variants,
            tax_method: dto.tax_method || TaxMethod.EXCLUSIVE,
            tax: dto.tax || 0,
          },
        });

        if (dto.tag_ids && dto.tag_ids.length > 0) {
          await Promise.all(
            dto.tag_ids.map((tagId) =>
              prisma.tagOnProduct.create({
                data: {
                  product_id: createdProduct.id,
                  tag_id: tagId,
                },
              }),
            ),
          );
        }

        await Promise.all(
          dto.variants.map((variantDto) =>
            this.variantService.create(
              createdProduct.id,
              userId,
              variantDto,
              prisma,
              false,
            ),
          ),
        );

        return createdProduct;
      });

      return await this.findOne(product.id, consumerId);
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error creating product for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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
          {
            variants: {
              some: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as any } },
                  { sku: { contains: search, mode: 'insensitive' as any } },
                  { barcode: { contains: search, mode: 'insensitive' as any } },
                ],
              },
            },
          },
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
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error fetching products for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
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
                },
              },
              purchase_unit: {
                select: {
                  id: true,
                  name: true,
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
          const isLowStock = Boolean(
            variant.alert_quantity &&
              variant.alert_quantity > 0 &&
              totalStock <= variant.alert_quantity,
          );

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
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error finding product with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateProductDto,
    consumerId: number,
    userId: number | undefined,
  ) {
    try {
      // First check if product exists and belongs to this consumer
      await this.findOne(id, consumerId);
      await this.assertReferencesOwned(consumerId, dto);

      // Variants may only be edited or deleted through the product they belong to
      const ownVariantIds = new Set(
        (
          await this.prisma.productVariant.findMany({
            where: { product_id: id },
            select: { id: true },
          })
        ).map((variant) => variant.id),
      );
      const touchedVariantIds = [
        ...(dto.variants ?? []).flatMap((variant) =>
          'id' in variant && variant.id ? [variant.id] : [],
        ),
        ...(dto.variant_ids_to_delete ?? []),
      ];
      const foreignVariant = touchedVariantIds.find(
        (variantId) => !ownVariantIds.has(variantId),
      );
      if (foreignVariant !== undefined) {
        throw new NotFoundException(
          `Product variant with ID ${foreignVariant} not found`,
        );
      }

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
                userId,
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

      return await this.findOne(id, consumerId);
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error updating product with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      // First check if product exists and belongs to this consumer
      await this.findOne(id, consumerId);

      await this.prisma.product.delete({
        where: { id },
      });

      return { success: true, message: 'Product deleted successfully' };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error deleting product with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
