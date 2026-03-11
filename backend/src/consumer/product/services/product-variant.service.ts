import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';

@Injectable()
export class ProductVariantService {
  private readonly logger = new Logger(ProductVariantService.name);
  constructor(private prisma: PrismaService) {}

  async create(productId: number, dto: CreateProductVariantDto) {
    try {
      // Create the variant
      const variant = await this.prisma.productVariant.create({
        data: {
          product_id: productId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
          regular_price: dto.regular_price,
          wholesale_price: dto.wholesale_price,
          sale_unit_id: dto.sale_unit_id,
          purchase_unit_id: dto.purchase_unit_id,
          warranty_period: dto.warranty_period,
          image: dto.image,
          is_default: dto.is_default || false,
          alert_quantity: dto.alert_quantity || 0,
        },
      });

      // Create initial price history record
      await this.prisma.priceHistory.create({
        data: {
          variant_id: variant.id,
          regular_price: dto.regular_price,
          wholesale_price: dto.wholesale_price,
        },
      });

      // Create variant attributes if provided
      if (dto.attributes && dto.attributes.length > 0) {
        // Use createMany with skipDuplicates to handle concurrent requests
        await this.prisma.variantAttribute.createMany({
          data: dto.attributes.map((attr) => ({
            variant_id: variant.id,
            name: attr.name,
            value: attr.value,
          })),
          skipDuplicates: true, // Skip if the same variant_id + name combination already exists
        });
      }

      // Create serial numbers if provided
      if (dto.serials && dto.serials.length > 0) {
        // Use createMany with skipDuplicates to handle concurrent requests
        await this.prisma.productSerial.createMany({
          data: dto.serials.map((serialDto) => ({
            variant_id: variant.id,
            serial_number: serialDto.serial_number,
            status: serialDto.status || 'available',
            notes: serialDto.notes,
          })),
          skipDuplicates: true, // Skip if the same variant_id + serial_number already exists
        });
      }

      // Create inventory batches if provided
      if (dto.batches && dto.batches.length > 0) {
        // Use individual creates for batches since we want to capture any errors
        // and batches don't have a unique constraint to skip
        for (const batchDto of dto.batches) {
          try {
            await this.prisma.inventoryBatch.create({
              data: {
                variant_id: variant.id,
                branch_id: batchDto.branch_id,
                batch_number: batchDto.batch_number,
                quantity: batchDto.quantity,
                cost_price: batchDto.cost_price,
                vendor_id: batchDto.vendor_id,
                expiry_date: batchDto.expiry_date
                  ? new Date(batchDto.expiry_date)
                  : null,
              },
            });
          } catch (error) {
            // Log the error but continue with other batches
            console.error(
              `Failed to create batch ${batchDto.batch_number}:`,
              error,
            );
          }
        }
      } // Invalidate caches for this consumer
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { consumer_id: true },
      });

      return this.findOne(variant.id);
    } catch (error) {
      this.logger.error(
        `Error creating product variant for ${productId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to create product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findOne(id: number, consumerId?: number) {
    try {
      // Get consumer ID if not provided
      if (!consumerId) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id },
          select: { product: { select: { consumer_id: true } } },
        });
        consumerId = variant?.product.consumer_id;
        if (!consumerId) {
          throw new NotFoundException(
            `Product variant with ID ${id} not found`,
          );
        }
      }

      const variant = await this.prisma.productVariant.findUnique({
        where: { id },
        include: {
          sale_unit: true,
          purchase_unit: true,
          VariantAttribute: true,
          serials: {
            orderBy: { created_at: 'desc' },
          },
          price_history: {
            take: 1,
            orderBy: { effective_date: 'desc' },
          },
          inventory_items: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!variant) {
        throw new NotFoundException(`Product variant with ID ${id} not found`);
      }

      // Calculate total stock and add alert status
      const totalStock = variant.inventory_items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const isLowStock =
        variant.alert_quantity &&
        variant.alert_quantity > 0 &&
        totalStock <= variant.alert_quantity;

      return {
        ...variant,
        total_stock: totalStock,
        is_low_stock: isLowStock,
        available_serials_count: variant.serials.filter(
          (s) => s.status === 'available',
        ).length,
      };
    } catch (error) {
      this.logger.error(
        `Error finding product variant with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to find product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, dto: UpdateProductVariantDto) {
    try {
      // First check if variant exists
      await this.findOne(id);

      // Get current prices to check if they've changed
      const currentVariant = await this.prisma.productVariant.findUnique({
        where: { id },
        select: {
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
          regular_price: dto.regular_price,
          wholesale_price: dto.wholesale_price,
          sale_unit_id: dto.sale_unit_id,
          purchase_unit_id: dto.purchase_unit_id,
          warranty_period: dto.warranty_period,
          image: dto.image,
          is_default: dto.is_default,
          alert_quantity: dto.alert_quantity,
        },
      });

      // Create new price history if prices changed
      const priceChanged =
        (dto.regular_price &&
          dto.regular_price !== currentVariant.regular_price.toString()) ||
        (dto.wholesale_price &&
          dto.wholesale_price !==
            (currentVariant.wholesale_price
              ? currentVariant.wholesale_price.toString()
              : undefined));

      if (priceChanged) {
        await this.prisma.priceHistory.create({
          data: {
            variant_id: id,
            regular_price:
              dto.regular_price || currentVariant.regular_price.toString(),
            wholesale_price:
              dto.wholesale_price || currentVariant.wholesale_price?.toString(),
          },
        });
      }

      // Update attributes if provided
      if (dto.attributes !== undefined) {
        // Delete existing attributes
        await this.prisma.variantAttribute.deleteMany({
          where: { variant_id: id },
        });

        // Create new attributes if any provided
        if (dto.attributes.length > 0) {
          await this.prisma.variantAttribute.createMany({
            data: dto.attributes.map((attr) => ({
              variant_id: id,
              name: attr.name,
              value: attr.value,
            })),
            skipDuplicates: true,
          });
        }
      } // Handle serial number updates properly for edit mode
      if (dto.serials !== undefined) {
        if (dto.preserve_inventory) {
          // In edit mode, handle serials intelligently
          const existingSerials = await this.prisma.productSerial.findMany({
            where: { variant_id: id },
          });

          // Separate new and existing serials
          const serialsWithId = dto.serials.filter((s) => s.id);
          const serialsWithoutId = dto.serials.filter((s) => !s.id);

          // Update existing serials
          if (serialsWithId.length > 0) {
            await Promise.all(
              serialsWithId.map((serialDto) =>
                this.prisma.productSerial.update({
                  where: { id: serialDto.id },
                  data: {
                    serial_number: serialDto.serial_number,
                    status: serialDto.status || 'available',
                    notes: serialDto.notes,
                  },
                }),
              ),
            );
          }

          // Create new serials
          if (serialsWithoutId.length > 0) {
            await this.prisma.productSerial.createMany({
              data: serialsWithoutId.map((serialDto) => ({
                variant_id: id,
                serial_number: serialDto.serial_number,
                status: serialDto.status || 'available',
                notes: serialDto.notes,
              })),
              skipDuplicates: true,
            });
          }

          // Delete serials that are no longer present
          const incomingSerialIds = serialsWithId
            .map((s) => s.id)
            .filter(Boolean);
          const serialsToDelete = existingSerials.filter(
            (existing) => !incomingSerialIds.includes(existing.id),
          );

          if (serialsToDelete.length > 0) {
            await this.prisma.productSerial.deleteMany({
              where: {
                id: { in: serialsToDelete.map((s) => s.id) },
              },
            });
          }
        } else {
          // Non-edit mode: delete all and recreate (original behavior)
          await this.prisma.productSerial.deleteMany({
            where: { variant_id: id },
          });

          if (dto.serials.length > 0) {
            await this.prisma.productSerial.createMany({
              data: dto.serials.map((serialDto) => ({
                variant_id: id,
                serial_number: serialDto.serial_number,
                status: serialDto.status || 'available',
                notes: serialDto.notes,
              })),
              skipDuplicates: true,
            });
          }
        }
      } // Get consumer ID for cache invalidation
      const variant = await this.prisma.productVariant.findUnique({
        where: { id },
        select: {
          product_id: true,
          product: { select: { consumer_id: true } },
        },
      });

      return this.findOne(id);
    } catch (error) {
      this.logger.error(
        `Error updating product variant with ID ${id}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to update product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async remove(id: number) {
    try {
      // First check if variant exists and get consumer ID
      const variant = await this.prisma.productVariant.findUnique({
        where: { id },
        select: {
          product_id: true,
          product: { select: { consumer_id: true } },
        },
      });

      if (!variant) {
        throw new NotFoundException(`Product variant with ID ${id} not found`);
      }

      // Delete the variant (cascades to attributes and price history)
      await this.prisma.productVariant.delete({
        where: { id },
      });

      return { success: true, message: 'Variant deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting product variant with ID ${id}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
