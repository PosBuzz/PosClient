import { Injectable } from '@nestjs/common';
import { Prisma, TaxMethod } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportColumn, ImportRowError, ParsedRow } from '../import.types';
import { RowValidator } from './row-validator';

const TAX_METHODS = ['INCLUSIVE', 'EXCLUSIVE'] as const;

interface PreparedVariant {
  rowNumber: number;
  name: string;
  sku?: string;
  barcode?: string;
  regular_price: number;
  wholesale_price?: number;
  sale_unit_id: number;
  purchase_unit_id: number;
  alert_quantity?: number;
}

interface PreparedProduct {
  name: string;
  code?: string;
  description?: string;
  category_id?: number;
  brand_id?: number;
  tax: number;
  tax_method: TaxMethod;
  variants: PreparedVariant[];
}

@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  readonly sheetName = 'Products';

  readonly columns: ImportColumn[] = [
    {
      header: 'Product Name',
      required: true,
      hint: 'Repeat the same product name on several rows to give that product several variants.',
      example: 'Bluetooth Headphones',
    },
    {
      header: 'Product Code',
      required: false,
      hint: 'Optional, must be unique. Only read from the first row of each product.',
      example: 'BTH-100',
    },
    {
      header: 'Category',
      required: false,
      hint: 'Category name. It must already exist — create it first under Categories.',
      example: 'Electronics',
    },
    {
      header: 'Brand',
      required: false,
      hint: 'Brand name. It must already exist — create it first under Brands.',
      example: 'Acme',
    },
    {
      header: 'Unit',
      required: true,
      hint: 'Unit name, e.g. Piece. It must already exist under Units. Used as both sale and purchase unit.',
      example: 'Piece',
    },
    {
      header: 'Tax %',
      required: false,
      hint: 'Whole number, 0-100. Defaults to 0. Read from the first row of each product.',
      example: 5,
    },
    {
      header: 'Tax Method',
      required: false,
      hint: `One of: ${TAX_METHODS.join(', ')}. Defaults to EXCLUSIVE.`,
      example: 'EXCLUSIVE',
    },
    {
      header: 'Variant Name',
      required: true,
      hint: 'Name of this variant, e.g. Black or 500ml. Use "Default" for products without real variants.',
      example: 'Black',
    },
    {
      header: 'SKU',
      required: false,
      hint: 'Optional, must be unique across all variants.',
      example: 'BTH-100-BLK',
    },
    {
      header: 'Barcode',
      required: false,
      hint: 'Optional, must be unique across all variants.',
      example: '8801234567890',
    },
    {
      header: 'Regular Price',
      required: true,
      hint: 'Selling price of this variant.',
      example: 2500,
    },
    {
      header: 'Wholesale Price',
      required: false,
      hint: 'Optional wholesale price.',
      example: 2200,
    },
    {
      header: 'Alert Quantity',
      required: false,
      hint: 'Optional low-stock threshold, whole number.',
      example: 5,
    },
    {
      header: 'Description',
      required: false,
      hint: 'Optional. Read from the first row of each product.',
      example: 'Over-ear wireless headphones',
    },
  ];

  async prepare(
    consumerId: number,
    rows: ParsedRow[],
  ): Promise<{ prepared: PreparedProduct[]; errors: ImportRowError[] }> {
    const errors: ImportRowError[] = [];

    const [categories, brands, units] = await Promise.all([
      this.prisma.category.findMany({
        where: { consumer_id: consumerId },
        select: { id: true, name: true },
      }),
      this.prisma.brand.findMany({
        where: { consumer_id: consumerId },
        select: { id: true, name: true },
      }),
      this.prisma.unit.findMany({
        where: { consumer_id: consumerId },
        select: { id: true, name: true },
      }),
    ]);

    const byName = (list: { id: number; name: string }[]) =>
      new Map(list.map((item) => [item.name.trim().toLowerCase(), item.id]));
    const categoryIds = byName(categories);
    const brandIds = byName(brands);
    const unitIds = byName(units);

    const names = rows
      .map((row) => row.values['product name'])
      .filter((name): name is string => !!name);
    const codes = rows
      .map((row) => row.values['product code'])
      .filter((code): code is string => !!code);
    const skus = rows
      .map((row) => row.values['sku'])
      .filter((sku): sku is string => !!sku);
    const barcodes = rows
      .map((row) => row.values['barcode'])
      .filter((barcode): barcode is string => !!barcode);

    const [existingProducts, existingVariants] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          consumer_id: consumerId,
          OR: [{ name: { in: names } }, { code: { in: codes } }],
        },
        select: { name: true, code: true },
      }),
      this.prisma.productVariant.findMany({
        where: {
          product: { consumer_id: consumerId },
          OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }],
        },
        select: { sku: true, barcode: true },
      }),
    ]);

    const takenNames = new Set(
      existingProducts.map((product) => product.name.trim().toLowerCase()),
    );
    const takenCodes = new Set(
      existingProducts
        .map((product) => product.code?.trim().toLowerCase())
        .filter((code): code is string => !!code),
    );
    const takenSkus = new Set(
      existingVariants
        .map((variant) => variant.sku?.trim().toLowerCase())
        .filter((sku): sku is string => !!sku),
    );
    const takenBarcodes = new Set(
      existingVariants
        .map((variant) => variant.barcode?.trim().toLowerCase())
        .filter((barcode): barcode is string => !!barcode),
    );

    // Rows for the same product name are folded into one product with many
    // variants; product-level columns come from that product's first row.
    const products = new Map<string, PreparedProduct>();
    const seenSkus = new Map<string, number>();
    const seenBarcodes = new Map<string, number>();
    const seenVariantNames = new Set<string>();

    for (const row of rows) {
      const validator = new RowValidator(row);

      const productName = validator.text('Product Name', {
        required: true,
        max: 191,
      });
      const variantName = validator.text('Variant Name', {
        required: true,
        max: 191,
      });
      const unitName = validator.text('Unit', { required: true, max: 191 });
      const regularPrice = validator.number('Regular Price', {
        required: true,
        min: 0,
      });
      const wholesalePrice = validator.number('Wholesale Price', { min: 0 });
      const alertQuantity = validator.number('Alert Quantity', {
        min: 0,
        integer: true,
      });
      const sku = validator.text('SKU', { max: 100 });
      const barcode = validator.text('Barcode', { max: 100 });
      const code = validator.text('Product Code', { max: 100 });
      const description = validator.text('Description', { max: 1000 });
      const categoryName = validator.text('Category', { max: 191 });
      const brandName = validator.text('Brand', { max: 191 });
      const tax = validator.number('Tax %', { min: 0, max: 100, integer: true });
      const taxMethod = validator.choice('Tax Method', TAX_METHODS, {
        fallback: 'EXCLUSIVE',
      });

      let categoryId: number | undefined;
      if (categoryName) {
        categoryId = categoryIds.get(categoryName.toLowerCase());
        if (!categoryId) {
          validator.add(
            'Category',
            `Category "${categoryName}" does not exist. Create it first, or leave the cell empty.`,
          );
        }
      }

      let brandId: number | undefined;
      if (brandName) {
        brandId = brandIds.get(brandName.toLowerCase());
        if (!brandId) {
          validator.add(
            'Brand',
            `Brand "${brandName}" does not exist. Create it first, or leave the cell empty.`,
          );
        }
      }

      let unitId: number | undefined;
      if (unitName) {
        unitId = unitIds.get(unitName.toLowerCase());
        if (!unitId) {
          validator.add(
            'Unit',
            `Unit "${unitName}" does not exist. Create it first under Units.`,
          );
        }
      }

      const productKey = productName?.trim().toLowerCase() ?? '';
      const isNewProduct = !!productKey && !products.has(productKey);

      if (isNewProduct && takenNames.has(productKey)) {
        validator.add(
          'Product Name',
          `A product named "${productName}" already exists`,
        );
      }

      if (code) {
        const codeKey = code.toLowerCase();
        if (takenCodes.has(codeKey)) {
          validator.add(
            'Product Code',
            `Product code "${code}" is already used by another product`,
          );
        } else if (isNewProduct) {
          takenCodes.add(codeKey);
        }
      }

      if (sku) {
        const skuKey = sku.toLowerCase();
        if (takenSkus.has(skuKey)) {
          validator.add('SKU', `SKU "${sku}" is already used`);
        }
        const firstSeenOn = seenSkus.get(skuKey);
        if (firstSeenOn) {
          validator.add(
            'SKU',
            `SKU "${sku}" is used again on row ${firstSeenOn} of this file`,
          );
        } else {
          seenSkus.set(skuKey, row.rowNumber);
        }
      }

      if (barcode) {
        const barcodeKey = barcode.toLowerCase();
        if (takenBarcodes.has(barcodeKey)) {
          validator.add('Barcode', `Barcode "${barcode}" is already used`);
        }
        const firstSeenOn = seenBarcodes.get(barcodeKey);
        if (firstSeenOn) {
          validator.add(
            'Barcode',
            `Barcode "${barcode}" is used again on row ${firstSeenOn} of this file`,
          );
        } else {
          seenBarcodes.set(barcodeKey, row.rowNumber);
        }
      }

      if (productKey && variantName) {
        const variantKey = `${productKey}::${variantName.toLowerCase()}`;
        if (seenVariantNames.has(variantKey)) {
          validator.add(
            'Variant Name',
            `"${productName}" already has a variant named "${variantName}" earlier in this file`,
          );
        } else {
          seenVariantNames.add(variantKey);
        }
      }

      if (!validator.ok) {
        errors.push(...validator.problems);
        continue;
      }

      const existing = products.get(productKey);
      const variant: PreparedVariant = {
        rowNumber: row.rowNumber,
        name: variantName!,
        sku,
        barcode,
        regular_price: regularPrice!,
        wholesale_price: wholesalePrice,
        sale_unit_id: unitId!,
        purchase_unit_id: unitId!,
        alert_quantity: alertQuantity,
      };

      if (existing) {
        existing.variants.push(variant);
        continue;
      }

      products.set(productKey, {
        name: productName!,
        code,
        description,
        category_id: categoryId,
        brand_id: brandId,
        tax: tax ?? 0,
        tax_method: (taxMethod ?? 'EXCLUSIVE') as TaxMethod,
        variants: [variant],
      });
    }

    return { prepared: [...products.values()], errors };
  }

  /**
   * The plan's product cap applies to imports too — a bulk upload must not be a
   * way around it.
   */
  async checkProductLimit(
    consumerId: number,
    incoming: number,
  ): Promise<string | null> {
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: consumerId },
      select: { plan: { select: { name: true, max_products: true } } },
    });

    const max = consumer?.plan?.max_products ?? null;
    if (max === null) return null;

    const used = await this.prisma.product.count({
      where: { consumer_id: consumerId },
    });

    if (used + incoming <= max) return null;

    return `This file adds ${incoming} product(s), which would exceed your ${
      consumer?.plan?.name ?? 'current'
    } plan limit of ${max} (you already have ${used}). Upgrade your plan or import fewer products.`;
  }

  async write(
    consumerId: number,
    prepared: PreparedProduct[],
    tx: Prisma.TransactionClient,
  ): Promise<Record<string, number>> {
    let variantCount = 0;

    for (const product of prepared) {
      const created = await tx.product.create({
        data: {
          consumer_id: consumerId,
          name: product.name,
          code: product.code,
          description: product.description,
          category_id: product.category_id,
          brand_id: product.brand_id,
          tax: product.tax,
          tax_method: product.tax_method,
          has_variants: product.variants.length > 1,
        },
      });

      for (const [index, variant] of product.variants.entries()) {
        await tx.productVariant.create({
          data: {
            product_id: created.id,
            name: variant.name,
            sku: variant.sku,
            barcode: variant.barcode,
            regular_price: variant.regular_price,
            wholesale_price: variant.wholesale_price,
            sale_unit_id: variant.sale_unit_id,
            purchase_unit_id: variant.purchase_unit_id,
            alert_quantity: variant.alert_quantity ?? 0,
            is_default: index === 0,
          },
        });
        variantCount += 1;
      }
    }

    return { products: prepared.length, variants: variantCount };
  }
}
