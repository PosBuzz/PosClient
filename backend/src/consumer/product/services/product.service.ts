import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { UpdateEntityDto } from '../dtos/update-entity.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prismaService: PrismaService) {}

  // Create product with updated tag handling
  async createProduct(createProductDto: CreateProductDto, consumer_id: number) {
    const {
      category_id,
      brand_id,
      product_unit_id,
      sale_unit_id,
      purchase_unit_id,
      variants,
      branch_prices,
      serials,
      promotional_price,
      tags,
      ...productData
    } = createProductDto;

    if (!consumer_id || !category_id) {
      throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
    }

    // Create the product using unchecked input (direct IDs)
    const product = await this.prismaService.product.create({
      data: {
        ...productData,
        consumer_id,
        category_id,
        brand_id,
        product_unit_id,
        sale_unit_id,
        purchase_unit_id,
      },
    });

    // Create variants if provided
    if (variants && variants.length > 0) {
      await Promise.all(
        variants.map((variant) =>
          this.prismaService.productVariant.create({
            data: {
              option: variant.option,
              value: variant.value,
              item_code: variant.item_code,
              cost: variant.cost,
              price: variant.price,
              product: { connect: { id: product.id } },
            },
          }),
        ),
      );
    }

    // Create branch prices if provided
    if (branch_prices && branch_prices.length > 0) {
      await Promise.all(
        branch_prices.map((branchPrice) =>
          this.prismaService.productBranchPrice.create({
            data: {
              price: branchPrice.price,
              product: { connect: { id: product.id } },
              branch: { connect: { id: branchPrice.branch_id } },
            },
          }),
        ),
      );
    }

    // Create serials if provided
    if (serials && serials.length > 0) {
      await Promise.all(
        serials.map((serial) =>
          this.prismaService.productSerial.create({
            data: {
              serial,
              product: { connect: { id: product.id } },
            },
          }),
        ),
      );
    }

    // Create promotional price if provided
    if (promotional_price && typeof promotional_price === 'object') {
      await this.prismaService.promotionalPrice.create({
        data: {
          price: promotional_price.price,
          starts_at: promotional_price.starts_at,
          ends_at: promotional_price.ends_at,
          product: { connect: { id: product.id } },
        },
      });
    }

    // Handle tags with the new many-to-many relationship
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // For each tag name, find or create the tag and connect it to the product
      await Promise.all(
        tags.map(async (tag_id) => {
          // Create the product-tag relationship
          return this.prismaService.productTag.create({
            data: {
              product_id: product.id,
              tag_id,
            },
          });
        }),
      );
    }

    return this.getProduct(product.id, consumer_id);
  }

  async getAllProducts(
    consumer_id: number,
    query?: {
      search?: string;
      category_id?: number;
      brand_id?: number;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    // Build the where clause based on filters
    const where: any = {
      consumer_id,
    };

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.category_id) {
      where.category_id = query.category_id;
    }

    if (query?.brand_id) {
      where.brand_id = query.brand_id;
    }

    // Get total count for pagination
    const totalCount = await this.prismaService.product.count({ where });

    // Get the products with essential relations
    const products = await this.prismaService.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { name: true } },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    return {
      data: products,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  // Get a single product with updated tag handling and security
  async getProduct(id: number, consumer_id: number) {
    const product = await this.prismaService.product.findFirst({
      where: {
        id,
        consumer_id, // Add consumer_id to ensure tenant isolation
      },
      include: {
        variants: true,
        branch_prices: {
          include: { branch: true },
        },
        serial_numbers: true,
        promotional_price: true,
        tags: {
          include: { tag: true },
        },
        category: true,
        brand: true,
        unit: true,
        sale_unit: true,
        purchase_unit: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Transform the tags for frontend consumption
    const transformedProduct = {
      ...product,
      tags:
        product.tags?.map((pt) => ({
          id: pt.tag_id,
          name: pt.tag.name, // Use tag.tag instead of tag.name
        })) || [],
    };

    return transformedProduct;
  }

  // Update product with updated tag handling
  async updateProduct(
    id: number,
    updateProductDto: Partial<CreateProductDto>,
    consumer_id: number,
  ) {
    const {
      category_id,
      brand_id,
      product_unit_id,
      sale_unit_id,
      purchase_unit_id,
      variants,
      branch_prices,
      serials,
      tags,
      promotional_price, // Extract promotional_price from DTO
      ...productData
    } = updateProductDto;

    // Check if product exists and belongs to this consumer
    const existingProduct = await this.prismaService.product.findFirst({
      where: {
        id,
        consumer_id,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Prepare update data
    const updateData: any = { ...productData };

    // Handle relations
    if (category_id) {
      updateData.category = { connect: { id: category_id } };
    }
    if (brand_id) {
      updateData.brand = { connect: { id: brand_id } };
    }
    if (product_unit_id) {
      updateData.unit = { connect: { id: product_unit_id } };
    }
    if (sale_unit_id) {
      updateData.sale_unit = { connect: { id: sale_unit_id } };
    }
    if (purchase_unit_id) {
      updateData.purchase_unit = { connect: { id: purchase_unit_id } };
    }

    // Update the product (without promotional_price)
    const updatedProduct = await this.prismaService.product.update({
      where: { id },
      data: updateData,
    });

    // Handle promotional price if provided
    if (promotional_price) {
      const existingPromo = await this.prismaService.promotionalPrice.findFirst(
        {
          where: { product_id: id },
        },
      );

      if (existingPromo) {
        // Update existing promotional price
        await this.prismaService.promotionalPrice.update({
          where: { id: existingPromo.id },
          data: {
            price: promotional_price.price,
            starts_at: promotional_price.starts_at,
            ends_at: promotional_price.ends_at,
          },
        });
      } else {
        // Create new promotional price
        await this.prismaService.promotionalPrice.create({
          data: {
            price: promotional_price.price,
            starts_at: promotional_price.starts_at,
            ends_at: promotional_price.ends_at,
            product: { connect: { id } },
          },
        });
      }
    }

    // Handle variants if provided
    if (variants) {
      // Delete existing variants
      await this.prismaService.productVariant.deleteMany({
        where: { product_id: id },
      });

      // Create new variants
      await Promise.all(
        variants.map((variant) =>
          this.prismaService.productVariant.create({
            data: {
              option: variant.option,
              value: variant.value,
              item_code: variant.item_code,
              cost: variant.cost,
              price: variant.price,
              product: { connect: { id } },
            },
          }),
        ),
      );
    }

    // Handle branch prices if provided
    if (branch_prices) {
      // Delete existing branch prices
      await this.prismaService.productBranchPrice.deleteMany({
        where: { product_id: id },
      });

      // Create new branch prices
      await Promise.all(
        branch_prices.map((branchPrice) =>
          this.prismaService.productBranchPrice.create({
            data: {
              price: branchPrice.price,
              product: { connect: { id } },
              branch: { connect: { id: branchPrice.branch_id } },
            },
          }),
        ),
      );
    }

    // Handle serials if provided
    if (serials) {
      // Delete existing serials
      await this.prismaService.productSerial.deleteMany({
        where: { product_id: id },
      });

      // Create new serials
      await Promise.all(
        serials.map((serial) =>
          this.prismaService.productSerial.create({
            data: {
              serial,
              product: { connect: { id } },
            },
          }),
        ),
      );
    }

    // Handle tags with many-to-many relationship
    if (tags && Array.isArray(tags)) {
      // Delete existing product-tag relationships
      await this.prismaService.productTag.deleteMany({
        where: { product_id: id },
      });

      // Create new tag connections
      if (tags.length > 0) {
        await Promise.all(
          tags.map(async (tag_id) => {
            return this.prismaService.productTag.create({
              data: {
                product_id: id,
                tag_id,
              },
            });
          }),
        );
      }
    }

    return this.getProduct(id, consumer_id);
  }

  async deleteProduct(id: number, consumer_id: number) {
    // Check if product exists and belongs to this consumer
    const product = await this.prismaService.product.findFirst({
      where: {
        id,
        consumer_id,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Delete the product and all related records
    await this.prismaService.product.delete({
      where: { id },
    });

    return { success: true, message: 'Product deleted successfully' };
  }

  // tags
  async getTags(consumer_id: number) {
    return this.prismaService.tag.findMany({
      where: { consumer_id },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(tagData: string, consumer_id: number) {
    return this.prismaService.tag.create({
      data: {
        name: tagData,
        consumer_id, // Make sure this is passed correctly
      },
    });
  }

  async updateTag(id: number, name: string) {
    return this.prismaService.tag.update({
      where: { id },
      data: { name }, // Support both field names for flexibility
    });
  }

  async deleteTag(id: number) {
    // This will automatically delete all product_tag relations due to onDelete: Cascade
    await this.prismaService.tag.delete({
      where: { id },
    });

    return { success: true };
  }

  // Branches
  async createBranch(branchName: string, consumer_id: number) {
    return this.prismaService.branch.create({
      data: {
        name: branchName,
        consumer_id, // Properly add consumer_id
      },
    });
  }

  async getBranches(consumer_id: number) {
    return this.prismaService.branch.findMany({
      where: { consumer_id },
    });
  }

  async updateBranch(id: number, name: string) {
    return this.prismaService.branch.update({
      where: { id },
      data: { name },
    });
  }

  async deleteBranch(id: number) {
    await this.prismaService.branch.delete({
      where: { id },
    });
    return { success: true };
  }

  // Brands
  async createBrand(brandName: string, consumer_id: number) {
    return this.prismaService.brand.create({
      data: {
        name: brandName,
        consumer_id, // Properly add consumer_id
      },
    });
  }

  async getBrands(consumer_id: number) {
    return this.prismaService.brand.findMany({
      where: { consumer_id },
    });
  }

  async updateBrand(id: number, name: string) {
    return this.prismaService.brand.update({
      where: { id },
      data: { name },
    });
  }

  async deleteBrand(id: number) {
    await this.prismaService.brand.delete({
      where: { id },
    });
    return { success: true };
  }

  // Units
  async createUnit(unitName: string, consumer_id: number) {
    return this.prismaService.unit.create({
      data: {
        name: unitName,
        consumer_id, // Properly add consumer_id
      },
    });
  }

  async getUnits(consumer_id: number) {
    return this.prismaService.unit.findMany({
      where: { consumer_id },
    });
  }

  async updateUnit(id: number, name: string) {
    return this.prismaService.unit.update({
      where: { id },
      data: { name },
    });
  }

  async deleteUnit(id: number) {
    await this.prismaService.unit.delete({
      where: { id },
    });
    return { success: true };
  }

  // Category
  async createCategory(categoryName: string, consumer_id: number) {
    return this.prismaService.category.create({
      data: {
        name: categoryName,
        consumer_id, // Properly add consumer_id
      },
    });
  }

  async getCategories(consumer_id: number) {
    return this.prismaService.category.findMany({
      where: { consumer_id },
    });
  }

  async updateCategory(id: number, name: string) {
    return this.prismaService.category.update({
      where: { id },
      data: { name },
    });
  }

  async deleteCategory(id: number) {
    await this.prismaService.category.delete({
      where: { id },
    });
    return { success: true };
  }
}
