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
import { Prisma } from '@prisma/client';
import { errorStack } from '../../../common/utils/error.util';

@Injectable()
export class ProductVariantService {
  private readonly logger = new Logger(ProductVariantService.name);
  constructor(private prisma: PrismaService) {}

  async create(
    productId: number,
    userId: number | undefined,
    dto: CreateProductVariantDto,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    returnHydrated = true,
  ) {
    try {
      // Create the variant
      const variant = await prisma.productVariant.create({
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
          daily_sale_objective: dto.daily_sale_objective || 0,
        },
        include: {
          product: {
            select: { consumer_id: true },
          },
        },
      });

      // Create initial price history record
      await prisma.priceHistory.create({
        data: {
          variant_id: variant.id,
          regular_price: dto.regular_price,
          wholesale_price: dto.wholesale_price,
        },
      });

      // Create variant attributes if provided
      if (dto.attributes && dto.attributes.length > 0) {
        await prisma.variantAttribute.createMany({
          data: dto.attributes.map((attr) => ({
            variant_id: variant.id,
            consumer_id: variant.product.consumer_id,
            name: attr.name,
            value: attr.value,
          })),
          skipDuplicates: true,
        });
      }

      // Create serial numbers if provided
      if (dto.serials && dto.serials.length > 0) {
        await prisma.productSerial.createMany({
          data: dto.serials.map((serialDto) => ({
            variant_id: variant.id,
            serial_number: serialDto.serial_number,
            status: serialDto.status || 'available',
            notes: serialDto.notes,
          })),
          skipDuplicates: true,
        });
      }

      // Create inventory batches if provided + AUDIT LOGS
      if (dto.batches && dto.batches.length > 0) {
        for (const batchDto of dto.batches) {
          try {
            // Determine payment status and paid amount
            const totalCost = Number(batchDto.cost_price) * batchDto.quantity;
            let paidAmount = 0;
            let paymentStatus = 'paid';

            if (batchDto.payments && batchDto.payments.length > 0) {
              paidAmount = batchDto.payments.reduce(
                (sum, p) => sum + Number(p.amount),
                0,
              );
              if (paidAmount >= totalCost) {
                paymentStatus = 'paid';
              } else if (paidAmount > 0) {
                paymentStatus = 'partial';
              } else {
                paymentStatus = 'due';
              }
            }

            // 1. Create the batch and capture the result
            const newBatch = await prisma.inventoryBatch.create({
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
                payment_status: paymentStatus,
                paid_amount:
                  paymentStatus === 'paid' && !batchDto.payments?.length
                    ? totalCost
                    : paidAmount,
              },
            });

            // 2. Create Audit Log for the initial stock
            if (batchDto.quantity > 0) {
              await prisma.inventoryAuditLog.create({
                data: {
                  consumer_id: variant.product.consumer_id,
                  branch_id: batchDto.branch_id,
                  variant_id: variant.id,
                  batch_id: newBatch.id,
                  inventoryBatchId: newBatch.id,
                  event_type: 'PURCHASE_IN',
                  quantity_delta: batchDto.quantity,
                  quantity_after: newBatch.quantity,
                  reference_id: newBatch.id,
                  reference_type: 'inventory_batches',
                  notes: `Initial stock added via variant creation`,
                  created_by_user_id: userId, // Will be null if not provided by controller
                },
              });
            }

            // 3. Create purchase payment records if provided
            if (batchDto.payments && batchDto.payments.length > 0) {
              await Promise.all(
                batchDto.payments.map((payment) =>
                  prisma.purchasePayment.create({
                    data: {
                      batch_id: newBatch.id,
                      payment_method: payment.payment_method,
                      payment_type: (payment.payment_type as any) || null,
                      amount: payment.amount,
                      reference: payment.reference || null,
                    },
                  }),
                ),
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to create batch ${batchDto.batch_number}:`,
              error instanceof Error ? errorStack(error) : error,
            );
            throw error;
          }
        }
      }

      if (!returnHydrated) {
        return variant;
      }

      return this.findOne(variant.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating product variant for ${productId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId?: number) {
    try {
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
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error finding product variant with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, dto: UpdateProductVariantDto) {
    try {
      await this.findOne(id);

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

      const _updatedVariant = await this.prisma.productVariant.update({
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
          daily_sale_objective: dto.daily_sale_objective,
        },
      });

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

      if (dto.attributes !== undefined) {
        await this.prisma.variantAttribute.deleteMany({
          where: { variant_id: id },
        });

        if (dto.attributes.length > 0) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id },
            select: {
              product: {
                select: { consumer_id: true },
              },
            },
          });

          if (!variant) {
            throw new NotFoundException(
              `Product variant with ID ${id} not found`,
            );
          }

          await this.prisma.variantAttribute.createMany({
            data: dto.attributes.map((attr) => ({
              variant_id: id,
              consumer_id: variant.product.consumer_id,
              name: attr.name,
              value: attr.value,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.serials !== undefined) {
        if (dto.preserve_inventory) {
          const existingSerials = await this.prisma.productSerial.findMany({
            where: { variant_id: id },
          });

          const serialsWithId = dto.serials.filter((s) => s.id);
          const serialsWithoutId = dto.serials.filter((s) => !s.id);

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
      }

      const _variant = await this.prisma.productVariant.findUnique({
        where: { id },
        select: {
          product_id: true,
          product: { select: { consumer_id: true } },
        },
      });

      return this.findOne(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error updating product variant with ID ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number) {
    try {
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

      await this.prisma.productVariant.delete({
        where: { id },
      });

      return { success: true, message: 'Variant deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error deleting product variant with ID ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete product variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
