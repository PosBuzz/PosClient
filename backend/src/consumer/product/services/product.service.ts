import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { unit } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProduct(createProductDto: CreateProductDto) {
    const {
      category_id,
      brand_id,
      product_unit_id,
      sale_unit_id,
      purchase_unit_id,
      tags,
      variants,
      branch_prices,
      serials, // assuming serials is an array of serial numbers you want to add
    } = createProductDto;

    // Validate category and brand
    const category = await this.prismaService.category.findUnique({
      where: { id: category_id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const brand = await this.prismaService.brand.findUnique({
      where: { id: brand_id },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const productUnit = await this.prismaService.unit.findUnique({
      where: { id: product_unit_id },
    });
    if (!productUnit) {
      throw new NotFoundException('Product unit not found');
    }

    let saleUnit: unit | null = null;
    if (sale_unit_id) {
      saleUnit = await this.prismaService.unit.findUnique({
        where: { id: sale_unit_id },
      });
      if (!saleUnit) {
        throw new NotFoundException('Sale unit not found');
      }
    }

    let purchaseUnit: unit | null = null;
    if (purchase_unit_id) {
      purchaseUnit = await this.prismaService.unit.findUnique({
        where: { id: purchase_unit_id },
      });
      if (!purchaseUnit) {
        throw new NotFoundException('Purchase unit not found');
      }
    }

    // Create the product with correct `connect` syntax
    const product = await this.prismaService.product.create({
      data: {
        name: createProductDto.name,
        code: createProductDto.code,
        type: createProductDto.type,
        cost: createProductDto.cost,
        price: createProductDto.price,
        wholesale_price: createProductDto.wholesale_price,
        image_url: createProductDto.image_url,
        description: createProductDto.description,
        featured: createProductDto.featured ?? false,
        in_stock: createProductDto.in_stock ?? true,
        sell_online: createProductDto.sell_online ?? false,
        daily_sale_objective: createProductDto.daily_sale_objective,
        alert_quantity: createProductDto.alert_quantity,
        product_tax: createProductDto.product_tax,
        tax_method: createProductDto.tax_method,

        // Relations with `connect`
        category: { connect: { id: category_id } },
        brand: { connect: { id: brand_id } },
        unit: { connect: { id: product_unit_id } },
        sale_unit: saleUnit ? { connect: { id: sale_unit_id } } : undefined,
        purchase_unit: purchaseUnit
          ? { connect: { id: purchase_unit_id } }
          : undefined,

        // Create nested variants and branch prices
        variants: {
          create: variants?.map((variant) => ({
            option: variant.option,
            value: variant.value,
            item_code: variant.item_code,
            cost: variant.cost,
            price: variant.price,
          })),
        },
        branch_prices: {
          create: branch_prices?.map((branchPrice) => ({
            branch: { connect: { id: branchPrice.branch_id } },
            price: branchPrice.price,
          })),
        },
      },
    });

    // Create serials for the product
    if (serials && serials.length > 0) {
      const serialPromises = serials.map((serial) =>
        this.prismaService.product_serial.create({
          data: {
            serial,
            product: { connect: { id: product.id } }, // Connect to the product
          },
        }),
      );
      await Promise.all(serialPromises);
    }

    // Create tags for the product
    if (tags) {
      const tagPromises = tags.map((tag) =>
        this.prismaService.product_tag.create({
          data: {
            product: { connect: { id: product.id } },
            tag,
          },
        }),
      );
      await Promise.all(tagPromises);
    }

    return product;
  }

  async createBranch(branchName: string) {
    return this.prismaService.branch.create({
      data: { name: branchName },
    });
  }

  async createCategory(categoryName: string) {
    return this.prismaService.category.create({
      data: { name: categoryName },
    });
  }

  async createBrand(brandName: string) {
    return this.prismaService.brand.create({
      data: { name: brandName },
    });
  }

  async createUnit(unitName: string) {
    return this.prismaService.unit.create({
      data: { name: unitName },
    });
  }
}
