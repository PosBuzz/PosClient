import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { errorMessage, errorStack } from 'src/common/utils/error.util';
import {
  ConsumerImportDuplicateStrategy,
  ConsumerImportSection,
  PreviewConsumerDataImportDto,
  RunConsumerDataImportDto,
} from '../dto/consumer-data-import.dto';
import { isClientError } from '../../../common/errors/client-error';

type ImportAction = 'created' | 'updated' | 'skipped' | 'conflicts';
type ImportSummary = Record<
  string,
  { created: number; updated: number; skipped: number; conflicts: number }
>;

const emptyCounts = () => ({
  created: 0,
  updated: 0,
  skipped: 0,
  conflicts: 0,
});

@Injectable()
export class ConsumerDataImportService {
  private readonly logger = new Logger(ConsumerDataImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async validateConsumers(sourceId: number, targetId: number) {
    if (sourceId === targetId) {
      throw new BadRequestException(
        'Source and destination accounts must be different',
      );
    }

    const [source, target] = await Promise.all([
      this.prisma.consumer.findFirst({
        where: { id: sourceId, deleted_at: null },
        select: { id: true, company_name: true, subdomain: true },
      }),
      this.prisma.consumer.findFirst({
        where: { id: targetId, deleted_at: null },
        select: {
          id: true,
          company_name: true,
          subdomain: true,
          max_branch: true,
          plan: { select: { name: true, max_products: true } },
        },
      }),
    ]);

    if (!source) throw new NotFoundException('Source account not found');
    if (!target) throw new NotFoundException('Destination account not found');

    return { source, target };
  }

  async preview(dto: PreviewConsumerDataImportDto) {
    const { source, target } = await this.validateConsumers(
      dto.source_consumer_id,
      dto.target_consumer_id,
    );
    const selected = new Set(dto.sections);
    const counts: Record<string, number> = {};

    await Promise.all([
      selected.has(ConsumerImportSection.BRANCHES)
        ? this.prisma.branch
            .count({ where: { consumer_id: source.id } })
            .then((count) => (counts.branches = count))
        : Promise.resolve(),
      selected.has(ConsumerImportSection.VENDORS)
        ? this.prisma.vendor
            .count({ where: { consumer_id: source.id } })
            .then((count) => (counts.vendors = count))
        : Promise.resolve(),
      selected.has(ConsumerImportSection.CUSTOMERS)
        ? this.prisma.customer
            .count({ where: { consumer_id: source.id } })
            .then((count) => (counts.customers = count))
        : Promise.resolve(),
      selected.has(ConsumerImportSection.PRODUCTS)
        ? Promise.all([
            this.prisma.product.count({ where: { consumer_id: source.id } }),
            this.prisma.productVariant.count({
              where: { product: { consumer_id: source.id } },
            }),
            this.prisma.unit.count({ where: { consumer_id: source.id } }),
            this.prisma.category.count({ where: { consumer_id: source.id } }),
            this.prisma.brand.count({ where: { consumer_id: source.id } }),
            this.prisma.tag.count({ where: { consumer_id: source.id } }),
          ]).then(([products, variants, units, categories, brands, tags]) =>
            Object.assign(counts, {
              products,
              product_variants: variants,
              units,
              categories,
              brands,
              tags,
            }),
          )
        : Promise.resolve(),
      selected.has(ConsumerImportSection.INVENTORY)
        ? this.prisma.inventoryBatch
            .count({
              where: {
                branch: { consumer_id: source.id },
              },
            })
            .then((count) => (counts.inventory_batches = count))
        : Promise.resolve(),
    ]);

    return {
      source,
      target,
      sections: dto.sections,
      counts,
      rules: {
        direction: 'ONE_WAY_SNAPSHOT',
        repeated_imports: 'Previously mapped records are reused',
        products:
          'Includes catalog dependencies, variants, tags and attributes; excludes stock and transaction history',
        inventory:
          'Includes inventory batches and current stock; requires Products and Branches to be selected in the same import',
        customers:
          'Includes customer profiles; excludes sales and rewards history',
        branches:
          'The destination main branch is preserved; imported branches never become the main branch',
      },
    };
  }

  async history(limit = 50) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 50;
    return this.prisma.consumerDataImport.findMany({
      take: safeLimit,
      orderBy: { created_at: 'desc' },
      include: {
        source: { select: { id: true, company_name: true, subdomain: true } },
        target: { select: { id: true, company_name: true, subdomain: true } },
        requested_by: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async run(dto: RunConsumerDataImportDto, requestedById?: number) {
    const { source, target } = await this.validateConsumers(
      dto.source_consumer_id,
      dto.target_consumer_id,
    );

    if (dto.confirm_target_subdomain !== target.subdomain) {
      throw new BadRequestException(
        `Confirmation failed: expected destination subdomain '${target.subdomain}'`,
      );
    }

    const job = await this.prisma.consumerDataImport.create({
      data: {
        source_consumer_id: source.id,
        target_consumer_id: target.id,
        requested_by_id: requestedById ?? null,
        sections: dto.sections,
        duplicate_strategy: dto.duplicate_strategy,
      },
    });

    try {
      const summary = await this.prisma.$transaction(
        async (tx) => this.importWithinTransaction(tx, dto),
        {
          timeout: 120_000,
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      );

      return await this.prisma.consumerDataImport.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          summary,
          completed_at: new Date(),
        },
        include: {
          source: { select: { id: true, company_name: true, subdomain: true } },
          target: { select: { id: true, company_name: true, subdomain: true } },
        },
      });
    } catch (error) {
      await this.prisma.consumerDataImport.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error_message: errorMessage(error).slice(0, 4000),
          completed_at: new Date(),
        },
      });
      this.logger.error(
        `Account data import ${job.id} failed`,
        errorStack(error),
      );
      if (isClientError(error)) throw error;
      throw new BadRequestException(
        `Import failed without changing destination data: ${errorMessage(error)}`,
      );
    }
  }

  private async importWithinTransaction(
    tx: Prisma.TransactionClient,
    dto: RunConsumerDataImportDto,
  ): Promise<ImportSummary> {
    const sourceId = dto.source_consumer_id;
    const targetId = dto.target_consumer_id;
    const strategy = dto.duplicate_strategy;
    const selected = new Set(dto.sections);
    const summary: ImportSummary = {};

    // Serialize imports into one destination. This closes the race between
    // duplicate checks, plan-limit checks, and inserts.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${targetId})`;

    const mappings = await tx.consumerImportMapping.findMany({
      where: {
        source_consumer_id: sourceId,
        target_consumer_id: targetId,
      },
    });
    const mappingCache = new Map(
      mappings.map((mapping) => [
        `${mapping.entity_type}:${mapping.source_record_id}`,
        mapping.target_record_id,
      ]),
    );
    const targetMappingCache = new Map(
      mappings.map((mapping) => [
        `${mapping.entity_type}:${mapping.target_record_id}`,
        mapping.source_record_id,
      ]),
    );

    const mappedId = (entity: string, sourceRecordId: number) =>
      mappingCache.get(`${entity}:${sourceRecordId}`);

    const saveMapping = async (
      entity: string,
      sourceRecordId: number,
      targetRecordId: number,
    ) => {
      const targetKey = `${entity}:${targetRecordId}`;
      const existingSource = targetMappingCache.get(targetKey);
      if (existingSource && existingSource !== sourceRecordId) {
        throw new BadRequestException(
          `Cannot safely merge two source ${entity} records into destination record ${targetRecordId}`,
        );
      }
      const previousTarget = mappedId(entity, sourceRecordId);
      await tx.consumerImportMapping.upsert({
        where: {
          source_consumer_id_target_consumer_id_entity_type_source_record_id: {
            source_consumer_id: sourceId,
            target_consumer_id: targetId,
            entity_type: entity,
            source_record_id: sourceRecordId,
          },
        },
        create: {
          source_consumer_id: sourceId,
          target_consumer_id: targetId,
          entity_type: entity,
          source_record_id: sourceRecordId,
          target_record_id: targetRecordId,
        },
        update: { target_record_id: targetRecordId },
      });
      if (previousTarget && previousTarget !== targetRecordId) {
        targetMappingCache.delete(`${entity}:${previousTarget}`);
      }
      mappingCache.set(`${entity}:${sourceRecordId}`, targetRecordId);
      targetMappingCache.set(targetKey, sourceRecordId);
    };

    const count = (entity: string, action: ImportAction) => {
      summary[entity] ??= emptyCounts();
      summary[entity][action] += 1;
    };

    if (selected.has(ConsumerImportSection.BRANCHES)) {
      const sourceBranches = await tx.branch.findMany({
        where: { consumer_id: sourceId },
        orderBy: { id: 'asc' },
      });
      const targetBranches = await tx.branch.findMany({
        where: { consumer_id: targetId },
      });
      const targetById = new Map(targetBranches.map((row) => [row.id, row]));
      const targetByName = new Map(
        targetBranches.map((row) => [row.name, row]),
      );
      const newCount = sourceBranches.filter((row) => {
        const mapped = mappedId('branch', row.id);
        return !(
          (mapped && targetById.has(mapped)) ||
          targetByName.has(row.name)
        );
      }).length;
      const targetConsumer = await tx.consumer.findUniqueOrThrow({
        where: { id: targetId },
        select: { max_branch: true },
      });
      if (targetBranches.length + newCount > targetConsumer.max_branch) {
        throw new BadRequestException(
          `Branch limit exceeded: destination allows ${targetConsumer.max_branch}, has ${targetBranches.length}, and this import needs ${newCount} more`,
        );
      }

      for (const source of sourceBranches) {
        const mapped = mappedId('branch', source.id);
        let target = mapped ? targetById.get(mapped) : undefined;
        const naturalTarget = targetByName.get(source.name);
        if (target && naturalTarget && naturalTarget.id !== target.id) {
          count('branches', 'conflicts');
          continue;
        }
        target ??= naturalTarget;
        if (target) {
          await saveMapping('branch', source.id, target.id);
          if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
            const previousName = target.name;
            target = await tx.branch.update({
              where: { id: target.id },
              data: {
                name: source.name,
                address: source.address,
                email: source.email,
                phone: source.phone,
                vat_registration_number: source.vat_registration_number,
                is_warehouse: source.is_warehouse,
                // Never replace or create the destination's main branch.
              },
            });
            if (targetByName.get(previousName)?.id === target.id) {
              targetByName.delete(previousName);
            }
            targetById.set(target.id, target);
            targetByName.set(target.name, target);
            count('branches', 'updated');
          } else count('branches', 'skipped');
          continue;
        }

        target = await tx.branch.create({
          data: {
            consumer_id: targetId,
            name: source.name,
            address: source.address,
            email: source.email,
            phone: source.phone,
            vat_registration_number: source.vat_registration_number,
            is_main: false,
            is_warehouse: source.is_warehouse,
            created_at: source.created_at,
          },
        });
        targetById.set(target.id, target);
        targetByName.set(target.name, target);
        await saveMapping('branch', source.id, target.id);
        count('branches', 'created');
      }
    }

    if (selected.has(ConsumerImportSection.VENDORS)) {
      const rows = await tx.vendor.findMany({
        where: { consumer_id: sourceId },
        orderBy: { id: 'asc' },
      });
      for (const source of rows) {
        const mapped = mappedId('vendor', source.id);
        let target = mapped
          ? await tx.vendor.findFirst({
              where: { id: mapped, consumer_id: targetId },
            })
          : null;
        const naturalTarget = await tx.vendor.findUnique({
          where: {
            consumer_id_name: { consumer_id: targetId, name: source.name },
          },
        });
        if (target && naturalTarget && naturalTarget.id !== target.id) {
          count('vendors', 'conflicts');
          continue;
        }
        target ??= naturalTarget;
        if (target) {
          await saveMapping('vendor', source.id, target.id);
          if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
            await tx.vendor.update({
              where: { id: target.id },
              data: {
                name: source.name,
                contact: source.contact,
                phone: source.phone,
                email: source.email,
                address: source.address,
              },
            });
            count('vendors', 'updated');
          } else count('vendors', 'skipped');
        } else {
          target = await tx.vendor.create({
            data: {
              consumer_id: targetId,
              name: source.name,
              contact: source.contact,
              phone: source.phone,
              email: source.email,
              address: source.address,
              created_at: source.created_at,
            },
          });
          await saveMapping('vendor', source.id, target.id);
          count('vendors', 'created');
        }
      }
    }

    if (selected.has(ConsumerImportSection.CUSTOMERS)) {
      const rows = await tx.customer.findMany({
        where: { consumer_id: sourceId },
        orderBy: { id: 'asc' },
      });
      for (const source of rows) {
        const mapped = mappedId('customer', source.id);
        let target = mapped
          ? await tx.customer.findFirst({
              where: { id: mapped, consumer_id: targetId },
            })
          : null;
        const naturalTarget = await tx.customer.findUnique({
          where: {
            consumer_id_phone: {
              consumer_id: targetId,
              phone: source.phone,
            },
          },
        });
        if (target && naturalTarget && naturalTarget.id !== target.id) {
          count('customers', 'conflicts');
          continue;
        }
        target ??= naturalTarget;
        if (target) {
          await saveMapping('customer', source.id, target.id);
          if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
            await tx.customer.update({
              where: { id: target.id },
              data: {
                name: source.name,
                email: source.email,
                phone: source.phone,
                address: source.address,
                birthday: source.birthday,
                customer_type: source.customer_type,
              },
            });
            count('customers', 'updated');
          } else count('customers', 'skipped');
        } else {
          target = await tx.customer.create({
            data: {
              consumer_id: targetId,
              name: source.name,
              email: source.email,
              phone: source.phone,
              address: source.address,
              birthday: source.birthday,
              customer_type: source.customer_type,
              created_at: source.created_at,
            },
          });
          await saveMapping('customer', source.id, target.id);
          count('customers', 'created');
        }
      }
    }

    if (selected.has(ConsumerImportSection.PRODUCTS)) {
      await this.importProducts({
        tx,
        sourceId,
        targetId,
        strategy,
        mappedId,
        saveMapping,
        count,
      });
    }

    if (selected.has(ConsumerImportSection.INVENTORY)) {
      if (
        !selected.has(ConsumerImportSection.PRODUCTS) ||
        !selected.has(ConsumerImportSection.BRANCHES)
      ) {
        throw new BadRequestException(
          'Inventory import requires Products and Branches to be selected',
        );
      }
      await this.importInventory({
        tx,
        sourceId,
        targetId,
        strategy,
        mappedId,
        saveMapping,
        count,
      });
    }

    return summary;
  }

  private async importInventory(context: {
    tx: Prisma.TransactionClient;
    sourceId: number;
    targetId: number;
    strategy: ConsumerImportDuplicateStrategy;
    mappedId: (entity: string, sourceRecordId: number) => number | undefined;
    saveMapping: (
      entity: string,
      sourceRecordId: number,
      targetRecordId: number,
    ) => Promise<void>;
    count: (entity: string, action: ImportAction) => void;
  }) {
    const { tx, sourceId, targetId, strategy, mappedId, saveMapping, count } =
      context;
    const sourceBatches = await tx.inventoryBatch.findMany({
      where: { branch: { consumer_id: sourceId } },
      orderBy: { id: 'asc' },
    });
    const targetBatches = await tx.inventoryBatch.findMany({
      where: { branch: { consumer_id: targetId } },
    });

    for (const source of sourceBatches) {
      const targetVariantId = mappedId('product_variant', source.variant_id);
      const targetBranchId = mappedId('branch', source.branch_id);
      const targetVendorId = source.vendor_id
        ? mappedId('vendor', source.vendor_id)
        : undefined;

      if (!targetVariantId || !targetBranchId) {
        throw new BadRequestException(
          `Inventory batch '${source.batch_number}' is missing its imported product variant or branch relationship`,
        );
      }
      if (source.vendor_id && !targetVendorId) {
        throw new BadRequestException(
          `Inventory batch '${source.batch_number}' is missing its imported vendor relationship`,
        );
      }

      const mapped = mappedId('inventory_batch', source.id);
      let target = mapped
        ? targetBatches.find((row) => row.id === mapped)
        : undefined;
      const naturalTarget = targetBatches.find(
        (row) =>
          row.batch_number === source.batch_number &&
          row.variant_id === targetVariantId &&
          row.branch_id === targetBranchId,
      );

      if (target && naturalTarget && naturalTarget.id !== target.id) {
        count('inventory_batches', 'conflicts');
        continue;
      }
      target ??= naturalTarget;

      const batchData = {
        variant_id: targetVariantId,
        branch_id: targetBranchId,
        batch_number: source.batch_number,
        quantity: source.quantity,
        reserved_quantity: source.reserved_quantity,
        cost_price: source.cost_price,
        vendor_id: targetVendorId ?? null,
        location: source.location,
        expiry_date: source.expiry_date,
        payment_status: source.payment_status,
        paid_amount: source.paid_amount,
      };

      if (target) {
        await saveMapping('inventory_batch', source.id, target.id);
        if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
          const previousQuantity = target.quantity;
          target = await tx.inventoryBatch.update({
            where: { id: target.id },
            data: batchData,
          });
          // Stock only moves with an audit row, or the ledger stops adding up
          if (target.quantity !== previousQuantity) {
            await tx.inventoryAuditLog.create({
              data: {
                consumer_id: targetId,
                branch_id: targetBranchId,
                variant_id: targetVariantId,
                batch_id: target.id,
                inventoryBatchId: target.id,
                event_type: 'ADJUSTMENT',
                quantity_delta: target.quantity - previousQuantity,
                quantity_after: target.quantity,
                reference_id: target.id,
                reference_type: 'inventory_batches',
                notes: `Quantity set by account data import from account #${sourceId}`,
              },
            });
          }
          count('inventory_batches', 'updated');
        } else {
          count('inventory_batches', 'skipped');
        }
      } else {
        target = await tx.inventoryBatch.create({
          data: {
            ...batchData,
            created_at: source.created_at,
          },
        });
        if (target.quantity > 0) {
          await tx.inventoryAuditLog.create({
            data: {
              consumer_id: targetId,
              branch_id: targetBranchId,
              variant_id: targetVariantId,
              batch_id: target.id,
              inventoryBatchId: target.id,
              event_type: 'PURCHASE_IN',
              quantity_delta: target.quantity,
              quantity_after: target.quantity,
              reference_id: target.id,
              reference_type: 'inventory_batches',
              notes: `Stock copied by account data import from account #${sourceId}`,
            },
          });
        }
        await saveMapping('inventory_batch', source.id, target.id);
        targetBatches.push(target);
        count('inventory_batches', 'created');
      }
    }
  }

  private async importProducts(context: {
    tx: Prisma.TransactionClient;
    sourceId: number;
    targetId: number;
    strategy: ConsumerImportDuplicateStrategy;
    mappedId: (entity: string, sourceRecordId: number) => number | undefined;
    saveMapping: (
      entity: string,
      sourceRecordId: number,
      targetRecordId: number,
    ) => Promise<void>;
    count: (entity: string, action: ImportAction) => void;
  }) {
    const { tx, sourceId, targetId, strategy, mappedId, saveMapping, count } =
      context;

    const copyNamedDependency = async (
      entity: 'unit' | 'category' | 'brand' | 'tag',
      rows: any[],
      client: any,
      extraData: (source: any) => Record<string, unknown> = () => ({}),
    ) => {
      const ids = new Map<number, number>();
      const summaryName = entity === 'category' ? 'categories' : `${entity}s`;
      for (const source of rows) {
        const mapped = mappedId(entity, source.id);
        let target = mapped
          ? await client.findFirst({
              where: { id: mapped, consumer_id: targetId },
            })
          : null;
        const naturalTarget = await client.findUnique({
          where: {
            consumer_id_name: { consumer_id: targetId, name: source.name },
          },
        });
        if (target && naturalTarget && naturalTarget.id !== target.id) {
          throw new BadRequestException(
            `Cannot safely import product ${entity} '${source.name}': its previous mapping and destination name point to different records`,
          );
        }
        target ??= naturalTarget;
        if (target) {
          await saveMapping(entity, source.id, target.id);
          if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
            target = await client.update({
              where: { id: target.id },
              data: { name: source.name, ...extraData(source) },
            });
            count(summaryName, 'updated');
          } else count(summaryName, 'skipped');
        } else {
          target = await client.create({
            data: {
              consumer_id: targetId,
              name: source.name,
              ...extraData(source),
              created_at: source.created_at,
            },
          });
          await saveMapping(entity, source.id, target.id);
          count(summaryName, 'created');
        }
        ids.set(source.id, target.id);
      }
      return ids;
    };

    const [units, categories, brands, tags, sourceProducts] = await Promise.all(
      [
        tx.unit.findMany({
          where: { consumer_id: sourceId },
          orderBy: { id: 'asc' },
        }),
        tx.category.findMany({
          where: { consumer_id: sourceId },
          orderBy: { id: 'asc' },
        }),
        tx.brand.findMany({
          where: { consumer_id: sourceId },
          orderBy: { id: 'asc' },
        }),
        tx.tag.findMany({
          where: { consumer_id: sourceId },
          orderBy: { id: 'asc' },
        }),
        tx.product.findMany({
          where: { consumer_id: sourceId },
          orderBy: { id: 'asc' },
          include: {
            tags: true,
            variants: {
              orderBy: { id: 'asc' },
              include: { VariantAttribute: { orderBy: { id: 'asc' } } },
            },
          },
        }),
      ],
    );

    const unitIds = await copyNamedDependency('unit', units, tx.unit);
    const categoryIds = await copyNamedDependency(
      'category',
      categories,
      tx.category,
    );
    const brandIds = await copyNamedDependency(
      'brand',
      brands,
      tx.brand,
      (source) => ({ logo: source.logo, website: source.website }),
    );
    const tagIds = await copyNamedDependency('tag', tags, tx.tag);

    const targetProducts = await tx.product.findMany({
      where: { consumer_id: targetId },
    });
    const targetById = new Map(targetProducts.map((row) => [row.id, row]));
    const targetByName = new Map(targetProducts.map((row) => [row.name, row]));
    const targetByCode = new Map(
      targetProducts.filter((row) => row.code).map((row) => [row.code!, row]),
    );

    let productsToCreate = 0;
    for (const source of sourceProducts) {
      const mapped = mappedId('product', source.id);
      if (mapped && targetById.has(mapped)) continue;
      const byName = targetByName.get(source.name);
      const byCode = source.code ? targetByCode.get(source.code) : undefined;
      if (!byName && !byCode) productsToCreate += 1;
    }

    const destination = await tx.consumer.findUniqueOrThrow({
      where: { id: targetId },
      select: { plan: { select: { name: true, max_products: true } } },
    });
    const maxProducts = destination.plan.max_products;
    if (
      maxProducts !== null &&
      targetProducts.length + productsToCreate > maxProducts
    ) {
      throw new BadRequestException(
        `Product limit exceeded: ${destination.plan.name} allows ${maxProducts}, destination has ${targetProducts.length}, and this import needs ${productsToCreate} more`,
      );
    }

    for (const source of sourceProducts) {
      const mapped = mappedId('product', source.id);
      let target = mapped ? targetById.get(mapped) : undefined;
      const byName = targetByName.get(source.name);
      const byCode = source.code ? targetByCode.get(source.code) : undefined;

      if (!target && byName && byCode && byName.id !== byCode.id) {
        count('products', 'conflicts');
        continue;
      }
      target ??= byCode ?? byName;

      // A mapped product may have been renamed into another destination
      // product's unique name/code. Do not guess which row should win.
      if (
        target &&
        ((byName && byName.id !== target.id) ||
          (byCode && byCode.id !== target.id))
      ) {
        count('products', 'conflicts');
        continue;
      }

      const productData = {
        name: source.name,
        code: source.code,
        description: source.description,
        category_id: source.category_id
          ? (categoryIds.get(source.category_id) ?? null)
          : null,
        brand_id: source.brand_id
          ? (brandIds.get(source.brand_id) ?? null)
          : null,
        has_variants: source.has_variants,
        tax_method: source.tax_method,
        tax: source.tax,
      };

      if (target) {
        await saveMapping('product', source.id, target.id);
        if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
          const previousName = target.name;
          const previousCode = target.code;
          target = await tx.product.update({
            where: { id: target.id },
            data: productData,
          });
          if (targetByName.get(previousName)?.id === target.id) {
            targetByName.delete(previousName);
          }
          if (
            previousCode &&
            targetByCode.get(previousCode)?.id === target.id
          ) {
            targetByCode.delete(previousCode);
          }
          count('products', 'updated');
        } else count('products', 'skipped');
      } else {
        target = await tx.product.create({
          data: {
            consumer_id: targetId,
            ...productData,
            created_at: source.created_at,
          },
        });
        await saveMapping('product', source.id, target.id);
        count('products', 'created');
      }
      targetById.set(target.id, target);
      targetByName.set(target.name, target);
      if (target.code) targetByCode.set(target.code, target);

      for (const tag of source.tags) {
        const targetTagId = tagIds.get(tag.tag_id);
        if (!targetTagId) continue;
        await tx.tagOnProduct.upsert({
          where: {
            product_id_tag_id: {
              product_id: target.id,
              tag_id: targetTagId,
            },
          },
          create: { product_id: target.id, tag_id: targetTagId },
          update: {},
        });
      }

      for (const sourceVariant of source.variants) {
        const mappedVariant = mappedId('product_variant', sourceVariant.id);
        let targetVariant = mappedVariant
          ? await tx.productVariant.findFirst({
              where: {
                id: mappedVariant,
                product_id: target.id,
                product: { consumer_id: targetId },
              },
            })
          : null;
        const variantMatches = await tx.productVariant.findMany({
          where: {
            product_id: target.id,
            OR: [
              ...(sourceVariant.sku ? [{ sku: sourceVariant.sku }] : []),
              ...(sourceVariant.barcode
                ? [{ barcode: sourceVariant.barcode }]
                : []),
              ...(!sourceVariant.sku && !sourceVariant.barcode
                ? [{ name: sourceVariant.name }]
                : []),
            ],
          },
          orderBy: { id: 'asc' },
        });
        const distinctMatches = [
          ...new Map(variantMatches.map((row) => [row.id, row])).values(),
        ];
        if (
          (targetVariant &&
            distinctMatches.some((row) => row.id !== targetVariant!.id)) ||
          (!targetVariant && distinctMatches.length > 1)
        ) {
          count('product_variants', 'conflicts');
          continue;
        }
        targetVariant ??= distinctMatches[0];

        const saleUnitId = unitIds.get(sourceVariant.sale_unit_id);
        const purchaseUnitId = unitIds.get(sourceVariant.purchase_unit_id);
        if (!saleUnitId || !purchaseUnitId) {
          throw new BadRequestException(
            `Product '${source.name}' has a variant with a missing unit relationship`,
          );
        }
        const variantData = {
          name: sourceVariant.name,
          sku: sourceVariant.sku,
          barcode: sourceVariant.barcode,
          regular_price: sourceVariant.regular_price,
          wholesale_price: sourceVariant.wholesale_price,
          sale_unit_id: saleUnitId,
          purchase_unit_id: purchaseUnitId,
          warranty_period: sourceVariant.warranty_period,
          image: sourceVariant.image,
          is_default: sourceVariant.is_default,
          alert_quantity: sourceVariant.alert_quantity,
          daily_sale_objective: sourceVariant.daily_sale_objective,
        };

        if (targetVariant) {
          await saveMapping(
            'product_variant',
            sourceVariant.id,
            targetVariant.id,
          );
          if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
            targetVariant = await tx.productVariant.update({
              where: { id: targetVariant.id },
              data: variantData,
            });
            count('product_variants', 'updated');
          } else count('product_variants', 'skipped');
        } else {
          targetVariant = await tx.productVariant.create({
            data: {
              product_id: target.id,
              ...variantData,
              created_at: sourceVariant.created_at,
            },
          });
          await saveMapping(
            'product_variant',
            sourceVariant.id,
            targetVariant.id,
          );
          count('product_variants', 'created');
        }

        for (const sourceAttribute of sourceVariant.VariantAttribute) {
          const targetAttribute = await tx.variantAttribute.findUnique({
            where: {
              variant_id_name: {
                variant_id: targetVariant.id,
                name: sourceAttribute.name,
              },
            },
          });
          if (targetAttribute) {
            await saveMapping(
              'variant_attribute',
              sourceAttribute.id,
              targetAttribute.id,
            );
            if (strategy === ConsumerImportDuplicateStrategy.UPDATE) {
              await tx.variantAttribute.update({
                where: { id: targetAttribute.id },
                data: { value: sourceAttribute.value },
              });
              count('variant_attributes', 'updated');
            } else count('variant_attributes', 'skipped');
          } else {
            const created = await tx.variantAttribute.create({
              data: {
                consumer_id: targetId,
                variant_id: targetVariant.id,
                name: sourceAttribute.name,
                value: sourceAttribute.value,
              },
            });
            await saveMapping(
              'variant_attribute',
              sourceAttribute.id,
              created.id,
            );
            count('variant_attributes', 'created');
          }
        }
      }
    }
  }
}
